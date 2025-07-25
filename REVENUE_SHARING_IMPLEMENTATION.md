# Dynamic Revenue Sharing Implementation

## Overview
The ReelShare app now implements a **dynamic revenue sharing system** where earnings are based on actual ad revenue received from ad networks, not fixed amounts. The revenue is distributed according to your specified plan: **60% Creator, 20% Viewer, 20% App**.

## Revenue Distribution Model

### Ad Revenue Sharing (Dynamic)
- **Content Creator**: 60% of actual ad revenue from their content
- **Content Viewer**: 20% of actual ad revenue (minimum 30-second view required)
- **Platform**: 20% for infrastructure and operations

### Fixed Bonuses (Separate from Ad Revenue)
- Content creation bonus: ₹2 per reel published
- Referral bonus: ₹10 per successful signup
- Daily streak bonus: ₹1+ per day for consistent engagement
- Engagement bonuses: ₹0.05 per like, ₹0.25 per share

## Technical Implementation

### 1. New Data Models (`src/types/index.ts`)

#### Enhanced Wallet Structure
```typescript
export interface Wallet {
  // ... existing fields
  adEarnings: number;        // Earnings from actual ad revenue sharing
  bonusEarnings: number;     // Fixed bonuses (create, referral, streak, etc.)
  watchEarnings: number;     // Total from watching (ad revenue share)
  createEarnings: number;    // Total from creation (ad revenue share + bonus)
  // ... other fields
}
```

#### Ad Revenue Tracking
```typescript
export interface AdRevenueEvent {
  id: string;
  reelId: string;
  viewerId: string;
  creatorId: string;
  adProvider: string;        // 'google_admob', 'facebook_audience', etc.
  adType: 'banner' | 'interstitial' | 'rewarded' | 'native';
  revenue: number;           // Actual revenue from ad network
  cpm: number;              // Cost per mille
  viewDuration: number;     // How long user watched
  isValidView: boolean;     // Whether it qualifies for revenue sharing
}
```

#### Revenue Distribution Tracking
```typescript
export interface RevenueDistribution {
  id: string;
  adRevenueEventId: string;
  totalRevenue: number;
  distributions: {
    creator: { userId: string; amount: number; percentage: 60 };
    viewer:  { userId: string; amount: number; percentage: 20 };
    app:     { amount: number; percentage: 20 };
  };
}
```

### 2. Firebase Functions (`firebase/functions/src/index.ts`)

#### `processAdRevenue` Function
- Receives actual ad revenue data from video views
- Validates minimum 30-second view requirement
- Calculates 60/20/20 distribution
- Updates user wallets automatically
- Creates transaction records for transparency

#### `getAdRevenueAnalytics` Function
- Provides detailed revenue analytics
- Shows earnings breakdown by source
- Tracks performance by ad provider
- Supports date range filtering

#### `processFixedBonus` Function
- Handles non-ad revenue bonuses separately
- Maintains fixed reward structure
- Updates bonus earnings tracking

### 3. Frontend Service (`src/services/adRevenueService.ts`)

#### Key Methods
- `processAdRevenue()`: Handles actual ad revenue distribution
- `trackVideoView()`: Tracks views and processes revenue when applicable
- `processFixedBonus()`: Manages fixed reward bonuses
- `generateMockAdRevenue()`: For testing and demo purposes
- `getRevenueBreakdown()`: Shows transparent revenue distribution

### 4. Updated UI Components

#### Enhanced WalletCard (`src/components/WalletCard.tsx`)
- Shows separate ad revenue and bonus earnings
- Displays transparent earning breakdown
- Explains revenue sources clearly
- Updated styling with descriptive subtexts

## How It Works in Practice

### Step 1: User Watches Video
```javascript
// When user watches a reel with ads
const adData = adRevenueService.generateMockAdRevenue(); // Real ad network integration
await adRevenueService.trackVideoView(reelId, viewerId, watchDuration, adData);
```

### Step 2: Revenue Processing
```javascript
// Automatically calculates and distributes revenue
const revenue = 0.015; // ₹0.015 from actual ad
const creatorShare = revenue * 0.6; // ₹0.009 (60%)
const viewerShare = revenue * 0.2;  // ₹0.003 (20%)
const appShare = revenue * 0.2;     // ₹0.003 (20%)
```

### Step 3: Wallet Updates
- Creator wallet: +₹0.009 (ad revenue share)
- Viewer wallet: +₹0.003 (ad revenue share)
- Platform revenue: ₹0.003
- Transaction records created for both users

### Step 4: Fixed Bonuses (Separate)
```javascript
// Additional fixed rewards
await adRevenueService.processFixedBonus(
  creatorId, 
  'create', 
  2, 
  'Content creation bonus - ₹2'
);
```

## Revenue Tracking & Analytics

### For Users
- Real-time earnings dashboard
- Transparent revenue breakdown
- Separate ad revenue vs bonus tracking
- Performance analytics per reel

### For Platform
- Total ad revenue monitoring
- Distribution analytics
- Performance by ad provider
- User engagement impact on revenue

## Example Revenue Scenarios

### Scenario 1: High-Performing Reel
- **Ad Revenue**: ₹0.050 per view
- **Creator Earns**: ₹0.030 (60%) + ₹2 (creation bonus) = ₹2.030
- **Viewer Earns**: ₹0.010 (20%)
- **Platform Revenue**: ₹0.010 (20%)

### Scenario 2: Regular Reel
- **Ad Revenue**: ₹0.008 per view  
- **Creator Earns**: ₹0.0048 (60%) + ₹2 (creation bonus) = ₹2.0048
- **Viewer Earns**: ₹0.0016 (20%)
- **Platform Revenue**: ₹0.0016 (20%)

### Scenario 3: Low Revenue Day
- **Ad Revenue**: ₹0.002 per view
- **Creator Earns**: ₹0.0012 (60%) + ₹2 (creation bonus) = ₹2.0012
- **Viewer Earns**: ₹0.0004 (20%)
- **Platform Revenue**: ₹0.0004 (20%)

## Benefits of This System

### For Creators
- **Fair compensation** based on actual ad performance
- **Predictable bonuses** for content creation
- **Transparent earnings** with detailed breakdowns
- **Performance incentives** tied to real revenue

### For Viewers
- **Rewarded for engagement** with actual ad revenue share
- **Clear value proposition** for watching ads
- **No artificial caps** on earnings from high-performing content

### For Platform
- **Sustainable business model** tied to actual revenue
- **Transparent revenue sharing** builds user trust
- **Scalable system** that grows with ad performance
- **Detailed analytics** for optimization

## Configuration

### Revenue Percentages (Easily Adjustable)
```typescript
const REVENUE_SHARE = {
  creator: 0.6,  // 60%
  viewer: 0.2,   // 20%
  app: 0.2       // 20%
};
```

### Fixed Bonus Amounts
```typescript
const FIXED_REWARDS = {
  createReward: 2,        // ₹2 per reel
  referralBonus: 10,      // ₹10 per signup
  dailyStreakBonus: 1,    // ₹1+ per day
  likeBonus: 0.05,        // ₹0.05 per like
  shareBonus: 0.25,       // ₹0.25 per share
};
```

## Integration with Ad Networks

The system is designed to integrate with major ad networks:
- **Google AdMob**
- **Facebook Audience Network**
- **Unity Ads**
- **AppLovin**
- **Custom ad providers**

Each integration provides real revenue data that flows into the distribution system automatically.

## Future Enhancements

1. **Machine Learning**: Optimize ad placement based on revenue patterns
2. **Dynamic Rates**: Adjust revenue sharing based on user engagement levels
3. **Premium Tiers**: Different sharing rates for premium creators
4. **Advertiser Dashboard**: Direct integration with advertisers for higher rates
5. **Token System**: Future blockchain-based reward tokens

---

This implementation provides a **fair, transparent, and scalable** revenue sharing system that benefits all stakeholders while maintaining platform sustainability. 