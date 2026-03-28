import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Box, Flex, Text, Badge } from '@chakra-ui/react';
import { motion } from 'framer-motion';
import { FiChevronRight } from 'react-icons/fi';
import { pixelFontProps } from '../../theme/aspireTheme';
import { useAuthStore } from '../../store/authStore';
import api from '../../services/apiClient';

interface Achievement {
  id: string;
  name: string;
  description: string;
  icon: string;
  rarity: string;
  xpReward: number;
  unlockedAt?: string;
  progress?: number;
  target?: number;
}

export default function NextAchievementTeaser() {
  const navigate = useNavigate();
  const token = useAuthStore((s) => s.token);
  const user = useAuthStore((s) => s.user);
  const isAuthenticated = !!token && !!user;

  const { data: achievements } = useQuery<Achievement[]>({
    queryKey: ['achievements'],
    queryFn: () => api.get('/achievements').then((r) => r.data),
    enabled: isAuthenticated,
    staleTime: 60_000,
  });

  const nextAchievement = useMemo(() => {
    if (!achievements) return null;
    // Find first locked achievement with progress info
    const locked = achievements.filter((a) => !a.unlockedAt);
    if (locked.length === 0) return null;
    // Prefer one with highest progress ratio
    const withProgress = locked.filter((a) => a.progress !== undefined && a.target !== undefined && a.target > 0);
    if (withProgress.length > 0) {
      withProgress.sort((a, b) => (b.progress! / b.target!) - (a.progress! / a.target!));
      return withProgress[0];
    }
    return locked[0];
  }, [achievements]);

  if (!isAuthenticated || !nextAchievement) return null;

  const progressPct = (nextAchievement.progress !== undefined && nextAchievement.target)
    ? Math.min((nextAchievement.progress / nextAchievement.target) * 100, 100)
    : 0;

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: 0.5 }}
    >
      <Flex
        as="button"
        align="center"
        gap="3"
        px="4"
        py="3"
        bg="rgba(234, 179, 8, 0.06)"
        border="1px solid rgba(234, 179, 8, 0.2)"
        borderRadius="sm"
        cursor="pointer"
        width="100%"
        transition="all 0.2s"
        _hover={{ bg: 'rgba(234, 179, 8, 0.1)', borderColor: 'rgba(234, 179, 8, 0.35)' }}
        onClick={() => navigate('/achievements')}
      >
        <Text fontSize="xl">{nextAchievement.icon}</Text>
        <Box flex="1" textAlign="left">
          <Flex align="center" gap="2" mb="0.5">
            <Text fontSize="xs" fontWeight="bold" color="rgba(234, 179, 8, 0.7)" textTransform="uppercase" letterSpacing="wider">
              Next Achievement
            </Text>
            <Badge {...pixelFontProps} fontSize="2xs" bg="rgba(234, 179, 8, 0.15)" color="#facc15" borderRadius="sm">
              +{nextAchievement.xpReward} XP
            </Badge>
          </Flex>
          <Text fontSize="sm" color="var(--text-h)" fontWeight="500">
            {nextAchievement.name}
          </Text>
          {progressPct > 0 && (
            <Box mt="1.5" position="relative" h="4px" bg="rgba(234, 179, 8, 0.1)" borderRadius="full" overflow="hidden">
              <Box
                position="absolute"
                left="0"
                top="0"
                h="100%"
                bg="linear-gradient(90deg, #eab308, #facc15)"
                borderRadius="full"
                style={{ width: `${progressPct}%` }}
                transition="width 0.5s ease"
              />
            </Box>
          )}
        </Box>
        <FiChevronRight size={16} color="#facc15" />
      </Flex>
    </motion.div>
  );
}
