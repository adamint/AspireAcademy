import { Box, Text } from '@chakra-ui/react';
import { pixelFontProps } from '../../theme/aspireTheme';

export interface AvatarDisplayProps {
  base: string;
  frame?: string;
  size?: 'sm' | 'md' | 'lg';
  name?: string;
}

const sizeMap = { sm: 32, md: 64, lg: 128 } as const;

const baseColors: Record<string, string> = {
  developer: '#6B4FBB',
  architect: '#2196F3',
  devops: '#FF6B35',
  'data-engineer': '#107C10',
};

const frameColors: Record<string, { color: string; thick?: boolean }> = {
  none: { color: 'transparent' },
  bronze: { color: '#CD7F32' },
  silver: { color: '#C0C0C0' },
  gold: { color: '#FFD700' },
  diamond: { color: '#B9F2FF' },
  golden: { color: '#FFD700', thick: true },
};

function getInitials(value: string): string {
  const parts = value.trim().split(/\s+/);
  if (parts.length >= 2) {
    return `${parts[0][0]}${parts[1][0]}`;
  }
  return value.slice(0, 2);
}

export default function AvatarDisplay({ base, frame, size = 'md', name }: AvatarDisplayProps) {
  const px = sizeMap[size];
  const bgColor = baseColors[base] ?? '#6B4FBB';
  const frameInfo = frame ? (frameColors[frame] ?? { color: 'transparent' }) : { color: 'transparent' };
  const baseBorderWidth = size === 'sm' ? 2 : size === 'md' ? 3 : 4;
  const borderWidth = frameInfo.thick ? baseBorderWidth + 2 : baseBorderWidth;
  const fontSize = size === 'sm' ? 8 : size === 'md' ? 14 : 28;
  const initials = name ? getInitials(name) : base.slice(0, 2).toUpperCase();

  return (
    <Box
      display="inline-flex"
      alignItems="center"
      justifyContent="center"
      w={`${px}px`}
      h={`${px}px`}
      bg={bgColor}
      border={`${borderWidth}px solid ${frameInfo.color}`}
      borderRadius="sm"
      boxShadow={`${baseBorderWidth}px ${baseBorderWidth}px 0 #2B1260`}
      css={{ imageRendering: 'pixelated' }}
      flexShrink={0}
    >
      <Text
        {...pixelFontProps}
        fontSize={`${fontSize}px`}
        color="white"
        textTransform="uppercase"
        userSelect="none"
        lineHeight="1"
      >
        {initials}
      </Text>
    </Box>
  );
}
