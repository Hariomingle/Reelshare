import React, { useState, useEffect } from 'react';
import Head from 'next/head';
import { NextPage } from 'next';
import DashboardLayout from '@/components/layout/DashboardLayout';
import StatsCard from '@/components/dashboard/StatsCard';
import RevenueChart from '@/components/dashboard/RevenueChart';
import UserGrowthChart from '@/components/dashboard/UserGrowthChart';
import RecentActivity from '@/components/dashboard/RecentActivity';
import TopContent from '@/components/dashboard/TopContent';
import { 
  Users, 
  PlayCircle, 
  DollarSign, 
  TrendingUp,
  Eye,
  Heart,
  Share2,
  AlertTriangle,
  Crown,
  Zap
} from 'lucide-react';

interface DashboardStats {
  totalUsers: number;
  totalVideos: number;
  totalRevenue: number;
  monthlyGrowth: number;
  totalViews: number;
  totalLikes: number;
  totalShares: number;
  pendingReports: number;
  activeCreators: number;
  avgEngagement: number;
}

interface RecentActivityItem {
  id: string;
  type: 'user_signup' | 'video_upload' | 'report' | 'payout' | 'trending';
  title: string;
  description: string;
  timestamp: Date;
  user?: {
    name: string;
    avatar: string;
  };
  metadata?: any;
}

const Dashboard: NextPage = () => {
  const [stats, setStats] = useState<DashboardStats>({
    totalUsers: 0,
    totalVideos: 0,
    totalRevenue: 0,
    monthlyGrowth: 0,
    totalViews: 0,
    totalLikes: 0,
    totalShares: 0,
    pendingReports: 0,
    activeCreators: 0,
    avgEngagement: 0,
  });

  const [recentActivity, setRecentActivity] = useState<RecentActivityItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedPeriod, setSelectedPeriod] = useState<'7d' | '30d' | '90d'>('30d');

  useEffect(() => {
    loadDashboardData();
  }, [selectedPeriod]);

  const loadDashboardData = async () => {
    try {
      setLoading(true);
      
      // Simulate API calls - replace with actual Firebase calls
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // Mock data - replace with real data from Firebase
      setStats({
        totalUsers: 15420,
        totalVideos: 8350,
        totalRevenue: 24580,
        monthlyGrowth: 12.5,
        totalViews: 1250000,
        totalLikes: 89000,
        totalShares: 12400,
        pendingReports: 23,
        activeCreators: 1240,
        avgEngagement: 6.8,
      });

      setRecentActivity([
        {
          id: '1',
          type: 'user_signup',
          title: 'New User Registration',
          description: 'Alex Johnson joined the platform',
          timestamp: new Date(Date.now() - 30 * 60 * 1000),
          user: {
            name: 'Alex Johnson',
            avatar: 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=40&h=40&fit=crop&crop=face'
          }
        },
        {
          id: '2',
          type: 'video_upload',
          title: 'Viral Video Alert',
          description: 'Dance challenge video reached 100K views',
          timestamp: new Date(Date.now() - 45 * 60 * 1000),
          metadata: { views: 100000, category: 'dance' }
        },
        {
          id: '3',
          type: 'report',
          title: 'Content Report',
          description: 'Video reported for inappropriate content',
          timestamp: new Date(Date.now() - 60 * 60 * 1000),
          metadata: { priority: 'high' }
        },
        {
          id: '4',
          type: 'payout',
          title: 'Payout Processed',
          description: '₹15,000 paid to 45 creators',
          timestamp: new Date(Date.now() - 90 * 60 * 1000),
          metadata: { amount: 15000, creators: 45 }
        },
        {
          id: '5',
          type: 'trending',
          title: 'Trending Topic',
          description: '#DanceChallenge is trending with 2.5K videos',
          timestamp: new Date(Date.now() - 120 * 60 * 1000),
          metadata: { hashtag: 'DanceChallenge', count: 2500 }
        }
      ]);

    } catch (error) {
      console.error('Failed to load dashboard data:', error);
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (amount: number): string => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  };

  const formatNumber = (num: number): string => {
    if (num >= 1000000) {
      return `${(num / 1000000).toFixed(1)}M`;
    } else if (num >= 1000) {
      return `${(num / 1000).toFixed(1)}K`;
    }
    return num.toString();
  };

  return (
    <DashboardLayout>
      <Head>
        <title>Dashboard - ReelShare Admin</title>
        <meta name="description" content="ReelShare admin dashboard with analytics and management tools" />
      </Head>

      <div className="space-y-8">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
              Dashboard
            </h1>
            <p className="mt-2 text-gray-600 dark:text-gray-400">
              Welcome back! Here's what's happening with ReelShare today.
            </p>
          </div>
          
          <div className="mt-4 sm:mt-0">
            <select
              value={selectedPeriod}
              onChange={(e) => setSelectedPeriod(e.target.value as '7d' | '30d' | '90d')}
              className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary-500 focus:border-transparent"
            >
              <option value="7d">Last 7 days</option>
              <option value="30d">Last 30 days</option>
              <option value="90d">Last 90 days</option>
            </select>
          </div>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <StatsCard
            title="Total Users"
            value={formatNumber(stats.totalUsers)}
            change={+12.5}
            icon={Users}
            color="blue"
            loading={loading}
          />
          <StatsCard
            title="Total Videos"
            value={formatNumber(stats.totalVideos)}
            change={+8.2}
            icon={PlayCircle}
            color="green"
            loading={loading}
          />
          <StatsCard
            title="Revenue"
            value={formatCurrency(stats.totalRevenue)}
            change={+15.3}
            icon={DollarSign}
            color="primary"
            loading={loading}
          />
          <StatsCard
            title="Growth Rate"
            value={`${stats.monthlyGrowth}%`}
            change={+2.1}
            icon={TrendingUp}
            color="purple"
            loading={loading}
          />
        </div>

        {/* Secondary Stats */}
        <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-4">
          <div className="bg-white dark:bg-gray-800 rounded-lg p-4 shadow-card">
            <div className="flex items-center">
              <Eye className="h-8 w-8 text-blue-500" />
              <div className="ml-3">
                <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Views</p>
                <p className="text-lg font-semibold text-gray-900 dark:text-white">
                  {formatNumber(stats.totalViews)}
                </p>
              </div>
            </div>
          </div>

          <div className="bg-white dark:bg-gray-800 rounded-lg p-4 shadow-card">
            <div className="flex items-center">
              <Heart className="h-8 w-8 text-red-500" />
              <div className="ml-3">
                <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Likes</p>
                <p className="text-lg font-semibold text-gray-900 dark:text-white">
                  {formatNumber(stats.totalLikes)}
                </p>
              </div>
            </div>
          </div>

          <div className="bg-white dark:bg-gray-800 rounded-lg p-4 shadow-card">
            <div className="flex items-center">
              <Share2 className="h-8 w-8 text-green-500" />
              <div className="ml-3">
                <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Shares</p>
                <p className="text-lg font-semibold text-gray-900 dark:text-white">
                  {formatNumber(stats.totalShares)}
                </p>
              </div>
            </div>
          </div>

          <div className="bg-white dark:bg-gray-800 rounded-lg p-4 shadow-card">
            <div className="flex items-center">
              <AlertTriangle className="h-8 w-8 text-yellow-500" />
              <div className="ml-3">
                <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Reports</p>
                <p className="text-lg font-semibold text-gray-900 dark:text-white">
                  {stats.pendingReports}
                </p>
              </div>
            </div>
          </div>

          <div className="bg-white dark:bg-gray-800 rounded-lg p-4 shadow-card">
            <div className="flex items-center">
              <Crown className="h-8 w-8 text-purple-500" />
              <div className="ml-3">
                <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Creators</p>
                <p className="text-lg font-semibold text-gray-900 dark:text-white">
                  {formatNumber(stats.activeCreators)}
                </p>
              </div>
            </div>
          </div>

          <div className="bg-white dark:bg-gray-800 rounded-lg p-4 shadow-card">
            <div className="flex items-center">
              <Zap className="h-8 w-8 text-orange-500" />
              <div className="ml-3">
                <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Engagement</p>
                <p className="text-lg font-semibold text-gray-900 dark:text-white">
                  {stats.avgEngagement}%
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Charts Section */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          <RevenueChart period={selectedPeriod} />
          <UserGrowthChart period={selectedPeriod} />
        </div>

        {/* Content and Activity Section */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2">
            <TopContent />
          </div>
          <div>
            <RecentActivity activities={recentActivity} />
          </div>
        </div>

        {/* Quick Actions */}
        <div className="bg-white dark:bg-gray-800 rounded-lg p-6 shadow-card">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
            Quick Actions
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <button className="flex items-center p-4 border border-gray-200 dark:border-gray-700 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors">
              <Users className="h-6 w-6 text-primary-500 mr-3" />
              <div className="text-left">
                <p className="font-medium text-gray-900 dark:text-white">Manage Users</p>
                <p className="text-sm text-gray-500 dark:text-gray-400">View and moderate users</p>
              </div>
            </button>

            <button className="flex items-center p-4 border border-gray-200 dark:border-gray-700 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors">
              <PlayCircle className="h-6 w-6 text-green-500 mr-3" />
              <div className="text-left">
                <p className="font-medium text-gray-900 dark:text-white">Review Content</p>
                <p className="text-sm text-gray-500 dark:text-gray-400">Moderate videos and posts</p>
              </div>
            </button>

            <button className="flex items-center p-4 border border-gray-200 dark:border-gray-700 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors">
              <DollarSign className="h-6 w-6 text-primary-500 mr-3" />
              <div className="text-left">
                <p className="font-medium text-gray-900 dark:text-white">Process Payouts</p>
                <p className="text-sm text-gray-500 dark:text-gray-400">Handle creator payments</p>
              </div>
            </button>

            <button className="flex items-center p-4 border border-gray-200 dark:border-gray-700 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors">
              <AlertTriangle className="h-6 w-6 text-yellow-500 mr-3" />
              <div className="text-left">
                <p className="font-medium text-gray-900 dark:text-white">Handle Reports</p>
                <p className="text-sm text-gray-500 dark:text-gray-400">Review flagged content</p>
              </div>
            </button>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
};

export default Dashboard; 