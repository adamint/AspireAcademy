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
    version: '1.4.0',
    date: '2026-04-01',
    title: 'Gallery Overhaul, Guided Tour & Style Fixes',
    highlights: ['12 architecture examples across 5 categories', 'Guided tour for new users', 'Font & style consistency fixes'],
    entries: [
      { type: 'feature', text: 'Gallery expanded from 6 to 12 architecture examples organized into 5 categories (Web, AI, Data, Event-Driven, Enterprise)' },
      { type: 'feature', text: 'Category filter bar with count badges and difficulty levels on all gallery cards' },
      { type: 'feature', text: 'Rich explanation tab with architecture overview, Why Aspire section, key patterns, and scaling notes' },
      { type: 'feature', text: 'Guided tour for first-time users: 5-step walkthrough with spotlight overlay, keyboard navigation, and progress dots' },
      { type: 'feature', text: 'Restart Tour button in Settings page' },
      { type: 'fix', text: 'Fixed font system: added body/heading fonts to Chakra theme to prevent Times New Roman fallback' },
      { type: 'fix', text: 'Removed conflicting #root and h1/h2 CSS styles from index.css' },
      { type: 'fix', text: 'Fixed sidebar external links using pixel font at unreadable sizes' },
      { type: 'fix', text: 'Fixed 6px pixel font in WorldCompletionBadges' },
      { type: 'improvement', text: 'Standardized all sidebar section headers to use pixelFontProps theme helper' },
      { type: 'improvement', text: 'Dashboard heading now uses pixel font to match other page headings' },
      { type: 'improvement', text: 'Form elements now inherit body font via CSS' },
    ]
  },
  {
    version: '1.3.5',
    date: '2026-03-30',
    title: 'Deployment Resource Group Default',
    highlights: ['Default resource group in CI', 'Fewer deploy env misconfig failures'],
    entries: [
      { type: 'fix', text: 'Release workflow now defaults AZURE_RESOURCE_GROUP to aspire-academy when repo variable is unset' },
      { type: 'improvement', text: 'Deploy command no longer runs with an empty resource group parameter by default' },
    ]
  },
  {
    version: '1.3.4',
    date: '2026-03-30',
    title: 'Deployment Subscription Fallback',
    highlights: ['Azure subscription fallback', 'Deploy stage resilience'],
    entries: [
      { type: 'fix', text: 'Release workflow now resolves Azure subscription from secret, variable, or logged-in context' },
      { type: 'improvement', text: 'Prevents deploy failures when AZURE_SUBSCRIPTION_ID secret is not configured' },
    ]
  },
  {
    version: '1.3.3',
    date: '2026-03-30',
    title: 'Release Pipeline Export Fix',
    highlights: ['VERSION exported for release job', 'Release notes generation fixed'],
    entries: [
      { type: 'fix', text: 'Exported VERSION before invoking Python in GitHub release workflow' },
      { type: 'improvement', text: 'Release notes extraction can now read the target version reliably in CI' },
    ]
  },
  {
    version: '1.3.2',
    date: '2026-03-30',
    title: 'Release Pipeline Variable Fix',
    highlights: ['Fixed VERSION interpolation', 'Release automation stabilized'],
    entries: [
      { type: 'fix', text: 'Release notes job now reads VERSION from environment in GitHub Actions' },
      { type: 'improvement', text: 'Unblocks release creation and subsequent Azure deployment stage' },
    ]
  },
  {
    version: '1.3.1',
    date: '2026-03-30',
    title: 'Release Pipeline Hotfix',
    highlights: ['Reliable release-note parsing', 'Unblocked automated deploys'],
    entries: [
      { type: 'fix', text: 'Fixed GitHub release workflow changelog parsing for non-last versions' },
      { type: 'improvement', text: 'Release tags now consistently generate release notes and proceed to deployment' },
    ]
  },
  {
    version: '1.3.0',
    date: '2026-03-27',
    title: 'The Big Update',
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
    title: 'Challenge Overhaul',
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
    title: 'Visual Refresh',
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
    title: 'Launch',
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
