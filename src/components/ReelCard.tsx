import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  StyleSheet,
  TouchableOpacity,
  Text,
  Image,
  Animated,
  PanGestureHandler,
  TapGestureHandler,
  Dimensions,
} from 'react-native';
import { Video, ResizeMode, AVPlaybackStatus } from 'expo-av';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import LottieView from 'lottie-react-native';

// Types and Constants
import { Reel, User } from '../types';
import { COLORS, FONTS, SPACING, BORDER_RADIUS, SCREEN_HEIGHT, SCREEN_WIDTH } from '../constants';

// Services
import { likeReel, unlikeReel, shareReel } from '../services/reelService';
import { updateWalletBalance } from '../services/walletService';
import { trackReelView, trackEngagement } from '../services/analyticsService';

interface ReelCardProps {
  reel: Reel;
  creator: User;
  currentUser: User;
  isVisible: boolean;
  onDoubleTap: () => void;
  onLike: (reelId: string) => void;
  onComment: (reelId: string) => void;
  onShare: (reelId: string) => void;
  onUserPress: (userId: string) => void;
  onHashtagPress: (hashtag: string) => void;
  isLiked: boolean;
  viewProgress: number;
}

const ReelCard: React.FC<ReelCardProps> = ({
  reel,
  creator,
  currentUser,
  isVisible,
  onDoubleTap,
  onLike,
  onComment,
  onShare,
  onUserPress,
  onHashtagPress,
  isLiked,
  viewProgress,
}) => {
  // Refs
  const videoRef = useRef<Video>(null);
  const doubleTapRef = useRef<TapGestureHandler>(null);
  const singleTapRef = useRef<TapGestureHandler>(null);
  
  // State
  const [isPaused, setIsPaused] = useState(!isVisible);
  const [isMuted, setIsMuted] = useState(false);
  const [showHearts, setShowHearts] = useState(false);
  const [progress, setProgress] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  
  // Animations
  const heartAnimation = useRef(new Animated.Value(0)).current;
  const likeAnimation = useRef(new Animated.Value(1)).current;
  const progressAnimation = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (isVisible) {
      setIsPaused(false);
      trackReelView(reel.id, currentUser.id);
    } else {
      setIsPaused(true);
    }
  }, [isVisible]);

  useEffect(() => {
    Animated.timing(progressAnimation, {
      toValue: viewProgress,
      duration: 100,
      useNativeDriver: false,
    }).start();
  }, [viewProgress]);

  const formatCount = (count: number): string => {
    if (count >= 1000000) {
      return `${(count / 1000000).toFixed(1)}M`;
    } else if (count >= 1000) {
      return `${(count / 1000).toFixed(1)}K`;
    }
    return count.toString();
  };

  const handleDoubleTap = () => {
    if (!isLiked) {
      onLike(reel.id);
      animateLike();
    }
    onDoubleTap();
    
    // Show floating hearts animation
    setShowHearts(true);
    Animated.sequence([
      Animated.timing(heartAnimation, {
        toValue: 1,
        duration: 300,
        useNativeDriver: true,
      }),
      Animated.timing(heartAnimation, {
        toValue: 0,
        duration: 300,
        useNativeDriver: true,
      }),
    ]).start(() => {
      setShowHearts(false);
    });
    
    // Track engagement
    trackEngagement(reel.id, currentUser.id, 'double_tap');
  };

  const animateLike = () => {
    Animated.sequence([
      Animated.timing(likeAnimation, {
        toValue: 1.3,
        duration: 150,
        useNativeDriver: true,
      }),
      Animated.timing(likeAnimation, {
        toValue: 1,
        duration: 150,
        useNativeDriver: true,
      }),
    ]).start();
  };

  const handleSingleTap = () => {
    setIsPaused(!isPaused);
  };

  const handleLike = () => {
    onLike(reel.id);
    animateLike();
    trackEngagement(reel.id, currentUser.id, 'like');
  };

  const handleComment = () => {
    onComment(reel.id);
    trackEngagement(reel.id, currentUser.id, 'comment');
  };

  const handleShare = () => {
    onShare(reel.id);
    trackEngagement(reel.id, currentUser.id, 'share');
  };

  const renderHashtags = (caption: string) => {
    const words = caption.split(' ');
    return words.map((word, index) => {
      if (word.startsWith('#')) {
        return (
          <Text
            key={index}
            style={[styles.captionText, styles.hashtag]}
            onPress={() => onHashtagPress(word.substring(1))}
          >
            {word}{' '}
          </Text>
        );
      }
      return (
        <Text key={index} style={styles.captionText}>
          {word}{' '}
        </Text>
      );
    });
  };

  const onPlaybackStatusUpdate = (status: AVPlaybackStatus) => {
    if (status.isLoaded) {
      setIsLoading(false);
      if (status.durationMillis) {
        const progressValue = status.positionMillis! / status.durationMillis;
        setProgress(progressValue);
      }
    }
  };

  return (
    <View style={styles.container}>
      {/* Video Player */}
      <PanGestureHandler>
        <TapGestureHandler
          ref={doubleTapRef}
          numberOfTaps={2}
          onActivated={handleDoubleTap}
          waitFor={singleTapRef}
        >
          <TapGestureHandler
            ref={singleTapRef}
            numberOfTaps={1}
            onActivated={handleSingleTap}
            waitFor={doubleTapRef}
          >
            <View style={styles.videoContainer}>
              <Video
                ref={videoRef}
                source={{ uri: reel.videoUrl }}
                style={styles.video}
                resizeMode={ResizeMode.COVER}
                shouldPlay={!isPaused}
                isLooping
                isMuted={isMuted}
                onPlaybackStatusUpdate={onPlaybackStatusUpdate}
              />
              
              {/* Loading indicator */}
              {isLoading && (
                <View style={styles.loadingContainer}>
                  <LottieView
                    source={require('../../assets/animations/loading.json')}
                    autoPlay
                    loop
                    style={styles.loading}
                  />
                </View>
              )}

              {/* Pause indicator */}
              {isPaused && !isLoading && (
                <View style={styles.pauseContainer}>
                  <Ionicons name="play" size={64} color="rgba(255, 255, 255, 0.8)" />
                </View>
              )}

              {/* Progress bar */}
              <View style={styles.progressBarContainer}>
                <Animated.View
                  style={[
                    styles.progressBar,
                    {
                      width: progressAnimation.interpolate({
                        inputRange: [0, 1],
                        outputRange: ['0%', '100%'],
                      }),
                    },
                  ]}
                />
              </View>
            </View>
          </TapGestureHandler>
        </TapGestureHandler>
      </PanGestureHandler>

      {/* Floating Hearts Animation */}
      {showHearts && (
        <Animated.View
          style={[
            styles.floatingHearts,
            {
              opacity: heartAnimation,
              transform: [
                {
                  translateY: heartAnimation.interpolate({
                    inputRange: [0, 1],
                    outputRange: [0, -100],
                  }),
                },
                {
                  scale: heartAnimation.interpolate({
                    inputRange: [0, 0.5, 1],
                    outputRange: [0, 1.2, 0.8],
                  }),
                },
              ],
            },
          ]}
        >
          {[...Array(5)].map((_, index) => (
            <Ionicons
              key={index}
              name="heart"
              size={24 + Math.random() * 16}
              color={COLORS.like}
              style={[
                styles.floatingHeart,
                {
                  left: Math.random() * SCREEN_WIDTH * 0.6,
                  top: Math.random() * 100,
                },
              ]}
            />
          ))}
        </Animated.View>
      )}

      {/* Bottom Gradient */}
      <LinearGradient
        colors={['transparent', 'rgba(0,0,0,0.8)']}
        style={styles.bottomGradient}
      />

      {/* User Info and Caption */}
      <View style={styles.userInfoContainer}>
        <TouchableOpacity
          style={styles.userInfo}
          onPress={() => onUserPress(creator.id)}
        >
          <Image source={{ uri: creator.profileImage }} style={styles.avatar} />
          <View style={styles.userDetails}>
            <Text style={styles.username}>@{creator.displayName}</Text>
            {creator.isVerified && (
              <Ionicons name="checkmark-circle" size={16} color={COLORS.accent} />
            )}
          </View>
        </TouchableOpacity>

        <View style={styles.captionContainer}>
          <Text style={styles.captionText} numberOfLines={3}>
            {renderHashtags(reel.caption)}
          </Text>
        </View>

        {/* Category Badge */}
        <View style={styles.categoryBadge}>
          <Text style={styles.categoryText}>{reel.category}</Text>
        </View>
      </View>

      {/* Right Side Actions */}
      <View style={styles.actionsContainer}>
        {/* Like Button */}
        <TouchableOpacity style={styles.actionButton} onPress={handleLike}>
          <Animated.View style={{ transform: [{ scale: likeAnimation }] }}>
            <Ionicons
              name={isLiked ? 'heart' : 'heart-outline'}
              size={32}
              color={isLiked ? COLORS.like : COLORS.text}
            />
          </Animated.View>
          <Text style={styles.actionCount}>{formatCount(reel.likes)}</Text>
        </TouchableOpacity>

        {/* Comment Button */}
        <TouchableOpacity style={styles.actionButton} onPress={handleComment}>
          <Ionicons name="chatbubble-outline" size={32} color={COLORS.text} />
          <Text style={styles.actionCount}>{formatCount(reel.comments)}</Text>
        </TouchableOpacity>

        {/* Share Button */}
        <TouchableOpacity style={styles.actionButton} onPress={handleShare}>
          <Ionicons name="arrow-redo-outline" size={32} color={COLORS.text} />
          <Text style={styles.actionCount}>{formatCount(reel.shares)}</Text>
        </TouchableOpacity>

        {/* Mute/Unmute Button */}
        <TouchableOpacity
          style={styles.actionButton}
          onPress={() => setIsMuted(!isMuted)}
        >
          <Ionicons
            name={isMuted ? 'volume-mute' : 'volume-high'}
            size={24}
            color={COLORS.text}
          />
        </TouchableOpacity>
      </View>

      {/* Music Info (if available) */}
      {reel.music && (
        <View style={styles.musicContainer}>
          <Ionicons name="musical-notes" size={16} color={COLORS.text} />
          <Text style={styles.musicText} numberOfLines={1}>
            {reel.music.title} - {reel.music.artist}
          </Text>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
    width: SCREEN_WIDTH,
    height: SCREEN_HEIGHT,
  },
  videoContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  video: {
    width: SCREEN_WIDTH,
    height: SCREEN_HEIGHT,
  },
  loadingContainer: {
    position: 'absolute',
    justifyContent: 'center',
    alignItems: 'center',
    width: SCREEN_WIDTH,
    height: SCREEN_HEIGHT,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  loading: {
    width: 50,
    height: 50,
  },
  pauseContainer: {
    position: 'absolute',
    justifyContent: 'center',
    alignItems: 'center',
    width: SCREEN_WIDTH,
    height: SCREEN_HEIGHT,
  },
  progressBarContainer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 2,
    backgroundColor: 'rgba(255, 255, 255, 0.3)',
  },
  progressBar: {
    height: 2,
    backgroundColor: COLORS.primary,
  },
  floatingHearts: {
    position: 'absolute',
    width: SCREEN_WIDTH,
    height: 200,
    top: SCREEN_HEIGHT / 2 - 100,
    justifyContent: 'center',
    alignItems: 'center',
    pointerEvents: 'none',
  },
  floatingHeart: {
    position: 'absolute',
  },
  bottomGradient: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: SCREEN_HEIGHT * 0.4,
    pointerEvents: 'none',
  },
  userInfoContainer: {
    position: 'absolute',
    bottom: 120,
    left: SPACING.lg,
    right: 80,
  },
  userInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: SPACING.sm,
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    marginRight: SPACING.sm,
    borderWidth: 2,
    borderColor: COLORS.text,
  },
  userDetails: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  username: {
    color: COLORS.text,
    fontSize: FONTS.size.lg,
    fontWeight: FONTS.weight.semibold,
    marginRight: SPACING.xs,
  },
  captionContainer: {
    marginBottom: SPACING.sm,
  },
  captionText: {
    color: COLORS.text,
    fontSize: FONTS.size.md,
    lineHeight: 20,
  },
  hashtag: {
    color: COLORS.accent,
    fontWeight: FONTS.weight.medium,
  },
  categoryBadge: {
    alignSelf: 'flex-start',
    backgroundColor: `${COLORS.primary}20`,
    paddingHorizontal: SPACING.sm,
    paddingVertical: SPACING.xs,
    borderRadius: BORDER_RADIUS.sm,
    borderWidth: 1,
    borderColor: COLORS.primary,
  },
  categoryText: {
    color: COLORS.primary,
    fontSize: FONTS.size.sm,
    fontWeight: FONTS.weight.medium,
    textTransform: 'uppercase',
  },
  actionsContainer: {
    position: 'absolute',
    right: SPACING.lg,
    bottom: 120,
    alignItems: 'center',
  },
  actionButton: {
    alignItems: 'center',
    marginBottom: SPACING.lg,
  },
  actionCount: {
    color: COLORS.text,
    fontSize: FONTS.size.sm,
    fontWeight: FONTS.weight.medium,
    marginTop: SPACING.xs,
    textAlign: 'center',
  },
  musicContainer: {
    position: 'absolute',
    bottom: 60,
    left: SPACING.lg,
    right: SPACING.lg,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    paddingHorizontal: SPACING.sm,
    paddingVertical: SPACING.xs,
    borderRadius: BORDER_RADIUS.sm,
  },
  musicText: {
    color: COLORS.text,
    fontSize: FONTS.size.sm,
    marginLeft: SPACING.xs,
    flex: 1,
  },
});

export default ReelCard; 