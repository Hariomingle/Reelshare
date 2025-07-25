import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';

const db = admin.firestore();

// Referral System Configuration
export const REFERRAL_CONFIG = {
  // Revenue sharing
  referrerBonus: 0.05,        // 5% of referral's revenue goes to referrer
  
  // Code generation
  codeLength: 8,              // Length of referral codes
  codePrefix: 'RS',           // Prefix for ReelShare codes (RS12AB34)
  
  // Limits and validation
  maxReferralsPerUser: 1000,  // Maximum referrals per user
  minAccountAge: 24,          // Hours before can use referral codes
  
  // Bonuses
  signupBonus: {
    referrer: 10,             // ₹10 bonus for successful referral
    referee: 5                // ₹5 welcome bonus for new user
  },
  
  // Revenue tracking
  trackingDuration: 365,      // Days to track referral revenue (1 year)
  minRevenueForBonus: 0.01    // Minimum revenue to trigger referral bonus
};

interface ReferralCode {
  code: string;
  userId: string;
  createdAt: admin.firestore.Timestamp;
  isActive: boolean;
  totalUses: number;
  maxUses?: number;
  expiresAt?: admin.firestore.Timestamp;
}

interface ReferralRelationship {
  referrerId: string;        // User who referred
  refereeId: string;         // User who was referred
  referralCode: string;      // Code used
  signupDate: admin.firestore.Timestamp;
  status: 'active' | 'inactive' | 'expired';
  totalRevenueShared: number;
  lastRevenueShare: admin.firestore.Timestamp | null;
  bonusPaid: boolean;        // Whether signup bonus was paid
}

interface ReferralEarnings {
  referrerId: string;
  refereeId: string;
  amount: number;
  sourceRevenue: number;     // Original revenue that triggered bonus
  percentage: number;        // Percentage earned (5%)
  date: admin.firestore.Timestamp;
  reelId?: string;          // If from ad revenue
  transactionId: string;    // Related wallet transaction
}

interface ReferralStats {
  userId: string;
  totalReferrals: number;
  activeReferrals: number;
  totalEarningsFromReferrals: number;
  monthlyEarnings: number;
  topReferral: {
    userId: string;
    earnings: number;
  } | null;
  lastUpdated: admin.firestore.Timestamp;
}

export class ReferralSystem {
  
  /**
   * Generate a unique referral code for a user
   */
  async generateReferralCode(userId: string, customCode?: string): Promise<{
    success: boolean;
    code?: string;
    message: string;
  }> {
    try {
      // Check if user already has an active code
      const existingCode = await db.collection('referral_codes')
        .where('userId', '==', userId)
        .where('isActive', '==', true)
        .limit(1)
        .get();

      if (!existingCode.empty) {
        const existing = existingCode.docs[0].data() as ReferralCode;
        return {
          success: true,
          code: existing.code,
          message: 'Using existing active referral code'
        };
      }

      // Generate or validate custom code
      let code: string;
      if (customCode) {
        // Validate custom code format
        if (!/^[A-Z0-9]{6,12}$/.test(customCode)) {
          return {
            success: false,
            message: 'Custom code must be 6-12 characters, letters and numbers only'
          };
        }
        
        // Check if custom code is available
        const existingCustom = await db.collection('referral_codes')
          .where('code', '==', customCode)
          .limit(1)
          .get();
          
        if (!existingCustom.empty) {
          return {
            success: false,
            message: 'Custom code already exists'
          };
        }
        
        code = customCode;
      } else {
        // Generate random code
        code = await this.generateUniqueCode();
      }

      // Create referral code document
      const referralCodeData: ReferralCode = {
        code,
        userId,
        createdAt: admin.firestore.Timestamp.now(),
        isActive: true,
        totalUses: 0
      };

      await db.collection('referral_codes').doc(code).set(referralCodeData);

      // Initialize user referral stats
      await this.initializeReferralStats(userId);

      return {
        success: true,
        code,
        message: 'Referral code created successfully'
      };

    } catch (error) {
      console.error('Error generating referral code:', error);
      return {
        success: false,
        message: 'Failed to generate referral code'
      };
    }
  }

  /**
   * Generate a unique random code
   */
  private async generateUniqueCode(): Promise<string> {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let attempts = 0;
    const maxAttempts = 10;

    while (attempts < maxAttempts) {
      let code = REFERRAL_CONFIG.codePrefix;
      
      for (let i = 0; i < REFERRAL_CONFIG.codeLength - REFERRAL_CONFIG.codePrefix.length; i++) {
        code += chars.charAt(Math.floor(Math.random() * chars.length));
      }

      // Check if code exists
      const existing = await db.collection('referral_codes').doc(code).get();
      if (!existing.exists) {
        return code;
      }

      attempts++;
    }

    throw new Error('Could not generate unique referral code');
  }

  /**
   * Validate and apply referral code during signup
   */
  async applyReferralCode(
    newUserId: string,
    referralCode: string,
    userEmail: string
  ): Promise<{
    success: boolean;
    referrerId?: string;
    message: string;
    bonusAwarded?: number;
  }> {
    try {
      // Get referral code data
      const codeDoc = await db.collection('referral_codes').doc(referralCode).get();
      if (!codeDoc.exists) {
        return {
          success: false,
          message: 'Invalid referral code'
        };
      }

      const codeData = codeDoc.data() as ReferralCode;
      
      // Validate code is active
      if (!codeData.isActive) {
        return {
          success: false,
          message: 'Referral code is no longer active'
        };
      }

      // Check if code has expired
      if (codeData.expiresAt && codeData.expiresAt.toMillis() < Date.now()) {
        return {
          success: false,
          message: 'Referral code has expired'
        };
      }

      // Check if user is trying to refer themselves
      if (codeData.userId === newUserId) {
        return {
          success: false,
          message: 'Cannot use your own referral code'
        };
      }

      // Check if user already used a referral code
      const existingRelationship = await db.collection('referral_relationships')
        .where('refereeId', '==', newUserId)
        .limit(1)
        .get();

      if (!existingRelationship.empty) {
        return {
          success: false,
          message: 'User already has a referral relationship'
        };
      }

      // Check referrer's limits
      const referrerRelationships = await db.collection('referral_relationships')
        .where('referrerId', '==', codeData.userId)
        .where('status', '==', 'active')
        .get();

      if (referrerRelationships.size >= REFERRAL_CONFIG.maxReferralsPerUser) {
        return {
          success: false,
          message: 'Referrer has reached maximum referral limit'
        };
      }

      // Create referral relationship
      const relationshipData: ReferralRelationship = {
        referrerId: codeData.userId,
        refereeId: newUserId,
        referralCode,
        signupDate: admin.firestore.Timestamp.now(),
        status: 'active',
        totalRevenueShared: 0,
        lastRevenueShare: null,
        bonusPaid: false
      };

      const relationshipRef = await db.collection('referral_relationships').add(relationshipData);

      // Process signup bonuses
      await this.processSignupBonuses(codeData.userId, newUserId, relationshipRef.id);

      // Update code usage
      await codeDoc.ref.update({
        totalUses: admin.firestore.FieldValue.increment(1)
      });

      // Update referrer stats
      await this.updateReferralStats(codeData.userId, 'new_referral');

      return {
        success: true,
        referrerId: codeData.userId,
        message: 'Referral code applied successfully',
        bonusAwarded: REFERRAL_CONFIG.signupBonus.referee
      };

    } catch (error) {
      console.error('Error applying referral code:', error);
      return {
        success: false,
        message: 'Failed to apply referral code'
      };
    }
  }

  /**
   * Process signup bonuses for both referrer and referee
   */
  private async processSignupBonuses(
    referrerId: string,
    refereeId: string,
    relationshipId: string
  ): Promise<void> {
    const batch = db.batch();
    const now = admin.firestore.Timestamp.now();

    try {
      // Award referrer bonus
      const referrerWalletRef = db.collection('wallets').doc(referrerId);
      const referrerWallet = await referrerWalletRef.get();
      
      if (referrerWallet.exists) {
        const walletData = referrerWallet.data()!;
        batch.update(referrerWalletRef, {
          totalBalance: walletData.totalBalance + REFERRAL_CONFIG.signupBonus.referrer,
          availableBalance: walletData.availableBalance + REFERRAL_CONFIG.signupBonus.referrer,
          totalEarned: walletData.totalEarned + REFERRAL_CONFIG.signupBonus.referrer,
          bonusEarnings: walletData.bonusEarnings + REFERRAL_CONFIG.signupBonus.referrer,
          referralEarnings: (walletData.referralEarnings || 0) + REFERRAL_CONFIG.signupBonus.referrer,
          lastUpdated: now
        });

        // Create referrer transaction
        const referrerTransactionRef = db.collection('wallet_transactions').doc();
        batch.set(referrerTransactionRef, {
          userId: referrerId,
          type: 'earning',
          subType: 'referral_signup',
          amount: REFERRAL_CONFIG.signupBonus.referrer,
          description: `Referral signup bonus - new user joined`,
          status: 'completed',
          metadata: {
            refereeId,
            relationshipId,
            bonusType: 'signup'
          },
          createdAt: now,
          processedAt: now
        });
      }

      // Award referee welcome bonus
      const refereeWalletRef = db.collection('wallets').doc(refereeId);
      const refereeWallet = await refereeWalletRef.get();
      
      if (refereeWallet.exists) {
        const walletData = refereeWallet.data()!;
        batch.update(refereeWalletRef, {
          totalBalance: walletData.totalBalance + REFERRAL_CONFIG.signupBonus.referee,
          availableBalance: walletData.availableBalance + REFERRAL_CONFIG.signupBonus.referee,
          totalEarned: walletData.totalEarned + REFERRAL_CONFIG.signupBonus.referee,
          bonusEarnings: walletData.bonusEarnings + REFERRAL_CONFIG.signupBonus.referee,
          lastUpdated: now
        });

        // Create referee transaction
        const refereeTransactionRef = db.collection('wallet_transactions').doc();
        batch.set(refereeTransactionRef, {
          userId: refereeId,
          type: 'earning',
          subType: 'welcome_bonus',
          amount: REFERRAL_CONFIG.signupBonus.referee,
          description: `Welcome bonus for joining with referral code`,
          status: 'completed',
          metadata: {
            referrerId,
            relationshipId,
            bonusType: 'welcome'
          },
          createdAt: now,
          processedAt: now
        });
      }

      // Mark relationship as bonus paid
      const relationshipRef = db.collection('referral_relationships').doc(relationshipId);
      batch.update(relationshipRef, {
        bonusPaid: true
      });

      await batch.commit();

    } catch (error) {
      console.error('Error processing signup bonuses:', error);
      throw error;
    }
  }

  /**
   * Process referral revenue sharing when referee earns money
   */
  async processReferralRevenue(
    refereeId: string,
    refereeRevenue: number,
    sourceTransactionId: string,
    reelId?: string
  ): Promise<{
    success: boolean;
    referralBonus?: number;
    referrerId?: string;
    message: string;
  }> {
    try {
      // Check if referee has an active referral relationship
      const relationshipQuery = await db.collection('referral_relationships')
        .where('refereeId', '==', refereeId)
        .where('status', '==', 'active')
        .limit(1)
        .get();

      if (relationshipQuery.empty) {
        return {
          success: true,
          message: 'No active referral relationship found'
        };
      }

      const relationshipDoc = relationshipQuery.docs[0];
      const relationship = relationshipDoc.data() as ReferralRelationship;

      // Check if revenue meets minimum threshold
      if (refereeRevenue < REFERRAL_CONFIG.minRevenueForBonus) {
        return {
          success: true,
          message: 'Revenue below minimum threshold for referral bonus'
        };
      }

      // Check if relationship is still within tracking duration
      const daysSinceSignup = (Date.now() - relationship.signupDate.toMillis()) / (24 * 60 * 60 * 1000);
      if (daysSinceSignup > REFERRAL_CONFIG.trackingDuration) {
        // Expire the relationship
        await relationshipDoc.ref.update({ status: 'expired' });
        return {
          success: true,
          message: 'Referral relationship has expired'
        };
      }

      // Calculate referral bonus (5% of referee's revenue)
      const referralBonus = refereeRevenue * REFERRAL_CONFIG.referrerBonus;

      // Process the referral bonus
      await this.awardReferralBonus(
        relationship.referrerId,
        refereeId,
        referralBonus,
        refereeRevenue,
        sourceTransactionId,
        reelId
      );

      // Update relationship totals
      await relationshipDoc.ref.update({
        totalRevenueShared: relationship.totalRevenueShared + referralBonus,
        lastRevenueShare: admin.firestore.Timestamp.now()
      });

      // Update referrer stats
      await this.updateReferralStats(relationship.referrerId, 'revenue_earned', referralBonus);

      return {
        success: true,
        referralBonus,
        referrerId: relationship.referrerId,
        message: `Referral bonus of ₹${referralBonus.toFixed(4)} awarded`
      };

    } catch (error) {
      console.error('Error processing referral revenue:', error);
      return {
        success: false,
        message: 'Failed to process referral revenue'
      };
    }
  }

  /**
   * Award referral bonus to referrer
   */
  private async awardReferralBonus(
    referrerId: string,
    refereeId: string,
    bonusAmount: number,
    sourceRevenue: number,
    sourceTransactionId: string,
    reelId?: string
  ): Promise<void> {
    const batch = db.batch();
    const now = admin.firestore.Timestamp.now();

    try {
      // Update referrer wallet
      const referrerWalletRef = db.collection('wallets').doc(referrerId);
      const referrerWallet = await referrerWalletRef.get();

      if (referrerWallet.exists) {
        const walletData = referrerWallet.data()!;
        batch.update(referrerWalletRef, {
          totalBalance: walletData.totalBalance + bonusAmount,
          availableBalance: walletData.availableBalance + bonusAmount,
          totalEarned: walletData.totalEarned + bonusAmount,
          referralEarnings: (walletData.referralEarnings || 0) + bonusAmount,
          lastUpdated: now
        });

        // Create referrer transaction
        const referrerTransactionRef = db.collection('wallet_transactions').doc();
        const transactionId = referrerTransactionRef.id;
        
        batch.set(referrerTransactionRef, {
          userId: referrerId,
          type: 'earning',
          subType: 'referral_revenue',
          amount: bonusAmount,
          description: `Referral bonus (5%) from ${refereeId}'s earnings`,
          status: 'completed',
          reelId: reelId || null,
          metadata: {
            refereeId,
            sourceRevenue,
            sourceTransactionId,
            bonusPercentage: REFERRAL_CONFIG.referrerBonus * 100,
            reelId: reelId || null
          },
          createdAt: now,
          processedAt: now
        });

        // Create referral earnings record
        const earningsRef = db.collection('referral_earnings').doc();
        batch.set(earningsRef, {
          referrerId,
          refereeId,
          amount: bonusAmount,
          sourceRevenue,
          percentage: REFERRAL_CONFIG.referrerBonus * 100,
          date: now,
          reelId: reelId || null,
          transactionId
        });
      }

      await batch.commit();

    } catch (error) {
      console.error('Error awarding referral bonus:', error);
      throw error;
    }
  }

  /**
   * Initialize referral stats for a user
   */
  private async initializeReferralStats(userId: string): Promise<void> {
    const statsData: ReferralStats = {
      userId,
      totalReferrals: 0,
      activeReferrals: 0,
      totalEarningsFromReferrals: 0,
      monthlyEarnings: 0,
      topReferral: null,
      lastUpdated: admin.firestore.Timestamp.now()
    };

    await db.collection('referral_stats').doc(userId).set(statsData, { merge: true });
  }

  /**
   * Update referral stats for a user
   */
  private async updateReferralStats(
    userId: string,
    action: 'new_referral' | 'revenue_earned',
    amount?: number
  ): Promise<void> {
    try {
      const statsRef = db.collection('referral_stats').doc(userId);
      const statsDoc = await statsRef.get();

      let updates: any = {
        lastUpdated: admin.firestore.Timestamp.now()
      };

      if (action === 'new_referral') {
        updates.totalReferrals = admin.firestore.FieldValue.increment(1);
        updates.activeReferrals = admin.firestore.FieldValue.increment(1);
      } else if (action === 'revenue_earned' && amount) {
        updates.totalEarningsFromReferrals = admin.firestore.FieldValue.increment(amount);
        
        // Update monthly earnings (simplified - could be more sophisticated)
        const now = new Date();
        const thisMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
        updates[`monthlyBreakdown.${thisMonth}`] = admin.firestore.FieldValue.increment(amount);
      }

      await statsRef.update(updates);

    } catch (error) {
      console.error('Error updating referral stats:', error);
    }
  }

  /**
   * Get referral analytics for a user
   */
  async getReferralAnalytics(userId: string): Promise<{
    success: boolean;
    data?: {
      stats: ReferralStats;
      recentEarnings: ReferralEarnings[];
      activeReferrals: any[];
      monthlyTrend: { [month: string]: number };
    };
    message: string;
  }> {
    try {
      // Get user stats
      const statsDoc = await db.collection('referral_stats').doc(userId).get();
      if (!statsDoc.exists) {
        await this.initializeReferralStats(userId);
        return this.getReferralAnalytics(userId);
      }

      const stats = statsDoc.data() as ReferralStats;

      // Get recent earnings (last 30 days)
      const thirtyDaysAgo = admin.firestore.Timestamp.fromMillis(
        Date.now() - 30 * 24 * 60 * 60 * 1000
      );

      const recentEarningsQuery = await db.collection('referral_earnings')
        .where('referrerId', '==', userId)
        .where('date', '>=', thirtyDaysAgo)
        .orderBy('date', 'desc')
        .limit(50)
        .get();

      const recentEarnings = recentEarningsQuery.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as ReferralEarnings[];

      // Get active referrals
      const activeReferralsQuery = await db.collection('referral_relationships')
        .where('referrerId', '==', userId)
        .where('status', '==', 'active')
        .orderBy('signupDate', 'desc')
        .limit(20)
        .get();

      const activeReferrals = await Promise.all(
        activeReferralsQuery.docs.map(async (doc) => {
          const relationship = doc.data();
          
          // Get referee user info
          const refereeDoc = await db.collection('users').doc(relationship.refereeId).get();
          const referee = refereeDoc.exists ? refereeDoc.data() : null;

          return {
            id: doc.id,
            ...relationship,
            referee: referee ? {
              id: referee.uid,
              username: referee.username,
              avatar: referee.avatar
            } : null
          };
        })
      );

      // Calculate monthly trend (last 6 months)
      const monthlyTrend: { [month: string]: number } = {};
      const now = new Date();
      
      for (let i = 5; i >= 0; i--) {
        const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
        const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
        
        const monthStart = admin.firestore.Timestamp.fromDate(date);
        const monthEnd = admin.firestore.Timestamp.fromDate(
          new Date(date.getFullYear(), date.getMonth() + 1, 0)
        );

        const monthEarningsQuery = await db.collection('referral_earnings')
          .where('referrerId', '==', userId)
          .where('date', '>=', monthStart)
          .where('date', '<=', monthEnd)
          .get();

        monthlyTrend[monthKey] = monthEarningsQuery.docs.reduce(
          (sum, doc) => sum + (doc.data().amount || 0), 0
        );
      }

      return {
        success: true,
        data: {
          stats,
          recentEarnings,
          activeReferrals,
          monthlyTrend
        },
        message: 'Referral analytics retrieved successfully'
      };

    } catch (error) {
      console.error('Error getting referral analytics:', error);
      return {
        success: false,
        message: 'Failed to get referral analytics'
      };
    }
  }

  /**
   * Get referral leaderboard
   */
  async getReferralLeaderboard(limit: number = 10): Promise<{
    success: boolean;
    data?: Array<{
      userId: string;
      username: string;
      avatar?: string;
      totalReferrals: number;
      totalEarnings: number;
      rank: number;
    }>;
    message: string;
  }> {
    try {
      const leaderboardQuery = await db.collection('referral_stats')
        .orderBy('totalEarningsFromReferrals', 'desc')
        .limit(limit)
        .get();

      const leaderboard = await Promise.all(
        leaderboardQuery.docs.map(async (doc, index) => {
          const stats = doc.data() as ReferralStats;
          
          // Get user profile
          const userDoc = await db.collection('users').doc(stats.userId).get();
          const user = userDoc.exists ? userDoc.data() : null;

          return {
            userId: stats.userId,
            username: user?.username || 'Unknown User',
            avatar: user?.avatar || null,
            totalReferrals: stats.totalReferrals,
            totalEarnings: stats.totalEarningsFromReferrals,
            rank: index + 1
          };
        })
      );

      return {
        success: true,
        data: leaderboard,
        message: 'Referral leaderboard retrieved successfully'
      };

    } catch (error) {
      console.error('Error getting referral leaderboard:', error);
      return {
        success: false,
        message: 'Failed to get referral leaderboard'
      };
    }
  }

  /**
   * Generate shareable referral link
   */
  generateReferralLink(referralCode: string, baseUrl: string = 'https://reelshare.app'): string {
    return `${baseUrl}/signup?ref=${referralCode}`;
  }

  /**
   * Generate referral share message
   */
  generateShareMessage(referralCode: string, username: string, customMessage?: string): string {
    const baseMessage = `🎬 Join me on ReelShare and start earning money by watching and creating videos!\n\n💰 Use my referral code: ${referralCode}\n🎁 Get ₹5 welcome bonus when you sign up!\n\n`;
    
    if (customMessage) {
      return baseMessage + customMessage + `\n\n${this.generateReferralLink(referralCode)}`;
    }

    return baseMessage + `Download ReelShare now: ${this.generateReferralLink(referralCode)}`;
  }
}

export const referralSystem = new ReferralSystem(); 