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