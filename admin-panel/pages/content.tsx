import React, { useState, useEffect } from 'react';
import Head from 'next/head';
import { NextPage } from 'next';
import DashboardLayout from '@/components/layout/DashboardLayout';
import { 
  Play,
  Pause,
  Eye,
  Heart,
  MessageCircle,
  Share2,
  Flag,
  Check,
  X,
  MoreHorizontal,
  Filter,
  Search,
  ChevronDown,
  PlayCircle
} from 'lucide-react';
import ReactPlayer from 'react-player';

interface VideoContent {
  id: string;
  title: string;
  description: string;
  videoUrl: string;
  thumbnailUrl: string;
  creator: {
    id: string;
    name: string;
    avatar: string;
    verified: boolean;
  };
  stats: {
    views: number;
    likes: number;
    comments: number;
    shares: number;
  };
  category: string;
  hashtags: string[];
  duration: number;
  uploadDate: Date;
  status: 'active' | 'pending' | 'rejected' | 'flagged';
  reports?: {
    count: number;
    reasons: string[];
  };
  aiAnalysis?: {
    confidence: number;
    topics: string[];
    sentiment: 'positive' | 'neutral' | 'negative';
  };
}

const ContentManagement: NextPage = () => {
  const [videos, setVideos] = useState<VideoContent[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedVideo, setSelectedVideo] = useState<VideoContent | null>(null);
  const [playingVideo, setPlayingVideo] = useState<string | null>(null);
  const [filter, setFilter] = useState<'all' | 'pending' | 'flagged' | 'active'>('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [sortBy, setSortBy] = useState<'recent' | 'views' | 'reports'>('recent');

  useEffect(() => {
    loadVideos();
  }, [filter, sortBy]);

  const loadVideos = async () => {
    setLoading(true);
    
    // Simulate API call
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // Mock data
    const mockVideos: VideoContent[] = [
      {
        id: '1',
        title: 'Amazing Dance Performance',
        description: 'Check out this incredible dance routine! #dance #viral',
        videoUrl: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4',
        thumbnailUrl: 'https://images.unsplash.com/photo-1518611012118-696072aa579a?w=400&h=600&fit=crop',
        creator: {
          id: 'user1',
          name: 'Alex Johnson',
          avatar: 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=40&h=40&fit=crop',
          verified: true
        },
        stats: {
          views: 125000,
          likes: 8900,
          comments: 234,
          shares: 67
        },
        category: 'Dance',
        hashtags: ['dance', 'viral', 'trending'],
        duration: 30,
        uploadDate: new Date('2024-01-15'),
        status: 'active',
        aiAnalysis: {
          confidence: 0.92,
          topics: ['dance', 'performance', 'music'],
          sentiment: 'positive'
        }
      },
      {
        id: '2',
        title: 'Cooking Tutorial',
        description: 'Learn to make the perfect pasta! #cooking #food',
        videoUrl: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ElephantsDream.mp4',
        thumbnailUrl: 'https://images.unsplash.com/photo-1565299624946-b28f40a0ca4b?w=400&h=600&fit=crop',
        creator: {
          id: 'user2',
          name: 'Chef Maria',
          avatar: 'https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=40&h=40&fit=crop',
          verified: false
        },
        stats: {
          views: 45000,
          likes: 2100,
          comments: 89,
          shares: 23
        },
        category: 'Food',
        hashtags: ['cooking', 'food', 'tutorial'],
        duration: 45,
        uploadDate: new Date('2024-01-14'),
        status: 'flagged',
        reports: {
          count: 3,
          reasons: ['Inappropriate content', 'Spam']
        },
        aiAnalysis: {
          confidence: 0.87,
          topics: ['cooking', 'food', 'tutorial'],
          sentiment: 'positive'
        }
      },
      {
        id: '3',
        title: 'Comedy Skit',
        description: 'Hilarious daily life moments 😂 #comedy #funny',
        videoUrl: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4',
        thumbnailUrl: 'https://images.unsplash.com/photo-1595475038665-8de2247f5e15?w=400&h=600&fit=crop',
        creator: {
          id: 'user3',
          name: 'Comedy Central',
          avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=40&h=40&fit=crop',
          verified: true
        },
        stats: {
          views: 89000,
          likes: 5600,
          comments: 178,
          shares: 45
        },
        category: 'Comedy',
        hashtags: ['comedy', 'funny', 'entertainment'],
        duration: 25,
        uploadDate: new Date('2024-01-13'),
        status: 'pending',
        aiAnalysis: {
          confidence: 0.78,
          topics: ['comedy', 'entertainment'],
          sentiment: 'positive'
        }
      }
    ];

    // Filter videos based on current filter
    const filteredVideos = mockVideos.filter(video => {
      if (filter === 'all') return true;
      return video.status === filter;
    });

    setVideos(filteredVideos);
    setLoading(false);
  };

  const handleApprove = async (videoId: string) => {
    setVideos(prev => prev.map(video => 
      video.id === videoId 
        ? { ...video, status: 'active' as const }
        : video
    ));
  };

  const handleReject = async (videoId: string) => {
    setVideos(prev => prev.map(video => 
      video.id === videoId 
        ? { ...video, status: 'rejected' as const }
        : video
    ));
  };

  const formatNumber = (num: number): string => {
    if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
    if (num >= 1000) return `${(num / 1000).toFixed(1)}K`;
    return num.toString();
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active': return 'bg-green-100 text-green-800';
      case 'pending': return 'bg-yellow-100 text-yellow-800';
      case 'flagged': return 'bg-red-100 text-red-800';
      case 'rejected': return 'bg-gray-100 text-gray-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  return (
    <DashboardLayout>
      <Head>
        <title>Content Management - ReelShare Admin</title>
      </Head>

      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
              Content Management
            </h1>
            <p className="mt-2 text-gray-600 dark:text-gray-400">
              Review, moderate, and manage video content
            </p>
          </div>
        </div>

        {/* Filters and Search */}
        <div className="bg-white dark:bg-gray-800 p-4 rounded-lg shadow-card">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between space-y-4 sm:space-y-0">
            {/* Search */}
            <div className="relative flex-1 max-w-lg">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
              <input
                type="text"
                placeholder="Search videos, creators, hashtags..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10 pr-3 py-2 w-full border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              />
            </div>

            {/* Filters */}
            <div className="flex items-center space-x-4">
              <select
                value={filter}
                onChange={(e) => setFilter(e.target.value as any)}
                className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              >
                <option value="all">All Videos</option>
                <option value="pending">Pending Review</option>
                <option value="flagged">Flagged Content</option>
                <option value="active">Active Videos</option>
              </select>

              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as any)}
                className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              >
                <option value="recent">Most Recent</option>
                <option value="views">Most Viewed</option>
                <option value="reports">Most Reported</option>
              </select>
            </div>
          </div>
        </div>

        {/* Video Grid */}
        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[...Array(6)].map((_, i) => (
              <div key={i} className="bg-white dark:bg-gray-800 rounded-lg shadow-card animate-pulse">
                <div className="aspect-video bg-gray-300 dark:bg-gray-600 rounded-t-lg"></div>
                <div className="p-4">
                  <div className="h-4 bg-gray-300 dark:bg-gray-600 rounded mb-2"></div>
                  <div className="h-3 bg-gray-300 dark:bg-gray-600 rounded w-3/4 mb-4"></div>
                  <div className="flex items-center space-x-4">
                    <div className="h-3 bg-gray-300 dark:bg-gray-600 rounded w-16"></div>
                    <div className="h-3 bg-gray-300 dark:bg-gray-600 rounded w-16"></div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {videos.map((video) => (
              <div key={video.id} className="bg-white dark:bg-gray-800 rounded-lg shadow-card hover:shadow-card-hover transition-shadow">
                {/* Video Thumbnail */}
                <div className="relative aspect-video rounded-t-lg overflow-hidden">
                  {playingVideo === video.id ? (
                    <ReactPlayer
                      url={video.videoUrl}
                      width="100%"
                      height="100%"
                      playing
                      controls
                      onEnded={() => setPlayingVideo(null)}
                    />
                  ) : (
                    <>
                      <img
                        src={video.thumbnailUrl}
                        alt={video.title}
                        className="w-full h-full object-cover"
                      />
                      <div className="absolute inset-0 bg-black bg-opacity-20 flex items-center justify-center">
                        <button
                          onClick={() => setPlayingVideo(video.id)}
                          className="bg-white bg-opacity-80 rounded-full p-3 hover:bg-opacity-100 transition-opacity"
                        >
                          <Play className="h-6 w-6 text-gray-800" />
                        </button>
                      </div>
                      <div className="absolute bottom-2 right-2 bg-black bg-opacity-70 text-white text-xs px-2 py-1 rounded">
                        {video.duration}s
                      </div>
                    </>
                  )}
                </div>

                {/* Video Info */}
                <div className="p-4">
                  {/* Status Badge */}
                  <div className="flex items-center justify-between mb-2">
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusColor(video.status)}`}>
                      {video.status}
                    </span>
                    {video.reports && video.reports.count > 0 && (
                      <span className="flex items-center text-red-500 text-xs">
                        <Flag className="h-3 w-3 mr-1" />
                        {video.reports.count} reports
                      </span>
                    )}
                  </div>

                  {/* Title */}
                  <h3 className="font-semibold text-gray-900 dark:text-white mb-1 line-clamp-2">
                    {video.title}
                  </h3>

                  {/* Creator */}
                  <div className="flex items-center mb-3">
                    <img
                      src={video.creator.avatar}
                      alt={video.creator.name}
                      className="h-6 w-6 rounded-full mr-2"
                    />
                    <span className="text-sm text-gray-600 dark:text-gray-400">
                      {video.creator.name}
                    </span>
                    {video.creator.verified && (
                      <Check className="h-4 w-4 text-blue-500 ml-1" />
                    )}
                  </div>

                  {/* Stats */}
                  <div className="flex items-center justify-between text-sm text-gray-500 dark:text-gray-400 mb-4">
                    <div className="flex items-center space-x-4">
                      <span className="flex items-center">
                        <Eye className="h-4 w-4 mr-1" />
                        {formatNumber(video.stats.views)}
                      </span>
                      <span className="flex items-center">
                        <Heart className="h-4 w-4 mr-1" />
                        {formatNumber(video.stats.likes)}
                      </span>
                    </div>
                    <span>{video.category}</span>
                  </div>

                  {/* AI Analysis */}
                  {video.aiAnalysis && (
                    <div className="mb-4 p-2 bg-gray-50 dark:bg-gray-700 rounded">
                      <div className="text-xs text-gray-600 dark:text-gray-400">
                        AI Confidence: {Math.round(video.aiAnalysis.confidence * 100)}%
                      </div>
                      <div className="text-xs text-gray-600 dark:text-gray-400">
                        Topics: {video.aiAnalysis.topics.join(', ')}
                      </div>
                    </div>
                  )}

                  {/* Action Buttons */}
                  <div className="flex items-center justify-between">
                    {video.status === 'pending' || video.status === 'flagged' ? (
                      <div className="flex space-x-2">
                        <button
                          onClick={() => handleApprove(video.id)}
                          className="flex items-center px-3 py-1 bg-green-500 text-white text-sm rounded hover:bg-green-600"
                        >
                          <Check className="h-4 w-4 mr-1" />
                          Approve
                        </button>
                        <button
                          onClick={() => handleReject(video.id)}
                          className="flex items-center px-3 py-1 bg-red-500 text-white text-sm rounded hover:bg-red-600"
                        >
                          <X className="h-4 w-4 mr-1" />
                          Reject
                        </button>
                      </div>
                    ) : (
                      <div className="text-sm text-gray-500 dark:text-gray-400">
                        Uploaded {video.uploadDate.toLocaleDateString()}
                      </div>
                    )}
                    
                    <button className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300">
                      <MoreHorizontal className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {videos.length === 0 && !loading && (
          <div className="text-center py-12">
            <PlayCircle className="mx-auto h-12 w-12 text-gray-400" />
            <h3 className="mt-2 text-sm font-medium text-gray-900 dark:text-white">No videos found</h3>
            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
              Try adjusting your filters or search terms.
            </p>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
};

export default ContentManagement; 