import React, { useEffect, useState } from 'react';
import { StatusBar } from 'expo-status-bar';
import { LogBox, Platform } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import * as SplashScreen from 'expo-splash-screen';
import * as Font from 'expo-font';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

// Navigation
import AppNavigator from './src/navigation/AppNavigator';

// Services
import './src/services/firebase'; // Initialize Firebase

// Ignore specific warnings in development
if (__DEV__) {
  LogBox.ignoreLogs([
    'Require cycle:', // Common in React Navigation
    'Remote debugger', // React Native debugger
    'VirtualizedLists should never be nested', // FlatList warnings
    'Setting a timer', // Firebase warnings
  ]);
}

// Keep splash screen visible while we fetch resources
SplashScreen.preventAutoHideAsync();

const App: React.FC = () => {
  const [appIsReady, setAppIsReady] = useState(false);

  useEffect(() => {
    async function prepare() {
      try {
        // Pre-load fonts (if you have custom fonts)
        // await Font.loadAsync({
        //   'custom-font': require('./assets/fonts/CustomFont.ttf'),
        // });

        // Pre-load any other resources or make API calls you need
        // You could also initialize your app state here

        // Artificial delay to show splash screen for minimum time
        await new Promise(resolve => setTimeout(resolve, 2000));
      } catch (e) {
        console.warn('Error during app initialization:', e);
      } finally {
        // Tell the application to render
        setAppIsReady(true);
      }
    }

    prepare();
  }, []);

  const onLayoutRootView = React.useCallback(async () => {
    if (appIsReady) {
      // This tells the splash screen to hide immediately
      await SplashScreen.hideAsync();
    }
  }, [appIsReady]);

  if (!appIsReady) {
    return null;
  }

  return (
    <GestureHandlerRootView style={{ flex: 1 }} onLayout={onLayoutRootView}>
      <SafeAreaProvider>
        <StatusBar style="light" backgroundColor="#000000" translucent />
        <AppNavigator />
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
};

export default App; 