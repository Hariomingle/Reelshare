import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  Dimensions,
  Animated,
  Image,
} from 'react-native';
import { Video, ResizeMode } from 'expo-av';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { TapGestureHandler, State } from 'react-native-gesture-handler';
import LottieView from 'lottie-react-native';

import recommendationService, { ReelRecommendation } from '../services/recommendationService';
import { COLORS, FONTS, SPACING, BORDER_RADIUS } from '../constants';
import { User, Reel } from '../types';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

interface RecommendedReelCardProps {
  reel: Reel;
  creator: User;
  currentUser: User;
  recommendation: ReelRecommendation;
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

const RecommendedReelCard: React.FC<RecommendedReelCardProps> = ({
  reel,
  creator,
  currentUser,
  recommendation,
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
  const [isPaused, setIsPaused] = useState(!isVisible);
  const [isMuted, setIsMuted] = useState(false);
  const [showHearts, setShowHearts] = useState(false);
  const [progress, setProgress] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [showRecommendationInfo, setShowRecommendationInfo] = useState(false);
  const [viewStartTime, setViewStartTime] = useState<number | null>(null);

  const videoRef = useRef<Video>(null);
  const heartAnimation = useRef(new Animated.Value(0)).current;
  const doubleTapRef = useRef();

  useEffect(() => {
    setIsPaused(!isVisible);
    
    if (isVisible && !viewStartTime) {
      // Start tracking view time when video becomes visible
      setViewStartTime(Date.now());
    } else if (!isVisible && viewStartTime) {
      // Track view duration when video becomes invisible
      const viewDuration = (Date.now() - viewStartTime) / 1000;
      if (viewDuration > 3) { // Only track views longer than 3 seconds
        trackVideoView(viewDuration);
      }
      setViewStartTime(null);
    }
  }, [isVisible]);

  useEffect(() => {
    return () => {
      // Track view duration on component unmount
      if (viewStartTime) {
        const viewDuration = (Date.now() - viewStartTime) / 1000;
        if (viewDuration > 3) {
          trackVideoView(viewDuration);
        }
      }
    };
  }, []);

  const trackVideoView = async (duration: number) => {
    try {
      await recommendationService.trackVideoView(reel.id, duration);
    } catch (error) {
      console.error('Error tracking video view:', error);
    }
  };

  const handleLike = async () => {
    try {
      onLike(reel.id);
      await recommendationService.trackLike(reel.id);
      
      if (!isLiked) {
        showLikeAnimation();
      }
    } catch (error) {
      console.error('Error tracking like:', error);
    }
  };

  const handleComment = async () => {
    try {
      onComment(reel.id);
      await recommendationService.trackComment(reel.id);
    } catch (error) {
      console.error('Error tracking comment:', error);
    }
  };

  const handleShare = async () => {
    try {
      onShare(reel.id);
      await recommendationService.trackShare(reel.id);
    } catch (error) {
      console.error('Error tracking share:', error);
    }
  };

  const showLikeAnimation = () => {
    setShowHearts(true);
    Animated.sequence([
      Animated.timing(heartAnimation, {
        toValue: 1,
        duration: 400,
        useNativeDriver: true,
      }),
      Animated.timing(heartAnimation, {
        toValue: 0,
        duration: 400,
        useNativeDriver: true,
      }),
    ]).start(() => {
      setShowHearts(false);
    });
  };

  const onDoubleTapEvent = ({ nativeEvent }: any) => {
    if (nativeEvent.state === State.ACTIVE) {
      handleLike();
      onDoubleTap();
    }
  };

  const formatNumber = (num: number): string => {
    if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
    if (num >= 1000) return `${(num / 1000).toFixed(1)}K`;
    return num.toString();
  };

  const getScoreColor = (score: number): string => {
    return recommendationService.getScoreColor(score);
  };

  const formatRecommendationReason = (reason: string): string => {
    return recommendationService.formatRecommendationReason(recommendation);
  };

  const renderHashtags = (text: string) => {
    const words = text.split(' ');
    return words.map((word, index) => {
      if (word.startsWith('#')) {
        return (
          <Text
            key={index}
            style={styles.hashtag}
            onPress={() => onHashtagPress(word.substring(1))}
          >
            {word}{' '}
          </Text>
        );
      }
      return <Text key={index} style={styles.captionText}>{word} </Text>;
    });
  };

  return (
    <View style={styles.container}>
      {/* Background Video */}
      <TapGestureHandler
        ref={doubleTapRef}
        onHandlerStateChange={onDoubleTapEvent}
        numberOfTaps={2}
      >
        <View style={styles.videoContainer}>
          <Video
            ref={videoRef}
            source={{ uri: reel.videoUrl }}
            style={styles.video}
            resizeMode={ResizeMode.COVER}
            shouldPlay={isVisible && !isPaused}
            isLooping
            isMuted={isMuted}
            onLoad={() => setIsLoading(false)}
            onPlaybackStatusUpdate={(status: any) => {
              if (status.isLoaded && status.durationMillis) {
                setProgress(status.positionMillis / status.durationMillis);
              }
            }}
          />

          {isLoading && (
            <View style={styles.loadingOverlay}>
              <LottieView
                source={require('../assets/loading-animation.json')}
                autoPlay
                loop
                style={styles.loadingAnimation}
              />
            </View>
          )}

          {/* Recommendation Info Overlay */}
          {showRecommendationInfo && (
            <View style={styles.recommendationOverlay}>
              <LinearGradient
                colors={['rgba(0,0,0,0.8)', 'rgba(0,0,0,0.4)']}
                style={styles.recommendationGradient}
              >
                <View style={styles.recommendationHeader}>
                  <View style={styles.scoreContainer}>
                    <Text style={styles.scoreLabel}>Match Score</Text>
                    <Text 
                      style={[styles.scoreValue, { color: getScoreColor(recommendation.score) }]}
                    >
                      {recommendationService.getScorePercentage(recommendation.score)}%
                    </Text>
                  </View>
                  <TouchableOpacity
                    style={styles.closeButton}
                    onPress={() => setShowRecommendationInfo(false)}
                  >
                    <Ionicons name="close" size={20} color={COLORS.text} />
                  </TouchableOpacity>
                </View>

                <Text style={styles.recommendationReason}>
                  {formatRecommendationReason(recommendation.reason)}
                </Text>

                <View style={styles.recommendationTags}>
                  <Text style={styles.tagsLabel}>Topics:</Text>
                  <View style={styles.tagsList}>
                    {recommendation.topics.slice(0, 3).map((topic, index) => (
                      <View key={index} style={styles.topicTag}>
                        <Text style={styles.topicTagText}>{topic}</Text>
                      </View>
                    ))}
                  </View>
                </View>

                <View style={styles.rankContainer}>
                  <Ionicons name="trophy" size={16} color={COLORS.warning} />
                  <Text style={styles.rankText}>
                    #{recommendation.rank} recommendation for you
                  </Text>
                </View>
              </LinearGradient>
            </View>
          )}

          {/* Heart Animation */}
          {showHearts && (
            <Animated.View
              style={[
                styles.heartsContainer,
                {
                  opacity: heartAnimation,
                  transform: [
                    {
                      scale: heartAnimation.interpolate({
                        inputRange: [0, 0.5, 1],
                        outputRange: [0.8, 1.2, 1],
                      }),
                    },
                  ],
                },
              ]}
            >
              <LottieView
                source={require('../assets/heart-animation.json')}
                autoPlay
                loop={false}
                style={styles.heartAnimation}
              />
            </Animated.View>
          )}
        </View>
      </TapGestureHandler>

      {/* Right Action Buttons */}
      <View style={styles.rightActions}>
        {/* Recommendation Score Badge */}
        <TouchableOpacity
          style={styles.recommendationBadge}
          onPress={() => setShowRecommendationInfo(true)}
        >
          <View style={[styles.scoreBadge, { borderColor: getScoreColor(recommendation.score) }]}>
            <Ionicons name="target" size={16} color={getScoreColor(recommendation.score)} />
            <Text style={[styles.scoreBadgeText, { color: getScoreColor(recommendation.score) }]}>
              {recommendationService.getScorePercentage(recommendation.score)}
            </Text>
          </View>
        </TouchableOpacity>

        {/* Creator Profile */}
        <TouchableOpacity
          style={styles.creatorButton}
          onPress={() => onUserPress(creator.id)}
        >
          <Image source={{ uri: creator.profileImage }} style={styles.creatorAvatar} />
          {creator.isVerified && (
            <View style={styles.verifiedBadge}>
              <Ionicons name="checkmark" size={12} color={COLORS.text} />
            </View>
          )}
        </TouchableOpacity>

        {/* Like Button */}
        <TouchableOpacity style={styles.actionButton} onPress={handleLike}>
          <Ionicons
            name={isLiked ? "heart" : "heart-outline"}
            size={32}
            color={isLiked ? COLORS.error : COLORS.text}
          />
          <Text style={styles.actionText}>{formatNumber(reel.likes)}</Text>
        </TouchableOpacity>

        {/* Comment Button */}
        <TouchableOpacity style={styles.actionButton} onPress={handleComment}>
          <Ionicons name="chatbubble-outline" size={28} color={COLORS.text} />
          <Text style={styles.actionText}>{formatNumber(reel.comments)}</Text>
        </TouchableOpacity>

        {/* Share Button */}
        <TouchableOpacity style={styles.actionButton} onPress={handleShare}>
          <Ionicons name="arrow-redo-outline" size={28} color={COLORS.text} />
          <Text style={styles.actionText}>{formatNumber(reel.shares)}</Text>
        </TouchableOpacity>

        {/* Mute/Unmute Button */}
        <TouchableOpacity
          style={styles.actionButton}
          onPress={() => setIsMuted(!isMuted)}
        >
          <Ionicons
            name={isMuted ? "volume-mute" : "volume-medium"}
            size={24}
            color={COLORS.text}
          />
        </TouchableOpacity>
      </View>

      {/* Bottom Content */}
      <LinearGradient
        colors={['transparent', 'rgba(0,0,0,0.8)']}
        style={styles.bottomGradient}
      >
        <View style={styles.bottomContent}>
          {/* Creator Info */}
          <TouchableOpacity
            style={styles.creatorInfo}
            onPress={() => onUserPress(creator.id)}
          >
            <Text style={styles.creatorName}>@{creator.displayName}</Text>
            {creator.isVerified && (
              <Ionicons name="checkmark-circle" size={16} color={COLORS.info} />
            )}
          </TouchableOpacity>

          {/* Caption */}
          <View style={styles.captionContainer}>
            <Text style={styles.captionText} numberOfLines={3}>
              {renderHashtags(reel.caption)}
            </Text>
          </View>

          {/* Recommendation Reason (Subtle) */}
          <View style={styles.recommendationHint}>
            <Ionicons name="sparkles" size={14} color={COLORS.primary} />
            <Text style={styles.recommendationHintText}>
              {formatRecommendationReason(recommendation.reason)}
            </Text>
          </View>

          {/* Music Info */}
          {reel.music && (
            <View style={styles.musicInfo}>
              <Ionicons name="musical-note" size={12} color={COLORS.text} />
              <Text style={styles.musicText}>
                {reel.music.title} - {reel.music.artist}
              </Text>
            </View>
          )}
        </View>
      </LinearGradient>

      {/* Progress Bar */}
      {isVisible && (
        <View style={styles.progressBar}>
          <View style={[styles.progressFill, { width: `${progress * 100}%` }]} />
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    width: SCREEN_WIDTH,
    height: SCREEN_HEIGHT,
    backgroundColor: COLORS.background,
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
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: COLORS.background,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingAnimation: {
    width: 80,
    height: 80,
  },
  
  // Recommendation Overlay
  recommendationOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
  },
  recommendationGradient: {
    width: SCREEN_WIDTH * 0.85,
    padding: SPACING.xl,
    borderRadius: BORDER_RADIUS.xl,
    alignItems: 'center',
  },
  recommendationHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    width: '100%',
    marginBottom: SPACING.lg,
  },
  scoreContainer: {
    alignItems: 'center',
  },
  scoreLabel: {
    color: COLORS.textSecondary,
    fontSize: FONTS.size.sm,
    fontWeight: FONTS.weight.medium,
  },
  scoreValue: {
    fontSize: FONTS.size.xl,
    fontWeight: FONTS.weight.bold,
    marginTop: SPACING.xs,
  },
  closeButton: {
    padding: SPACING.sm,
  },
  recommendationReason: {
    color: COLORS.text,
    fontSize: FONTS.size.lg,
    fontWeight: FONTS.weight.semibold,
    textAlign: 'center',
    marginBottom: SPACING.lg,
  },
  recommendationTags: {
    width: '100%',
    marginBottom: SPACING.lg,
  },
  tagsLabel: {
    color: COLORS.textSecondary,
    fontSize: FONTS.size.sm,
    marginBottom: SPACING.sm,
  },
  tagsList: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: SPACING.sm,
  },
  topicTag: {
    backgroundColor: COLORS.primary + '20',
    borderColor: COLORS.primary,
    borderWidth: 1,
    borderRadius: BORDER_RADIUS.sm,
    paddingHorizontal: SPACING.sm,
    paddingVertical: SPACING.xs,
  },
  topicTagText: {
    color: COLORS.primary,
    fontSize: FONTS.size.sm,
    fontWeight: FONTS.weight.medium,
    textTransform: 'capitalize',
  },
  rankContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.xs,
  },
  rankText: {
    color: COLORS.textSecondary,
    fontSize: FONTS.size.sm,
    fontWeight: FONTS.weight.medium,
  },

  // Right Actions
  rightActions: {
    position: 'absolute',
    right: SPACING.lg,
    bottom: 120,
    alignItems: 'center',
    gap: SPACING.lg,
  },
  recommendationBadge: {
    marginBottom: SPACING.md,
  },
  scoreBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.6)',
    borderWidth: 2,
    borderRadius: BORDER_RADIUS.full,
    paddingHorizontal: SPACING.sm,
    paddingVertical: SPACING.xs,
    gap: SPACING.xs,
  },
  scoreBadgeText: {
    fontSize: FONTS.size.sm,
    fontWeight: FONTS.weight.bold,
  },
  creatorButton: {
    position: 'relative',
    marginBottom: SPACING.md,
  },
  creatorAvatar: {
    width: 56,
    height: 56,
    borderRadius: 28,
    borderWidth: 2,
    borderColor: COLORS.text,
  },
  verifiedBadge: {
    position: 'absolute',
    bottom: -2,
    right: -2,
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: COLORS.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  actionButton: {
    alignItems: 'center',
    gap: SPACING.xs,
  },
  actionText: {
    color: COLORS.text,
    fontSize: FONTS.size.sm,
    fontWeight: FONTS.weight.medium,
    textAlign: 'center',
  },

  // Bottom Content
  bottomGradient: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 200,
    justifyContent: 'flex-end',
  },
  bottomContent: {
    padding: SPACING.lg,
    paddingBottom: 100, // Account for navigation
  },
  creatorInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.xs,
    marginBottom: SPACING.sm,
  },
  creatorName: {
    color: COLORS.text,
    fontSize: FONTS.size.lg,
    fontWeight: FONTS.weight.bold,
  },
  captionContainer: {
    marginBottom: SPACING.sm,
  },
  captionText: {
    color: COLORS.text,
    fontSize: FONTS.size.md,
    lineHeight: 22,
  },
  hashtag: {
    color: COLORS.primary,
    fontWeight: FONTS.weight.semibold,
  },
  recommendationHint: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.xs,
    marginBottom: SPACING.sm,
    backgroundColor: 'rgba(255, 107, 53, 0.15)',
    paddingHorizontal: SPACING.sm,
    paddingVertical: SPACING.xs,
    borderRadius: BORDER_RADIUS.md,
    alignSelf: 'flex-start',
  },
  recommendationHintText: {
    color: COLORS.primary,
    fontSize: FONTS.size.sm,
    fontWeight: FONTS.weight.medium,
  },
  musicInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.xs,
    backgroundColor: 'rgba(0,0,0,0.5)',
    paddingHorizontal: SPACING.sm,
    paddingVertical: SPACING.xs,
    borderRadius: BORDER_RADIUS.md,
    alignSelf: 'flex-start',
  },
  musicText: {
    color: COLORS.text,
    fontSize: FONTS.size.sm,
    fontStyle: 'italic',
  },

  // Heart Animation
  heartsContainer: {
    position: 'absolute',
    justifyContent: 'center',
    alignItems: 'center',
  },
  heartAnimation: {
    width: 100,
    height: 100,
  },

  // Progress Bar
  progressBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 2,
    backgroundColor: 'rgba(255,255,255,0.3)',
  },
  progressFill: {
    height: '100%',
    backgroundColor: COLORS.primary,
  },
});

export default RecommendedReelCard; 