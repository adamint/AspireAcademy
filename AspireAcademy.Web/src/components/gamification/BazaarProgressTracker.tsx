import { Box, Flex, Text, Card } from '@chakra-ui/react';
import type { World } from '../../types/curriculum';

interface BazaarComponent {
  id: string;
  label: string;
  emoji: string;
  unlocksAtWorld: number; // sortOrder of the world that unlocks this component
  row: number;
  col: number;
}

const BAZAAR_COMPONENTS: BazaarComponent[] = [
  { id: 'frontend', label: 'Frontend', emoji: '🌐', unlocksAtWorld: 3, row: 0, col: 0 },
  { id: 'api', label: 'API', emoji: '⚙️', unlocksAtWorld: 1, row: 0, col: 1 },
  { id: 'postgres', label: 'PostgreSQL', emoji: '🐘', unlocksAtWorld: 5, row: 1, col: 0 },
  { id: 'redis', label: 'Redis', emoji: '🔴', unlocksAtWorld: 5, row: 1, col: 1 },
  { id: 'rabbitmq', label: 'RabbitMQ', emoji: '🐰', unlocksAtWorld: 5, row: 1, col: 2 },
  { id: 'worker', label: 'Worker', emoji: '🔧', unlocksAtWorld: 3, row: 2, col: 0 },
  { id: 'ml', label: 'ML Service', emoji: '🧠', unlocksAtWorld: 3, row: 2, col: 1 },
];

const CONNECTIONS: { from: string; to: string }[] = [
  { from: 'frontend', to: 'api' },
  { from: 'api', to: 'postgres' },
  { from: 'api', to: 'redis' },
  { from: 'api', to: 'rabbitmq' },
  { from: 'rabbitmq', to: 'worker' },
  { from: 'rabbitmq', to: 'ml' },
];

interface BazaarProgressTrackerProps {
  worlds: World[];
}

export default function BazaarProgressTracker({ worlds }: BazaarProgressTrackerProps) {
  const completedWorldSortOrders = new Set(
    worlds.filter((w) => w.completionPercentage === 100).map((w) => w.sortOrder)
  );

  const wiringComplete = completedWorldSortOrders.has(4);
  const totalUnlocked = BAZAAR_COMPONENTS.filter((c) =>
    completedWorldSortOrders.has(c.unlocksAtWorld)
  ).length;

  if (totalUnlocked === 0) return null;

  const rows = [0, 1, 2];
  const maxCols = 3;

  return (
    <Card.Root bg="gray.900" borderColor="gray.700" data-testid="bazaar-progress-tracker">
      <Card.Header pb="2">
        <Flex justify="space-between" align="center">
          <Text fontWeight="bold" fontSize="lg">🏪 Your Bazaar Journey</Text>
          <Text fontSize="xs" color="gray.500">
            {totalUnlocked}/{BAZAAR_COMPONENTS.length} components
          </Text>
        </Flex>
      </Card.Header>
      <Card.Body pt="0">
        <Box position="relative">
          {/* Connection lines (SVG overlay) */}
          <svg
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              width: '100%',
              height: '100%',
              pointerEvents: 'none',
              zIndex: 0,
            }}
          >
            {wiringComplete &&
              CONNECTIONS.map(({ from, to }) => {
                const fromComp = BAZAAR_COMPONENTS.find((c) => c.id === from)!;
                const toComp = BAZAAR_COMPONENTS.find((c) => c.id === to)!;
                const fromActive = completedWorldSortOrders.has(fromComp.unlocksAtWorld);
                const toActive = completedWorldSortOrders.has(toComp.unlocksAtWorld);
                const bothActive = fromActive && toActive;

                const cellW = 100 / maxCols;
                const cellH = 100 / rows.length;
                const x1 = fromComp.col * cellW + cellW / 2;
                const y1 = fromComp.row * cellH + cellH / 2;
                const x2 = toComp.col * cellW + cellW / 2;
                const y2 = toComp.row * cellH + cellH / 2;

                return (
                  <line
                    key={`${from}-${to}`}
                    x1={`${x1}%`}
                    y1={`${y1}%`}
                    x2={`${x2}%`}
                    y2={`${y2}%`}
                    stroke={bothActive ? 'var(--chakra-colors-aspire-400)' : '#555'}
                    strokeWidth="1.5"
                    strokeDasharray={bothActive ? 'none' : '4 4'}
                    opacity={bothActive ? 0.6 : 0.3}
                  />
                );
              })}
          </svg>

          {/* Component grid */}
          {rows.map((row) => (
            <Flex key={row} justify="center" gap="3" mb={row < 2 ? '3' : '0'}>
              {Array.from({ length: maxCols }).map((_, col) => {
                const comp = BAZAAR_COMPONENTS.find(
                  (c) => c.row === row && c.col === col
                );
                if (!comp) return <Box key={col} flex="1" minH="60px" />;

                const isActive = completedWorldSortOrders.has(comp.unlocksAtWorld);

                return (
                  <Flex
                    key={comp.id}
                    flex="1"
                    direction="column"
                    align="center"
                    justify="center"
                    bg={isActive ? 'rgba(124, 58, 237, 0.15)' : 'rgba(100, 100, 100, 0.1)'}
                    border="1px solid"
                    borderColor={isActive ? 'aspire.500' : 'gray.700'}
                    borderRadius="md"
                    p="3"
                    minH="60px"
                    position="relative"
                    zIndex="1"
                    opacity={isActive ? 1 : 0.4}
                    transition="all 0.3s"
                    data-testid={`bazaar-component-${comp.id}`}
                  >
                    <Text fontSize="xl">{comp.emoji}</Text>
                    <Text
                      fontSize="xs"
                      fontWeight={isActive ? 'bold' : 'normal'}
                      color={isActive ? 'aspire.300' : 'gray.500'}
                    >
                      {comp.label}
                    </Text>
                  </Flex>
                );
              })}
            </Flex>
          ))}
        </Box>
      </Card.Body>
    </Card.Root>
  );
}
