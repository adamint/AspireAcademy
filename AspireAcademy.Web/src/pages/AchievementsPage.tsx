import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  Box, Flex, Text, Button, Skeleton, SimpleGrid, VStack, Tabs, Tooltip, Dialog,
} from '@chakra-ui/react';
import { FiLock } from 'react-icons/fi';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';
import api from '../services/apiClient';
import { retroCardProps, pixelFontProps } from '../theme/aspireTheme';
import { rarityColors } from '../utils/constants';

interface AchievementItem {
  id: string;
  name: string;
  description: string;
  icon: string;
  category: string;
  rarity: 'common' | 'uncommon' | 'rare' | 'epic' | 'legendary';
  xpReward: number;
  isUnlocked: boolean;
  unlockedAt: string | null;
}

type Category = 'All' | 'Milestone' | 'Mastery' | 'Streak' | 'Speed' | 'Perfection' | 'Completion';

const categories: Category[] = ['All', 'Milestone', 'Mastery', 'Streak', 'Speed', 'Perfection', 'Completion'];

export default function AchievementsPage() {
  const [category, setCategory] = useState<string>('All');
  const [selected, setSelected] = useState<AchievementItem | null>(null);
  const navigate = useNavigate();
  const { token } = useAuthStore();

  const { data: achievements, isLoading } = useQuery<AchievementItem[]>({
    queryKey: ['achievements'],
    queryFn: async () => {
      try {
        const { data } = await api.get('/achievements');
        return data;
      } catch (err) {
        console.error('[AchievementsPage] Failed to fetch achievements:', err);
        throw err;
      }
    },
  });

  const filtered = (achievements ?? []).filter(
    (a) => category === 'All' || a.category.toLowerCase() === category.toLowerCase()
  );

  const unlockedCount = (achievements ?? []).filter((a) => a.isUnlocked).length;
  const totalCount = (achievements ?? []).length;

  return (
    <VStack maxW="900px" mx="auto" p={6} gap={5} align="stretch">
      {/* Header */}
      <Flex align="center" gap={3}>
        <Text {...pixelFontProps} fontSize="xl" fontWeight="bold">
          🎖️ Achievements
        </Text>
        <Text {...pixelFontProps} fontSize="xs" color="dark.muted">
          {unlockedCount} of {totalCount} unlocked
        </Text>
        {!token && (
          <Button
            size="sm"
            bg="aspire.600"
            color="white"
            onClick={() => navigate('/register')}
            _hover={{ opacity: 0.9 }}
            ml="auto"
          >
            <Text {...pixelFontProps} fontSize="9px">
              Sign Up to Unlock
            </Text>
          </Button>
        )}
      </Flex>

      {/* Category Tabs */}
      <Tabs.Root value={category} onValueChange={(d) => setCategory(d.value)}>
        <Tabs.List flexWrap="wrap">
          {categories.map((cat) => (
            <Tabs.Trigger key={cat} value={cat}>{cat}</Tabs.Trigger>
          ))}
        </Tabs.List>
      </Tabs.Root>

      {isLoading && (
        <SimpleGrid columns={{ base: 2, sm: 3, md: 4 }} gap={4}>
          {Array.from({ length: 8 }, (_, i) => (
            <Skeleton key={i} h="140px" borderRadius="sm" />
          ))}
        </SimpleGrid>
      )}

      {!isLoading && filtered.length === 0 && (
        <Box textAlign="center" py={12}>
          <Text {...pixelFontProps} fontSize="sm">
            {category === 'All' ? 'No achievements yet' : `No ${category} achievements`}
          </Text>
          <Text fontSize="sm" color="dark.muted" mt={2}>Complete lessons to earn achievements!</Text>
        </Box>
      )}

      {!isLoading && filtered.length > 0 && (
        <SimpleGrid columns={{ base: 2, sm: 3, md: 4 }} gap={4}>
          {filtered.map((ach) => (
            <Tooltip.Root key={ach.id} openDelay={300} closeDelay={100}>
              <Tooltip.Trigger asChild>
                <Box
                  {...retroCardProps}
                  p={4}
                  display="flex"
                  flexDirection="column"
                  alignItems="center"
                  gap={2}
                  textAlign="center"
                  cursor={ach.isUnlocked ? 'pointer' : 'default'}
                  transition="transform 0.15s ease"
                  _hover={ach.isUnlocked ? { transform: 'translateY(-2px)' } : undefined}
                  position="relative"
                  borderColor={rarityColors[ach.rarity]}
                  filter={ach.isUnlocked ? undefined : 'grayscale(100%)'}
                  opacity={ach.isUnlocked ? 1 : 0.6}
                  onClick={() => ach.isUnlocked && setSelected(ach)}
                >
                  {/* Lock overlay for locked achievements */}
                  {!ach.isUnlocked && (
                    <Box position="absolute" top={2} right={2} color="game.locked">
                      <FiLock />
                    </Box>
                  )}

                  <Text fontSize="40px" lineHeight="1" aria-hidden="true">{ach.icon}</Text>
                  <Text {...pixelFontProps} fontSize="8px" fontWeight="bold">
                    {ach.isUnlocked ? ach.name : '???'}
                  </Text>
                  {ach.isUnlocked && (
                    <Text fontSize="xs" color="game.xpGold">+{ach.xpReward} XP</Text>
                  )}
                  {ach.isUnlocked && ach.unlockedAt && (
                    <Text fontSize="2xs" color="dark.muted">
                      {new Date(ach.unlockedAt).toLocaleDateString()}
                    </Text>
                  )}
                </Box>
              </Tooltip.Trigger>
              <Tooltip.Positioner>
                <Tooltip.Content>
                  {ach.isUnlocked ? ach.description : 'Keep learning to unlock!'}
                </Tooltip.Content>
              </Tooltip.Positioner>
            </Tooltip.Root>
          ))}
        </SimpleGrid>
      )}

      {/* Detail Dialog */}
      <Dialog.Root open={!!selected} onOpenChange={(e) => { if (!e.open) setSelected(null); }}>
        <Dialog.Backdrop />
        <Dialog.Positioner>
          <Dialog.Content bg="dark.card" color="dark.text">
            <Dialog.Header>
              <Dialog.Title>{selected?.name}</Dialog.Title>
            </Dialog.Header>
            <Dialog.Body>
              <VStack gap={3} align="center" py={4}>
                <Text fontSize="64px" lineHeight="1">{selected?.icon}</Text>
                <Text fontSize="md">{selected?.description}</Text>
                <Flex gap={4} mt={2}>
                  <Text fontSize="sm" color="dark.muted">
                    Rarity:{' '}
                    <Text as="span" fontWeight="bold" color={rarityColors[selected?.rarity ?? 'common']}>
                      {selected?.rarity}
                    </Text>
                  </Text>
                  <Text fontSize="sm" color="game.xpGold" fontWeight="bold">
                    +{selected?.xpReward} XP
                  </Text>
                </Flex>
                {selected?.unlockedAt && (
                  <Text fontSize="sm" color="dark.muted">
                    Unlocked {new Date(selected.unlockedAt).toLocaleDateString()}
                  </Text>
                )}
              </VStack>
            </Dialog.Body>
            <Dialog.Footer>
              <Button colorPalette="purple" onClick={() => setSelected(null)}>Close</Button>
            </Dialog.Footer>
          </Dialog.Content>
        </Dialog.Positioner>
      </Dialog.Root>
    </VStack>
  );
}
