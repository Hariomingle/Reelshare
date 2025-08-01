import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';
import { OpenAI } from 'openai';
import * as cors from 'cors';

// Initialize Firebase Admin
admin.initializeApp();
const db = admin.firestore();
const auth = admin.auth();

// Initialize OpenAI for AI recommendations
const openai = new OpenAI({
  apiKey: functions.config().openai.api_key,
});

// CORS configuration
const corsHandler = cors({ origin: true });

// Helper function to verify authentication
const verifyAuth = async (req: any): Promise<admin.auth.DecodedIdToken> => {
  const token = req.headers.authorization?.split('Bearer ')[1];
  if (!token) {
    throw new functions.https.HttpsError('unauthenticated', 'No token provided');
  }
  return await auth.verifyIdToken(token);
};

// Generate AI embeddings for content recommendation
export const generateContentEmbedding = functions.https.onRequest(async (req, res) => {
  corsHandler(req, res, async () => {
    try {
      const { text, reelId } = req.body;
      
      // Verify authentication
      await verifyAuth(req);

      // Generate embedding using OpenAI
      const response = await openai.embeddings.create({
        model: 'text-embedding-ada-002',
        input: text,
      });

      const embedding = response.data[0].embedding;

      // Store embedding in Firestore
      await db.collection('reel_embeddings').doc(reelId).set({
        embedding,
        text,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
      });

      res.status(200).json({ success: true, embedding });
    } catch (error) {
      console.error('Generate embedding error:', error);
      res.status(500).json({ success: false, error: error.message });
    }
  });
});

// Get personalized recommendations for user
export const getRecommendations = functions.https.onRequest(async (req, res) => {
  corsHandler(req, res, async () => {
    try {
      const { userId, limit = 20 } = req.query;
      
      // Verify authentication
      const decodedToken = await verifyAuth(req);
      if (decodedToken.uid !== userId) {
        throw new functions.https.HttpsError('permission-denied', 'Access denied');
      }

      // Get user interests and behavior
      const userAnalytics = await db.collection('user_analytics').doc(userId as string).get();
      const userData = userAnalytics.data();

      if (!userData) {
        // Return trending content for new users
        const trendingReels = await db.collection('reels')
          .where('isActive', '==', true)
          .orderBy('views', 'desc')
          .limit(Number(limit))
          .get();

        const recommendations = trendingReels.docs.map(doc => ({
          id: doc.id,
          ...doc.data(),
          score: 1.0,
        }));

        return res.status(200).json({ success: true, recommendations });
      }

      // Get user's preferred categories and recent interactions
      const preferredCategories = userData.preferredCategories || [];
      const engagementScore = userData.engagementScore || 0;

      // Query reels based on user preferences
      let reelsQuery = db.collection('reels')
        .where('isActive', '==', true);

      if (preferredCategories.length > 0) {
        reelsQuery = reelsQuery.where('category', 'in', preferredCategories);
      }

      const reels = await reelsQuery
        .orderBy('createdAt', 'desc')
        .limit(Number(limit) * 2) // Get more to filter and rank
        .get();

      // Simple recommendation scoring
      const recommendations = reels.docs
        .map(doc => {
          const reelData = doc.data();
          let score = 0.5; // Base score

          // Boost score for preferred categories
          if (preferredCategories.includes(reelData.category)) {
            score += 0.3;
          }

          // Boost score for trending content
          if (reelData.views > 1000) {
            score += 0.2;
          }

          // Boost score for recent content
          const daysSinceCreated = (Date.now() - reelData.createdAt.toMillis()) / (1000 * 60 * 60 * 24);
          if (daysSinceCreated < 1) {
            score += 0.1;
          }

          return {
            id: doc.id,
            ...reelData,
            score,
          };
        })
        .sort((a, b) => b.score - a.score)
        .slice(0, Number(limit));

      res.status(200).json({ success: true, recommendations });
    } catch (error) {
      console.error('Get recommendations error:', error);
      res.status(500).json({ success: false, error: error.message });
    }
  });
});

// Process wallet transaction
export const processWalletTransaction = functions.https.onCall(async (data, context) => {
  try {
    if (!context.auth) {
      throw new functions.https.HttpsError('unauthenticated', 'Must be authenticated');
    }

    const { userId, type, subType, amount, description, reelId } = data;
    
    // Verify user
    if (context.auth.uid !== userId) {
      throw new functions.https.HttpsError('permission-denied', 'Access denied');
    }

    // Create transaction record
    const transactionData = {
      userId,
      type,
      subType,
      amount,
      description,
      reelId: reelId || null,
      status: 'completed',
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    };

    const transactionRef = await db.collection('wallet_transactions').add(transactionData);

    // Update user wallet
    const walletRef = db.collection('wallets').doc(userId);
    
    await db.runTransaction(async (transaction) => {
      const walletDoc = await transaction.get(walletRef);
      
      if (!walletDoc.exists) {
        throw new functions.https.HttpsError('not-found', 'Wallet not found');
      }

      const walletData = walletDoc.data()!;
      const updates: any = {
        lastUpdated: admin.firestore.FieldValue.serverTimestamp(),
      };

      if (type === 'earning' || type === 'bonus' || type === 'referral') {
        updates.totalBalance = walletData.totalBalance + amount;
        updates.availableBalance = walletData.availableBalance + amount;
        updates.totalEarned = walletData.totalEarned + amount;

        // Update specific earning types
        switch (subType) {
          case 'watch':
            updates.watchEarnings = walletData.watchEarnings + amount;
            break;
          case 'create':
            updates.createEarnings = walletData.createEarnings + amount;
            break;
          case 'referral_signup':
            updates.referralEarnings = walletData.referralEarnings + amount;
            break;
          case 'daily_streak':
            updates.streakEarnings = walletData.streakEarnings + amount;
            break;
        }
      } else if (type === 'withdrawal') {
        if (walletData.availableBalance < amount) {
          throw new functions.https.HttpsError('failed-precondition', 'Insufficient balance');
        }
        
        updates.availableBalance = walletData.availableBalance - amount;
        updates.pendingBalance = walletData.pendingBalance + amount;
      }

      transaction.update(walletRef, updates);
    });

    return { success: true, transactionId: transactionRef.id };
  } catch (error) {
    console.error('Process wallet transaction error:', error);
    throw error;
  }
});

// Update user analytics
export const updateUserAnalytics = functions.https.onCall(async (data, context) => {
  try {
    if (!context.auth) {
      throw new functions.https.HttpsError('unauthenticated', 'Must be authenticated');
    }

    const { userId, action, reelId, category, watchTime } = data;
    
    if (context.auth.uid !== userId) {
      throw new functions.https.HttpsError('permission-denied', 'Access denied');
    }

    const analyticsRef = db.collection('user_analytics').doc(userId);
    
    await db.runTransaction(async (transaction) => {
      const analyticsDoc = await transaction.get(analyticsRef);
      
      if (!analyticsDoc.exists) {
        // Create new analytics document
        const newAnalytics = {
          userId,
          totalWatchTime: watchTime || 0,
          videosWatched: action === 'view' ? 1 : 0,
          videosCreated: action === 'create' ? 1 : 0,
          averageWatchPercentage: 0,
          preferredCategories: category ? [category] : [],
          activeHours: [new Date().getHours()],
          lastActivityDate: admin.firestore.FieldValue.serverTimestamp(),
          engagementScore: 1,
        };
        
        transaction.set(analyticsRef, newAnalytics);
        return;
      }

      const analyticsData = analyticsDoc.data()!;
      const updates: any = {
        lastActivityDate: admin.firestore.FieldValue.serverTimestamp(),
      };

      if (action === 'view') {
        updates.videosWatched = analyticsData.videosWatched + 1;
        updates.totalWatchTime = analyticsData.totalWatchTime + (watchTime || 0);
        
        // Update preferred categories
        if (category) {
          const categories = analyticsData.preferredCategories || [];
          const categoryIndex = categories.findIndex((c: any) => c.name === category);
          
          if (categoryIndex >= 0) {
            categories[categoryIndex].count += 1;
          } else {
            categories.push({ name: category, count: 1 });
          }
          
          updates.preferredCategories = categories
            .sort((a: any, b: any) => b.count - a.count)
            .slice(0, 10); // Keep top 10 categories
        }
      } else if (action === 'create') {
        updates.videosCreated = analyticsData.videosCreated + 1;
        updates.engagementScore = analyticsData.engagementScore + 2; // Boost for content creation
      } else if (action === 'like' || action === 'share' || action === 'comment') {
        updates.engagementScore = analyticsData.engagementScore + 1;
      }

      transaction.update(analyticsRef, updates);
    });

    return { success: true };
  } catch (error) {
    console.error('Update user analytics error:', error);
    throw error;
  }
});

// Check and update daily streak
export const updateDailyStreak = functions.https.onCall(async (data, context) => {
  try {
    if (!context.auth) {
      throw new functions.https.HttpsError('unauthenticated', 'Must be authenticated');
    }

    const { userId } = data;
    
    if (context.auth.uid !== userId) {
      throw new functions.https.HttpsError('permission-denied', 'Access denied');
    }

    const streakRef = db.collection('daily_streaks').doc(userId);
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    await db.runTransaction(async (transaction) => {
      const streakDoc = await transaction.get(streakRef);
      
      if (!streakDoc.exists) {
        // Create new streak
        const newStreak = {
          userId,
          currentStreak: 1,
          maxStreak: 1,
          lastStreakDate: admin.firestore.Timestamp.fromDate(today),
          streakRewards: 1, // ₹1 for first day
          milestones: {},
        };
        
        transaction.set(streakRef, newStreak);
        
        // Award streak bonus
        await processWalletTransaction({
          userId,
          type: 'bonus',
          subType: 'daily_streak',
          amount: 1,
          description: 'Daily streak bonus - Day 1',
        }, context);
        
        return { success: true, streakCount: 1, bonus: 1 };
      }

      const streakData = streakDoc.data()!;
      const lastStreakDate = streakData.lastStreakDate.toDate();
      lastStreakDate.setHours(0, 0, 0, 0);
      
      const daysDiff = Math.floor((today.getTime() - lastStreakDate.getTime()) / (1000 * 60 * 60 * 24));
      
      if (daysDiff === 0) {
        // Already checked in today
        return { success: true, streakCount: streakData.currentStreak, bonus: 0 };
      } else if (daysDiff === 1) {
        // Consecutive day
        const newStreak = streakData.currentStreak + 1;
        const bonus = Math.min(1 + Math.floor(newStreak / 7), 5); // Bonus increases every week, max ₹5
        
        const updates = {
          currentStreak: newStreak,
          maxStreak: Math.max(streakData.maxStreak, newStreak),
          lastStreakDate: admin.firestore.Timestamp.fromDate(today),
          streakRewards: streakData.streakRewards + bonus,
        };
        
        // Check milestones
        if ([7, 14, 30, 60, 100].includes(newStreak)) {
          updates.milestones = {
            ...streakData.milestones,
            [newStreak]: admin.firestore.Timestamp.fromDate(today),
          };
        }
        
        transaction.update(streakRef, updates);
        
        // Award streak bonus
        await processWalletTransaction({
          userId,
          type: 'bonus',
          subType: 'daily_streak',
          amount: bonus,
          description: `Daily streak bonus - Day ${newStreak}`,
        }, context);
        
        return { success: true, streakCount: newStreak, bonus };
      } else {
        // Streak broken, reset
        const updates = {
          currentStreak: 1,
          lastStreakDate: admin.firestore.Timestamp.fromDate(today),
          streakRewards: streakData.streakRewards + 1,
        };
        
        transaction.update(streakRef, updates);
        
        // Award basic bonus
        await processWalletTransaction({
          userId,
          type: 'bonus',
          subType: 'daily_streak',
          amount: 1,
          description: 'Daily streak bonus - Day 1 (Restarted)',
        }, context);
        
        return { success: true, streakCount: 1, bonus: 1, streakBroken: true };
      }
    });
  } catch (error) {
    console.error('Update daily streak error:', error);
    throw error;
  }
});

// Scheduled function to process pending withdrawals
export const processWithdrawals = functions.pubsub.schedule('every 24 hours').onRun(async (context) => {
  try {
    // Get pending withdrawal transactions
    const pendingWithdrawals = await db.collection('wallet_transactions')
      .where('type', '==', 'withdrawal')
      .where('status', '==', 'pending')
      .get();

    const batch = db.batch();

    for (const doc of pendingWithdrawals.docs) {
      const transactionData = doc.data();
      
      // In a real implementation, you would integrate with Razorpay API here
      // For now, we'll just mark as completed after 24 hours
      const createdAt = transactionData.createdAt.toDate();
      const hoursSinceCreated = (Date.now() - createdAt.getTime()) / (1000 * 60 * 60);
      
      if (hoursSinceCreated >= 24) {
        // Update transaction status
        batch.update(doc.ref, {
          status: 'completed',
          processedAt: admin.firestore.FieldValue.serverTimestamp(),
        });

        // Update user wallet
        const walletRef = db.collection('wallets').doc(transactionData.userId);
        batch.update(walletRef, {
          pendingBalance: admin.firestore.FieldValue.increment(-transactionData.amount),
          totalWithdrawn: admin.firestore.FieldValue.increment(transactionData.amount),
        });
      }
    }

    await batch.commit();
    console.log(`Processed ${pendingWithdrawals.size} withdrawal transactions`);
  } catch (error) {
    console.error('Process withdrawals error:', error);
  }
});

// Clean up expired data
export const cleanupExpiredData = functions.pubsub.schedule('every 168 hours').onRun(async (context) => {
  try {
    const oneWeekAgo = new Date();
    oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);

    // Clean up old analytics data
    const oldAnalytics = await db.collection('analytics_events')
      .where('createdAt', '<', admin.firestore.Timestamp.fromDate(oneWeekAgo))
      .get();

    const batch = db.batch();
    oldAnalytics.docs.forEach(doc => {
      batch.delete(doc.ref);
    });

    await batch.commit();
    console.log(`Cleaned up ${oldAnalytics.size} old analytics records`);
  } catch (error) {
    console.error('Cleanup expired data error:', error);
  }
}); 

// Process ad revenue and distribute according to revenue sharing plan
export const processAdRevenue = functions.https.onCall(async (data, context) => {
  try {
    if (!context.auth) {
      throw new functions.https.HttpsError('unauthenticated', 'Must be authenticated');
    }

    const { 
      reelId, 
      viewerId, 
      adProvider, 
      adType, 
      revenue, 
      cpm, 
      viewDuration 
    } = data;

    // Get reel details to find creator
    const reelDoc = await db.collection('reels').doc(reelId).get();
    if (!reelDoc.exists) {
      throw new functions.https.HttpsError('not-found', 'Reel not found');
    }

    const reelData = reelDoc.data()!;
    const creatorId = reelData.userId;

    // Check if view qualifies for revenue sharing (minimum 30 seconds)
    const isValidView = viewDuration >= 30;

    if (!isValidView) {
      console.log('View too short for revenue sharing:', viewDuration);
      return { success: true, message: 'View too short for revenue sharing' };
    }

    // Create ad revenue event
    const adRevenueEventData = {
      reelId,
      viewerId,
      creatorId,
      adProvider,
      adType,
      revenue,
      cpm,
      viewDuration,
      isValidView,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    };

    const adRevenueEventRef = await db.collection('ad_revenue_events').add(adRevenueEventData);

    // Calculate revenue distribution based on your plan: 60% Creator, 20% Viewer, 20% App
    const creatorShare = revenue * 0.6;
    const viewerShare = revenue * 0.2;
    const appShare = revenue * 0.2;

    // Create revenue distribution record
    const distributionData = {
      adRevenueEventId: adRevenueEventRef.id,
      reelId,
      totalRevenue: revenue,
      distributions: {
        creator: {
          userId: creatorId,
          amount: creatorShare,
          percentage: 60,
        },
        viewer: {
          userId: viewerId,
          amount: viewerShare,
          percentage: 20,
        },
        app: {
          amount: appShare,
          percentage: 20,
        },
      },
      status: 'pending',
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    };

    const distributionRef = await db.collection('revenue_distributions').add(distributionData);

    // Distribute revenue to creator and viewer wallets
    await db.runTransaction(async (transaction) => {
      // Update creator wallet
      const creatorWalletRef = db.collection('wallets').doc(creatorId);
      const creatorWalletDoc = await transaction.get(creatorWalletRef);
      
      if (creatorWalletDoc.exists) {
        const creatorWalletData = creatorWalletDoc.data()!;
        transaction.update(creatorWalletRef, {
          totalBalance: creatorWalletData.totalBalance + creatorShare,
          availableBalance: creatorWalletData.availableBalance + creatorShare,
          totalEarned: creatorWalletData.totalEarned + creatorShare,
          adEarnings: creatorWalletData.adEarnings + creatorShare,
          createEarnings: creatorWalletData.createEarnings + creatorShare,
          lastUpdated: admin.firestore.FieldValue.serverTimestamp(),
        });
      }

      // Update viewer wallet
      const viewerWalletRef = db.collection('wallets').doc(viewerId);
      const viewerWalletDoc = await transaction.get(viewerWalletRef);
      
      if (viewerWalletDoc.exists) {
        const viewerWalletData = viewerWalletDoc.data()!;
        transaction.update(viewerWalletRef, {
          totalBalance: viewerWalletData.totalBalance + viewerShare,
          availableBalance: viewerWalletData.availableBalance + viewerShare,
          totalEarned: viewerWalletData.totalEarned + viewerShare,
          adEarnings: viewerWalletData.adEarnings + viewerShare,
          watchEarnings: viewerWalletData.watchEarnings + viewerShare,
          lastUpdated: admin.firestore.FieldValue.serverTimestamp(),
        });
      }

      // Mark distribution as completed
      transaction.update(distributionRef, {
        status: 'completed',
        processedAt: admin.firestore.FieldValue.serverTimestamp(),
      });

      // Mark ad revenue event as distributed
      transaction.update(adRevenueEventRef, {
        distributedAt: admin.firestore.FieldValue.serverTimestamp(),
      });
    });

    // Create wallet transactions for tracking
    const batch = db.batch();

    // Creator transaction
    const creatorTransactionRef = db.collection('wallet_transactions').doc();
    batch.set(creatorTransactionRef, {
      userId: creatorId,
      type: 'earning',
      subType: 'ad_revenue',
      amount: creatorShare,
      description: `Ad revenue share from reel view (60%)`,
      reelId,
      status: 'completed',
      adRevenue: {
        totalAdRevenue: revenue,
        creatorShare,
        viewerShare,
        appShare,
        adProvider,
        cpm,
      },
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    // Viewer transaction
    const viewerTransactionRef = db.collection('wallet_transactions').doc();
    batch.set(viewerTransactionRef, {
      userId: viewerId,
      type: 'earning',
      subType: 'ad_revenue',
      amount: viewerShare,
      description: `Ad revenue share for watching reel (20%)`,
      reelId,
      status: 'completed',
      adRevenue: {
        totalAdRevenue: revenue,
        creatorShare,
        viewerShare,
        appShare,
        adProvider,
        cpm,
      },
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    await batch.commit();

    return {
      success: true,
      distributionId: distributionRef.id,
      revenue: {
        total: revenue,
        creator: creatorShare,
        viewer: viewerShare,
        app: appShare,
      },
    };
  } catch (error) {
    console.error('Process ad revenue error:', error);
    throw error;
  }
});

// Get ad revenue analytics for admin dashboard
export const getAdRevenueAnalytics = functions.https.onCall(async (data, context) => {
  try {
    if (!context.auth) {
      throw new functions.https.HttpsError('unauthenticated', 'Must be authenticated');
    }

    // Check if user is admin (you'll need to implement admin role checking)
    // For now, we'll allow any authenticated user
    
    const { startDate, endDate, userId } = data;
    
    let query = db.collection('ad_revenue_events')
      .where('isValidView', '==', true);

    if (startDate && endDate) {
      query = query
        .where('createdAt', '>=', admin.firestore.Timestamp.fromDate(new Date(startDate)))
        .where('createdAt', '<=', admin.firestore.Timestamp.fromDate(new Date(endDate)));
    }

    if (userId) {
      // Get revenue for specific user (either as creator or viewer)
      const creatorQuery = query.where('creatorId', '==', userId);
      const viewerQuery = query.where('viewerId', '==', userId);
      
      const [creatorResults, viewerResults] = await Promise.all([
        creatorQuery.get(),
        viewerQuery.get()
      ]);

      const analytics = {
        asCreator: {
          totalViews: creatorResults.size,
          totalRevenue: 0,
          totalEarnings: 0, // 60% of total revenue
          averageCpm: 0,
        },
        asViewer: {
          totalViews: viewerResults.size,
          totalRevenue: 0,
          totalEarnings: 0, // 20% of total revenue
        },
      };

      // Calculate creator analytics
      creatorResults.docs.forEach(doc => {
        const data = doc.data();
        analytics.asCreator.totalRevenue += data.revenue;
        analytics.asCreator.totalEarnings += data.revenue * 0.6;
      });

      if (creatorResults.size > 0) {
        analytics.asCreator.averageCpm = analytics.asCreator.totalRevenue / creatorResults.size * 1000;
      }

      // Calculate viewer analytics
      viewerResults.docs.forEach(doc => {
        const data = doc.data();
        analytics.asViewer.totalRevenue += data.revenue;
        analytics.asViewer.totalEarnings += data.revenue * 0.2;
      });

      return { success: true, analytics };
    } else {
      // Get overall platform analytics
      const results = await query.get();
      
      const analytics = {
        totalViews: results.size,
        totalRevenue: 0,
        totalCreatorEarnings: 0,
        totalViewerEarnings: 0,
        totalAppRevenue: 0,
        averageCpm: 0,
        revenueByProvider: {} as { [key: string]: number },
      };

      results.docs.forEach(doc => {
        const data = doc.data();
        analytics.totalRevenue += data.revenue;
        analytics.totalCreatorEarnings += data.revenue * 0.6;
        analytics.totalViewerEarnings += data.revenue * 0.2;
        analytics.totalAppRevenue += data.revenue * 0.2;

        // Track revenue by ad provider
        if (!analytics.revenueByProvider[data.adProvider]) {
          analytics.revenueByProvider[data.adProvider] = 0;
        }
        analytics.revenueByProvider[data.adProvider] += data.revenue;
      });

      if (results.size > 0) {
        analytics.averageCpm = analytics.totalRevenue / results.size * 1000;
      }

      return { success: true, analytics };
    }
  } catch (error) {
    console.error('Get ad revenue analytics error:', error);
    throw error;
  }
});

// Update the existing processWalletTransaction to handle fixed bonuses separately
export const processFixedBonus = functions.https.onCall(async (data, context) => {
  try {
    if (!context.auth) {
      throw new functions.https.HttpsError('unauthenticated', 'Must be authenticated');
    }

    const { userId, type, subType, amount, description, reelId } = data;
    
    // Verify user
    if (context.auth.uid !== userId) {
      throw new functions.https.HttpsError('permission-denied', 'Access denied');
    }

    // This is for fixed bonuses only (not ad revenue)
    const allowedSubTypes = ['create', 'referral_signup', 'daily_streak', 'like_bonus', 'share_bonus'];
    if (!allowedSubTypes.includes(subType)) {
      throw new functions.https.HttpsError('invalid-argument', 'Invalid bonus type');
    }

    // Create transaction record
    const transactionData = {
      userId,
      type: 'bonus',
      subType,
      amount,
      description,
      reelId: reelId || null,
      status: 'completed',
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    };

    const transactionRef = await db.collection('wallet_transactions').add(transactionData);

    // Update user wallet
    const walletRef = db.collection('wallets').doc(userId);
    
    await db.runTransaction(async (transaction) => {
      const walletDoc = await transaction.get(walletRef);
      
      if (!walletDoc.exists) {
        throw new functions.https.HttpsError('not-found', 'Wallet not found');
      }

      const walletData = walletDoc.data()!;
      const updates: any = {
        totalBalance: walletData.totalBalance + amount,
        availableBalance: walletData.availableBalance + amount,
        totalEarned: walletData.totalEarned + amount,
        bonusEarnings: walletData.bonusEarnings + amount,
        lastUpdated: admin.firestore.FieldValue.serverTimestamp(),
      };

      // Update specific earning types for bonuses
      switch (subType) {
        case 'create':
          updates.createEarnings = walletData.createEarnings + amount;
          break;
        case 'referral_signup':
          updates.referralEarnings = walletData.referralEarnings + amount;
          break;
        case 'daily_streak':
          updates.streakEarnings = walletData.streakEarnings + amount;
          break;
      }

      transaction.update(walletRef, updates);
    });

    return { success: true, transactionId: transactionRef.id };
  } catch (error) {
    console.error('Process fixed bonus error:', error);
    throw error;
  }
}); 

// OpenAI Integration
import fetch from 'node-fetch';

const OPENAI_API_KEY = functions.config().openai?.key || 'your-openai-api-key';
const OPENAI_API_URL = 'https://api.openai.com/v1/chat/completions';

// Topic categories for analysis
const TOPIC_CATEGORIES = [
  'dance', 'comedy', 'fitness', 'food', 'technology', 'music', 'art', 'travel',
  'lifestyle', 'education', 'motivation', 'entertainment', 'fashion', 'beauty',
  'sports', 'gaming', 'business', 'health', 'pets', 'nature', 'diy', 'reviews'
];

// ===== RECOMMENDATION SYSTEM FUNCTIONS =====

/**
 * Generate content embedding when a reel is uploaded
 * Trigger: onCreate for reels collection
 */
export const generateContentEmbedding = functions.firestore
  .document('reels/{reelId}')
  .onCreate(async (snap, context) => {
    const reelId = context.params.reelId;
    const reelData = snap.data();

    try {
      console.log(`Generating embedding for reel: ${reelId}`);
      
      // Generate and store content embedding
      const embedding = await recommendationEngine.generateContentEmbedding(reelId);
      
      if (embedding) {
        console.log(`Successfully generated embedding for reel: ${reelId}`);
        
        // Also update user interactions to track content creation
        await db.collection('user_interactions').add({
          userId: reelData.userId,
          reelId: reelId,
          type: 'create',
          timestamp: admin.firestore.FieldValue.serverTimestamp(),
          weight: RECOMMENDATION_CONFIG.interactionWeights.create
        });
      }
      
    } catch (error) {
      console.error(`Error generating embedding for reel ${reelId}:`, error);
    }
  });

/**
 * Track user interactions for recommendation engine
 * HTTP Callable Function
 */
export const trackUserInteraction = functions.https.onCall(async (data, context) => {
  try {
    if (!context.auth) {
      throw new functions.https.HttpsError('unauthenticated', 'Must be authenticated');
    }

    const { reelId, interactionType, duration } = data;
    const userId = context.auth.uid;

    // Validate interaction type
    const validTypes = ['view', 'like', 'comment', 'share'];
    if (!validTypes.includes(interactionType)) {
      throw new functions.https.HttpsError('invalid-argument', 'Invalid interaction type');
    }

    // Create interaction record
    const interactionData: any = {
      userId,
      reelId,
      type: interactionType,
      timestamp: admin.firestore.FieldValue.serverTimestamp(),
      weight: RECOMMENDATION_CONFIG.interactionWeights[interactionType] || 1
    };

    // Add duration for view interactions
    if (interactionType === 'view' && duration) {
      interactionData.duration = duration;
    }

    await db.collection('user_interactions').add(interactionData);

    return {
      success: true,
      message: 'Interaction tracked successfully'
    };

  } catch (error) {
    console.error('Track interaction error:', error);
    throw error;
  }
});

/**
 * Generate recommendations for a specific user
 * HTTP Callable Function
 */
export const generateUserRecommendations = functions
  .runWith({ timeoutSeconds: 540, memory: '2GB' })
  .https.onCall(async (data, context) => {
    try {
      if (!context.auth) {
        throw new functions.https.HttpsError('unauthenticated', 'Must be authenticated');
      }

      const userId = data.userId || context.auth.uid;
      const forceRefresh = data.forceRefresh || false;

      // Check if we have recent recommendations (unless forcing refresh)
      if (!forceRefresh) {
        const existingRec = await db.collection('user_recommendations').doc(userId).get();
        if (existingRec.exists) {
          const recData = existingRec.data()!;
          const now = admin.firestore.Timestamp.now();
          const ageInHours = (now.toMillis() - recData.generatedAt.toMillis()) / (60 * 60 * 1000);
          
          // Return existing recommendations if less than 6 hours old
          if (ageInHours < 6) {
            return {
              success: true,
              recommendations: recData.recommendations,
              cached: true,
              generatedAt: recData.generatedAt,
              totalCount: recData.totalCount
            };
          }
        }
      }

      // Generate new recommendations
      console.log(`Generating recommendations for user: ${userId}`);
      const recommendations = await recommendationEngine.generateUserRecommendations(userId);
      
      // Store recommendations
      await recommendationEngine.storeUserRecommendations(userId, recommendations);

      return {
        success: true,
        recommendations,
        cached: false,
        generatedAt: admin.firestore.FieldValue.serverTimestamp(),
        totalCount: recommendations.length
      };

    } catch (error) {
      console.error('Generate recommendations error:', error);
      throw new functions.https.HttpsError('internal', 'Failed to generate recommendations');
    }
  });

/**
 * Get user recommendations from cache
 * HTTP Callable Function
 */
export const getUserRecommendations = functions.https.onCall(async (data, context) => {
  try {
    if (!context.auth) {
      throw new functions.https.HttpsError('unauthenticated', 'Must be authenticated');
    }

    const userId = data.userId || context.auth.uid;
    const limit = Math.min(data.limit || 20, 100);
    const offset = data.offset || 0;

    // Get cached recommendations
    const userRecDoc = await db.collection('user_recommendations').doc(userId).get();
    
    if (!userRecDoc.exists) {
      // Generate recommendations if none exist
      const generateResult = await generateUserRecommendations.handler({ userId }, context as any);
      return generateResult;
    }

    const recData = userRecDoc.data()!;
    
    // Check if recommendations are expired (older than 24 hours)
    const now = admin.firestore.Timestamp.now();
    const ageInHours = (now.toMillis() - recData.generatedAt.toMillis()) / (60 * 60 * 1000);
    
    if (ageInHours > 24) {
      // Regenerate recommendations if expired
      const generateResult = await generateUserRecommendations.handler({ userId }, context as any);
      return generateResult;
    }

    // Return paginated recommendations
    const paginatedRecs = recData.recommendations.slice(offset, offset + limit);

    return {
      success: true,
      recommendations: paginatedRecs,
      totalCount: recData.totalCount,
      hasMore: offset + limit < recData.totalCount,
      generatedAt: recData.generatedAt,
      cached: true
    };

  } catch (error) {
    console.error('Get recommendations error:', error);
    throw new functions.https.HttpsError('internal', 'Failed to get recommendations');
  }
});

/**
 * Daily scheduled job to generate recommendations for all active users
 * Runs every day at 2:00 AM UTC
 */
export const dailyRecommendationJob = functions
  .runWith({ timeoutSeconds: 540, memory: '2GB' })
  .pubsub.schedule('0 2 * * *')
  .timeZone('UTC')
  .onRun(async (context) => {
    try {
      console.log('Starting daily recommendation generation job...');
      
      const batchSize = 50; // Process users in batches
      let processedUsers = 0;
      let totalUsers = 0;
      
      // Get all users who have interacted in the last 7 days
      const cutoffDate = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
      const activeUsersQuery = await db.collection('user_interactions')
        .where('timestamp', '>=', admin.firestore.Timestamp.fromDate(cutoffDate))
        .select('userId')
        .get();

      // Get unique user IDs
      const userIds = [...new Set(activeUsersQuery.docs.map(doc => doc.data().userId))];
      totalUsers = userIds.length;
      
      console.log(`Found ${totalUsers} active users to process`);

      // Process users in batches
      for (let i = 0; i < userIds.length; i += batchSize) {
        const batch = userIds.slice(i, i + batchSize);
        
        const batchPromises = batch.map(async (userId) => {
          try {
            const recommendations = await recommendationEngine.generateUserRecommendations(userId);
            if (recommendations.length > 0) {
              await recommendationEngine.storeUserRecommendations(userId, recommendations);
              return true;
            }
            return false;
          } catch (error) {
            console.error(`Error generating recommendations for user ${userId}:`, error);
            return false;
          }
        });

        const results = await Promise.all(batchPromises);
        const successCount = results.filter(success => success).length;
        processedUsers += successCount;
        
        console.log(`Processed batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(userIds.length / batchSize)}: ${successCount}/${batch.length} successful`);
        
        // Small delay between batches to avoid overwhelming the system
        if (i + batchSize < userIds.length) {
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
      }

      // Log job completion stats
      await db.collection('recommendation_jobs').add({
        type: 'daily_generation',
        startTime: admin.firestore.Timestamp.fromDate(new Date(context.timestamp)),
        endTime: admin.firestore.FieldValue.serverTimestamp(),
        totalUsers,
        processedUsers,
        successRate: totalUsers > 0 ? (processedUsers / totalUsers) * 100 : 0,
        status: 'completed'
      });

      console.log(`Daily recommendation job completed. Processed ${processedUsers}/${totalUsers} users successfully.`);
      return null;

    } catch (error) {
      console.error('Daily recommendation job error:', error);
      
      // Log failed job
      await db.collection('recommendation_jobs').add({
        type: 'daily_generation',
        startTime: admin.firestore.Timestamp.fromDate(new Date(context.timestamp)),
        endTime: admin.firestore.FieldValue.serverTimestamp(),
        error: error instanceof Error ? error.message : 'Unknown error',
        status: 'failed'
      });
      
      throw error;
    }
  });

/**
 * Regenerate embeddings for existing content (maintenance function)
 * HTTP Callable Function
 */
export const regenerateContentEmbeddings = functions
  .runWith({ timeoutSeconds: 540, memory: '2GB' })
  .https.onCall(async (data, context) => {
    try {
      // Check admin authentication
      if (!context.auth || !context.auth.token.admin) {
        throw new functions.https.HttpsError('permission-denied', 'Admin access required');
      }

      const limit = data.limit || 100;
      const startAfter = data.startAfter || null;

      let query = db.collection('reels')
        .where('isActive', '==', true)
        .orderBy('createdAt', 'desc')
        .limit(limit);

      if (startAfter) {
        query = query.startAfter(startAfter);
      }

      const reelsSnapshot = await query.get();
      let processed = 0;
      let errors = 0;

      for (const doc of reelsSnapshot.docs) {
        try {
          await recommendationEngine.generateContentEmbedding(doc.id);
          processed++;
        } catch (error) {
          console.error(`Error generating embedding for reel ${doc.id}:`, error);
          errors++;
        }
      }

      return {
        success: true,
        processed,
        errors,
        hasMore: reelsSnapshot.docs.length === limit,
        lastDocument: reelsSnapshot.docs.length > 0 ? reelsSnapshot.docs[reelsSnapshot.docs.length - 1].id : null
      };

    } catch (error) {
      console.error('Regenerate embeddings error:', error);
      throw error;
    }
  });

/**
 * Get recommendation analytics for admin dashboard
 * HTTP Callable Function
 */
export const getRecommendationAnalytics = functions.https.onCall(async (data, context) => {
  try {
    if (!context.auth || !context.auth.token.admin) {
      throw new functions.https.HttpsError('permission-denied', 'Admin access required');
    }

    const { startDate, endDate } = data;

    // Get recommendation job statistics
    let jobQuery = db.collection('recommendation_jobs')
      .orderBy('startTime', 'desc')
      .limit(30); // Last 30 jobs

    if (startDate) {
      jobQuery = jobQuery.where('startTime', '>=', new Date(startDate));
    }
    if (endDate) {
      jobQuery = jobQuery.where('startTime', '<=', new Date(endDate));
    }

    const jobsSnapshot = await jobQuery.get();
    const jobs = jobsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

    // Get recommendation statistics
    const recommendationsSnapshot = await db.collection('user_recommendations').get();
    const totalRecommendations = recommendationsSnapshot.size;

    // Calculate average scores
    let totalScore = 0;
    let totalRecommendationCount = 0;

    recommendationsSnapshot.docs.forEach(doc => {
      const data = doc.data();
      if (data.averageScore) {
        totalScore += data.averageScore * data.totalCount;
        totalRecommendationCount += data.totalCount;
      }
    });

    const averageScore = totalRecommendationCount > 0 ? totalScore / totalRecommendationCount : 0;

    // Get content embedding statistics
    const embeddingsSnapshot = await db.collection('content_embeddings').get();
    const totalEmbeddings = embeddingsSnapshot.size;

    const analytics = {
      totalUsers: totalRecommendations,
      totalContentEmbeddings: totalEmbeddings,
      averageRecommendationScore: averageScore,
      recentJobs: jobs,
      lastJobDate: jobs.length > 0 ? jobs[0].startTime : null,
      systemHealth: {
        embeddingCoverage: totalEmbeddings > 0 ? 'Good' : 'Poor',
        recommendationFreshness: jobs.length > 0 && jobs[0].status === 'completed' ? 'Good' : 'Poor'
      }
    };

    return {
      success: true,
      data: analytics,
      message: 'Analytics retrieved successfully'
    };

  } catch (error) {
    console.error('Recommendation analytics error:', error);
    throw new functions.https.HttpsError('internal', 'Failed to get analytics');
  }
});

// ===== EXISTING FUNCTIONS (keeping all previous functions) =====

// Process video analysis with AI
export const processVideoAnalysis = functions.https.onCall(async (data, context) => {
  try {
    if (!context.auth) {
      throw new functions.https.HttpsError('unauthenticated', 'Must be authenticated');
    }

    const { videoUrl, caption, userId, duration } = data;

    // Analyze caption with OpenAI
    const analysisResult = await analyzeWithOpenAI(caption);
    
    // Update user interests based on content
    if (analysisResult.success && analysisResult.data.primaryTopics) {
      await updateUserInterestsFromContent(userId, analysisResult.data.primaryTopics);
    }

    // Generate video embedding for recommendations
    const embedding = await generateContentEmbedding(caption, analysisResult.data?.keywords || []);

    return {
      success: true,
      analysis: analysisResult.data,
      embedding,
      message: 'Video analysis completed successfully'
    };

  } catch (error) {
    console.error('Video analysis error:', error);
    throw new functions.https.HttpsError('internal', 'Video analysis failed');
  }
});

// Analyze caption with OpenAI
async function analyzeWithOpenAI(caption: string) {
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

    const responseData = await response.json();
    const analysis = JSON.parse(responseData.choices[0].message.content);

    return {
      success: true,
      data: analysis
    };

  } catch (error) {
    console.error('OpenAI analysis error:', error);
    
    // Fallback to local analysis
    return localAnalysis(caption);
  }
}

// Local analysis fallback
function localAnalysis(caption: string) {
  const lowerCaption = caption.toLowerCase();
  const words = lowerCaption.split(/\s+/);
  
  // Extract hashtags
  const hashtags = caption.match(/#[\w]+/g) || [];
  const cleanHashtags = hashtags.map(tag => tag.substring(1).toLowerCase());

  // Simple topic detection based on keywords
  const keywordMap: { [key: string]: string[] } = {
    dance: ['dance', 'choreography', 'music', 'moves', 'rhythm'],
    comedy: ['funny', 'laugh', 'joke', 'humor', 'hilarious'],
    fitness: ['workout', 'exercise', 'gym', 'fitness', 'health'],
    food: ['recipe', 'cooking', 'food', 'chef', 'delicious'],
    technology: ['tech', 'phone', 'app', 'computer', 'digital'],
    // Add more mappings...
  };

  const topics: string[] = [];
  Object.entries(keywordMap).forEach(([topic, keywords]) => {
    const matches = keywords.filter(keyword => lowerCaption.includes(keyword));
    if (matches.length > 0) {
      topics.push(topic);
    }
  });

  // Determine sentiment
  const positiveWords = ['amazing', 'awesome', 'great', 'love', 'beautiful'];
  const negativeWords = ['hate', 'terrible', 'awful', 'worst', 'bad'];
  
  const positiveCount = positiveWords.filter(word => lowerCaption.includes(word)).length;
  const negativeCount = negativeWords.filter(word => lowerCaption.includes(word)).length;
  
  let sentiment = 'neutral';
  if (positiveCount > negativeCount) sentiment = 'positive';
  else if (negativeCount > positiveCount) sentiment = 'negative';

  const analysis = {
    primaryTopics: topics.slice(0, 3),
    secondaryTopics: topics.slice(3, 8),
    hashtags: cleanHashtags,
    sentiment,
    confidence: Math.min(0.8, 0.4 + (topics.length * 0.1)),
    keywords: words.filter(word => word.length > 3).slice(0, 10)
  };

  return {
    success: true,
    data: analysis
  };
}

// Update user interests based on content interaction
export const updateUserInterests = functions.https.onCall(async (data, context) => {
  try {
    if (!context.auth) {
      throw new functions.https.HttpsError('unauthenticated', 'Must be authenticated');
    }

    const { userId, contentTopics, interactionType, timestamp } = data;
    
    // Weight different interaction types
    const interactionWeights = {
      view: 1,
      like: 3,
      comment: 4,
      share: 5
    };

    const weight = interactionWeights[interactionType as keyof typeof interactionWeights] || 1;

    // Update user interest document
    const userInterestRef = db.collection('user_interests').doc(userId);
    const userInterestDoc = await userInterestRef.get();

    let interestData: any;
    if (userInterestDoc.exists) {
      interestData = userInterestDoc.data();
    } else {
      interestData = {
        userId,
        categories: {},
        hashtags: {},
        creators: {},
        lastUpdated: admin.firestore.FieldValue.serverTimestamp()
      };
    }

    // Update category scores
    contentTopics.forEach((topic: string) => {
      if (!interestData.categories[topic]) {
        interestData.categories[topic] = 0;
      }
      interestData.categories[topic] += weight;
    });

    // Update timestamp
    interestData.lastUpdated = admin.firestore.FieldValue.serverTimestamp();

    await userInterestRef.set(interestData, { merge: true });

    return {
      success: true,
      message: 'User interests updated successfully'
    };

  } catch (error) {
    console.error('Update interests error:', error);
    throw new functions.https.HttpsError('internal', 'Failed to update user interests');
  }
});

// Update user interests from content creation
async function updateUserInterestsFromContent(userId: string, topics: string[]) {
  try {
    const userInterestRef = db.collection('user_interests').doc(userId);
    const userInterestDoc = await userInterestRef.get();

    let interestData: any;
    if (userInterestDoc.exists) {
      interestData = userInterestDoc.data();
    } else {
      interestData = {
        userId,
        categories: {},
        hashtags: {},
        creators: {},
        lastUpdated: admin.firestore.FieldValue.serverTimestamp()
      };
    }

    // Higher weight for created content (shows strong interest)
    const creationWeight = 10;

    topics.forEach((topic: string) => {
      if (!interestData.categories[topic]) {
        interestData.categories[topic] = 0;
      }
      interestData.categories[topic] += creationWeight;
    });

    interestData.lastUpdated = admin.firestore.FieldValue.serverTimestamp();
    await userInterestRef.set(interestData, { merge: true });

  } catch (error) {
    console.error('Error updating interests from content:', error);
  }
}

// Generate content embedding for recommendations
async function generateContentEmbedding(caption: string, keywords: string[]): Promise<number[]> {
  try {
    // Simple embedding based on topic vectors
    // In production, you might use OpenAI embeddings or TensorFlow
    const embedding = new Array(100).fill(0);
    
    // Generate basic vector representation
    const text = (caption + ' ' + keywords.join(' ')).toLowerCase();
    const chars = text.split('');
    
    chars.forEach((char, index) => {
      const charCode = char.charCodeAt(0);
      const embeddingIndex = charCode % 100;
      embedding[embeddingIndex] += 1;
    });

    // Normalize the embedding
    const magnitude = Math.sqrt(embedding.reduce((sum, val) => sum + val * val, 0));
    return embedding.map(val => magnitude > 0 ? val / magnitude : 0);

  } catch (error) {
    console.error('Embedding generation error:', error);
    return new Array(100).fill(0);
  }
}

// Get content recommendations based on user interests
export const getContentRecommendations = functions.https.onCall(async (data, context) => {
  try {
    if (!context.auth) {
      throw new functions.https.HttpsError('unauthenticated', 'Must be authenticated');
    }

    const { userId, limit = 10 } = data;

    // Get user interests
    const userInterestDoc = await db.collection('user_interests').doc(userId).get();
    if (!userInterestDoc.exists) {
      // Return trending content for new users
      return getTrendingContent(limit);
    }

    const userInterests = userInterestDoc.data();
    const topCategories = Object.entries(userInterests?.categories || {})
      .sort(([,a]: any, [,b]: any) => b - a)
      .slice(0, 5)
      .map(([category]) => category);

    if (topCategories.length === 0) {
      return getTrendingContent(limit);
    }

    // Query reels that match user interests
    const reelsQuery = db.collection('reels')
      .where('isActive', '==', true)
      .where('category', 'in', topCategories)
      .orderBy('createdAt', 'desc')
      .limit(limit * 2); // Get more to filter and rank

    const querySnapshot = await reelsQuery.get();
    const reels = querySnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));

    // Calculate relevance scores and sort
    const rankedReels = reels.map((reel: any) => {
      let score = 0;
      
      // Category match score
      if (userInterests.categories[reel.category]) {
        score += userInterests.categories[reel.category] * 0.4;
      }

      // Engagement score (likes, comments, shares)
      const engagementScore = (reel.likes + reel.comments * 2 + reel.shares * 3) / (reel.views + 1);
      score += engagementScore * 0.3;

      // Recency score
      const ageInDays = (Date.now() - reel.createdAt.toMillis()) / (1000 * 60 * 60 * 24);
      const recencyScore = Math.max(0, 1 - (ageInDays / 7)); // Decay over 7 days
      score += recencyScore * 0.3;

      return { ...reel, relevanceScore: score };
    });

    // Sort by relevance and return top results
    const recommendations = rankedReels
      .sort((a, b) => b.relevanceScore - a.relevanceScore)
      .slice(0, limit);

    return {
      success: true,
      data: recommendations,
      message: 'Recommendations generated successfully'
    };

  } catch (error) {
    console.error('Recommendations error:', error);
    throw new functions.https.HttpsError('internal', 'Failed to get recommendations');
  }
});

// Get trending content for new users
async function getTrendingContent(limit: number) {
  try {
    const trendingQuery = db.collection('reels')
      .where('isActive', '==', true)
      .orderBy('likes', 'desc')
      .limit(limit);

    const querySnapshot = await trendingQuery.get();
    const trending = querySnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));

    return {
      success: true,
      data: trending,
      message: 'Trending content retrieved'
    };

  } catch (error) {
    console.error('Trending content error:', error);
    return {
      success: false,
      data: [],
      error: 'Failed to get trending content'
    };
  }
}

// Process ad revenue with dynamic sharing (from previous implementation)
export const processAdRevenue = functions.https.onCall(async (data, context) => {
  try {
    if (!context.auth) {
      throw new functions.https.HttpsError('unauthenticated', 'Must be authenticated');
    }

    const { reelId, viewerId, adProvider, adType, revenue, cpm, viewDuration } = data;

    // Get reel data
    const reelDoc = await db.collection('reels').doc(reelId).get();
    if (!reelDoc.exists) {
      throw new functions.https.HttpsError('not-found', 'Reel not found');
    }

    const reelData = reelDoc.data()!;
    const creatorId = reelData.userId;

    // Check if view qualifies for revenue sharing (minimum 30 seconds)
    const isValidView = viewDuration >= 30;

    if (!isValidView) {
      console.log('View too short for revenue sharing:', viewDuration);
      return {
        success: true,
        message: 'View too short for revenue sharing'
      };
    }

    // Create ad revenue event
    const adRevenueEventData = {
      reelId,
      viewerId,
      creatorId,
      adProvider,
      adType,
      revenue,
      cpm,
      viewDuration,
      isValidView,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    };

    const adRevenueEventRef = await db.collection('ad_revenue_events').add(adRevenueEventData);

    // Calculate revenue shares
    const creatorShare = revenue * 0.6; // 60%
    const viewerShare = revenue * 0.2; // 20%
    const appShare = revenue * 0.2; // 20%

    // Create revenue distribution record
    const distributionData = {
      adRevenueEventId: adRevenueEventRef.id,
      reelId,
      totalRevenue: revenue,
      distributions: {
        creator: {
          userId: creatorId,
          amount: creatorShare,
          percentage: 60,
        },
        viewer: {
          userId: viewerId,
          amount: viewerShare,
          percentage: 20,
        },
        app: {
          amount: appShare,
          percentage: 20,
        },
      },
      status: 'pending',
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    };

    const distributionRef = await db.collection('revenue_distributions').add(distributionData);

    // Update user wallets in a transaction
    await db.runTransaction(async (transaction) => {
      // Update creator wallet
      const creatorWalletRef = db.collection('wallets').doc(creatorId);
      const creatorWalletDoc = await transaction.get(creatorWalletRef);
      
      if (creatorWalletDoc.exists) {
        const creatorWalletData = creatorWalletDoc.data()!;
        transaction.update(creatorWalletRef, {
          totalBalance: creatorWalletData.totalBalance + creatorShare,
          availableBalance: creatorWalletData.availableBalance + creatorShare,
          totalEarned: creatorWalletData.totalEarned + creatorShare,
          adEarnings: creatorWalletData.adEarnings + creatorShare,
          createEarnings: creatorWalletData.createEarnings + creatorShare,
          lastUpdated: admin.firestore.FieldValue.serverTimestamp(),
        });
      }

      // Update viewer wallet
      const viewerWalletRef = db.collection('wallets').doc(viewerId);
      const viewerWalletDoc = await transaction.get(viewerWalletRef);
      
      if (viewerWalletDoc.exists) {
        const viewerWalletData = viewerWalletDoc.data()!;
        transaction.update(viewerWalletRef, {
          totalBalance: viewerWalletData.totalBalance + viewerShare,
          availableBalance: viewerWalletData.availableBalance + viewerShare,
          totalEarned: viewerWalletData.totalEarned + viewerShare,
          adEarnings: viewerWalletData.adEarnings + viewerShare,
          watchEarnings: viewerWalletData.watchEarnings + viewerShare,
          lastUpdated: admin.firestore.FieldValue.serverTimestamp(),
        });
      }

      // Mark distribution as completed
      transaction.update(distributionRef, {
        status: 'completed',
        processedAt: admin.firestore.FieldValue.serverTimestamp(),
      });

      transaction.update(adRevenueEventRef, {
        distributedAt: admin.firestore.FieldValue.serverTimestamp(),
      });
    });

    // Create wallet transactions
    const batch = db.batch();

    const creatorTransactionRef = db.collection('wallet_transactions').doc();
    batch.set(creatorTransactionRef, {
      userId: creatorId,
      type: 'earning',
      subType: 'ad_revenue',
      amount: creatorShare,
      description: `Ad revenue share from reel view (60%)`,
      reelId,
      status: 'completed',
      adRevenue: {
        totalAdRevenue: revenue,
        creatorShare,
        viewerShare,
        appShare,
        adProvider,
        cpm,
      },
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    const viewerTransactionRef = db.collection('wallet_transactions').doc();
    batch.set(viewerTransactionRef, {
      userId: viewerId,
      type: 'earning',
      subType: 'ad_revenue',
      amount: viewerShare,
      description: `Ad revenue share for watching reel (20%)`,
      reelId,
      status: 'completed',
      adRevenue: {
        totalAdRevenue: revenue,
        creatorShare,
        viewerShare,
        appShare,
        adProvider,
        cpm,
      },
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    await batch.commit();

    return {
      success: true,
      distributionId: distributionRef.id,
      revenue: {
        total: revenue,
        creator: creatorShare,
        viewer: viewerShare,
        app: appShare,
      },
    };

  } catch (error) {
    console.error('Process ad revenue error:', error);
    throw error;
  }
});

// Process fixed bonus rewards
export const processFixedBonus = functions.https.onCall(async (data, context) => {
  try {
    if (!context.auth) {
      throw new functions.https.HttpsError('unauthenticated', 'Must be authenticated');
    }

    const { userId, type, subType, amount, description, reelId, referralUserId } = data;

    // Validate bonus amount based on type
    const bonusLimits: { [key: string]: number } = {
      create: 2, // ₹2 per reel created
      referral_signup: 10, // ₹10 per referral
      daily_streak: 1, // ₹1 per day streak
      like_bonus: 0.05, // ₹0.05 per like received
      share_bonus: 0.25, // ₹0.25 per share
    };

    const maxAmount = bonusLimits[subType as keyof typeof bonusLimits];
    if (amount > maxAmount) {
      throw new functions.https.HttpsError('invalid-argument', `Amount exceeds maximum for ${subType}`);
    }

    // Update user wallet in transaction
    await db.runTransaction(async (transaction) => {
      const walletRef = db.collection('wallets').doc(userId);
      const walletDoc = await transaction.get(walletRef);

      if (!walletDoc.exists) {
        throw new functions.https.HttpsError('not-found', 'User wallet not found');
      }

      const walletData = walletDoc.data()!;

      // Update wallet balance
      const updates: any = {
        totalBalance: walletData.totalBalance + amount,
        availableBalance: walletData.availableBalance + amount,
        totalEarned: walletData.totalEarned + amount,
        bonusEarnings: walletData.bonusEarnings + amount,
        lastUpdated: admin.firestore.FieldValue.serverTimestamp(),
      };

      // Update specific earning categories
      switch (subType) {
        case 'create':
          updates.createEarnings = walletData.createEarnings + amount;
          break;
        case 'referral_signup':
          updates.referralEarnings = walletData.referralEarnings + amount;
          break;
        case 'daily_streak':
          updates.streakEarnings = walletData.streakEarnings + amount;
          break;
      }

      transaction.update(walletRef, updates);

      // Create transaction record
      const transactionRef = db.collection('wallet_transactions').doc();
      transaction.set(transactionRef, {
        userId,
        type,
        subType,
        amount,
        description,
        reelId: reelId || null,
        referralUserId: referralUserId || null,
        status: 'completed',
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        processedAt: admin.firestore.FieldValue.serverTimestamp(),
      });
    });

    return {
      success: true,
      message: 'Fixed bonus processed successfully',
      amount,
      type: subType
    };

  } catch (error) {
    console.error('Process fixed bonus error:', error);
    throw error;
  }
});

// ===== MAINTENANCE AND CLEANUP FUNCTIONS =====

// Scheduled function to update trending content (runs daily)
export const updateTrendingContent = functions.pubsub.schedule('every 24 hours').onRun(async (context) => {
  try {
    const now = admin.firestore.Timestamp.now();
    const oneDayAgo = admin.firestore.Timestamp.fromMillis(now.toMillis() - 24 * 60 * 60 * 1000);
    const oneWeekAgo = admin.firestore.Timestamp.fromMillis(now.toMillis() - 7 * 24 * 60 * 60 * 1000);

    // Get reels from the last week
    const reelsQuery = db.collection('reels')
      .where('isActive', '==', true)
      .where('createdAt', '>=', oneWeekAgo)
      .orderBy('createdAt', 'desc');

    const querySnapshot = await reelsQuery.get();
    const reels = querySnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));

    // Calculate trending scores
    const trendingReels = reels.map((reel: any) => {
      // Engagement rate
      const engagementRate = (reel.likes + reel.comments * 2 + reel.shares * 3) / Math.max(reel.views, 1);
      
      // Recency bonus (newer content gets higher score)
      const ageInHours = (now.toMillis() - reel.createdAt.toMillis()) / (1000 * 60 * 60);
      const recencyBonus = Math.max(0, 1 - (ageInHours / 168)); // Decay over 1 week
      
      // Velocity (engagement per hour)
      const velocity = (reel.likes + reel.comments + reel.shares) / Math.max(ageInHours, 1);
      
      const trendingScore = (engagementRate * 0.4) + (recencyBonus * 0.3) + (velocity * 0.3);
      
      return {
        ...reel,
        trendingScore,
        lastTrendingUpdate: now
      };
    });

    // Sort by trending score and get top 100
    const topTrending = trendingReels
      .sort((a, b) => b.trendingScore - a.trendingScore)
      .slice(0, 100);

    // Update trending collection
    const batch = db.batch();
    
    // Clear existing trending
    const existingTrendingQuery = await db.collection('trending_reels').get();
    existingTrendingQuery.docs.forEach(doc => {
      batch.delete(doc.ref);
    });

    // Add new trending reels
    topTrending.forEach((reel, index) => {
      const trendingRef = db.collection('trending_reels').doc(reel.id);
      batch.set(trendingRef, {
        reelId: reel.id,
        rank: index + 1,
        trendingScore: reel.trendingScore,
        category: reel.category,
        createdAt: reel.createdAt,
        updatedAt: now
      });
    });

    await batch.commit();

    console.log(`Updated trending content with ${topTrending.length} reels`);
    return null;

  } catch (error) {
    console.error('Trending update error:', error);
    throw error;
  }
});

// Clean up old data (runs weekly)
export const cleanupOldData = functions.pubsub.schedule('every 7 days').onRun(async (context) => {
  try {
    const now = admin.firestore.Timestamp.now();
    const oneMonthAgo = admin.firestore.Timestamp.fromMillis(now.toMillis() - 30 * 24 * 60 * 60 * 1000);

    // Clean up old ad revenue events
    const oldEventsQuery = db.collection('ad_revenue_events')
      .where('createdAt', '<', oneMonthAgo)
      .limit(500);

    const batch = db.batch();
    const oldEventsSnapshot = await oldEventsQuery.get();
    
    oldEventsSnapshot.docs.forEach(doc => {
      batch.delete(doc.ref);
    });

    // Clean up old user interactions (keep only last 60 days)
    const sixtyDaysAgo = admin.firestore.Timestamp.fromMillis(now.toMillis() - 60 * 24 * 60 * 60 * 1000);
    const oldInteractionsQuery = db.collection('user_interactions')
      .where('timestamp', '<', sixtyDaysAgo)
      .limit(1000);

    const oldInteractionsSnapshot = await oldInteractionsQuery.get();
    oldInteractionsSnapshot.docs.forEach(doc => {
      batch.delete(doc.ref);
    });

    // Clean up expired recommendations (older than 7 days)
    const sevenDaysAgo = admin.firestore.Timestamp.fromMillis(now.toMillis() - 7 * 24 * 60 * 60 * 1000);
    const oldRecommendationsQuery = db.collection('user_recommendations')
      .where('generatedAt', '<', sevenDaysAgo)
      .limit(500);

    const oldRecommendationsSnapshot = await oldRecommendationsQuery.get();
    oldRecommendationsSnapshot.docs.forEach(doc => {
      batch.delete(doc.ref);
    });

    // Clean up old referral earnings (keep only last 2 years)
    const twoYearsAgo = admin.firestore.Timestamp.fromMillis(now.toMillis() - 2 * 365 * 24 * 60 * 60 * 1000);
    const oldReferralEarningsQuery = db.collection('referral_earnings')
      .where('date', '<', twoYearsAgo)
      .limit(1000);

    const oldReferralEarningsSnapshot = await oldReferralEarningsQuery.get();
    oldReferralEarningsSnapshot.docs.forEach(doc => {
      batch.delete(doc.ref);
    });

    await batch.commit();

    console.log(`Cleaned up ${oldEventsSnapshot.docs.length} old ad revenue events, ${oldInteractionsSnapshot.docs.length} old interactions, ${oldRecommendationsSnapshot.docs.length} old recommendations, and ${oldReferralEarningsSnapshot.docs.length} old referral earnings`);
    return null;

  } catch (error) {
    console.error('Cleanup error:', error);
    throw error;
  }
});

// ===== REFERRAL SYSTEM FUNCTIONS =====

/**
 * Generate referral code for user
 * HTTP Callable Function
 */
export const generateReferralCode = functions.https.onCall(async (data, context) => {
  try {
    if (!context.auth) {
      throw new functions.https.HttpsError('unauthenticated', 'Must be authenticated');
    }

    const { customCode } = data;
    const userId = context.auth.uid;

    const result = await referralSystem.generateReferralCode(userId, customCode);

    return {
      success: result.success,
      code: result.code,
      message: result.message,
      shareLink: result.code ? referralSystem.generateReferralLink(result.code) : null
    };

  } catch (error) {
    console.error('Generate referral code error:', error);
    throw new functions.https.HttpsError('internal', 'Failed to generate referral code');
  }
});

/**
 * Apply referral code during user signup
 * HTTP Callable Function
 */
export const applyReferralCode = functions.https.onCall(async (data, context) => {
  try {
    if (!context.auth) {
      throw new functions.https.HttpsError('unauthenticated', 'Must be authenticated');
    }

    const { referralCode, userEmail } = data;
    const userId = context.auth.uid;

    if (!referralCode) {
      throw new functions.https.HttpsError('invalid-argument', 'Referral code is required');
    }

    const result = await referralSystem.applyReferralCode(userId, referralCode, userEmail);

    return {
      success: result.success,
      referrerId: result.referrerId,
      bonusAwarded: result.bonusAwarded,
      message: result.message
    };

  } catch (error) {
    console.error('Apply referral code error:', error);
    throw new functions.https.HttpsError('internal', 'Failed to apply referral code');
  }
});

/**
 * Get referral analytics for user
 * HTTP Callable Function
 */
export const getReferralAnalytics = functions.https.onCall(async (data, context) => {
  try {
    if (!context.auth) {
      throw new functions.https.HttpsError('unauthenticated', 'Must be authenticated');
    }

    const userId = data.userId || context.auth.uid;

    // Check if user is requesting their own analytics or has admin privileges
    if (userId !== context.auth.uid && !context.auth.token?.admin) {
      throw new functions.https.HttpsError('permission-denied', 'Can only access own referral analytics');
    }

    const result = await referralSystem.getReferralAnalytics(userId);

    return {
      success: result.success,
      data: result.data,
      message: result.message
    };

  } catch (error) {
    console.error('Get referral analytics error:', error);
    throw new functions.https.HttpsError('internal', 'Failed to get referral analytics');
  }
});

/**
 * Get referral leaderboard
 * HTTP Callable Function
 */
export const getReferralLeaderboard = functions.https.onCall(async (data, context) => {
  try {
    const { limit = 10 } = data;

    const result = await referralSystem.getReferralLeaderboard(limit);

    return {
      success: result.success,
      data: result.data,
      message: result.message
    };

  } catch (error) {
    console.error('Get referral leaderboard error:', error);
    throw new functions.https.HttpsError('internal', 'Failed to get referral leaderboard');
  }
});

/**
 * Generate shareable referral content
 * HTTP Callable Function
 */
export const generateReferralShare = functions.https.onCall(async (data, context) => {
  try {
    if (!context.auth) {
      throw new functions.https.HttpsError('unauthenticated', 'Must be authenticated');
    }

    const { referralCode, customMessage } = data;
    const userId = context.auth.uid;

    if (!referralCode) {
      throw new functions.https.HttpsError('invalid-argument', 'Referral code is required');
    }

    // Get user info for personalized message
    const userDoc = await db.collection('users').doc(userId).get();
    const user = userDoc.exists ? userDoc.data() : null;
    const username = user?.username || 'A friend';

    const shareLink = referralSystem.generateReferralLink(referralCode);
    const shareMessage = referralSystem.generateShareMessage(referralCode, username, customMessage);

    // Generate QR code for easy sharing (simplified version)
    const qrCodeData = `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(shareLink)}`;

    return {
      success: true,
      data: {
        shareLink,
        shareMessage,
        qrCodeUrl: qrCodeData,
        socialMedia: {
          whatsapp: `https://wa.me/?text=${encodeURIComponent(shareMessage)}`,
          telegram: `https://t.me/share/url?url=${encodeURIComponent(shareLink)}&text=${encodeURIComponent('Join me on ReelShare!')}`,
          facebook: `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(shareLink)}`,
          twitter: `https://twitter.com/intent/tweet?text=${encodeURIComponent('Join me on ReelShare!')}&url=${encodeURIComponent(shareLink)}`
        }
      },
      message: 'Referral share content generated successfully'
    };

  } catch (error) {
    console.error('Generate referral share error:', error);
    throw new functions.https.HttpsError('internal', 'Failed to generate referral share');
  }
});

/**
 * Auto-process referral bonuses when user earns ad revenue
 * Trigger: onCreate for wallet_transactions with ad_revenue subtype
 */
export const processReferralBonus = functions.firestore
  .document('wallet_transactions/{transactionId}')
  .onCreate(async (snap, context) => {
    const transactionId = context.params.transactionId;
    const transactionData = snap.data();

    try {
      // Only process referral bonuses for ad revenue earnings
      if (transactionData.type !== 'earning' || transactionData.subType !== 'ad_revenue') {
        return;
      }

      console.log(`Processing referral bonus for transaction: ${transactionId}`);

      const result = await referralSystem.processReferralRevenue(
        transactionData.userId,
        transactionData.amount,
        transactionId,
        transactionData.reelId
      );

      if (result.success && result.referralBonus) {
        console.log(`✅ Referral bonus processed: ₹${result.referralBonus} awarded to ${result.referrerId}`);
        
        // Update the original transaction with referral info
        await snap.ref.update({
          referralProcessed: true,
          referralBonus: result.referralBonus,
          referrerId: result.referrerId
        });
      } else {
        console.log(`ℹ️ No referral bonus: ${result.message}`);
      }

    } catch (error) {
      console.error(`Error processing referral bonus for transaction ${transactionId}:`, error);
      
      // Update transaction with error status
      await snap.ref.update({
        referralProcessed: false,
        referralError: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

/**
 * Manual ad revenue processing function (HTTP Callable)
 * For processing views that failed auto-processing or manual triggers
 */
export const processAdRevenueManually = functions.https.onCall(async (data, context) => {
  try {
    if (!context.auth) {
      throw new functions.https.HttpsError('unauthenticated', 'Must be authenticated');
    }

    const { viewId, reelId, userId, creatorId, viewDuration, videoDuration, adData, userLocation } = data;

    // Validate required fields
    if (!viewId || !reelId || !userId || !creatorId || !adData) {
      throw new functions.https.HttpsError('invalid-argument', 'Missing required fields');
    }

    const adViewData = {
      reelId,
      userId,
      creatorId,
      viewDuration: viewDuration || 0,
      videoDuration: videoDuration || 30,
      adData,
      timestamp: admin.firestore.Timestamp.now(),
      viewQuality: 0.8, // Default quality
      userLocation: userLocation || 'IN'
    };

    const result = await adRevenueProcessor.processReelViewRevenue(adViewData);

    return {
      success: result.success,
      message: result.message,
      distribution: result.distribution,
      transactionIds: result.transactionIds
    };

  } catch (error) {
    console.error('Manual ad revenue processing error:', error);
    throw error;
  }
});

/**
 * Get ad revenue analytics (HTTP Callable)
 */
export const getAdRevenueAnalytics = functions.https.onCall(async (data, context) => {
  try {
    if (!context.auth) {
      throw new functions.https.HttpsError('unauthenticated', 'Must be authenticated');
    }

    const { userId, startDate, endDate } = data;
    
    const startDateObj = startDate ? new Date(startDate) : undefined;
    const endDateObj = endDate ? new Date(endDate) : undefined;

    const stats = await adRevenueProcessor.getRevenueStats(userId, startDateObj, endDateObj);

    return {
      success: true,
      data: stats,
      message: 'Analytics retrieved successfully'
    };

  } catch (error) {
    console.error('Get ad revenue analytics error:', error);
    throw new functions.https.HttpsError('internal', 'Failed to get analytics');
  }
});

/**
 * Batch process failed ad revenue views (Admin only)
 */
export const batchProcessFailedAdRevenue = functions
  .runWith({ timeoutSeconds: 540, memory: '1GB' })
  .https.onCall(async (data, context) => {
    try {
      // Check admin authentication
      if (!context.auth || !context.auth.token.admin) {
        throw new functions.https.HttpsError('permission-denied', 'Admin access required');
      }

      const { limit = 100, retryFailed = false } = data;

      // Find views with ads that haven't been processed or failed processing
      let query = db.collection('reel_views')
        .where('adData', '!=', null)
        .limit(limit);

      if (retryFailed) {
        query = query.where('adRevenueProcessed', '==', false);
      } else {
        query = query.where('adRevenueProcessed', '==', null);
      }

      const viewsSnapshot = await query.get();
      let processed = 0;
      let failed = 0;

      for (const viewDoc of viewsSnapshot.docs) {
        try {
          const viewData = viewDoc.data();
          
          // Get reel data
          const reelDoc = await db.collection('reels').doc(viewData.reelId).get();
          if (!reelDoc.exists) {
            failed++;
            continue;
          }

          const reelInfo = reelDoc.data()!;

          const adViewData = {
            reelId: viewData.reelId,
            userId: viewData.userId,
            creatorId: reelInfo.userId,
            viewDuration: viewData.duration || 0,
            videoDuration: reelInfo.duration || 30,
            adData: viewData.adData,
            timestamp: viewData.timestamp || admin.firestore.Timestamp.now(),
            viewQuality: calculateViewQuality(viewData),
            userLocation: viewData.userLocation || 'IN'
          };

          const result = await adRevenueProcessor.processReelViewRevenue(adViewData);

          if (result.success) {
            await viewDoc.ref.update({
              adRevenueProcessed: true,
              adRevenueProcessedAt: admin.firestore.FieldValue.serverTimestamp(),
              adRevenueDistribution: result.distribution,
              adRevenueTransactionIds: result.transactionIds
            });
            processed++;
          } else {
            await viewDoc.ref.update({
              adRevenueProcessed: false,
              adRevenueProcessedAt: admin.firestore.FieldValue.serverTimestamp(),
              adRevenueError: result.message
            });
            failed++;
          }

        } catch (error) {
          console.error(`Error processing view ${viewDoc.id}:`, error);
          failed++;
        }
      }

      return {
        success: true,
        processed,
        failed,
        total: viewsSnapshot.docs.length,
        message: `Processed ${processed}/${viewsSnapshot.docs.length} views successfully`
      };

    } catch (error) {
      console.error('Batch process failed ad revenue error:', error);
      throw error;
    }
  });

/**
 * Calculate view quality score based on engagement and completion
 */
function calculateViewQuality(viewData: any): number {
  let quality = 0.5; // Base quality

  // Duration factor (longer views = higher quality)
  if (viewData.duration && viewData.videoDuration) {
    const completionRate = viewData.duration / viewData.videoDuration;
    quality += completionRate * 0.3;
  }

  // Engagement factor
  if (viewData.liked) quality += 0.1;
  if (viewData.commented) quality += 0.1;
  if (viewData.shared) quality += 0.2;

  // User engagement history (if available)
  if (viewData.userEngagementScore) {
    quality += viewData.userEngagementScore * 0.2;
  }

  return Math.min(1.0, Math.max(0.1, quality));
} 