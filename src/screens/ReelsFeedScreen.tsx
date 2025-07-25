import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  StyleSheet,
  FlatList,
  Dimensions,
  StatusBar,
  Alert,
  ActivityIndicator,
  Text,
  RefreshControl,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { SafeAreaView } from 'react-native-safe-area-context';

// Components
import ReelCard from '../components/ReelCard';

// Data and Services
import { sampleReels, sampleUsers, getUserById, getRandomReels, simulateApiDelay } from '../data/sampleData';
import { Reel, User } from '../types';
import { COLORS, SPACING } from '../constants';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

interface ReelsFeedScreenProps {
  navigation?: any;
  route?: any;
}

const ReelsFeedScreen: React.FC<ReelsFeedScreenProps> = ({ navigation }) => {
  // State
  const [reels, setReels] = useState<Reel[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [likedReels, setLikedReels] = useState<Set<string>>(new Set());
  const [loadingMore, setLoadingMore] = useState(false);
  
  // Refs
  const flatListRef = useRef<FlatList>(null);
  const viewabilityConfig = useRef({
    itemVisiblePercentThreshold: 80,
    minimumViewTime: 300,
  });

  // Mock current user (in real app, this would come from auth context)
  const currentUser: User = sampleUsers[0];

  // Initialize data
  useEffect(() => {
    loadInitialReels();
  }, []);

  // Handle screen focus
  useFocusEffect(
    useCallback(() => {
      StatusBar.setHidden(true);
      return () => {
        StatusBar.setHidden(false);
      };
    }, [])
  );

  const loadInitialReels = async () => {
    try {
      setLoading(true);
      await simulateApiDelay(1000); // Simulate API call
      
      // Load initial reels with random order
      const initialReels = getRandomReels(10);
      setReels(initialReels);
      
      // Initialize some liked reels for demo
      const initialLikes = new Set(['1', '4', '7']);
      setLikedReels(initialLikes);
      
    } catch (error) {
      console.error('Error loading reels:', error);
      Alert.alert('Error', 'Failed to load reels. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const loadMoreReels = async () => {
    if (loadingMore) return;
    
    try {
      setLoadingMore(true);
      await simulateApiDelay(800);
      
      // Load more reels
      const moreReels = getRandomReels(5);
      setReels(prevReels => [...prevReels, ...moreReels]);
      
    } catch (error) {
      console.error('Error loading more reels:', error);
    } finally {
      setLoadingMore(false);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await loadInitialReels();
    setRefreshing(false);
    
    // Scroll to top
    flatListRef.current?.scrollToIndex({ index: 0, animated: true });
    setCurrentIndex(0);
  };

  const onViewableItemsChanged = useCallback(({ viewableItems }: any) => {
    if (viewableItems.length > 0) {
      const newIndex = viewableItems[0].index;
      setCurrentIndex(newIndex);
    }
  }, []);

  // Handle user interactions
  const handleLike = (reelId: string) => {
    setLikedReels(prev => {
      const newLikes = new Set(prev);
      if (newLikes.has(reelId)) {
        newLikes.delete(reelId);
        // Update reel likes count
        setReels(prevReels => 
          prevReels.map(reel => 
            reel.id === reelId 
              ? { ...reel, likes: reel.likes - 1 }
              : reel
          )
        );
      } else {
        newLikes.add(reelId);
        // Update reel likes count
        setReels(prevReels => 
          prevReels.map(reel => 
            reel.id === reelId 
              ? { ...reel, likes: reel.likes + 1 }
              : reel
          )
        );
      }
      return newLikes;
    });
  };

  const handleComment = (reelId: string) => {
    Alert.alert('Comments', `Opening comments for reel ${reelId}`);
    // In real app, navigate to comments screen
  };

  const handleShare = (reelId: string) => {
    Alert.alert('Share', `Sharing reel ${reelId}`);
    // In real app, open share sheet
    
    // Update share count
    setReels(prevReels => 
      prevReels.map(reel => 
        reel.id === reelId 
          ? { ...reel, shares: reel.shares + 1 }
          : reel
      )
    );
  };

  const handleUserPress = (userId: string) => {
    const user = getUserById(userId);
    Alert.alert('Profile', `Opening profile for @${user?.displayName}`);
    // In real app, navigate to user profile
  };

  const handleHashtagPress = (hashtag: string) => {
    Alert.alert('Hashtag', `Viewing #${hashtag} feed`);
    // In real app, navigate to hashtag feed
  };

  const handleDoubleTap = () => {
    // Double tap handled in ReelCard component
  };

  // Render loading state
  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <StatusBar hidden />
        <ActivityIndicator size="large" color={COLORS.primary} />
        <Text style={styles.loadingText}>Loading awesome reels...</Text>
      </View>
    );
  }

  // Render empty state
  if (reels.length === 0) {
    return (
      <View style={styles.emptyContainer}>
        <StatusBar hidden />
        <Text style={styles.emptyText}>No reels available</Text>
        <Text style={styles.emptySubtext}>Pull down to refresh</Text>
      </View>
    );
  }

  const renderReelItem = ({ item, index }: { item: Reel; index: number }) => {
    const creator = getUserById(item.userId);
    if (!creator) return null;

    const isVisible = index === currentIndex;
    const isLiked = likedReels.has(item.id);

    return (
      <ReelCard
        reel={item}
        creator={creator}
        currentUser={currentUser}
        isVisible={isVisible}
        onDoubleTap={handleDoubleTap}
        onLike={handleLike}
        onComment={handleComment}
        onShare={handleShare}
        onUserPress={handleUserPress}
        onHashtagPress={handleHashtagPress}
        isLiked={isLiked}
        viewProgress={0} // You can implement progress tracking here
      />
    );
  };

  const renderFooter = () => {
    if (!loadingMore) return null;
    
    return (
      <View style={styles.footerLoader}>
        <ActivityIndicator size="small" color={COLORS.primary} />
        <Text style={styles.footerText}>Loading more reels...</Text>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.container} edges={[]}>
      <StatusBar hidden />
      
      <FlatList
        ref={flatListRef}
        data={reels}
        renderItem={renderReelItem}
        keyExtractor={(item) => item.id}
        pagingEnabled
        showsVerticalScrollIndicator={false}
        snapToInterval={SCREEN_HEIGHT}
        snapToAlignment="start"
        decelerationRate="fast"
        onViewableItemsChanged={onViewableItemsChanged}
        viewabilityConfig={viewabilityConfig.current}
        getItemLayout={(data, index) => ({
          length: SCREEN_HEIGHT,
          offset: SCREEN_HEIGHT * index,
          index,
        })}
        maxToRenderPerBatch={3}
        windowSize={5}
        initialNumToRender={2}
        removeClippedSubviews={true}
        onEndReached={loadMoreReels}
        onEndReachedThreshold={0.5}
        ListFooterComponent={renderFooter}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={COLORS.primary}
            colors={[COLORS.primary]}
          />
        }
      />

      {/* Current reel indicator */}
      <View style={styles.reelIndicator}>
        <Text style={styles.indicatorText}>
          {currentIndex + 1} / {reels.length}
        </Text>
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: COLORS.background,
  },
  loadingText: {
    color: COLORS.text,
    fontSize: 16,
    marginTop: SPACING.md,
    fontWeight: '500',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: COLORS.background,
    paddingHorizontal: SPACING.xl,
  },
  emptyText: {
    color: COLORS.text,
    fontSize: 20,
    fontWeight: '600',
    textAlign: 'center',
    marginBottom: SPACING.sm,
  },
  emptySubtext: {
    color: COLORS.textSecondary,
    fontSize: 16,
    textAlign: 'center',
  },
  footerLoader: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: SPACING.lg,
    backgroundColor: COLORS.background,
  },
  footerText: {
    color: COLORS.textSecondary,
    fontSize: 14,
    marginLeft: SPACING.sm,
  },
  reelIndicator: {
    position: 'absolute',
    top: 50,
    right: SPACING.lg,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    paddingHorizontal: SPACING.sm,
    paddingVertical: SPACING.xs,
    borderRadius: 20,
  },
  indicatorText: {
    color: COLORS.text,
    fontSize: 12,
    fontWeight: '500',
  },
});

export default ReelsFeedScreen; 