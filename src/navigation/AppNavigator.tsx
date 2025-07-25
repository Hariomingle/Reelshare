import React, { useEffect, useState } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createStackNavigator } from '@react-navigation/stack';
import { onAuthStateChanged, User as FirebaseUser } from 'firebase/auth';
import { auth } from '../services/firebase';
import { RootStackParamList } from '../types';

// Navigation Components
import AuthNavigator from './AuthNavigator';
import MainTabNavigator from './MainTabNavigator';
import ReelViewerScreen from '../screens/ReelViewerScreen';
import ProfileScreen from '../screens/ProfileScreen';
import EditProfileScreen from '../screens/EditProfileScreen';
import CameraScreen from '../screens/CameraScreen';
import VideoEditorScreen from '../screens/VideoEditorScreen';
import SettingsScreen from '../screens/SettingsScreen';
import WalletScreen from '../screens/WalletScreen';
import NotificationsScreen from '../screens/NotificationsScreen';
import SearchScreen from '../screens/SearchScreen';
import HashtagFeedScreen from '../screens/HashtagFeedScreen';
import CategoryFeedScreen from '../screens/CategoryFeedScreen';

// Theme
import { COLORS } from '../constants';

const Stack = createStackNavigator<RootStackParamList>();

const AppNavigator: React.FC = () => {
  const [user, setUser] = useState<FirebaseUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (firebaseUser) => {
      setUser(firebaseUser);
      setIsLoading(false);
    });

    return unsubscribe;
  }, []);

  if (isLoading) {
    // You can return a loading screen component here
    return null;
  }

  return (
    <NavigationContainer
      theme={{
        dark: true,
        colors: {
          primary: COLORS.primary,
          background: COLORS.background,
          card: COLORS.surface,
          text: COLORS.text,
          border: COLORS.border,
          notification: COLORS.accent,
        },
      }}
    >
      <Stack.Navigator
        screenOptions={{
          headerShown: false,
          cardStyle: { backgroundColor: COLORS.background },
          animationEnabled: true,
          gestureEnabled: true,
        }}
      >
        {!user ? (
          // Auth Stack
          <Stack.Screen 
            name="Auth" 
            component={AuthNavigator}
            options={{
              animationTypeForReplace: !user ? 'pop' : 'push',
            }}
          />
        ) : (
          // Main App Stack
          <>
            <Stack.Screen 
              name="Main" 
              component={MainTabNavigator}
            />
            <Stack.Screen 
              name="ReelViewer" 
              component={ReelViewerScreen}
              options={{
                presentation: 'fullScreenModal',
                gestureDirection: 'vertical',
              }}
            />
            <Stack.Screen 
              name="Profile" 
              component={ProfileScreen}
              options={{
                presentation: 'modal',
                headerShown: true,
                headerStyle: {
                  backgroundColor: COLORS.background,
                  shadowOpacity: 0,
                  borderBottomWidth: 0,
                },
                headerTintColor: COLORS.text,
                headerTitle: 'Profile',
              }}
            />
            <Stack.Screen 
              name="EditProfile" 
              component={EditProfileScreen}
              options={{
                presentation: 'modal',
                headerShown: true,
                headerStyle: {
                  backgroundColor: COLORS.background,
                  shadowOpacity: 0,
                  borderBottomWidth: 0,
                },
                headerTintColor: COLORS.text,
                headerTitle: 'Edit Profile',
              }}
            />
            <Stack.Screen 
              name="Camera" 
              component={CameraScreen}
              options={{
                presentation: 'fullScreenModal',
                gestureEnabled: false,
              }}
            />
            <Stack.Screen 
              name="VideoEditor" 
              component={VideoEditorScreen}
              options={{
                presentation: 'fullScreenModal',
                headerShown: true,
                headerStyle: {
                  backgroundColor: COLORS.background,
                  shadowOpacity: 0,
                  borderBottomWidth: 0,
                },
                headerTintColor: COLORS.text,
                headerTitle: 'Edit Video',
              }}
            />
            <Stack.Screen 
              name="Settings" 
              component={SettingsScreen}
              options={{
                headerShown: true,
                headerStyle: {
                  backgroundColor: COLORS.background,
                  shadowOpacity: 0,
                  borderBottomWidth: 0,
                },
                headerTintColor: COLORS.text,
                headerTitle: 'Settings',
              }}
            />
            <Stack.Screen 
              name="Wallet" 
              component={WalletScreen}
              options={{
                headerShown: true,
                headerStyle: {
                  backgroundColor: COLORS.background,
                  shadowOpacity: 0,
                  borderBottomWidth: 0,
                },
                headerTintColor: COLORS.text,
                headerTitle: 'Wallet',
              }}
            />
            <Stack.Screen 
              name="Notifications" 
              component={NotificationsScreen}
              options={{
                headerShown: true,
                headerStyle: {
                  backgroundColor: COLORS.background,
                  shadowOpacity: 0,
                  borderBottomWidth: 0,
                },
                headerTintColor: COLORS.text,
                headerTitle: 'Notifications',
              }}
            />
            <Stack.Screen 
              name="Search" 
              component={SearchScreen}
              options={{
                presentation: 'modal',
                headerShown: true,
                headerStyle: {
                  backgroundColor: COLORS.background,
                  shadowOpacity: 0,
                  borderBottomWidth: 0,
                },
                headerTintColor: COLORS.text,
                headerTitle: 'Search',
              }}
            />
            <Stack.Screen 
              name="HashtagFeed" 
              component={HashtagFeedScreen}
              options={{
                headerShown: true,
                headerStyle: {
                  backgroundColor: COLORS.background,
                  shadowOpacity: 0,
                  borderBottomWidth: 0,
                },
                headerTintColor: COLORS.text,
                headerTitle: '',
              }}
            />
            <Stack.Screen 
              name="CategoryFeed" 
              component={CategoryFeedScreen}
              options={{
                headerShown: true,
                headerStyle: {
                  backgroundColor: COLORS.background,
                  shadowOpacity: 0,
                  borderBottomWidth: 0,
                },
                headerTintColor: COLORS.text,
                headerTitle: '',
              }}
            />
          </>
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
};

export default AppNavigator; 