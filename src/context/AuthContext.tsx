import React, { createContext, useContext, useEffect, useState } from 'react';
import {
  browserLocalPersistence,
  browserSessionPersistence,
  createUserWithEmailAndPassword,
  EmailAuthProvider,
  onAuthStateChanged,
  reauthenticateWithCredential,
  sendEmailVerification,
  sendPasswordResetEmail,
  setPersistence,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut,
  updatePassword,
  updateProfile,
  type User,
} from 'firebase/auth';
import {
  addDoc,
  collection,
  doc,
  limit,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
} from 'firebase/firestore';
import { syncProfileWithBackend } from '../lib/api';
import { auth, db, googleProvider, handleFirestoreError, OperationType } from '../lib/firebase';
import type { ActivityLogItem, NotificationItem, UserProfile } from '../types/ecodna';

interface AuthContextValue {
  firebaseUser: User | null;
  profile: UserProfile | null;
  notifications: NotificationItem[];
  activityLogs: ActivityLogItem[];
  loading: boolean;
  isAdmin: boolean;
  registerWithEmail: (params: { fullName: string; email: string; password: string }) => Promise<void>;
  loginWithEmail: (params: { email: string; password: string; rememberMe: boolean }) => Promise<void>;
  loginWithGoogle: (rememberMe?: boolean) => Promise<void>;
  logout: () => Promise<void>;
  sendResetEmail: (email: string) => Promise<void>;
  resendVerificationEmail: () => Promise<void>;
  refreshVerificationStatus: () => Promise<boolean>;
  updateResearcherProfile: (updates: { fullName: string; organization: string; researchFocus: string }) => Promise<void>;
  changePassword: (currentPassword: string, newPassword: string) => Promise<void>;
  markNotificationRead: (notificationId: string) => Promise<void>;
  logActivity: (action: string, resourceType: ActivityLogItem['resourceType'], details: string, resourceId?: string) => Promise<void>;
  pushNotification: (title: string, message: string, type?: NotificationItem['type']) => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [firebaseUser, setFirebaseUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [activityLogs, setActivityLogs] = useState<ActivityLogItem[]>([]);
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);

  const ensureFirestoreProfile = async (user: User, preferredName?: string): Promise<void> => {
    const userRef = doc(db, 'users', user.uid);
    const fullName = (preferredName || user.displayName || user.email?.split('@')[0] || 'EcoDNA Researcher').slice(0, 120);
    const email = (user.email || '').slice(0, 254);

    try {
      await setDoc(
        userRef,
        {
          uid: user.uid,
          fullName,
          email,
          organization: '',
          researchFocus: '',
          role: 'researcher',
          status: 'active',
          emailVerified: user.emailVerified,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        },
        { merge: false }
      );
    } catch {
      // Document may already exist; merge-update verification state safely if allowed
    }
  };

  useEffect(() => {
    let unsubProfile: (() => void) | null = null;
    let unsubNotifications: (() => void) | null = null;
    let unsubLogs: (() => void) | null = null;

    const unsubAuth = onAuthStateChanged(auth, async (user) => {
      if (unsubProfile) unsubProfile();
      if (unsubNotifications) unsubNotifications();
      if (unsubLogs) unsubLogs();

      setFirebaseUser(user);

      if (!user) {
        setProfile(null);
        setNotifications([]);
        setActivityLogs([]);
        setIsAdmin(false);
        setLoading(false);
        return;
      }

      try {
        const synced = await syncProfileWithBackend({
          fullName: user.displayName || undefined,
        });
        setIsAdmin(synced.isAdmin);
      } catch {
        setIsAdmin(false);
      }

      const userDocRef = doc(db, 'users', user.uid);
      unsubProfile = onSnapshot(
        userDocRef,
        async (snap) => {
          if (snap.exists()) {
            const data = snap.data() as UserProfile;
            setProfile(data);
            if (data.role === 'admin') setIsAdmin(true);
          } else {
            await ensureFirestoreProfile(user);
          }
          setLoading(false);
        },
        (err) => {
          console.warn('Profile listener notice:', err.message);
          setProfile({
            uid: user.uid,
            fullName: user.displayName || user.email?.split('@')[0] || 'Researcher',
            email: user.email || '',
            role: 'researcher',
            status: 'active',
            emailVerified: user.emailVerified,
          });
          setLoading(false);
        }
      );

      const notifQ = query(
        collection(db, 'notifications'),
        where('userId', '==', user.uid),
        orderBy('createdAt', 'desc'),
        limit(20)
      );
      unsubNotifications = onSnapshot(
        notifQ,
        (snap) => {
          setNotifications(snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<NotificationItem, 'id'>) })));
        },
        (err) => {
          if (err.code !== 'permission-denied') {
            console.warn('Notifications listener error:', err.message);
          }
        }
      );

      const logsQ = query(
        collection(db, 'activity_logs'),
        where('userId', '==', user.uid),
        orderBy('createdAt', 'desc'),
        limit(25)
      );
      unsubLogs = onSnapshot(
        logsQ,
        (snap) => {
          setActivityLogs(snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<ActivityLogItem, 'id'>) })));
        },
        (err) => {
          if (err.code !== 'permission-denied') {
            console.warn('Activity logs listener error:', err.message);
          }
        }
      );
    });

    return () => {
      unsubAuth();
      if (unsubProfile) unsubProfile();
      if (unsubNotifications) unsubNotifications();
      if (unsubLogs) unsubLogs();
    };
  }, []);

  const logActivity = async (
    action: string,
    resourceType: ActivityLogItem['resourceType'],
    details: string,
    resourceId = ''
  ): Promise<void> => {
    const user = auth.currentUser;
    if (!user) return;
    try {
      await addDoc(collection(db, 'activity_logs'), {
        userId: user.uid,
        actorEmail: user.email || '',
        action: action.slice(0, 80),
        resourceType,
        resourceId: resourceId.slice(0, 128),
        details: details.slice(0, 500),
        createdAt: serverTimestamp(),
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, 'activity_logs');
    }
  };

  const pushNotification = async (
    title: string,
    message: string,
    type: NotificationItem['type'] = 'info'
  ): Promise<void> => {
    const user = auth.currentUser;
    if (!user) return;
    try {
      await addDoc(collection(db, 'notifications'), {
        userId: user.uid,
        title: title.slice(0, 140),
        message: message.slice(0, 600),
        type,
        read: false,
        createdAt: serverTimestamp(),
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, 'notifications');
    }
  };

  const registerWithEmail = async ({
    fullName,
    email,
    password,
  }: {
    fullName: string;
    email: string;
    password: string;
  }): Promise<void> => {
    await setPersistence(auth, browserLocalPersistence);
    const cred = await createUserWithEmailAndPassword(auth, email.trim(), password);
    await updateProfile(cred.user, { displayName: fullName.trim() });
    await setDoc(doc(db, 'users', cred.user.uid), {
      uid: cred.user.uid,
      fullName: fullName.trim().slice(0, 120),
      email: email.trim().slice(0, 254),
      organization: '',
      researchFocus: '',
      role: 'researcher',
      status: 'active',
      emailVerified: cred.user.emailVerified,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    await sendEmailVerification(cred.user);
    await syncProfileWithBackend({ fullName: fullName.trim() });
    await logActivity('ACCOUNT_REGISTERED', 'auth', 'Registered EcoDNA researcher account via email/password');
    await pushNotification(
      'Verify Your Email Address',
      'A verification link has been sent to your email address. Please confirm it to unlock full collaborator features.',
      'info'
    );
  };

  const loginWithEmail = async ({
    email,
    password,
    rememberMe,
  }: {
    email: string;
    password: string;
    rememberMe: boolean;
  }): Promise<void> => {
    await setPersistence(auth, rememberMe ? browserLocalPersistence : browserSessionPersistence);
    const cred = await signInWithEmailAndPassword(auth, email.trim(), password);
    const synced = await syncProfileWithBackend({});
    setIsAdmin(synced.isAdmin);
    await logActivity('SIGN_IN', 'auth', `Signed in via email (${cred.user.email})`);
  };

  const loginWithGoogle = async (rememberMe = true): Promise<void> => {
    await setPersistence(auth, rememberMe ? browserLocalPersistence : browserSessionPersistence);
    const cred = await signInWithPopup(auth, googleProvider);
    await ensureFirestoreProfile(cred.user);
    const synced = await syncProfileWithBackend({ fullName: cred.user.displayName || undefined });
    setIsAdmin(synced.isAdmin);
    await logActivity('SIGN_IN_GOOGLE', 'auth', `Signed in via Google (${cred.user.email})`);
  };

  const logout = async (): Promise<void> => {
    await signOut(auth);
    setProfile(null);
    setIsAdmin(false);
  };

  const sendResetEmail = async (email: string): Promise<void> => {
    await sendPasswordResetEmail(auth, email.trim());
  };

  const resendVerificationEmail = async (): Promise<void> => {
    if (!auth.currentUser) throw new Error('No authenticated user session.');
    await sendEmailVerification(auth.currentUser);
  };

  const refreshVerificationStatus = async (): Promise<boolean> => {
    if (!auth.currentUser) return false;
    await auth.currentUser.reload();
    const verified = auth.currentUser.emailVerified;
    if (verified && profile && !profile.emailVerified) {
      try {
        await updateDoc(doc(db, 'users', auth.currentUser.uid), {
          emailVerified: true,
          updatedAt: serverTimestamp(),
        });
      } catch (err) {
        handleFirestoreError(err, OperationType.UPDATE, `users/${auth.currentUser.uid}`);
      }
    }
    const synced = await syncProfileWithBackend({});
    setIsAdmin(synced.isAdmin);
    return verified;
  };

  const updateResearcherProfile = async (updates: {
    fullName: string;
    organization: string;
    researchFocus: string;
  }): Promise<void> => {
    const user = auth.currentUser;
    if (!user) throw new Error('Sign in required.');

    await updateProfile(user, { displayName: updates.fullName.trim() });
    try {
      await updateDoc(doc(db, 'users', user.uid), {
        fullName: updates.fullName.trim().slice(0, 120),
        organization: updates.organization.trim().slice(0, 160),
        researchFocus: updates.researchFocus.trim().slice(0, 240),
        updatedAt: serverTimestamp(),
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `users/${user.uid}`);
    }
    await syncProfileWithBackend({
      fullName: updates.fullName.trim(),
      organization: updates.organization.trim(),
    });
    await logActivity('PROFILE_UPDATED', 'profile', 'Updated researcher profile metadata');
  };

  const changePassword = async (currentPassword: string, newPassword: string): Promise<void> => {
    const user = auth.currentUser;
    if (!user || !user.email) throw new Error('Authenticated email account required.');
    const credential = EmailAuthProvider.credential(user.email, currentPassword);
    await reauthenticateWithCredential(user, credential);
    await updatePassword(user, newPassword);
    await logActivity('PASSWORD_CHANGED', 'profile', 'Updated account password via Firebase Auth');
  };

  const markNotificationRead = async (notificationId: string): Promise<void> => {
    try {
      await updateDoc(doc(db, 'notifications', notificationId), { read: true });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `notifications/${notificationId}`);
    }
  };

  return (
    <AuthContext.Provider
      value={{
        firebaseUser,
        profile,
        notifications,
        activityLogs,
        loading,
        isAdmin,
        registerWithEmail,
        loginWithEmail,
        loginWithGoogle,
        logout,
        sendResetEmail,
        resendVerificationEmail,
        refreshVerificationStatus,
        updateResearcherProfile,
        changePassword,
        markNotificationRead,
        logActivity,
        pushNotification,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
