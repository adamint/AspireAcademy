import { useState, useEffect } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Box, Flex, Text, Button, Badge,
} from '@chakra-ui/react';
import { AnimatePresence, motion } from 'framer-motion';
import { retroCardProps, pixelFontProps } from '../../theme/aspireTheme';
import { useGamificationStore } from '../../store/gamificationStore';
import { useAuthStore } from '../../store/authStore';
import api from '../../services/apiClient';

interface DailyRewardResponse {
  awarded: boolean;
  xpAwarded: number;
  streakDays: number;
  alreadyClaimed: boolean;
}

const DAILY_REWARD_KEY = 'aspire-daily-reward-date';

export default function DailyRewardPopup() {
  const [visible, setVisible] = useState(false);
  const [rewardData, setRewardData] = useState<DailyRewardResponse | null>(null);
  const user = useAuthStore((s) => s.user);
  const syncFromServer = useGamificationStore((s) => s.syncFromServer);
  const queryClient = useQueryClient();

  const claimMutation = useMutation({
    mutationFn: () => api.post<DailyRewardResponse>('/daily-reward').then((r) => r.data),
    onSuccess: (data) => {
      if (data.awarded) {
        setRewardData(data);
        setVisible(true);
        localStorage.setItem(DAILY_REWARD_KEY, new Date().toDateString());

        const store = useGamificationStore.getState();
        syncFromServer({
          totalXp: store.totalXp + data.xpAwarded,
          currentLevel: store.currentLevel,
          currentRank: store.currentRank,
          weeklyXp: store.weeklyXp + data.xpAwarded,
          loginStreakDays: data.streakDays,
        });
        // Refetch authoritative XP from server to correct any drift
        queryClient.invalidateQueries({ queryKey: ['xp'] });
      } else {
        localStorage.setItem(DAILY_REWARD_KEY, new Date().toDateString());
      }
    },
  });

  useEffect(() => {
    if (!user) return;

    const lastClaim = localStorage.getItem(DAILY_REWARD_KEY);
    const today = new Date().toDateString();
    if (lastClaim === today) return;

    const timer = setTimeout(() => {
      claimMutation.mutate();
    }, 1500);

    return () => clearTimeout(timer);
  }, [user]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!visible || !rewardData) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, scale: 0.8 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.8 }}
        transition={{ duration: 0.4, ease: 'easeOut' }}
        style={{
          position: 'fixed',
          inset: 0,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 2000,
          background: 'rgba(0,0,0,0.6)',
        }}
        data-testid="daily-reward-popup"
      >
        <Box
          {...retroCardProps}
          bg="game.retroBg"
          p={8}
          maxW="380px"
          w="90%"
          textAlign="center"
          role="dialog"
          aria-modal="true"
          aria-labelledby="daily-reward-title"
          onKeyDown={(e) => { if (e.key === 'Escape') setVisible(false); }}
        >
          <Text fontSize="40px" mb={3} aria-hidden="true">🎁</Text>
          <Text id="daily-reward-title" {...pixelFontProps} fontSize="md" color="dark.text" mb={2}>
            Daily Reward!
          </Text>
          <Text fontSize="sm" color="dark.muted" mb={4}>
            Welcome back! Here&apos;s your daily bonus.
          </Text>

          <Text {...pixelFontProps} fontSize="xs" color="game.streak" mb={4}>
            🔥 {rewardData.streakDays} day streak!
          </Text>

          {/* XP Badge */}
          <Badge
            {...pixelFontProps}
            fontSize="lg"
            px={5}
            py={2}
            bg="game.xpGold"
            color="black"
            borderRadius="md"
            mb={5}
            display="inline-block"
            css={{
              animation: 'pulse 1.5s ease-in-out infinite',
              '@keyframes pulse': {
                '0%, 100%': { transform: 'scale(1)' },
                '50%': { transform: 'scale(1.08)' },
              },
            }}
          >
            +{rewardData.xpAwarded} XP
          </Badge>

          <Box>
            <Button
              colorPalette="purple"
              size="md"
              onClick={() => setVisible(false)}
              data-testid="daily-reward-claim-btn"
              title="Close daily reward popup"
              aria-label="Close daily reward popup"
            >
              Awesome!
            </Button>
          </Box>
        </Box>
      </motion.div>
    </AnimatePresence>
  );
}
