import { useState, useMemo, useCallback } from 'react';
import { Box, Flex, Text, Badge } from '@chakra-ui/react';
import { pixelFontProps } from '../../theme/aspireTheme';
import type { ServiceNode, DiagramConnection } from './architectureDiagramTypes';
import { serviceTypeColors } from './architectureDiagramTypes';

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
  const [selectedServiceId, setSelectedServiceId] = useState<string | null>(null);

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

  const connectedIds = useMemo(() => {
    if (!selectedServiceId) return new Set<string>();
    const ids = new Set<string>();
    ids.add(selectedServiceId);
    for (const conn of connections) {
      if (conn.from === selectedServiceId) ids.add(conn.to);
      if (conn.to === selectedServiceId) ids.add(conn.from);
    }
    return ids;
  }, [selectedServiceId, connections]);

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

  const isConnectionHighlighted = useCallback(
    (fromId: string, toId: string) => {
      if (!selectedServiceId) return false;
      return connectedIds.has(fromId) && connectedIds.has(toId);
    },
    [selectedServiceId, connectedIds],
  );

  const handleServiceClick = useCallback(
    (id: string) => {
      setSelectedServiceId((prev) => (prev === id ? null : id));
    },
    [],
  );

  const handleBackgroundClick = useCallback(() => {
    setSelectedServiceId(null);
  }, []);

  const selectedService = selectedServiceId
    ? services.find((s) => s.id === selectedServiceId) ?? null
    : null;

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
      onClick={handleBackgroundClick}
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
                const isSelected = selectedServiceId === node.id;
                const isRelated = connectedIds.has(node.id);
                const isDimmed = selectedServiceId !== null && !isRelated;

                const rightNeighbor = ci < maxCol ? row[ci + 1] : null;
                const hasRightConnection =
                  rightNeighbor !== null &&
                  rightNeighbor !== undefined &&
                  connectionSet.has(`${node.id}->${rightNeighbor.id}`);
                const rightLabel =
                  hasRightConnection && rightNeighbor
                    ? getConnectionLabel(node.id, rightNeighbor.id)
                    : undefined;
                const connHighlighted =
                  hasRightConnection && rightNeighbor
                    ? isConnectionHighlighted(node.id, rightNeighbor.id)
                    : false;

                return (
                  <Flex key={ci} align="center" gap="0" flexShrink={0}>
                    <Box
                      data-testid={`service-node-${node.id}`}
                      minW={minNodeSize}
                      minH={minNodeSize}
                      bg={colors.bg}
                      border={isSelected ? '3px solid' : '2px solid'}
                      borderColor={colors.border}
                      display="flex"
                      flexDirection="column"
                      alignItems="center"
                      justifyContent="center"
                      px="3"
                      py="2"
                      position="relative"
                      cursor="pointer"
                      opacity={isDimmed ? 0.35 : 1}
                      transition="all 0.2s"
                      onClick={(e: React.MouseEvent) => {
                        e.stopPropagation();
                        handleServiceClick(node.id);
                      }}
                      css={{
                        imageRendering: 'pixelated',
                        boxShadow: isSelected
                          ? `0 0 12px ${colors.border}, 3px 3px 0 ${colors.border}`
                          : `2px 2px 0 ${colors.border}`,
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
                        opacity={selectedServiceId !== null && !connHighlighted ? 0.25 : 1}
                        transition="opacity 0.2s"
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
                          h={connHighlighted ? '3px' : '2px'}
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
              .map((c, i) => {
                const highlighted = isConnectionHighlighted(c.from, c.to);
                return (
                  <Badge
                    key={i}
                    fontSize="7px"
                    bg="dark.surface"
                    color="dark.muted"
                    px="2"
                    py="0.5"
                    opacity={selectedServiceId !== null && !highlighted ? 0.25 : 1}
                    transition="opacity 0.2s"
                    {...pixelFontProps}
                  >
                    {services.find((s) => s.id === c.from)?.name} ↓{' '}
                    {services.find((s) => s.id === c.to)?.name}
                    {c.label ? ` (${c.label})` : ''}
                  </Badge>
                );
              })}
          </Flex>
        )}

        {/* Selected service info card */}
        {selectedService && !compact && (
          <Box
            mt="4"
            p="3"
            bg="dark.card"
            border="2px solid"
            borderColor={serviceTypeColors[selectedService.type].border}
            borderRadius="sm"
            data-testid="service-info-card"
            css={{
              boxShadow: `0 0 10px ${serviceTypeColors[selectedService.type].border}40`,
            }}
          >
            <Flex align="center" gap="2">
              <Box
                w="10px"
                h="10px"
                bg={serviceTypeColors[selectedService.type].border}
                borderRadius="sm"
                flexShrink={0}
              />
              <Text fontSize="10px" color="dark.text" fontWeight="bold" {...pixelFontProps}>
                {selectedService.name.replace(/\n/g, ' ')}
              </Text>
              <Badge
                fontSize="7px"
                bg={serviceTypeColors[selectedService.type].bg}
                color={serviceTypeColors[selectedService.type].border}
                px="2"
                ml="auto"
                {...pixelFontProps}
              >
                {selectedService.type}
              </Badge>
            </Flex>
            <Flex mt="2" gap="3" flexWrap="wrap">
              {connections
                .filter((c) => c.from === selectedService.id || c.to === selectedService.id)
                .map((c, i) => {
                  const other = c.from === selectedService.id
                    ? services.find((s) => s.id === c.to)
                    : services.find((s) => s.id === c.from);
                  const direction = c.from === selectedService.id ? '→' : '←';
                  return (
                    <Text key={i} fontSize="8px" color="dark.muted" {...pixelFontProps}>
                      {direction} {other?.name.replace(/\n/g, ' ')}{c.label ? ` (${c.label})` : ''}
                    </Text>
                  );
                })}
            </Flex>
          </Box>
        )}
      </Box>
    </Box>
  );
}
