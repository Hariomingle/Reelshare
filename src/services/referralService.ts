import { httpsCallable } from 'firebase/functions';
import { functions, db } from './firebase';
import { collection, doc, setDoc, getDoc, updateDoc, serverTimestamp, where, query, getDocs, orderBy, limit } from 'firebase/firestore';
import { ApiResponse } from '../types';

interface ReferralCode {
  code: string;
  userId: string;
  createdAt: any;
  isActive: boolean;
  totalUses: number;
  maxUses?: number;
  expiresAt?: any;
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
  lastUpdated: any;
}

interface ReferralAnalytics {
  stats: ReferralStats;
  recentEarnings: Array<{
    refereeId: string;
    amount: number;
    sourceRevenue: number;
    date: any;
    reelId?: string;
  }>;
  activeReferrals: Array<{
    id: string;
    refereeId: string;
    signupDate: any;
    totalRevenueShared: number;
    referee?: {
      id: string;
      username: string;
      avatar?: string;
    };
  }>;
  monthlyTrend: { [month: string]: number };
}

interface ShareData {
  shareLink: string;
  shareMessage: string;
  qrCodeUrl: string;
  socialMedia: {
    whatsapp: string;
    telegram: string;
    facebook: string;
    twitter: string;
  };
}

interface LeaderboardEntry {
  userId: string;
  username: string;
  avatar?: string;
  totalReferrals: number;
  totalEarnings: number;
  rank: number;
}

class ReferralService {
  private readonly generateReferralCodeFunction = httpsCallable(functions, 'generateReferralCode');
  private readonly applyReferralCodeFunction = httpsCallable(functions, 'applyReferralCode');
  private readonly getReferralAnalyticsFunction = httpsCallable(functions, 'getReferralAnalytics');
  private readonly getReferralLeaderboardFunction = httpsCallable(functions, 'getReferralLeaderboard');
  private readonly generateReferralShareFunction = httpsCallable(functions, 'generateReferralShare');

  /**
   * Generate a referral code for the current user
   */
  async generateReferralCode(customCode?: string): Promise<ApiResponse<{
    code: string;
    shareLink: string;
  }>> {
    try {
      const result = await this.generateReferralCodeFunction({ customCode });

      return {
        success: result.data.success,
        data: {
          code: result.data.code,
          shareLink: result.data.shareLink
        },
        message: result.data.message
      };

    } catch (error) {
      console.error('Error generating referral code:', error);
      return {
        success: false,
        error: 'Failed to generate referral code',
        message: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Apply a referral code during user signup
   */
  async applyReferralCode(referralCode: string, userEmail: string): Promise<ApiResponse<{
    referrerId: string;
    bonusAwarded: number;
  }>> {
    try {
      const result = await this.applyReferralCodeFunction({ 
        referralCode: referralCode.toUpperCase().trim(),
        userEmail 
      });

      return {
        success: result.data.success,
        data: {
          referrerId: result.data.referrerId,
          bonusAwarded: result.data.bonusAwarded
        },
        message: result.data.message
      };

    } catch (error) {
      console.error('Error applying referral code:', error);
      return {
        success: false,
        error: 'Failed to apply referral code',
        message: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Get referral analytics for the current user
   */
  async getReferralAnalytics(userId?: string): Promise<ApiResponse<ReferralAnalytics>> {
    try {
      const result = await this.getReferralAnalyticsFunction({ userId });

      return {
        success: result.data.success,
        data: result.data.data,
        message: result.data.message
      };

    } catch (error) {
      console.error('Error getting referral analytics:', error);
      return {
        success: false,
        error: 'Failed to get referral analytics',
        message: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Get referral leaderboard
   */
  async getReferralLeaderboard(limit: number = 10): Promise<ApiResponse<LeaderboardEntry[]>> {
    try {
      const result = await this.getReferralLeaderboardFunction({ limit });

      return {
        success: result.data.success,
        data: result.data.data,
        message: result.data.message
      };

    } catch (error) {
      console.error('Error getting referral leaderboard:', error);
      return {
        success: false,
        error: 'Failed to get referral leaderboard',
        message: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Generate shareable referral content
   */
  async generateShareContent(referralCode: string, customMessage?: string): Promise<ApiResponse<ShareData>> {
    try {
      const result = await this.generateReferralShareFunction({ 
        referralCode,
        customMessage 
      });

      return {
        success: result.data.success,
        data: result.data.data,
        message: result.data.message
      };

    } catch (error) {
      console.error('Error generating share content:', error);
      return {
        success: false,
        error: 'Failed to generate share content',
        message: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Get user's referral code from local storage/cache
   */
  async getUserReferralCode(userId: string): Promise<string | null> {
    try {
      const codeQuery = query(
        collection(db, 'referral_codes'),
        where('userId', '==', userId),
        where('isActive', '==', true),
        limit(1)
      );

      const codeSnapshot = await getDocs(codeQuery);
      if (!codeSnapshot.empty) {
        const codeData = codeSnapshot.docs[0].data() as ReferralCode;
        return codeData.code;
      }

      return null;
    } catch (error) {
      console.error('Error getting user referral code:', error);
      return null;
    }
  }

  /**
   * Check if a referral code is valid
   */
  async validateReferralCode(code: string): Promise<{
    valid: boolean;
    message: string;
    referrerInfo?: {
      username: string;
      avatar?: string;
    };
  }> {
    try {
      const codeDoc = await getDoc(doc(db, 'referral_codes', code.toUpperCase().trim()));
      
      if (!codeDoc.exists()) {
        return {
          valid: false,
          message: 'Referral code not found'
        };
      }

      const codeData = codeDoc.data() as ReferralCode;

      if (!codeData.isActive) {
        return {
          valid: false,
          message: 'Referral code is no longer active'
        };
      }

      if (codeData.expiresAt && codeData.expiresAt.toMillis() < Date.now()) {
        return {
          valid: false,
          message: 'Referral code has expired'
        };
      }

      // Get referrer info
      const referrerDoc = await getDoc(doc(db, 'users', codeData.userId));
      const referrerInfo = referrerDoc.exists() ? {
        username: referrerDoc.data().username || 'User',
        avatar: referrerDoc.data().avatar
      } : undefined;

      return {
        valid: true,
        message: 'Valid referral code',
        referrerInfo
      };

    } catch (error) {
      console.error('Error validating referral code:', error);
      return {
        valid: false,
        message: 'Error validating referral code'
      };
    }
  }

  /**
   * Share referral code via native sharing
   */
  async shareReferralCode(
    referralCode: string, 
    customMessage?: string,
    platform?: 'system' | 'whatsapp' | 'telegram' | 'facebook' | 'twitter' | 'copy'
  ): Promise<ApiResponse<{ shared: boolean }>> {
    try {
      const shareResult = await this.generateShareContent(referralCode, customMessage);
      
      if (!shareResult.success || !shareResult.data) {
        return {
          success: false,
          error: 'Failed to generate share content'
        };
      }

      const shareData = shareResult.data;

      switch (platform) {
        case 'whatsapp':
          window.open(shareData.socialMedia.whatsapp, '_blank');
          break;
        case 'telegram':
          window.open(shareData.socialMedia.telegram, '_blank');
          break;
        case 'facebook':
          window.open(shareData.socialMedia.facebook, '_blank');
          break;
        case 'twitter':
          window.open(shareData.socialMedia.twitter, '_blank');
          break;
        case 'copy':
          await navigator.clipboard.writeText(shareData.shareMessage);
          break;
        case 'system':
        default:
          if (navigator.share) {
            await navigator.share({
              title: 'Join me on ReelShare!',
              text: shareData.shareMessage,
              url: shareData.shareLink
            });
          } else {
            // Fallback to copying to clipboard
            await navigator.clipboard.writeText(shareData.shareMessage);
          }
          break;
      }

      return {
        success: true,
        data: { shared: true },
        message: 'Referral code shared successfully'
      };

    } catch (error) {
      console.error('Error sharing referral code:', error);
      return {
        success: false,
        error: 'Failed to share referral code',
        message: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Generate QR code for referral link
   */
  generateQRCode(referralCode: string, size: number = 200): string {
    const shareLink = this.generateReferralLink(referralCode);
    return `https://api.qrserver.com/v1/create-qr-code/?size=${size}x${size}&data=${encodeURIComponent(shareLink)}`;
  }

  /**
   * Generate referral link
   */
  generateReferralLink(referralCode: string, baseUrl: string = 'https://reelshare.app'): string {
    return `${baseUrl}/signup?ref=${referralCode}`;
  }

  /**
   * Format referral earnings for display
   */
  formatEarnings(amount: number): string {
    if (amount >= 1000) {
      return `₹${(amount / 1000).toFixed(1)}K`;
    } else if (amount >= 1) {
      return `₹${amount.toFixed(2)}`;
    } else {
      return `₹${amount.toFixed(3)}`;
    }
  }

  /**
   * Calculate referral code suggestions
   */
  generateCodeSuggestions(username: string): string[] {
    const suggestions: string[] = [];
    const cleanUsername = username.replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
    
    // Username based suggestions
    if (cleanUsername.length >= 4) {
      suggestions.push(`RS${cleanUsername.substring(0, 6)}`);
      suggestions.push(`${cleanUsername.substring(0, 4)}2024`);
    }

    // Random suggestions
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    for (let i = 0; i < 3; i++) {
      let code = 'RS';
      for (let j = 0; j < 6; j++) {
        code += chars.charAt(Math.floor(Math.random() * chars.length));
      }
      suggestions.push(code);
    }

    // Pattern-based suggestions
    suggestions.push(`REEL${Math.floor(Math.random() * 999).toString().padStart(3, '0')}`);
    suggestions.push(`SHARE${Math.floor(Math.random() * 99).toString().padStart(2, '0')}`);

    return suggestions.slice(0, 5);
  }

  /**
   * Get referral code from URL parameters
   */
  getReferralCodeFromURL(): string | null {
    try {
      const urlParams = new URLSearchParams(window.location.search);
      const refCode = urlParams.get('ref');
      return refCode ? refCode.toUpperCase().trim() : null;
    } catch (error) {
      console.error('Error getting referral code from URL:', error);
      return null;
    }
  }

  /**
   * Store pending referral code for after signup
   */
  storePendingReferralCode(code: string): void {
    try {
      localStorage.setItem('pendingReferralCode', code.toUpperCase().trim());
      localStorage.setItem('pendingReferralCodeTime', Date.now().toString());
    } catch (error) {
      console.error('Error storing pending referral code:', error);
    }
  }

  /**
   * Get and clear pending referral code
   */
  getPendingReferralCode(): string | null {
    try {
      const code = localStorage.getItem('pendingReferralCode');
      const timeStored = localStorage.getItem('pendingReferralCodeTime');
      
      if (code && timeStored) {
        const storedTime = parseInt(timeStored, 10);
        const hoursSinceStored = (Date.now() - storedTime) / (1000 * 60 * 60);
        
        // Code expires after 24 hours
        if (hoursSinceStored < 24) {
          // Clear after retrieving
          localStorage.removeItem('pendingReferralCode');
          localStorage.removeItem('pendingReferralCodeTime');
          return code;
        } else {
          // Clear expired code
          localStorage.removeItem('pendingReferralCode');
          localStorage.removeItem('pendingReferralCodeTime');
        }
      }
      
      return null;
    } catch (error) {
      console.error('Error getting pending referral code:', error);
      return null;
    }
  }

  /**
   * Track referral code click (analytics)
   */
  async trackReferralClick(referralCode: string, source: string = 'direct'): Promise<void> {
    try {
      // This could be used for analytics
      console.log(`Referral code ${referralCode} clicked from ${source}`);
      
      // You could send this to your analytics service
      // analytics.track('referral_code_clicked', {
      //   referralCode,
      //   source,
      //   timestamp: new Date().toISOString()
      // });
    } catch (error) {
      console.error('Error tracking referral click:', error);
    }
  }

  /**
   * Get referral statistics summary
   */
  async getReferralSummary(userId: string): Promise<{
    hasReferralCode: boolean;
    referralCode?: string;
    totalReferrals: number;
    totalEarnings: number;
    thisMonthEarnings: number;
    canCreateCode: boolean;
  }> {
    try {
      const [code, analytics] = await Promise.all([
        this.getUserReferralCode(userId),
        this.getReferralAnalytics(userId)
      ]);

      return {
        hasReferralCode: !!code,
        referralCode: code || undefined,
        totalReferrals: analytics.data?.stats.totalReferrals || 0,
        totalEarnings: analytics.data?.stats.totalEarningsFromReferrals || 0,
        thisMonthEarnings: analytics.data?.stats.monthlyEarnings || 0,
        canCreateCode: !code // Can create if doesn't have one
      };
    } catch (error) {
      console.error('Error getting referral summary:', error);
      return {
        hasReferralCode: false,
        totalReferrals: 0,
        totalEarnings: 0,
        thisMonthEarnings: 0,
        canCreateCode: true
      };
    }
  }

  /**
   * Calculate potential earnings from referrals
   */
  calculatePotentialEarnings(referralCount: number, avgMonthlyRevenue: number = 50): {
    monthly: number;
    yearly: number;
    description: string;
  } {
    const referralPercentage = 0.05; // 5%
    const monthlyEarnings = referralCount * avgMonthlyRevenue * referralPercentage;
    const yearlyEarnings = monthlyEarnings * 12;

    return {
      monthly: monthlyEarnings,
      yearly: yearlyEarnings,
      description: `Based on ${referralCount} referrals earning ₹${avgMonthlyRevenue}/month each, you could earn 5% (₹${this.formatEarnings(monthlyEarnings)}/month)`
    };
  }

  /**
   * Get shareable referral messages with different tones
   */
  getReferralMessages(referralCode: string, username: string): {
    casual: string;
    excited: string;
    professional: string;
    benefits: string;
  } {
    const link = this.generateReferralLink(referralCode);

    return {
      casual: `Hey! I'm on ReelShare making money by watching and creating videos. Use my code ${referralCode} when you sign up and get ₹5 bonus! ${link}`,
      
      excited: `🎬 I'm LOVING ReelShare! 💰 Made ₹${Math.floor(Math.random() * 500)} this month just watching videos! Join me with code ${referralCode} and get ₹5 to start! 🎉 ${link}`,
      
      professional: `I've been using ReelShare to earn money from video content creation and consumption. It's a legitimate platform with transparent revenue sharing. Use referral code ${referralCode} for a ₹5 welcome bonus. ${link}`,
      
      benefits: `🎯 ReelShare Benefits:\n💰 Earn money watching videos\n🎬 Get paid creating content\n📈 60/20/20 revenue split\n🎁 Use code ${referralCode} for ₹5 bonus!\n\n${link}`
    };
  }

  /**
   * Validate custom referral code format
   */
  validateCustomCode(code: string): {
    valid: boolean;
    errors: string[];
  } {
    const errors: string[] = [];

    if (!code || code.trim() === '') {
      errors.push('Code cannot be empty');
    } else {
      const trimmedCode = code.trim().toUpperCase();

      if (trimmedCode.length < 6) {
        errors.push('Code must be at least 6 characters');
      }

      if (trimmedCode.length > 12) {
        errors.push('Code must be no more than 12 characters');
      }

      if (!/^[A-Z0-9]+$/.test(trimmedCode)) {
        errors.push('Code can only contain letters and numbers');
      }

      // Check for inappropriate words (basic filter)
      const inappropriate = ['FUCK', 'SHIT', 'DAMN', 'PORN', 'SEX'];
      if (inappropriate.some(word => trimmedCode.includes(word))) {
        errors.push('Code contains inappropriate content');
      }
    }

    return {
      valid: errors.length === 0,
      errors
    };
  }
}

export default new ReferralService();

// Export types for use in components
export type {
  ReferralCode,
  ReferralStats,
  ReferralAnalytics,
  ShareData,
  LeaderboardEntry
}; 