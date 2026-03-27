import { Box, Flex, Text, Tooltip } from '@chakra-ui/react';
import { pixelFontProps } from '../../theme/aspireTheme';

interface WorldCompletionBadgesProps {
  worlds: { id: string; name: string; icon: string; completionPercentage: number }[];
}

const milestoneColors: Record<number, string> = {
  100: '#FFD700',
  75: '#6B4FBB',
  50: '#2196F3',
  25: '#107C10',
};

function getMilestone(pct: number): number {
  if (pct >= 100) return 100;
  if (pct >= 75) return 75;
  if (pct >= 50) return 50;
  if (pct >= 25) return 25;
  return 0;
}

export default function WorldCompletionBadges({ worlds }: WorldCompletionBadgesProps) {
  const completedWorlds = worlds.filter((w) => w.completionPercentage > 0);

  if (completedWorlds.length === 0) return null;

  return (
    <Box data-testid="world-completion-badges">
      <Text {...pixelFontProps} fontSize="2xs" color="dark.muted" mb={2}>
        World Progress
      </Text>
      <Flex gap={2} flexWrap="wrap">
        {worlds.map((world) => {
          const milestone = getMilestone(world.completionPercentage);
          const borderColor = milestone > 0
            ? milestoneColors[milestone] ?? '#8A8886'
            : '#8A8886';
          const isComplete = world.completionPercentage >= 100;

          return (
            <Tooltip.Root key={world.id} openDelay={200} closeDelay={100}>
              <Tooltip.Trigger asChild>
                <Flex
                  direction="column"
                  align="center"
                  p={2}
                  borderRadius="sm"
                  border="2px solid"
                  borderColor={borderColor}
                  opacity={milestone > 0 ? 1 : 0.4}
                  cursor="default"
                  minW="48px"
                  position="relative"
                >
                  <Text fontSize="20px" lineHeight="1">{world.icon}</Text>
                  <Text
                    {...pixelFontProps}
                    fontSize="6px"
                    color={isComplete ? 'game.xpGold' : 'dark.muted'}
                    mt={1}
                  >
                    {Math.round(world.completionPercentage)}%
                  </Text>
                  {isComplete && (
                    <Text
                      position="absolute"
                      top="-6px"
                      right="-6px"
                      fontSize="12px"
                    >
                      ⭐
                    </Text>
                  )}
                </Flex>
              </Tooltip.Trigger>
              <Tooltip.Positioner>
                <Tooltip.Content>
                  {world.name} — {Math.round(world.completionPercentage)}% complete
                </Tooltip.Content>
              </Tooltip.Positioner>
            </Tooltip.Root>
          );
        })}
      </Flex>
    </Box>
  );
}
