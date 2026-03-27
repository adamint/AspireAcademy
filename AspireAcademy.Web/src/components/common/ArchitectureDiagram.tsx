import { useMemo, useCallback } from 'react';
import { Box, Flex, Text, Badge } from '@chakra-ui/react';
import { pixelFontProps } from '../../theme/aspireTheme';

// ─── Types ─────────────────────────────────────────────────────────────────────

export interface ServiceNode {
  id: string;
  name: string;
  type: 'api' | 'database' | 'cache' | 'messaging' | 'frontend' | 'worker' | 'container';
  row: number;
  col: number;
}

export interface DiagramConnection {
  from: string;
  to: string;
  label?: string;
}

// ─── Color Map ─────────────────────────────────────────────────────────────────

export const serviceTypeColors: Record<ServiceNode['type'], { bg: string; border: string; label: string }> = {
  api:       { bg: '#1E3A5F', border: '#3B82F6', label: 'API' },
  database:  { bg: '#1A3A2A', border: '#22C55E', label: 'DB' },
  cache:     { bg: '#3A2A1A', border: '#F59E0B', label: 'Cache' },
  messaging: { bg: '#3A1A2A', border: '#EF4444', label: 'Messaging' },
  frontend:  { bg: '#2A1A3A', border: '#A855F7', label: 'Frontend' },
  worker:    { bg: '#1A2A3A', border: '#06B6D4', label: 'Worker' },
  container: { bg: '#2A2A1A', border: '#84CC16', label: 'Container' },
};

// ─── Component ─────────────────────────────────────────────────────────────────

export default function ArchitectureDiagram({
  services,
  connections,
  compact = false,
  title,
}: {
  services: ServiceNode[];
  connections: DiagramConnection[];
  compact?: boolean;
  title?: string;
}) {
  const maxRow = useMemo(() => Math.max(...services.map((s) => s.row)), [services]);
  const maxCol = useMemo(() => Math.max(...services.map((s) => s.col)), [services]);

  const grid = useMemo(() => {
    const cells: (ServiceNode | null)[][] = [];
    for (let r = 0; r <= maxRow; r++) {
      cells[r] = [];
      for (let c = 0; c <= maxCol; c++) {
        cells[r][c] = services.find((s) => s.row === r && s.col === c) ?? null;
      }
    }
    return cells;
  }, [services, maxRow, maxCol]);

  const connectionSet = useMemo(() => {
    const set = new Set<string>();
    for (const conn of connections) {
      set.add(`${conn.from}->${conn.to}`);
      set.add(`${conn.to}->${conn.from}`);
    }
    return set;
  }, [connections]);

  const getConnectionLabel = useCallback(
    (fromId: string, toId: string) => {
      const conn = connections.find(
        (c) =>
          (c.from === fromId && c.to === toId) ||
          (c.from === toId && c.to === fromId),
      );
      return conn?.label;
    },
    [connections],
  );

  const minNodeSize = compact ? '60px' : '100px';
  const fontSize = compact ? '7px' : '10px';
  const gap = compact ? '6px' : '20px';

  return (
    <Box
      bg="dark.surface"
      border="1px solid"
      borderColor="dark.border"
      borderRadius="md"
      overflow="auto"
      my="4"
    >
      {title && (
        <Flex
          px="4"
          py="2"
          borderBottom="1px solid"
          borderColor="dark.border"
          align="center"
          gap="2"
        >
          <Text fontSize="xs" color="aspire.400" fontWeight="bold" textTransform="uppercase" letterSpacing="wider">
            Architecture
          </Text>
          <Text fontSize="xs" color="dark.text" fontWeight="500">
            {title}
          </Text>
        </Flex>
      )}
      <Box p={compact ? '2' : '6'}>
        <Flex direction="column" gap={gap} align="center">
          {grid.map((row, ri) => (
            <Flex key={ri} gap={gap} align="center" justify="center" flexWrap="wrap">
              {row.map((node, ci) => {
                if (!node) {
                  return <Box key={ci} minW={minNodeSize} minH={minNodeSize} flexShrink={0} />;
                }
                const colors = serviceTypeColors[node.type];

                const rightNeighbor = ci < maxCol ? row[ci + 1] : null;
                const hasRightConnection =
                  rightNeighbor !== null &&
                  rightNeighbor !== undefined &&
                  connectionSet.has(`${node.id}->${rightNeighbor.id}`);
                const rightLabel =
                  hasRightConnection && rightNeighbor
                    ? getConnectionLabel(node.id, rightNeighbor.id)
                    : undefined;

                return (
                  <Flex key={ci} align="center" gap="0" flexShrink={0}>
                    <Box
                      minW={minNodeSize}
                      minH={minNodeSize}
                      bg={colors.bg}
                      border="2px solid"
                      borderColor={colors.border}
                      display="flex"
                      flexDirection="column"
                      alignItems="center"
                      justifyContent="center"
                      px="3"
                      py="2"
                      position="relative"
                      css={{
                        imageRendering: 'pixelated',
                        boxShadow: `2px 2px 0 ${colors.border}`,
                        whiteSpace: 'pre-line',
                      }}
                    >
                      <Text
                        fontSize={fontSize}
                        fontWeight="bold"
                        color={colors.border}
                        textAlign="center"
                        lineHeight="1.3"
                        {...pixelFontProps}
                      >
                        {node.name}
                      </Text>
                      {!compact && (
                        <Text fontSize="7px" color="dark.muted" mt="1">
                          {colors.label}
                        </Text>
                      )}
                    </Box>
                    {hasRightConnection && (
                      <Flex
                        direction="column"
                        align="center"
                        w={compact ? '20px' : '48px'}
                        flexShrink={0}
                      >
                        {rightLabel && (
                          <Text
                            fontSize="6px"
                            color="dark.muted"
                            textAlign="center"
                            lineHeight="1"
                            mb="1px"
                          >
                            {rightLabel}
                          </Text>
                        )}
                        <Box
                          w="100%"
                          h="2px"
                          bg={colors.border}
                          position="relative"
                          css={{
                            '&::after': {
                              content: '""',
                              position: 'absolute',
                              right: '-1px',
                              top: '-3px',
                              borderLeft: `5px solid ${colors.border}`,
                              borderTop: '4px solid transparent',
                              borderBottom: '4px solid transparent',
                            },
                          }}
                        />
                      </Flex>
                    )}
                  </Flex>
                );
              })}
            </Flex>
          ))}
        </Flex>

        {/* Vertical connection indicators */}
        {!compact && (
          <Flex justify="center" mt="3" gap="3" flexWrap="wrap">
            {connections
              .filter((c) => {
                const from = services.find((s) => s.id === c.from);
                const to = services.find((s) => s.id === c.to);
                return from && to && from.row !== to.row;
              })
              .map((c, i) => (
                <Badge
                  key={i}
                  fontSize="7px"
                  bg="dark.surface"
                  color="dark.muted"
                  px="2"
                  py="0.5"
                  {...pixelFontProps}
                >
                  {services.find((s) => s.id === c.from)?.name} ↓{' '}
                  {services.find((s) => s.id === c.to)?.name}
                  {c.label ? ` (${c.label})` : ''}
                </Badge>
              ))}
          </Flex>
        )}
      </Box>
    </Box>
  );
}
