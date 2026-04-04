import { useState, useEffect, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import {
  Box,
  Flex,
  Text,
  Badge,
  Skeleton,
  VStack,
  HStack,
  Button,
} from '@chakra-ui/react';
import api from '../services/apiClient';
import { useAuthStore } from '../store/authStore';
import AvatarDisplay from '../components/gamification/AvatarDisplay';
import { retroCardProps, pixelFontProps } from '../theme/aspireTheme';

// ── Types ──

interface WeeklyChallengeData {
  lessonId: string;
  title: string;
  description: string;
  weekNumber: number;
  weekStart: string;
  weekEnd: string;
  userCompleted: boolean;
  userCompletedAt: string | null;
}

interface WeeklyLeaderboardEntry {
  rank: number;
  userId: string;
  username: string;
  displayName: string;
  avatarUrl: string;
  completedAt: string;
}

interface WeeklyLeaderboardData {
  entries: WeeklyLeaderboardEntry[];
  totalCompleters: number;
}

interface PreviousChallenge {
  lessonId: string;
  title: string;
  weekNumber: number;
  weekStart: string;
  weekEnd: string;
  userCompleted: boolean;
}

// ── Helpers ──

const medals: Record<number, string> = { 1: '🥇', 2: '🥈', 3: '🥉' };

function getNextMonday(): Date {
  const now = new Date();
  const dayOfWeek = now.getUTCDay();
  const daysUntilMonday = dayOfWeek === 0 ? 1 : 8 - dayOfWeek;
  const nextMonday = new Date(now);
  nextMonday.setUTCDate(now.getUTCDate() + daysUntilMonday);
  nextMonday.setUTCHours(0, 0, 0, 0);
  return nextMonday;
}

function formatCountdown(ms: number): string {
  if (ms <= 0) return '00:00:00:00';
  const days = Math.floor(ms / (1000 * 60 * 60 * 24));
  const hours = Math.floor((ms % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
  const minutes = Math.floor((ms % (1000 * 60 * 60)) / (1000 * 60));
  const seconds = Math.floor((ms % (1000 * 60)) / 1000);
  return `${days}d ${String(hours).padStart(2, '0')}h ${String(minutes).padStart(2, '0')}m ${String(seconds).padStart(2, '0')}s`;
}

function formatCompletionTime(dateStr: string): string {
  const d = new Date(dateStr);
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}

// ── Gold accent styles ──

const goldCardProps = {
  border: '3px solid',
  borderColor: '#B8860B',
  boxShadow: '4px 4px 0 #B8860B',
  borderRadius: 'sm',
} as const;

const goldGradient = 'linear-gradient(135deg, #1a1500 0%, #2a2000 50%, #1a1500 100%)';

// ── Component ──

export default function WeeklyChallengePage() {
  const navigate = useNavigate();
  const currentUser = useAuthStore((s) => s.user);
  const [countdown, setCountdown] = useState('');

  const nextMonday = useMemo(() => getNextMonday(), []);

  // Countdown timer
  useEffect(() => {
    const update = () => {
      const remaining = nextMonday.getTime() - Date.now();
      setCountdown(formatCountdown(remaining));
    };
    update();
    const id = setInterval(update, 1000);
    return () => clearInterval(id);
  }, [nextMonday]);

  // Queries
  const { data: challenge, isLoading: challengeLoading, error: challengeError, refetch: refetchChallenge } = useQuery<WeeklyChallengeData>({
    queryKey: ['weekly-challenge'],
    queryFn: async () => (await api.get('/weekly-challenge')).data,
  });

  const { data: leaderboard, isLoading: lbLoading, error: lbError, refetch: refetchLb } = useQuery<WeeklyLeaderboardData>({
    queryKey: ['weekly-challenge-leaderboard'],
    queryFn: async () => (await api.get('/weekly-challenge/leaderboard')).data,
  });

  const { data: previous, error: prevError, refetch: refetchPrev } = useQuery<PreviousChallenge[]>({
    queryKey: ['weekly-challenge-previous'],
    queryFn: async () => (await api.get('/weekly-challenge/previous')).data,
  });

  const hasError = challengeError || lbError || prevError;
  const handleRetry = () => {
    if (challengeError) refetchChallenge();
    if (lbError) refetchLb();
    if (prevError) refetchPrev();
  };

  return (
    <VStack maxW="800px" mx="auto" p={6} gap={6} align="stretch">

      {/* ── Error Banner ── */}
      {hasError && (
        <Flex direction="column" align="center" justify="center" py="12" gap="3">
          <Text fontSize="2xl">⚠️</Text>
          <Text {...pixelFontProps} fontSize="xs" color="dark.muted">
            Something went wrong loading this page
          </Text>
          <Button size="xs" variant="outline" colorPalette="purple" onClick={handleRetry} {...pixelFontProps} fontSize="2xs">
            Try Again
          </Button>
        </Flex>
      )}

      {/* ── Hero Banner ── */}
      <Box
        {...goldCardProps}
        bg={goldGradient}
        p={6}
        textAlign="center"
        position="relative"
        overflow="hidden"
      >
        {/* Gold shimmer overlay */}
        <Box
          position="absolute"
          top={0}
          left={0}
          right={0}
          bottom={0}
          opacity={0.05}
          bg="linear-gradient(45deg, transparent 30%, #FFD700 50%, transparent 70%)"
          pointerEvents="none"
        />

        <Text {...pixelFontProps} fontSize="lg" fontWeight="bold" color="#FFD700">
          Weekly Challenge
        </Text>

        {challengeLoading ? (
          <Skeleton h="20px" w="60%" mx="auto" mt={2} />
        ) : challenge ? (
          <Text fontSize="md" color="#E8D5A0" mt={2} fontWeight="semibold">
            {challenge.title}
          </Text>
        ) : null}

        {/* Countdown */}
        <Box mt={4} p={3} bg="rgba(0,0,0,0.3)" borderRadius="sm" display="inline-block">
          <Text fontSize="xs" color="#B8860B" mb={1}>RESETS IN</Text>
          <Text
            {...pixelFontProps}
            fontSize="md"
            color="#FFD700"
            fontFamily="monospace"
            letterSpacing="wider"
          >
            {countdown}
          </Text>
        </Box>
      </Box>

      {/* ── Bonus XP Badge ── */}
      <Flex justify="center">
        <Badge
          {...pixelFontProps}
          fontSize="10px"
          px={4}
          py={2}
          bg="#3a2f00"
          color="#FFD700"
          border="2px solid #B8860B"
          borderRadius="sm"
        >
          Complete for 2x XP!
        </Badge>
      </Flex>

      {/* ── Challenge Info Card ── */}
      {challengeLoading ? (
        <Skeleton h="120px" borderRadius="sm" />
      ) : challenge ? (
        <Box {...goldCardProps} p={5} bg="dark.card">
          <Flex justify="space-between" align="start" mb={3}>
            <Box flex={1}>
              <Text {...pixelFontProps} fontSize="sm" fontWeight="bold" color="dark.text" mb={2}>
                Challenge Details
              </Text>
              <Text fontSize="sm" color="dark.muted">
                {challenge.description}
              </Text>
            </Box>
          </Flex>

          {/* User Status */}
          <Flex align="center" justify="space-between" mt={4} pt={3} borderTop="1px solid" borderColor="dark.border">
            <HStack gap={2}>
              {challenge.userCompleted ? (
                <>
                  <Text fontSize="lg">✅</Text>
                  <Box>
                    <Text {...pixelFontProps} fontSize="10px" color="game.success">
                      Completed!
                    </Text>
                    {challenge.userCompletedAt && (
                      <Text fontSize="xs" color="dark.muted">
                        {formatCompletionTime(challenge.userCompletedAt)}
                      </Text>
                    )}
                  </Box>
                </>
              ) : (
                <>
                  <Text fontSize="lg">⏳</Text>
                  <Text {...pixelFontProps} fontSize="10px" color="#B8860B">
                    {currentUser ? 'Not yet attempted' : 'Sign up to track progress!'}
                  </Text>
                </>
              )}
            </HStack>

            {currentUser ? (
              <Button
                size="sm"
                bg={challenge.userCompleted ? 'aspire.600' : '#B8860B'}
                color="white"
                onClick={() => navigate(`/challenges/${challenge.lessonId}`)}
                _hover={{ opacity: 0.9 }}
              >
                <Text {...pixelFontProps} fontSize="9px">
                  {challenge.userCompleted ? 'View Challenge' : 'Accept Challenge'}
                </Text>
              </Button>
            ) : (
              <Button
                size="sm"
                bg="aspire.600"
                color="white"
                onClick={() => navigate('/register')}
                _hover={{ opacity: 0.9 }}
              >
                <Text {...pixelFontProps} fontSize="9px">
                  Sign Up to Compete
                </Text>
              </Button>
            )}
          </Flex>
        </Box>
      ) : (
        <Box {...goldCardProps} p={5} bg="dark.card" textAlign="center">
          <Text color="dark.muted">No weekly challenge available</Text>
        </Box>
      )}

      {/* ── Weekly Leaderboard ── */}
      <Box>
        <Text {...pixelFontProps} fontSize="sm" fontWeight="bold" mb={3} color="#FFD700">
          This Week's Top Completers
        </Text>

        {lbLoading ? (
          <VStack gap={2}>
            {Array.from({ length: 5 }, (_, i) => (
              <Skeleton key={i} h="52px" borderRadius="sm" />
            ))}
          </VStack>
        ) : leaderboard && leaderboard.entries.length > 0 ? (
          <VStack gap={1} align="stretch">
            {leaderboard.entries.map((entry) => {
              const isCurrentUser = entry.userId === currentUser?.id;
              return (
                <Flex
                  key={entry.userId}
                  {...retroCardProps}
                  p={3}
                  alignItems="center"
                  gap={3}
                  bg={isCurrentUser ? '#2a2000' : undefined}
                  borderColor={isCurrentUser ? '#B8860B' : 'game.pixelBorder'}
                >
                  {/* Rank */}
                  <Box w="40px" textAlign="center" flexShrink={0}>
                    {medals[entry.rank] ? (
                      <Text fontSize="20px" lineHeight="1">{medals[entry.rank]}</Text>
                    ) : (
                      <Text {...pixelFontProps} fontSize="10px" fontWeight="bold" color="dark.muted">
                        #{entry.rank}
                      </Text>
                    )}
                  </Box>

                  {/* Avatar */}
                  <AvatarDisplay
                    url={entry.avatarUrl}
                    size="sm"
                    name={entry.displayName}
                  />

                  {/* Name */}
                  <Box flex={1} minW={0}>
                    <Flex align="center" gap={2}>
                      <Text fontWeight="bold" truncate fontSize="sm">
                        {entry.displayName || entry.username}
                      </Text>
                      {isCurrentUser && (
                        <Text fontSize="xs" color="#B8860B">(you)</Text>
                      )}
                    </Flex>
                  </Box>

                  {/* Completion time */}
                  <Box textAlign="right" flexShrink={0}>
                    <Text fontSize="xs" color="dark.muted">
                      {formatCompletionTime(entry.completedAt)}
                    </Text>
                  </Box>
                </Flex>
              );
            })}

            {leaderboard.totalCompleters > 10 && (
              <Text fontSize="xs" color="dark.muted" textAlign="center" mt={1}>
                +{leaderboard.totalCompleters - 10} more completers
              </Text>
            )}
          </VStack>
        ) : (
          <Box {...goldCardProps} p={4} textAlign="center" bg="dark.card">
            <Text {...pixelFontProps} fontSize="10px" color="dark.muted">
              No completers yet — be the first!
            </Text>
          </Box>
        )}
      </Box>

      {/* ── Previous Weeks ── */}
      {previous && previous.length > 0 && (
        <Box>
          <Text {...pixelFontProps} fontSize="xs" fontWeight="bold" mb={2} color="dark.muted">
            Previous Weeks
          </Text>
          <VStack gap={1} align="stretch">
            {previous.map((p) => (
              <Flex
                key={p.weekNumber}
                {...retroCardProps}
                p={3}
                alignItems="center"
                gap={3}
                opacity={0.8}
              >
                <Text fontSize="sm" flexShrink={0}>
                  {p.userCompleted ? '✅' : '—'}
                </Text>
                <Box flex={1} minW={0}>
                  <Text fontSize="sm" fontWeight="bold" truncate>
                    {p.title}
                  </Text>
                  <Text fontSize="xs" color="dark.muted">
                    Week {p.weekNumber}
                  </Text>
                </Box>
                <Badge
                  {...pixelFontProps}
                  fontSize="7px"
                  colorPalette={p.userCompleted ? 'green' : 'gray'}
                  variant="solid"
                >
                  {p.userCompleted ? 'Done' : 'Missed'}
                </Badge>
              </Flex>
            ))}
          </VStack>
        </Box>
      )}
    </VStack>
  );
}
