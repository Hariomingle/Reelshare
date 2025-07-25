import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import ReelsFeedScreen from './ReelsFeedScreen';
import { COLORS, FONTS, SPACING } from '../constants';

interface ReelsFeedDemoProps {
  navigation?: any;
}

const ReelsFeedDemo: React.FC<ReelsFeedDemoProps> = ({ navigation }) => {
  const showDemo = () => {
    Alert.alert(
      'ReelShare Video Feed Demo',
      'Features:\n\n' +
      '🎬 Full-screen vertical scrolling\n' +
      '❤️ Like, Comment, Share buttons\n' +
      '👤 Creator profiles & captions\n' +
      '🎵 Music info & hashtags\n' +
      '📱 TikTok-style interface\n' +
      '🔄 Pull to refresh\n' +
      '♾️ Infinite scroll loading\n' +
      '🎯 Sample data with 10 videos\n\n' +
      'Swipe up/down to navigate!',
      [{ text: 'Start Demo', onPress: () => {} }]
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* Demo Header */}
      <View style={styles.header}>
        <Text style={styles.title}>🎬 ReelShare Video Feed</Text>
        <Text style={styles.subtitle}>Full-Screen Vertical Scrollable List</Text>
        <TouchableOpacity style={styles.demoButton} onPress={showDemo}>
          <Text style={styles.demoButtonText}>ℹ️ View Features</Text>
        </TouchableOpacity>
      </View>

      {/* Main Feed */}
      <View style={styles.feedContainer}>
        <ReelsFeedScreen navigation={navigation} />
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  header: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 1000,
    backgroundColor: 'rgba(0,0,0,0.8)',
    paddingHorizontal: SPACING.lg,
    paddingTop: SPACING.lg,
    paddingBottom: SPACING.md,
  },
  title: {
    fontSize: FONTS.size.xl,
    fontWeight: FONTS.weight.bold,
    color: COLORS.text,
    textAlign: 'center',
    marginBottom: SPACING.xs,
  },
  subtitle: {
    fontSize: FONTS.size.md,
    color: COLORS.textSecondary,
    textAlign: 'center',
    marginBottom: SPACING.sm,
  },
  demoButton: {
    backgroundColor: COLORS.primary,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    borderRadius: 25,
    alignSelf: 'center',
  },
  demoButtonText: {
    color: COLORS.text,
    fontSize: FONTS.size.sm,
    fontWeight: FONTS.weight.medium,
  },
  feedContainer: {
    flex: 1,
    marginTop: 120, // Account for header
  },
});

export default ReelsFeedDemo; 