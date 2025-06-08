// Step 1: Create a file for the hook
// Path: src/hooks/useAuth.ts

import { create } from 'zustand';
import { supabase } from '@/lib/supabase';
import type { AuthUser } from '@/types/auth';
import { useEffect } from 'react';

export interface AuthState {
  user: AuthUser | null;
  session: any | null;
  isLoading: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
  refreshSession: () => Promise<void>;
}

const useAuthStore = create<AuthState>((set) => ({
  user: null,
  session: null,
  isLoading: true,
  signIn: async (email: string, password: string) => {
    set({ isLoading: true });
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw error;
    set({ user: data.user as AuthUser, session: data.session, isLoading: false });
  },
  signOut: async () => {
    set({ isLoading: true });
    await supabase.auth.signOut();
    set({ user: null, session: null, isLoading: false });
  },
  refreshSession: async () => {
    set({ isLoading: true });
    const { data, error } = await supabase.auth.getSession();
    if (error) {
      set({ user: null, session: null, isLoading: false });
      return;
    }
    set({ user: data.session?.user as AuthUser || null, session: data.session, isLoading: false });
  }
}));

export function useAuth() {
  const { user, session, isLoading, signIn, signOut, refreshSession } = useAuthStore();

  // Subscribe to Supabase auth state changes
  useEffect(() => {
    useAuthStore.getState().refreshSession();
    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      useAuthStore.setState({
        user: session?.user as AuthUser || null,
        session,
        isLoading: false,
      });
    });
    return () => {
      listener?.subscription.unsubscribe();
    };
  }, []);

  return {
    user,
    session,
    isLoading,
    signIn,
    signOut,
    refreshSession
  };
}
