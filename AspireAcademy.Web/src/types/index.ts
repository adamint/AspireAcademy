export interface User {
  id: string;
  username: string;
  displayName: string;
  email: string;
  avatarBase: string;
  avatarAccessories: string[];
  avatarBackground: string;
  avatarFrame: string;
  bio: string | null;
  currentLevel: number;
  currentRank: string;
  totalXp: number;
  loginStreakDays: number;
  createdAt: string;
}

export interface World {
  id: string;
  name: string;
  description: string;
  sortOrder: number;
  iconEmoji: string;
  prerequisiteWorldId: string | null;
  isUnlocked: boolean;
  modules: Module[];
}

export interface Module {
  id: string;
  worldId: string;
  name: string;
  description: string;
  sortOrder: number;
  prerequisiteModuleId: string | null;
  isUnlocked: boolean;
  lessons: Lesson[];
}

export interface Lesson {
  id: string;
  moduleId: string;
  title: string;
  type: 'learn' | 'quiz' | 'challenge' | 'build' | 'boss';
  sortOrder: number;
  estimatedMinutes: number;
  xpReward: number;
  content: string | null;
  starterCode: string | null;
  status: LessonStatus;
}

export type LessonStatus = 'locked' | 'available' | 'in_progress' | 'completed' | 'perfect';

export interface Achievement {
  id: string;
  name: string;
  description: string;
  icon: string;
  category: AchievementCategory;
  rarity: AchievementRarity;
  xpReward: number;
  unlockedAt: string | null;
  isUnlocked: boolean;
}

export type AchievementCategory = 'milestone' | 'mastery' | 'streak' | 'speed' | 'perfection' | 'completion';
export type AchievementRarity = 'common' | 'uncommon' | 'rare' | 'epic' | 'legendary';

export interface QuizQuestion {
  id: string;
  lessonId: string;
  questionType: 'multiple_choice' | 'multi_select' | 'code_prediction' | 'fill_in_blank';
  questionText: string;
  codeSnippet: string | null;
  options: QuizOption[] | null;
  sortOrder: number;
  points: number;
}

export interface QuizOption {
  id: string;
  text: string;
  isCorrect: boolean;
}

export interface QuizSubmission {
  questionId: string;
  selectedOptionIds?: string[];
  textAnswer?: string;
}

export interface QuizResult {
  score: number;
  totalPoints: number;
  passed: boolean;
  xpEarned: number;
  answers: QuizAnswerResult[];
}

export interface QuizAnswerResult {
  questionId: string;
  correct: boolean;
  correctAnswer: string;
  explanation: string;
  pointsEarned: number;
}

export interface CodeChallenge {
  id: string;
  lessonId: string;
  instructions: string;
  starterCode: string;
  testCases: TestCase[];
  hints: string[];
}

export interface TestCase {
  id: string;
  description: string;
  passed: boolean | null;
}

export interface CodeRunResult {
  output: string;
  errors: string[];
  compilationSuccess: boolean;
}

export interface CodeSubmitResult {
  passed: boolean;
  testResults: TestCase[];
  xpEarned: number;
  output: string;
  errors: string[];
}

export interface WorldProgress {
  completedLessons: number;
  totalLessons: number;
  completionPercentage: number;
}

export interface XPResponse {
  totalXp: number;
  currentLevel: number;
  currentRank: string;
  weeklyXp: number;
  loginStreakDays: number;
  levelUp: LevelUp | null;
  newAchievements: Achievement[];
}

export interface LevelUp {
  newLevel: number;
  newRank: string;
  previousLevel: number;
  previousRank: string;
}

export interface LeaderboardEntry {
  rank: number;
  userId: string;
  username: string;
  displayName: string;
  avatarBase: string;
  avatarFrame: string;
  currentLevel: number;
  currentRank: string;
  xp: number;
  isCurrentUser: boolean;
}

export interface FriendRequest {
  id: string;
  fromUser: User;
  toUser: User;
  status: 'pending' | 'accepted' | 'declined';
  createdAt: string;
}

export interface ActivityEvent {
  id: string;
  type: 'lesson_complete' | 'achievement' | 'quiz' | 'challenge' | 'level_up';
  description: string;
  xpEarned: number;
  createdAt: string;
}

export interface AuthResponse {
  token: string;
  user: User;
}

export interface ApiError {
  message: string;
  errors?: Record<string, string[]>;
}
