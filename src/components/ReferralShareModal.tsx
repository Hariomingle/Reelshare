import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  TextInput,
  Image,
  Share,
  Clipboard,
  Alert,
  Dimensions
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import referralService, { ShareData } from '../services/referralService';

const { width, height } = Dimensions.get('window');

interface ReferralShareModalProps {
  visible: boolean;
  onClose: () => void;
  referralCode: string;
  username: string;
}

const ReferralShareModal: React.FC<ReferralShareModalProps> = ({
  visible,
  onClose,
  referralCode,
  username
}) => {
  const [shareData, setShareData] = useState<ShareData | null>(null);
  const [customMessage, setCustomMessage] = useState('');
  const [selectedMessageType, setSelectedMessageType] = useState<'casual' | 'excited' | 'professional' | 'benefits' | 'custom'>('casual');
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (visible && referralCode) {
      loadShareData();
    }
  }, [visible, referralCode]);

  const loadShareData = async () => {
    setLoading(true);
    try {
      const result = await referralService.generateShareContent(referralCode, customMessage);
      if (result.success && result.data) {
        setShareData(result.data);
      }
    } catch (error) {
      console.error('Error loading share data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleShare = async (platform?: 'whatsapp' | 'telegram' | 'facebook' | 'twitter' | 'copy' | 'system') => {
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      
      const result = await referralService.shareReferralCode(
        referralCode,
        selectedMessageType === 'custom' ? customMessage : undefined,
        platform
      );

      if (result.success) {
        if (platform === 'copy') {
          setCopied(true);
          setTimeout(() => setCopied(false), 2000);
        }
        
        // Track sharing analytics
        await referralService.trackReferralClick(referralCode, platform || 'system');
      }
    } catch (error) {
      console.error('Error sharing:', error);
      Alert.alert('Error', 'Failed to share referral code');
    }
  };

  const getPresetMessage = () => {
    const messages = referralService.getReferralMessages(referralCode, username);
    return messages[selectedMessageType as keyof typeof messages];
  };

  const getCurrentMessage = () => {
    return selectedMessageType === 'custom' ? customMessage : getPresetMessage();
  };

  if (!shareData && !loading) {
    return null;
  }

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <View style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={onClose} style={styles.closeButton}>
            <Ionicons name="close" size={24} color="#FFFFFF" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Share Referral Code</Text>
          <View style={styles.headerSpacer} />
        </View>

        <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
          {/* Referral Code Display */}
          <LinearGradient
            colors={['#FF6B35', '#F7931E']}
            style={styles.codeCard}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
          >
            <Text style={styles.codeLabel}>Your Referral Code</Text>
            <Text style={styles.codeText}>{referralCode}</Text>
            <Text style={styles.codeDescription}>
              Friends who sign up with this code get ₹5, and you earn 5% from their revenue!
            </Text>
          </LinearGradient>

          {/* QR Code Section */}
          <View style={styles.qrSection}>
            <Text style={styles.sectionTitle}>QR Code</Text>
            <View style={styles.qrContainer}>
              {shareData?.qrCodeUrl && (
                <Image
                  source={{ uri: shareData.qrCodeUrl }}
                  style={styles.qrCode}
                  resizeMode="contain"
                />
              )}
              <Text style={styles.qrDescription}>
                Let friends scan this QR code to join instantly
              </Text>
            </View>
          </View>

          {/* Message Templates */}
          <View style={styles.messageSection}>
            <Text style={styles.sectionTitle}>Choose Message Style</Text>
            
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.messageTypeScroll}>
              {[
                { key: 'casual', label: '😊 Casual', icon: 'chatbubble-outline' },
                { key: 'excited', label: '🎉 Excited', icon: 'flash-outline' },
                { key: 'professional', label: '💼 Professional', icon: 'briefcase-outline' },
                { key: 'benefits', label: '🎯 Benefits', icon: 'list-outline' },
                { key: 'custom', label: '✏️ Custom', icon: 'create-outline' }
              ].map((type) => (
                <TouchableOpacity
                  key={type.key}
                  style={[
                    styles.messageTypeButton,
                    selectedMessageType === type.key && styles.messageTypeButtonActive
                  ]}
                  onPress={() => setSelectedMessageType(type.key as any)}
                >
                  <Ionicons 
                    name={type.icon as any} 
                    size={20} 
                    color={selectedMessageType === type.key ? '#FF6B35' : '#666666'} 
                  />
                  <Text style={[
                    styles.messageTypeLabel,
                    selectedMessageType === type.key && styles.messageTypeLabelActive
                  ]}>
                    {type.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>

            {/* Message Preview/Editor */}
            <View style={styles.messagePreview}>
              {selectedMessageType === 'custom' ? (
                <TextInput
                  style={styles.customMessageInput}
                  value={customMessage}
                  onChangeText={setCustomMessage}
                  placeholder="Write your custom message..."
                  placeholderTextColor="#999999"
                  multiline
                  maxLength={500}
                />
              ) : (
                <Text style={styles.messageText}>{getPresetMessage()}</Text>
              )}
            </View>
          </View>

          {/* Share Options */}
          <View style={styles.shareSection}>
            <Text style={styles.sectionTitle}>Share Via</Text>
            
            <View style={styles.shareButtonsGrid}>
              {/* Copy Link */}
              <TouchableOpacity
                style={[styles.shareButton, copied && styles.shareButtonSuccess]}
                onPress={() => handleShare('copy')}
              >
                <Ionicons 
                  name={copied ? "checkmark" : "copy-outline"} 
                  size={24} 
                  color={copied ? "#FFFFFF" : "#FF6B35"} 
                />
                <Text style={[styles.shareButtonText, copied && styles.shareButtonTextSuccess]}>
                  {copied ? 'Copied!' : 'Copy'}
                </Text>
              </TouchableOpacity>

              {/* WhatsApp */}
              <TouchableOpacity
                style={styles.shareButton}
                onPress={() => handleShare('whatsapp')}
              >
                <Ionicons name="logo-whatsapp" size={24} color="#25D366" />
                <Text style={styles.shareButtonText}>WhatsApp</Text>
              </TouchableOpacity>

              {/* Telegram */}
              <TouchableOpacity
                style={styles.shareButton}
                onPress={() => handleShare('telegram')}
              >
                <Ionicons name="paper-plane-outline" size={24} color="#0088cc" />
                <Text style={styles.shareButtonText}>Telegram</Text>
              </TouchableOpacity>

              {/* Facebook */}
              <TouchableOpacity
                style={styles.shareButton}
                onPress={() => handleShare('facebook')}
              >
                <Ionicons name="logo-facebook" size={24} color="#1877F2" />
                <Text style={styles.shareButtonText}>Facebook</Text>
              </TouchableOpacity>

              {/* Twitter */}
              <TouchableOpacity
                style={styles.shareButton}
                onPress={() => handleShare('twitter')}
              >
                <Ionicons name="logo-twitter" size={24} color="#1DA1F2" />
                <Text style={styles.shareButtonText}>Twitter</Text>
              </TouchableOpacity>

              {/* System Share */}
              <TouchableOpacity
                style={styles.shareButton}
                onPress={() => handleShare('system')}
              >
                <Ionicons name="share-outline" size={24} color="#666666" />
                <Text style={styles.shareButtonText}>More</Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* Tips Section */}
          <View style={styles.tipsSection}>
            <Text style={styles.sectionTitle}>💡 Sharing Tips</Text>
            <View style={styles.tipsList}>
              <View style={styles.tipItem}>
                <Ionicons name="people-outline" size={16} color="#FF6B35" />
                <Text style={styles.tipText}>Share with friends who love video content</Text>
              </View>
              <View style={styles.tipItem}>
                <Ionicons name="time-outline" size={16} color="#FF6B35" />
                <Text style={styles.tipText}>Best time to share: evenings and weekends</Text>
              </View>
              <View style={styles.tipItem}>
                <Ionicons name="heart-outline" size={16} color="#FF6B35" />
                <Text style={styles.tipText}>Personal messages work better than generic ones</Text>
              </View>
              <View style={styles.tipItem}>
                <Ionicons name="trophy-outline" size={16} color="#FF6B35" />
                <Text style={styles.tipText}>You earn 5% from every referral's revenue</Text>
              </View>
            </View>
          </View>

          {/* Stats Preview */}
          <View style={styles.statsSection}>
            <Text style={styles.sectionTitle}>Potential Earnings</Text>
            <View style={styles.statsGrid}>
              <View style={styles.statItem}>
                <Text style={styles.statNumber}>₹2.5</Text>
                <Text style={styles.statLabel}>Per friend/month*</Text>
              </View>
              <View style={styles.statItem}>
                <Text style={styles.statNumber}>₹30</Text>
                <Text style={styles.statLabel}>Per friend/year*</Text>
              </View>
              <View style={styles.statItem}>
                <Text style={styles.statNumber}>₹300</Text>
                <Text style={styles.statLabel}>With 10 friends*</Text>
              </View>
            </View>
            <Text style={styles.statsDisclaimer}>
              *Based on average user earning ₹50/month. Your earnings may vary.
            </Text>
          </View>
        </ScrollView>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000000',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 60,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#333333',
  },
  closeButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  headerSpacer: {
    width: 40,
  },
  content: {
    flex: 1,
    paddingHorizontal: 16,
  },
  codeCard: {
    padding: 24,
    borderRadius: 16,
    marginVertical: 16,
    alignItems: 'center',
  },
  codeLabel: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.8)',
    marginBottom: 8,
  },
  codeText: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#FFFFFF',
    letterSpacing: 4,
    marginBottom: 12,
  },
  codeDescription: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.9)',
    textAlign: 'center',
    lineHeight: 20,
  },
  qrSection: {
    marginVertical: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#FFFFFF',
    marginBottom: 16,
  },
  qrContainer: {
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 24,
  },
  qrCode: {
    width: 150,
    height: 150,
    marginBottom: 12,
  },
  qrDescription: {
    fontSize: 14,
    color: '#666666',
    textAlign: 'center',
  },
  messageSection: {
    marginVertical: 16,
  },
  messageTypeScroll: {
    marginBottom: 16,
  },
  messageTypeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    marginRight: 12,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  messageTypeButtonActive: {
    backgroundColor: 'rgba(255, 107, 53, 0.1)',
    borderColor: '#FF6B35',
  },
  messageTypeLabel: {
    marginLeft: 8,
    fontSize: 14,
    color: '#CCCCCC',
  },
  messageTypeLabelActive: {
    color: '#FF6B35',
    fontWeight: '600',
  },
  messagePreview: {
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: 12,
    padding: 16,
  },
  messageText: {
    fontSize: 14,
    color: '#CCCCCC',
    lineHeight: 20,
  },
  customMessageInput: {
    fontSize: 14,
    color: '#FFFFFF',
    lineHeight: 20,
    minHeight: 80,
    textAlignVertical: 'top',
  },
  shareSection: {
    marginVertical: 16,
  },
  shareButtonsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  shareButton: {
    width: (width - 48) / 3 - 8,
    aspectRatio: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  shareButtonSuccess: {
    backgroundColor: '#22C55E',
    borderColor: '#22C55E',
  },
  shareButtonText: {
    fontSize: 12,
    color: '#CCCCCC',
    marginTop: 8,
    fontWeight: '500',
  },
  shareButtonTextSuccess: {
    color: '#FFFFFF',
  },
  tipsSection: {
    marginVertical: 16,
  },
  tipsList: {
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: 12,
    padding: 16,
  },
  tipItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  tipText: {
    fontSize: 14,
    color: '#CCCCCC',
    marginLeft: 12,
    flex: 1,
    lineHeight: 18,
  },
  statsSection: {
    marginVertical: 16,
    marginBottom: 32,
  },
  statsGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    backgroundColor: 'rgba(255, 107, 53, 0.1)',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
  },
  statItem: {
    alignItems: 'center',
    flex: 1,
  },
  statNumber: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#FF6B35',
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 12,
    color: '#CCCCCC',
    textAlign: 'center',
  },
  statsDisclaimer: {
    fontSize: 12,
    color: '#999999',
    textAlign: 'center',
    fontStyle: 'italic',
  },
});

export default ReferralShareModal; 