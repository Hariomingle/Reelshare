import React, { useEffect, useState } from 'react';
import { View, StyleSheet, LogBox } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import * as SplashScreen from 'expo-splash-screen';

// Import the demo screen
import ReelsFeedDemo from './src/screens/ReelsFeedDemo';

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

export default function App() {
  const [appIsReady, setAppIsReady] = useState(false);

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

  return (
    <GestureHandlerRootView style={styles.container}>
      <SafeAreaProvider>
        <StatusBar style="light" backgroundColor="#000000" />
        <View style={styles.container}>
          {/* Demo the ReelShare Video Feed */}
          <ReelsFeedDemo />
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
}); 