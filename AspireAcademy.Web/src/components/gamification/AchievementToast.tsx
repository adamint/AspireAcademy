import { useEffect, useState, useRef, useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Box, Flex, Text, Badge } from '@chakra-ui/react';
import { useGamificationStore } from '../../store/gamificationStore';
import { retroCardProps, pixelFontProps } from '../../theme/aspireTheme';

const rarityColors: Record<string, string> = {
  common: '#8A8886',
  uncommon: '#107C10',
  rare: '#2196F3',
  epic: '#6B4FBB',
  legendary: '#FFD700',
};

interface QueuedAchievement {
  id: string;
  name: string;
  icon: string;
  rarity: string;
  xpReward: number;
}

export default function AchievementToast() {
  const pendingAchievements = useGamificationStore((s) => s.pendingAchievements);
  const clearPendingAchievement = useGamificationStore((s) => s.clearPendingAchievement);
  const [current, setCurrent] = useState<QueuedAchievement | null>(null);
  const queueRef = useRef<QueuedAchievement[]>([]);
  const shownRef = useRef<Set<string>>(new Set());
  const timerRef = useRef<ReturnType<typeof setTimeout>>();

  // Generate confetti positions once per toast
  const confettiEmojis = useMemo(() => {
    if (!current) return [];
    const emojis = ['🎉', '✨', '🌟', '⭐', '🏆', '💫'];
    return Array.from({ length: 10 }, (_, i) => ({
      id: i,
      emoji: emojis[i % emojis.length],
      x: (Math.random() - 0.5) * 200,
      delay: Math.random() * 0.4,
    }));
  }, [current?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const showNext = useCallback(() => {
    if (queueRef.current.length > 0) {
      const next = queueRef.current.shift()!;
      setCurrent(next);

      timerRef.current = setTimeout(() => {
        setCurrent(null);
        clearPendingAchievement(next.id);
        timerRef.current = setTimeout(() => showNext(), 1000);
      }, 5000);
    }
  }, [clearPendingAchievement]);

  useEffect(() => {
    for (const ach of pendingAchievements) {
      if (!shownRef.current.has(ach.id)) {
        shownRef.current.add(ach.id);
        queueRef.current.push({
          id: ach.id,
          name: ach.name,
          icon: ach.icon,
          rarity: ach.rarity,
          xpReward: ach.xpReward,
        });
      }
    }
    if (!current && queueRef.current.length > 0) {
      showNext();
    }
  }, [pendingAchievements, current, showNext]);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  return (
    <Box position="fixed" bottom={6} right={6} zIndex={9000}>
      <AnimatePresence>
        {current && (
          <motion.div
            key={current.id}
            initial={{ y: 100, opacity: 0, scale: 0.8 }}
            animate={{ y: 0, opacity: 1, scale: 1 }}
            exit={{ y: 100, opacity: 0, scale: 0.8 }}
            transition={{ type: 'spring', damping: 18, stiffness: 250 }}
            data-testid="achievement-toast"
          >
            {/* Confetti burst */}
            {confettiEmojis.map((c) => (
              <motion.div
                key={c.id}
                initial={{ opacity: 1, y: 0, x: 0 }}
                animate={{ opacity: 0, y: -80, x: c.x }}
                transition={{ duration: 1.5, delay: c.delay, ease: 'easeOut' }}
                style={{
                  position: 'absolute',
                  top: -5,
                  left: '50%',
                  fontSize: '16px',
                  pointerEvents: 'none',
                }}
              >
                {c.emoji}
              </motion.div>
            ))}

            <Flex
              {...retroCardProps}
              bg="game.retroBg"
              p={4}
              gap={3}
              alignItems="center"
              minW="300px"
              borderColor={rarityColors[current.rarity] ?? rarityColors.common}
            >
              <Text fontSize="2xl" lineHeight="1">{current.icon}</Text>
              <Box>
                <Text {...pixelFontProps} fontSize="8px" color="game.xpGold" mb={1}>
                  🏆 Achievement Unlocked!
                </Text>
                <Text {...pixelFontProps} fontSize="10px" color="dark.text" lineHeight="1.4">
                  {current.name}
                </Text>
                {current.xpReward > 0 && (
                  <Badge
                    {...pixelFontProps}
                    fontSize="8px"
                    colorPalette="yellow"
                    variant="solid"
                    mt={1}
                  >
                    +{current.xpReward} XP
                  </Badge>
                )}
              </Box>
            </Flex>
          </motion.div>
        )}
      </AnimatePresence>
    </Box>
  );
}
