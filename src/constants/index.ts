import { Dimensions } from 'react-native';
import { ReelCategory } from '../types';

// Device Dimensions
export const SCREEN_WIDTH = Dimensions.get('window').width;
export const SCREEN_HEIGHT = Dimensions.get('window').height;

// Colors - Dark Theme
export const COLORS = {
  // Primary Colors
  primary: '#FF006E',
  primaryDark: '#C70053',
  primaryLight: '#FF4B96',
  
  // Secondary Colors
  secondary: '#8B5CF6',
  secondaryDark: '#7C3AED',
  secondaryLight: '#A78BFA',
  
  // Background Colors
  background: '#000000',
  surface: '#1A1A1A',
  surfaceVariant: '#2A2A2A',
  
  // Text Colors
  text: '#FFFFFF',
  textSecondary: '#B3B3B3',
  textMuted: '#666666',
  
  // Accent Colors
  accent: '#00D9FF',
  accentDark: '#00B8CC',
  
  // Status Colors
  success: '#00FF87',
  warning: '#FFD700',
  error: '#FF3B30',
  info: '#007AFF',
  
  // UI Colors
  border: '#333333',
  borderLight: '#444444',
  overlay: 'rgba(0, 0, 0, 0.8)',
  shadow: 'rgba(0, 0, 0, 0.3)',
  
  // Wallet Colors
  earning: '#00FF87',
  spending: '#FF3B30',
  pending: '#FFD700',
  
  // Social Colors
  like: '#FF3040',
  share: '#00D9FF',
  comment: '#FFFFFF',
  
  // Category Colors
  fun: '#FF6B35',
  dance: '#F72585',
  motivation: '#4CC9F0',
  comedy: '#FFD60A',
  education: '#7209B7',
  food: '#F77F00',
  travel: '#06FFA5',
  fitness: '#FB8500',
  music: '#8338EC',
  technology: '#3A86FF',
  lifestyle: '#FF006E',
  art: '#FFBE0B',
};

// Typography
export const FONTS = {
  family: {
    regular: 'System',
    medium: 'System',
    bold: 'System',
    mono: 'Menlo',
  },
  size: {
    xs: 10,
    sm: 12,
    md: 14,
    lg: 16,
    xl: 18,
    xxl: 20,
    xxxl: 24,
    title: 28,
    heading: 32,
    display: 40,
  },
  weight: {
    light: '300',
    regular: '400',
    medium: '500',
    semibold: '600',
    bold: '700',
    black: '900',
  },
};

// Spacing
export const SPACING = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 48,
  xxxl: 64,
};

// Border Radius
export const BORDER_RADIUS = {
  sm: 4,
  md: 8,
  lg: 12,
  xl: 16,
  xxl: 24,
  full: 9999,
};

// Animation Durations
export const ANIMATION = {
  fast: 150,
  normal: 300,
  slow: 500,
  slower: 1000,
};

// Video Constants
export const VIDEO = {
  minDuration: 15, // seconds
  maxDuration: 60, // seconds
  maxFileSize: 100 * 1024 * 1024, // 100MB
  quality: 0.8,
  formats: ['mp4', 'mov', 'avi'],
  thumbnailQuality: 0.7,
};

// Wallet Constants
export const WALLET = {
  minWithdrawal: 100, // ₹100
  // Dynamic revenue sharing based on actual ad revenue per view
  revenueShare: {
    creator: 0.6, // 60% of actual ad revenue
    viewer: 0.2, // 20% of actual ad revenue  
    app: 0.2, // 20% of actual ad revenue
  },
  // Fixed rewards for non-ad activities
  fixedRewards: {
    createReward: 2, // ₹2 per reel created (bonus, not from ads)
    referralBonus: 10, // ₹10 per successful referral
    dailyStreakBonus: 1, // ₹1 per day streak
    likeBonus: 0.05, // ₹0.05 per like received (bonus)
    shareBonus: 0.25, // ₹0.25 per share (bonus)
  },
  // Ad revenue settings
  adRevenue: {
    minViewTime: 30, // Minimum seconds to count as valid view for revenue
    averageRpm: 1.5, // Average Revenue Per Mille (₹1.50 per 1000 views) - adjustable
    baseAdRate: 0.0015, // Base rate per view (₹0.0015) - will be dynamic based on actual ads
  },
  maxDailyEarnings: 50, // ₹50 maximum per day from bonuses (not ad revenue)
};

// Streak Constants
export const STREAK = {
  minWatchTime: 30, // seconds per reel to count towards streak
  minReelsPerDay: 5, // minimum reels to watch for streak
  bonusMilestones: [7, 14, 30, 60, 100], // streak milestones for bonus rewards
  bonusMultipliers: [2, 3, 5, 7, 10], // multiplier for bonus rewards
};

// Referral Constants
export const REFERRAL = {
  codeLength: 8,
  bonus: 10, // ₹10
  maxReferrals: 100, // per user
  expiryDays: 30,
};

// Content Constants
export const CONTENT = {
  maxCaptionLength: 500,
  maxHashtags: 10,
  maxBioLength: 150,
  maxUsernameLength: 30,
  reportThreshold: 5, // auto-hide after 5 reports
  trendingThreshold: 1000, // minimum views for trending
};

// API Constants
export const API = {
  baseUrl: 'https://us-central1-reelshare-app.cloudfunctions.net',
  timeout: 30000, // 30 seconds
  retries: 3,
  endpoints: {
    auth: '/auth',
    users: '/users',
    reels: '/reels',
    wallet: '/wallet',
    analytics: '/analytics',
    recommendations: '/recommendations',
    upload: '/upload',
    admin: '/admin',
  },
};

// Storage Constants
export const STORAGE = {
  buckets: {
    videos: 'reels-videos',
    thumbnails: 'reels-thumbnails',
    profiles: 'profile-images',
    temp: 'temp-uploads',
  },
  paths: {
    reels: 'reels/{userId}/{reelId}',
    thumbnails: 'thumbnails/{userId}/{reelId}',
    profiles: 'profiles/{userId}',
  },
};

// Notification Constants
export const NOTIFICATIONS = {
  channels: {
    general: 'general',
    wallet: 'wallet',
    social: 'social',
    streak: 'streak',
  },
  types: {
    like: 'like',
    comment: 'comment',
    follow: 'follow',
    wallet: 'wallet',
    streak: 'streak',
    system: 'system',
  },
};

// Category Configuration
export const CATEGORIES = [
  { key: ReelCategory.FUN, label: 'Fun', icon: '😄', color: COLORS.fun },
  { key: ReelCategory.DANCE, label: 'Dance', icon: '💃', color: COLORS.dance },
  { key: ReelCategory.MOTIVATION, label: 'Motivation', icon: '💪', color: COLORS.motivation },
  { key: ReelCategory.COMEDY, label: 'Comedy', icon: '😂', color: COLORS.comedy },
  { key: ReelCategory.EDUCATION, label: 'Education', icon: '📚', color: COLORS.education },
  { key: ReelCategory.FOOD, label: 'Food', icon: '🍕', color: COLORS.food },
  { key: ReelCategory.TRAVEL, label: 'Travel', icon: '✈️', color: COLORS.travel },
  { key: ReelCategory.FITNESS, label: 'Fitness', icon: '🏋️', color: COLORS.fitness },
  { key: ReelCategory.MUSIC, label: 'Music', icon: '🎵', color: COLORS.music },
  { key: ReelCategory.TECHNOLOGY, label: 'Technology', icon: '💻', color: COLORS.technology },
  { key: ReelCategory.LIFESTYLE, label: 'Lifestyle', icon: '✨', color: COLORS.lifestyle },
  { key: ReelCategory.ART, label: 'Art', icon: '🎨', color: COLORS.art },
];

// Camera Constants
export const CAMERA = {
  aspectRatio: 9 / 16, // Vertical aspect ratio for reels
  quality: 0.8,
  maxDuration: VIDEO.maxDuration,
  frameRate: 30,
  bitRate: 2000000, // 2 Mbps
};

// AI/ML Constants
export const AI = {
  embeddingDimensions: 512,
  similarityThreshold: 0.7,
  maxRecommendations: 50,
  batchSize: 10,
  updateInterval: 3600000, // 1 hour in milliseconds
};

// Performance Constants
export const PERFORMANCE = {
  imageCache: {
    maxSize: 100 * 1024 * 1024, // 100MB
    maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
  },
  videoCache: {
    maxSize: 500 * 1024 * 1024, // 500MB
    maxAge: 3 * 24 * 60 * 60 * 1000, // 3 days
  },
  listPagination: {
    initialLoad: 10,
    pageSize: 20,
    preloadThreshold: 5,
  },
};

// Security Constants
export const SECURITY = {
  tokenExpiry: 24 * 60 * 60 * 1000, // 24 hours
  maxLoginAttempts: 5,
  lockoutDuration: 15 * 60 * 1000, // 15 minutes
  passwordMinLength: 8,
  otpLength: 6,
  otpExpiry: 5 * 60 * 1000, // 5 minutes
};

// Feature Flags
export const FEATURES = {
  aiRecommendations: true,
  arFilters: false, // Coming soon
  liveStreaming: false, // Future feature
  tokenRewards: false, // Future feature
  socialLogin: true,
  phoneAuth: true,
  walletSystem: true,
  referralSystem: true,
  streakSystem: true,
  analytics: true,
  pushNotifications: true,
};

// Social Sharing
export const SOCIAL_PLATFORMS = [
  { 
    id: 'whatsapp',
    name: 'WhatsApp',
    color: '#25D366',
    icon: 'logo-whatsapp'
  },
  { 
    id: 'instagram',
    name: 'Instagram',
    color: '#E4405F',
    icon: 'logo-instagram'
  },
  { 
    id: 'facebook',
    name: 'Facebook',
    color: '#1877F2',
    icon: 'logo-facebook'
  },
  { 
    id: 'twitter',
    name: 'Twitter',
    color: '#1DA1F2',
    icon: 'logo-twitter'
  },
  { 
    id: 'copy_link',
    name: 'Copy Link',
    color: COLORS.accent,
    icon: 'link'
  },
];

export default {
  COLORS,
  FONTS,
  SPACING,
  BORDER_RADIUS,
  ANIMATION,
  VIDEO,
  WALLET,
  STREAK,
  REFERRAL,
  CONTENT,
  API,
  STORAGE,
  NOTIFICATIONS,
  CATEGORIES,
  CAMERA,
  AI,
  PERFORMANCE,
  SECURITY,
  FEATURES,
  SOCIAL_PLATFORMS,
  SCREEN_WIDTH,
  SCREEN_HEIGHT,
}; 