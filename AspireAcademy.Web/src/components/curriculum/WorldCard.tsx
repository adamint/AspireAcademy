import { useNavigate } from 'react-router-dom';
import {
  Box,
  Flex,
  Text,
  Card,
  Badge,
  Progress,
} from '@chakra-ui/react';
import { FiLock } from 'react-icons/fi';
import { retroCardProps, pixelFontProps } from '../../theme/aspireTheme';
import type { World } from '../../types/curriculum';

interface WorldCardProps {
  world: World;
}

export default function WorldCard({ world }: WorldCardProps) {
  const navigate = useNavigate();

  const progress = world.totalLessons > 0 ? world.completionPercentage : 0;
  const worldAccents = ['#2DD4BF', '#FBBF24', '#FB7185', '#34D399', '#38BDF8', '#FB923C', '#A78BFA', '#F472B6'];
  const accent = worldAccents[(world.sortOrder - 1) % worldAccents.length];

  const handleClick = () => {
    if (!world.isLocked) {
      navigate(`/worlds/${world.id}`);
    }
  };

  return (
    <Card.Root
      data-testid={`world-card-${world.id}`}
      variant="outline"
      {...retroCardProps}
      cursor={world.isLocked ? 'default' : 'pointer'}
      opacity={world.isLocked ? 0.6 : 1}
      filter={world.isLocked ? 'grayscale(100%)' : 'none'}
      transition="transform 0.15s ease, box-shadow 0.15s ease"
      _hover={world.isLocked ? {} : { transform: 'translateY(-2px)', borderColor: accent, boxShadow: `0 4px 16px ${accent}33, 4px 4px 0 var(--chakra-colors-game-pixel-shadow, #2B1260)` }}
      onClick={handleClick}
      title={world.isLocked ? `${world.name} - Locked` : `Open ${world.name} world`}
      aria-label={world.isLocked ? `${world.name} world - Locked` : `Open ${world.name} world`}
      role="button"
      tabIndex={world.isLocked ? -1 : 0}
      onKeyDown={(e) => {
        if ((e.key === 'Enter' || e.key === ' ') && !world.isLocked) {
          e.preventDefault();
          handleClick();
        }
      }}
    >
      <Card.Body p="5">
        <Flex align="center" gap="3" mb="3">
          <Flex
            align="center"
            justify="center"
            w="11"
            h="11"
            borderRadius="sm"
            bg={world.isLocked ? 'game.locked' : `${accent}22`}
            color="dark.text"
            fontSize="xl"
            border={world.isLocked ? undefined : `1px solid ${accent}44`}
          >
            {world.isLocked ? <FiLock /> : world.icon}
          </Flex>
          <Box flex="1" minW="0">
            <Text fontWeight="semibold" fontSize="md" truncate>
              {world.name}
            </Text>
            <Text {...pixelFontProps} fontSize="2xs" color={world.isLocked ? 'dark.muted' : accent}>
              World {world.sortOrder}
            </Text>
          </Box>
        </Flex>

        {world.isLocked ? (
          <Flex justify="center" py="1">
            <Text fontSize="xs" color="game.locked">
              🔒{' '}
              {world.prerequisiteWorldName
                ? `Complete ${world.prerequisiteWorldName} to unlock`
                : 'Locked'}
            </Text>
          </Flex>
        ) : (
          <Flex align="center" gap="2">
            <Box flex="1">
              <Progress.Root
                value={progress}
                colorPalette={progress >= 100 ? 'green' : 'purple'}
                size="sm"
              >
                <Progress.Track>
                  <Progress.Range />
                </Progress.Track>
              </Progress.Root>
            </Box>
            <Badge
              {...pixelFontProps}
              fontSize="2xs"
              colorPalette={progress >= 100 ? 'green' : 'purple'}
              variant="solid"
            >
              {progress}%
            </Badge>
          </Flex>
        )}
      </Card.Body>
    </Card.Root>
  );
}
