import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';
import fetch from 'node-fetch';

const db = admin.firestore();

// OpenAI Configuration
const OPENAI_API_KEY = functions.config().openai?.key || 'your-openai-api-key';
const OPENAI_EMBEDDINGS_URL = 'https://api.openai.com/v1/embeddings';

// Recommendation Configuration
const RECOMMENDATION_CONFIG = {
  embeddingModel: 'text-embedding-ada-002',
  embeddingDimensions: 1536,
  maxRecommendations: 100,
  minInteractions: 5,
  interactionWeights: {
    view: 1,
    like: 3,
    comment: 4,
    share: 5,
    create: 10
  },
  decayFactor: 0.95, // Older interactions have less weight
  similarityThreshold: 0.1,
  maxDaysBack: 30
};

// Topic categories for content analysis
const TOPIC_CATEGORIES = [
  'dance', 'comedy', 'fitness', 'food', 'technology', 'music', 'art', 'travel',
  'lifestyle', 'education', 'motivation', 'entertainment', 'fashion', 'beauty',
  'sports', 'gaming', 'business', 'health', 'pets', 'nature', 'diy', 'reviews'
];

interface UserInteraction {
  userId: string;
  reelId: string;
  type: 'view' | 'like' | 'comment' | 'share' | 'create';
  timestamp: admin.firestore.Timestamp;
  duration?: number; // For view interactions
  weight: number;
}

interface ContentEmbedding {
  reelId: string;
  embedding: number[];
  caption: string;
  hashtags: string[];
  category: string;
  topics: string[];
  createdAt: admin.firestore.Timestamp;
  updatedAt: admin.firestore.Timestamp;
}

interface UserPreference {
  userId: string;
  preferenceVector: number[];
  topCategories: { [category: string]: number };
  topHashtags: { [hashtag: string]: number };
  interactionCount: number;
  lastUpdated: admin.firestore.Timestamp;
}

interface ReelRecommendation {
  reelId: string;
  score: number;
  category: string;
  topics: string[];
  hashtags: string[];
  createdAt: admin.firestore.Timestamp;
  reason: string;
}

class RecommendationEngine {
  /**
   * Generate embedding vector for content using OpenAI
   */
  async generateEmbedding(text: string): Promise<number[]> {
    try {
      const response = await fetch(OPENAI_EMBEDDINGS_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${OPENAI_API_KEY}`,
        },
        body: JSON.stringify({
          model: RECOMMENDATION_CONFIG.embeddingModel,
          input: text,
        }),
      });

      if (!response.ok) {
        throw new Error(`OpenAI API error: ${response.status}`);
      }

      const data = await response.json();
      return data.data[0].embedding;

    } catch (error) {
      console.error('OpenAI embedding error:', error);
      // Fallback to simple text-based embedding
      return this.generateSimpleEmbedding(text);
    }
  }

  /**
   * Fallback simple embedding generation
   */
  generateSimpleEmbedding(text: string): number[] {
    const embedding = new Array(RECOMMENDATION_CONFIG.embeddingDimensions).fill(0);
    const words = text.toLowerCase().split(/\s+/);
    
    // Simple word-based embedding
    words.forEach((word, index) => {
      const hash = this.hashString(word);
      const embeddingIndex = hash % RECOMMENDATION_CONFIG.embeddingDimensions;
      embedding[embeddingIndex] += 1 / Math.sqrt(words.length);
    });

    // Normalize the vector
    return this.normalizeVector(embedding);
  }

  /**
   * Hash string to number for simple embedding
   */
  hashString(str: string): number {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return Math.abs(hash);
  }

  /**
   * Normalize vector to unit length
   */
  normalizeVector(vector: number[]): number[] {
    const magnitude = Math.sqrt(vector.reduce((sum, val) => sum + val * val, 0));
    return magnitude > 0 ? vector.map(val => val / magnitude) : vector;
  }

  /**
   * Calculate cosine similarity between two vectors
   */
  cosineSimilarity(vectorA: number[], vectorB: number[]): number {
    if (vectorA.length !== vectorB.length) {
      throw new Error('Vectors must have the same length');
    }

    let dotProduct = 0;
    let magnitudeA = 0;
    let magnitudeB = 0;

    for (let i = 0; i < vectorA.length; i++) {
      dotProduct += vectorA[i] * vectorB[i];
      magnitudeA += vectorA[i] * vectorA[i];
      magnitudeB += vectorB[i] * vectorB[i];
    }

    magnitudeA = Math.sqrt(magnitudeA);
    magnitudeB = Math.sqrt(magnitudeB);

    if (magnitudeA === 0 || magnitudeB === 0) {
      return 0;
    }

    return dotProduct / (magnitudeA * magnitudeB);
  }

  /**
   * Generate content embedding and store in Firestore
   */
  async generateContentEmbedding(reelId: string): Promise<ContentEmbedding | null> {
    try {
      // Get reel data
      const reelDoc = await db.collection('reels').doc(reelId).get();
      if (!reelDoc.exists) {
        return null;
      }

      const reelData = reelDoc.data()!;
      
      // Combine caption and hashtags for embedding
      const textContent = [
        reelData.caption || '',
        reelData.hashtags?.join(' ') || '',
        reelData.category || '',
        reelData.aiAnalysis?.topics?.join(' ') || ''
      ].filter(Boolean).join(' ');

      // Generate embedding
      const embedding = await this.generateEmbedding(textContent);

      const contentEmbedding: ContentEmbedding = {
        reelId,
        embedding,
        caption: reelData.caption || '',
        hashtags: reelData.hashtags || [],
        category: reelData.category || '',
        topics: reelData.aiAnalysis?.topics || [],
        createdAt: reelData.createdAt,
        updatedAt: admin.firestore.FieldValue.serverTimestamp() as admin.firestore.Timestamp
      };

      // Store in Firestore
      await db.collection('content_embeddings').doc(reelId).set(contentEmbedding);
      
      return contentEmbedding;

    } catch (error) {
      console.error('Error generating content embedding:', error);
      return null;
    }
  }

  /**
   * Build user preference vector from interaction history
   */
  async buildUserPreferences(userId: string): Promise<UserPreference | null> {
    try {
      const now = admin.firestore.Timestamp.now();
      const cutoffDate = new Date(now.toMillis() - (RECOMMENDATION_CONFIG.maxDaysBack * 24 * 60 * 60 * 1000));

      // Get user interactions from the last 30 days
      const interactionsQuery = await db.collection('user_interactions')
        .where('userId', '==', userId)
        .where('timestamp', '>=', admin.firestore.Timestamp.fromDate(cutoffDate))
        .orderBy('timestamp', 'desc')
        .limit(1000)
        .get();

      if (interactionsQuery.empty || interactionsQuery.docs.length < RECOMMENDATION_CONFIG.minInteractions) {
        return null;
      }

      const interactions: UserInteraction[] = interactionsQuery.docs.map(doc => doc.data() as UserInteraction);
      
      // Get content embeddings for interacted reels
      const reelIds = [...new Set(interactions.map(i => i.reelId))];
      const embeddingPromises = reelIds.map(id => 
        db.collection('content_embeddings').doc(id).get()
      );
      
      const embeddingDocs = await Promise.all(embeddingPromises);
      const embeddings = new Map<string, ContentEmbedding>();
      
      embeddingDocs.forEach(doc => {
        if (doc.exists) {
          embeddings.set(doc.id, doc.data() as ContentEmbedding);
        }
      });

      // Build weighted preference vector
      const preferenceVector = new Array(RECOMMENDATION_CONFIG.embeddingDimensions).fill(0);
      const categoryWeights: { [category: string]: number } = {};
      const hashtagWeights: { [hashtag: string]: number } = {};
      let totalWeight = 0;

      interactions.forEach(interaction => {
        const embedding = embeddings.get(interaction.reelId);
        if (!embedding) return;

        // Calculate time decay
        const daysSince = (now.toMillis() - interaction.timestamp.toMillis()) / (24 * 60 * 60 * 1000);
        const timeDecay = Math.pow(RECOMMENDATION_CONFIG.decayFactor, daysSince);
        
        // Calculate interaction weight
        const interactionWeight = RECOMMENDATION_CONFIG.interactionWeights[interaction.type] || 1;
        const weight = interactionWeight * timeDecay;
        
        // Add to preference vector
        for (let i = 0; i < embedding.embedding.length; i++) {
          preferenceVector[i] += embedding.embedding[i] * weight;
        }

        // Track category preferences
        if (embedding.category) {
          categoryWeights[embedding.category] = (categoryWeights[embedding.category] || 0) + weight;
        }

        // Track hashtag preferences
        embedding.hashtags.forEach(hashtag => {
          hashtagWeights[hashtag] = (hashtagWeights[hashtag] || 0) + weight;
        });

        totalWeight += weight;
      });

      // Normalize preference vector
      if (totalWeight > 0) {
        for (let i = 0; i < preferenceVector.length; i++) {
          preferenceVector[i] /= totalWeight;
        }
      }

      const userPreference: UserPreference = {
        userId,
        preferenceVector: this.normalizeVector(preferenceVector),
        topCategories: categoryWeights,
        topHashtags: hashtagWeights,
        interactionCount: interactions.length,
        lastUpdated: now
      };

      // Store user preferences
      await db.collection('user_preferences').doc(userId).set(userPreference);
      
      return userPreference;

    } catch (error) {
      console.error('Error building user preferences:', error);
      return null;
    }
  }

  /**
   * Generate recommendations for a user
   */
  async generateUserRecommendations(userId: string): Promise<ReelRecommendation[]> {
    try {
      // Get user preferences
      const userPreference = await this.buildUserPreferences(userId);
      if (!userPreference) {
        // Return trending content for new users
        return this.getTrendingRecommendations();
      }

      // Get user's interaction history to avoid recommending already seen content
      const interactedReelsQuery = await db.collection('user_interactions')
        .where('userId', '==', userId)
        .select('reelId')
        .get();
      
      const interactedReels = new Set(interactedReelsQuery.docs.map(doc => doc.data().reelId));

      // Get all content embeddings (excluding user's own content and already interacted)
      const contentQuery = await db.collection('content_embeddings')
        .limit(5000) // Process in batches for performance
        .get();

      const recommendations: ReelRecommendation[] = [];

      for (const doc of contentQuery.docs) {
        const embedding = doc.data() as ContentEmbedding;
        
        // Skip if user already interacted with this content
        if (interactedReels.has(embedding.reelId)) {
          continue;
        }

        // Skip if it's user's own content
        const reelDoc = await db.collection('reels').doc(embedding.reelId).get();
        if (reelDoc.exists && reelDoc.data()?.userId === userId) {
          continue;
        }

        // Calculate similarity score
        const similarityScore = this.cosineSimilarity(
          userPreference.preferenceVector,
          embedding.embedding
        );

        // Apply category boost
        let categoryBoost = 0;
        if (embedding.category && userPreference.topCategories[embedding.category]) {
          categoryBoost = userPreference.topCategories[embedding.category] * 0.1;
        }

        // Apply hashtag boost
        let hashtagBoost = 0;
        embedding.hashtags.forEach(hashtag => {
          if (userPreference.topHashtags[hashtag]) {
            hashtagBoost += userPreference.topHashtags[hashtag] * 0.05;
          }
        });

        const finalScore = similarityScore + categoryBoost + hashtagBoost;

        // Only include if score is above threshold
        if (finalScore > RECOMMENDATION_CONFIG.similarityThreshold) {
          recommendations.push({
            reelId: embedding.reelId,
            score: finalScore,
            category: embedding.category,
            topics: embedding.topics,
            hashtags: embedding.hashtags,
            createdAt: embedding.createdAt,
            reason: this.generateRecommendationReason(embedding, userPreference, similarityScore)
          });
        }
      }

      // Sort by score and return top recommendations
      recommendations.sort((a, b) => b.score - a.score);
      return recommendations.slice(0, RECOMMENDATION_CONFIG.maxRecommendations);

    } catch (error) {
      console.error('Error generating user recommendations:', error);
      return [];
    }
  }

  /**
   * Generate trending recommendations for new users
   */
  async getTrendingRecommendations(): Promise<ReelRecommendation[]> {
    try {
      const trendingQuery = await db.collection('reels')
        .where('isActive', '==', true)
        .orderBy('likes', 'desc')
        .limit(RECOMMENDATION_CONFIG.maxRecommendations)
        .get();

      const recommendations: ReelRecommendation[] = [];

      for (const doc of trendingQuery.docs) {
        const reelData = doc.data();
        recommendations.push({
          reelId: doc.id,
          score: (reelData.likes + reelData.views * 0.001) / 1000, // Normalized trending score
          category: reelData.category || '',
          topics: reelData.aiAnalysis?.topics || [],
          hashtags: reelData.hashtags || [],
          createdAt: reelData.createdAt,
          reason: 'Trending content'
        });
      }

      return recommendations;

    } catch (error) {
      console.error('Error getting trending recommendations:', error);
      return [];
    }
  }

  /**
   * Generate human-readable recommendation reason
   */
  generateRecommendationReason(
    embedding: ContentEmbedding, 
    userPreference: UserPreference, 
    similarityScore: number
  ): string {
    const reasons = [];

    // Check category match
    if (embedding.category && userPreference.topCategories[embedding.category]) {
      reasons.push(`You enjoy ${embedding.category} content`);
    }

    // Check hashtag matches
    const matchingHashtags = embedding.hashtags.filter(tag => 
      userPreference.topHashtags[tag]
    );
    if (matchingHashtags.length > 0) {
      reasons.push(`Based on your interest in #${matchingHashtags[0]}`);
    }

    // Check topic matches
    const matchingTopics = embedding.topics.filter(topic =>
      userPreference.topCategories[topic]
    );
    if (matchingTopics.length > 0) {
      reasons.push(`Similar to ${matchingTopics[0]} content you liked`);
    }

    // Fallback to similarity
    if (reasons.length === 0) {
      if (similarityScore > 0.7) {
        reasons.push('Highly similar to your preferences');
      } else if (similarityScore > 0.4) {
        reasons.push('Similar to content you enjoyed');
      } else {
        reasons.push('Recommended for you');
      }
    }

    return reasons[0] || 'Recommended for you';
  }

  /**
   * Store recommendations for a user
   */
  async storeUserRecommendations(userId: string, recommendations: ReelRecommendation[]): Promise<void> {
    try {
      const batch = db.batch();
      const now = admin.firestore.Timestamp.now();

      // Create recommendations document
      const recommendationsDoc = {
        userId,
        recommendations,
        generatedAt: now,
        expiresAt: admin.firestore.Timestamp.fromMillis(now.toMillis() + 24 * 60 * 60 * 1000), // 24 hours
        totalCount: recommendations.length,
        averageScore: recommendations.reduce((sum, rec) => sum + rec.score, 0) / recommendations.length
      };

      batch.set(
        db.collection('user_recommendations').doc(userId),
        recommendationsDoc
      );

      // Store individual recommendation entries for quick lookup
      recommendations.forEach((rec, index) => {
        batch.set(
          db.collection('user_recommendations').doc(userId).collection('reels').doc(rec.reelId),
          {
            ...rec,
            rank: index + 1,
            generatedAt: now
          }
        );
      });

      await batch.commit();

    } catch (error) {
      console.error('Error storing user recommendations:', error);
      throw error;
    }
  }
}

export const recommendationEngine = new RecommendationEngine();

// Export functions for Firebase
export { RecommendationEngine, RECOMMENDATION_CONFIG }; 