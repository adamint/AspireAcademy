import { create } from 'zustand';
import { Rank } from '../constants';
interface LevelUp {
  newLevel: number;
  newRank: string;
  previousLevel: number;
  previousRank: string;
  unlockedItems?: { name: string; type: string }[];
}

interface Achievement {
  id: string;
  name: string;
  description: string;
  icon: string;
  rarity: string;
  xpReward: number;
}

interface GamificationStore {
  totalXp: number;
  currentLevel: number;
  currentRank: string;
  weeklyXp: number;
  loginStreakDays: number;
  pendingLevelUp: LevelUp | null;
  pendingAchievements: Achievement[];
  setPendingLevelUp: (lu: LevelUp | null) => void;
  addPendingAchievement: (a: Achievement) => void;
  clearPendingAchievement: (id: string) => void;
  syncFromServer: (data: {
    totalXp: number;
    currentLevel: number;
    currentRank: string;
    weeklyXp: number;
    loginStreakDays: number;
  }) => void;
}

export const useGamificationStore = create<GamificationStore>()((set) => ({
  totalXp: 0,
  currentLevel: 1,
  currentRank: Rank.AspireIntern,
  weeklyXp: 0,
  loginStreakDays: 0,
  pendingLevelUp: null,
  pendingAchievements: [],
  setPendingLevelUp: (lu) => set({ pendingLevelUp: lu }),
  addPendingAchievement: (a) =>
    set((state) => ({
      pendingAchievements: [...state.pendingAchievements, a],
    })),
  clearPendingAchievement: (id) =>
    set((state) => ({
      pendingAchievements: state.pendingAchievements.filter((a) => a.id !== id),
    })),
  syncFromServer: (data) =>
    set({
      totalXp: data.totalXp,
      currentLevel: data.currentLevel,
      currentRank: data.currentRank,
      weeklyXp: data.weeklyXp,
      loginStreakDays: data.loginStreakDays,
    }),
}));
