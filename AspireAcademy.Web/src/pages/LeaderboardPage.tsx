import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Box, Flex, Text, Badge, Skeleton, VStack, Tabs } from '@chakra-ui/react';
import api from '../services/apiClient';
import { useAuthStore } from '../store/authStore';
import AvatarDisplay from '../components/gamification/AvatarDisplay';
import { retroCardProps, pixelFontProps } from '../theme/aspireTheme';

interface LeaderboardEntry {
  rank: number;
  userId: string;
  username: string;
  displayName: string;
  avatarBase: string;
  avatarFrame: string;
  currentLevel: number;
  currentRank: string;
  xp: number;
  isCurrentUser: boolean;
}

interface LeaderboardData {
  entries: LeaderboardEntry[];
  currentUserRank: number;
  totalUsers: number;
}

type LeaderboardTab = 'weekly' | 'all-time' | 'friends';

const medals: Record<number, string> = { 1: '🥇', 2: '🥈', 3: '🥉' };

export default function LeaderboardPage() {
  const [tab, setTab] = useState<LeaderboardTab>('weekly');
  const currentUser = useAuthStore((s) => s.user);

  const { data, isLoading } = useQuery<LeaderboardData>({
    queryKey: ['leaderboard', tab],
    queryFn: async () => {
      const { data } = await api.get(`/leaderboard?type=${tab}`);
      return data;
    },
  });

  const entries = data?.entries ?? [];

  return (
    <VStack maxW="800px" mx="auto" p={6} gap={5} align="stretch">
      <Text {...pixelFontProps} fontSize="xl" fontWeight="bold">
        🏆 Leaderboard
      </Text>

      <Tabs.Root value={tab} onValueChange={(d) => setTab(d.value as LeaderboardTab)}>
        <Tabs.List>
          <Tabs.Trigger value="weekly">Weekly</Tabs.Trigger>
          <Tabs.Trigger value="all-time">All-Time</Tabs.Trigger>
          <Tabs.Trigger value="friends">Friends</Tabs.Trigger>
        </Tabs.List>
      </Tabs.Root>

      {tab === 'weekly' && (
        <Text fontSize="xs" color="gray.500" fontStyle="italic">Resets Monday</Text>
      )}

      {isLoading && (
        <VStack gap={2}>
          {Array.from({ length: 8 }, (_, i) => (
            <Skeleton key={i} h="56px" borderRadius="sm" />
          ))}
        </VStack>
      )}

      {!isLoading && entries.length === 0 && (
        <Box textAlign="center" py={12}>
          <Text {...pixelFontProps} fontSize="sm">
            {tab === 'friends' ? 'No friends yet' : 'No data available'}
          </Text>
          {tab === 'friends' && (
            <Text fontSize="sm" color="gray.500" mt={2}>Add friends to see their rankings!</Text>
          )}
        </Box>
      )}

      {!isLoading && entries.length > 0 && (
        <>
          <VStack gap={1} align="stretch">
            {entries.map((entry) => {
              const isCurrentUser = entry.userId === currentUser?.id;
              return (
                <Flex
                  key={entry.userId}
                  {...retroCardProps}
                  p={3}
                  alignItems="center"
                  gap={4}
                  bg={isCurrentUser ? 'aspire.50' : undefined}
                  borderColor={isCurrentUser ? 'aspire.600' : 'game.pixelBorder'}
                >
                  {/* Rank */}
                  <Box w="48px" textAlign="center" flexShrink={0}>
                    {medals[entry.rank] ? (
                      <Text fontSize="24px" lineHeight="1">{medals[entry.rank]}</Text>
                    ) : (
                      <Text {...pixelFontProps} fontSize="12px" fontWeight="bold">
                        #{entry.rank}
                      </Text>
                    )}
                  </Box>

                  {/* Avatar */}
                  <AvatarDisplay
                    base={entry.avatarBase}
                    size="sm"
                    frame={entry.avatarFrame}
                    name={entry.displayName}
                  />

                  {/* Name + Level */}
                  <Box flex={1} minW={0}>
                    <Flex align="center" gap={2}>
                      <Text fontWeight="bold" truncate>
                        {entry.displayName || entry.username}
                      </Text>
                      {isCurrentUser && (
                        <Text fontSize="xs" color="aspire.600">(you)</Text>
                      )}
                    </Flex>
                    <Badge {...pixelFontProps} fontSize="7px" colorPalette="purple" variant="solid" mt={0.5}>
                      Lvl {entry.currentLevel}
                    </Badge>
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
                Your rank: #{data.currentUserRank} of {data.totalUsers}
              </Text>
            </Box>
          )}
        </>
      )}
    </VStack>
  );
}
