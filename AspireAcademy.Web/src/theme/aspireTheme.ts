import { createSystem, defineConfig, defaultConfig } from '@chakra-ui/react';

const config = defineConfig({
  theme: {
    tokens: {
      colors: {
        aspire: {
          50: { value: '#2A2445' },
          100: { value: '#342D52' },
          200: { value: '#3E3660' },
          300: { value: '#C7CFF1' },
          400: { value: '#B5B7E7' },
          500: { value: '#9185D1' },
          600: { value: '#6B4FBB' },
          700: { value: '#551CA9' },
          800: { value: '#391578' },
          900: { value: '#1B0D3B' },
          950: { value: '#050214' },
        },
        game: {
          xpGold: { value: '#FFD700' },
          xpBar: { value: '#FFC107' },
          streak: { value: '#FF6B35' },
          success: { value: '#107C10' },
          error: { value: '#D13438' },
          locked: { value: '#8A8886' },
          perfect: { value: '#6B4FBB' },
          pixelBorder: { value: '#2B1260' },
          retroBg: { value: '#1A0B2E' },
        },
        dark: {
          bg: { value: '#0D0B1A' },
          card: { value: '#1A1630' },
          sidebar: { value: '#0A0818' },
          surface: { value: '#151224' },
          text: { value: '#E8E0F0' },
          muted: { value: '#9B93B0' },
          border: { value: '#2B1260' },
        },
      },
      fonts: {
        pixel: { value: '"Press Start 2P", monospace' },
      },
    },
  },
});

export const system = createSystem(defaultConfig, config);

// Reusable retro card style props
export const retroCardProps = {
  border: '3px solid',
  borderColor: 'game.pixelBorder',
  boxShadow: '4px 4px 0 var(--chakra-colors-game-pixel-border, #2B1260)',
  borderRadius: 'sm',
} as const;

// Pixel font style props
export const pixelFontProps = {
  fontFamily: 'pixel',
} as const;

// ── Backward-compatible aliases for files not yet migrated to Chakra props ──

/** @deprecated Use `retroCardProps` with Chakra style props instead. */
export const retroCardStyle = {
  border: '3px solid #2B1260',
  boxShadow: '4px 4px 0 #2B1260',
  borderRadius: '4px',
} as const;

/** @deprecated Use `pixelFontProps` with Chakra style props instead. */
export const pixelFontStyle = {
  fontFamily: '"Press Start 2P", monospace',
} as const;

/** @deprecated Use Chakra semantic tokens (e.g. `color="game.xpGold"`) instead. */
export const gameColors = {
  xpGold: '#FFD700',
  xpBarBg: '#E8E0F0',
  xpBarSegment: '#FFC107',
  streakOrange: '#FF6B35',
  successGreen: '#107C10',
  errorRed: '#D13438',
  lockedGray: '#8A8886',
  perfectPurple: '#6B4FBB',
  pixelBorder: '#2B1260',
  retroBg: '#1A0B2E',
} as const;
