import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  updateProfile,
  User as FirebaseUser,
  GoogleAuthProvider,
  signInWithCredential,
  PhoneAuthProvider,
  signInWithPhoneNumber,
  RecaptchaVerifier,
} from 'firebase/auth';
import {
  doc,
  setDoc,
  getDoc,
  updateDoc,
  collection,
  query,
  where,
  getDocs,
} from 'firebase/firestore';
import * as Google from 'expo-auth-session/providers/google';
import * as WebBrowser from 'expo-web-browser';
import { auth, db } from './firebase';
import { User, ApiResponse } from '../types';
import { generateReferralCode } from '../utils/helpers';

// Complete the Google Auth flow
WebBrowser.maybeCompleteAuthSession();

class AuthService {
  private recaptchaVerifier: RecaptchaVerifier | null = null;

  // Initialize Google Auth
  private initializeGoogleAuth() {
    return Google.useAuthRequest({
      expoClientId: 'your-expo-client-id',
      iosClientId: 'your-ios-client-id',
      androidClientId: 'your-android-client-id',
      webClientId: 'your-web-client-id',
    });
  }

  // Google Sign In
  async signInWithGoogle(): Promise<ApiResponse<User>> {
    try {
      const [request, response, promptAsync] = this.initializeGoogleAuth();
      
      if (request) {
        const result = await promptAsync();
        
        if (result?.type === 'success') {
          const { authentication } = result;
          const credential = GoogleAuthProvider.credential(
            authentication?.idToken,
            authentication?.accessToken
          );
          
          const userCredential = await signInWithCredential(auth, credential);
          const firebaseUser = userCredential.user;
          
          // Check if user exists in Firestore
          let user = await this.getUserFromFirestore(firebaseUser.uid);
          
          if (!user) {
            // Create new user
            user = await this.createUserInFirestore(firebaseUser, 'google');
          } else {
            // Update last login
            await this.updateUserLastActive(firebaseUser.uid);
          }
          
          return { success: true, data: user };
        } else {
          return { success: false, error: 'Google authentication cancelled' };
        }
      } else {
        return { success: false, error: 'Google authentication not available' };
      }
    } catch (error: any) {
      console.error('Google Sign In Error:', error);
      return { success: false, error: error.message };
    }
  }

  // Phone Authentication - Send OTP
  async sendPhoneOTP(phoneNumber: string): Promise<ApiResponse<string>> {
    try {
      // Initialize reCAPTCHA verifier
      this.recaptchaVerifier = new RecaptchaVerifier(
        'recaptcha-container',
        {
          size: 'invisible',
          callback: () => {
            // reCAPTCHA solved
          },
        },
        auth
      );

      const confirmationResult = await signInWithPhoneNumber(
        auth,
        phoneNumber,
        this.recaptchaVerifier
      );

      return {
        success: true,
        data: confirmationResult.verificationId,
        message: 'OTP sent successfully',
      };
    } catch (error: any) {
      console.error('Send OTP Error:', error);
      
      // Clean up reCAPTCHA
      if (this.recaptchaVerifier) {
        this.recaptchaVerifier.clear();
        this.recaptchaVerifier = null;
      }
      
      return { success: false, error: error.message };
    }
  }

  // Phone Authentication - Verify OTP
  async verifyPhoneOTP(
    verificationId: string,
    otp: string,
    phoneNumber: string
  ): Promise<ApiResponse<User>> {
    try {
      const credential = PhoneAuthProvider.credential(verificationId, otp);
      const userCredential = await signInWithCredential(auth, credential);
      const firebaseUser = userCredential.user;

      // Check if user exists in Firestore
      let user = await this.getUserFromFirestore(firebaseUser.uid);

      if (!user) {
        // Create new user
        user = await this.createUserInFirestore(firebaseUser, 'phone', phoneNumber);
      } else {
        // Update last login
        await this.updateUserLastActive(firebaseUser.uid);
      }

      return { success: true, data: user };
    } catch (error: any) {
      console.error('Verify OTP Error:', error);
      return { success: false, error: 'Invalid OTP or verification failed' };
    }
  }

  // Email/Password Sign Up
  async signUpWithEmail(
    email: string,
    password: string,
    displayName: string
  ): Promise<ApiResponse<User>> {
    try {
      const userCredential = await createUserWithEmailAndPassword(
        auth,
        email,
        password
      );
      const firebaseUser = userCredential.user;

      // Update profile
      await updateProfile(firebaseUser, { displayName });

      // Create user in Firestore
      const user = await this.createUserInFirestore(firebaseUser, 'email');

      return { success: true, data: user };
    } catch (error: any) {
      console.error('Sign Up Error:', error);
      return { success: false, error: error.message };
    }
  }

  // Email/Password Sign In
  async signInWithEmail(
    email: string,
    password: string
  ): Promise<ApiResponse<User>> {
    try {
      const userCredential = await signInWithEmailAndPassword(
        auth,
        email,
        password
      );
      const firebaseUser = userCredential.user;

      const user = await this.getUserFromFirestore(firebaseUser.uid);
      if (user) {
        await this.updateUserLastActive(firebaseUser.uid);
        return { success: true, data: user };
      } else {
        return { success: false, error: 'User data not found' };
      }
    } catch (error: any) {
      console.error('Sign In Error:', error);
      return { success: false, error: error.message };
    }
  }

  // Sign Out
  async signOut(): Promise<ApiResponse<void>> {
    try {
      await signOut(auth);
      return { success: true };
    } catch (error: any) {
      console.error('Sign Out Error:', error);
      return { success: false, error: error.message };
    }
  }

  // Get current user
  getCurrentUser(): FirebaseUser | null {
    return auth.currentUser;
  }

  // Listen to auth state changes
  onAuthStateChanged(callback: (user: FirebaseUser | null) => void) {
    return onAuthStateChanged(auth, callback);
  }

  // Update user profile
  async updateUserProfile(
    userId: string,
    updates: Partial<User>
  ): Promise<ApiResponse<void>> {
    try {
      const userRef = doc(db, 'users', userId);
      await updateDoc(userRef, {
        ...updates,
        updatedAt: new Date(),
      });

      return { success: true };
    } catch (error: any) {
      console.error('Update Profile Error:', error);
      return { success: false, error: error.message };
    }
  }

  // Private helper methods
  private async getUserFromFirestore(userId: string): Promise<User | null> {
    try {
      const userDoc = await getDoc(doc(db, 'users', userId));
      if (userDoc.exists()) {
        return { id: userDoc.id, ...userDoc.data() } as User;
      }
      return null;
    } catch (error) {
      console.error('Get User Error:', error);
      return null;
    }
  }

  private async createUserInFirestore(
    firebaseUser: FirebaseUser,
    authMethod: 'google' | 'phone' | 'email',
    phoneNumber?: string
  ): Promise<User> {
    const now = new Date();
    const referralCode = generateReferralCode();

    const userData: Omit<User, 'id'> = {
      email: firebaseUser.email || '',
      phone: phoneNumber || '',
      displayName: firebaseUser.displayName || 'User',
      profileImage: firebaseUser.photoURL || '',
      bio: '',
      isVerified: false,
      followerCount: 0,
      followingCount: 0,
      totalLikes: 0,
      createdAt: now,
      updatedAt: now,
      referralCode,
      streakCount: 0,
      lastActiveDate: now,
      interests: [],
      deviceTokens: [],
    };

    await setDoc(doc(db, 'users', firebaseUser.uid), userData);

    // Initialize user wallet
    await this.initializeUserWallet(firebaseUser.uid);

    // Initialize user analytics
    await this.initializeUserAnalytics(firebaseUser.uid);

    // Initialize daily streak
    await this.initializeDailyStreak(firebaseUser.uid);

    return { id: firebaseUser.uid, ...userData };
  }

  private async updateUserLastActive(userId: string): Promise<void> {
    try {
      const userRef = doc(db, 'users', userId);
      await updateDoc(userRef, {
        lastActiveDate: new Date(),
        updatedAt: new Date(),
      });
    } catch (error) {
      console.error('Update Last Active Error:', error);
    }
  }

  private async initializeUserWallet(userId: string): Promise<void> {
    try {
      const walletData = {
        userId,
        totalBalance: 0,
        availableBalance: 0,
        pendingBalance: 0,
        totalEarned: 0,
        totalWithdrawn: 0,
        // Separate ad revenue from fixed bonuses
        adEarnings: 0, // Earnings from actual ad revenue sharing
        bonusEarnings: 0, // Fixed bonuses (create, referral, streak, etc.)
        watchEarnings: 0, // Total from watching (ad revenue share)
        createEarnings: 0, // Total from content creation (ad revenue share + bonus)
        referralEarnings: 0,
        streakEarnings: 0,
        lastUpdated: new Date(),
      };

      await setDoc(doc(db, 'wallets', userId), walletData);
    } catch (error) {
      console.error('Initialize Wallet Error:', error);
    }
  }

  private async initializeUserAnalytics(userId: string): Promise<void> {
    try {
      const analyticsData = {
        userId,
        totalWatchTime: 0,
        videosWatched: 0,
        videosCreated: 0,
        averageWatchPercentage: 0,
        preferredCategories: [],
        activeHours: [],
        lastActivityDate: new Date(),
        engagementScore: 0,
      };

      await setDoc(doc(db, 'user_analytics', userId), analyticsData);
    } catch (error) {
      console.error('Initialize Analytics Error:', error);
    }
  }

  private async initializeDailyStreak(userId: string): Promise<void> {
    try {
      const streakData = {
        userId,
        currentStreak: 0,
        maxStreak: 0,
        lastStreakDate: new Date(),
        streakRewards: 0,
        milestones: {},
      };

      await setDoc(doc(db, 'daily_streaks', userId), streakData);
    } catch (error) {
      console.error('Initialize Streak Error:', error);
    }
  }

  // Check if username is available
  async isUsernameAvailable(username: string): Promise<boolean> {
    try {
      const usersRef = collection(db, 'users');
      const q = query(usersRef, where('displayName', '==', username));
      const querySnapshot = await getDocs(q);
      return querySnapshot.empty;
    } catch (error) {
      console.error('Check Username Error:', error);
      return false;
    }
  }

  // Apply referral code
  async applyReferralCode(
    userId: string,
    referralCode: string
  ): Promise<ApiResponse<void>> {
    try {
      // Find user with referral code
      const usersRef = collection(db, 'users');
      const q = query(usersRef, where('referralCode', '==', referralCode));
      const querySnapshot = await getDocs(q);

      if (querySnapshot.empty) {
        return { success: false, error: 'Invalid referral code' };
      }

      const referrerDoc = querySnapshot.docs[0];
      const referrerId = referrerDoc.id;

      if (referrerId === userId) {
        return { success: false, error: 'Cannot use your own referral code' };
      }

      // Update user with referrer info
      await updateDoc(doc(db, 'users', userId), {
        referredBy: referrerId,
        updatedAt: new Date(),
      });

      // Create referral record
      const referralData = {
        referrerId,
        refereeId: userId,
        code: referralCode,
        status: 'completed',
        bonus: 10,
        createdAt: new Date(),
        completedAt: new Date(),
      };

      await setDoc(doc(db, 'referrals', `${referrerId}_${userId}`), referralData);

      return { success: true, message: 'Referral code applied successfully' };
    } catch (error: any) {
      console.error('Apply Referral Error:', error);
      return { success: false, error: error.message };
    }
  }
}

export default new AuthService(); 