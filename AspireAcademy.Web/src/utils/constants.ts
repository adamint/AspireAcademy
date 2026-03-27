import type { LessonStatus } from '../types/curriculum';
import type { XpEvent } from '../types/curriculum';
import { Rank } from '../constants';

/** Rarity → border/accent color mapping used across achievements UI. */
export const rarityColors: Record<string, string> = {
  common: '#8A8886',
  uncommon: '#107C10',
  rare: '#2196F3',
  epic: '#6B4FBB',
  legendary: '#FFD700',
};

/** Lesson status → icon. */
export const statusIcons: Record<LessonStatus, string> = {
  completed: '✅',
  perfect: '⭐',
  in_progress: '🔵',
  available: '○',
  locked: '🔒',
  skipped: '⏭️',
};

/** Lesson type → icon. */
export const typeIcons: Record<string, string> = {
  learn: '📖',
  quiz: '🧪',
  challenge: '💻',
  build: '🏗️',
  boss: '🎮',
  'boss-battle': '🎮',
  'build-project': '🏗️',
};

/** Leaderboard rank → medal (top 3). */
export const medals: Record<number, string> = { 1: '🥇', 2: '🥈', 3: '🥉' };

/** Rank slug → icon. */
export const rankEmojis: Record<string, string> = {
  [Rank.AspireIntern]: '🌱',
  [Rank.AspireDeveloper]: '💻',
  [Rank.AspireEngineer]: '⚡',
  [Rank.AspireSpecialist]: '🔧',
  [Rank.AspireExpert]: '🎯',
  [Rank.AspireMaster]: '🏅',
  [Rank.AspireArchitect]: '🏗️',
};

/** XP event type → icon. */
export const xpEventIcons: Record<XpEvent['type'], string> = {
  lesson: '✅',
  quiz: '📝',
  challenge: '💻',
  achievement: '🏆',
  streak: '🔥',
  bonus: '🎁',
};
