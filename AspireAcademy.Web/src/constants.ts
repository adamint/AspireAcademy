export const LessonType = {
  Learn: 'learn',
  Quiz: 'quiz',
  Challenge: 'challenge',
  BossBattle: 'boss-battle',
  BuildProject: 'build-project',
  // Frontend-only short forms used in types/curriculum.ts
  Build: 'build',
  Boss: 'boss',
} as const;

export const ProgressStatus = {
  NotStarted: 'not-started',
  InProgress: 'in-progress',
  Completed: 'completed',
  Perfect: 'perfect',
  Skipped: 'skipped',
  // Frontend-only statuses
  Available: 'available',
  Locked: 'locked',
  InProgressUnderscore: 'in_progress',
} as const;

export const FriendshipStatus = {
  Pending: 'pending',
  Accepted: 'accepted',
} as const;

export const Rank = {
  AspireIntern: 'aspire-intern',
  AspireDeveloper: 'aspire-developer',
  AspireEngineer: 'aspire-engineer',
  AspireSpecialist: 'aspire-specialist',
  AspireExpert: 'aspire-expert',
  AspireMaster: 'aspire-master',
  AspireArchitect: 'aspire-architect',
} as const;
