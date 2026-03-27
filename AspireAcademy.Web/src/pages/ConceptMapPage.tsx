import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Box, Flex, Text, Input, Heading, SimpleGrid } from '@chakra-ui/react';
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

  return (
    <Box minH="100vh" bg="dark.bg" p={{ base: 3, md: 5 }}>
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

      {/* Layer sections */}
      <Flex direction="column" gap={6}>
        {layerOrder.map((layerKey) => {
          const layer = layers[layerKey];
          const concepts = conceptsByLayer.get(layerKey) ?? [];
          if (concepts.length === 0) return null;

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
                {concepts.map((concept) => {
                  const completed = worlds ? isLessonCompleted(concept.lessonId, worlds) : false;
                  const locked = worlds ? isLessonLocked(concept.lessonId, worlds) : false;

                  return (
                    <Box
                      key={concept.id}
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
    </Box>
  );
}
