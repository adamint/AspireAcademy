import { useState, useRef, useCallback, useMemo, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Box, Flex, Text, Input, Heading, Switch } from '@chakra-ui/react';
import { retroCardProps, pixelFontProps } from '../theme/aspireTheme';
import api from '../services/apiClient';
import type { World } from '../types/curriculum';

// ── Layer definitions ──

interface LayerDef {
  name: string;
  color: string;
  glow: string;
  emoji: string;
}

const LAYERS: Record<string, LayerDef> = {
  core: { name: 'Core', color: '#9185D1', glow: 'rgba(145,133,209,0.6)', emoji: '💜' },
  resource: { name: 'Resources', color: '#4FC3F7', glow: 'rgba(79,195,247,0.5)', emoji: '📦' },
  config: { name: 'Configuration', color: '#66BB6A', glow: 'rgba(102,187,106,0.5)', emoji: '⚙️' },
  infra: { name: 'Infrastructure', color: '#FFA726', glow: 'rgba(255,167,38,0.5)', emoji: '🏗️' },
  deploy: { name: 'Deployment', color: '#EF5350', glow: 'rgba(239,83,80,0.5)', emoji: '🚀' },
  polyglot: { name: 'Polyglot', color: '#FFD54F', glow: 'rgba(255,213,79,0.5)', emoji: '🌐' },
};

// ── Concept node data ──

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
  { id: 'DistributedApplication', label: 'Distributed\nApplication', layer: 'core', description: 'The entry point: DistributedApplication.CreateBuilder() sets up the app model.', lessonId: '1.2.4', emoji: '🌐' },
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
  { id: 'ConnectionString', label: 'Connection\nString', layer: 'resource', description: 'Reference external resources with AddConnectionString() for pre-existing services.', lessonId: '2.7.3', emoji: '🔗' },
  // Configuration
  { id: 'WithReference', label: 'WithReference', layer: 'config', description: 'Wire services together — injects connection strings or endpoint references.', lessonId: '3.1.1', emoji: '🔌' },
  { id: 'WaitFor', label: 'WaitFor', layer: 'config', description: 'Control startup order — wait for dependencies to be healthy before starting.', lessonId: '2.9.1', emoji: '⏳' },
  { id: 'WithEnvironment', label: 'With\nEnvironment', layer: 'config', description: 'Set environment variables with static strings, expressions, or callbacks.', lessonId: '2.8.1', emoji: '🌿' },
  { id: 'WithEndpoint', label: 'WithEndpoint', layer: 'config', description: 'Define custom endpoints with full protocol control and named endpoints.', lessonId: '2.6.2', emoji: '🎯' },
  { id: 'WithDataVolume', label: 'WithData\nVolume', layer: 'config', description: 'Attach persistent volumes to containers for data that survives restarts.', lessonId: '2.3.2', emoji: '💾' },
  { id: 'WithArgs', label: 'WithArgs', layer: 'config', description: 'Pass CLI arguments, scale with replicas, and expose external endpoints.', lessonId: '2.1.3', emoji: '📝' },
  // Infrastructure
  { id: 'ServiceDefaults', label: 'Service\nDefaults', layer: 'infra', description: 'Shared project that configures OpenTelemetry, health checks, and resilience.', lessonId: '1.5.1', emoji: '🛡️' },
  { id: 'OpenTelemetry', label: 'Open\nTelemetry', layer: 'infra', description: 'Distributed tracing, structured logging, and metrics with OTLP export.', lessonId: '5.4.1', emoji: '📊' },
  { id: 'HealthChecks', label: 'Health\nChecks', layer: 'infra', description: 'IHealthCheck registration and monitoring — how Aspire knows your services are ready.', lessonId: '5.5.1', emoji: '❤️' },
  { id: 'Resilience', label: 'Resilience', layer: 'infra', description: 'Retry policies, circuit breakers, and timeout strategies for robust services.', lessonId: '1.5.5', emoji: '🔄' },
  { id: 'ServiceDiscovery', label: 'Service\nDiscovery', layer: 'infra', description: 'How services find each other at runtime — HttpClient integration and config-based resolution.', lessonId: '3.2.1', emoji: '🔍' },
  // Deployment
  { id: 'DockerCompose', label: 'Docker\nCompose', layer: 'deploy', description: 'Generate docker-compose.yaml from the Aspire app model.', lessonId: '6.3.1', emoji: '🐋' },
  { id: 'Kubernetes', label: 'Kubernetes', layer: 'deploy', description: 'Generate Kubernetes manifests and Helm charts from the Aspire app model.', lessonId: '6.4.1', emoji: '☸️' },
  { id: 'PublishAs', label: 'PublishAs*', layer: 'deploy', description: 'Per-resource publishing customization — PublishAsDockerComposeService, PublishAsKubernetesService.', lessonId: '6.3.2', emoji: '📤' },
  // Polyglot
  { id: 'CSharpApps', label: 'C# Apps', layer: 'polyglot', description: 'Add C# apps by path with AddCSharpApp() — an alternative to project references.', lessonId: '2.2.1', emoji: '🟣' },
  { id: 'NodeJS', label: 'Node.js', layer: 'polyglot', description: 'Run Node.js scripts as resources with AddNodeApp().', lessonId: '2.4.1', emoji: '🟢' },
  { id: 'Python', label: 'Python', layer: 'polyglot', description: 'Run Python scripts and ASGI apps with AddPythonApp() and AddUvicornApp().', lessonId: '2.5.1', emoji: '🐍' },
  { id: 'Vite', label: 'Vite', layer: 'polyglot', description: 'Vite-based frontends with AddViteApp() and dev server integration.', lessonId: '2.4.3', emoji: '⚡' },
];

const CONCEPT_MAP = new Map(CONCEPTS.map((c) => [c.id, c]));

// ── Edge definitions ──

const EDGES: [string, string][] = [
  // Core → Resources
  ['AppHost', 'PostgreSQL'], ['AppHost', 'Redis'], ['AppHost', 'SQLServer'],
  ['AppHost', 'MongoDB'], ['AppHost', 'RabbitMQ'], ['AppHost', 'Kafka'],
  ['AppHost', 'Container'], ['AppHost', 'Project'], ['AppHost', 'Parameter'],
  ['AppHost', 'ConnectionString'],
  ['AppHost', 'DistributedApplication'],
  // Resources → Config
  ['Project', 'WithReference'], ['Project', 'WaitFor'], ['Project', 'WithEnvironment'],
  ['Project', 'WithArgs'], ['Project', 'WithEndpoint'],
  ['Container', 'WithDataVolume'], ['Container', 'WithEndpoint'],
  ['PostgreSQL', 'WithDataVolume'], ['Redis', 'WithDataVolume'],
  // Config → Infra
  ['WithReference', 'ServiceDiscovery'],
  ['ServiceDefaults', 'OpenTelemetry'], ['ServiceDefaults', 'HealthChecks'],
  ['ServiceDefaults', 'Resilience'],
  // Core → Infra
  ['AppHost', 'ServiceDefaults'],
  // Infra → Deploy
  ['AppHost', 'DockerCompose'], ['AppHost', 'Kubernetes'],
  ['DockerCompose', 'PublishAs'], ['Kubernetes', 'PublishAs'],
  // Core → Polyglot
  ['AppHost', 'CSharpApps'], ['AppHost', 'NodeJS'], ['AppHost', 'Python'], ['AppHost', 'Vite'],
  // Polyglot → Config
  ['NodeJS', 'WithReference'], ['Python', 'WithReference'], ['Vite', 'WithReference'],
  ['CSharpApps', 'WithReference'],
  // Cross-links
  ['WaitFor', 'HealthChecks'],
  ['Parameter', 'WithEnvironment'],
  ['ConnectionString', 'WithReference'],
];

// ── Layout ──

const CANVAS_W = 1200;
const CANVAS_H = 780;
const NODE_RX = 38;
const NODE_RY = 38;

interface PositionedNode extends ConceptNode {
  x: number;
  y: number;
}

function layoutNodes(): PositionedNode[] {
  const layers: { y: number; ids: string[] }[] = [
    { y: 70, ids: ['AppHost', 'DistributedApplication'] },
    { y: 200, ids: ['PostgreSQL', 'Redis', 'SQLServer', 'MongoDB', 'RabbitMQ', 'Kafka', 'Container', 'Project', 'Parameter', 'ConnectionString'] },
    { y: 360, ids: ['WithReference', 'WaitFor', 'WithEnvironment', 'WithEndpoint', 'WithDataVolume', 'WithArgs'] },
    { y: 500, ids: ['ServiceDefaults', 'OpenTelemetry', 'HealthChecks', 'Resilience', 'ServiceDiscovery'] },
    { y: 630, ids: ['DockerCompose', 'Kubernetes', 'PublishAs'] },
    { y: 740, ids: ['CSharpApps', 'NodeJS', 'Python', 'Vite'] },
  ];

  const positioned: PositionedNode[] = [];
  for (const layer of layers) {
    const count = layer.ids.length;
    const spacing = CANVAS_W / (count + 1);
    layer.ids.forEach((id, i) => {
      const concept = CONCEPT_MAP.get(id);
      if (concept) {
        positioned.push({ ...concept, x: spacing * (i + 1), y: layer.y });
      }
    });
  }
  return positioned;
}

// ── Helpers ──

function getLessonRoute(lessonId: string): string {
  return `/lessons/${lessonId}`;
}

function isLessonCompleted(lessonId: string, worlds: World[]): boolean {
  for (const world of worlds) {
    for (const mod of world.modules) {
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
    for (const mod of world.modules) {
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
  const svgContainerRef = useRef<HTMLDivElement>(null);

  // Pan & zoom state
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [isPanning, setIsPanning] = useState(false);
  const panStart = useRef({ x: 0, y: 0, panX: 0, panY: 0 });

  // Interaction state
  const [hoveredNode, setHoveredNode] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [showProgress, setShowProgress] = useState(true);

  // Fetch curriculum data for progress
  const { data: worlds } = useQuery<World[]>({
    queryKey: ['worlds'],
    queryFn: () => api.get('/worlds').then((r) => r.data),
    staleTime: 60_000,
  });

  const nodes = useMemo(() => layoutNodes(), []);
  const nodeMap = useMemo(() => new Map(nodes.map((n) => [n.id, n])), [nodes]);

  const searchLower = search.toLowerCase();
  const matchingIds = useMemo(() => {
    if (!searchLower) return null;
    return new Set(nodes.filter((n) =>
      n.label.toLowerCase().includes(searchLower) ||
      n.description.toLowerCase().includes(searchLower) ||
      n.id.toLowerCase().includes(searchLower)
    ).map((n) => n.id));
  }, [nodes, searchLower]);

  // Pan handlers
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (e.button !== 0) return;
    const target = e.target as SVGElement;
    if (target.closest('[data-node]')) return;
    setIsPanning(true);
    panStart.current = { x: e.clientX, y: e.clientY, panX: pan.x, panY: pan.y };
  }, [pan]);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (!isPanning) return;
    const dx = e.clientX - panStart.current.x;
    const dy = e.clientY - panStart.current.y;
    setPan({ x: panStart.current.panX + dx, y: panStart.current.panY + dy });
  }, [isPanning]);

  const handleMouseUp = useCallback(() => {
    setIsPanning(false);
  }, []);

  const handleWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault();
    const delta = e.deltaY > 0 ? 0.9 : 1.1;
    setZoom((z) => Math.min(3, Math.max(0.3, z * delta)));
  }, []);

  // Reset view
  const resetView = useCallback(() => {
    setPan({ x: 0, y: 0 });
    setZoom(1);
  }, []);

  // Keyboard support for reset
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') resetView();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [resetView]);

  const handleNodeClick = useCallback((node: ConceptNode) => {
    navigate(getLessonRoute(node.lessonId));
  }, [navigate]);

  // Build curved edge path
  function edgePath(from: PositionedNode, to: PositionedNode): string {
    const dx = to.x - from.x;
    const dy = to.y - from.y;
    const cx = from.x + dx * 0.5;
    const cy1 = from.y + dy * 0.3;
    const cy2 = from.y + dy * 0.7;
    return `M ${from.x} ${from.y + NODE_RY * 0.6} C ${cx} ${cy1}, ${cx} ${cy2}, ${to.x} ${to.y - NODE_RY * 0.6}`;
  }

  const isNodeDimmed = (id: string) => matchingIds !== null && !matchingIds.has(id);
  const isNodeHighlighted = (id: string) => matchingIds !== null && matchingIds.has(id);

  return (
    <Box minH="100vh" bg="dark.bg" p={{ base: 2, md: 4 }}>
      {/* Header */}
      <Flex direction="column" gap={3} mb={4}>
        <Flex align="center" justify="space-between" wrap="wrap" gap={3}>
          <Heading
            size="lg"
            color="aspire.500"
            {...pixelFontProps}
            fontSize={{ base: 'sm', md: 'md' }}
          >
            🗺️ Aspire Concept Map
          </Heading>
          <Flex align="center" gap={3} wrap="wrap">
            <Input
              placeholder="🔍 Search concepts..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              size="sm"
              maxW="220px"
              bg="dark.card"
              color="dark.text"
              borderColor="dark.border"
              _placeholder={{ color: 'dark.muted' }}
              {...pixelFontProps}
              fontSize="2xs"
            />
            <Flex align="center" gap={1}>
              <Text fontSize="2xs" color="dark.muted" {...pixelFontProps}>
                Progress
              </Text>
              <Switch.Root
                checked={showProgress}
                onCheckedChange={(e) => setShowProgress(e.checked)}
                size="sm"
              >
                <Switch.HiddenInput />
                <Switch.Control>
                  <Switch.Thumb />
                </Switch.Control>
              </Switch.Root>
            </Flex>
            <Box
              as="button"
              onClick={resetView}
              px={2}
              py={1}
              bg="dark.card"
              color="dark.muted"
              border="2px solid"
              borderColor="dark.border"
              borderRadius="sm"
              {...pixelFontProps}
              fontSize="2xs"
              cursor="pointer"
              _hover={{ bg: 'aspire.200', color: 'aspire.300' }}
            >
              Reset View
            </Box>
          </Flex>
        </Flex>

        {/* Legend */}
        <Flex gap={3} wrap="wrap" justify="center">
          {Object.entries(LAYERS).map(([key, layer]) => (
            <Flex key={key} align="center" gap={1}>
              <Box
                w="10px"
                h="10px"
                borderRadius="full"
                bg={layer.color}
                boxShadow={`0 0 6px ${layer.glow}`}
              />
              <Text fontSize="2xs" color="dark.muted" {...pixelFontProps}>
                {layer.emoji} {layer.name}
              </Text>
            </Flex>
          ))}
        </Flex>
      </Flex>

      {/* SVG Container */}
      <Box
        ref={svgContainerRef}
        {...retroCardProps}
        bg="dark.surface"
        overflow="hidden"
        position="relative"
        cursor={isPanning ? 'grabbing' : 'grab'}
        userSelect="none"
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        onWheel={handleWheel}
        h={{ base: '70vh', md: '75vh' }}
      >
        <svg
          width="100%"
          height="100%"
          viewBox={`0 0 ${CANVAS_W} ${CANVAS_H}`}
          style={{ display: 'block' }}
        >
          <defs>
            {/* Glow filter for edges */}
            <filter id="edgeGlow" x="-20%" y="-20%" width="140%" height="140%">
              <feGaussianBlur stdDeviation="2" result="blur" />
              <feMerge>
                <feMergeNode in="blur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
            {/* Stronger glow for highlighted edges */}
            <filter id="edgeGlowStrong" x="-30%" y="-30%" width="160%" height="160%">
              <feGaussianBlur stdDeviation="4" result="blur" />
              <feMerge>
                <feMergeNode in="blur" />
                <feMergeNode in="blur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
            {/* Node shadow */}
            <filter id="nodeShadow" x="-30%" y="-30%" width="160%" height="160%">
              <feDropShadow dx="2" dy="2" stdDeviation="2" floodColor="#000" floodOpacity="0.5" />
            </filter>
            {/* Pulse animation for AppHost */}
            <radialGradient id="pulseGradient">
              <stop offset="0%" stopColor="#9185D1" stopOpacity="0.6">
                <animate attributeName="stopOpacity" values="0.6;0.2;0.6" dur="2s" repeatCount="indefinite" />
              </stop>
              <stop offset="100%" stopColor="#9185D1" stopOpacity="0">
                <animate attributeName="stopOpacity" values="0;0.1;0" dur="2s" repeatCount="indefinite" />
              </stop>
            </radialGradient>
          </defs>

          <g transform={`translate(${pan.x}, ${pan.y}) scale(${zoom})`}>
            {/* Layer background labels */}
            {[
              { y: 70, label: 'CORE' },
              { y: 200, label: 'RESOURCES' },
              { y: 360, label: 'CONFIGURATION' },
              { y: 500, label: 'INFRASTRUCTURE' },
              { y: 630, label: 'DEPLOYMENT' },
              { y: 740, label: 'POLYGLOT' },
            ].map((layer) => (
              <text
                key={layer.label}
                x={25}
                y={layer.y - 30}
                fill="rgba(155,147,176,0.2)"
                fontSize="11"
                fontFamily='"Press Start 2P", monospace'
                fontWeight="bold"
              >
                {layer.label}
              </text>
            ))}

            {/* Edges */}
            {EDGES.map(([fromId, toId], i) => {
              const from = nodeMap.get(fromId);
              const to = nodeMap.get(toId);
              if (!from || !to) return null;

              const fromLayer = LAYERS[from.layer];
              const isConnectedToHovered = hoveredNode === fromId || hoveredNode === toId;
              const bothDimmed = isNodeDimmed(fromId) && isNodeDimmed(toId);
              const opacity = bothDimmed ? 0.08 : isConnectedToHovered ? 0.9 : 0.25;

              return (
                <path
                  key={`edge-${i}`}
                  d={edgePath(from, to)}
                  stroke={fromLayer?.color ?? '#666'}
                  strokeWidth={isConnectedToHovered ? 2.5 : 1.2}
                  fill="none"
                  opacity={opacity}
                  filter={isConnectedToHovered ? 'url(#edgeGlowStrong)' : 'url(#edgeGlow)'}
                  style={{ transition: 'opacity 0.3s, stroke-width 0.3s' }}
                />
              );
            })}

            {/* Nodes */}
            {nodes.map((node) => {
              const layer = LAYERS[node.layer];
              const isHovered = hoveredNode === node.id;
              const dimmed = isNodeDimmed(node.id);
              const highlighted = isNodeHighlighted(node.id);
              const completed = showProgress && worlds ? isLessonCompleted(node.lessonId, worlds) : false;
              const locked = showProgress && worlds ? isLessonLocked(node.lessonId, worlds) : false;
              const isAppHost = node.id === 'AppHost';

              const nodeOpacity = dimmed ? 0.15 : 1;
              const scale = isHovered ? 1.12 : 1;

              return (
                <g
                  key={node.id}
                  data-node="true"
                  transform={`translate(${node.x}, ${node.y}) scale(${scale})`}
                  style={{
                    cursor: 'pointer',
                    transition: 'transform 0.2s ease',
                    opacity: nodeOpacity,
                  }}
                  onMouseEnter={() => setHoveredNode(node.id)}
                  onMouseLeave={() => setHoveredNode(null)}
                  onClick={() => handleNodeClick(node)}
                >
                  {/* Pulse ring for AppHost */}
                  {isAppHost && (
                    <circle
                      cx={0}
                      cy={0}
                      r={NODE_RX + 10}
                      fill="url(#pulseGradient)"
                    >
                      <animate
                        attributeName="r"
                        values={`${NODE_RX + 6};${NODE_RX + 14};${NODE_RX + 6}`}
                        dur="2s"
                        repeatCount="indefinite"
                      />
                    </circle>
                  )}

                  {/* Search highlight ring */}
                  {highlighted && (
                    <circle
                      cx={0}
                      cy={0}
                      r={NODE_RX + 6}
                      fill="none"
                      stroke="#FFD700"
                      strokeWidth={2}
                      opacity={0.8}
                    >
                      <animate
                        attributeName="opacity"
                        values="0.8;0.3;0.8"
                        dur="1.2s"
                        repeatCount="indefinite"
                      />
                    </circle>
                  )}

                  {/* Node circle */}
                  <circle
                    cx={0}
                    cy={0}
                    r={NODE_RX}
                    fill={locked ? '#2A2445' : '#1A1630'}
                    stroke={locked ? '#555' : layer.color}
                    strokeWidth={isHovered ? 3 : 2}
                    filter="url(#nodeShadow)"
                    style={{ transition: 'stroke-width 0.2s' }}
                  />

                  {/* Inner glow */}
                  {!locked && (
                    <circle
                      cx={0}
                      cy={0}
                      r={NODE_RX - 3}
                      fill="none"
                      stroke={layer.color}
                      strokeWidth={0.5}
                      opacity={0.3}
                    />
                  )}

                  {/* Emoji */}
                  <text
                    x={0}
                    y={-4}
                    textAnchor="middle"
                    dominantBaseline="middle"
                    fontSize="18"
                    style={{ pointerEvents: 'none' }}
                  >
                    {locked ? '🔒' : node.emoji}
                  </text>

                  {/* Label */}
                  {node.label.split('\n').map((line, li, arr) => (
                    <text
                      key={li}
                      x={0}
                      y={NODE_RY + 12 + li * 11}
                      textAnchor="middle"
                      fill={locked ? '#666' : '#E8E0F0'}
                      fontSize="7.5"
                      fontFamily='"Press Start 2P", monospace'
                      style={{ pointerEvents: 'none' }}
                      opacity={locked ? 0.5 : arr.length > 1 ? 0.9 : 1}
                    >
                      {line}
                    </text>
                  ))}

                  {/* Completion checkmark */}
                  {completed && showProgress && (
                    <g>
                      <circle cx={NODE_RX - 6} cy={-NODE_RY + 6} r={9} fill="#107C10" stroke="#0D0B1A" strokeWidth={1.5} />
                      <text
                        x={NODE_RX - 6}
                        y={-NODE_RY + 6}
                        textAnchor="middle"
                        dominantBaseline="middle"
                        fontSize="10"
                        style={{ pointerEvents: 'none' }}
                      >
                        ✅
                      </text>
                    </g>
                  )}

                  {/* Hover tooltip */}
                  {isHovered && (
                    <g>
                      <rect
                        x={-120}
                        y={-NODE_RY - 62}
                        width={240}
                        height={48}
                        rx={6}
                        fill="#0D0B1A"
                        stroke={layer.color}
                        strokeWidth={1.5}
                        opacity={0.95}
                      />
                      <text
                        x={0}
                        y={-NODE_RY - 44}
                        textAnchor="middle"
                        fill="#E8E0F0"
                        fontSize="6.5"
                        fontFamily='"Press Start 2P", monospace'
                      >
                        {node.description.length > 55
                          ? node.description.slice(0, 55) + '…'
                          : node.description}
                      </text>
                      <text
                        x={0}
                        y={-NODE_RY - 26}
                        textAnchor="middle"
                        fill={layer.color}
                        fontSize="5.5"
                        fontFamily='"Press Start 2P", monospace'
                        opacity={0.8}
                      >
                        Click to learn more →
                      </text>
                    </g>
                  )}
                </g>
              );
            })}
          </g>
        </svg>

        {/* Zoom indicator */}
        <Box
          position="absolute"
          bottom={2}
          right={3}
          {...pixelFontProps}
          fontSize="2xs"
          color="dark.muted"
          opacity={0.6}
        >
          {Math.round(zoom * 100)}% · Scroll to zoom · Drag to pan · Esc to reset
        </Box>
      </Box>
    </Box>
  );
}
