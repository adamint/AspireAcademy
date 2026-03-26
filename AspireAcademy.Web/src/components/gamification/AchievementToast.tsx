import { useEffect, useState, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Box, Flex, Text } from '@chakra-ui/react';
import { useGamificationStore } from '../../store/gamificationStore';
import { retroCardProps, pixelFontProps } from '../../theme/aspireTheme';

interface QueuedAchievement {
  id: string;
  name: string;
  icon: string;
  xpReward: number;
}

export default function AchievementToast() {
  const pendingAchievements = useGamificationStore((s) => s.pendingAchievements);
  const clearPendingAchievement = useGamificationStore((s) => s.clearPendingAchievement);
  const [current, setCurrent] = useState<QueuedAchievement | null>(null);
  const queueRef = useRef<QueuedAchievement[]>([]);
  const shownRef = useRef<Set<string>>(new Set());
  const timerRef = useRef<ReturnType<typeof setTimeout>>();

  const showNext = useCallback(() => {
    if (queueRef.current.length > 0) {
      const next = queueRef.current.shift()!;
      setCurrent(next);

      timerRef.current = setTimeout(() => {
        setCurrent(null);
        clearPendingAchievement(next.id);
        // 1s gap before showing next toast
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
            initial={{ y: 100, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 100, opacity: 0 }}
            transition={{ type: 'spring', damping: 20, stiffness: 300 }}
          >
            <Flex
              {...retroCardProps}
              bg="game.retroBg"
              p={4}
              gap={3}
              alignItems="center"
              minW="280px"
            >
              <Text fontSize="2xl" lineHeight="1">{current.icon}</Text>
              <Box>
                <Text {...pixelFontProps} fontSize="10px" color="white" lineHeight="1.4">
                  {current.name}
                </Text>
                <Text {...pixelFontProps} fontSize="10px" color="game.xpGold" lineHeight="1.4">
                  +{current.xpReward} XP
                </Text>
              </Box>
            </Flex>
          </motion.div>
        )}
      </AnimatePresence>
    </Box>
  );
}
