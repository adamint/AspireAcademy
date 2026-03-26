import { useParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Box, Flex, Text, Button, Badge, Skeleton, SimpleGrid, VStack,
  Dialog, Input, Textarea, Tooltip, Field,
} from '@chakra-ui/react';
import { FiEdit2, FiUserPlus, FiUserMinus, FiImage } from 'react-icons/fi';
import { useState } from 'react';
import api from '../services/apiClient';
import { useAuthStore, type User } from '../store/authStore';
import AvatarDisplay from '../components/gamification/AvatarDisplay';
import { retroCardProps, pixelFontProps } from '../theme/aspireTheme';

interface UserProfile extends User {
  lessonsCompleted: number;
  totalLessons: number;
  achievementsUnlocked: number;
  totalAchievements: number;
  showcaseAchievements: { id: string; name: string; icon: string; rarity: string; unlockedAt: string }[];
  friendStatus: 'none' | 'friends' | 'pending_sent' | 'pending_received';
}

const rarityColors: Record<string, string> = {
  common: '#8A8886',
  uncommon: '#107C10',
  rare: '#2196F3',
  epic: '#6B4FBB',
  legendary: '#FFD700',
};

export default function ProfilePage() {
  const { userId } = useParams<{ userId: string }>();
  const currentUser = useAuthStore((s) => s.user);
  const updateUser = useAuthStore((s) => s.updateUser);
  const queryClient = useQueryClient();
  const [editOpen, setEditOpen] = useState(false);
  const [editDisplayName, setEditDisplayName] = useState('');
  const [editBio, setEditBio] = useState('');

  const isOwnProfile = !userId || userId === currentUser?.id;
  const profileId = isOwnProfile ? currentUser?.id : userId;

  const { data: profile, isLoading } = useQuery<UserProfile>({
    queryKey: ['profile', profileId],
    queryFn: async () => {
      const endpoint = isOwnProfile ? '/users/me' : `/users/${profileId}`;
      const { data } = await api.get(endpoint);
      return data;
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
    },
  });

  const editMutation = useMutation({
    mutationFn: async (data: { displayName: string; bio: string }) => {
      const response = await api.put('/users/me', data);
      return response.data;
    },
    onSuccess: (data) => {
      updateUser(data);
      queryClient.invalidateQueries({ queryKey: ['profile', profileId] });
      setEditOpen(false);
    },
  });

  const openEditDialog = () => {
    setEditDisplayName(profile?.displayName ?? '');
    setEditBio(profile?.bio ?? '');
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

  if (!profile) {
    return (
      <Box maxW="800px" mx="auto" p={6}>
        <Text fontSize="xl">User not found.</Text>
      </Box>
    );
  }

  return (
    <VStack maxW="800px" mx="auto" p={6} gap={6} align="stretch">
      {/* Profile Header */}
      <Flex gap={6} align="flex-start" flexWrap="wrap">
        <AvatarDisplay
          base={profile.avatarBase}
          size="lg"
          frame={profile.avatarFrame}
          name={profile.displayName}
        />
        <VStack align="flex-start" flex={1} minW="200px" gap={1}>
          <Text fontSize="2xl" fontWeight="bold">
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
            <Text fontSize="sm" color="gray.500" fontStyle="italic" mt={1}>
              &ldquo;{profile.bio}&rdquo;
            </Text>
          )}
          <Text fontSize="xs" color="gray.400" mt={1}>
            Member since {new Date(profile.createdAt).toLocaleDateString('en-US', { month: 'short', year: 'numeric' })}
          </Text>

          <Flex gap={3} mt={2}>
            {isOwnProfile ? (
              <>
                <Button variant="outline" size="sm" onClick={openEditDialog}>
                  <FiEdit2 /> Edit Profile
                </Button>
                <Button variant="outline" size="sm">
                  <FiImage /> Customize Avatar
                </Button>
              </>
            ) : (
              <>
                {profile.friendStatus === 'none' && (
                  <Button
                    colorPalette="purple"
                    size="sm"
                    onClick={() => friendMutation.mutate('add')}
                    disabled={friendMutation.isPending}
                  >
                    <FiUserPlus /> Add Friend
                  </Button>
                )}
                {profile.friendStatus === 'friends' && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => friendMutation.mutate('remove')}
                    disabled={friendMutation.isPending}
                  >
                    <FiUserMinus /> Remove Friend
                  </Button>
                )}
                {profile.friendStatus === 'pending_sent' && (
                  <Button variant="outline" size="sm" disabled>Friend Request Sent</Button>
                )}
                {profile.friendStatus === 'pending_received' && (
                  <Button
                    colorPalette="purple"
                    size="sm"
                    onClick={() => friendMutation.mutate('add')}
                    disabled={friendMutation.isPending}
                  >
                    Accept Request
                  </Button>
                )}
              </>
            )}
          </Flex>
        </VStack>
      </Flex>

      {/* Stat Cards */}
      <SimpleGrid columns={{ base: 2, md: 4 }} gap={4}>
        <Box {...retroCardProps} p={4} textAlign="center">
          <Text {...pixelFontProps} fontSize="lg" color="game.xpGold" fontWeight="bold">
            {profile.totalXp.toLocaleString()}
          </Text>
          <Text fontSize="xs" color="gray.500" mt={1}>Total XP</Text>
        </Box>
        <Box {...retroCardProps} p={4} textAlign="center">
          <Text {...pixelFontProps} fontSize="lg" color="game.xpGold" fontWeight="bold">
            {profile.lessonsCompleted}/{profile.totalLessons}
          </Text>
          <Text fontSize="xs" color="gray.500" mt={1}>Lessons</Text>
        </Box>
        <Box {...retroCardProps} p={4} textAlign="center">
          <Text {...pixelFontProps} fontSize="lg" color="game.xpGold" fontWeight="bold">
            {profile.achievementsUnlocked}
          </Text>
          <Text fontSize="xs" color="gray.500" mt={1}>Achievements</Text>
        </Box>
        <Box {...retroCardProps} p={4} textAlign="center">
          <Text {...pixelFontProps} fontSize="lg" color="game.xpGold" fontWeight="bold">
            {profile.loginStreakDays}🔥
          </Text>
          <Text fontSize="xs" color="gray.500" mt={1}>Day Streak</Text>
        </Box>
      </SimpleGrid>

      {/* Achievement Showcase */}
      {profile.showcaseAchievements.length > 0 && (
        <Box {...retroCardProps} p={4}>
          <Text {...pixelFontProps} fontSize="md" fontWeight="bold" mb={3}>Showcase</Text>
          <Flex gap={4} flexWrap="wrap">
            {profile.showcaseAchievements.slice(0, 5).map((ach) => (
              <Tooltip key={ach.id} content={`Unlocked ${new Date(ach.unlockedAt).toLocaleDateString()}`}>
                <VStack
                  gap={1}
                  p={2}
                  borderRadius="sm"
                  border="2px solid"
                  borderColor={rarityColors[ach.rarity] ?? rarityColors.common}
                  cursor="default"
                >
                  <Text fontSize="28px" lineHeight="1">{ach.icon}</Text>
                  <Text {...pixelFontProps} fontSize="8px">{ach.name}</Text>
                </VStack>
              </Tooltip>
            ))}
          </Flex>
        </Box>
      )}

      {/* Edit Profile Dialog */}
      <Dialog.Root open={editOpen} onOpenChange={(e) => setEditOpen(e.open)}>
        <Dialog.Backdrop />
        <Dialog.Positioner>
          <Dialog.Content>
            <Dialog.Header>
              <Dialog.Title>Edit Profile</Dialog.Title>
            </Dialog.Header>
            <Dialog.Body>
              <VStack gap={4}>
                <Field.Root>
                  <Field.Label>Display Name</Field.Label>
                  <Input
                    value={editDisplayName}
                    onChange={(e) => setEditDisplayName(e.target.value)}
                    maxLength={30}
                  />
                </Field.Root>
                <Field.Root>
                  <Field.Label>Bio</Field.Label>
                  <Textarea
                    value={editBio}
                    onChange={(e) => setEditBio(e.target.value)}
                    maxLength={200}
                    rows={3}
                  />
                </Field.Root>
              </VStack>
            </Dialog.Body>
            <Dialog.Footer>
              <Button variant="outline" mr={3} onClick={() => setEditOpen(false)}>Cancel</Button>
              <Button
                colorPalette="purple"
                onClick={() => editMutation.mutate({ displayName: editDisplayName, bio: editBio })}
                disabled={editMutation.isPending}
              >
                Save
              </Button>
            </Dialog.Footer>
          </Dialog.Content>
        </Dialog.Positioner>
      </Dialog.Root>
    </VStack>
  );
}
