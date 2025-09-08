import AsyncStorage from '@react-native-async-storage/async-storage';
import { Session, User } from '@supabase/supabase-js';
import React, { createContext, useContext, useEffect, useState } from 'react';
import { NotificationService } from '../lib/notification';
import { supabase } from '../lib/supabase';


type AuthContextType = {
  session: Session | null;
  user: User | null;
  loading: boolean;
  signOut: () => Promise<void>;
  registerNotifications: () => Promise<boolean>;
};

const AuthContext = createContext<AuthContextType>({
  session: null,
  user: null,
  loading: true,
  signOut: async () => {},
  registerNotifications: async () => false,
});

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

type AuthProviderProps = {
  children: React.ReactNode;
};

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  const registerNotificationForSession = async (session: Session | null): Promise<boolean> => {
    if (!session) return false;

    const notificationService = NotificationService.getInstance();
    const success = await notificationService.registerTokenWithBackend(session);
    if (success) {
      console.log('Notification registered successfully');
    } else {
      console.log('Failed to register notification');
    }
    return success;
  };

  const registerNotifications = async (): Promise<boolean> => {
  try {
    const notificationService = NotificationService.getInstance();
    const success = await notificationService.registerTokenWithBackend(session);
    
    if (success) {
      console.log('Notifications registered successfully');
    } else {
      console.log('Failed to register notifications');
    }
    
    return success;
  } catch (error) {
    console.error('Error registering notifications:', error);
    return false;
  }
};

  useEffect(() => {
    // Get initial session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      setLoading(false);

      if (session) {
        registerNotificationForSession(session);
      }
    });

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        setSession(session);
        setUser(session?.user ?? null);
        setLoading(false);

        if (event === 'SIGNED_IN' && session) {
          await registerNotificationForSession(session);
        }

      }
    );

    return () => subscription.unsubscribe();
  }, []);

  const signOut = async () => {
      
    try {
      console.log('Starting sign out...');
      setLoading(true);
      
      // Próbuj wylogować z Supabase, ale nie przejmuj się błędami
      await supabase.auth.signOut();
      
    } catch (error) {
      console.error('Sign out error (ignoring):', error);
      // Ignoruj błędy - i tak chcemy wyczyścić stan lokalny
    } finally {
      // ZAWSZE wyczyść lokalny stan, niezależnie od błędów
      console.log('Clearing local auth state');
      const allKeys = await AsyncStorage.getAllKeys();
      for (const key of allKeys) {
        if (key.startsWith('sb-')) {
          console.log('Removing key:', key);
          await AsyncStorage.removeItem(key);
        }
      }
      setSession(null);
      setUser(null);
      setLoading(false);
    }
  };

  const value = {
    session,
    user,
    loading,
    signOut,
    registerNotifications
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};