import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  ScrollView,
  Alert,
  Dimensions,
  Modal,
  Image,
  ActivityIndicator,
  Platform,
  StatusBar,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { Camera, CameraType, FlashMode } from 'expo-camera';
import { Video, ResizeMode } from 'expo-av';
import * as ImagePicker from 'expo-image-picker';
import * as MediaLibrary from 'expo-media-library';
import { ref, uploadBytesResumable, getDownloadURL } from 'firebase/storage';
import { doc, setDoc, serverTimestamp } from 'firebase/firestore';
import { storage, db } from '../services/firebase';

// Services and Data
import aiService from '../services/aiService';
import { sampleUsers } from '../data/sampleData';
import { COLORS, FONTS, SPACING, BORDER_RADIUS } from '../constants';
import { ReelCategory } from '../types';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

interface VideoUploadScreenProps {
  navigation?: any;
  route?: any;
}

interface VideoInfo {
  uri: string;
  duration: number;
  width: number;
  height: number;
  size: number;
  type: string;
}

interface UploadProgress {
  progress: number;
  stage: 'uploading' | 'analyzing' | 'processing' | 'complete';
  message: string;
}

const VideoUploadScreen: React.FC<VideoUploadScreenProps> = ({ navigation }) => {
  // State
  const [selectedVideo, setSelectedVideo] = useState<VideoInfo | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [showCamera, setShowCamera] = useState(false);
  const [cameraType, setCameraType] = useState<CameraType>(CameraType.back);
  const [flashMode, setFlashMode] = useState<FlashMode>(FlashMode.off);
  const [caption, setCaption] = useState('');
  const [hashtags, setHashtags] = useState<string[]>([]);
  const [suggestedHashtags, setSuggestedHashtags] = useState<string[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<ReelCategory | ''>('');
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<UploadProgress>({
    progress: 0,
    stage: 'uploading',
    message: 'Preparing upload...'
  });
  const [showCategoryModal, setShowCategoryModal] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [analysisResults, setAnalysisResults] = useState<any>(null);

  // Refs
  const cameraRef = useRef<Camera>(null);
  const recordingInterval = useRef<NodeJS.Timeout | null>(null);
  const currentUser = sampleUsers[0]; // Mock current user

  // Categories for selection
  const categories = [
    { key: ReelCategory.DANCE, label: '💃 Dance', icon: 'musical-notes' },
    { key: ReelCategory.COMEDY, label: '😂 Comedy', icon: 'happy' },
    { key: ReelCategory.FITNESS, label: '💪 Fitness', icon: 'fitness' },
    { key: ReelCategory.FOOD, label: '🍝 Food', icon: 'restaurant' },
    { key: ReelCategory.TECHNOLOGY, label: '📱 Tech', icon: 'phone-portrait' },
    { key: ReelCategory.MUSIC, label: '🎵 Music', icon: 'musical-note' },
    { key: ReelCategory.ART, label: '🎨 Art', icon: 'brush' },
    { key: ReelCategory.TRAVEL, label: '✈️ Travel', icon: 'airplane' },
    { key: ReelCategory.LIFESTYLE, label: '🌟 Lifestyle', icon: 'star' },
    { key: ReelCategory.EDUCATION, label: '📚 Education', icon: 'book' },
    { key: ReelCategory.MOTIVATION, label: '🔥 Motivation', icon: 'flame' },
    { key: ReelCategory.ENTERTAINMENT, label: '🎬 Entertainment', icon: 'play-circle' },
  ];

  // Request permissions on mount
  useEffect(() => {
    requestPermissions();
    return () => {
      if (recordingInterval.current) {
        clearInterval(recordingInterval.current);
      }
    };
  }, []);

  // Auto-analyze caption when it changes
  useEffect(() => {
    if (caption.length > 10) {
      analyzeCaption();
    }
  }, [caption]);

  const requestPermissions = async () => {
    const { status: cameraStatus } = await Camera.requestCameraPermissionsAsync();
    const { status: audioStatus } = await Camera.requestMicrophonePermissionsAsync();
    const { status: mediaStatus } = await MediaLibrary.requestPermissionsAsync();
    
    if (cameraStatus !== 'granted' || audioStatus !== 'granted' || mediaStatus !== 'granted') {
      Alert.alert('Permissions Required', 'Camera, microphone, and media library access are required to upload videos.');
    }
  };

  const analyzeCaption = async () => {
    if (!caption.trim()) return;

    try {
      // Use AI service to analyze caption and extract topics
      const result = await aiService.analyzeCaptionWithOpenAI(caption);
      
      if (result.success && result.data) {
        setAnalysisResults(result.data);
        
        // Generate suggested hashtags
        const suggestions = aiService.generateHashtagSuggestions(result.data);
        setSuggestedHashtags(suggestions);
        
        // Auto-select category if confident enough
        if (result.data.confidence > 0.7 && result.data.primaryTopics.length > 0) {
          const topTopic = result.data.primaryTopics[0];
          const matchingCategory = categories.find(cat => 
            cat.key.toLowerCase() === topTopic.toLowerCase()
          );
          if (matchingCategory && !selectedCategory) {
            setSelectedCategory(matchingCategory.key);
          }
        }
      }
    } catch (error) {
      console.error('Caption analysis error:', error);
    }
  };

  const extractHashtagsFromCaption = (text: string) => {
    const hashtagMatches = text.match(/#[\w]+/g) || [];
    const extractedHashtags = hashtagMatches.map(tag => tag.substring(1).toLowerCase());
    setHashtags([...new Set(extractedHashtags)]);
  };

  const handleCaptionChange = (text: string) => {
    setCaption(text);
    extractHashtagsFromCaption(text);
  };

  const addHashtag = (hashtag: string) => {
    if (!hashtags.includes(hashtag) && hashtags.length < 10) {
      const newHashtags = [...hashtags, hashtag];
      setHashtags(newHashtags);
      
      // Add to caption if not already there
      if (!caption.includes(`#${hashtag}`)) {
        setCaption(prev => `${prev} #${hashtag}`);
      }
    }
  };

  const removeHashtag = (hashtag: string) => {
    setHashtags(hashtags.filter(tag => tag !== hashtag));
    // Remove from caption
    setCaption(prev => prev.replace(`#${hashtag}`, '').trim());
  };

  const openCamera = () => {
    setShowCamera(true);
  };

  const closeCamera = () => {
    setShowCamera(false);
    setIsRecording(false);
    setRecordingTime(0);
    if (recordingInterval.current) {
      clearInterval(recordingInterval.current);
    }
  };

  const startRecording = async () => {
    if (!cameraRef.current) return;

    try {
      setIsRecording(true);
      setRecordingTime(0);
      
      // Start recording timer
      recordingInterval.current = setInterval(() => {
        setRecordingTime(prev => {
          if (prev >= 60) {
            stopRecording();
            return 60;
          }
          return prev + 1;
        });
      }, 1000);

      const recordingOptions = {
        quality: '720p' as const,
        maxDuration: 60,
        mute: false,
      };

      const videoData = await cameraRef.current.recordAsync(recordingOptions);
      
      if (videoData && videoData.uri) {
        // Get video info
        const videoInfo: VideoInfo = {
          uri: videoData.uri,
          duration: recordingTime,
          width: 720,
          height: 1280,
          size: 0, // Will be calculated later
          type: 'video/mp4'
        };
        
        setSelectedVideo(videoInfo);
        closeCamera();
      }
    } catch (error) {
      console.error('Recording error:', error);
      Alert.alert('Recording Error', 'Failed to record video. Please try again.');
      setIsRecording(false);
    }
  };

  const stopRecording = async () => {
    if (!cameraRef.current || !isRecording) return;

    try {
      await cameraRef.current.stopRecording();
      setIsRecording(false);
      if (recordingInterval.current) {
        clearInterval(recordingInterval.current);
      }
    } catch (error) {
      console.error('Stop recording error:', error);
    }
  };

  const pickVideoFromGallery = async () => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Videos,
        allowsEditing: true,
        quality: 0.8,
        videoMaxDuration: 60,
      });

      if (!result.canceled && result.assets[0]) {
        const asset = result.assets[0];
        
        // Validate video duration
        if (asset.duration && (asset.duration < 15000 || asset.duration > 60000)) {
          Alert.alert('Invalid Duration', 'Videos must be between 15-60 seconds long.');
          return;
        }

        const videoInfo: VideoInfo = {
          uri: asset.uri,
          duration: asset.duration ? Math.round(asset.duration / 1000) : 30,
          width: asset.width || 720,
          height: asset.height || 1280,
          size: asset.fileSize || 0,
          type: asset.type || 'video/mp4'
        };

        setSelectedVideo(videoInfo);
      }
    } catch (error) {
      console.error('Gallery picker error:', error);
      Alert.alert('Error', 'Failed to select video from gallery.');
    }
  };

  const validateVideoForUpload = (): boolean => {
    if (!selectedVideo) {
      Alert.alert('No Video', 'Please select or record a video first.');
      return false;
    }

    if (selectedVideo.duration < 15 || selectedVideo.duration > 60) {
      Alert.alert('Invalid Duration', 'Videos must be between 15-60 seconds long.');
      return false;
    }

    if (!caption.trim()) {
      Alert.alert('Caption Required', 'Please add a caption to describe your video.');
      return false;
    }

    if (!selectedCategory) {
      Alert.alert('Category Required', 'Please select a category for your video.');
      return false;
    }

    return true;
  };

  const uploadVideo = async () => {
    if (!validateVideoForUpload()) return;

    try {
      setIsUploading(true);
      setUploadProgress({
        progress: 0,
        stage: 'uploading',
        message: 'Uploading video...'
      });

      // Create unique filename
      const timestamp = Date.now();
      const fileName = `videos/${currentUser.id}/${timestamp}.mp4`;
      const videoRef = ref(storage, fileName);

      // Get video blob for upload
      const response = await fetch(selectedVideo!.uri);
      const blob = await response.blob();

      // Upload video with progress tracking
      const uploadTask = uploadBytesResumable(videoRef, blob);

      uploadTask.on('state_changed', 
        (snapshot) => {
          const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
          setUploadProgress(prev => ({
            ...prev,
            progress: Math.round(progress),
            message: `Uploading... ${Math.round(progress)}%`
          }));
        },
        (error) => {
          console.error('Upload error:', error);
          Alert.alert('Upload Error', 'Failed to upload video. Please try again.');
          setIsUploading(false);
        },
        async () => {
          // Upload completed, get download URL
          const videoUrl = await getDownloadURL(uploadTask.snapshot.ref);
          
          // Process with AI analysis
          setUploadProgress({
            progress: 100,
            stage: 'analyzing',
            message: 'Analyzing content with AI...'
          });

          await processVideoWithAI(videoUrl);
        }
      );

    } catch (error) {
      console.error('Upload process error:', error);
      Alert.alert('Upload Error', 'Failed to process video upload.');
      setIsUploading(false);
    }
  };

  const processVideoWithAI = async (videoUrl: string) => {
    try {
      setUploadProgress({
        progress: 100,
        stage: 'processing',
        message: 'Processing video data...'
      });

      // Analyze caption and get topics
      const analysisResult = await aiService.analyzeCaptionWithOpenAI(caption);
      
      // Create reel document for Firestore
      const reelId = `reel_${Date.now()}_${currentUser.id}`;
      const reelData = {
        id: reelId,
        userId: currentUser.id,
        videoUrl,
        thumbnailUrl: '', // Generate thumbnail separately
        caption: caption.trim(),
        hashtags,
        category: selectedCategory,
        duration: selectedVideo!.duration,
        likes: 0,
        comments: 0,
        shares: 0,
        views: 0,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        isActive: true,
        isFeatured: false,
        reportCount: 0,
        // AI Analysis results
        aiAnalysis: analysisResult.success ? analysisResult.data : null,
        embedding: [], // Will be populated by Cloud Function
        music: null,
        effects: [],
      };

      // Save to Firestore
      await setDoc(doc(db, 'reels', reelId), reelData);

      // Process interest matching
      if (analysisResult.success && analysisResult.data) {
        const topics = analysisResult.data.primaryTopics;
        await aiService.updateUserInterests(currentUser.id, topics, 'view');
      }

      setUploadProgress({
        progress: 100,
        stage: 'complete',
        message: 'Video uploaded successfully!'
      });

      // Show success and navigate
      setTimeout(() => {
        setIsUploading(false);
        Alert.alert(
          'Success!', 
          'Your video has been uploaded and is being processed for recommendations.',
          [
            {
              text: 'OK',
              onPress: () => {
                // Reset form
                setSelectedVideo(null);
                setCaption('');
                setHashtags([]);
                setSelectedCategory('');
                setSuggestedHashtags([]);
                setAnalysisResults(null);
                
                // Navigate back or to feed
                navigation?.goBack();
              }
            }
          ]
        );
      }, 2000);

    } catch (error) {
      console.error('AI processing error:', error);
      setIsUploading(false);
      Alert.alert('Processing Error', 'Video uploaded but AI analysis failed. Video will still be available.');
    }
  };

  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  // Camera Screen Component
  const renderCameraScreen = () => (
    <Modal visible={showCamera} animationType="slide" statusBarTranslucent>
      <View style={styles.cameraContainer}>
        <StatusBar hidden />
        <Camera
          ref={cameraRef}
          style={styles.camera}
          type={cameraType}
          flashMode={flashMode}
        >
          {/* Camera Controls Overlay */}
          <View style={styles.cameraOverlay}>
            {/* Top Controls */}
            <View style={styles.topControls}>
              <TouchableOpacity style={styles.controlButton} onPress={closeCamera}>
                <Ionicons name="close" size={24} color="white" />
              </TouchableOpacity>
              
              <View style={styles.recordingInfo}>
                {isRecording && (
                  <>
                    <View style={styles.recordingDot} />
                    <Text style={styles.recordingTime}>{formatTime(recordingTime)}</Text>
                  </>
                )}
              </View>

              <TouchableOpacity 
                style={styles.controlButton} 
                onPress={() => setFlashMode(flashMode === FlashMode.off ? FlashMode.on : FlashMode.off)}
              >
                <Ionicons 
                  name={flashMode === FlashMode.off ? "flash-off" : "flash"} 
                  size={24} 
                  color="white" 
                />
              </TouchableOpacity>
            </View>

            {/* Bottom Controls */}
            <View style={styles.bottomControls}>
              <TouchableOpacity style={styles.galleryButton} onPress={pickVideoFromGallery}>
                <Ionicons name="images" size={24} color="white" />
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.recordButton, isRecording && styles.recordingButton]}
                onPress={isRecording ? stopRecording : startRecording}
                disabled={recordingTime >= 60}
              >
                <View style={[styles.recordButtonInner, isRecording && styles.recordingButtonInner]} />
              </TouchableOpacity>

              <TouchableOpacity 
                style={styles.flipButton}
                onPress={() => setCameraType(
                  cameraType === CameraType.back ? CameraType.front : CameraType.back
                )}
              >
                <Ionicons name="camera-reverse" size={24} color="white" />
              </TouchableOpacity>
            </View>

            {/* Recording Progress */}
            {isRecording && (
              <View style={styles.progressContainer}>
                <View style={[styles.progressBar, { width: `${(recordingTime / 60) * 100}%` }]} />
              </View>
            )}
          </View>
        </Camera>
      </View>
    </Modal>
  );

  // Category Selection Modal
  const renderCategoryModal = () => (
    <Modal visible={showCategoryModal} transparent animationType="slide">
      <View style={styles.modalOverlay}>
        <View style={styles.categoryModal}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Select Category</Text>
            <TouchableOpacity onPress={() => setShowCategoryModal(false)}>
              <Ionicons name="close" size={24} color={COLORS.text} />
            </TouchableOpacity>
          </View>
          
          <ScrollView style={styles.categoryList}>
            {categories.map((category) => (
              <TouchableOpacity
                key={category.key}
                style={[
                  styles.categoryItem,
                  selectedCategory === category.key && styles.selectedCategoryItem
                ]}
                onPress={() => {
                  setSelectedCategory(category.key);
                  setShowCategoryModal(false);
                }}
              >
                <Ionicons 
                  name={category.icon as any} 
                  size={24} 
                  color={selectedCategory === category.key ? COLORS.primary : COLORS.textSecondary} 
                />
                <Text style={[
                  styles.categoryLabel,
                  selectedCategory === category.key && styles.selectedCategoryLabel
                ]}>
                  {category.label}
                </Text>
                {selectedCategory === category.key && (
                  <Ionicons name="checkmark" size={20} color={COLORS.primary} />
                )}
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );

  // Upload Progress Modal
  const renderUploadProgress = () => (
    <Modal visible={isUploading} transparent>
      <View style={styles.uploadOverlay}>
        <View style={styles.uploadModal}>
          <Text style={styles.uploadTitle}>Uploading Video</Text>
          
          <View style={styles.progressCircle}>
            <Text style={styles.progressText}>{uploadProgress.progress}%</Text>
          </View>
          
          <Text style={styles.uploadStage}>{uploadProgress.message}</Text>
          
          {uploadProgress.stage === 'analyzing' && (
            <View style={styles.aiAnalysisInfo}>
              <Ionicons name="brain" size={20} color={COLORS.primary} />
              <Text style={styles.aiText}>AI analyzing your content...</Text>
            </View>
          )}
          
          <ActivityIndicator size="large" color={COLORS.primary} style={styles.uploadSpinner} />
        </View>
      </View>
    </Modal>
  );

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor={COLORS.background} />
      
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation?.goBack()}>
          <Ionicons name="arrow-back" size={24} color={COLORS.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Upload Video</Text>
        <TouchableOpacity 
          style={[styles.uploadButton, (!selectedVideo || !caption.trim() || !selectedCategory) && styles.uploadButtonDisabled]}
          onPress={uploadVideo}
          disabled={!selectedVideo || !caption.trim() || !selectedCategory || isUploading}
        >
          <Text style={styles.uploadButtonText}>Upload</Text>
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* Video Selection/Preview */}
        <View style={styles.videoSection}>
          {selectedVideo ? (
            <View style={styles.videoPreview}>
              <Video
                source={{ uri: selectedVideo.uri }}
                style={styles.previewVideo}
                resizeMode={ResizeMode.COVER}
                shouldPlay={false}
                isLooping
                isMuted
              />
              <View style={styles.videoInfo}>
                <Text style={styles.videoDuration}>{formatTime(selectedVideo.duration)}</Text>
                <TouchableOpacity 
                  style={styles.changeVideoButton}
                  onPress={() => setSelectedVideo(null)}
                >
                  <Ionicons name="swap-horizontal" size={16} color={COLORS.primary} />
                  <Text style={styles.changeVideoText}>Change</Text>
                </TouchableOpacity>
              </View>
            </View>
          ) : (
            <View style={styles.videoSelection}>
              <View style={styles.selectionOptions}>
                <TouchableOpacity style={styles.optionButton} onPress={openCamera}>
                  <LinearGradient
                    colors={[COLORS.primary, COLORS.secondary]}
                    style={styles.optionGradient}
                  >
                    <Ionicons name="camera" size={32} color="white" />
                  </LinearGradient>
                  <Text style={styles.optionText}>Record</Text>
                </TouchableOpacity>
                
                <TouchableOpacity style={styles.optionButton} onPress={pickVideoFromGallery}>
                  <LinearGradient
                    colors={[COLORS.accent, COLORS.info]}
                    style={styles.optionGradient}
                  >
                    <Ionicons name="images" size={32} color="white" />
                  </LinearGradient>
                  <Text style={styles.optionText}>Gallery</Text>
                </TouchableOpacity>
              </View>
              <Text style={styles.selectionHint}>Videos must be 15-60 seconds long</Text>
            </View>
          )}
        </View>

        {/* Caption Input */}
        <View style={styles.captionSection}>
          <Text style={styles.sectionTitle}>Caption</Text>
          <TextInput
            style={styles.captionInput}
            placeholder="Write a caption... Use #hashtags"
            placeholderTextColor={COLORS.textSecondary}
            value={caption}
            onChangeText={handleCaptionChange}
            multiline
            maxLength={2200}
            textAlignVertical="top"
          />
          <Text style={styles.characterCount}>{caption.length}/2200</Text>
        </View>

        {/* AI Analysis Results */}
        {analysisResults && (
          <View style={styles.analysisSection}>
            <View style={styles.analysisHeader}>
              <Ionicons name="brain" size={20} color={COLORS.primary} />
              <Text style={styles.sectionTitle}>AI Analysis</Text>
            </View>
            <View style={styles.analysisContent}>
              <Text style={styles.analysisLabel}>Detected Topics:</Text>
              <View style={styles.topicTags}>
                {analysisResults.primaryTopics.map((topic: string, index: number) => (
                  <View key={index} style={styles.topicTag}>
                    <Text style={styles.topicTagText}>{topic}</Text>
                  </View>
                ))}
              </View>
              <Text style={styles.analysisLabel}>Sentiment: 
                <Text style={[styles.sentimentText, { color: 
                  analysisResults.sentiment === 'positive' ? COLORS.success :
                  analysisResults.sentiment === 'negative' ? COLORS.error : COLORS.warning
                }]}> {analysisResults.sentiment}</Text>
              </Text>
              <Text style={styles.analysisLabel}>Confidence: {Math.round(analysisResults.confidence * 100)}%</Text>
            </View>
          </View>
        )}

        {/* Hashtag Section */}
        <View style={styles.hashtagSection}>
          <Text style={styles.sectionTitle}>Hashtags ({hashtags.length}/10)</Text>
          
          {/* Current Hashtags */}
          {hashtags.length > 0 && (
            <View style={styles.currentHashtags}>
              {hashtags.map((hashtag, index) => (
                <TouchableOpacity 
                  key={index} 
                  style={styles.hashtagChip}
                  onPress={() => removeHashtag(hashtag)}
                >
                  <Text style={styles.hashtagText}>#{hashtag}</Text>
                  <Ionicons name="close-circle" size={16} color={COLORS.primary} />
                </TouchableOpacity>
              ))}
            </View>
          )}

          {/* Suggested Hashtags */}
          {suggestedHashtags.length > 0 && (
            <>
              <Text style={styles.suggestedTitle}>AI Suggested:</Text>
              <View style={styles.suggestedHashtags}>
                {suggestedHashtags.map((hashtag, index) => (
                  <TouchableOpacity 
                    key={index} 
                    style={[styles.suggestedChip, hashtags.includes(hashtag) && styles.addedChip]}
                    onPress={() => addHashtag(hashtag)}
                    disabled={hashtags.includes(hashtag)}
                  >
                    <Ionicons 
                      name={hashtags.includes(hashtag) ? "checkmark" : "add"} 
                      size={14} 
                      color={hashtags.includes(hashtag) ? COLORS.success : COLORS.primary} 
                    />
                    <Text style={[styles.suggestedText, hashtags.includes(hashtag) && styles.addedText]}>
                      #{hashtag}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </>
          )}
        </View>

        {/* Category Selection */}
        <View style={styles.categorySection}>
          <Text style={styles.sectionTitle}>Category</Text>
          <TouchableOpacity 
            style={styles.categorySelector}
            onPress={() => setShowCategoryModal(true)}
          >
            {selectedCategory ? (
              <>
                <Text style={styles.selectedCategoryText}>
                  {categories.find(cat => cat.key === selectedCategory)?.label}
                </Text>
                <Ionicons name="checkmark-circle" size={20} color={COLORS.success} />
              </>
            ) : (
              <>
                <Text style={styles.categorySelectorText}>Select a category</Text>
                <Ionicons name="chevron-down" size={20} color={COLORS.textSecondary} />
              </>
            )}
          </TouchableOpacity>
        </View>

        {/* Upload Instructions */}
        <View style={styles.instructionsSection}>
          <Text style={styles.instructionsTitle}>📝 Upload Tips</Text>
          <Text style={styles.instructionText}>• Keep videos between 15-60 seconds</Text>
          <Text style={styles.instructionText}>• Add engaging captions with hashtags</Text>
          <Text style={styles.instructionText}>• Select the most relevant category</Text>
          <Text style={styles.instructionText}>• Our AI will analyze your content for better reach</Text>
        </View>
      </ScrollView>

      {/* Modals */}
      {renderCameraScreen()}
      {renderCategoryModal()}
      {renderUploadProgress()}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.md,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  headerTitle: {
    fontSize: FONTS.size.xl,
    fontWeight: FONTS.weight.bold,
    color: COLORS.text,
  },
  uploadButton: {
    backgroundColor: COLORS.primary,
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.sm,
    borderRadius: BORDER_RADIUS.md,
  },
  uploadButtonDisabled: {
    backgroundColor: COLORS.textSecondary,
    opacity: 0.5,
  },
  uploadButtonText: {
    color: COLORS.text,
    fontSize: FONTS.size.md,
    fontWeight: FONTS.weight.semibold,
  },
  content: {
    flex: 1,
    paddingHorizontal: SPACING.lg,
  },
  
  // Video Selection
  videoSection: {
    marginVertical: SPACING.lg,
  },
  videoSelection: {
    alignItems: 'center',
    paddingVertical: SPACING.xl * 2,
  },
  selectionOptions: {
    flexDirection: 'row',
    gap: SPACING.xl,
  },
  optionButton: {
    alignItems: 'center',
    gap: SPACING.sm,
  },
  optionGradient: {
    width: 80,
    height: 80,
    borderRadius: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  optionText: {
    color: COLORS.text,
    fontSize: FONTS.size.md,
    fontWeight: FONTS.weight.medium,
  },
  selectionHint: {
    color: COLORS.textSecondary,
    fontSize: FONTS.size.sm,
    marginTop: SPACING.lg,
    textAlign: 'center',
  },
  videoPreview: {
    borderRadius: BORDER_RADIUS.lg,
    overflow: 'hidden',
    backgroundColor: COLORS.surface,
  },
  previewVideo: {
    width: '100%',
    height: 200,
  },
  videoInfo: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: SPACING.md,
  },
  videoDuration: {
    color: COLORS.text,
    fontSize: FONTS.size.md,
    fontWeight: FONTS.weight.medium,
  },
  changeVideoButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.xs,
  },
  changeVideoText: {
    color: COLORS.primary,
    fontSize: FONTS.size.sm,
    fontWeight: FONTS.weight.medium,
  },

  // Caption Section
  captionSection: {
    marginVertical: SPACING.lg,
  },
  sectionTitle: {
    fontSize: FONTS.size.lg,
    fontWeight: FONTS.weight.semibold,
    color: COLORS.text,
    marginBottom: SPACING.md,
  },
  captionInput: {
    backgroundColor: COLORS.surface,
    borderRadius: BORDER_RADIUS.md,
    padding: SPACING.md,
    color: COLORS.text,
    fontSize: FONTS.size.md,
    minHeight: 100,
    maxHeight: 150,
  },
  characterCount: {
    color: COLORS.textSecondary,
    fontSize: FONTS.size.sm,
    textAlign: 'right',
    marginTop: SPACING.xs,
  },

  // AI Analysis Section
  analysisSection: {
    marginVertical: SPACING.lg,
    backgroundColor: COLORS.surface,
    borderRadius: BORDER_RADIUS.lg,
    padding: SPACING.lg,
  },
  analysisHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    marginBottom: SPACING.md,
  },
  analysisContent: {
    gap: SPACING.sm,
  },
  analysisLabel: {
    color: COLORS.text,
    fontSize: FONTS.size.md,
    fontWeight: FONTS.weight.medium,
  },
  topicTags: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: SPACING.xs,
    marginVertical: SPACING.xs,
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
  sentimentText: {
    fontWeight: FONTS.weight.semibold,
    textTransform: 'capitalize',
  },

  // Hashtag Section
  hashtagSection: {
    marginVertical: SPACING.lg,
  },
  currentHashtags: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: SPACING.xs,
    marginBottom: SPACING.md,
  },
  hashtagChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.primary,
    borderRadius: BORDER_RADIUS.full,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    gap: SPACING.xs,
  },
  hashtagText: {
    color: COLORS.text,
    fontSize: FONTS.size.sm,
    fontWeight: FONTS.weight.medium,
  },
  suggestedTitle: {
    color: COLORS.textSecondary,
    fontSize: FONTS.size.md,
    fontWeight: FONTS.weight.medium,
    marginBottom: SPACING.sm,
  },
  suggestedHashtags: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: SPACING.xs,
  },
  suggestedChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.surface,
    borderColor: COLORS.primary,
    borderWidth: 1,
    borderRadius: BORDER_RADIUS.full,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    gap: SPACING.xs,
  },
  addedChip: {
    backgroundColor: COLORS.success + '20',
    borderColor: COLORS.success,
  },
  suggestedText: {
    color: COLORS.primary,
    fontSize: FONTS.size.sm,
  },
  addedText: {
    color: COLORS.success,
  },

  // Category Section
  categorySection: {
    marginVertical: SPACING.lg,
  },
  categorySelector: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: COLORS.surface,
    borderRadius: BORDER_RADIUS.md,
    padding: SPACING.lg,
  },
  categorySelectorText: {
    color: COLORS.textSecondary,
    fontSize: FONTS.size.md,
  },
  selectedCategoryText: {
    color: COLORS.text,
    fontSize: FONTS.size.md,
    fontWeight: FONTS.weight.medium,
  },

  // Instructions Section
  instructionsSection: {
    marginVertical: SPACING.lg,
    backgroundColor: COLORS.surface,
    borderRadius: BORDER_RADIUS.lg,
    padding: SPACING.lg,
    marginBottom: SPACING.xl * 2,
  },
  instructionsTitle: {
    fontSize: FONTS.size.lg,
    fontWeight: FONTS.weight.semibold,
    color: COLORS.text,
    marginBottom: SPACING.md,
  },
  instructionText: {
    color: COLORS.textSecondary,
    fontSize: FONTS.size.sm,
    lineHeight: 20,
    marginBottom: SPACING.xs,
  },

  // Camera Screen
  cameraContainer: {
    flex: 1,
    backgroundColor: 'black',
  },
  camera: {
    flex: 1,
  },
  cameraOverlay: {
    flex: 1,
    justifyContent: 'space-between',
  },
  topControls: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: SPACING.lg,
    paddingTop: 50,
  },
  controlButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  recordingInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
  },
  recordingDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: COLORS.error,
  },
  recordingTime: {
    color: 'white',
    fontSize: FONTS.size.lg,
    fontWeight: FONTS.weight.bold,
  },
  bottomControls: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: SPACING.xl,
    paddingBottom: 50,
  },
  galleryButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(255,255,255,0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  recordButton: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: 'white',
    justifyContent: 'center',
    alignItems: 'center',
  },
  recordingButton: {
    backgroundColor: COLORS.error,
  },
  recordButtonInner: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: COLORS.error,
  },
  recordingButtonInner: {
    borderRadius: 8,
    backgroundColor: 'white',
  },
  flipButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(255,255,255,0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  progressContainer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 4,
    backgroundColor: 'rgba(255,255,255,0.3)',
  },
  progressBar: {
    height: 4,
    backgroundColor: COLORS.error,
  },

  // Category Modal
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.8)',
    justifyContent: 'flex-end',
  },
  categoryModal: {
    backgroundColor: COLORS.background,
    borderTopLeftRadius: BORDER_RADIUS.xl,
    borderTopRightRadius: BORDER_RADIUS.xl,
    maxHeight: '70%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: SPACING.lg,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  modalTitle: {
    fontSize: FONTS.size.xl,
    fontWeight: FONTS.weight.bold,
    color: COLORS.text,
  },
  categoryList: {
    padding: SPACING.lg,
  },
  categoryItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: SPACING.lg,
    borderRadius: BORDER_RADIUS.md,
    marginBottom: SPACING.sm,
    gap: SPACING.md,
  },
  selectedCategoryItem: {
    backgroundColor: COLORS.primary + '20',
    borderColor: COLORS.primary,
    borderWidth: 1,
  },
  categoryLabel: {
    flex: 1,
    fontSize: FONTS.size.md,
    color: COLORS.text,
  },
  selectedCategoryLabel: {
    fontWeight: FONTS.weight.semibold,
    color: COLORS.primary,
  },

  // Upload Progress Modal
  uploadOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.9)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  uploadModal: {
    backgroundColor: COLORS.background,
    borderRadius: BORDER_RADIUS.xl,
    padding: SPACING.xl,
    alignItems: 'center',
    width: '80%',
  },
  uploadTitle: {
    fontSize: FONTS.size.xl,
    fontWeight: FONTS.weight.bold,
    color: COLORS.text,
    marginBottom: SPACING.lg,
  },
  progressCircle: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: COLORS.primary + '20',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: SPACING.lg,
  },
  progressText: {
    fontSize: FONTS.size.xl,
    fontWeight: FONTS.weight.bold,
    color: COLORS.primary,
  },
  uploadStage: {
    fontSize: FONTS.size.md,
    color: COLORS.textSecondary,
    textAlign: 'center',
    marginBottom: SPACING.lg,
  },
  aiAnalysisInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    marginBottom: SPACING.md,
  },
  aiText: {
    color: COLORS.primary,
    fontSize: FONTS.size.sm,
    fontWeight: FONTS.weight.medium,
  },
  uploadSpinner: {
    marginTop: SPACING.md,
  },
});

export default VideoUploadScreen; 