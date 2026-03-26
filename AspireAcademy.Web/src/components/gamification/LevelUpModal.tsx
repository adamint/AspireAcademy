import { Box, Text, Button, VStack } from '@chakra-ui/react';
import { FiStar } from 'react-icons/fi';
import Confetti from 'react-confetti';
import { useEffect, useState } from 'react';
import { useGamificationStore } from '../../store/gamificationStore';
import { retroCardProps, pixelFontProps } from '../../theme/aspireTheme';

interface UnlockedItem {
  name: string;
  type: string;
}

export default function LevelUpModal() {
  const pendingLevelUp = useGamificationStore((s) => s.pendingLevelUp);
  const setPendingLevelUp = useGamificationStore((s) => s.setPendingLevelUp);
  const [windowSize, setWindowSize] = useState({ width: window.innerWidth, height: window.innerHeight });

  useEffect(() => {
    const handleResize = () => setWindowSize({ width: window.innerWidth, height: window.innerHeight });
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  if (!pendingLevelUp) return null;

  const unlockedItems = (pendingLevelUp as Record<string, unknown>).unlockedItems as UnlockedItem[] | undefined;
  const rankEmoji = pendingLevelUp.previousRank !== pendingLevelUp.newRank ? '🎖️' : '⭐';

  return (
    <Box position="fixed" inset={0} zIndex={9999} display="flex" alignItems="center" justifyContent="center">
      {/* Dark backdrop */}
      <Box position="absolute" inset={0} bg="blackAlpha.700" />

      <Confetti
        width={windowSize.width}
        height={windowSize.height}
        numberOfPieces={300}
        recycle={false}
        colors={['#FFD700', '#6B4FBB', '#107C10', '#FF6B35', '#2196F3']}
        style={{ position: 'fixed', top: 0, left: 0, zIndex: 10000 }}
      />

      <VStack
        {...retroCardProps}
        bg="game.retroBg"
        p={8}
        maxW="480px"
        w="90%"
        textAlign="center"
        zIndex={10001}
        gap={4}
        position="relative"
      >
        <Box fontSize="64px" color="game.xpGold">
          <FiStar />
        </Box>

        <Text {...pixelFontProps} fontSize="2xl" color="game.xpGold">
          LEVEL UP!
        </Text>

        <Text {...pixelFontProps} fontSize="xl" color="game.xpGold">
          Level {pendingLevelUp.newLevel}
        </Text>

        <Text color="dark.text" fontSize="md">
          {rankEmoji}{' '}
          {pendingLevelUp.previousRank !== pendingLevelUp.newRank ? (
            <>New Rank: <Text as="span" fontWeight="bold" color="game.xpGold">{pendingLevelUp.newRank}</Text></>
          ) : (
            <>Rank: <Text as="span" fontWeight="bold">{pendingLevelUp.newRank}</Text></>
          )}
        </Text>

        {unlockedItems && unlockedItems.length > 0 && (
          <VStack gap={1} w="100%">
            <Text {...pixelFontProps} fontSize="xs" color="game.xpGold">Unlocked:</Text>
            {unlockedItems.map((item, i) => (
              <Text key={i} fontSize="sm" color="white">
                ✨ {item.name} ({item.type})
              </Text>
            ))}
          </VStack>
        )}

        <Button
          {...pixelFontProps}
          colorPalette="purple"
          size="lg"
          mt={4}
          onClick={() => setPendingLevelUp(null)}
        >
          Continue
        </Button>
      </VStack>
    </Box>
  );
}
