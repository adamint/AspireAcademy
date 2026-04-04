import { useState, useCallback, useRef, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Box, Flex, Text, Input, Button, Skeleton, SimpleGrid, VStack, Tabs, Spinner,
} from '@chakra-ui/react';
import { FiSearch, FiUserPlus, FiX, FiCheck } from 'react-icons/fi';
import api from '../services/apiClient';
import { useAuthStore } from '../store/authStore';
import FriendCard, { type FriendCardUser } from '../components/social/FriendCard';
import ChallengeButton from '../components/social/ChallengeButton';
import { extractErrorMessage } from '../utils/errorHandler';
import { pixelFontProps } from '../theme/aspireTheme';

interface FriendRequest {
  id: string;
  direction: 'sent' | 'received';
  user: FriendCardUser;
  createdAt: string;
}

interface FriendsData {
  friends: FriendCardUser[];
  pending: FriendRequest[];
}

export default function FriendsPage() {
  useEffect(() => { document.title = 'Friends | Aspire Learn'; }, []);
  const queryClient = useQueryClient();
  const currentUser = useAuthStore((s) => s.user);
  const [tab, setTab] = useState<string>('friends');
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const [actionError, setActionError] = useState<string | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  const handleSearchChange = useCallback((value: string) => {
    setSearchQuery(value);
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => setDebouncedQuery(value), 300);
  }, []);

  useEffect(() => {
    return () => { if (timerRef.current) clearTimeout(timerRef.current); };
  }, []);

  const { data: friendsData, isLoading, error: friendsError, refetch: refetchFriends } = useQuery<FriendsData>({
    queryKey: ['friends'],
    queryFn: async () => {
      try {
        const { data } = await api.get('/friends');
        return data;
      } catch (err) {
        console.error('[FriendsPage] Failed to fetch friends:', err);
        throw err;
      }
    },
  });

  const { data: searchResults, isFetching: searchLoading } = useQuery<FriendCardUser[]>({
    queryKey: ['userSearch', debouncedQuery],
    queryFn: async () => {
      try {
        const { data } = await api.get(`/users/search?q=${encodeURIComponent(debouncedQuery)}`);
        return data;
      } catch (err) {
        console.error('[FriendsPage] Failed to search users:', err);
        throw err;
      }
    },
    enabled: debouncedQuery.length >= 2,
  });

  const friendActionMutation = useMutation({
    mutationFn: async ({ action, userId, requestId }: { action: 'accept' | 'decline' | 'cancel' | 'add' | 'remove'; userId?: string; requestId?: string }) => {
      switch (action) {
        case 'accept':
          await api.post(`/friends/requests/${requestId}/accept`);
          break;
        case 'decline':
          await api.post(`/friends/requests/${requestId}/decline`);
          break;
        case 'cancel':
          await api.delete(`/friends/requests/${requestId}`);
          break;
        case 'add':
          await api.post('/friends/request', { targetUserId: userId });
          break;
        case 'remove':
          await api.delete(`/friends/${userId}`);
          break;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['friends'] });
      queryClient.invalidateQueries({ queryKey: ['userSearch'] });
      setActionError(null);
    },
    onError: (err) => {
      console.error('[FriendsPage] Friend action failed:', err);
      setActionError(extractErrorMessage(err, 'Action failed. Please try again.'));
    },
  });

  const friends = friendsData?.friends ?? [];
  const pending = friendsData?.pending ?? [];
  const received = pending.filter((r) => r.direction === 'received');
  const sent = pending.filter((r) => r.direction === 'sent');
  const isSearching = debouncedQuery.length >= 2;

  return (
    <VStack maxW="800px" mx="auto" p={6} gap={5} align="stretch">
      <Text {...pixelFontProps} fontSize="xl" fontWeight="bold">
        👥 Friends
      </Text>

      {/* Error feedback */}
      {actionError && (
        <Box role="alert" bg="rgba(209, 52, 56, 0.15)" border="2px solid" borderColor="game.error" borderRadius="sm" px="3" py="2">
          <Text color="game.error" fontSize="sm">{actionError}</Text>
        </Box>
      )}

      {/* Friends query error */}
      {friendsError && (
        <Flex direction="column" align="center" justify="center" py="12" gap="3">
          <Text fontSize="2xl">⚠️</Text>
          <Text {...pixelFontProps} fontSize="xs" color="dark.muted">
            Something went wrong loading this page
          </Text>
          <Button size="xs" variant="outline" colorPalette="purple" onClick={() => refetchFriends()} {...pixelFontProps} fontSize="2xs">
            Try Again
          </Button>
        </Flex>
      )}

      {/* Search */}
      <Flex align="center" gap={2} maxW="400px">
        <Box color="dark.muted" aria-hidden="true"><FiSearch /></Box>
        <Input
          placeholder="Search users..."
          value={searchQuery}
          onChange={(e) => handleSearchChange(e.target.value)}
          flex={1}
          bg="dark.surface"
          color="dark.text"
          borderColor="dark.border"
          _placeholder={{ color: 'dark.muted' }}
          aria-label="Search for users to add as friends"
        />
      </Flex>

      {/* Search Results */}
      {isSearching && (
        <VStack gap={3} align="stretch">
          <Text fontWeight="semibold">Search Results</Text>
          {searchLoading && Array.from({ length: 3 }, (_, i) => (
            <Skeleton key={i} h="72px" borderRadius="sm" />
          ))}
          {!searchLoading && searchResults && searchResults.length === 0 && (
            <Text color="dark.muted" fontSize="sm">No users found.</Text>
          )}
          {!searchLoading && searchResults?.map((user) => {
            const isSelf = user.id === currentUser?.id;
            return (
              <FriendCard
                key={user.id}
                user={user}
                actions={
                  isSelf ? (
                    <Text fontSize="xs" color="dark.muted" fontStyle="italic">You</Text>
                  ) : (
                    <Button
                      colorPalette="purple"
                      size="sm"
                      onClick={() => friendActionMutation.mutate({ action: 'add', userId: user.id })}
                      disabled={friendActionMutation.isPending}
                    >
                      {friendActionMutation.isPending ? <Spinner size="sm" /> : <><FiUserPlus /> Add</>}
                    </Button>
                  )
                }
              />
            );
          })}
        </VStack>
      )}

      {/* Tabs */}
      {!isSearching && (
        <>
          <Tabs.Root value={tab} onValueChange={(d) => setTab(d.value)}>
            <Tabs.List>
              <Tabs.Trigger value="friends">Friends ({friends.length})</Tabs.Trigger>
              <Tabs.Trigger value="pending">Pending ({pending.length})</Tabs.Trigger>
            </Tabs.List>
          </Tabs.Root>

          {isLoading && (
            <VStack gap={3}>
              {Array.from({ length: 3 }, (_, i) => (
                <Skeleton key={i} h="72px" borderRadius="sm" />
              ))}
            </VStack>
          )}

          {/* Friends Tab */}
          {tab === 'friends' && !isLoading && (
            <>
              {friends.length === 0 ? (
                <Box textAlign="center" py={12}>
                  <Text {...pixelFontProps} fontSize="sm">No friends yet</Text>
                  <Text fontSize="sm" color="dark.muted" mt={2}>Search for friends to compete with!</Text>
                </Box>
              ) : (
                <SimpleGrid columns={{ base: 1, md: 2 }} gap={3}>
                  {friends.map((friend) => (
                    <FriendCard
                      key={friend.id}
                      user={friend}
                      actions={
                        <Flex gap={2}>
                          <ChallengeButton
                            friendId={friend.id}
                            friendName={friend.displayName || friend.username}
                          />
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => friendActionMutation.mutate({ action: 'remove', userId: friend.id })}
                            disabled={friendActionMutation.isPending}
                          >
                            {friendActionMutation.isPending ? <Spinner size="sm" /> : <><FiX /> Remove</>}
                          </Button>
                        </Flex>
                      }
                    />
                  ))}
                </SimpleGrid>
              )}
            </>
          )}

          {/* Pending Tab */}
          {tab === 'pending' && !isLoading && (
            <VStack gap={4} align="stretch">
              {received.length > 0 && (
                <>
                  <Text fontWeight="semibold">Received</Text>
                  {received.map((req) => (
                    <FriendCard
                      key={req.id}
                      user={req.user}
                      actions={
                        <Flex gap={2}>
                          <Button
                            colorPalette="green"
                            size="sm"
                            onClick={() => friendActionMutation.mutate({ action: 'accept', requestId: req.id })}
                            disabled={friendActionMutation.isPending}
                          >
                            {friendActionMutation.isPending ? <Spinner size="sm" /> : <><FiCheck /> Accept</>}
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => friendActionMutation.mutate({ action: 'decline', requestId: req.id })}
                            disabled={friendActionMutation.isPending}
                          >
                            {friendActionMutation.isPending ? <Spinner size="sm" /> : <><FiX /> Decline</>}
                          </Button>
                        </Flex>
                      }
                    />
                  ))}
                </>
              )}
              {sent.length > 0 && (
                <>
                  <Text fontWeight="semibold">Sent</Text>
                  {sent.map((req) => (
                    <FriendCard
                      key={req.id}
                      user={req.user}
                      actions={
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => friendActionMutation.mutate({ action: 'cancel', requestId: req.id })}
                          disabled={friendActionMutation.isPending}
                        >
                          {friendActionMutation.isPending ? <Spinner size="sm" /> : <><FiX /> Cancel</>}
                        </Button>
                      }
                    />
                  ))}
                </>
              )}
              {pending.length === 0 && (
                <Box textAlign="center" py={8}>
                  <Text fontSize="sm" color="dark.muted">No pending requests.</Text>
                </Box>
              )}
            </VStack>
          )}
        </>
      )}
    </VStack>
  );
}
