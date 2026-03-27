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

const LAYER_ORDER = ['core', 'resource', 'config', 'infra', 'deploy', 'polyglot'] as const;

const LAYERS: Record<string, LayerDef> = {
  core: { name: 'Core', color: '#9185D1', glow: 'rgba(145,133,209,0.35)', emoji: '💜', description: 'The foundation of every Aspire application' },
  resource: { name: 'Resources', color: '#4FC3F7', glow: 'rgba(79,195,247,0.3)', emoji: '📦', description: 'Databases, caches, containers, and services' },
  config: { name: 'Configuration', color: '#66BB6A', glow: 'rgba(102,187,106,0.3)', emoji: '⚙️', description: 'Wiring, environment, endpoints, and startup' },
  infra: { name: 'Infrastructure', color: '#FFA726', glow: 'rgba(255,167,38,0.3)', emoji: '🏗️', description: 'Telemetry, health, resilience, and discovery' },
  deploy: { name: 'Deployment', color: '#EF5350', glow: 'rgba(239,83,80,0.3)', emoji: '🚀', description: 'Publishing to Docker Compose and Kubernetes' },
  polyglot: { name: 'Polyglot', color: '#FFD54F', glow: 'rgba(255,213,79,0.3)', emoji: '🌐', description: 'C#, Node.js, Python, and Vite resources' },
};

// ── Concept data ──

interface ConceptNode {
  id: string;
  label: string;
  layer: string;
  description: string;
  lessonId: string;
  emoji: string;
}

const CONCEPTS: ConceptNode[] = [
  // Core
  { id: 'AppHost', label: 'AppHost', layer: 'core', description: 'The heart of every Aspire app — orchestrates all resources and services.', lessonId: '1.2.3', emoji: '🏠' },
  { id: 'DistributedApplication', label: 'DistributedApplication', layer: 'core', description: 'The entry point: DistributedApplication.CreateBuilder() sets up the app model.', lessonId: '1.2.4', emoji: '🌐' },
  // Resources
  { id: 'PostgreSQL', label: 'PostgreSQL', layer: 'resource', description: 'Add a PostgreSQL server with AddPostgres() and databases with AddDatabase().', lessonId: '4.1.1', emoji: '🐘' },
  { id: 'Redis', label: 'Redis', layer: 'resource', description: 'Add a Redis cache with AddRedis() — blazing-fast in-memory data store.', lessonId: '4.2.1', emoji: '⚡' },
  { id: 'SQLServer', label: 'SQL Server', layer: 'resource', description: 'Add SQL Server with AddSqlServer() and databases for relational workloads.', lessonId: '4.1.2', emoji: '🗄️' },
  { id: 'MongoDB', label: 'MongoDB', layer: 'resource', description: 'Add MongoDB with AddMongoDB() for document-based data storage.', lessonId: '4.1.3', emoji: '🍃' },
  { id: 'RabbitMQ', label: 'RabbitMQ', layer: 'resource', description: 'Add RabbitMQ with AddRabbitMQ() for message broker communication.', lessonId: '4.3.1', emoji: '🐇' },
  { id: 'Kafka', label: 'Kafka', layer: 'resource', description: 'Add Apache Kafka with AddKafka() for event streaming.', lessonId: '4.3.2', emoji: '📨' },
  { id: 'Container', label: 'Container', layer: 'resource', description: 'Add any container with AddContainer(name, image) — Docker images as resources.', lessonId: '2.3.1', emoji: '🐳' },
  { id: 'Project', label: 'Project', layer: 'resource', description: 'Add .NET projects with AddProject<T>() — the most common resource type.', lessonId: '2.1.1', emoji: '📁' },
  { id: 'Parameter', label: 'Parameter', layer: 'resource', description: 'Define configurable values with AddParameter() for secrets and settings.', lessonId: '2.7.1', emoji: '🔑' },
  { id: 'ConnectionString', label: 'ConnectionString', layer: 'resource', description: 'Reference external resources with AddConnectionString() for pre-existing services.', lessonId: '2.7.3', emoji: '🔗' },
  // Configuration
  { id: 'WithReference', label: 'WithReference', layer: 'config', description: 'Wire services together — injects connection strings or endpoint references.', lessonId: '3.1.1', emoji: '🔌' },
  { id: 'WaitFor', label: 'WaitFor', layer: 'config', description: 'Control startup order — wait for dependencies to be healthy before starting.', lessonId: '2.9.1', emoji: '⏳' },
  { id: 'WithEnvironment', label: 'WithEnvironment', layer: 'config', description: 'Set environment variables with static strings, expressions, or callbacks.', lessonId: '2.8.1', emoji: '🌿' },
  { id: 'WithEndpoint', label: 'WithEndpoint', layer: 'config', description: 'Define custom endpoints with full protocol control and named endpoints.', lessonId: '2.6.2', emoji: '🎯' },
  { id: 'WithDataVolume', label: 'WithDataVolume', layer: 'config', description: 'Attach persistent volumes to containers for data that survives restarts.', lessonId: '2.3.2', emoji: '💾' },
  { id: 'WithArgs', label: 'WithArgs', layer: 'config', description: 'Pass CLI arguments, scale with replicas, and expose external endpoints.', lessonId: '2.1.3', emoji: '📝' },
  // Infrastructure
  { id: 'ServiceDefaults', label: 'ServiceDefaults', layer: 'infra', description: 'Shared project that configures OpenTelemetry, health checks, and resilience.', lessonId: '1.5.1', emoji: '🛡️' },
  { id: 'OpenTelemetry', label: 'OpenTelemetry', layer: 'infra', description: 'Distributed tracing, structured logging, and metrics with OTLP export.', lessonId: '5.4.1', emoji: '📊' },
  { id: 'HealthChecks', label: 'HealthChecks', layer: 'infra', description: 'IHealthCheck registration and monitoring — how Aspire knows your services are ready.', lessonId: '5.5.1', emoji: '❤️' },
  { id: 'Resilience', label: 'Resilience', layer: 'infra', description: 'Retry policies, circuit breakers, and timeout strategies for robust services.', lessonId: '1.5.5', emoji: '🔄' },
  { id: 'ServiceDiscovery', label: 'ServiceDiscovery', layer: 'infra', description: 'How services find each other at runtime — HttpClient integration and config-based resolution.', lessonId: '3.2.1', emoji: '🔍' },
  // Deployment
  { id: 'DockerCompose', label: 'Docker Compose', layer: 'deploy', description: 'Generate docker-compose.yaml from the Aspire app model.', lessonId: '6.3.1', emoji: '🐋' },
  { id: 'Kubernetes', label: 'Kubernetes', layer: 'deploy', description: 'Generate Kubernetes manifests and Helm charts from the Aspire app model.', lessonId: '6.4.1', emoji: '☸️' },
  { id: 'PublishAs', label: 'PublishAs*', layer: 'deploy', description: 'Per-resource publishing customization — PublishAsDockerComposeService, PublishAsKubernetesService.', lessonId: '6.3.2', emoji: '📤' },
  // Polyglot
  { id: 'CSharpApps', label: 'C# Apps', layer: 'polyglot', description: 'Add C# apps by path with AddCSharpApp() — an alternative to project references.', lessonId: '2.2.1', emoji: '🟣' },
  { id: 'NodeJS', label: 'Node.js', layer: 'polyglot', description: 'Run Node.js scripts as resources with AddNodeApp().', lessonId: '2.4.1', emoji: '🟢' },
  { id: 'Python', label: 'Python', layer: 'polyglot', description: 'Run Python scripts and ASGI apps with AddPythonApp() and AddUvicornApp().', lessonId: '2.5.1', emoji: '🐍' },
  { id: 'Vite', label: 'Vite', layer: 'polyglot', description: 'Vite-based frontends with AddViteApp() and dev server integration.', lessonId: '2.4.3', emoji: '⚡' },
];

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

  const searchLower = search.toLowerCase();

  const conceptsByLayer = useMemo(() => {
    const map = new Map<string, ConceptNode[]>();
    for (const layer of LAYER_ORDER) {
      map.set(layer, []);
    }
    for (const c of CONCEPTS) {
      if (searchLower && !c.label.toLowerCase().includes(searchLower) &&
          !c.description.toLowerCase().includes(searchLower) &&
          !c.id.toLowerCase().includes(searchLower)) {
        continue;
      }
      map.get(c.layer)?.push(c);
    }
    return map;
  }, [searchLower]);

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
          {...pixelFontProps}
          fontSize="2xs"
        />
      </Flex>

      {/* Layer sections */}
      <Flex direction="column" gap={6}>
        {LAYER_ORDER.map((layerKey) => {
          const layer = LAYERS[layerKey];
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
