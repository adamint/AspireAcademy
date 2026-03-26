import { Box, Text, Image } from '@chakra-ui/react';
import { useState } from 'react';
import { pixelFontProps } from '../../theme/aspireTheme';

export interface AvatarDisplayProps {
  url: string;
  size?: 'sm' | 'md' | 'lg';
  level?: number;
  name?: string;
}

const sizeMap = { sm: 32, md: 64, lg: 128 } as const;

const levelFrameColor = (level?: number): string => {
  if (!level || level < 10) return 'transparent';
  if (level < 20) return '#CD7F32'; // bronze
  if (level < 30) return '#C0C0C0'; // silver
  if (level < 40) return '#FFD700'; // gold
  return '#B9F2FF'; // diamond
};

function getInitials(value: string): string {
  const parts = value.trim().split(/\s+/);
  if (parts.length >= 2) {
    return `${parts[0][0]}${parts[1][0]}`;
  }
  return value.slice(0, 2);
}

export default function AvatarDisplay({ url, size = 'md', level, name }: AvatarDisplayProps) {
  const px = sizeMap[size];
  const [failed, setFailed] = useState(false);
  const frameColor = levelFrameColor(level);
  const baseBorderWidth = size === 'sm' ? 2 : size === 'md' ? 3 : 4;
  const fontSize = size === 'sm' ? 8 : size === 'md' ? 14 : 28;

  if (failed || !url) {
    const initials = name ? getInitials(name) : '??';
    return (
      <Box
        display="inline-flex"
        alignItems="center"
        justifyContent="center"
        w={`${px}px`}
        h={`${px}px`}
        bg="#6B4FBB"
        border={`${baseBorderWidth}px solid ${frameColor}`}
        borderRadius="sm"
        boxShadow={`${baseBorderWidth}px ${baseBorderWidth}px 0 #2B1260`}
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

  return (
    <Box
      display="inline-flex"
      w={`${px}px`}
      h={`${px}px`}
      border={`${baseBorderWidth}px solid ${frameColor}`}
      borderRadius="sm"
      boxShadow={`${baseBorderWidth}px ${baseBorderWidth}px 0 #2B1260`}
      overflow="hidden"
      flexShrink={0}
    >
      <Image
        src={url}
        alt={name ?? 'Avatar'}
        w="100%"
        h="100%"
        objectFit="cover"
        css={{ imageRendering: 'pixelated' }}
        onError={() => setFailed(true)}
      />
    </Box>
  );
}
