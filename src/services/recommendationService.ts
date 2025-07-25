import { httpsCallable } from 'firebase/functions';
import { functions } from './firebase';
import { ApiResponse } from '../types';

interface UserInteraction {
  reelId: string;
  interactionType: 'view' | 'like' | 'comment' | 'share';
  duration?: number; // For view interactions in seconds
}

interface ReelRecommendation {
  reelId: string;
  score: number;
  category: string;
  topics: string[];
  hashtags: string[];
  createdAt: Date;
  reason: string;
  rank: number;
}

interface RecommendationResult {
  recommendations: ReelRecommendation[];
  totalCount: number;
  hasMore: boolean;
  cached: boolean;
  generatedAt: Date;
}

interface RecommendationAnalytics {
  totalUsers: number;
  totalContentEmbeddings: number;
  averageRecommendationScore: number;
  recentJobs: any[];
  lastJobDate: Date | null;
  systemHealth: {
    embeddingCoverage: string;
    recommendationFreshness: string;
  };
}

class RecommendationService {
  private readonly trackInteractionFunction = httpsCallable(functions, 'trackUserInteraction');
  private readonly generateRecommendationsFunction = httpsCallable(functions, 'generateUserRecommendations');
  private readonly getRecommendationsFunction = httpsCallable(functions, 'getUserRecommendations');
  private readonly getAnalyticsFunction = httpsCallable(functions, 'getRecommendationAnalytics');

  /**
   * Track user interaction with a reel for recommendation algorithm
   */
  async trackInteraction(interaction: UserInteraction): Promise<ApiResponse<void>> {
    try {
      const result = await this.trackInteractionFunction(interaction);
      
      return {
        success: true,
        data: result.data,
        message: 'Interaction tracked successfully'
      };

    } catch (error) {
      console.error('Track interaction error:', error);
      return {
        success: false,
        error: 'Failed to track interaction',
        message: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Track video view with duration for accurate recommendation scoring
   */
  async trackVideoView(reelId: string, duration: number): Promise<ApiResponse<void>> {
    return this.trackInteraction({
      reelId,
      interactionType: 'view',
      duration
    });
  }

  /**
   * Track like interaction
   */
  async trackLike(reelId: string): Promise<ApiResponse<void>> {
    return this.trackInteraction({
      reelId,
      interactionType: 'like'
    });
  }

  /**
   * Track comment interaction
   */
  async trackComment(reelId: string): Promise<ApiResponse<void>> {
    return this.trackInteraction({
      reelId,
      interactionType: 'comment'
    });
  }

  /**
   * Track share interaction
   */
  async trackShare(reelId: string): Promise<ApiResponse<void>> {
    return this.trackInteraction({
      reelId,
      interactionType: 'share'
    });
  }

  /**
   * Generate fresh recommendations for the current user
   */
  async generateRecommendations(forceRefresh: boolean = false): Promise<ApiResponse<RecommendationResult>> {
    try {
      const result = await this.generateRecommendationsFunction({ forceRefresh });
      
      const recommendations: RecommendationResult = {
        recommendations: result.data.recommendations.map((rec: any, index: number) => ({
          ...rec,
          createdAt: rec.createdAt.toDate(),
          rank: index + 1
        })),
        totalCount: result.data.totalCount,
        hasMore: false,
        cached: result.data.cached,
        generatedAt: result.data.generatedAt.toDate()
      };

      return {
        success: true,
        data: recommendations,
        message: result.data.cached ? 'Retrieved cached recommendations' : 'Generated fresh recommendations'
      };

    } catch (error) {
      console.error('Generate recommendations error:', error);
      return {
        success: false,
        error: 'Failed to generate recommendations',
        message: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Get user recommendations with pagination
   */
  async getRecommendations(
    limit: number = 20, 
    offset: number = 0
  ): Promise<ApiResponse<RecommendationResult>> {
    try {
      const result = await this.getRecommendationsFunction({ limit, offset });
      
      const recommendations: RecommendationResult = {
        recommendations: result.data.recommendations.map((rec: any, index: number) => ({
          ...rec,
          createdAt: rec.createdAt.toDate(),
          rank: offset + index + 1
        })),
        totalCount: result.data.totalCount,
        hasMore: result.data.hasMore,
        cached: result.data.cached,
        generatedAt: result.data.generatedAt.toDate()
      };

      return {
        success: true,
        data: recommendations,
        message: 'Recommendations retrieved successfully'
      };

    } catch (error) {
      console.error('Get recommendations error:', error);
      return {
        success: false,
        error: 'Failed to get recommendations',
        message: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Get the next batch of recommendations for infinite scrolling
   */
  async getNextRecommendations(
    currentOffset: number, 
    batchSize: number = 20
  ): Promise<ApiResponse<ReelRecommendation[]>> {
    try {
      const result = await this.getRecommendations(batchSize, currentOffset);
      
      if (result.success && result.data) {
        return {
          success: true,
          data: result.data.recommendations,
          message: `Retrieved ${result.data.recommendations.length} more recommendations`
        };
      }

      return {
        success: false,
        error: result.error,
        message: result.message
      };

    } catch (error) {
      console.error('Get next recommendations error:', error);
      return {
        success: false,
        error: 'Failed to get next recommendations',
        message: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Get recommendation analytics (admin only)
   */
  async getAnalytics(
    startDate?: Date, 
    endDate?: Date
  ): Promise<ApiResponse<RecommendationAnalytics>> {
    try {
      const result = await this.getAnalyticsFunction({
        startDate: startDate?.toISOString(),
        endDate: endDate?.toISOString()
      });
      
      const analytics: RecommendationAnalytics = {
        ...result.data.data,
        lastJobDate: result.data.data.lastJobDate ? result.data.data.lastJobDate.toDate() : null,
        recentJobs: result.data.data.recentJobs.map((job: any) => ({
          ...job,
          startTime: job.startTime.toDate(),
          endTime: job.endTime ? job.endTime.toDate() : null
        }))
      };

      return {
        success: true,
        data: analytics,
        message: 'Analytics retrieved successfully'
      };

    } catch (error) {
      console.error('Get analytics error:', error);
      return {
        success: false,
        error: 'Failed to get analytics',
        message: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Format recommendation reason for display
   */
  formatRecommendationReason(recommendation: ReelRecommendation): string {
    const reasons = {
      'You enjoy': '👍 Based on your preferences',
      'Based on your interest': '🎯 Matched your interests',
      'Similar to': '🔗 Similar content',
      'Highly similar': '⭐ Perfect match',
      'Recommended for you': '✨ Curated for you',
      'Trending content': '🔥 Trending now'
    };

    for (const [key, icon] of Object.entries(reasons)) {
      if (recommendation.reason.includes(key)) {
        return `${icon} ${recommendation.reason}`;
      }
    }

    return `✨ ${recommendation.reason}`;
  }

  /**
   * Get recommendation score as percentage
   */
  getScorePercentage(score: number): number {
    // Convert score to percentage (assuming max score is around 1.0)
    return Math.min(100, Math.round(score * 100));
  }

  /**
   * Check if recommendations need refresh
   */
  needsRefresh(generatedAt: Date): boolean {
    const sixHoursAgo = new Date(Date.now() - 6 * 60 * 60 * 1000);
    return generatedAt < sixHoursAgo;
  }

  /**
   * Get color for recommendation score
   */
  getScoreColor(score: number): string {
    if (score > 0.8) return '#10B981'; // Green for high scores
    if (score > 0.6) return '#F59E0B'; // Orange for medium scores
    if (score > 0.4) return '#EF4444'; // Red for low scores
    return '#6B7280'; // Gray for very low scores
  }

  /**
   * Batch track multiple interactions (useful for analytics)
   */
  async batchTrackInteractions(interactions: UserInteraction[]): Promise<ApiResponse<void>> {
    try {
      const promises = interactions.map(interaction => this.trackInteraction(interaction));
      const results = await Promise.allSettled(promises);
      
      const successful = results.filter(result => result.status === 'fulfilled').length;
      const failed = results.filter(result => result.status === 'rejected').length;

      return {
        success: failed === 0,
        data: undefined,
        message: `Tracked ${successful}/${interactions.length} interactions successfully`
      };

    } catch (error) {
      console.error('Batch track interactions error:', error);
      return {
        success: false,
        error: 'Failed to batch track interactions',
        message: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Get recommendation insights for debugging
   */
  getRecommendationInsights(recommendations: ReelRecommendation[]): {
    totalRecommendations: number;
    averageScore: number;
    topCategories: string[];
    topHashtags: string[];
    reasonDistribution: { [reason: string]: number };
  } {
    const insights = {
      totalRecommendations: recommendations.length,
      averageScore: recommendations.reduce((sum, rec) => sum + rec.score, 0) / recommendations.length,
      topCategories: this.getTopItems(recommendations.map(r => r.category)),
      topHashtags: this.getTopItems(recommendations.flatMap(r => r.hashtags)),
      reasonDistribution: recommendations.reduce((acc, rec) => {
        const key = rec.reason.split(' ')[0]; // First word of reason
        acc[key] = (acc[key] || 0) + 1;
        return acc;
      }, {} as { [reason: string]: number })
    };

    return insights;
  }

  /**
   * Helper to get top items from array
   */
  private getTopItems(items: string[], limit: number = 5): string[] {
    const counts = items.reduce((acc, item) => {
      acc[item] = (acc[item] || 0) + 1;
      return acc;
    }, {} as { [item: string]: number });

    return Object.entries(counts)
      .sort(([,a], [,b]) => b - a)
      .slice(0, limit)
      .map(([item]) => item);
  }
}

export default new RecommendationService();

// Export types for use in components
export type { 
  UserInteraction, 
  ReelRecommendation, 
  RecommendationResult, 
  RecommendationAnalytics 
}; 