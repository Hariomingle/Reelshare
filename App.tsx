import React, { useEffect, useState } from 'react';
import { View, StyleSheet, LogBox, TouchableOpacity, Text } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { Ionicons } from '@expo/vector-icons';
import * as SplashScreen from 'expo-splash-screen';

// Import screens
import ReelsFeedDemo from './src/screens/ReelsFeedDemo';
import VideoUploadScreen from './src/screens/VideoUploadScreen';

// Import Firebase service
import './src/services/firebase';

// Suppress common development warnings
LogBox.ignoreLogs([
  'Non-serializable values were found in the navigation state',
  'Remote debugger',
  'Require cycle:',
]);

// Keep splash screen visible while loading
SplashScreen.preventAutoHideAsync();

type Screen = 'feed' | 'upload';

export default function App() {
  const [appIsReady, setAppIsReady] = useState(false);
  const [currentScreen, setCurrentScreen] = useState<Screen>('feed');

  useEffect(() => {
    async function prepare() {
      try {
        // Simulate loading time
        await new Promise(resolve => setTimeout(resolve, 2000));
      } catch (e) {
        console.warn(e);
      } finally {
        setAppIsReady(true);
        SplashScreen.hideAsync();
      }
    }

    prepare();
  }, []);

  if (!appIsReady) {
    return null;
  }

  const renderScreen = () => {
    switch (currentScreen) {
      case 'feed':
        return <ReelsFeedDemo navigation={{ goBack: () => setCurrentScreen('feed') }} />;
      case 'upload':
        return <VideoUploadScreen navigation={{ goBack: () => setCurrentScreen('feed') }} />;
      default:
        return <ReelsFeedDemo navigation={{ goBack: () => setCurrentScreen('feed') }} />;
    }
  };

  return (
    <GestureHandlerRootView style={styles.container}>
      <SafeAreaProvider>
        <StatusBar style="light" backgroundColor="#000000" />
        
        {/* Demo Navigation */}
        <View style={styles.demoNav}>
          <TouchableOpacity 
            style={[styles.navButton, currentScreen === 'feed' && styles.activeNavButton]}
            onPress={() => setCurrentScreen('feed')}
          >
            <Ionicons name="play-circle" size={20} color={currentScreen === 'feed' ? '#FF6B35' : '#666'} />
            <Text style={[styles.navText, currentScreen === 'feed' && styles.activeNavText]}>
              Video Feed
            </Text>
          </TouchableOpacity>
          
          <TouchableOpacity 
            style={[styles.navButton, currentScreen === 'upload' && styles.activeNavButton]}
            onPress={() => setCurrentScreen('upload')}
          >
            <Ionicons name="add-circle" size={20} color={currentScreen === 'upload' ? '#FF6B35' : '#666'} />
            <Text style={[styles.navText, currentScreen === 'upload' && styles.activeNavText]}>
              Upload + AI
            </Text>
          </TouchableOpacity>
        </View>

        {/* Screen Content */}
        <View style={styles.screenContainer}>
          {renderScreen()}
        </View>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000000',
  },
  demoNav: {
    flexDirection: 'row',
    backgroundColor: 'rgba(0, 0, 0, 0.9)',
    paddingHorizontal: 16,
    paddingVertical: 12,
    paddingTop: 50, // Account for status bar
    borderBottomWidth: 1,
    borderBottomColor: '#333',
    justifyContent: 'center',
    gap: 20,
  },
  navButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    gap: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
  },
  activeNavButton: {
    backgroundColor: 'rgba(255, 107, 53, 0.2)',
    borderWidth: 1,
    borderColor: '#FF6B35',
  },
  navText: {
    color: '#666',
    fontSize: 14,
    fontWeight: '600',
  },
  activeNavText: {
    color: '#FF6B35',
  },
  screenContainer: {
    flex: 1,
  },
}); 