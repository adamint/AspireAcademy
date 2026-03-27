import { useState, useCallback, useMemo } from 'react';
import {
  Box,
  Flex,
  Text,
  Button,
  Card,
  Heading,
  Badge,
  IconButton,
  SimpleGrid,
  Tabs,
} from '@chakra-ui/react';
import { retroCardProps, pixelFontProps } from '../theme/aspireTheme';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism';

// ─── Architecture Diagram Types ────────────────────────────────────────────────

interface ServiceNode {
  id: string;
  name: string;
  type: 'api' | 'database' | 'cache' | 'messaging' | 'frontend' | 'worker' | 'container';
  row: number;
  col: number;
}

interface Connection {
  from: string;
  to: string;
  label?: string;
}

interface GalleryEntry {
  id: string;
  title: string;
  description: string;
  services: ServiceNode[];
  connections: Connection[];
  code: string;
  concepts: string[];
  tryPrompt: string;
}

// ─── Color Map for Service Types ───────────────────────────────────────────────

const serviceTypeColors: Record<ServiceNode['type'], { bg: string; border: string; label: string }> = {
  api:       { bg: '#1E3A5F', border: '#3B82F6', label: '🔵 API' },
  database:  { bg: '#1A3A2A', border: '#22C55E', label: '🟢 DB' },
  cache:     { bg: '#3A2A1A', border: '#F59E0B', label: '🟡 Cache' },
  messaging: { bg: '#3A1A2A', border: '#EF4444', label: '🔴 Messaging' },
  frontend:  { bg: '#2A1A3A', border: '#A855F7', label: '🟣 Frontend' },
  worker:    { bg: '#1A2A3A', border: '#06B6D4', label: '🔵 Worker' },
  container: { bg: '#2A2A1A', border: '#84CC16', label: '🟢 Container' },
};

// ─── Clipboard Utility ─────────────────────────────────────────────────────────

function copyToClipboard(text: string): void {
  navigator.clipboard.writeText(text).catch(() => {
    const el = document.createElement('textarea');
    el.value = text;
    el.style.position = 'fixed';
    el.style.opacity = '0';
    document.body.appendChild(el);
    el.select();
    document.execCommand('copy');
    document.body.removeChild(el);
  });
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = useCallback(() => {
    copyToClipboard(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }, [text]);

  return (
    <IconButton
      aria-label="Copy code"
      size="xs"
      variant="ghost"
      onClick={handleCopy}
      color={copied ? 'game.success' : 'dark.muted'}
      _hover={{ color: 'aspire.500' }}
      flexShrink={0}
    >
      {copied ? '✅' : '📋'}
    </IconButton>
  );
}

// ─── Architecture Diagram Component ────────────────────────────────────────────

function ArchitectureDiagram({
  services,
  connections,
  compact = false,
}: {
  services: ServiceNode[];
  connections: Connection[];
  compact?: boolean;
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

  const nodeSize = compact ? '64px' : '90px';
  const fontSize = compact ? '7px' : '9px';
  const gap = compact ? '6px' : '12px';

  return (
    <Box overflow="auto" p={compact ? '2' : '4'}>
      <Flex direction="column" gap={gap} align="center">
        {grid.map((row, ri) => (
          <Flex key={ri} gap={gap} align="center" justify="center" flexWrap="wrap">
            {row.map((node, ci) => {
              if (!node) {
                return <Box key={ci} w={nodeSize} h={nodeSize} flexShrink={0} />;
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
                    w={nodeSize}
                    h={nodeSize}
                    bg={colors.bg}
                    border="2px solid"
                    borderColor={colors.border}
                    display="flex"
                    flexDirection="column"
                    alignItems="center"
                    justifyContent="center"
                    p="1"
                    position="relative"
                    css={{
                      imageRendering: 'pixelated',
                      boxShadow: `2px 2px 0 ${colors.border}`,
                    }}
                  >
                    <Text
                      fontSize={fontSize}
                      fontWeight="bold"
                      color={colors.border}
                      textAlign="center"
                      lineHeight="1.2"
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
                      w={compact ? '20px' : '36px'}
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
  );
}

// ─── Gallery Data ──────────────────────────────────────────────────────────────

const galleryEntries: GalleryEntry[] = [
  // 1. E-Commerce Platform
  {
    id: 'ecommerce',
    title: '🛒 E-Commerce Platform',
    description:
      'A full-featured e-commerce system with separate microservices for catalog, orders, and cart management. Uses message-driven architecture with RabbitMQ for order event processing and Redis for high-speed cart and session caching.',
    services: [
      { id: 'web', name: 'Web\nFrontend', type: 'frontend', row: 0, col: 1 },
      { id: 'gateway', name: 'API\nGateway', type: 'api', row: 0, col: 2 },
      { id: 'catalog', name: 'Catalog\nService', type: 'api', row: 1, col: 0 },
      { id: 'orders', name: 'Order\nService', type: 'api', row: 1, col: 2 },
      { id: 'cart', name: 'Cart\nService', type: 'api', row: 1, col: 3 },
      { id: 'productsdb', name: 'Products\nDB', type: 'database', row: 2, col: 0 },
      { id: 'ordersdb', name: 'Orders\nDB', type: 'database', row: 2, col: 2 },
      { id: 'redis', name: 'Redis', type: 'cache', row: 2, col: 3 },
      { id: 'rabbitmq', name: 'RabbitMQ', type: 'messaging', row: 1, col: 1 },
    ],
    connections: [
      { from: 'web', to: 'gateway', label: 'HTTP' },
      { from: 'catalog', to: 'productsdb', label: 'queries' },
      { from: 'orders', to: 'ordersdb', label: 'queries' },
      { from: 'cart', to: 'redis', label: 'cache' },
      { from: 'catalog', to: 'rabbitmq', label: 'events' },
      { from: 'orders', to: 'rabbitmq', label: 'events' },
      { from: 'gateway', to: 'catalog', label: 'WithReference' },
      { from: 'gateway', to: 'orders', label: 'WithReference' },
    ],
    code: `var builder = DistributedApplication.CreateBuilder(args);

// Databases
var productsDb = builder.AddPostgres("pg")
    .AddDatabase("productsdb");
var ordersDb = builder.AddPostgres("pg-orders")
    .AddDatabase("ordersdb");

// Caching & Messaging
var redis = builder.AddRedis("redis");
var rabbitmq = builder.AddRabbitMQ("rabbitmq");

// Services
var catalogService = builder.AddProject<Projects.CatalogService>("catalog")
    .WithReference(productsDb)
    .WithReference(rabbitmq);

var orderService = builder.AddProject<Projects.OrderService>("orders")
    .WithReference(ordersDb)
    .WithReference(rabbitmq);

var cartService = builder.AddProject<Projects.CartService>("cart")
    .WithReference(redis);

// API Gateway
var gateway = builder.AddProject<Projects.ApiGateway>("gateway")
    .WithReference(catalogService)
    .WithReference(orderService)
    .WithReference(cartService);

// Frontend
builder.AddNpmApp("webfrontend", "../Web")
    .WithReference(gateway)
    .WithHttpEndpoint(env: "PORT");

builder.Build().Run();`,
    concepts: [
      'Multiple Databases',
      'RabbitMQ',
      'Service Discovery',
      'Redis Caching',
      'Message-Driven Architecture',
    ],
    tryPrompt: 'Want to build this? Start with `aspire new` and follow World 5: Integration Mastery',
  },

  // 2. SaaS Multi-Tenant App
  {
    id: 'saas',
    title: '🏢 SaaS Multi-Tenant App',
    description:
      'A multi-tenant SaaS platform with isolated tenant databases, centralized authentication, file storage with Azure Blob, and background job processing. Demonstrates secret management with Aspire Parameters.',
    services: [
      { id: 'admin', name: 'Admin\nPortal', type: 'frontend', row: 0, col: 0 },
      { id: 'auth', name: 'Auth\nService', type: 'api', row: 0, col: 1 },
      { id: 'tenantapi', name: 'Tenant\nAPI', type: 'api', row: 0, col: 2 },
      { id: 'worker', name: 'Background\nWorker', type: 'worker', row: 1, col: 0 },
      { id: 'tenantdb', name: 'Tenant\nDB', type: 'database', row: 1, col: 1 },
      { id: 'redis', name: 'Redis', type: 'cache', row: 1, col: 2 },
      { id: 'blob', name: 'Azure\nBlob', type: 'container', row: 1, col: 3 },
    ],
    connections: [
      { from: 'admin', to: 'auth', label: 'auth' },
      { from: 'auth', to: 'tenantapi', label: 'JWT' },
      { from: 'tenantapi', to: 'tenantdb', label: 'queries' },
      { from: 'tenantapi', to: 'redis', label: 'cache' },
      { from: 'tenantapi', to: 'blob', label: 'files' },
      { from: 'worker', to: 'tenantdb', label: 'jobs' },
    ],
    code: `var builder = DistributedApplication.CreateBuilder(args);

// Secrets via Parameters
var dbPassword = builder.AddParameter("db-password", secret: true);
var jwtSecret = builder.AddParameter("jwt-secret", secret: true);

// Infrastructure
var tenantDb = builder.AddPostgres("pg", password: dbPassword)
    .AddDatabase("tenantdb");
var redis = builder.AddRedis("redis");
var blobStorage = builder.AddAzureStorage("storage")
    .AddBlobs("blobs");

// Auth Service
var authService = builder.AddProject<Projects.AuthService>("auth")
    .WithReference(tenantDb)
    .WithEnvironment("JWT_SECRET", jwtSecret);

// Tenant API
var tenantApi = builder.AddProject<Projects.TenantApi>("tenant-api")
    .WithReference(tenantDb)
    .WithReference(redis)
    .WithReference(blobStorage)
    .WithReference(authService);

// Background Worker
builder.AddProject<Projects.BackgroundWorker>("worker")
    .WithReference(tenantDb)
    .WithReference(redis);

// Admin Portal
builder.AddProject<Projects.AdminPortal>("admin")
    .WithReference(authService)
    .WithReference(tenantApi);

builder.Build().Run();`,
    concepts: [
      'Parameters & Secrets',
      'Azure Blob Storage',
      'Health Checks',
      'Connection Strings',
      'Background Workers',
    ],
    tryPrompt: 'Want to build this? Start with `aspire new` and follow World 3: Resource Wiring',
  },

  // 3. Real-Time Dashboard
  {
    id: 'realtime',
    title: '📊 Real-Time Dashboard',
    description:
      'A real-time analytics dashboard ingesting high-velocity event streams via Kafka. Features a Node.js React frontend connected through WebSockets, with PostgreSQL for durable metrics storage and Redis pub/sub for live updates.',
    services: [
      { id: 'dashboard', name: 'React\nDashboard', type: 'frontend', row: 0, col: 0 },
      { id: 'wsgateway', name: 'WebSocket\nGateway', type: 'api', row: 0, col: 1 },
      { id: 'analytics', name: 'Analytics\nAPI', type: 'api', row: 0, col: 2 },
      { id: 'ingestion', name: 'Data\nIngestion', type: 'worker', row: 1, col: 0 },
      { id: 'kafka', name: 'Kafka', type: 'messaging', row: 1, col: 1 },
      { id: 'redis', name: 'Redis\nPub/Sub', type: 'cache', row: 1, col: 2 },
      { id: 'metricsdb', name: 'Metrics\nDB', type: 'database', row: 2, col: 1 },
    ],
    connections: [
      { from: 'dashboard', to: 'wsgateway', label: 'WS' },
      { from: 'wsgateway', to: 'analytics', label: 'WithReference' },
      { from: 'ingestion', to: 'kafka', label: 'produce' },
      { from: 'kafka', to: 'analytics', label: 'consume' },
      { from: 'analytics', to: 'redis', label: 'pub/sub' },
      { from: 'analytics', to: 'metricsdb', label: 'queries' },
      { from: 'wsgateway', to: 'redis', label: 'subscribe' },
    ],
    code: `var builder = DistributedApplication.CreateBuilder(args);

// Infrastructure
var metricsDb = builder.AddPostgres("pg")
    .AddDatabase("metricsdb");
var redis = builder.AddRedis("redis");
var kafka = builder.AddKafka("kafka");

// Data Ingestion (produces events)
var ingestion = builder.AddProject<Projects.DataIngestion>("ingestion")
    .WithReference(kafka);

// Analytics API (consumes + queries)
var analyticsApi = builder.AddProject<Projects.AnalyticsApi>("analytics")
    .WithReference(kafka)
    .WithReference(metricsDb)
    .WithReference(redis);

// WebSocket Gateway
var wsGateway = builder.AddProject<Projects.WsGateway>("ws-gateway")
    .WithReference(analyticsApi)
    .WithReference(redis);

// React Dashboard (Node.js frontend)
builder.AddNpmApp("dashboard", "../dashboard-app")
    .WithReference(wsGateway)
    .WithHttpEndpoint(env: "PORT");

builder.Build().Run();`,
    concepts: [
      'Kafka Integration',
      'Real-Time Processing',
      'Polyglot (Node.js)',
      'WebSockets',
      'Redis Pub/Sub',
    ],
    tryPrompt: 'Want to build this? Start with `aspire new` and follow World 6: Advanced Patterns',
  },

  // 4. ML Pipeline
  {
    id: 'mlpipeline',
    title: '🤖 ML Pipeline',
    description:
      'An end-to-end machine learning pipeline with a Python training worker, .NET inference API, and model registry. Uses Redis as a job queue and PostgreSQL for experiment metadata. Demonstrates Aspire\'s polyglot support with AddPythonApp.',
    services: [
      { id: 'apiservice', name: 'API\nService', type: 'api', row: 0, col: 0 },
      { id: 'inference', name: 'Inference\nAPI', type: 'api', row: 0, col: 1 },
      { id: 'registry', name: 'Model\nRegistry', type: 'api', row: 0, col: 2 },
      { id: 'trainer', name: 'Training\nWorker', type: 'worker', row: 1, col: 0 },
      { id: 'redis', name: 'Redis\nJob Queue', type: 'cache', row: 1, col: 1 },
      { id: 'metadb', name: 'Metadata\nDB', type: 'database', row: 1, col: 2 },
      { id: 'modelstore', name: 'Model\nStorage', type: 'container', row: 2, col: 1 },
    ],
    connections: [
      { from: 'apiservice', to: 'inference', label: 'predict' },
      { from: 'apiservice', to: 'redis', label: 'enqueue' },
      { from: 'trainer', to: 'redis', label: 'dequeue' },
      { from: 'trainer', to: 'metadb', label: 'metadata' },
      { from: 'trainer', to: 'modelstore', label: 'save model' },
      { from: 'inference', to: 'registry', label: 'load model' },
      { from: 'registry', to: 'modelstore', label: 'artifacts' },
      { from: 'registry', to: 'metadb', label: 'queries' },
    ],
    code: `var builder = DistributedApplication.CreateBuilder(args);

// Infrastructure
var metadataDb = builder.AddPostgres("pg")
    .AddDatabase("metadatadb");
var redis = builder.AddRedis("redis");

// Model Storage (MinIO-compatible)
var modelStorage = builder.AddContainer("model-storage", "minio/minio")
    .WithHttpEndpoint(port: 9000, targetPort: 9000)
    .WithEnvironment("MINIO_ROOT_USER", "minioadmin")
    .WithEnvironment("MINIO_ROOT_PASSWORD", "minioadmin")
    .WithArgs("server", "/data");

// Python Training Worker
var trainer = builder.AddPythonApp("trainer", "../ml-trainer", "train.py")
    .WithReference(redis)
    .WithReference(metadataDb)
    .WithReference(modelStorage);

// Model Registry
var registry = builder.AddProject<Projects.ModelRegistry>("registry")
    .WithReference(metadataDb)
    .WithReference(modelStorage);

// Inference API
var inference = builder.AddProject<Projects.InferenceApi>("inference")
    .WithReference(registry);

// API Service
builder.AddProject<Projects.ApiService>("api")
    .WithReference(inference)
    .WithReference(redis);

builder.Build().Run();`,
    concepts: [
      'AddPythonApp',
      'Polyglot Architecture',
      'Container Resources',
      'Custom Containers',
      'Job Queues',
    ],
    tryPrompt: 'Want to build this? Start with `aspire new` and follow World 4: Beyond .NET',
  },

  // 5. Microservices Blog Platform
  {
    id: 'blog',
    title: '📝 Microservices Blog Platform',
    description:
      'A microservices blog with dedicated services for posts, users, and comments. Uses PostgreSQL for structured data, MongoDB for flexible comment storage, and an API gateway to unify access. Demonstrates the WaitFor pattern for startup ordering.',
    services: [
      { id: 'ssrfrontend', name: 'SSR\nFrontend', type: 'frontend', row: 0, col: 0 },
      { id: 'gateway', name: 'API\nGateway', type: 'api', row: 0, col: 1 },
      { id: 'postsapi', name: 'Posts\nAPI', type: 'api', row: 0, col: 2 },
      { id: 'usersapi', name: 'Users\nAPI', type: 'api', row: 1, col: 0 },
      { id: 'commentsapi', name: 'Comments\nAPI', type: 'api', row: 1, col: 2 },
      { id: 'postsdb', name: 'Posts\nDB', type: 'database', row: 2, col: 0 },
      { id: 'usersdb', name: 'Users\nDB', type: 'database', row: 2, col: 1 },
      { id: 'commentsdb', name: 'MongoDB', type: 'database', row: 2, col: 2 },
      { id: 'redis', name: 'Redis', type: 'cache', row: 1, col: 1 },
    ],
    connections: [
      { from: 'ssrfrontend', to: 'gateway', label: 'HTTP' },
      { from: 'gateway', to: 'postsapi', label: 'WithReference' },
      { from: 'postsapi', to: 'commentsapi', label: 'WithReference' },
      { from: 'usersapi', to: 'usersdb', label: 'queries' },
      { from: 'postsapi', to: 'postsdb', label: 'queries' },
      { from: 'commentsapi', to: 'commentsdb', label: 'queries' },
      { from: 'gateway', to: 'redis', label: 'cache' },
      { from: 'usersapi', to: 'redis', label: 'sessions' },
    ],
    code: `var builder = DistributedApplication.CreateBuilder(args);

// Databases
var postsDb = builder.AddPostgres("pg-posts")
    .AddDatabase("postsdb");
var usersDb = builder.AddPostgres("pg-users")
    .AddDatabase("usersdb");
var commentsDb = builder.AddMongoDB("mongodb")
    .AddDatabase("commentsdb");

// Cache
var redis = builder.AddRedis("redis");

// Microservices with WaitFor ordering
var usersApi = builder.AddProject<Projects.UsersApi>("users-api")
    .WithReference(usersDb)
    .WithReference(redis)
    .WaitFor(usersDb);

var commentsApi = builder.AddProject<Projects.CommentsApi>("comments-api")
    .WithReference(commentsDb)
    .WaitFor(commentsDb);

var postsApi = builder.AddProject<Projects.PostsApi>("posts-api")
    .WithReference(postsDb)
    .WithReference(commentsApi)
    .WaitFor(postsDb);

// API Gateway
var gateway = builder.AddProject<Projects.ApiGateway>("gateway")
    .WithReference(postsApi)
    .WithReference(usersApi)
    .WithReference(commentsApi)
    .WithReference(redis)
    .WaitFor(postsApi)
    .WaitFor(usersApi);

// SSR Frontend
builder.AddProject<Projects.WebFrontend>("frontend")
    .WithReference(gateway)
    .WaitFor(gateway);

builder.Build().Run();`,
    concepts: [
      'Multiple DB Types',
      'MongoDB',
      'Gateway Pattern',
      'WaitFor Ordering',
      'Service Discovery',
    ],
    tryPrompt: 'Want to build this? Start with `aspire new` and follow World 5: Integration Mastery',
  },

  // 6. IoT Data Platform
  {
    id: 'iot',
    title: '🌡️ IoT Data Platform',
    description:
      'A high-throughput IoT platform processing device telemetry via Kafka event streams. Features a custom device gateway container, real-time alert processing, and Redis-backed latest-readings cache for instant dashboard queries.',
    services: [
      { id: 'dashboard', name: 'IoT\nDashboard', type: 'frontend', row: 0, col: 0 },
      { id: 'alertsvc', name: 'Alert\nService', type: 'api', row: 0, col: 2 },
      { id: 'devicegw', name: 'Device\nGateway', type: 'container', row: 1, col: 0 },
      { id: 'processor', name: 'Telemetry\nProcessor', type: 'worker', row: 1, col: 1 },
      { id: 'kafka', name: 'Kafka', type: 'messaging', row: 1, col: 2 },
      { id: 'devicedb', name: 'Device\nRegistry', type: 'database', row: 2, col: 0 },
      { id: 'redis', name: 'Redis\nCache', type: 'cache', row: 2, col: 1 },
      { id: 'tsdb', name: 'TimeSeries\nDB', type: 'database', row: 2, col: 2 },
    ],
    connections: [
      { from: 'devicegw', to: 'kafka', label: 'telemetry' },
      { from: 'kafka', to: 'processor', label: 'consume' },
      { from: 'processor', to: 'redis', label: 'latest' },
      { from: 'processor', to: 'tsdb', label: 'store' },
      { from: 'processor', to: 'alertsvc', label: 'alerts' },
      { from: 'dashboard', to: 'redis', label: 'reads' },
      { from: 'dashboard', to: 'devicedb', label: 'registry' },
      { from: 'devicegw', to: 'devicedb', label: 'auth' },
    ],
    code: `var builder = DistributedApplication.CreateBuilder(args);

// Infrastructure
var deviceDb = builder.AddPostgres("pg")
    .AddDatabase("deviceregistry");
var tsDb = builder.AddPostgres("pg-timeseries")
    .AddDatabase("telemetrydb");
var redis = builder.AddRedis("redis");
var kafka = builder.AddKafka("kafka");

// Custom Device Gateway Container
var deviceGateway = builder.AddContainer("device-gateway", "myregistry/device-gw")
    .WithHttpEndpoint(port: 8443, targetPort: 8443, name: "mqtt")
    .WithReference(kafka)
    .WithReference(deviceDb);

// Telemetry Processor
var processor = builder.AddProject<Projects.TelemetryProcessor>("processor")
    .WithReference(kafka)
    .WithReference(redis)
    .WithReference(tsDb)
    .WaitFor(kafka);

// Alert Service
var alertService = builder.AddProject<Projects.AlertService>("alerts")
    .WithReference(tsDb)
    .WithReference(redis);

// IoT Dashboard
builder.AddProject<Projects.IotDashboard>("dashboard")
    .WithReference(redis)
    .WithReference(deviceDb)
    .WithReference(alertService)
    .WaitFor(processor);

builder.Build().Run();`,
    concepts: [
      'Custom Containers',
      'Event Streaming',
      'High Throughput',
      'Kafka',
      'WaitFor Ordering',
    ],
    tryPrompt: 'Want to build this? Start with `aspire new` and follow World 6: Advanced Patterns',
  },
];

// ─── Gallery Card Component ───────────────────────────────────────────────────

function GalleryCard({
  entry,
  onClick,
}: {
  entry: GalleryEntry;
  onClick: () => void;
}) {
  return (
    <Card.Root
      {...retroCardProps}
      bg="dark.card"
      cursor="pointer"
      onClick={onClick}
      transition="all 0.2s"
      _hover={{
        transform: 'translateY(-4px)',
        boxShadow: '4px 4px 0 #6B4FBB, 0 0 20px rgba(107, 79, 187, 0.3)',
      }}
    >
      <Card.Body p="4" gap="3">
        <Heading size="sm" color="dark.text" {...pixelFontProps} lineHeight="1.4">
          {entry.title}
        </Heading>

        <Text fontSize="xs" color="dark.muted" lineHeight="1.5" noOfLines={2}>
          {entry.description}
        </Text>

        {/* Mini diagram preview */}
        <Box
          bg="dark.surface"
          borderRadius="sm"
          overflow="hidden"
          border="1px solid"
          borderColor="dark.border"
        >
          <ArchitectureDiagram
            services={entry.services}
            connections={entry.connections}
            compact
          />
        </Box>

        {/* Concept tags */}
        <Flex gap="1" flexWrap="wrap">
          {entry.concepts.slice(0, 3).map((concept) => (
            <Badge
              key={concept}
              fontSize="7px"
              bg="aspire.100"
              color="aspire.400"
              px="2"
              py="0.5"
              {...pixelFontProps}
            >
              {concept}
            </Badge>
          ))}
          {entry.concepts.length > 3 && (
            <Badge
              fontSize="7px"
              bg="dark.surface"
              color="dark.muted"
              px="2"
              py="0.5"
              {...pixelFontProps}
            >
              +{entry.concepts.length - 3}
            </Badge>
          )}
        </Flex>
      </Card.Body>
    </Card.Root>
  );
}

// ─── Gallery Detail View ──────────────────────────────────────────────────────

function GalleryDetail({
  entry,
  onBack,
}: {
  entry: GalleryEntry;
  onBack: () => void;
}) {
  return (
    <Box>
      {/* Header */}
      <Flex align="center" gap="3" mb="4">
        <Button
          size="sm"
          variant="ghost"
          onClick={onBack}
          color="dark.muted"
          _hover={{ color: 'aspire.500' }}
          {...pixelFontProps}
          fontSize="10px"
        >
          ← Back to Gallery
        </Button>
      </Flex>

      <Heading size="lg" color="dark.text" {...pixelFontProps} mb="2" lineHeight="1.6">
        {entry.title}
      </Heading>
      <Text fontSize="sm" color="dark.muted" mb="5" lineHeight="1.6" maxW="700px">
        {entry.description}
      </Text>

      {/* Concept Tags */}
      <Flex gap="2" flexWrap="wrap" mb="5">
        {entry.concepts.map((concept) => (
          <Badge
            key={concept}
            fontSize="8px"
            bg="aspire.100"
            color="aspire.400"
            px="3"
            py="1"
            {...pixelFontProps}
          >
            {concept}
          </Badge>
        ))}
      </Flex>

      {/* Tabbed Content */}
      <Tabs.Root defaultValue="diagram" variant="enclosed">
        <Tabs.List
          bg="dark.surface"
          border="2px solid"
          borderColor="dark.border"
          borderRadius="sm"
          p="1"
          gap="1"
          mb="4"
        >
          <Tabs.Trigger
            value="diagram"
            fontSize="10px"
            px="4"
            py="2"
            {...pixelFontProps}
            color="dark.muted"
            _selected={{ bg: 'aspire.200', color: 'aspire.400' }}
            borderRadius="sm"
          >
            🏗️ Diagram
          </Tabs.Trigger>
          <Tabs.Trigger
            value="code"
            fontSize="10px"
            px="4"
            py="2"
            {...pixelFontProps}
            color="dark.muted"
            _selected={{ bg: 'aspire.200', color: 'aspire.400' }}
            borderRadius="sm"
          >
            💻 AppHost Code
          </Tabs.Trigger>
          <Tabs.Trigger
            value="explanation"
            fontSize="10px"
            px="4"
            py="2"
            {...pixelFontProps}
            color="dark.muted"
            _selected={{ bg: 'aspire.200', color: 'aspire.400' }}
            borderRadius="sm"
          >
            📖 Explanation
          </Tabs.Trigger>
        </Tabs.List>

        {/* Diagram Tab */}
        <Tabs.Content value="diagram">
          <Card.Root {...retroCardProps} bg="dark.card" p="4">
            <Card.Body>
              <Heading size="sm" mb="3" color="dark.text" {...pixelFontProps}>
                Architecture Overview
              </Heading>
              <ArchitectureDiagram
                services={entry.services}
                connections={entry.connections}
              />

              {/* Legend */}
              <Flex mt="4" gap="3" flexWrap="wrap" justify="center">
                {Object.entries(serviceTypeColors).map(([type, colors]) => (
                  <Flex key={type} align="center" gap="1">
                    <Box
                      w="10px"
                      h="10px"
                      bg={colors.bg}
                      border="1px solid"
                      borderColor={colors.border}
                    />
                    <Text fontSize="8px" color="dark.muted" {...pixelFontProps}>
                      {type}
                    </Text>
                  </Flex>
                ))}
              </Flex>
            </Card.Body>
          </Card.Root>
        </Tabs.Content>

        {/* Code Tab */}
        <Tabs.Content value="code">
          <Card.Root {...retroCardProps} bg="dark.card">
            <Card.Body p="0">
              <Flex
                justify="space-between"
                align="center"
                px="4"
                pt="3"
                pb="2"
              >
                <Text fontSize="9px" color="dark.muted" {...pixelFontProps}>
                  Program.cs (AppHost)
                </Text>
                <CopyButton text={entry.code} />
              </Flex>
              <Box
                borderTop="1px solid"
                borderColor="dark.border"
                overflow="auto"
                css={{
                  '& pre': {
                    margin: '0 !important',
                    borderRadius: '0 !important',
                    fontSize: '12px !important',
                    lineHeight: '1.5 !important',
                  },
                }}
              >
                <SyntaxHighlighter
                  language="csharp"
                  style={vscDarkPlus}
                  customStyle={{
                    background: 'transparent',
                    padding: '16px',
                  }}
                >
                  {entry.code}
                </SyntaxHighlighter>
              </Box>
            </Card.Body>
          </Card.Root>
        </Tabs.Content>

        {/* Explanation Tab */}
        <Tabs.Content value="explanation">
          <Card.Root {...retroCardProps} bg="dark.card" p="4">
            <Card.Body gap="4">
              <Box>
                <Heading size="sm" mb="2" color="dark.text" {...pixelFontProps}>
                  Services ({entry.services.length})
                </Heading>
                <SimpleGrid columns={{ base: 1, md: 2 }} gap="2">
                  {entry.services.map((svc) => {
                    const colors = serviceTypeColors[svc.type];
                    return (
                      <Flex
                        key={svc.id}
                        align="center"
                        gap="2"
                        p="2"
                        bg="dark.surface"
                        borderRadius="sm"
                        border="1px solid"
                        borderColor="dark.border"
                      >
                        <Box
                          w="8px"
                          h="8px"
                          bg={colors.border}
                          borderRadius="sm"
                          flexShrink={0}
                        />
                        <Text fontSize="xs" color="dark.text">
                          {svc.name.replace('\n', ' ')}
                        </Text>
                        <Badge
                          fontSize="7px"
                          bg={colors.bg}
                          color={colors.border}
                          px="1.5"
                          ml="auto"
                        >
                          {svc.type}
                        </Badge>
                      </Flex>
                    );
                  })}
                </SimpleGrid>
              </Box>

              <Box>
                <Heading size="sm" mb="2" color="dark.text" {...pixelFontProps}>
                  Connections ({entry.connections.length})
                </Heading>
                <Flex direction="column" gap="1">
                  {entry.connections.map((conn, i) => {
                    const fromSvc = entry.services.find(
                      (s) => s.id === conn.from,
                    );
                    const toSvc = entry.services.find((s) => s.id === conn.to);
                    return (
                      <Flex
                        key={i}
                        align="center"
                        gap="2"
                        p="1.5"
                        fontSize="xs"
                        color="dark.muted"
                      >
                        <Text color="dark.text">
                          {fromSvc?.name.replace('\n', ' ')}
                        </Text>
                        <Text color="aspire.500">→</Text>
                        <Text color="dark.text">
                          {toSvc?.name.replace('\n', ' ')}
                        </Text>
                        {conn.label && (
                          <Badge
                            fontSize="7px"
                            bg="aspire.100"
                            color="aspire.400"
                            px="1.5"
                            ml="auto"
                          >
                            {conn.label}
                          </Badge>
                        )}
                      </Flex>
                    );
                  })}
                </Flex>
              </Box>

              <Box>
                <Heading size="sm" mb="2" color="dark.text" {...pixelFontProps}>
                  Key Aspire Concepts
                </Heading>
                <Flex direction="column" gap="2">
                  {entry.concepts.map((concept) => (
                    <Flex
                      key={concept}
                      align="center"
                      gap="2"
                      p="2"
                      bg="dark.surface"
                      borderRadius="sm"
                      border="1px solid"
                      borderColor="dark.border"
                    >
                      <Text color="game.xpGold" fontSize="sm">
                        ⭐
                      </Text>
                      <Text fontSize="xs" color="dark.text">
                        {concept}
                      </Text>
                    </Flex>
                  ))}
                </Flex>
              </Box>
            </Card.Body>
          </Card.Root>
        </Tabs.Content>
      </Tabs.Root>

      {/* Try This CTA */}
      <Card.Root
        mt="5"
        bg="dark.surface"
        border="2px solid"
        borderColor="game.xpGold"
        css={{
          boxShadow: '0 0 15px rgba(255, 215, 0, 0.2)',
        }}
      >
        <Card.Body p="4">
          <Flex align="center" gap="3">
            <Text fontSize="xl">🏆</Text>
            <Box>
              <Text
                fontSize="10px"
                color="game.xpGold"
                fontWeight="bold"
                {...pixelFontProps}
                mb="1"
              >
                Try This Architecture!
              </Text>
              <Text fontSize="xs" color="dark.muted" lineHeight="1.5">
                {entry.tryPrompt}
              </Text>
            </Box>
          </Flex>
        </Card.Body>
      </Card.Root>
    </Box>
  );
}

// ─── Legend Bar ─────────────────────────────────────────────────────────────────

function ServiceLegend() {
  return (
    <Flex gap="3" flexWrap="wrap" justify="center" mb="6">
      {Object.entries(serviceTypeColors).map(([type, colors]) => (
        <Flex key={type} align="center" gap="1.5">
          <Box
            w="12px"
            h="12px"
            bg={colors.bg}
            border="2px solid"
            borderColor={colors.border}
            css={{ boxShadow: `1px 1px 0 ${colors.border}` }}
          />
          <Text fontSize="8px" color="dark.muted" {...pixelFontProps} textTransform="capitalize">
            {type}
          </Text>
        </Flex>
      ))}
    </Flex>
  );
}

// ─── Main Page ─────────────────────────────────────────────────────────────────

export default function GalleryPage() {
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const selectedEntry = useMemo(
    () => galleryEntries.find((e) => e.id === selectedId) ?? null,
    [selectedId],
  );

  if (selectedEntry) {
    return (
      <Box maxW="900px" mx="auto" p="6">
        <GalleryDetail
          entry={selectedEntry}
          onBack={() => setSelectedId(null)}
        />
      </Box>
    );
  }

  return (
    <Box maxW="900px" mx="auto" p="6">
      {/* Page Header */}
      <Box textAlign="center" mb="6">
        <Heading
          size="xl"
          color="dark.text"
          {...pixelFontProps}
          mb="3"
          lineHeight="1.8"
        >
          🏛️ Real World Gallery
        </Heading>
        <Text fontSize="sm" color="dark.muted" maxW="600px" mx="auto" lineHeight="1.6">
          Explore production-ready Aspire architectures. Each example includes
          an interactive diagram, complete AppHost code, and key concept breakdowns.
        </Text>
      </Box>

      {/* Service Type Legend */}
      <ServiceLegend />

      {/* Gallery Grid */}
      <SimpleGrid columns={{ base: 1, md: 2 }} gap="4">
        {galleryEntries.map((entry) => (
          <GalleryCard
            key={entry.id}
            entry={entry}
            onClick={() => setSelectedId(entry.id)}
          />
        ))}
      </SimpleGrid>

      {/* Footer */}
      <Box textAlign="center" mt="8">
        <Text fontSize="9px" color="dark.muted" {...pixelFontProps}>
          All architectures use Aspire for orchestration
        </Text>
        <Text fontSize="xs" color="dark.muted" mt="1">
          Click any card to explore the full architecture diagram and AppHost code
        </Text>
      </Box>
    </Box>
  );
}
