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
    version: '1.6.0',
    date: '2026-04-05',
    title: 'Mission Control Homepage, Color Refresh & Polish',
    highlights: [
      'Mission Control split-layout homepage with side panel',
      'Vibrant jewel-tone color accents across the app',
      'Fixed code blocks rendering as single lines',
      'Curriculum accuracy updates from Aspire source audit',
    ],
    entries: [
      { type: 'feature', text: 'Mission Control homepage: split hero with 6-card side panel (Playground, Gallery, Concept Map, Curriculum, What\'s New, Learning Tracks)' },
      { type: 'feature', text: 'Homepage bento grid Why Aspire section with colored top borders and curriculum links' },
      { type: 'feature', text: 'Homepage horizontal world cards with per-world accent colors' },
      { type: 'feature', text: 'Inline How It Works steps with colored badges and arrow separators' },
      { type: 'feature', text: 'Theme toggle button on homepage navbar' },
      { type: 'feature', text: 'GitHub icon in homepage navbar and footer' },
      { type: 'improvement', text: 'Vibrant jewel-tone color accents (teal, amber, rose, emerald) across gallery, leaderboard, sidebar, and world cards' },
      { type: 'improvement', text: 'Light theme: proper contrast, mode-aware sidebar and TopBar, semantic color tokens' },
      { type: 'improvement', text: 'WCAG AA color contrast fixes across 33 files' },
      { type: 'improvement', text: 'Sidebar colored dots on all Explore section links for visual consistency' },
      { type: 'improvement', text: 'Gallery progressive disclosure: Architecture Overview expanded by default, readable toggle buttons' },
      { type: 'improvement', text: 'Achievements show real names when locked instead of "???"' },
      { type: 'improvement', text: 'Dashboard hides activity heatmap for anonymous users' },
      { type: 'improvement', text: 'Leaderboard filters out E2E test users' },
      { type: 'improvement', text: 'Page titles set on all 19 pages for browser tab clarity' },
      { type: 'improvement', text: 'New slogan: "Learn Aspire · Build real apps · Level up your stack"' },
      { type: 'fix', text: 'Fixed code blocks rendering as single lines across the entire app (MarkdownContent PreTag, global CSS display:inline-flex override)' },
      { type: 'fix', text: 'Fixed curriculum: AddCSharpApp marked as experimental, deploy command flags corrected, parameter resolution chain documented' },
      { type: 'fix', text: 'Removed fake "learners completed" count from lesson pages' },
      { type: 'fix', text: 'Fixed E2E test failures: persona selectors, playground validation, weekly challenge, admin auth' },
      { type: 'content', text: 'Curriculum audited against Aspire source code — corrected AddCSharpApp, deploy commands, and parameter documentation' },
      { type: 'content', text: 'Updated SETUP.md, CONTRIBUTING.md, and frontend README with accurate paths and versions' },
    ],
  },
  {
    version: '1.5.0',
    date: '2026-04-04',
    title: 'Deploy Pipeline, Interactive Features & Quality Sweep',
    highlights: [
      'Automated Azure deployment via GitHub Actions',
      'Gallery deep links, search, interactive diagrams & Playground bridge',
      'Playground undo/redo, sharing & live validation',
      'Comprehensive accessibility, security & content accuracy fixes',
    ],
    entries: [
      { type: 'feature', text: 'Automated Azure deployment pipeline via GitHub Actions with Aspire deploy to Azure Container Apps' },
      { type: 'feature', text: 'Gallery deep-linkable projects — share direct URLs to any architecture example' },
      { type: 'feature', text: 'Gallery search bar — filter projects by title, description, category, or concepts' },
      { type: 'feature', text: 'Gallery interactive diagrams — click services to highlight connections and view details' },
      { type: 'feature', text: 'Gallery to Playground bridge — open any gallery architecture directly in the Playground' },
      { type: 'feature', text: 'Gallery "Related Lessons" links — concept tags now link to matching curriculum lessons' },
      { type: 'feature', text: 'Playground undo/redo with 50-entry history, Ctrl+Z / Ctrl+Shift+Z keyboard shortcuts' },
      { type: 'feature', text: 'Playground shareable state — encode your architecture in a URL and share it with anyone' },
      { type: 'feature', text: 'Playground visual connection lines — SVG bezier curves show references and waitFor dependencies' },
      { type: 'feature', text: 'Playground live validation — warnings for empty names, duplicates, orphaned resources, missing images' },
      { type: 'feature', text: 'Concept Map "Suggested Next" section — highlights concepts ready to learn based on your progress' },
      { type: 'feature', text: 'Concept Map empty search state with clear button' },
      { type: 'feature', text: 'Homepage quick links bar — fast access to Playground, Gallery, Concept Map, and Curriculum' },
      { type: 'feature', text: 'Homepage Why Aspire cards now link to relevant app sections (Playground, Gallery, lessons, Concept Map)' },
      { type: 'improvement', text: 'Gallery detail progressive disclosure — Architecture Overview and Why Aspire sections collapse for less overwhelm' },
      { type: 'improvement', text: 'Homepage visual refresh — gradient borders, animated stats, staggered world card entrances, timeline for How It Works' },
      { type: 'improvement', text: 'Keyboard navigation and ARIA labels added to all interactive elements across 5+ pages' },
      { type: 'improvement', text: 'Error states with retry buttons added to Dashboard, Gallery, Leaderboard, Achievements, Friends, and more' },
      { type: 'improvement', text: 'Consistent font sizing — normalized small text from raw px values to Chakra size tokens' },
      { type: 'improvement', text: 'Theme token consistency — replaced hardcoded hex colors with dark.bg and dark.surface tokens' },
      { type: 'fix', text: 'Fixed playground redo not working due to React strict-mode double-fire clearing history state' },
      { type: 'fix', text: 'Fixed terminal interactive blocks showing "undefined" when content used command/output format' },
      { type: 'fix', text: 'Fixed homepage canvas scaling compounding on window resize' },
      { type: 'fix', text: 'Fixed 7 incorrect concept-to-lesson mappings in Concept Map (SQL Server, MongoDB, RabbitMQ, and more)' },
      { type: 'fix', text: 'Fixed false content claims about secret parameters never being shown in the Aspire Dashboard' },
      { type: 'fix', text: 'Fixed single-line code blocks that should be multiline (class/interface definitions)' },
      { type: 'fix', text: 'Fixed timer memory leaks in LessonPage and SettingsPage (cleanup on unmount)' },
      { type: 'fix', text: 'Backend: hardened admin auth, fixed registration race condition, added unlock checks on quiz/challenge/skip endpoints' },
      { type: 'fix', text: 'Backend: fixed rate limiter memory leak, added GitHub username validation, removed incorrect LastLoginAt update' },
    ],
  },
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
