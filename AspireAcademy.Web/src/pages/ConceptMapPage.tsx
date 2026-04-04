import { useState, useMemo, useEffect } from 'react';
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
  useEffect(() => { document.title = 'Concept Map | Aspire Learn'; }, []);
  const navigate = useNavigate();
  const [search, setSearch] = useState('');

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

  return (
    <Box minH="100vh" bg="dark.bg" p={{ base: 3, md: 5 }} position="relative">
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

    </Box>
  );
}
