import { useParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Box, Flex, Text, Button, Badge, Skeleton, SimpleGrid, VStack,
  Dialog, Input, Textarea, Tooltip, Field, Spinner,
} from '@chakra-ui/react';
import { FiEdit2, FiUserPlus, FiUserMinus, FiRefreshCw, FiX, FiGithub, FiAward } from 'react-icons/fi';
import { useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../services/apiClient';
import { useAuthStore, type User } from '../store/authStore';
import AvatarDisplay from '../components/gamification/AvatarDisplay';
import ShareProgressButton from '../components/social/ShareProgressButton';
import WorldCompletionBadges from '../components/gamification/WorldCompletionBadges';
import ActivityHeatmap from '../components/ActivityHeatmap';
import SkillRadar from '../components/SkillRadar';
import { retroCardProps, pixelFontProps } from '../theme/aspireTheme';
import type { World } from '../types/curriculum';
import { rarityColors } from '../utils/constants';
import { extractErrorMessage } from '../utils/errorHandler';

interface UserProfile extends User {
  completedLessons: number;
  totalLessons: number;
  achievementCount: number;
  showcaseAchievements: { id: string; name: string; icon: string; rarity: string; unlockedAt: string }[];
  isFriend: boolean;
  friendshipId: string | null;
  gitHubUsername: string | null;
}

interface SkillData {
  name: string;
  score: number;
  lessonsCompleted: number;
  totalLessons: number;
}

export default function ProfilePage() {
  const { userId } = useParams<{ userId: string }>();
  const currentUser = useAuthStore((s) => s.user);
  const updateUser = useAuthStore((s) => s.updateUser);
  const queryClient = useQueryClient();
  const [editOpen, setEditOpen] = useState(false);
  const [editDisplayName, setEditDisplayName] = useState('');
  const [editBio, setEditBio] = useState('');
  const [editGitHubUsername, setEditGitHubUsername] = useState('');
  const [mutationError, setMutationError] = useState<string | null>(null);
  const isOwnProfile = !userId || userId === currentUser?.id;
  const profileId = isOwnProfile ? currentUser?.id : userId;

  const { data: worlds } = useWorldsQuery<World[]>({
    queryKey: ['worlds'],
    queryFn: () => api.get('/worlds').then((r) => r.data),
    enabled: !!profileId,
  });

  const { data: skillsData } = useQuery<{ skills: SkillData[] }>({
    queryKey: ['profile-skills'],
    queryFn: () => api.get('/profile/skills').then((r) => r.data),
    enabled: isOwnProfile && !!profileId,
  });

  const { data: profile, isLoading, error: queryError } = useQuery<UserProfile>({    queryKey: ['profile', profileId],
    queryFn: async () => {
      const endpoint = `/users/${profileId}/profile`;
      try {
        const { data } = await api.get(endpoint);
        return data;
      } catch (err) {
        console.error(`[ProfilePage] Failed to fetch profile from ${endpoint}:`, err);
        throw err;
      }
    },
    enabled: !!profileId,
  });

  const friendMutation = useMutation({
    mutationFn: async (action: 'add' | 'remove') => {
      if (action === 'add') {
        await api.post('/friends/request', { targetUserId: profileId });
      } else {
        await api.delete(`/friends/${profileId}`);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['profile', profileId] });
      setMutationError(null);
    },
    onError: (err) => {
      console.error('[ProfilePage] Friend action failed:', err);
      setMutationError(extractErrorMessage(err, 'Action failed. Please try again.'));
    },
  });

  const editMutation = useMutation({
    mutationFn: async (data: { displayName: string; bio: string; gitHubUsername: string }) => {
      const response = await api.put('/users/me', data);
      return response.data;
    },
    onSuccess: (data) => {
      updateUser(data);
      queryClient.invalidateQueries({ queryKey: ['profile', profileId] });
      setEditOpen(false);
      setMutationError(null);
    },
    onError: (err) => {
      console.error('[ProfilePage] Edit profile failed:', err);
      setMutationError(extractErrorMessage(err, 'Failed to save profile. Please try again.'));
    },
  });

  const randomizeMutation = useMutation({
    mutationFn: async () => {
      const response = await api.post('/avatar/randomize');
      return response.data as { avatarUrl: string };
    },
    onSuccess: (data) => {
      updateUser({ avatarUrl: data.avatarUrl });
      queryClient.invalidateQueries({ queryKey: ['profile', profileId] });
      setMutationError(null);
    },
    onError: (err) => {
      console.error('[ProfilePage] Randomize avatar failed:', err);
      setMutationError('Failed to randomize avatar. Please try again.');
    },
  });

  const resetAvatarMutation = useMutation({
    mutationFn: async () => {
      const response = await api.delete('/avatar');
      return response.data as { avatarUrl: string };
    },
    onSuccess: (data) => {
      updateUser({ avatarUrl: data.avatarUrl });
      queryClient.invalidateQueries({ queryKey: ['profile', profileId] });
      setMutationError(null);
    },
    onError: (err) => {
      console.error('[ProfilePage] Reset avatar failed:', err);
      setMutationError('Failed to reset avatar. Please try again.');
    },
  });

  const openEditDialog = () => {
    setEditDisplayName(profile?.displayName ?? '');
    setEditBio(profile?.bio ?? '');
    setEditGitHubUsername(profile?.gitHubUsername ?? '');
    setEditOpen(true);
  };

  if (isLoading) {
    return (
      <VStack maxW="800px" mx="auto" p={6} gap={6}>
        <Skeleton h="128px" w="100%" borderRadius="sm" />
        <Skeleton h="80px" w="100%" borderRadius="sm" />
        <Skeleton h="100px" w="100%" borderRadius="sm" />
      </VStack>
    );
  }

  if (queryError) {
    return (
      <Box maxW="800px" mx="auto" p={6}>
        <Box {...retroCardProps} bg="dark.card" p={6} textAlign="center">
          <Text fontSize="xl" color="game.error" mb={2}>Failed to load profile</Text>
          <Text fontSize="sm" color="dark.muted">
            {(queryError as { response?: { status?: number } })?.response?.status === 404
              ? 'User not found.'
              : 'Something went wrong. Please try again later.'}
          </Text>
        </Box>
      </Box>
    );
  }

  if (!profile) {
    return (
      <Box maxW="800px" mx="auto" p={6}>
        <Text fontSize="xl" color="dark.text">User not found.</Text>
      </Box>
    );
  }

  return (
    <VStack maxW="800px" mx="auto" p={6} gap={6} align="stretch">
      {/* Mutation error feedback */}
      {mutationError && (
        <Box bg="rgba(209, 52, 56, 0.15)" border="2px solid" borderColor="game.error" borderRadius="sm" px="3" py="2">
          <Text color="game.error" fontSize="sm">{mutationError}</Text>
        </Box>
      )}

      {/* Profile Header */}
      <Flex gap={6} align="flex-start" flexWrap="wrap">
        <AvatarDisplay
          url={profile.avatarUrl}
          size="lg"
          level={profile.currentLevel}
          name={profile.displayName}
        />
        <VStack align="flex-start" flex={1} minW="200px" gap={1}>
          <Text fontSize="2xl" fontWeight="bold" color="dark.text">
            {profile.displayName || profile.username}
          </Text>
          <Flex gap={2} align="center" flexWrap="wrap">
            <Badge {...pixelFontProps} fontSize="8px" colorPalette="purple" variant="solid">
              {profile.currentRank}
            </Badge>
            <Text {...pixelFontProps} fontSize="10px" color="game.xpGold">
              Level {profile.currentLevel}
            </Text>
          </Flex>
          {profile.bio && (
            <Text fontSize="sm" color="dark.muted" fontStyle="italic" mt={1}>
              &ldquo;{profile.bio}&rdquo;
            </Text>
          )}
          {profile.gitHubUsername && (
            <Flex align="center" gap={1} mt={1}>
              <FiGithub size={14} color="#8B949E" />
              <Text
                as="a"
                href={`https://github.com/${profile.gitHubUsername}`}
                target="_blank"
                rel="noopener noreferrer"
                fontSize="sm"
                color="aspire.400"
                _hover={{ color: 'aspire.300', textDecoration: 'underline' }}
              >
                {profile.gitHubUsername}
              </Text>
            </Flex>
          )}
          <Text fontSize="xs" color="dark.muted" mt={1}>
            Member since {new Date(profile.createdAt).toLocaleDateString('en-US', { month: 'short', year: 'numeric' })}
          </Text>

          <Flex gap={3} mt={2}>
            {isOwnProfile ? (
              <>
                <Button variant="outline" size="sm" borderColor="game.pixelBorder" color="dark.text" _hover={{ bg: 'content.hover' }} onClick={openEditDialog}>
                  <FiEdit2 /> Edit Profile
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  borderColor="game.pixelBorder"
                  color="dark.text"
                  _hover={{ bg: 'content.hover' }}
                  onClick={() => randomizeMutation.mutate()}
                  disabled={randomizeMutation.isPending}
                >
                  {randomizeMutation.isPending ? <Spinner size="sm" /> : <><FiRefreshCw /> Randomize Avatar</>}
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  borderColor="game.pixelBorder"
                  color="dark.text"
                  _hover={{ bg: 'content.hover' }}
                  onClick={() => resetAvatarMutation.mutate()}
                  disabled={resetAvatarMutation.isPending}
                >
                  {resetAvatarMutation.isPending ? <Spinner size="sm" /> : <><FiX /> Reset to Gravatar</>}
                </Button>
                <ShareProgressButton
                  displayName={profile.displayName || profile.username}
                  level={profile.currentLevel}
                  rank={profile.currentRank}
                  completedLessons={profile.completedLessons}
                  totalLessons={profile.totalLessons}
                  achievementCount={profile.achievementCount}
                  streakDays={profile.loginStreakDays}
                />
              </>
            ) : (
              <>
                {!profile.isFriend && (
                  <Button
                    colorPalette="purple"
                    size="sm"
                    onClick={() => friendMutation.mutate('add')}
                    disabled={friendMutation.isPending}
                  >
                    {friendMutation.isPending ? <Spinner size="sm" /> : <><FiUserPlus /> Add Friend</>}
                  </Button>
                )}
                {profile.isFriend && (
                  <Button
                    variant="outline"
                    size="sm"
                    borderColor="game.pixelBorder"
                    color="dark.text"
                    _hover={{ bg: 'content.hover' }}
                    onClick={() => friendMutation.mutate('remove')}
                    disabled={friendMutation.isPending}
                  >
                    {friendMutation.isPending ? <Spinner size="sm" /> : <><FiUserMinus /> Remove Friend</>}
                  </Button>
                )}
              </>
            )}
          </Flex>
        </VStack>
      </Flex>

      {/* Stat Cards */}
      <SimpleGrid data-testid="profile-stats" columns={{ base: 2, md: 4 }} gap={4}>
        <Box {...retroCardProps} p={4} textAlign="center" bg="dark.card">
          <Text {...pixelFontProps} fontSize="lg" color="game.xpGold" fontWeight="bold">
            {profile.totalXp.toLocaleString()}
          </Text>
          <Text fontSize="xs" color="dark.muted" mt={1}>Total XP</Text>
        </Box>
        <Box {...retroCardProps} p={4} textAlign="center" bg="dark.card">
          <Text {...pixelFontProps} fontSize="lg" color="game.xpGold" fontWeight="bold">
            {profile.completedLessons}/{profile.totalLessons}
          </Text>
          <Text fontSize="xs" color="dark.muted" mt={1}>Lessons</Text>
        </Box>
        <Box {...retroCardProps} p={4} textAlign="center" bg="dark.card">
          <Text {...pixelFontProps} fontSize="lg" color="game.xpGold" fontWeight="bold">
            {profile.achievementCount}
          </Text>
          <Text fontSize="xs" color="dark.muted" mt={1}>Achievements</Text>
        </Box>
        <Box {...retroCardProps} p={4} textAlign="center" bg="dark.card">
          <Text {...pixelFontProps} fontSize="lg" color="game.xpGold" fontWeight="bold">
            {profile.loginStreakDays}🔥
          </Text>
          <Text fontSize="xs" color="dark.muted" mt={1}>Day Streak</Text>
        </Box>
      </SimpleGrid>

      {/* Activity Heatmap */}
      <ActivityHeatmap userId={profileId} />

      {/* Achievement Showcase */}
      {profile.showcaseAchievements.length > 0 && (
        <Box {...retroCardProps} p={4} bg="dark.card">
          <Text {...pixelFontProps} fontSize="md" fontWeight="bold" mb={3} color="dark.text">Showcase</Text>
          <Flex gap={4} flexWrap="wrap">
            {profile.showcaseAchievements.slice(0, 5).map((ach) => (
              <Tooltip.Root key={ach.id} openDelay={300} closeDelay={100}>
                <Tooltip.Trigger asChild>
                  <VStack
                    gap={1}
                    p={2}
                    borderRadius="sm"
                    border="2px solid"
                    borderColor={rarityColors[ach.rarity] ?? rarityColors.common}
                    cursor="default"
                  >
                    <Text fontSize="28px" lineHeight="1">{ach.icon}</Text>
                    <Text {...pixelFontProps} fontSize="8px" color="dark.text">{ach.name}</Text>
                  </VStack>
                </Tooltip.Trigger>
                <Tooltip.Positioner>
                  <Tooltip.Content>
                    {ach.unlockedAt ? `Unlocked ${new Date(ach.unlockedAt).toLocaleDateString()}` : ach.name}
                  </Tooltip.Content>
                </Tooltip.Positioner>
              </Tooltip.Root>
            ))}
          </Flex>
        </Box>
      )}

      {/* World Completion Badges */}
      {worlds && worlds.length > 0 && (
        <Box {...retroCardProps} p={4} bg="dark.card">
          <WorldCompletionBadges
            worlds={worlds.map((w) => ({
              id: w.id,
              name: w.name,
              icon: w.icon,
              completionPercentage: w.completionPercentage,
            }))}
          />
        </Box>
      )}

      {/* Skill Radar */}
      {isOwnProfile && skillsData?.skills && skillsData.skills.length >= 3 && (
        <SkillRadar skills={skillsData.skills} />
      )}

      {/* Certificates */}
      {isOwnProfile && (
        <Box {...retroCardProps} p={4} bg="dark.card">
          <Flex align="center" justify="space-between">
            <Flex align="center" gap={2}>
              <Text fontSize="20px">🏆</Text>
              <Text {...pixelFontProps} fontSize="md" fontWeight="bold" color="dark.text">Certificates</Text>
            </Flex>
            <Link to="/certificates" style={{ textDecoration: 'none' }}>
              <Button
                size="sm" variant="outline" borderColor="game.pixelBorder" color="dark.text"
                _hover={{ bg: 'content.hover' }}
              >
                <FiAward /> View All
              </Button>
            </Link>
          </Flex>
          <Text fontSize="sm" color="dark.muted" mt={2}>
            Complete all lessons in a world to earn completion certificates.
          </Text>
        </Box>
      )}

      {/* Edit Profile Dialog */}
      <Dialog.Root open={editOpen} onOpenChange={(e) => setEditOpen(e.open)}>
        <Dialog.Backdrop />
        <Dialog.Positioner>
          <Dialog.Content bg="dark.card" color="dark.text">
            <Dialog.Header>
              <Dialog.Title color="dark.text">Edit Profile</Dialog.Title>
            </Dialog.Header>
            <Dialog.Body>
              <VStack gap={4}>
                <Field.Root>
                  <Field.Label color="dark.text">Display Name</Field.Label>
                  <Input
                    value={editDisplayName}
                    onChange={(e) => setEditDisplayName(e.target.value)}
                    maxLength={30}
                    bg="dark.surface"
                    borderColor="game.pixelBorder"
                    color="dark.text"
                  />
                </Field.Root>
                <Field.Root>
                  <Field.Label color="dark.text">Bio</Field.Label>
                  <Textarea
                    value={editBio}
                    onChange={(e) => setEditBio(e.target.value)}
                    maxLength={200}
                    rows={3}
                    bg="dark.surface"
                    borderColor="game.pixelBorder"
                    color="dark.text"
                  />
                </Field.Root>
                <Field.Root>
                  <Field.Label color="dark.text">
                    <Flex align="center" gap={1}><FiGithub /> GitHub Username</Flex>
                  </Field.Label>
                  <Input
                    value={editGitHubUsername}
                    onChange={(e) => setEditGitHubUsername(e.target.value)}
                    maxLength={39}
                    placeholder="e.g. octocat"
                    bg="dark.surface"
                    borderColor="game.pixelBorder"
                    color="dark.text"
                  />
                </Field.Root>
              </VStack>
            </Dialog.Body>
            <Dialog.Footer>
              <Button variant="outline" mr={3} onClick={() => setEditOpen(false)} borderColor="game.pixelBorder" color="dark.text">Cancel</Button>
              <Button
                colorPalette="purple"
                onClick={() => editMutation.mutate({ displayName: editDisplayName, bio: editBio, gitHubUsername: editGitHubUsername })}
                disabled={editMutation.isPending}
              >
                {editMutation.isPending ? <><Spinner size="sm" /> Saving…</> : 'Save'}
              </Button>
            </Dialog.Footer>
          </Dialog.Content>
        </Dialog.Positioner>
      </Dialog.Root>
    </VStack>
  );
}
