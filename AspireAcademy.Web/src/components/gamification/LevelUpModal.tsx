import { Box, Text, Button, VStack } from '@chakra-ui/react';
import { FiStar } from 'react-icons/fi';
import Confetti from 'react-confetti';
import { useGamificationStore } from '../../store/gamificationStore';
import { retroCardProps, pixelFontProps } from '../../theme/aspireTheme';

export default function LevelUpModal() {
  const pendingLevelUp = useGamificationStore((s) => s.pendingLevelUp);
  const setPendingLevelUp = useGamificationStore((s) => s.setPendingLevelUp);

  if (!pendingLevelUp) return null;

  const unlockedItems = pendingLevelUp.unlockedItems;

  return (
    <Box position="fixed" inset={0} zIndex={9999} display="flex" alignItems="center" justifyContent="center" role="dialog" aria-modal="true" aria-labelledby="levelup-title" onKeyDown={(e) => { if (e.key === 'Escape') setPendingLevelUp(null); }}>
      {/* Dark backdrop */}
      <Box position="absolute" inset={0} bg="blackAlpha.700" />

      <Confetti
        width={window.innerWidth}
        height={window.innerHeight}
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
        <Box fontSize="64px" color="game.gold" aria-hidden="true">
          <FiStar />
        </Box>

        <Text id="levelup-title" {...pixelFontProps} fontSize="2xl" color="game.gold">
          LEVEL UP!
        </Text>

        <Text {...pixelFontProps} fontSize="xl" color="game.gold">
          Level {pendingLevelUp.newLevel}
        </Text>

        <Text color="dark.text" fontSize="md">
          {pendingLevelUp.previousRank !== pendingLevelUp.newRank ? (
            <>New Rank: <Text as="span" fontWeight="bold" color="game.gold">{pendingLevelUp.newRank}</Text></>
          ) : (
            <>Rank: <Text as="span" fontWeight="bold">{pendingLevelUp.newRank}</Text></>
          )}
        </Text>

        {unlockedItems && unlockedItems.length > 0 && (
          <VStack gap={1} w="100%">
            <Text {...pixelFontProps} fontSize="xs" color="game.gold">Unlocked:</Text>
            {unlockedItems.map((item, i) => (
              <Text key={i} fontSize="sm" color="dark.text">
                {item.name} ({item.type})
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
          title="Continue from level up"
          aria-label="Continue from level up"
        >
          Continue
        </Button>
      </VStack>
    </Box>
  );
}
