'use client';

import React, { createContext, useContext, useEffect, useState, useCallback, ReactNode } from 'react';
import type { User } from 'firebase/auth';
import { auth } from '@/lib/firebase-client';
import { signInWithCustomToken, signOut as firebaseSignOut, onIdTokenChanged } from 'firebase/auth';
import { useToast } from '@/hooks/use-toast';
import { doc, getDoc, getFirestore } from 'firebase/firestore';

interface UserProfile {
  role?: 'admin' | 'user';
  // Add other profile fields here as needed
}

interface AuthContextType {
  user: User | null;
  profile: UserProfile | null;
  loading: boolean;
  signInWithPhone: (phoneNumber: string, initData: string, photoUrl?: string) => Promise<void>;
  signOut: () => Promise<void>;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  const fetchUserProfile = useCallback(async (firebaseUser: User | null) => {
    if (firebaseUser) {
      try {
        const db = getFirestore();
        const userDocRef = doc(db, 'users', firebaseUser.uid);
        const userDocSnap = await getDoc(userDocRef);
        if (userDocSnap.exists()) {
          setProfile(userDocSnap.data() as UserProfile);
        } else {
          // If user exists in Auth but not Firestore, maybe set a default profile
          setProfile({ role: 'user' });
        }
      } catch (error) {
        console.error("Error fetching user profile from Firestore:", error);
        setProfile(null); // Reset profile on error
      }
    } else {
      setProfile(null); // No user, no profile
    }
  }, []);

  useEffect(() => {
    const unsubscribe = onIdTokenChanged(auth, async (firebaseUser) => {
      setUser(firebaseUser);
      await fetchUserProfile(firebaseUser);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [fetchUserProfile]);
  
  const refreshUser = useCallback(async () => {
    if (auth.currentUser) {
        try {
            await auth.currentUser.reload();
            // The onIdTokenChanged listener will handle the state update for auth user
            // but we might need to manually refetch firestore profile data
            await fetchUserProfile(auth.currentUser);
        } catch (error) {
            console.error("Error reloading user:", error);
        }
    }
  }, [fetchUserProfile]);

  const signInWithPhone = useCallback(async (phoneNumber: string, initData: string, photoUrl?: string) => {
    setLoading(true);
    try {
        const response = await fetch('/api/auth/telegram-phone-signin', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ phoneNumber, initData, photoUrl }),
        });
        const data = await response.json();
        
        if (response.ok && data.customToken) {
            const userCredential = await signInWithCustomToken(auth, data.customToken);
            // After signing in, explicitly fetch the profile for the new user
            await fetchUserProfile(userCredential.user);
            toast({ title: "Вход выполнен успешно!" });
        } else {
            throw new Error(data.details || data.error || 'Failed to sign in');
        }

    } catch (error: any) {
        console.error("Firebase sign in error:", error);
        toast({ title: "Ошибка входа", description: `Не удалось войти с номером ${phoneNumber}. ${error.message}`, variant: 'destructive' });
        setUser(null);
        setProfile(null);
    } finally {
        setLoading(false);
    }
  }, [toast, fetchUserProfile]);


  const signOut = async () => {
    try {
      await firebaseSignOut(auth);
      setUser(null);
      setProfile(null);
      // Clear Telegram Cloud Storage on sign out
      if (window.Telegram && window.Telegram.WebApp && window.Telegram.WebApp.CloudStorage) {
        window.Telegram.WebApp.CloudStorage.getKeys((err, keys) => {
          if (!err && keys) {
            keys.forEach(key => window.Telegram.WebApp.CloudStorage.removeItem(key));
          }
        });
        toast({ title: "Данные сессии очищены" });
      }
    } catch (err) {
      console.error('Logout error:', err);
    }
  };

  return (
    <AuthContext.Provider value={{
      user,
      profile,
      loading,
      signInWithPhone,
      signOut,
      refreshUser
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within AuthProvider');
  return context;
};