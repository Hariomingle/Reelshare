// User Types
export interface User {
  id: string;
  email: string;
  phone?: string;
  displayName: string;
  profileImage?: string;
  bio?: string;
  isVerified: boolean;
  followerCount: number;
  followingCount: number;
  totalLikes: number;
  createdAt: Date;
  updatedAt: Date;
  referralCode: string;
  referredBy?: string;
  streakCount: number;
  lastActiveDate: Date;
  interests: string[];
  deviceTokens: string[];
}

// Reel Types
export interface Reel {
  id: string;
  userId: string;
  videoUrl: string;
  thumbnailUrl: string;
  caption: string;
  hashtags: string[];
  category: ReelCategory;
  duration: number;
  likes: number;
  comments: number;
  shares: number;
  views: number;
  createdAt: Date;
  updatedAt: Date;
  isActive: boolean;
  isFeatured: boolean;
  reportCount: number;
  embedding?: number[]; // AI embedding for recommendations
  music?: {
    id: string;
    title: string;
    artist: string;
    url: string;
  };
  effects?: string[];
}

// Engagement Types
export interface Like {
  id: string;
  userId: string;
  reelId: string;
  createdAt: Date;
}

export interface Comment {
  id: string;
  userId: string;
  reelId: string;
  content: string;
  likes: number;
  replies: CommentReply[];
  createdAt: Date;
  updatedAt: Date;
}

export interface CommentReply {
  id: string;
  userId: string;
  content: string;
  likes: number;
  createdAt: Date;
}

export interface Share {
  id: string;
  userId: string;
  reelId: string;
  platform: 'whatsapp' | 'instagram' | 'facebook' | 'twitter' | 'copy_link';
  createdAt: Date;
}

// Wallet Types
export interface WalletTransaction {
  id: string;
  userId: string;
  type: 'earning' | 'withdrawal' | 'bonus' | 'referral';
  subType: 'watch' | 'create' | 'share' | 'referral_signup' | 'daily_streak' | 'ad_revenue';
  amount: number;
  description: string;
  reelId?: string;
  referralUserId?: string;
  status: 'pending' | 'completed' | 'failed';
  paymentMethod?: 'razorpay' | 'paytm';
  paymentId?: string;
  // Ad revenue specific fields
  adRevenue?: {
    totalAdRevenue: number; // Total ad revenue from this view
    creatorShare: number; // 60% to creator
    viewerShare: number; // 20% to viewer
    appShare: number; // 20% to app
    adProvider: string; // Which ad network provided the revenue
    cpm: number; // Cost per mille for this specific ad
  };
  createdAt: Date;
  processedAt?: Date;
}

export interface Wallet {
  userId: string;
  totalBalance: number;
  availableBalance: number;
  pendingBalance: number;
  totalEarned: number;
  totalWithdrawn: number;
  // Separate ad revenue from fixed bonuses
  adEarnings: number; // Earnings from actual ad revenue sharing
  bonusEarnings: number; // Fixed bonuses (create, referral, streak, etc.)
  watchEarnings: number; // Total from watching (ad revenue share)
  createEarnings: number; // Total from content creation (ad revenue share + bonus)
  referralEarnings: number;
  streakEarnings: number;
  lastUpdated: Date;
}

// Ad Revenue Tracking
export interface AdRevenueEvent {
  id: string;
  reelId: string;
  viewerId: string;
  creatorId: string;
  adProvider: string; // 'google_admob', 'facebook_audience', etc.
  adType: 'banner' | 'interstitial' | 'rewarded' | 'native';
  revenue: number; // Actual revenue from ad network
  cpm: number; // Cost per mille
  viewDuration: number; // How long user watched (in seconds)
  isValidView: boolean; // Whether it qualifies for revenue sharing
  createdAt: Date;
  distributedAt?: Date; // When revenue was distributed
}

// Revenue Distribution
export interface RevenueDistribution {
  id: string;
  adRevenueEventId: string;
  reelId: string;
  totalRevenue: number;
  distributions: {
    creator: {
      userId: string;
      amount: number;
      percentage: number;
    };
    viewer: {
      userId: string;
      amount: number;
      percentage: number;
    };
    app: {
      amount: number;
      percentage: number;
    };
  };
  status: 'pending' | 'completed' | 'failed';
  createdAt: Date;
  processedAt?: Date;
}

// Analytics Types
export interface UserAnalytics {
  userId: string;
  totalWatchTime: number;
  videosWatched: number;
  videosCreated: number;
  averageWatchPercentage: number;
  preferredCategories: ReelCategory[];
  activeHours: number[];
  lastActivityDate: Date;
  engagementScore: number;
}

export interface ReelAnalytics {
  reelId: string;
  views: number;
  uniqueViews: number;
  averageWatchTime: number;
  completionRate: number;
  likeRate: number;
  commentRate: number;
  shareRate: number;
  hourlyViews: { [hour: string]: number };
  viewerAgeGroups: { [ageGroup: string]: number };
  geographicViews: { [country: string]: number };
}

// Recommendation Types
export interface UserInterest {
  userId: string;
  categories: { [category: string]: number };
  hashtags: { [hashtag: string]: number };
  creators: { [creatorId: string]: number };
  lastUpdated: Date;
}

export interface RecommendationScore {
  reelId: string;
  userId: string;
  score: number;
  factors: {
    categoryMatch: number;
    hashtagMatch: number;
    creatorAffinity: number;
    trendingScore: number;
    recency: number;
  };
  createdAt: Date;
}

// Content Types
export enum ReelCategory {
  FUN = 'fun',
  DANCE = 'dance',
  MOTIVATION = 'motivation',
  COMEDY = 'comedy',
  EDUCATION = 'education',
  FOOD = 'food',
  TRAVEL = 'travel',
  FITNESS = 'fitness',
  MUSIC = 'music',
  TECHNOLOGY = 'technology',
  LIFESTYLE = 'lifestyle',
  ART = 'art'
}

// Referral Types
export interface Referral {
  id: string;
  referrerId: string;
  refereeId: string;
  code: string;
  status: 'pending' | 'completed';
  bonus: number;
  createdAt: Date;
  completedAt?: Date;
}

// Streak Types
export interface DailyStreak {
  userId: string;
  currentStreak: number;
  maxStreak: number;
  lastStreakDate: Date;
  streakRewards: number;
  milestones: { [milestone: number]: Date };
}

// Notification Types
export interface Notification {
  id: string;
  userId: string;
  type: 'like' | 'comment' | 'follow' | 'wallet' | 'streak' | 'system';
  title: string;
  message: string;
  data?: any;
  isRead: boolean;
  createdAt: Date;
}

// Follow Types
export interface Follow {
  id: string;
  followerId: string;
  followingId: string;
  createdAt: Date;
}

// Report Types
export interface Report {
  id: string;
  reporterId: string;
  reelId?: string;
  userId?: string;
  reason: 'inappropriate' | 'spam' | 'harassment' | 'copyright' | 'other';
  description: string;
  status: 'pending' | 'reviewed' | 'resolved' | 'dismissed';
  createdAt: Date;
  reviewedAt?: Date;
  reviewedBy?: string;
}

// Admin Types
export interface AdminUser {
  id: string;
  email: string;
  role: 'admin' | 'moderator';
  permissions: string[];
  createdAt: Date;
}

// API Response Types
export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

// Navigation Types
export type RootStackParamList = {
  Auth: undefined;
  Main: undefined;
  ReelViewer: { reelId: string; reels: Reel[] };
  Profile: { userId: string };
  EditProfile: undefined;
  Camera: undefined;
  VideoEditor: { videoUri: string };
  Settings: undefined;
  Wallet: undefined;
  Notifications: undefined;
  Search: undefined;
  HashtagFeed: { hashtag: string };
  CategoryFeed: { category: ReelCategory };
};

export type MainTabParamList = {
  Home: undefined;
  Explore: undefined;
  Upload: undefined;
  Wallet: undefined;
  Profile: undefined;
};

// Upload Types
export interface VideoUpload {
  uri: string;
  type: string;
  name: string;
  duration: number;
  size: number;
}

export interface UploadProgress {
  loaded: number;
  total: number;
  percentage: number;
}

// Search Types
export interface SearchResult {
  users: User[];
  hashtags: { tag: string; count: number }[];
  reels: Reel[];
}

// Theme Types
export interface Theme {
  colors: {
    primary: string;
    secondary: string;
    background: string;
    surface: string;
    text: string;
    textSecondary: string;
    border: string;
    error: string;
    success: string;
    warning: string;
  };
  fonts: {
    regular: string;
    medium: string;
    bold: string;
  };
  spacing: {
    xs: number;
    sm: number;
    md: number;
    lg: number;
    xl: number;
  };
} 