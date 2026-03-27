import { useMemo } from 'react';
import { useNavigate, Link as RouterLink } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  Box,
  Flex,
  Text,
  Button,
  Card,
  Badge,
  Heading,
  SimpleGrid,
  Skeleton,
} from '@chakra-ui/react';
import { retroCardProps, pixelFontProps } from '../theme/aspireTheme';
import { useAuthStore } from '../store/authStore';
import { Rank, LessonType } from '../constants';
import api from '../services/apiClient';
import WorldCard from '../components/curriculum/WorldCard';
import AspireQuickStartCard from '../components/gamification/AspireQuickStartCard';
import WorldCompletionBadges from '../components/gamification/WorldCompletionBadges';
import ProgressMilestonePopup from '../components/gamification/ProgressMilestonePopup';
import ActivityHeatmap from '../components/ActivityHeatmap';
import type { World, XpResponse, XpEvent } from '../types/curriculum';

const rankEmojis: Record<string, string> = {
  [Rank.AspireIntern]: '🌱',
  'junior-dev': '💚',
  'mid-dev': '💙',
  'senior-dev': '💜',
  'tech-lead': '⭐',
  'architect': '🏗️',
  'fellow': '👑',
};

const xpEventIcons: Record<XpEvent['type'], string> = {
  lesson: '✅',
  quiz: '📝',
  challenge: '💻',
  achievement: '🏆',
  streak: '🔥',
  bonus: '🎁',
};

function formatRank(rank: string): string {
  return rank
    .split(/[-_]/)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
}

function formatTimeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}

export default function DashboardPage() {
  const navigate = useNavigate();
  const user = useAuthStore((s) => s.user);
  const token = useAuthStore((s) => s.token);
  const isAuthenticated = !!token && !!user;

  const { data: worlds, isLoading: worldsLoading } = useQuery<World[]>({
    queryKey: ['worlds'],
    queryFn: () => api.get('/worlds').then((r) => r.data).catch((err) => {
      console.error('[DashboardPage] Failed to fetch worlds:', err);
      throw err;
    }),
  });

  const { data: xpData, isLoading: xpLoading } = useQuery<XpResponse>({
    queryKey: ['xp'],
    queryFn: () => api.get('/xp').then((r) => r.data).catch((err) => {
      console.error('[DashboardPage] Failed to fetch XP data:', err);
      throw err;
    }),
    enabled: isAuthenticated,
  });

  const isLoading = worldsLoading || (isAuthenticated && xpLoading);

  const stats = useMemo(() => {
    if (!xpData) return null;
    return {
      level: xpData.currentLevel,
      rank: xpData.currentRank,
      streak: xpData.loginStreakDays,
      weeklyXp: xpData.weeklyXp,
    };
  }, [xpData]);

  if (isLoading) {
    return (
      <Box maxW="1100px" mx="auto" p="6" display="flex" flexDirection="column" gap="6">
        <Skeleton height="32px" width="300px" borderRadius="sm" />
        <SimpleGrid columns={{ base: 1, md: 3 }} gap="4">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} height="120px" borderRadius="sm" />
          ))}
        </SimpleGrid>
        <Skeleton height="100px" borderRadius="sm" />
      </Box>
    );
  }

  return (
    <Box maxW="1100px" mx="auto" p="6" display="flex" flexDirection="column" gap="6">
      {/* Welcome */}
      <Heading as="h1" size="2xl" color="dark.text">
        {isAuthenticated
          ? `Welcome back, ${user?.displayName ?? user?.username ?? 'Learner'}!`
          : 'Explore the Curriculum'}
      </Heading>

      {/* Sign-up CTA for anonymous users */}
      {!isAuthenticated && (
        <Card.Root variant="outline" {...retroCardProps} borderColor="aspire.600" borderWidth="3px">
          <Card.Body p="6">
            <Flex justify="space-between" align="center" flexWrap="wrap" gap="4">
              <Box flex={1}>
                <Text fontSize="md" color="dark.text" fontWeight="semibold" mb="1">
                  🔐 Sign up to track your progress
                </Text>
                <Text fontSize="sm" color="aspire.400">
                  Create a free account to earn XP, complete lessons, and unlock achievements.
                </Text>
              </Box>
              <Button
                as={RouterLink}
                to="/register"
                colorPalette="purple"
                size="lg"
              >
                Sign Up Free
              </Button>
            </Flex>
          </Card.Body>
        </Card.Root>
      )}

      {/* Stat Cards */}
      {isAuthenticated && stats && (
        <SimpleGrid columns={{ base: 1, md: 3 }} gap="4">
          {/* Level & Rank */}
          <Card.Root variant="outline" {...retroCardProps} bg="game.retroBg">
            <Card.Body p="5">
              <Text fontSize="xs" color="aspire.300" mb="2">
                Level &amp; Rank
              </Text>
              <Flex align="baseline" gap="2">
                <Text {...pixelFontProps} fontSize="sm" color="dark.text">
                  Lv. {stats.level}
                </Text>
                <Text fontSize="lg">{rankEmojis[stats.rank] ?? '🌟'}</Text>
              </Flex>
              <Text fontSize="xs" color="aspire.400" mt="1">
                {formatRank(stats.rank)}
              </Text>
            </Card.Body>
          </Card.Root>

          {/* Streak */}
          <Card.Root variant="outline" {...retroCardProps} bg="game.retroBg">
            <Card.Body p="5">
              <Text fontSize="xs" color="aspire.300" mb="2">
                Streak
              </Text>
              <Text {...pixelFontProps} fontSize="sm" color="dark.text">
                🔥 {stats.streak} day{stats.streak !== 1 ? 's' : ''}
              </Text>
              <Text fontSize="xs" color="game.streak" mt="1">
                {stats.streak >= 7 ? 'On fire!' : 'Keep it going!'}
              </Text>
            </Card.Body>
          </Card.Root>

          {/* Weekly XP */}
          <Card.Root variant="outline" {...retroCardProps} bg="game.retroBg">
            <Card.Body p="5">
              <Text fontSize="xs" color="aspire.300" mb="2">
                Weekly XP
              </Text>
              <Text {...pixelFontProps} fontSize="sm" color="game.xpGold">
                {stats.weeklyXp} XP
              </Text>
              <Text fontSize="xs" color="aspire.400" mt="1">
                this week
              </Text>
            </Card.Body>
          </Card.Root>
        </SimpleGrid>
      )}

      {/* Activity Heatmap (compact) */}
      <ActivityHeatmap compact />

      {/* Continue Learning — prominent hero section */}
      {isAuthenticated && xpData?.nextLesson && (
        <Card.Root variant="outline" {...retroCardProps} borderColor="aspire.600" borderWidth="3px">
          <Card.Body p="6">
            <Flex justify="space-between" align="center" flexWrap="wrap" gap="4">
              <Box flex={1}>
                <Flex align="center" gap="2" mb="2">
                  <Text fontSize="xl">📚</Text>
                  <Text {...pixelFontProps} fontSize="sm" color="dark.text">
                    Continue Learning
                  </Text>
                </Flex>
                <Text fontSize="md" color="dark.text" fontWeight="semibold" mb="1">
                  {xpData.nextLesson.title}
                </Text>
                <Text fontSize="sm" color="aspire.400">
                  {xpData.nextLesson.moduleName}
                </Text>
              </Box>
              <Button
                colorPalette="purple"
                size="lg"
                onClick={() => {
                  const lesson = xpData.nextLesson!;
                  const path =
                    lesson.type === LessonType.Quiz
                      ? `/quizzes/${lesson.id}`
                      : lesson.type === LessonType.Challenge || lesson.type === LessonType.Build
                        ? `/challenges/${lesson.id}`
                        : `/lessons/${lesson.id}`;
                  navigate(path);
                }}
                data-testid="continue-learning-btn"
                css={{
                  animation: 'glow 2s ease-in-out infinite alternate',
                  '@keyframes glow': {
                    '0%': { boxShadow: '0 0 5px rgba(107, 79, 187, 0.3)' },
                    '100%': { boxShadow: '0 0 15px rgba(107, 79, 187, 0.6)' },
                  },
                }}
              >
                Continue →
              </Button>
            </Flex>
          </Card.Body>
        </Card.Root>
      )}

      {/* Worlds */}
      <Heading as="h2" size="lg" color="dark.text">
        🌍 {isAuthenticated ? 'Your Worlds' : 'Worlds'}
      </Heading>

      {/* World Completion Badges */}
      {worlds && worlds.length > 0 && (
        <WorldCompletionBadges
          worlds={worlds.map((w) => ({
            id: w.id,
            name: w.name,
            icon: w.icon,
            completionPercentage: w.completionPercentage,
          }))}
        />
      )}

      {(!worlds || worlds.length === 0) ? (
        <Box textAlign="center" py={12} {...retroCardProps}>
          <Text {...pixelFontProps} fontSize="sm">No worlds available yet</Text>
          <Text fontSize="sm" color="dark.muted" mt={2}>Check back soon — new content is on the way!</Text>
        </Box>
      ) : (
        <SimpleGrid columns={{ base: 1, md: 3 }} gap="4">
          {worlds.map((world) => (
            <WorldCard key={world.id} world={world} />
          ))}
        </SimpleGrid>
      )}

      {/* Recent Activity */}
      {isAuthenticated && xpData?.recentEvents && xpData.recentEvents.length > 0 && (
        <>
          <Heading as="h2" size="lg" color="dark.text">
            📋 Recent Activity
          </Heading>
          <Card.Root variant="outline" {...retroCardProps}>
            <Card.Body p="2" display="flex" flexDirection="column" gap="1">
              {xpData.recentEvents.slice(0, 10).map((event) => (
                <Flex
                  key={event.id}
                  justify="space-between"
                  align="center"
                  px="3"
                  py="2"
                  borderRadius="sm"
                  _hover={{ bg: 'content.hover' }}
                >
                  <Flex align="center" gap="2">
                    <Text fontSize="sm">{xpEventIcons[event.type] ?? '✅'}</Text>
                    <Text fontSize="sm">{event.description}</Text>
                  </Flex>
                  <Flex align="center" gap="3">
                    <Text fontSize="xs" color="aspire.400">
                      {formatTimeAgo(event.createdAt)}
                    </Text>
                    <Badge
                      {...pixelFontProps}
                      fontSize="2xs"
                      colorPalette="yellow"
                      variant="solid"
                    >
                      +{event.xpEarned} XP
                    </Badge>
                  </Flex>
                </Flex>
              ))}
            </Card.Body>
          </Card.Root>
        </>
      )}

      {/* Aspire Quick Start Card */}
      <AspireQuickStartCard />

      {/* Progress Milestone Celebrations */}
      {worlds && worlds.length > 0 && <ProgressMilestonePopup worlds={worlds} />}
    </Box>
  );
}
