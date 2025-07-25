import { httpsCallable } from 'firebase/functions';
import { functions } from './firebase';
import { ApiResponse } from '../types';
import Constants from 'expo-constants';

// OpenAI Configuration
const OPENAI_API_KEY = Constants.expoConfig?.extra?.openaiApiKey || 'your-openai-api-key';
const OPENAI_API_URL = 'https://api.openai.com/v1/chat/completions';

// Topic categories for ReelShare
export const TOPIC_CATEGORIES = [
  'dance', 'comedy', 'fitness', 'food', 'technology', 'music', 'art', 'travel',
  'lifestyle', 'education', 'motivation', 'entertainment', 'fashion', 'beauty',
  'sports', 'gaming', 'business', 'health', 'pets', 'nature', 'diy', 'reviews'
];

// Interest keywords mapping
export const INTEREST_KEYWORDS = {
  dance: ['dance', 'choreography', 'ballet', 'hip-hop', 'salsa', 'tango', 'moves', 'rhythm', 'music', 'performance'],
  comedy: ['funny', 'hilarious', 'laugh', 'joke', 'humor', 'comedy', 'sarcasm', 'meme', 'entertainment', 'amusing'],
  fitness: ['workout', 'exercise', 'gym', 'health', 'fitness', 'training', 'muscle', 'cardio', 'yoga', 'strength'],
  food: ['recipe', 'cooking', 'food', 'chef', 'kitchen', 'meal', 'delicious', 'taste', 'ingredients', 'cuisine'],
  technology: ['tech', 'gadget', 'phone', 'computer', 'app', 'software', 'innovation', 'digital', 'device', 'review'],
  music: ['song', 'music', 'singing', 'instrument', 'beat', 'melody', 'artist', 'concert', 'album', 'sound'],
  art: ['art', 'drawing', 'painting', 'creative', 'design', 'artistic', 'sketch', 'illustration', 'craft', 'visual'],
  travel: ['travel', 'vacation', 'trip', 'explore', 'adventure', 'destination', 'journey', 'tourism', 'culture', 'places'],
  lifestyle: ['lifestyle', 'daily', 'routine', 'life', 'habits', 'wellness', 'self-care', 'balance', 'living', 'personal'],
  education: ['learn', 'education', 'tutorial', 'teach', 'knowledge', 'study', 'tips', 'guide', 'lesson', 'information'],
  motivation: ['motivation', 'inspiration', 'goals', 'success', 'mindset', 'positive', 'achieve', 'dream', 'overcome', 'believe'],
  entertainment: ['entertainment', 'fun', 'enjoy', 'exciting', 'amazing', 'cool', 'awesome', 'interesting', 'engaging', 'captivating']
};

interface TopicAnalysis {
  primaryTopics: string[];
  secondaryTopics: string[];
  hashtags: string[];
  sentiment: 'positive' | 'neutral' | 'negative';
  confidence: number;
  keywords: string[];
}

interface InterestMatchingResult {
  userInterests: string[];
  topicRelevance: { [topic: string]: number };
  matchingScore: number;
  recommendedHashtags: string[];
}

class AIService {
  // Analyze caption using OpenAI GPT
  async analyzeCaptionWithOpenAI(caption: string): Promise<ApiResponse<TopicAnalysis>> {
    try {
      const prompt = `
        Analyze this social media video caption and extract:
        1. Primary topics (max 3) from: ${TOPIC_CATEGORIES.join(', ')}
        2. Secondary topics (max 5) 
        3. Existing hashtags
        4. Sentiment (positive/neutral/negative)
        5. Confidence score (0-1)
        6. Key descriptive words

        Caption: "${caption}"

        Respond in JSON format:
        {
          "primaryTopics": ["topic1", "topic2"],
          "secondaryTopics": ["topic3", "topic4"],
          "hashtags": ["existing", "hashtags"],
          "sentiment": "positive",
          "confidence": 0.85,
          "keywords": ["key", "words"]
        }
      `;

      const response = await fetch(OPENAI_API_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${OPENAI_API_KEY}`,
        },
        body: JSON.stringify({
          model: 'gpt-3.5-turbo',
          messages: [
            {
              role: 'system',
              content: 'You are an expert at analyzing social media content and extracting relevant topics and keywords for content recommendation systems.'
            },
            {
              role: 'user',
              content: prompt
            }
          ],
          max_tokens: 300,
          temperature: 0.3,
        }),
      });

      if (!response.ok) {
        throw new Error(`OpenAI API error: ${response.status}`);
      }

      const data = await response.json();
      const analysis = JSON.parse(data.choices[0].message.content);

      return {
        success: true,
        data: analysis,
        message: 'Caption analyzed successfully'
      };

    } catch (error) {
      console.error('OpenAI analysis error:', error);
      
      // Fallback to local analysis if OpenAI fails
      return this.analyzeCaption(caption);
    }
  }

  // Local caption analysis as fallback
  async analyzeCaption(caption: string): Promise<ApiResponse<TopicAnalysis>> {
    try {
      const lowerCaption = caption.toLowerCase();
      const words = lowerCaption.split(/\s+/);
      
      // Extract hashtags
      const hashtags = caption.match(/#[\w]+/g) || [];
      const cleanHashtags = hashtags.map(tag => tag.substring(1).toLowerCase());

      // Analyze topics based on keywords
      const topicScores: { [key: string]: number } = {};
      
      Object.entries(INTEREST_KEYWORDS).forEach(([topic, keywords]) => {
        let score = 0;
        keywords.forEach(keyword => {
          if (lowerCaption.includes(keyword)) {
            score += 1;
          }
        });
        
        // Bonus points for hashtags matching topic
        cleanHashtags.forEach(hashtag => {
          if (keywords.includes(hashtag) || hashtag === topic) {
            score += 2;
          }
        });
        
        if (score > 0) {
          topicScores[topic] = score;
        }
      });

      // Sort topics by score
      const sortedTopics = Object.entries(topicScores)
        .sort(([,a], [,b]) => b - a)
        .map(([topic]) => topic);

      const primaryTopics = sortedTopics.slice(0, 3);
      const secondaryTopics = sortedTopics.slice(3, 8);

      // Determine sentiment (simple approach)
      const positiveWords = ['amazing', 'awesome', 'great', 'love', 'beautiful', 'perfect', 'incredible', 'fantastic'];
      const negativeWords = ['hate', 'terrible', 'awful', 'worst', 'bad', 'horrible', 'disgusting'];
      
      let sentiment: 'positive' | 'neutral' | 'negative' = 'neutral';
      const positiveCount = positiveWords.filter(word => lowerCaption.includes(word)).length;
      const negativeCount = negativeWords.filter(word => lowerCaption.includes(word)).length;
      
      if (positiveCount > negativeCount) sentiment = 'positive';
      else if (negativeCount > positiveCount) sentiment = 'negative';

      // Calculate confidence based on topic matches
      const confidence = Math.min(0.9, Math.max(0.3, (Object.keys(topicScores).length / 5) + 0.3));

      // Extract key descriptive words
      const stopWords = ['the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 'by', 'is', 'are', 'was', 'were', 'be', 'been', 'being', 'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'could', 'should', 'may', 'might', 'must'];
      const keywords = words
        .filter(word => word.length > 3 && !stopWords.includes(word) && !word.startsWith('#'))
        .slice(0, 10);

      const analysis: TopicAnalysis = {
        primaryTopics,
        secondaryTopics,
        hashtags: cleanHashtags,
        sentiment,
        confidence,
        keywords
      };

      return {
        success: true,
        data: analysis,
        message: 'Caption analyzed successfully (local fallback)'
      };

    } catch (error) {
      return {
        success: false,
        error: 'Failed to analyze caption',
        message: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  // Generate suggested hashtags based on analysis
  generateHashtagSuggestions(analysis: TopicAnalysis): string[] {
    const suggestions: Set<string> = new Set();
    
    // Add topic-based hashtags
    analysis.primaryTopics.forEach(topic => {
      suggestions.add(topic);
      // Add related hashtags
      const relatedWords = INTEREST_KEYWORDS[topic as keyof typeof INTEREST_KEYWORDS] || [];
      relatedWords.slice(0, 2).forEach(word => suggestions.add(word));
    });

    // Add trending hashtags based on content
    const trendingHashtags = [
      'viral', 'trending', 'fyp', 'foryou', 'explore', 'reels', 'video', 'content',
      'creator', 'community', 'share', 'like', 'follow'
    ];

    // Add 2-3 trending hashtags
    trendingHashtags.slice(0, 3).forEach(tag => suggestions.add(tag));

    return Array.from(suggestions).slice(0, 10);
  }

  // Match user interests with content topics
  async matchUserInterests(
    userId: string,
    contentTopics: string[],
    userInterests: string[] = []
  ): Promise<ApiResponse<InterestMatchingResult>> {
    try {
      // Calculate relevance scores for each topic
      const topicRelevance: { [topic: string]: number } = {};
      
      contentTopics.forEach(topic => {
        let relevance = 0.5; // Base relevance
        
        // Higher relevance if user has shown interest in this topic
        if (userInterests.includes(topic)) {
          relevance += 0.4;
        }
        
        // Check for related interests
        const relatedKeywords = INTEREST_KEYWORDS[topic as keyof typeof INTEREST_KEYWORDS] || [];
        const matchingInterests = userInterests.filter(interest => 
          relatedKeywords.includes(interest.toLowerCase())
        );
        
        relevance += matchingInterests.length * 0.1;
        
        topicRelevance[topic] = Math.min(1.0, relevance);
      });

      // Calculate overall matching score
      const avgRelevance = Object.values(topicRelevance).reduce((sum, score) => sum + score, 0) / contentTopics.length;
      const matchingScore = Math.round(avgRelevance * 100) / 100;

      // Generate recommended hashtags based on user interests
      const recommendedHashtags: Set<string> = new Set();
      userInterests.forEach(interest => {
        if (INTEREST_KEYWORDS[interest as keyof typeof INTEREST_KEYWORDS]) {
          const keywords = INTEREST_KEYWORDS[interest as keyof typeof INTEREST_KEYWORDS];
          keywords.slice(0, 2).forEach(keyword => recommendedHashtags.add(keyword));
        }
      });

      const result: InterestMatchingResult = {
        userInterests,
        topicRelevance,
        matchingScore,
        recommendedHashtags: Array.from(recommendedHashtags).slice(0, 8)
      };

      return {
        success: true,
        data: result,
        message: 'Interest matching completed'
      };

    } catch (error) {
      return {
        success: false,
        error: 'Failed to match user interests',
        message: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  // Firebase Cloud Function for AI analysis (server-side processing)
  async processVideoAnalysis(videoData: {
    videoUrl: string;
    caption: string;
    userId: string;
    duration: number;
  }): Promise<ApiResponse<any>> {
    try {
      const processAnalysis = httpsCallable(functions, 'processVideoAnalysis');
      const result = await processAnalysis(videoData);
      
      return {
        success: true,
        data: result.data,
        message: 'Video analysis processed successfully'
      };
    } catch (error) {
      console.error('Firebase function error:', error);
      return {
        success: false,
        error: 'Failed to process video analysis',
        message: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  // Update user interests based on content interaction
  async updateUserInterests(userId: string, contentTopics: string[], interactionType: 'view' | 'like' | 'share' | 'comment'): Promise<void> {
    try {
      const updateInterests = httpsCallable(functions, 'updateUserInterests');
      await updateInterests({
        userId,
        contentTopics,
        interactionType,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      console.error('Failed to update user interests:', error);
    }
  }

  // Get content recommendations based on user interests
  async getContentRecommendations(userId: string, limit: number = 10): Promise<ApiResponse<any[]>> {
    try {
      const getRecommendations = httpsCallable(functions, 'getContentRecommendations');
      const result = await getRecommendations({ userId, limit });
      
      return {
        success: true,
        data: result.data,
        message: 'Recommendations retrieved successfully'
      };
    } catch (error) {
      return {
        success: false,
        error: 'Failed to get recommendations',
        message: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  // Extract topics from video thumbnail/preview (future feature)
  async analyzeVideoThumbnail(thumbnailUrl: string): Promise<ApiResponse<string[]>> {
    // Placeholder for future computer vision integration
    return {
      success: true,
      data: [],
      message: 'Thumbnail analysis not implemented yet'
    };
  }
}

export default new AIService(); 