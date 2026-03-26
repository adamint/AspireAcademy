import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
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
import api from '../services/apiClient';
import WorldCard from '../components/curriculum/WorldCard';
import type { World, XpResponse, XpEvent } from '../types/curriculum';

const rankEmojis: Record<string, string> = {
  'aspire-intern': '🌱',
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
  });

  const isLoading = worldsLoading || xpLoading;

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
        Welcome back, {user?.displayName ?? user?.username ?? 'Learner'}!
      </Heading>

      {/* Stat Cards */}
      {stats && (
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

      {/* Continue Learning */}
      {xpData?.nextLesson && (
        <Card.Root variant="outline" {...retroCardProps} borderColor="game.success">
          <Card.Body p="5">
            <Flex justify="space-between" align="center" flexWrap="wrap" gap="3">
              <Box>
                <Text fontWeight="semibold" fontSize="md" mb="1" color="dark.text">
                  📚 Continue Learning
                </Text>
                <Text fontSize="sm" color="aspire.500">
                  {xpData.nextLesson.moduleName} → {xpData.nextLesson.title}
                </Text>
              </Box>
              <Button
                colorPalette="purple"
                size="sm"
                onClick={() => {
                  const lesson = xpData.nextLesson!;
                  const path =
                    lesson.type === 'quiz'
                      ? `/quizzes/${lesson.id}`
                      : lesson.type === 'challenge' || lesson.type === 'build'
                        ? `/challenges/${lesson.id}`
                        : `/lessons/${lesson.id}`;
                  navigate(path);
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
        🌍 Your Worlds
      </Heading>
      <SimpleGrid columns={{ base: 1, md: 3 }} gap="4">
        {worlds?.map((world) => (
          <WorldCard key={world.id} world={world} />
        ))}
      </SimpleGrid>

      {/* Recent Activity */}
      {xpData?.recentEvents && xpData.recentEvents.length > 0 && (
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
    </Box>
  );
}
