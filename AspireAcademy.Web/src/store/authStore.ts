import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { Rank } from '../constants';
import { useGamificationStore } from './gamificationStore';
import { useProgressStore } from './progressStore';

export interface User {
  id: string;
  username: string;
  displayName: string;
  email: string;
  avatarUrl: string;
  bio: string | null;
  currentLevel: number;
  currentRank: string;
  totalXp: number;
  loginStreakDays: number;
  createdAt: string;
  gitHubUsername: string | null;
}

interface AuthStore {
  token: string | null;
  user: User | null;
  setAuth: (token: string, user: User) => void;
  logout: () => void;
  updateUser: (updates: Partial<User>) => void;
}

export const useAuthStore = create<AuthStore>()(
  persist(
    (set) => ({
      token: null,
      user: null,
      setAuth: (token, user) => set({ token, user }),
      logout: () => {
        set({ token: null, user: null });
        // Clear all user-scoped state to prevent leaks across account switches
        useGamificationStore.getState().syncFromServer({
          totalXp: 0, currentLevel: 1, currentRank: Rank.AspireIntern, weeklyXp: 0, loginStreakDays: 0,
        });
        useGamificationStore.getState().setPendingLevelUp(null);
        useProgressStore.setState({ worldProgress: {}, currentLesson: null });
      },
      updateUser: (updates) =>
        set((state) => ({
          user: state.user ? { ...state.user, ...updates } : null,
        })),
    }),
    {
      name: 'aspire-academy-auth',
    }
  )
);
