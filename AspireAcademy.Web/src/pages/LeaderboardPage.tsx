import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Box, Flex, Text, Badge, Skeleton, VStack, Tabs, Button, chakra } from '@chakra-ui/react';
import { FiGithub } from 'react-icons/fi';
import { useNavigate } from 'react-router-dom';
import api from '../services/apiClient';
import { useAuthStore } from '../store/authStore';
import AvatarDisplay from '../components/gamification/AvatarDisplay';
import { retroCardProps, pixelFontProps } from '../theme/aspireTheme';

interface LeaderboardEntry {
  rank: number;
  userId: string;
  username: string;
  displayName: string;
  avatarUrl: string;
  currentLevel: number;
  currentRank: string;
  xp: number;
  gitHubUsername: string | null;
}

interface LeaderboardData {
  entries: LeaderboardEntry[];
  userRank: number;
  userEntry: LeaderboardEntry | null;
  scope: string;
  totalEntries: number;
}

type LeaderboardTab = 'weekly' | 'alltime' | 'friends';

const medals: Record<number, string> = { 1: '🥇', 2: '🥈', 3: '🥉' };

function formatRank(rank: string): string {
  return rank
    .split(/[-_]/)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
}

export default function LeaderboardPage() {
  useEffect(() => { document.title = 'Leaderboard | Aspire Learn'; }, []);
  const [tab, setTab] = useState<LeaderboardTab>('weekly');
  const currentUser = useAuthStore((s) => s.user);
  const { token } = useAuthStore();
  const navigate = useNavigate();

  const { data, isLoading, error, refetch } = useQuery<LeaderboardData>({
    queryKey: ['leaderboard', tab],
    queryFn: async () => {
      try {
        const scope = tab === 'alltime' ? 'all-time' : tab;
        const { data } = await api.get(`/leaderboard?scope=${scope}`);
        return data;
      } catch (err) {
        console.error('[LeaderboardPage] Failed to fetch leaderboard:', err);
        throw err;
      }
    },
  });

  const entries = (data?.entries ?? []).map((entry, index) => ({
    ...entry,
    rank: entry.rank || index + 1,
  }));

  return (
    <VStack maxW="800px" mx="auto" p={6} gap={5} align="stretch">
      <Text {...pixelFontProps} fontSize="xl" fontWeight="bold">
        Leaderboard
      </Text>

      <Tabs.Root value={tab} onValueChange={(d) => setTab(d.value as LeaderboardTab)}>
        <Tabs.List>
          <Tabs.Trigger value="weekly">Weekly</Tabs.Trigger>
          <Tabs.Trigger value="alltime">All-Time</Tabs.Trigger>
          <Tabs.Trigger value="friends">Friends</Tabs.Trigger>
        </Tabs.List>
      </Tabs.Root>

      {tab === 'weekly' && (
        <Text fontSize="xs" color="dark.muted" fontStyle="italic">Resets Monday</Text>
      )}

      {isLoading && (
        <VStack gap={2}>
          {Array.from({ length: 8 }, (_, i) => (
            <Skeleton key={i} h="56px" borderRadius="sm" />
          ))}
        </VStack>
      )}

      {error && (
        <Flex direction="column" align="center" justify="center" py="12" gap="3">
          <Text fontSize="2xl">⚠️</Text>
          <Text {...pixelFontProps} fontSize="xs" color="dark.muted">
            Something went wrong loading this page
          </Text>
          <Button size="xs" variant="outline" colorPalette="purple" onClick={() => refetch()} {...pixelFontProps} fontSize="2xs">
            Try Again
          </Button>
        </Flex>
      )}

      {!isLoading && !error && entries.length === 0 && (
        <Box textAlign="center" py={12}>
          <Text {...pixelFontProps} fontSize="sm">
            {tab === 'friends' ? 'No friends yet' : 'No data available'}
          </Text>
          {tab === 'friends' && (
            <>
              <Text fontSize="sm" color="dark.muted" mt={2}>
                {token ? 'Add friends to see their rankings!' : 'Sign up to compete with friends!'}
              </Text>
              {!token && (
                <Button
                  size="sm"
                  bg="aspire.600"
                  color="white"
                  onClick={() => navigate('/register')}
                  _hover={{ opacity: 0.9 }}
                  mt={3}
                >
                  <Text {...pixelFontProps} fontSize="9px">
                    Join the Competition!
                  </Text>
                </Button>
              )}
            </>
          )}
        </Box>
      )}

      {!isLoading && !error && entries.length > 0 && (
        <>
          <VStack gap={1} align="stretch">
            {entries.map((entry) => {
              const isCurrentUser = entry.userId === currentUser?.id;
              const isTop3 = entry.rank <= 3;
              return (
                <Flex
                  key={entry.userId}
                  {...retroCardProps}
                  p={3}
                  alignItems="center"
                  gap={4}
                  bg={isCurrentUser ? 'aspire.50' : isTop3 ? 'rgba(255, 215, 0, 0.05)' : undefined}
                  borderColor={isCurrentUser ? 'aspire.600' : isTop3 ? 'rgba(255, 215, 0, 0.3)' : 'game.pixelBorder'}
                >
                  {/* Rank */}
                  <Box w="48px" textAlign="center" flexShrink={0}>
                    {medals[entry.rank] ? (
                      <Text fontSize="24px" lineHeight="1" aria-hidden="true">{medals[entry.rank]}</Text>
                    ) : (
                      <Text {...pixelFontProps} fontSize="12px" fontWeight="bold">
                        #{entry.rank}
                      </Text>
                    )}
                  </Box>

                  {/* Avatar */}
                  <AvatarDisplay
                    url={entry.avatarUrl}
                    size="sm"
                    level={entry.currentLevel}
                    name={entry.displayName}
                  />

                  {/* Name + Level + Rank */}
                  <Box flex={1} minW={0}>
                    <Flex align="center" gap={2}>
                      <Text fontWeight="bold" truncate>
                        {entry.displayName || entry.username}
                      </Text>
                      {isCurrentUser && (
                        <Text fontSize="xs" color="aspire.600">(you)</Text>
                      )}
                      {entry.gitHubUsername && (
                        <chakra.a
                          href={`https://github.com/${entry.gitHubUsername}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          color="dark.muted"
                          _hover={{ color: 'aspire.400' }}
                          display="inline-flex"
                          aria-label={`${entry.gitHubUsername} on GitHub`}
                          onClick={(e) => e.stopPropagation()}
                        >
                          <FiGithub size={14} />
                        </chakra.a>
                      )}
                    </Flex>
                    <Flex gap={2} align="center" mt={0.5}>
                      <Badge {...pixelFontProps} fontSize="7px" colorPalette="purple" variant="solid">
                        Lvl {entry.currentLevel}
                      </Badge>
                      <Text {...pixelFontProps} fontSize="7px" color="dark.muted">
                        {formatRank(entry.currentRank)}
                      </Text>
                    </Flex>
                  </Box>

                  {/* XP */}
                  <Box textAlign="right" flexShrink={0} minW="80px">
                    <Text {...pixelFontProps} fontSize="11px" fontWeight="bold" color="game.xpGold">
                      {entry.xp.toLocaleString()} XP
                    </Text>
                  </Box>
                </Flex>
              );
            })}
          </VStack>

          {/* Footer */}
          {data && (
            <Box {...retroCardProps} p={3} textAlign="center">
              <Text {...pixelFontProps} fontSize="10px">
                Your rank: #{data.userRank} of {data.totalEntries}
              </Text>
            </Box>
          )}
        </>
      )}
    </VStack>
  );
}
