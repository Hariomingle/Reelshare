import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';

const db = admin.firestore();

// Ad Revenue Configuration
export const AD_REVENUE_CONFIG = {
  // Revenue split percentages
  revenueShare: {
    creator: 0.6,  // 60%
    viewer: 0.2,   // 20%
    app: 0.2       // 20%
  },
  
  // Minimum requirements for ad revenue
  minViewDuration: 30,        // seconds
  minViewPercentage: 0.7,     // 70% of video must be watched
  
  // Ad providers and their typical rates
  adProviders: {
    'google_ads': { baseCPM: 2.5, quality: 0.9 },
    'facebook_ads': { baseCPM: 2.2, quality: 0.85 },
    'unity_ads': { baseCPM: 1.8, quality: 0.8 },
    'admob': { baseCPM: 2.0, quality: 0.82 },
    'custom': { baseCPM: 1.5, quality: 0.75 }
  },
  
  // Revenue calculation factors
  baseRevenue: 0.003,         // Base revenue per qualified view (₹0.003)
  qualityMultiplier: 1.2,     // Boost for high-quality content
  engagementMultiplier: 1.5,  // Boost for highly engaging content
  
  // Transaction limits
  maxDailyRevenue: 1000,      // Maximum ₹1000 per day per user from ads
  minPayoutAmount: 0.01       // Minimum ₹0.01 to process
};

interface AdViewData {
  reelId: string;
  userId: string;          // Viewer ID
  creatorId: string;       // Content creator ID
  viewDuration: number;    // Seconds watched
  videoDuration: number;   // Total video length
  adData?: {
    provider: string;
    adType: 'banner' | 'interstitial' | 'rewarded' | 'native';
    revenue: number;       // Actual ad revenue earned
    cpm: number;          // Cost per mille
    adId: string;
    impressionId: string;
  };
  timestamp: admin.firestore.Timestamp;
  viewQuality: number;     // 0-1 score based on engagement
  userLocation?: string;   // For geo-targeted ad rates
}

interface RevenueDistribution {
  totalRevenue: number;
  creator: {
    userId: string;
    amount: number;
    percentage: number;
  };
  viewer: {
    userId: string;
    amount: number;
    percentage: number;
  };
  app: {
    amount: number;
    percentage: number;
  };
}

interface WalletUpdate {
  userId: string;
  amount: number;
  type: 'ad_revenue_creator' | 'ad_revenue_viewer';
  description: string;
  metadata: {
    reelId: string;
    adProvider?: string;
    cpm?: number;
    viewDuration: number;
  };
}

export class AdRevenueProcessor {
  
  /**
   * Process ad revenue for a qualified reel view
   */
  async processReelViewRevenue(viewData: AdViewData): Promise<{
    success: boolean;
    distribution?: RevenueDistribution;
    transactionIds?: string[];
    message: string;
  }> {
    try {
      // Validate view qualifies for ad revenue
      const isQualified = await this.validateViewForRevenue(viewData);
      if (!isQualified.qualified) {
        return {
          success: false,
          message: isQualified.reason || 'View does not qualify for ad revenue'
        };
      }

      // Calculate revenue amount
      const revenue = await this.calculateAdRevenue(viewData);
      if (revenue <= AD_REVENUE_CONFIG.minPayoutAmount) {
        return {
          success: false,
          message: 'Revenue amount too small to process'
        };
      }

      // Calculate revenue distribution
      const distribution = this.calculateRevenueDistribution(
        revenue,
        viewData.creatorId,
        viewData.userId
      );

      // Check daily limits
      const withinLimits = await this.checkDailyLimits(distribution);
      if (!withinLimits.valid) {
        return {
          success: false,
          message: withinLimits.reason || 'Daily revenue limits exceeded'
        };
      }

      // Process the revenue distribution
      const result = await this.distributeRevenue(viewData, distribution);
      
      return {
        success: true,
        distribution,
        transactionIds: result.transactionIds,
        message: `Successfully distributed ₹${revenue.toFixed(4)} ad revenue`
      };

    } catch (error) {
      console.error('Error processing reel view revenue:', error);
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Validate if a view qualifies for ad revenue
   */
  private async validateViewForRevenue(viewData: AdViewData): Promise<{
    qualified: boolean;
    reason?: string;
  }> {
    // Check minimum view duration
    if (viewData.viewDuration < AD_REVENUE_CONFIG.minViewDuration) {
      return {
        qualified: false,
        reason: `View too short: ${viewData.viewDuration}s < ${AD_REVENUE_CONFIG.minViewDuration}s required`
      };
    }

    // Check view percentage
    const viewPercentage = viewData.viewDuration / viewData.videoDuration;
    if (viewPercentage < AD_REVENUE_CONFIG.minViewPercentage) {
      return {
        qualified: false,
        reason: `Insufficient view percentage: ${Math.round(viewPercentage * 100)}% < ${AD_REVENUE_CONFIG.minViewPercentage * 100}% required`
      };
    }

    // Check if ad was actually shown
    if (!viewData.adData) {
      return {
        qualified: false,
        reason: 'No ad data provided - no revenue to distribute'
      };
    }

    // Validate ad revenue amount
    if (!viewData.adData.revenue || viewData.adData.revenue <= 0) {
      return {
        qualified: false,
        reason: 'Invalid ad revenue amount'
      };
    }

    // Check for duplicate processing (prevent double revenue)
    const existingRevenue = await db.collection('ad_revenue_events')
      .where('reelId', '==', viewData.reelId)
      .where('userId', '==', viewData.userId)
      .where('adData.impressionId', '==', viewData.adData.impressionId)
      .limit(1)
      .get();

    if (!existingRevenue.empty) {
      return {
        qualified: false,
        reason: 'Revenue already processed for this ad impression'
      };
    }

    // Validate users exist
    const [creatorDoc, viewerDoc] = await Promise.all([
      db.collection('users').doc(viewData.creatorId).get(),
      db.collection('users').doc(viewData.userId).get()
    ]);

    if (!creatorDoc.exists) {
      return {
        qualified: false,
        reason: 'Creator not found'
      };
    }

    if (!viewerDoc.exists) {
      return {
        qualified: false,
        reason: 'Viewer not found'
      };
    }

    return { qualified: true };
  }

  /**
   * Calculate ad revenue based on view data and ad performance
   */
  private async calculateAdRevenue(viewData: AdViewData): Promise<number> {
    if (viewData.adData && viewData.adData.revenue) {
      // Use actual ad network revenue if provided
      return viewData.adData.revenue;
    }

    // Fallback calculation based on engagement and quality
    let baseRevenue = AD_REVENUE_CONFIG.baseRevenue;

    // Apply provider-specific multiplier
    if (viewData.adData?.provider) {
      const providerConfig = AD_REVENUE_CONFIG.adProviders[viewData.adData.provider as keyof typeof AD_REVENUE_CONFIG.adProviders];
      if (providerConfig) {
        baseRevenue *= providerConfig.quality;
      }
    }

    // Apply view quality multiplier
    if (viewData.viewQuality > 0.8) {
      baseRevenue *= AD_REVENUE_CONFIG.qualityMultiplier;
    }

    // Apply engagement multiplier for longer views
    const viewPercentage = viewData.viewDuration / viewData.videoDuration;
    if (viewPercentage > 0.9) {
      baseRevenue *= AD_REVENUE_CONFIG.engagementMultiplier;
    }

    // Geographic multiplier (optional)
    if (viewData.userLocation) {
      const geoMultiplier = this.getGeoRevenueMultiplier(viewData.userLocation);
      baseRevenue *= geoMultiplier;
    }

    return Math.max(baseRevenue, 0.001); // Minimum ₹0.001
  }

  /**
   * Calculate revenue distribution according to 60/20/20 split
   */
  private calculateRevenueDistribution(
    totalRevenue: number,
    creatorId: string,
    viewerId: string
  ): RevenueDistribution {
    const creatorAmount = totalRevenue * AD_REVENUE_CONFIG.revenueShare.creator;
    const viewerAmount = totalRevenue * AD_REVENUE_CONFIG.revenueShare.viewer;
    const appAmount = totalRevenue * AD_REVENUE_CONFIG.revenueShare.app;

    return {
      totalRevenue,
      creator: {
        userId: creatorId,
        amount: creatorAmount,
        percentage: AD_REVENUE_CONFIG.revenueShare.creator * 100
      },
      viewer: {
        userId: viewerId,
        amount: viewerAmount,
        percentage: AD_REVENUE_CONFIG.revenueShare.viewer * 100
      },
      app: {
        amount: appAmount,
        percentage: AD_REVENUE_CONFIG.revenueShare.app * 100
      }
    };
  }

  /**
   * Check daily revenue limits to prevent abuse
   */
  private async checkDailyLimits(distribution: RevenueDistribution): Promise<{
    valid: boolean;
    reason?: string;
  }> {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayTimestamp = admin.firestore.Timestamp.fromDate(today);

    // Check creator daily limit
    const creatorTodayQuery = await db.collection('wallet_transactions')
      .where('userId', '==', distribution.creator.userId)
      .where('type', '==', 'earning')
      .where('subType', '==', 'ad_revenue')
      .where('createdAt', '>=', todayTimestamp)
      .get();

    const creatorTodayRevenue = creatorTodayQuery.docs.reduce(
      (sum, doc) => sum + (doc.data().amount || 0), 0
    );

    if (creatorTodayRevenue + distribution.creator.amount > AD_REVENUE_CONFIG.maxDailyRevenue) {
      return {
        valid: false,
        reason: `Creator daily limit exceeded: ₹${creatorTodayRevenue} + ₹${distribution.creator.amount} > ₹${AD_REVENUE_CONFIG.maxDailyRevenue}`
      };
    }

    // Check viewer daily limit
    const viewerTodayQuery = await db.collection('wallet_transactions')
      .where('userId', '==', distribution.viewer.userId)
      .where('type', '==', 'earning')
      .where('subType', '==', 'ad_revenue')
      .where('createdAt', '>=', todayTimestamp)
      .get();

    const viewerTodayRevenue = viewerTodayQuery.docs.reduce(
      (sum, doc) => sum + (doc.data().amount || 0), 0
    );

    if (viewerTodayRevenue + distribution.viewer.amount > AD_REVENUE_CONFIG.maxDailyRevenue) {
      return {
        valid: false,
        reason: `Viewer daily limit exceeded: ₹${viewerTodayRevenue} + ₹${distribution.viewer.amount} > ₹${AD_REVENUE_CONFIG.maxDailyRevenue}`
      };
    }

    return { valid: true };
  }

  /**
   * Distribute revenue to creator and viewer wallets
   */
  private async distributeRevenue(
    viewData: AdViewData,
    distribution: RevenueDistribution
  ): Promise<{ transactionIds: string[] }> {
    const batch = db.batch();
    const transactionIds: string[] = [];
    const now = admin.firestore.FieldValue.serverTimestamp();

    // Create ad revenue event record
    const adEventRef = db.collection('ad_revenue_events').doc();
    batch.set(adEventRef, {
      reelId: viewData.reelId,
      viewerId: viewData.userId,
      creatorId: viewData.creatorId,
      adData: viewData.adData,
      viewDuration: viewData.viewDuration,
      videoDuration: viewData.videoDuration,
      totalRevenue: distribution.totalRevenue,
      distribution: {
        creator: distribution.creator.amount,
        viewer: distribution.viewer.amount,
        app: distribution.app.amount
      },
      timestamp: viewData.timestamp,
      processedAt: now,
      status: 'completed'
    });

    // Update creator wallet
    const creatorWalletRef = db.collection('wallets').doc(distribution.creator.userId);
    const creatorWalletDoc = await creatorWalletRef.get();
    
    if (creatorWalletDoc.exists) {
      const creatorWallet = creatorWalletDoc.data()!;
      batch.update(creatorWalletRef, {
        totalBalance: creatorWallet.totalBalance + distribution.creator.amount,
        availableBalance: creatorWallet.availableBalance + distribution.creator.amount,
        totalEarned: creatorWallet.totalEarned + distribution.creator.amount,
        adEarnings: creatorWallet.adEarnings + distribution.creator.amount,
        createEarnings: creatorWallet.createEarnings + distribution.creator.amount,
        lastUpdated: now
      });

      // Create creator transaction
      const creatorTransactionRef = db.collection('wallet_transactions').doc();
      transactionIds.push(creatorTransactionRef.id);
      batch.set(creatorTransactionRef, {
        userId: distribution.creator.userId,
        type: 'earning',
        subType: 'ad_revenue',
        amount: distribution.creator.amount,
        description: `Ad revenue share (60%) from reel view`,
        reelId: viewData.reelId,
        adEventId: adEventRef.id,
        status: 'completed',
        metadata: {
          viewerId: viewData.userId,
          adProvider: viewData.adData?.provider,
          cpm: viewData.adData?.cpm,
          viewDuration: viewData.viewDuration,
          revenueShare: '60%'
        },
        createdAt: now,
        processedAt: now
      });
    }

    // Update viewer wallet
    const viewerWalletRef = db.collection('wallets').doc(distribution.viewer.userId);
    const viewerWalletDoc = await viewerWalletRef.get();
    
    if (viewerWalletDoc.exists) {
      const viewerWallet = viewerWalletDoc.data()!;
      batch.update(viewerWalletRef, {
        totalBalance: viewerWallet.totalBalance + distribution.viewer.amount,
        availableBalance: viewerWallet.availableBalance + distribution.viewer.amount,
        totalEarned: viewerWallet.totalEarned + distribution.viewer.amount,
        adEarnings: viewerWallet.adEarnings + distribution.viewer.amount,
        watchEarnings: viewerWallet.watchEarnings + distribution.viewer.amount,
        lastUpdated: now
      });

      // Create viewer transaction
      const viewerTransactionRef = db.collection('wallet_transactions').doc();
      transactionIds.push(viewerTransactionRef.id);
      batch.set(viewerTransactionRef, {
        userId: distribution.viewer.userId,
        type: 'earning',
        subType: 'ad_revenue',
        amount: distribution.viewer.amount,
        description: `Ad revenue share (20%) for watching reel`,
        reelId: viewData.reelId,
        adEventId: adEventRef.id,
        status: 'completed',
        metadata: {
          creatorId: viewData.creatorId,
          adProvider: viewData.adData?.provider,
          cpm: viewData.adData?.cpm,
          viewDuration: viewData.viewDuration,
          revenueShare: '20%'
        },
        createdAt: now,
        processedAt: now
      });
    }

    // Update app revenue tracking
    const appRevenueRef = db.collection('app_revenue').doc();
    batch.set(appRevenueRef, {
      amount: distribution.app.amount,
      source: 'ad_revenue',
      percentage: AD_REVENUE_CONFIG.revenueShare.app * 100,
      reelId: viewData.reelId,
      adEventId: adEventRef.id,
      createdAt: now,
      metadata: {
        adProvider: viewData.adData?.provider,
        totalRevenue: distribution.totalRevenue
      }
    });

    // Commit all changes atomically
    await batch.commit();

    return { transactionIds };
  }

  /**
   * Get geographic revenue multiplier based on user location
   */
  private getGeoRevenueMultiplier(location: string): number {
    const geoMultipliers: { [key: string]: number } = {
      'US': 1.5,      // Higher ad rates in US
      'UK': 1.3,      // Good ad rates in UK
      'CA': 1.2,      // Canada
      'AU': 1.2,      // Australia
      'DE': 1.1,      // Germany
      'IN': 1.0,      // Base rate for India
      'default': 0.9  // Lower rates for other regions
    };

    return geoMultipliers[location] || geoMultipliers['default'];
  }

  /**
   * Get revenue statistics for analytics
   */
  async getRevenueStats(userId?: string, startDate?: Date, endDate?: Date): Promise<{
    totalRevenue: number;
    creatorRevenue: number;
    viewerRevenue: number;
    appRevenue: number;
    totalViews: number;
    averageRevenue: number;
    topProviders: { provider: string; revenue: number }[];
  }> {
    let query = db.collection('ad_revenue_events') as any;

    if (startDate) {
      query = query.where('timestamp', '>=', admin.firestore.Timestamp.fromDate(startDate));
    }
    if (endDate) {
      query = query.where('timestamp', '<=', admin.firestore.Timestamp.fromDate(endDate));
    }

    const eventsSnapshot = await query.get();
    const events = eventsSnapshot.docs.map((doc: any) => doc.data());

    const stats = {
      totalRevenue: 0,
      creatorRevenue: 0,
      viewerRevenue: 0,
      appRevenue: 0,
      totalViews: events.length,
      averageRevenue: 0,
      topProviders: [] as { provider: string; revenue: number }[]
    };

    const providerRevenue: { [key: string]: number } = {};

    events.forEach((event: any) => {
      stats.totalRevenue += event.totalRevenue || 0;
      stats.creatorRevenue += event.distribution?.creator || 0;
      stats.viewerRevenue += event.distribution?.viewer || 0;
      stats.appRevenue += event.distribution?.app || 0;

      if (event.adData?.provider) {
        providerRevenue[event.adData.provider] = 
          (providerRevenue[event.adData.provider] || 0) + event.totalRevenue;
      }
    });

    stats.averageRevenue = stats.totalViews > 0 ? stats.totalRevenue / stats.totalViews : 0;

    stats.topProviders = Object.entries(providerRevenue)
      .map(([provider, revenue]) => ({ provider, revenue }))
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 10);

    return stats;
  }
}

export const adRevenueProcessor = new AdRevenueProcessor(); 