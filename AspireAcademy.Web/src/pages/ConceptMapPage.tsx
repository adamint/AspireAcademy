import { useState, useMemo, useRef, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Box, Flex, Text, Input, Heading, SimpleGrid, Button } from '@chakra-ui/react';
import { retroCardProps, pixelFontProps } from '../theme/aspireTheme';
import api from '../services/apiClient';
import type { World } from '../types/curriculum';

// ── Layer definitions ──

interface LayerDef {
  name: string;
  color: string;
  glow: string;
  emoji: string;
  description: string;
}

interface ConceptNode {
  id: string;
  label: string;
  layer: string;
  description: string;
  lessonId: string;
  emoji: string;
  prerequisites?: string[];
}

interface ConceptsData {
  layerOrder: string[];
  layers: Record<string, LayerDef>;
  concepts: ConceptNode[];
}

interface Edge {
  fromX: number;
  fromY: number;
  toX: number;
  toY: number;
  color: string;
}

// ── Helpers ──

function isLessonCompleted(lessonId: string, worlds: World[]): boolean {
  for (const world of worlds) {
    for (const mod of world.modules ?? []) {
      for (const lesson of mod.lessons) {
        if (lesson.id === lessonId && (lesson.status === 'completed' || lesson.status === 'perfect')) {
          return true;
        }
      }
    }
  }
  return false;
}

function isLessonLocked(lessonId: string, worlds: World[]): boolean {
  for (const world of worlds) {
    for (const mod of world.modules ?? []) {
      for (const lesson of mod.lessons) {
        if (lesson.id === lessonId && lesson.status === 'locked') {
          return true;
        }
      }
    }
  }
  return false;
}

// ── Component ──

export default function ConceptMapPage() {
  const navigate = useNavigate();
  const [search, setSearch] = useState('');
  const containerRef = useRef<HTMLDivElement>(null);
  const [edges, setEdges] = useState<Edge[]>([]);

  const { data: worlds } = useQuery<World[]>({
    queryKey: ['worlds'],
    queryFn: () => api.get('/worlds').then((r) => r.data),
    staleTime: 60_000,
  });

  const { data: conceptsData } = useQuery<ConceptsData>({
    queryKey: ['concepts'],
    queryFn: () => api.get('/concepts').then((r) => r.data),
    staleTime: 10 * 60_000,
  });

  const layerOrder = conceptsData?.layerOrder ?? [];
  const layers = conceptsData?.layers ?? {};
  const concepts = conceptsData?.concepts ?? [];

  const searchLower = search.toLowerCase();

  const conceptsByLayer = useMemo(() => {
    const map = new Map<string, ConceptNode[]>();
    for (const layer of layerOrder) {
      map.set(layer, []);
    }
    for (const c of concepts) {
      if (searchLower && !c.label.toLowerCase().includes(searchLower) &&
          !c.description.toLowerCase().includes(searchLower) &&
          !c.id.toLowerCase().includes(searchLower)) {
        continue;
      }
      map.get(c.layer)?.push(c);
    }
    return map;
  }, [searchLower, layerOrder, concepts]);

  // Visible concept IDs (for edge filtering)
  const visibleConceptIds = useMemo(() => {
    const ids = new Set<string>();
    for (const arr of conceptsByLayer.values()) {
      for (const c of arr) ids.add(c.id);
    }
    return ids;
  }, [conceptsByLayer]);

  // Compute edges between prerequisite concepts
  const computeEdges = useCallback(() => {
    const container = containerRef.current;
    if (!container || concepts.length === 0) { setEdges([]); return; }

    const containerRect = container.getBoundingClientRect();
    const newEdges: Edge[] = [];

    for (const concept of concepts) {
      if (!concept.prerequisites?.length) continue;
      if (!visibleConceptIds.has(concept.id)) continue;

      const toEl = container.querySelector(`[data-concept-id="${concept.id}"]`);
      if (!toEl) continue;
      const toRect = toEl.getBoundingClientRect();
      const layerDef = layers[concept.layer];
      const color = layerDef?.color ?? '#888';

      for (const preReqId of concept.prerequisites) {
        if (!visibleConceptIds.has(preReqId)) continue;
        const fromEl = container.querySelector(`[data-concept-id="${preReqId}"]`);
        if (!fromEl) continue;
        const fromRect = fromEl.getBoundingClientRect();

        newEdges.push({
          fromX: fromRect.left + fromRect.width / 2 - containerRect.left,
          fromY: fromRect.top + fromRect.height / 2 - containerRect.top,
          toX: toRect.left + toRect.width / 2 - containerRect.left,
          toY: toRect.top + toRect.height / 2 - containerRect.top,
          color,
        });
      }
    }

    setEdges(newEdges);
  }, [concepts, visibleConceptIds, layers]);

  useEffect(() => {
    const timer = setTimeout(computeEdges, 100);
    const container = containerRef.current;
    let observer: ResizeObserver | undefined;
    if (container) {
      observer = new ResizeObserver(() => computeEdges());
      observer.observe(container);
    }
    return () => {
      clearTimeout(timer);
      observer?.disconnect();
    };
  }, [computeEdges]);

  // Suggested next concepts
  const suggestedNext = useMemo(() => {
    if (!worlds || worlds.length === 0) return [];

    const completedLessons = new Set<string>();
    for (const world of worlds) {
      for (const mod of world.modules ?? []) {
        for (const lesson of mod.lessons) {
          if (lesson.status === 'completed' || lesson.status === 'perfect') {
            completedLessons.add(lesson.id);
          }
        }
      }
    }

    if (completedLessons.size === 0) return [];

    const completedConceptIds = new Set(
      concepts.filter(c => completedLessons.has(c.lessonId)).map(c => c.id)
    );

    if (completedConceptIds.size === concepts.length) return [];

    return concepts.filter(c => {
      if (completedLessons.has(c.lessonId)) return false;
      if (isLessonLocked(c.lessonId, worlds)) return false;
      const prereqs = c.prerequisites ?? [];
      return prereqs.every(p => completedConceptIds.has(p));
    });
  }, [worlds, concepts]);

  // Unique edge colors for SVG markers
  const edgeColors = useMemo(() => {
    const colorSet = new Set(edges.map(e => e.color));
    return Array.from(colorSet);
  }, [edges]);

  return (
    <Box minH="100vh" bg="dark.bg" p={{ base: 3, md: 5 }} ref={containerRef} position="relative">
      {/* Header */}
      <Flex align="center" justify="space-between" wrap="wrap" gap={3} mb={5}>
        <Heading
          size="lg"
          color="aspire.500"
          {...pixelFontProps}
          fontSize={{ base: 'sm', md: 'md' }}
        >
          🗺️ Aspire Concept Map
        </Heading>
        <Input
          placeholder="🔍 Search concepts..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          size="sm"
          maxW="280px"
          bg="dark.card"
          color="dark.text"
          borderColor="dark.border"
          _placeholder={{ color: 'dark.muted' }}
          aria-label="Search Aspire concepts by name or description"
          {...pixelFontProps}
          fontSize="2xs"
        />
      </Flex>

      {/* Suggested Next section */}
      {suggestedNext.length > 0 && !search && (
        <Box mb={6} data-testid="suggested-next-section">
          <style>{`
            @keyframes suggestedPulse {
              0%, 100% { box-shadow: 0 0 4px var(--glow-color, transparent); }
              50% { box-shadow: 0 0 16px var(--glow-color, transparent); }
            }
          `}</style>
          <Flex align="center" gap={2} mb={3} pb={2} borderBottom="2px solid" borderColor="aspire.500">
            <Text fontSize="lg">🎯</Text>
            <Heading size="sm" color="aspire.500" {...pixelFontProps} fontSize={{ base: '2xs', md: 'xs' }}>
              Suggested Next
            </Heading>
          </Flex>
          <Text fontSize="xs" color="dark.muted" mb={3} {...pixelFontProps}>
            Based on your progress, try these next:
          </Text>
          <Flex overflowX="auto" gap={3} pb={2}>
            {suggestedNext.map((concept) => {
              const layerDef = layers[concept.layer];
              return (
                <Box
                  key={concept.id}
                  {...retroCardProps}
                  bg="dark.card"
                  borderColor={layerDef?.color ?? 'aspire.500'}
                  borderWidth="2px"
                  p={3}
                  minW="200px"
                  maxW="240px"
                  flexShrink={0}
                  cursor="pointer"
                  transition="all 0.15s"
                  style={{
                    '--glow-color': layerDef?.glow ?? 'transparent',
                    animation: 'suggestedPulse 2s ease-in-out infinite',
                  } as React.CSSProperties}
                  _hover={{
                    transform: 'translateY(-2px)',
                    boxShadow: `0 4px 16px ${layerDef?.glow ?? 'transparent'}`,
                  }}
                  onClick={() => navigate(`/lessons/${concept.lessonId}`)}
                  role="button"
                  tabIndex={0}
                  aria-label={`Suggested: ${concept.label} - ${concept.description}`}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      navigate(`/lessons/${concept.lessonId}`);
                    }
                  }}
                  data-testid={`suggested-concept-${concept.id}`}
                >
                  <Flex align="center" gap={2} mb={1}>
                    <Text fontSize="lg">{concept.emoji}</Text>
                    <Text {...pixelFontProps} fontSize="2xs" color="dark.text" lineHeight="1.3">
                      {concept.label}
                    </Text>
                  </Flex>
                  <Text fontSize="xs" color="dark.muted" lineHeight="1.4">
                    {concept.description}
                  </Text>
                </Box>
              );
            })}
          </Flex>
        </Box>
      )}

      {/* Layer sections */}
      <Flex direction="column" gap={6}>
        {layerOrder.map((layerKey) => {
          const layer = layers[layerKey];
          const layerConcepts = conceptsByLayer.get(layerKey) ?? [];
          if (layerConcepts.length === 0) return null;

          return (
            <Box key={layerKey}>
              {/* Layer header */}
              <Flex
                align="center"
                gap={2}
                mb={3}
                pb={2}
                borderBottom="2px solid"
                borderColor={layer.color}
              >
                <Text fontSize="lg">{layer.emoji}</Text>
                <Heading
                  size="sm"
                  color={layer.color}
                  {...pixelFontProps}
                  fontSize={{ base: '2xs', md: 'xs' }}
                >
                  {layer.name}
                </Heading>
                <Text fontSize="xs" color="dark.muted" ml={1}>
                  — {layer.description}
                </Text>
              </Flex>

              {/* Concept cards */}
              <SimpleGrid columns={{ base: 1, sm: 2, md: 3, lg: 4 }} gap={3}>
                {layerConcepts.map((concept) => {
                  const completed = worlds ? isLessonCompleted(concept.lessonId, worlds) : false;
                  const locked = worlds ? isLessonLocked(concept.lessonId, worlds) : false;

                  return (
                    <Box
                      key={concept.id}
                      data-concept-id={concept.id}
                      data-testid={`concept-card-${concept.id}`}
                      {...retroCardProps}
                      bg={locked ? 'dark.surface' : 'dark.card'}
                      borderColor={completed ? '#107C10' : layer.color}
                      borderWidth="2px"
                      p={3}
                      cursor={locked ? 'not-allowed' : 'pointer'}
                      opacity={locked ? 0.5 : 1}
                      transition="all 0.15s"
                      _hover={locked ? {} : {
                        transform: 'translateY(-2px)',
                        boxShadow: `0 4px 16px ${layer.glow}`,
                        borderColor: layer.color,
                      }}
                      onClick={() => !locked && navigate(`/lessons/${concept.lessonId}`)}
                      role={locked ? undefined : 'button'}
                      tabIndex={locked ? -1 : 0}
                      aria-label={locked ? `${concept.label} - Locked` : `${concept.label} - ${concept.description}`}
                      onKeyDown={(e) => {
                        if (!locked && (e.key === 'Enter' || e.key === ' ')) {
                          e.preventDefault();
                          navigate(`/lessons/${concept.lessonId}`);
                        }
                      }}
                    >
                      <Flex align="center" gap={2} mb={1}>
                        <Text fontSize="lg">
                          {locked ? '🔒' : concept.emoji}
                        </Text>
                        <Text
                          {...pixelFontProps}
                          fontSize="2xs"
                          color={locked ? 'dark.muted' : 'dark.text'}
                          lineHeight="1.3"
                        >
                          {concept.label}
                        </Text>
                        {completed && (
                          <Text fontSize="sm" ml="auto">✅</Text>
                        )}
                      </Flex>
                      <Text
                        fontSize="xs"
                        color="dark.muted"
                        lineHeight="1.4"
                      >
                        {concept.description}
                      </Text>
                    </Box>
                  );
                })}
              </SimpleGrid>
            </Box>
          );
        })}
      </Flex>

      {/* Empty search state */}
      {search && Array.from(conceptsByLayer.values()).every(arr => arr.length === 0) && (
        <Flex direction="column" align="center" justify="center" py="12" gap="3" data-testid="empty-search-state">
          <Text fontSize="2xl">🔍</Text>
          <Text {...pixelFontProps} fontSize="xs" color="dark.muted">
            No concepts match &ldquo;{search}&rdquo;
          </Text>
          <Button size="xs" variant="ghost" color="aspire.500" onClick={() => setSearch('')} {...pixelFontProps} fontSize="2xs" data-testid="clear-search-button">
            Clear search
          </Button>
        </Flex>
      )}

      {/* SVG overlay for prerequisite edges */}
      {edges.length > 0 && (
        <svg
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            width: '100%',
            height: '100%',
            pointerEvents: 'none',
            overflow: 'visible',
          }}
          data-testid="concept-edges-svg"
        >
          <defs>
            {edgeColors.map((color) => (
              <marker
                key={color}
                id={`arrow-${color.replace('#', '')}`}
                markerWidth={8}
                markerHeight={6}
                refX={8}
                refY={3}
                orient="auto"
              >
                <path d="M0,0 L8,3 L0,6 Z" fill={color} opacity={0.6} />
              </marker>
            ))}
          </defs>
          {edges.map((edge, i) => {
            const midY = (edge.fromY + edge.toY) / 2;
            const d = `M ${edge.fromX},${edge.fromY} C ${edge.fromX},${midY} ${edge.toX},${midY} ${edge.toX},${edge.toY}`;
            return (
              <path
                key={i}
                d={d}
                fill="none"
                stroke={edge.color}
                strokeWidth={1.5}
                opacity={0.35}
                markerEnd={`url(#arrow-${edge.color.replace('#', '')})`}
              />
            );
          })}
        </svg>
      )}
    </Box>
  );
}
