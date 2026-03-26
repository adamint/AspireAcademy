export type LessonType = 'learn' | 'quiz' | 'challenge' | 'build' | 'boss';
export type LessonStatus = 'completed' | 'perfect' | 'in_progress' | 'available' | 'locked';

export interface Lesson {
  id: string;
  title: string;
  type: LessonType;
  status: LessonStatus;
  sortOrder: number;
  estimatedMinutes: number;
  xpReward: number;
  contentMarkdown?: string;
  score?: number;
  maxScore?: number;
}

export interface Module {
  id: string;
  name: string;
  sortOrder: number;
  isLocked: boolean;
  lessons: Lesson[];
  completedLessons: number;
  totalLessons: number;
}

export interface World {
  id: string;
  name: string;
  description: string;
  icon: string;
  sortOrder: number;
  isLocked: boolean;
  prerequisiteWorldId?: string;
  prerequisiteWorldName?: string;
  modules: Module[];
  completedLessons: number;
  totalLessons: number;
  completionPercentage: number;
}

export interface XpEvent {
  id: string;
  type: 'lesson' | 'quiz' | 'challenge' | 'achievement' | 'streak' | 'bonus';
  description: string;
  xpEarned: number;
  createdAt: string;
}

export interface XpResponse {
  totalXp: number;
  currentLevel: number;
  currentRank: string;
  weeklyXp: number;
  loginStreakDays: number;
  recentEvents: XpEvent[];
  nextLesson?: {
    id: string;
    title: string;
    moduleName: string;
    worldId: string;
    type: LessonType;
  };
}

export interface CompleteResponse {
  xpEarned: number;
  totalXp: number;
  currentLevel: number;
  currentRank: string;
  levelUp?: {
    newLevel: number;
    newRank: string;
    previousLevel: number;
    previousRank: string;
  };
  achievements?: {
    id: string;
    name: string;
    description: string;
    icon: string;
    rarity: string;
    xpReward: number;
  }[];
}

export interface LessonDetail extends Lesson {
  contentMarkdown: string;
  moduleName: string;
  moduleId: string;
  worldId: string;
  worldName: string;
  previousLessonId?: string;
  nextLessonId?: string;
  previousLessonTitle?: string;
  nextLessonTitle?: string;
  previousLessonType?: LessonType;
  nextLessonType?: LessonType;
  isCompleted: boolean;
}
