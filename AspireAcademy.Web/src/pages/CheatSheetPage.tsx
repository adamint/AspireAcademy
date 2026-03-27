import { useMemo, useState, useCallback, useEffect, useRef } from 'react';
import { Box, Flex, Text, VStack, Input, Badge, IconButton } from '@chakra-ui/react';
import { retroCardProps, pixelFontProps } from '../theme/aspireTheme';

// ── Data ────────────────────────────────────────────────────────────────────

interface ApiEntry {
  method: string;
  signature: string;
  description: string;
}

interface ApiCategory {
  title: string;
  emoji: string;
  entries: ApiEntry[];
}

const categories: ApiCategory[] = [
  {
    title: 'Resource Builders',
    emoji: '🧱',
    entries: [
      { method: 'AddPostgres', signature: 'builder.AddPostgres("name", password?, port?)', description: 'Adds PostgreSQL server' },
      { method: 'AddRedis', signature: 'builder.AddRedis("name", port?)', description: 'Adds Redis cache' },
      { method: 'AddSqlServer', signature: 'builder.AddSqlServer("name", password?, port?)', description: 'Adds SQL Server' },
      { method: 'AddMongoDB', signature: 'builder.AddMongoDB("name", port?)', description: 'Adds MongoDB server' },
      { method: 'AddRabbitMQ', signature: 'builder.AddRabbitMQ("name", userName?, password?)', description: 'Adds RabbitMQ broker' },
      { method: 'AddKafka', signature: 'builder.AddKafka("name", port?)', description: 'Adds Kafka broker' },
      { method: 'AddContainer', signature: 'builder.AddContainer("name", "image")', description: 'Adds a container resource' },
      { method: 'AddDockerfile', signature: 'builder.AddDockerfile("name", "contextPath")', description: 'Builds and adds a Dockerfile' },
      { method: 'AddProject', signature: 'builder.AddProject<T>("name")', description: 'Adds a .NET project' },
      { method: 'AddExecutable', signature: 'builder.AddExecutable("name", "command", "workingDir")', description: 'Adds an executable' },
      { method: 'AddNodeApp', signature: 'builder.AddNodeApp("name", "dir", "script")', description: 'Adds a Node.js app' },
      { method: 'AddViteApp', signature: 'builder.AddViteApp("name", "dir")', description: 'Adds a Vite dev server' },
      { method: 'AddPythonApp', signature: 'builder.AddPythonApp("name", "dir", "script")', description: 'Adds a Python app' },
      { method: 'AddParameter', signature: 'builder.AddParameter("name", secret: true)', description: 'Adds a config parameter' },
      { method: 'AddConnectionString', signature: 'builder.AddConnectionString("name")', description: 'Adds external connection' },
    ],
  },
  {
    title: 'Fluent Configuration',
    emoji: '🔗',
    entries: [
      { method: '.WithReference(resource)', signature: '.WithReference(resource)', description: 'Connect to another resource (service discovery)' },
      { method: '.WaitFor(resource)', signature: '.WaitFor(resource)', description: 'Wait for dependency before starting' },
      { method: '.WithEnvironment("KEY", "value")', signature: '.WithEnvironment("KEY", "value")', description: 'Set environment variable' },
      { method: '.WithHttpEndpoint(port: 5000)', signature: '.WithHttpEndpoint(port: 5000)', description: 'Expose HTTP endpoint' },
      { method: '.WithHttpsEndpoint(port: 5001)', signature: '.WithHttpsEndpoint(port: 5001)', description: 'Expose HTTPS endpoint' },
      { method: '.WithExternalHttpEndpoints()', signature: '.WithExternalHttpEndpoints()', description: 'Make endpoints externally accessible' },
      { method: '.WithArgs("--flag", "value")', signature: '.WithArgs("--flag", "value")', description: 'Pass command-line arguments' },
      { method: '.WithDataVolume("name")', signature: '.WithDataVolume("name")', description: 'Add persistent data volume' },
      { method: '.WithBindMount("source", "target")', signature: '.WithBindMount("source", "target")', description: 'Mount host directory' },
      { method: '.WithContainerRuntimeArgs("--gpus=all")', signature: '.WithContainerRuntimeArgs("--gpus=all")', description: 'Pass container runtime args' },
    ],
  },
  {
    title: 'Database Helpers',
    emoji: '🗄️',
    entries: [
      { method: 'postgres.AddDatabase("name")', signature: 'postgres.AddDatabase("name")', description: 'Add database on PostgreSQL' },
      { method: 'sqlServer.AddDatabase("name")', signature: 'sqlServer.AddDatabase("name")', description: 'Add database on SQL Server' },
      { method: 'mongo.AddDatabase("name")', signature: 'mongo.AddDatabase("name")', description: 'Add database on MongoDB' },
    ],
  },
  {
    title: 'Management UIs',
    emoji: '🖥️',
    entries: [
      { method: '.WithPgAdmin()', signature: '.WithPgAdmin()', description: 'Add PgAdmin for PostgreSQL' },
      { method: '.WithRedisCommander()', signature: '.WithRedisCommander()', description: 'Add Redis Commander' },
      { method: '.WithMongoExpress()', signature: '.WithMongoExpress()', description: 'Add Mongo Express' },
      { method: '.WithKafkaUI()', signature: '.WithKafkaUI()', description: 'Add Kafka UI' },
      { method: '.WithManagementPlugin()', signature: '.WithManagementPlugin()', description: 'Add RabbitMQ management' },
    ],
  },
  {
    title: 'Deployment',
    emoji: '🚀',
    entries: [
      { method: '.PublishAsDockerFile()', signature: '.PublishAsDockerFile()', description: 'Publish as Dockerfile' },
      { method: '.PublishAsKubernetesService(configure)', signature: '.PublishAsKubernetesService(configure)', description: 'Publish to Kubernetes' },
    ],
  },
];

// ── Helpers ──────────────────────────────────────────────────────────────────

function copyToClipboard(text: string): void {
  navigator.clipboard.writeText(text).catch(() => {
    // Fallback for older browsers
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

// ── Components ──────────────────────────────────────────────────────────────

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = useCallback(() => {
    copyToClipboard(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }, [text]);

  return (
    <IconButton
      aria-label="Copy snippet"
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

function ApiCard({ entry }: { entry: ApiEntry }) {
  return (
    <Box {...retroCardProps} p={3} bg="dark.card">
      <Flex justify="space-between" align="flex-start" gap={2}>
        <Box flex={1} minW={0}>
          <Text fontFamily="mono" fontWeight="bold" fontSize="sm" color="aspire.400" mb={1}>
            {entry.method}
          </Text>
          <Box
            bg="aspire.50"
            px={2}
            py={1}
            borderRadius="sm"
            mb={2}
            overflowX="auto"
          >
            <Text fontFamily="mono" fontSize="xs" color="aspire.300" whiteSpace="nowrap">
              {entry.signature}
            </Text>
          </Box>
          <Text fontSize="sm" color="dark.text">
            {entry.description}
          </Text>
        </Box>
        <CopyButton text={entry.signature} />
      </Flex>
    </Box>
  );
}

function CategorySection({
  category,
  isOpen,
  onToggle,
}: {
  category: ApiCategory;
  isOpen: boolean;
  onToggle: () => void;
}) {
  return (
    <Box>
      <Flex
        as="button"
        onClick={onToggle}
        align="center"
        gap={2}
        w="100%"
        cursor="pointer"
        p={3}
        bg={isOpen ? 'aspire.50' : 'transparent'}
        borderRadius="sm"
        _hover={{ bg: 'content.hover' }}
        transition="background 0.15s"
      >
        <Text fontSize="lg">{category.emoji}</Text>
        <Text {...pixelFontProps} fontSize="xs" flex={1} textAlign="left">
          {category.title}
        </Text>
        <Badge colorPalette="purple" variant="solid" {...pixelFontProps} fontSize="7px">
          {category.entries.length}
        </Badge>
        <Text fontSize="sm" color="dark.muted" ml={1}>
          {isOpen ? '▼' : '▶'}
        </Text>
      </Flex>

      {isOpen && (
        <VStack gap={2} align="stretch" pl={2} pt={2}>
          {category.entries.map((entry) => (
            <ApiCard key={entry.method} entry={entry} />
          ))}
        </VStack>
      )}
    </Box>
  );
}

// ── Page ─────────────────────────────────────────────────────────────────────

export default function CheatSheetPage() {
  const [search, setSearch] = useState('');
  const [openSections, setOpenSections] = useState<Set<string>>(
    () => new Set(categories.map((c) => c.title)),
  );
  const searchRef = useRef<HTMLInputElement>(null);

  // Ctrl+K / Cmd+K focuses the search input
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        searchRef.current?.focus();
      }
    }
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const toggleSection = useCallback((title: string) => {
    setOpenSections((prev) => {
      const next = new Set(prev);
      if (next.has(title)) {
        next.delete(title);
      } else {
        next.add(title);
      }
      return next;
    });
  }, []);

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim();
    if (!q) {
      return categories;
    }
    return categories
      .map((cat) => ({
        ...cat,
        entries: cat.entries.filter(
          (e) =>
            e.method.toLowerCase().includes(q) ||
            e.description.toLowerCase().includes(q) ||
            e.signature.toLowerCase().includes(q),
        ),
      }))
      .filter((cat) => cat.entries.length > 0);
  }, [search]);

  const totalResults = filtered.reduce((sum, c) => sum + c.entries.length, 0);

  return (
    <VStack maxW="900px" mx="auto" p={6} gap={5} align="stretch">
      {/* Header */}
      <Box>
        <Text {...pixelFontProps} fontSize="xl" fontWeight="bold">
          📖 Aspire API Cheat Sheet
        </Text>
        <Text color="dark.muted" fontSize="sm" mt={1}>
          Quick reference for all Aspire AppHost APIs — search, browse, and copy.
        </Text>
      </Box>

      {/* Search */}
      <Box {...retroCardProps} p={3} bg="dark.card">
        <Flex align="center" gap={2}>
          <Text fontSize="lg" flexShrink={0}>🔍</Text>
          <Input
            ref={searchRef}
            placeholder="Search APIs… (Ctrl+K)"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            variant="flushed"
            fontFamily="mono"
            fontSize="sm"
            borderColor="aspire.200"
            _focus={{ borderColor: 'aspire.600', boxShadow: '0 1px 0 0 var(--chakra-colors-aspire-600)' }}
          />
          {search && (
            <Badge colorPalette="purple" variant="subtle" {...pixelFontProps} fontSize="7px" flexShrink={0}>
              {totalResults} result{totalResults !== 1 ? 's' : ''}
            </Badge>
          )}
        </Flex>
      </Box>

      {/* Categories */}
      {filtered.length === 0 ? (
        <Box textAlign="center" py={12}>
          <Text {...pixelFontProps} fontSize="sm">
            No APIs match "{search}"
          </Text>
          <Text fontSize="sm" color="dark.muted" mt={2}>
            Try a different search term
          </Text>
        </Box>
      ) : (
        <VStack gap={4} align="stretch">
          {filtered.map((cat) => (
            <CategorySection
              key={cat.title}
              category={cat}
              isOpen={openSections.has(cat.title)}
              onToggle={() => toggleSection(cat.title)}
            />
          ))}
        </VStack>
      )}

      {/* Footer hint */}
      <Box textAlign="center" pt={2}>
        <Text {...pixelFontProps} fontSize="7px" color="dark.muted">
          ⌨️ Press Ctrl+K to quick-find • 📋 Click copy on any snippet
        </Text>
      </Box>
    </VStack>
  );
}
