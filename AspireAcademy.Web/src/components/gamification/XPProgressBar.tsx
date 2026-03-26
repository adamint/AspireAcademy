import { Flex, Box, Text } from '@chakra-ui/react';
import { useGamificationStore } from '../../store/gamificationStore';
import { retroCardProps, pixelFontProps } from '../../theme/aspireTheme';

const XP_PER_LEVEL = 500;

export function XPProgressBar() {
  const { totalXp, currentLevel } = useGamificationStore();
  const xpInLevel = totalXp % XP_PER_LEVEL;
  const pct = Math.min((xpInLevel / XP_PER_LEVEL) * 100, 100);

  return (
    <Flex
      data-testid="xp-bar"
      align="center"
      gap="2.5"
      px="3"
      py="1"
      bg="dark.card"
      {...retroCardProps}
    >
      {/* Level label */}
      <Text
        {...pixelFontProps}
        fontSize="10px"
        color="aspire.600"
        whiteSpace="nowrap"
      >
        Lvl {currentLevel}
      </Text>

      {/* Bar */}
      <Box
        position="relative"
        w={{ base: '80px', md: '120px' }}
      >
        <Box className="xp-bar-track">
          <Box
            className="xp-bar-fill"
            style={{ width: `${pct}%` }}
          />
        </Box>
      </Box>

      {/* XP counter */}
      <Text
        {...pixelFontProps}
        fontSize="8px"
        color="game.locked"
        whiteSpace="nowrap"
      >
        {xpInLevel}/{XP_PER_LEVEL}
      </Text>
    </Flex>
  );
}
