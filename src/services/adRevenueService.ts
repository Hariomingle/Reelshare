import { httpsCallable } from 'firebase/functions';
import { functions, db } from './firebase';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { ApiResponse } from '../types';

interface AdData {
  provider: string;
  adType: 'banner' | 'interstitial' | 'rewarded' | 'native';
  revenue: number;
  cpm: number;
  adId: string;
  impressionId: string;
}

interface ReelViewData {
  reelId: string;
  userId: string;
  duration: number;
  videoDuration?: number;
  adData?: AdData;
  userLocation?: string;
  liked?: boolean;
  commented?: boolean;
  shared?: boolean;
  userEngagementScore?: number;
}

interface AdRevenueDistribution {
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

interface AdRevenueStats {
  totalRevenue: number;
  creatorRevenue: number;
  viewerRevenue: number;
  appRevenue: number;
  totalViews: number;
  averageRevenue: number;
  topProviders: { provider: string; revenue: number }[];
}

class AdRevenueService {
  private readonly processAdRevenueManuallyFunction = httpsCallable(functions, 'processAdRevenueManually');
  private readonly getAdRevenueAnalyticsFunction = httpsCallable(functions, 'getAdRevenueAnalytics');
  private readonly batchProcessFailedAdRevenueFunction = httpsCallable(functions, 'batchProcessFailedAdRevenue');

  /**
   * Record a reel view with ad data - this will automatically trigger revenue processing
   */
  async recordReelView(viewData: ReelViewData): Promise<ApiResponse<{ viewId: string; autoProcessed: boolean }>> {
    try {
      // Create the reel view document - this will trigger the Cloud Function
      const reelViewDoc = {
        reelId: viewData.reelId,
        userId: viewData.userId,
        duration: viewData.duration,
        videoDuration: viewData.videoDuration,
        adData: viewData.adData || null,
        userLocation: viewData.userLocation || 'IN',
        liked: viewData.liked || false,
        commented: viewData.commented || false,
        shared: viewData.shared || false,
        userEngagementScore: viewData.userEngagementScore || 0.5,
        timestamp: serverTimestamp(),
        // Revenue processing status (will be updated by Cloud Function)
        adRevenueProcessed: null,
        adRevenueProcessedAt: null,
        adRevenueDistribution: null,
        adRevenueTransactionIds: null,
        adRevenueError: null
      };

      const docRef = await addDoc(collection(db, 'reel_views'), reelViewDoc);

      return {
        success: true,
        data: {
          viewId: docRef.id,
          autoProcessed: !!viewData.adData // Will be auto-processed if ad data is present
        },
        message: viewData.adData 
          ? 'Reel view recorded with ad data - revenue processing will happen automatically'
          : 'Reel view recorded without ad data'
      };

    } catch (error) {
      console.error('Error recording reel view:', error);
      return {
        success: false,
        error: 'Failed to record reel view',
        message: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Record a simple view without ad data
   */
  async recordSimpleView(reelId: string, userId: string, duration: number): Promise<ApiResponse<{ viewId: string }>> {
    return this.recordReelView({
      reelId,
      userId,
      duration
    });
  }

  /**
   * Record a view with ad revenue data
   */
  async recordAdView({
    reelId,
    userId,
    duration,
    videoDuration,
    adProvider,
    adType,
    revenue,
    cpm,
    adId,
    impressionId,
    userLocation
  }: {
    reelId: string;
    userId: string;
    duration: number;
    videoDuration?: number;
    adProvider: string;
    adType: 'banner' | 'interstitial' | 'rewarded' | 'native';
    revenue: number;
    cpm: number;
    adId: string;
    impressionId: string;
    userLocation?: string;
  }): Promise<ApiResponse<{ viewId: string; autoProcessed: boolean }>> {
    
    const adData: AdData = {
      provider: adProvider,
      adType,
      revenue,
      cpm,
      adId,
      impressionId
    };

    return this.recordReelView({
      reelId,
      userId,
      duration,
      videoDuration,
      adData,
      userLocation
    });
  }

  /**
   * Manually process ad revenue for a specific view (if auto-processing failed)
   */
  async processAdRevenueManually({
    viewId,
    reelId,
    userId,
    creatorId,
    viewDuration,
    videoDuration,
    adData,
    userLocation
  }: {
    viewId: string;
    reelId: string;
    userId: string;
    creatorId: string;
    viewDuration: number;
    videoDuration?: number;
    adData: AdData;
    userLocation?: string;
  }): Promise<ApiResponse<{
    distribution: AdRevenueDistribution;
    transactionIds: string[];
  }>> {
    try {
      const result = await this.processAdRevenueManuallyFunction({
        viewId,
        reelId,
        userId,
        creatorId,
        viewDuration,
        videoDuration,
        adData,
        userLocation
      });

      return {
        success: result.data.success,
        data: {
          distribution: result.data.distribution,
          transactionIds: result.data.transactionIds
        },
        message: result.data.message
      };

    } catch (error) {
      console.error('Error processing ad revenue manually:', error);
      return {
        success: false,
        error: 'Failed to process ad revenue manually',
        message: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Get ad revenue analytics for a user or system-wide
   */
  async getAdRevenueAnalytics(
    userId?: string,
    startDate?: Date,
    endDate?: Date
  ): Promise<ApiResponse<AdRevenueStats>> {
    try {
      const result = await this.getAdRevenueAnalyticsFunction({
        userId,
        startDate: startDate?.toISOString(),
        endDate: endDate?.toISOString()
      });

      return {
        success: true,
        data: result.data.data,
        message: result.data.message
      };

    } catch (error) {
      console.error('Error getting ad revenue analytics:', error);
      return {
        success: false,
        error: 'Failed to get ad revenue analytics',
        message: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Batch process failed ad revenue views (Admin only)
   */
  async batchProcessFailedAdRevenue(
    limit: number = 100,
    retryFailed: boolean = false
  ): Promise<ApiResponse<{
    processed: number;
    failed: number;
    total: number;
  }>> {
    try {
      const result = await this.batchProcessFailedAdRevenueFunction({
        limit,
        retryFailed
      });

      return {
        success: true,
        data: {
          processed: result.data.processed,
          failed: result.data.failed,
          total: result.data.total
        },
        message: result.data.message
      };

    } catch (error) {
      console.error('Error batch processing failed ad revenue:', error);
      return {
        success: false,
        error: 'Failed to batch process ad revenue',
        message: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Generate mock ad data for testing
   */
  generateMockAdData(provider: string = 'google_ads'): AdData {
    const adTypes: AdData['adType'][] = ['banner', 'interstitial', 'rewarded', 'native'];
    const adType = adTypes[Math.floor(Math.random() * adTypes.length)];
    
    // Base CPM rates by provider
    const baseCPMs: { [key: string]: number } = {
      'google_ads': 2.5,
      'facebook_ads': 2.2,
      'unity_ads': 1.8,
      'admob': 2.0,
      'custom': 1.5
    };

    const baseCPM = baseCPMs[provider] || 2.0;
    const cpm = baseCPM * (0.8 + Math.random() * 0.4); // ±20% variation
    const revenue = (cpm / 1000) * (1 + Math.random()); // Revenue per impression

    return {
      provider,
      adType,
      revenue: Math.round(revenue * 10000) / 10000, // Round to 4 decimal places
      cpm: Math.round(cpm * 100) / 100, // Round to 2 decimal places
      adId: `ad_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
      impressionId: `imp_${Date.now()}_${Math.floor(Math.random() * 10000)}`
    };
  }

  /**
   * Calculate expected revenue for a view
   */
  calculateExpectedRevenue(
    viewDuration: number,
    videoDuration: number,
    adData: AdData
  ): {
    willQualify: boolean;
    reason: string;
    expectedRevenue?: {
      total: number;
      creator: number;
      viewer: number;
      app: number;
    };
  } {
    // Check minimum view duration (30 seconds)
    if (viewDuration < 30) {
      return {
        willQualify: false,
        reason: `View too short: ${viewDuration}s < 30s required`
      };
    }

    // Check view percentage (70% minimum)
    const viewPercentage = viewDuration / videoDuration;
    if (viewPercentage < 0.7) {
      return {
        willQualify: false,
        reason: `Insufficient view percentage: ${Math.round(viewPercentage * 100)}% < 70% required`
      };
    }

    // Calculate expected revenue
    const totalRevenue = adData.revenue;
    const creatorRevenue = totalRevenue * 0.6; // 60%
    const viewerRevenue = totalRevenue * 0.2;  // 20%
    const appRevenue = totalRevenue * 0.2;     // 20%

    return {
      willQualify: true,
      reason: 'View qualifies for ad revenue sharing',
      expectedRevenue: {
        total: totalRevenue,
        creator: creatorRevenue,
        viewer: viewerRevenue,
        app: appRevenue
      }
    };
  }

  /**
   * Format revenue amount for display
   */
  formatRevenue(amount: number): string {
    if (amount >= 1) {
      return `₹${amount.toFixed(2)}`;
    } else if (amount >= 0.01) {
      return `₹${amount.toFixed(3)}`;
    } else {
      return `₹${amount.toFixed(4)}`;
    }
  }

  /**
   * Get revenue breakdown by provider
   */
  getRevenueByProvider(stats: AdRevenueStats): { [provider: string]: number } {
    return stats.topProviders.reduce((acc, provider) => {
      acc[provider.provider] = provider.revenue;
      return acc;
    }, {} as { [provider: string]: number });
  }

  /**
   * Calculate revenue growth rate
   */
  calculateGrowthRate(currentRevenue: number, previousRevenue: number): number {
    if (previousRevenue === 0) return currentRevenue > 0 ? 100 : 0;
    return ((currentRevenue - previousRevenue) / previousRevenue) * 100;
  }

  /**
   * Get recommended ad providers based on performance
   */
  getRecommendedProviders(stats: AdRevenueStats): string[] {
    return stats.topProviders
      .sort((a, b) => (b.revenue / stats.totalViews) - (a.revenue / stats.totalViews))
      .slice(0, 3)
      .map(provider => provider.provider);
  }

  /**
   * Validate ad data before processing
   */
  validateAdData(adData: AdData): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (!adData.provider || adData.provider.trim() === '') {
      errors.push('Ad provider is required');
    }

    if (!['banner', 'interstitial', 'rewarded', 'native'].includes(adData.adType)) {
      errors.push('Invalid ad type');
    }

    if (!adData.revenue || adData.revenue <= 0) {
      errors.push('Revenue must be greater than 0');
    }

    if (!adData.cpm || adData.cpm <= 0) {
      errors.push('CPM must be greater than 0');
    }

    if (!adData.adId || adData.adId.trim() === '') {
      errors.push('Ad ID is required');
    }

    if (!adData.impressionId || adData.impressionId.trim() === '') {
      errors.push('Impression ID is required');
    }

    // Check if revenue is reasonable compared to CPM
    const expectedRevenue = adData.cpm / 1000;
    if (adData.revenue > expectedRevenue * 5) {
      errors.push('Revenue seems too high compared to CPM');
    }

    return {
      valid: errors.length === 0,
      errors
    };
  }

  /**
   * Get daily revenue limit for user
   */
  getDailyRevenueLimit(): number {
    return 1000; // ₹1000 per day
  }

  /**
   * Check if user is approaching daily limit
   */
  async checkDailyLimitStatus(userId: string, currentRevenue: number): Promise<{
    nearLimit: boolean;
    limitExceeded: boolean;
    remainingAmount: number;
    warningMessage?: string;
  }> {
    const dailyLimit = this.getDailyRevenueLimit();
    const remainingAmount = Math.max(0, dailyLimit - currentRevenue);
    const nearLimit = currentRevenue >= dailyLimit * 0.8; // 80% of limit
    const limitExceeded = currentRevenue >= dailyLimit;

    let warningMessage: string | undefined;
    if (limitExceeded) {
      warningMessage = 'Daily revenue limit exceeded. No more ad revenue will be processed today.';
    } else if (nearLimit) {
      warningMessage = `Approaching daily limit. Only ₹${remainingAmount.toFixed(2)} remaining.`;
    }

    return {
      nearLimit,
      limitExceeded,
      remainingAmount,
      warningMessage
    };
  }
}

export default new AdRevenueService();

// Export types for use in components
export type { 
  AdData, 
  ReelViewData, 
  AdRevenueDistribution, 
  AdRevenueStats 
}; 