export interface ChangelogEntry {
  version: string;
  date: string;
  title: string;
  highlights: string[];
  entries: {
    type: 'feature' | 'content' | 'fix' | 'improvement';
    text: string;
  }[];
}

export const changelog: ChangelogEntry[] = [
  {
    version: '1.3.0',
    date: '2026-03-27',
    title: '🎮 The Big Update',
    highlights: ['Architecture Playground', 'Weekly Challenges', 'Certificates'],
    entries: [
      { type: 'feature', text: 'Architecture Playground — visually design Aspire app models and see generated code' },
      { type: 'feature', text: 'Weekly Challenges — rotating challenges with separate leaderboard and 2x XP' },
      { type: 'feature', text: 'Completion Certificates — downloadable certificates for each world' },
      { type: 'feature', text: 'Concept Map — interactive visualization of how Aspire concepts connect' },
      { type: 'feature', text: 'API Cheat Sheet — searchable quick-reference for all Aspire APIs' },
      { type: 'feature', text: 'Settings page with theme, preferences, and account management' },
      { type: 'feature', text: 'Real World Gallery — production Aspire architecture examples' },
      { type: 'improvement', text: 'Daily login rewards with streak bonuses' },
      { type: 'improvement', text: 'Achievement toast notifications with confetti' },
      { type: 'improvement', text: 'Share progress button on profile' },
      { type: 'improvement', text: 'GitHub username on profile with avatar integration' },
    ]
  },
  {
    version: '1.2.0',
    date: '2026-03-25',
    title: '🔧 Challenge Overhaul',
    highlights: ['Stronger test cases', 'Comment-aware checker', 'Failure banner'],
    entries: [
      { type: 'fix', text: 'Code checker now strips comments before validation — no more passing tests via TODO comments' },
      { type: 'improvement', text: 'All 27 challenges now have 5-15 test cases (up from 1)' },
      { type: 'feature', text: 'Clear red failure banner showing pass/fail count on challenge submission' },
      { type: 'fix', text: 'Removed broken Run button and output panel from challenge page' },
      { type: 'improvement', text: 'Switched AI tutor to Azure AI Foundry via Aspire integration' },
    ]
  },
  {
    version: '1.1.0',
    date: '2026-03-20',
    title: '🎨 Visual Refresh',
    highlights: ['Dark theme', 'Retro aesthetic', 'DiceBear avatars'],
    entries: [
      { type: 'feature', text: 'Dark theme default with light mode toggle' },
      { type: 'feature', text: 'Retro pixel-art game aesthetic with "Press Start 2P" font' },
      { type: 'feature', text: 'DiceBear pixel-art avatar randomizer' },
      { type: 'improvement', text: 'WCAG AA contrast compliance' },
      { type: 'content', text: 'Curriculum expanded to 13 worlds with 153 lessons' },
    ]
  },
  {
    version: '1.0.0',
    date: '2026-03-15',
    title: '🚀 Launch',
    highlights: ['13 worlds', 'Code challenges', 'Gamification'],
    entries: [
      { type: 'feature', text: 'Initial release with 13 worlds of Aspire content' },
      { type: 'feature', text: 'Interactive code challenges with static checker' },
      { type: 'feature', text: 'XP, levels, ranks, streaks, and achievements' },
      { type: 'feature', text: 'Leaderboard and friends system' },
      { type: 'feature', text: 'AI tutor for challenge hints' },
      { type: 'feature', text: 'Admin panel with Aspire Dashboard commands' },
    ]
  }
];
