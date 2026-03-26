import { create } from 'zustand';

interface WorldProgress {
  completedLessons: number;
  totalLessons: number;
  completionPercentage: number;
}

interface ProgressStore {
  worldProgress: Record<string, WorldProgress>;
  currentLesson: string | null;
  setWorldProgress: (worldId: string, progress: WorldProgress) => void;
  setCurrentLesson: (lessonId: string | null) => void;
}

export const useProgressStore = create<ProgressStore>()((set) => ({
  worldProgress: {},
  currentLesson: null,
  setWorldProgress: (worldId, progress) =>
    set((state) => ({
      worldProgress: { ...state.worldProgress, [worldId]: progress },
    })),
  setCurrentLesson: (lessonId) => set({ currentLesson: lessonId }),
}));
