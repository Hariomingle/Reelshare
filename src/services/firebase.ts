import { initializeApp } from 'firebase/app';
import { getAuth, initializeAuth, getReactNativePersistence } from 'firebase/auth';
import { getFirestore, connectFirestoreEmulator } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';
import { getFunctions, connectFunctionsEmulator } from 'firebase/functions';
import { getMessaging } from 'firebase/messaging';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';

// Firebase configuration
const firebaseConfig = {
  apiKey: "your-api-key-here",
  authDomain: "reelshare-app.firebaseapp.com",
  projectId: "reelshare-app",
  storageBucket: "reelshare-app.appspot.com",
  messagingSenderId: "123456789",
  appId: "1:123456789:web:your-app-id-here",
  measurementId: "G-your-measurement-id"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Initialize Firebase Auth with AsyncStorage persistence
let auth;
try {
  auth = initializeAuth(app, {
    persistence: getReactNativePersistence(AsyncStorage)
  });
} catch (error) {
  auth = getAuth(app);
}

// Initialize Firestore
const db = getFirestore(app);

// Initialize Storage
const storage = getStorage(app);

// Initialize Functions
const functions = getFunctions(app);

// Initialize Messaging (for push notifications)
let messaging;
if (Platform.OS === 'web') {
  messaging = getMessaging(app);
}

// Connect to emulators in development
if (__DEV__) {
  // Uncomment these lines when using Firebase emulators
  // connectFirestoreEmulator(db, 'localhost', 8080);
  // connectFunctionsEmulator(functions, 'localhost', 5001);
}

export { 
  app, 
  auth, 
  db, 
  storage, 
  functions, 
  messaging 
};

export default app; 