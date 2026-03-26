import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  Box, Flex, Text, Button, Skeleton, SimpleGrid, VStack, Tabs, Tooltip, Dialog,
} from '@chakra-ui/react';
import { FiLock } from 'react-icons/fi';
import api from '../services/apiClient';
import { retroCardProps, pixelFontProps } from '../theme/aspireTheme';

interface AchievementItem {
  id: string;
  name: string;
  description: string;
  icon: string;
  category: string;
  rarity: 'common' | 'uncommon' | 'rare' | 'epic' | 'legendary';
  xpReward: number;
  unlocked: boolean;
  unlockedAt: string | null;
}

type Category = 'All' | 'Milestone' | 'Mastery' | 'Streak' | 'Speed' | 'Perfection' | 'Completion';

const categories: Category[] = ['All', 'Milestone', 'Mastery', 'Streak', 'Speed', 'Perfection', 'Completion'];

const rarityBorderColors: Record<string, string> = {
  common: '#8A8886',
  uncommon: '#107C10',
  rare: '#2196F3',
  epic: '#6B4FBB',
  legendary: '#FFD700',
};

export default function AchievementsPage() {
  const [category, setCategory] = useState<string>('All');
  const [selected, setSelected] = useState<AchievementItem | null>(null);

  const { data: achievements, isLoading } = useQuery<AchievementItem[]>({
    queryKey: ['achievements'],
    queryFn: async () => {
      const { data } = await api.get('/achievements');
      return data;
    },
  });

  const filtered = (achievements ?? []).filter(
    (a) => category === 'All' || a.category === category
  );

  const unlockedCount = (achievements ?? []).filter((a) => a.unlocked).length;
  const totalCount = (achievements ?? []).length;

  return (
    <VStack maxW="900px" mx="auto" p={6} gap={5} align="stretch">
      {/* Header */}
      <Flex align="center" gap={3}>
        <Text {...pixelFontProps} fontSize="xl" fontWeight="bold">
          🎖️ Achievements
        </Text>
        <Text {...pixelFontProps} fontSize="xs" color="gray.500">
          {unlockedCount} of {totalCount} unlocked
        </Text>
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
          <Text fontSize="sm" color="gray.500" mt={2}>Complete lessons to earn achievements!</Text>
        </Box>
      )}

      {!isLoading && filtered.length > 0 && (
        <SimpleGrid columns={{ base: 2, sm: 3, md: 4 }} gap={4}>
          {filtered.map((ach) => (
            <Tooltip key={ach.id} content={ach.unlocked ? ach.description : 'Keep learning to unlock!'}>
              <Box
                {...retroCardProps}
                p={4}
                display="flex"
                flexDirection="column"
                alignItems="center"
                gap={2}
                textAlign="center"
                cursor={ach.unlocked ? 'pointer' : 'default'}
                transition="transform 0.15s ease"
                _hover={ach.unlocked ? { transform: 'translateY(-2px)' } : undefined}
                position="relative"
                borderColor={rarityBorderColors[ach.rarity]}
                filter={ach.unlocked ? undefined : 'grayscale(100%)'}
                opacity={ach.unlocked ? 1 : 0.6}
                onClick={() => ach.unlocked && setSelected(ach)}
              >
                {/* Lock overlay for locked achievements */}
                {!ach.unlocked && (
                  <Box position="absolute" top={2} right={2} color="game.locked">
                    <FiLock />
                  </Box>
                )}

                <Text fontSize="40px" lineHeight="1">{ach.icon}</Text>
                <Text {...pixelFontProps} fontSize="8px" fontWeight="bold">
                  {ach.unlocked ? ach.name : '???'}
                </Text>
                {ach.unlocked && (
                  <Text fontSize="xs" color="game.xpGold">+{ach.xpReward} XP</Text>
                )}
                {ach.unlocked && ach.unlockedAt && (
                  <Text fontSize="2xs" color="gray.500">
                    {new Date(ach.unlockedAt).toLocaleDateString()}
                  </Text>
                )}
              </Box>
            </Tooltip>
          ))}
        </SimpleGrid>
      )}

      {/* Detail Dialog */}
      <Dialog.Root open={!!selected} onOpenChange={(e) => { if (!e.open) setSelected(null); }}>
        <Dialog.Backdrop />
        <Dialog.Positioner>
          <Dialog.Content>
            <Dialog.Header>
              <Dialog.Title>{selected?.name}</Dialog.Title>
            </Dialog.Header>
            <Dialog.Body>
              <VStack gap={3} align="center" py={4}>
                <Text fontSize="64px" lineHeight="1">{selected?.icon}</Text>
                <Text fontSize="md">{selected?.description}</Text>
                <Flex gap={4} mt={2}>
                  <Text fontSize="sm" color="gray.500">
                    Rarity:{' '}
                    <Text as="span" fontWeight="bold" color={rarityBorderColors[selected?.rarity ?? 'common']}>
                      {selected?.rarity}
                    </Text>
                  </Text>
                  <Text fontSize="sm" color="game.xpGold" fontWeight="bold">
                    +{selected?.xpReward} XP
                  </Text>
                </Flex>
                {selected?.unlockedAt && (
                  <Text fontSize="sm" color="gray.500">
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
