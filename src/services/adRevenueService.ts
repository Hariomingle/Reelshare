import { httpsCallable } from 'firebase/functions';
import { functions } from './firebase';
import { AdRevenueEvent, RevenueDistribution, ApiResponse } from '../types';

class AdRevenueService {
  // Process ad revenue when a user watches a video with ads
  async processAdRevenue(
    reelId: string,
    viewerId: string,
    adProvider: string,
    adType: 'banner' | 'interstitial' | 'rewarded' | 'native',
    revenue: number,
    cpm: number,
    viewDuration: number
  ): Promise<ApiResponse<any>> {
    try {
      const processAdRevenue = httpsCallable(functions, 'processAdRevenue');
      
      const result = await processAdRevenue({
        reelId,
        viewerId,
        adProvider,
        adType,
        revenue,
        cpm,
        viewDuration,
      });

      return {
        success: true,
        data: result.data,
        message: 'Ad revenue processed successfully',
      };
    } catch (error: any) {
      console.error('Process ad revenue error:', error);
      return {
        success: false,
        error: error.message || 'Failed to process ad revenue',
      };
    }
  }

  // Track video view and process ad revenue if applicable
  async trackVideoView(
    reelId: string,
    viewerId: string,
    watchDuration: number,
    adData?: {
      provider: string;
      type: 'banner' | 'interstitial' | 'rewarded' | 'native';
      revenue: number;
      cpm: number;
    }
  ): Promise<ApiResponse<any>> {
    try {
      // If there was ad revenue from this view, process it
      if (adData && adData.revenue > 0 && watchDuration >= 30) {
        return await this.processAdRevenue(
          reelId,
          viewerId,
          adData.provider,
          adData.type,
          adData.revenue,
          adData.cpm,
          watchDuration
        );
      }

      return {
        success: true,
        message: 'View tracked (no ad revenue)',
      };
    } catch (error: any) {
      console.error('Track video view error:', error);
      return {
        success: false,
        error: error.message || 'Failed to track video view',
      };
    }
  }

  // Process fixed bonus (non-ad revenue)
  async processFixedBonus(
    userId: string,
    subType: 'create' | 'referral_signup' | 'daily_streak' | 'like_bonus' | 'share_bonus',
    amount: number,
    description: string,
    reelId?: string
  ): Promise<ApiResponse<any>> {
    try {
      const processFixedBonus = httpsCallable(functions, 'processFixedBonus');
      
      const result = await processFixedBonus({
        userId,
        type: 'bonus',
        subType,
        amount,
        description,
        reelId,
      });

      return {
        success: true,
        data: result.data,
        message: 'Fixed bonus processed successfully',
      };
    } catch (error: any) {
      console.error('Process fixed bonus error:', error);
      return {
        success: false,
        error: error.message || 'Failed to process fixed bonus',
      };
    }
  }

  // Get ad revenue analytics
  async getAdRevenueAnalytics(
    startDate?: Date,
    endDate?: Date,
    userId?: string
  ): Promise<ApiResponse<any>> {
    try {
      const getAdRevenueAnalytics = httpsCallable(functions, 'getAdRevenueAnalytics');
      
      const result = await getAdRevenueAnalytics({
        startDate: startDate?.toISOString(),
        endDate: endDate?.toISOString(),
        userId,
      });

      return {
        success: true,
        data: result.data,
      };
    } catch (error: any) {
      console.error('Get ad revenue analytics error:', error);
      return {
        success: false,
        error: error.message || 'Failed to get analytics',
      };
    }
  }

  // Helper method to simulate ad revenue (for testing/demo purposes)
  generateMockAdRevenue(): {
    provider: string;
    type: 'banner' | 'interstitial' | 'rewarded' | 'native';
    revenue: number;
    cpm: number;
  } {
    const providers = ['google_admob', 'facebook_audience', 'unity_ads', 'applovin'];
    const types: ('banner' | 'interstitial' | 'rewarded' | 'native')[] = ['banner', 'interstitial', 'rewarded', 'native'];
    
    const provider = providers[Math.floor(Math.random() * providers.length)];
    const type = types[Math.floor(Math.random() * types.length)];
    
    // Generate realistic ad revenue based on type
    let baseRevenue = 0;
    switch (type) {
      case 'banner':
        baseRevenue = 0.001; // ₹0.001 per view
        break;
      case 'interstitial':
        baseRevenue = 0.005; // ₹0.005 per view
        break;
      case 'rewarded':
        baseRevenue = 0.015; // ₹0.015 per view
        break;
      case 'native':
        baseRevenue = 0.008; // ₹0.008 per view
        break;
    }
    
    // Add some randomness (±50%)
    const revenue = baseRevenue * (0.5 + Math.random());
    const cpm = revenue * 1000; // Cost per mille
    
    return {
      provider,
      type,
      revenue: Math.round(revenue * 10000) / 10000, // Round to 4 decimal places
      cpm: Math.round(cpm * 100) / 100, // Round to 2 decimal places
    };
  }

  // Calculate expected earnings for user display
  calculateExpectedEarnings(
    adRevenue: number,
    userType: 'creator' | 'viewer'
  ): number {
    const percentage = userType === 'creator' ? 0.6 : 0.2;
    return Math.round(adRevenue * percentage * 10000) / 10000;
  }

  // Format revenue for display
  formatRevenue(amount: number): string {
    if (amount >= 1) {
      return `₹${amount.toFixed(2)}`;
    } else if (amount >= 0.01) {
      return `₹${amount.toFixed(3)}`;
    } else {
      return `₹${amount.toFixed(4)}`;
    }
  }

  // Get revenue breakdown for transparency
  getRevenueBreakdown(totalRevenue: number): {
    creator: number;
    viewer: number;
    app: number;
  } {
    return {
      creator: Math.round(totalRevenue * 0.6 * 10000) / 10000,
      viewer: Math.round(totalRevenue * 0.2 * 10000) / 10000,
      app: Math.round(totalRevenue * 0.2 * 10000) / 10000,
    };
  }
}

export default new AdRevenueService(); 