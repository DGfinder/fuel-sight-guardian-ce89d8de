// Step 1: Create a file for the hook
// Path: src/hooks/useAuth.ts

import { create } from 'zustand';
import { supabase } from '@/lib/supabase';
import type { AuthUser } from '@/types/auth';

export interface AuthState {
  user: AuthUser | null;
  session: any | null;
  isLoading: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
  refreshSession: () => Promise<void>;
}

// Mock user for development
const mockUser: AuthUser = {
  id: 'mock-user-id',
  email: 'hayden@stevemacs.com.au',
  role: 'admin',
  depot_id: null,
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString()
};

const useAuthStore = create<AuthState>((set) => ({
  user: mockUser, // Start with mock user
  session: { user: mockUser }, // Mock session
  isLoading: false,
  signIn: async (email: string, password: string) => {
    // Bypass actual auth for now
    set({ user: mockUser, session: { user: mockUser }, isLoading: false });
  },
  signOut: async () => {
    // Just clear the mock user
    set({ user: null, session: null, isLoading: false });
  },
  refreshSession: async () => {
    // Always return mock user
    set({ user: mockUser, session: { user: mockUser }, isLoading: false });
  }
}));

export function useAuth() {
  const { user, session, isLoading, signIn, signOut, refreshSession } = useAuthStore();

  return {
    user,
    session,
    isLoading,
    signIn,
    signOut,
    refreshSession
  };
}
