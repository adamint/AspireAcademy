import { useState, useCallback, useMemo } from 'react';
import {
  Box,
  Flex,
  Text,
  Button,
  Card,
  Heading,
  Input,
  IconButton,
  Badge,
} from '@chakra-ui/react';
import { retroCardProps, pixelFontProps } from '../theme/aspireTheme';
import {
  SiPostgresql,
  SiRedis,
  SiMongodb,
  SiRabbitmq,
  SiApachekafka,
} from 'react-icons/si';
import {
  TbDatabase,
  TbBox,
  TbCode,
  TbTrash,
  TbCopy,
  TbRefresh,
  TbPlus,
  TbLink,
  TbUnlink,
  TbPlayerPlay,
  TbPackage,
} from 'react-icons/tb';
import type { IconType } from 'react-icons';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism';

// ─── Types ────────────────────────────────────────────────────────────────────

type ResourceType =
  | 'postgres'
  | 'redis'
  | 'sqlserver'
  | 'mongodb'
  | 'rabbitmq'
  | 'kafka'
  | 'project'
  | 'container';

interface PlaygroundResource {
  id: string;
  type: ResourceType;
  name: string;
  databases: string[];
  image: string;
  references: string[];
  waitFor: string[];
  hasDataVolume: boolean;
  hasExternalEndpoints: boolean;
  ports: string;
}

interface ResourceTemplate {
  type: ResourceType;
  label: string;
  icon: IconType;
  color: string;
  defaultName: string;
  supportsDatabases: boolean;
  isContainer: boolean;
}

// ─── Resource templates ───────────────────────────────────────────────────────

const RESOURCE_TEMPLATES: ResourceTemplate[] = [
  { type: 'postgres', label: 'PostgreSQL', icon: SiPostgresql, color: '#336791', defaultName: 'postgres', supportsDatabases: true, isContainer: false },
  { type: 'redis', label: 'Redis', icon: SiRedis, color: '#DC382D', defaultName: 'cache', supportsDatabases: false, isContainer: false },
  { type: 'sqlserver', label: 'SQL Server', icon: TbDatabase, color: '#CC2927', defaultName: 'sqlserver', supportsDatabases: true, isContainer: false },
  { type: 'mongodb', label: 'MongoDB', icon: SiMongodb, color: '#47A248', defaultName: 'mongodb', supportsDatabases: true, isContainer: false },
  { type: 'rabbitmq', label: 'RabbitMQ', icon: SiRabbitmq, color: '#FF6600', defaultName: 'rabbitmq', supportsDatabases: false, isContainer: false },
  { type: 'kafka', label: 'Kafka', icon: SiApachekafka, color: '#231F20', defaultName: 'kafka', supportsDatabases: false, isContainer: false },
  { type: 'project', label: 'Project', icon: TbCode, color: '#6B4FBB', defaultName: 'myservice', supportsDatabases: false, isContainer: false },
  { type: 'container', label: 'Container', icon: TbBox, color: '#2496ED', defaultName: 'mycontainer', supportsDatabases: false, isContainer: true },
];

// ─── Pre-built examples ──────────────────────────────────────────────────────

interface Example {
  name: string;
  emoji: string;
  resources: PlaygroundResource[];
}

function makeId(): string {
  return `r-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function buildExamples(): Example[] {
  const ecomIds = { pg: makeId(), cache: makeId(), api: makeId(), web: makeId() };
  const ecommerce: Example = {
    name: 'E-Commerce',
    emoji: '🛒',
    resources: [
      { id: ecomIds.pg, type: 'postgres', name: 'postgres', databases: ['catalogdb'], image: '', references: [], waitFor: [], hasDataVolume: true, hasExternalEndpoints: false, ports: '' },
      { id: ecomIds.cache, type: 'redis', name: 'cache', databases: [], image: '', references: [], waitFor: [], hasDataVolume: false, hasExternalEndpoints: false, ports: '' },
      { id: ecomIds.api, type: 'project', name: 'api', databases: [], image: '', references: [ecomIds.pg, ecomIds.cache], waitFor: [ecomIds.pg, ecomIds.cache], hasDataVolume: false, hasExternalEndpoints: false, ports: '' },
      { id: ecomIds.web, type: 'project', name: 'web', databases: [], image: '', references: [ecomIds.api], waitFor: [ecomIds.api], hasDataVolume: false, hasExternalEndpoints: true, ports: '' },
    ],
  };

  const msIds = { pg: makeId(), mq: makeId(), orders: makeId(), inventory: makeId(), notifications: makeId(), gateway: makeId() };
  const microservices: Example = {
    name: 'Microservices',
    emoji: '🔗',
    resources: [
      { id: msIds.pg, type: 'postgres', name: 'postgres', databases: ['ordersdb', 'inventorydb'], image: '', references: [], waitFor: [], hasDataVolume: true, hasExternalEndpoints: false, ports: '' },
      { id: msIds.mq, type: 'rabbitmq', name: 'messaging', databases: [], image: '', references: [], waitFor: [], hasDataVolume: false, hasExternalEndpoints: false, ports: '' },
      { id: msIds.orders, type: 'project', name: 'orders-service', databases: [], image: '', references: [msIds.pg, msIds.mq], waitFor: [msIds.pg, msIds.mq], hasDataVolume: false, hasExternalEndpoints: false, ports: '' },
      { id: msIds.inventory, type: 'project', name: 'inventory-service', databases: [], image: '', references: [msIds.pg, msIds.mq], waitFor: [msIds.pg, msIds.mq], hasDataVolume: false, hasExternalEndpoints: false, ports: '' },
      { id: msIds.notifications, type: 'project', name: 'notification-service', databases: [], image: '', references: [msIds.mq], waitFor: [msIds.mq], hasDataVolume: false, hasExternalEndpoints: false, ports: '' },
      { id: msIds.gateway, type: 'project', name: 'gateway', databases: [], image: '', references: [msIds.orders, msIds.inventory, msIds.notifications], waitFor: [msIds.orders, msIds.inventory, msIds.notifications], hasDataVolume: false, hasExternalEndpoints: true, ports: '' },
    ],
  };

  const fsIds = { pg: makeId(), cache: makeId(), api: makeId(), frontend: makeId() };
  const fullstack: Example = {
    name: 'Full Stack',
    emoji: '🏗️',
    resources: [
      { id: fsIds.pg, type: 'postgres', name: 'postgres', databases: ['appdb'], image: '', references: [], waitFor: [], hasDataVolume: true, hasExternalEndpoints: false, ports: '' },
      { id: fsIds.cache, type: 'redis', name: 'cache', databases: [], image: '', references: [], waitFor: [], hasDataVolume: false, hasExternalEndpoints: false, ports: '' },
      { id: fsIds.api, type: 'project', name: 'api', databases: [], image: '', references: [fsIds.pg, fsIds.cache], waitFor: [fsIds.pg, fsIds.cache], hasDataVolume: false, hasExternalEndpoints: false, ports: '' },
      { id: fsIds.frontend, type: 'container', name: 'frontend', databases: [], image: 'node:20-slim', references: [fsIds.api], waitFor: [fsIds.api], hasDataVolume: false, hasExternalEndpoints: true, ports: '3000' },
    ],
  };

  return [ecommerce, microservices, fullstack];
}

// ─── Code generation ─────────────────────────────────────────────────────────

const ADD_METHOD: Record<ResourceType, string> = {
  postgres: 'AddPostgres',
  redis: 'AddRedis',
  sqlserver: 'AddSqlServer',
  mongodb: 'AddMongoDB',
  rabbitmq: 'AddRabbitMQ',
  kafka: 'AddKafka',
  project: 'AddProject',
  container: 'AddContainer',
};

function toVarName(name: string): string {
  return name
    .replace(/[^a-zA-Z0-9_]/g, '_')
    .replace(/^[0-9]/, '_$&')
    .replace(/_+/g, '_')
    .replace(/_$/, '') || 'resource';
}

function generateAppHostCode(resources: PlaygroundResource[]): string {
  if (resources.length === 0) {
    return `var builder = DistributedApplication.CreateBuilder(args);

// 👈 Add resources from the palette to get started!

builder.Build().Run();
`;
  }

  const idToVar = new Map<string, string>();
  const usedVars = new Set<string>();

  // Assign unique variable names
  for (const r of resources) {
    let v = toVarName(r.name);
    if (usedVars.has(v)) {
      let i = 2;
      while (usedVars.has(`${v}${i}`)) i++;
      v = `${v}${i}`;
    }
    usedVars.add(v);
    idToVar.set(r.id, v);
  }

  const lines: string[] = ['var builder = DistributedApplication.CreateBuilder(args);', ''];

  for (const r of resources) {
    const varName = idToVar.get(r.id)!;
    const method = ADD_METHOD[r.type];
    const parts: string[] = [];

    // Opening call
    if (r.type === 'container') {
      const img = r.image || 'myregistry/myimage';
      parts.push(`var ${varName} = builder.${method}("${r.name}", "${img}")`);
    } else {
      parts.push(`var ${varName} = builder.${method}("${r.name}")`);
    }

    // Data volume
    if (r.hasDataVolume && r.type !== 'project' && r.type !== 'container') {
      parts.push(`    .WithDataVolume("${r.name}-data")`);
    }

    // External endpoints
    if (r.hasExternalEndpoints) {
      if (r.type === 'project') {
        parts.push('    .WithExternalHttpEndpoints()');
      } else if (r.type === 'container' && r.ports) {
        parts.push(`    .WithHttpEndpoint(targetPort: ${r.ports})`);
      }
    }

    // References
    for (const refId of r.references) {
      const refResource = resources.find((x) => x.id === refId);
      if (!refResource) continue;
      const refVar = idToVar.get(refId)!;

      // If the referenced resource has databases, reference the first one
      if (refResource.databases.length > 0) {
        const dbVarName = toVarName(refResource.databases[0]);
        parts.push(`    .WithReference(${dbVarName})`);
      } else {
        parts.push(`    .WithReference(${refVar})`);
      }
    }

    // WaitFor
    for (const wfId of r.waitFor) {
      const wfVar = idToVar.get(wfId);
      if (wfVar) {
        parts.push(`    .WaitFor(${wfVar})`);
      }
    }

    // Close with semicolon
    lines.push(parts.join('\n') + ';');

    // Databases
    for (const db of r.databases) {
      const dbVar = toVarName(db);
      lines.push(`var ${dbVar} = ${varName}.AddDatabase("${db}");`);
    }

    lines.push('');
  }

  lines.push('builder.Build().Run();');
  return lines.join('\n');
}

// ─── Component ───────────────────────────────────────────────────────────────

export default function PlaygroundPage() {
  const [resources, setResources] = useState<PlaygroundResource[]>([]);
  const [connectingFrom, setConnectingFrom] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const examples = useMemo(() => buildExamples(), []);

  const generatedCode = useMemo(() => generateAppHostCode(resources), [resources]);

  const findTemplate = useCallback((type: ResourceType) =>
    RESOURCE_TEMPLATES.find((t) => t.type === type)!, []);

  const addResource = useCallback((type: ResourceType) => {
    const tmpl = RESOURCE_TEMPLATES.find((t) => t.type === type)!;
    let name = tmpl.defaultName;
    const existing = resources.filter((r) => r.type === type);
    if (existing.length > 0) {
      name = `${tmpl.defaultName}${existing.length + 1}`;
    }
    const newResource: PlaygroundResource = {
      id: makeId(),
      type,
      name,
      databases: [],
      image: type === 'container' ? 'myregistry/myimage' : '',
      references: [],
      waitFor: [],
      hasDataVolume: false,
      hasExternalEndpoints: false,
      ports: '',
    };
    setResources((prev) => [...prev, newResource]);
  }, [resources]);

  const updateResource = useCallback((id: string, updates: Partial<PlaygroundResource>) => {
    setResources((prev) => prev.map((r) => r.id === id ? { ...r, ...updates } : r));
  }, []);

  const removeResource = useCallback((id: string) => {
    setResources((prev) =>
      prev
        .filter((r) => r.id !== id)
        .map((r) => ({
          ...r,
          references: r.references.filter((ref) => ref !== id),
          waitFor: r.waitFor.filter((wf) => wf !== id),
        })),
    );
    if (connectingFrom === id) setConnectingFrom(null);
  }, [connectingFrom]);

  const toggleReference = useCallback((fromId: string, toId: string) => {
    setResources((prev) => prev.map((r) => {
      if (r.id !== fromId) return r;
      const hasRef = r.references.includes(toId);
      return {
        ...r,
        references: hasRef ? r.references.filter((x) => x !== toId) : [...r.references, toId],
        waitFor: hasRef ? r.waitFor.filter((x) => x !== toId) : [...r.waitFor, toId],
      };
    }));
  }, []);

  const addDatabase = useCallback((id: string) => {
    setResources((prev) => prev.map((r) => {
      if (r.id !== id) return r;
      const dbName = `db${r.databases.length + 1}`;
      return { ...r, databases: [...r.databases, dbName] };
    }));
  }, []);

  const removeDatabase = useCallback((id: string, dbIndex: number) => {
    setResources((prev) => prev.map((r) => {
      if (r.id !== id) return r;
      return { ...r, databases: r.databases.filter((_, i) => i !== dbIndex) };
    }));
  }, []);

  const updateDatabase = useCallback((id: string, dbIndex: number, value: string) => {
    setResources((prev) => prev.map((r) => {
      if (r.id !== id) return r;
      const dbs = [...r.databases];
      dbs[dbIndex] = value;
      return { ...r, databases: dbs };
    }));
  }, []);

  const copyCode = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(generatedCode);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback: select text
    }
  }, [generatedCode]);

  const reset = useCallback(() => {
    setResources([]);
    setConnectingFrom(null);
  }, []);

  const loadExample = useCallback((example: Example) => {
    setResources(example.resources.map((r) => ({ ...r })));
    setConnectingFrom(null);
  }, []);

  const handleConnect = useCallback((resourceId: string) => {
    if (connectingFrom === null) {
      setConnectingFrom(resourceId);
    } else if (connectingFrom === resourceId) {
      setConnectingFrom(null);
    } else {
      toggleReference(connectingFrom, resourceId);
      setConnectingFrom(null);
    }
  }, [connectingFrom, toggleReference]);

  const getResourceName = useCallback((id: string) => {
    return resources.find((r) => r.id === id)?.name ?? id;
  }, [resources]);

  return (
    <Box maxW="1400px" mx="auto" p="4" data-testid="playground-page">
      {/* Header */}
      <Flex justify="space-between" align="center" mb="4" flexWrap="wrap" gap="3">
        <Box>
          <Heading as="h1" size="xl" color="dark.text" display="flex" alignItems="center" gap="2">
            <Text as="span">🏗️</Text>
            <Text as="span" {...pixelFontProps} fontSize="lg">Architecture Playground</Text>
          </Heading>
          <Text color="dark.muted" fontSize="sm" mt="1">
            Design your Aspire app model and get generated AppHost code
          </Text>
        </Box>
        <Flex gap="2" flexWrap="wrap">
          {examples.map((ex) => (
            <Button
              key={ex.name}
              size="sm"
              variant="outline"
              colorPalette="purple"
              onClick={() => loadExample(ex)}
              data-testid={`example-${ex.name.toLowerCase().replace(/\s+/g, '-')}`}
            >
              {ex.emoji} {ex.name}
            </Button>
          ))}
          <Button
            size="sm"
            variant="outline"
            colorPalette="red"
            onClick={reset}
            data-testid="reset-btn"
          >
            <TbRefresh /> Reset
          </Button>
        </Flex>
      </Flex>

      <Flex gap="4" direction={{ base: 'column', lg: 'row' }}>
        {/* ── Left sidebar: Resource Palette ─────────────────────────────── */}
        <Box w={{ base: '100%', lg: '200px' }} flexShrink={0}>
          <Card.Root variant="outline" {...retroCardProps} bg="game.retroBg">
            <Card.Body p="3">
              <Text {...pixelFontProps} fontSize="2xs" color="aspire.300" mb="3">
                📦 Resources
              </Text>
              <Flex direction="column" gap="2">
                {RESOURCE_TEMPLATES.map((tmpl) => (
                  <Button
                    key={tmpl.type}
                    size="sm"
                    variant="outline"
                    colorPalette="purple"
                    justifyContent="flex-start"
                    onClick={() => addResource(tmpl.type)}
                    data-testid={`add-${tmpl.type}`}
                    css={{
                      transition: 'all 0.15s',
                      '&:hover': { transform: 'translateX(4px)' },
                    }}
                  >
                    <Box as={tmpl.icon} color={tmpl.color} />
                    <Text fontSize="xs">{tmpl.label}</Text>
                  </Button>
                ))}
              </Flex>
            </Card.Body>
          </Card.Root>
        </Box>

        {/* ── Center: Canvas ─────────────────────────────────────────────── */}
        <Box flex="1" minW="0">
          <Card.Root variant="outline" {...retroCardProps} bg="game.retroBg" minH="500px">
            <Card.Body p="4">
              <Flex justify="space-between" align="center" mb="3">
                <Text {...pixelFontProps} fontSize="2xs" color="aspire.300">
                  🎮 Canvas — {resources.length} resource{resources.length !== 1 ? 's' : ''}
                </Text>
                {connectingFrom && (
                  <Badge colorPalette="yellow" variant="solid" {...pixelFontProps} fontSize="2xs">
                    🔗 Click another resource to connect
                  </Badge>
                )}
              </Flex>

              {resources.length === 0 ? (
                <Flex
                  direction="column"
                  align="center"
                  justify="center"
                  minH="400px"
                  gap="3"
                  data-testid="canvas-empty"
                >
                  <Text fontSize="4xl">🎯</Text>
                  <Text {...pixelFontProps} fontSize="xs" color="dark.muted" textAlign="center">
                    Click a resource from the palette
                  </Text>
                  <Text fontSize="sm" color="dark.muted" textAlign="center">
                    or load an example to get started
                  </Text>
                </Flex>
              ) : (
                <Flex flexWrap="wrap" gap="3" data-testid="canvas-resources">
                  {resources.map((resource) => {
                    const tmpl = findTemplate(resource.type);
                    const isConnecting = connectingFrom === resource.id;
                    const isConnectTarget = connectingFrom !== null && connectingFrom !== resource.id;

                    return (
                      <Card.Root
                        key={resource.id}
                        variant="outline"
                        w={{ base: '100%', sm: '280px' }}
                        {...retroCardProps}
                        borderColor={
                          isConnecting
                            ? 'game.xpGold'
                            : isConnectTarget
                              ? 'aspire.600'
                              : 'game.pixelBorder'
                        }
                        css={isConnecting ? {
                          animation: 'pulse 1s ease-in-out infinite',
                          '@keyframes pulse': {
                            '0%, 100%': { boxShadow: '4px 4px 0 #FFD700' },
                            '50%': { boxShadow: '4px 4px 0 #FFD700, 0 0 12px rgba(255, 215, 0, 0.4)' },
                          },
                        } : isConnectTarget ? {
                          cursor: 'pointer',
                          '&:hover': { borderColor: '#FFD700', transform: 'scale(1.02)' },
                          transition: 'all 0.15s',
                        } : undefined}
                        onClick={isConnectTarget ? () => handleConnect(resource.id) : undefined}
                        data-testid={`resource-card-${resource.name}`}
                      >
                        <Card.Body p="3" display="flex" flexDirection="column" gap="2">
                          {/* Header */}
                          <Flex justify="space-between" align="center">
                            <Flex align="center" gap="2">
                              <Box as={tmpl.icon} color={tmpl.color} fontSize="lg" />
                              <Badge
                                colorPalette="purple"
                                variant="subtle"
                                fontSize="2xs"
                              >
                                {tmpl.label}
                              </Badge>
                            </Flex>
                            <Flex gap="1">
                              <IconButton
                                aria-label="Connect"
                                size="xs"
                                variant={isConnecting ? 'solid' : 'outline'}
                                colorPalette={isConnecting ? 'yellow' : 'purple'}
                                onClick={(e) => { e.stopPropagation(); handleConnect(resource.id); }}
                                data-testid={`connect-${resource.name}`}
                              >
                                {isConnecting ? <TbUnlink /> : <TbLink />}
                              </IconButton>
                              <IconButton
                                aria-label="Delete"
                                size="xs"
                                variant="outline"
                                colorPalette="red"
                                onClick={(e) => { e.stopPropagation(); removeResource(resource.id); }}
                                data-testid={`delete-${resource.name}`}
                              >
                                <TbTrash />
                              </IconButton>
                            </Flex>
                          </Flex>

                          {/* Name input */}
                          <Input
                            size="sm"
                            value={resource.name}
                            onChange={(e) => updateResource(resource.id, { name: e.target.value })}
                            placeholder="Resource name"
                            onClick={(e) => e.stopPropagation()}
                            data-testid={`name-input-${resource.name}`}
                            css={{
                              fontFamily: '"Press Start 2P", monospace',
                              fontSize: '10px',
                            }}
                          />

                          {/* Container image */}
                          {resource.type === 'container' && (
                            <Input
                              size="sm"
                              value={resource.image}
                              onChange={(e) => updateResource(resource.id, { image: e.target.value })}
                              placeholder="Image (e.g. nginx:latest)"
                              onClick={(e) => e.stopPropagation()}
                              data-testid={`image-input-${resource.name}`}
                            />
                          )}

                          {/* Container ports */}
                          {resource.type === 'container' && (
                            <Input
                              size="sm"
                              value={resource.ports}
                              onChange={(e) => updateResource(resource.id, { ports: e.target.value })}
                              placeholder="Port (e.g. 8080)"
                              onClick={(e) => e.stopPropagation()}
                              data-testid={`port-input-${resource.name}`}
                            />
                          )}

                          {/* Options */}
                          <Flex gap="2" flexWrap="wrap">
                            {resource.type !== 'project' && resource.type !== 'container' && (
                              <Button
                                size="xs"
                                variant={resource.hasDataVolume ? 'solid' : 'outline'}
                                colorPalette={resource.hasDataVolume ? 'green' : 'gray'}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  updateResource(resource.id, { hasDataVolume: !resource.hasDataVolume });
                                }}
                                data-testid={`volume-${resource.name}`}
                              >
                                <TbPackage /> Volume
                              </Button>
                            )}
                            {(resource.type === 'project' || resource.type === 'container') && (
                              <Button
                                size="xs"
                                variant={resource.hasExternalEndpoints ? 'solid' : 'outline'}
                                colorPalette={resource.hasExternalEndpoints ? 'green' : 'gray'}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  updateResource(resource.id, { hasExternalEndpoints: !resource.hasExternalEndpoints });
                                }}
                                data-testid={`external-${resource.name}`}
                              >
                                <TbPlayerPlay /> External
                              </Button>
                            )}
                          </Flex>

                          {/* Databases */}
                          {tmpl.supportsDatabases && (
                            <Box>
                              <Flex justify="space-between" align="center" mb="1">
                                <Text fontSize="xs" color="dark.muted">Databases</Text>
                                <Button
                                  size="xs"
                                  variant="outline"
                                  colorPalette="purple"
                                  onClick={(e) => { e.stopPropagation(); addDatabase(resource.id); }}
                                  data-testid={`add-db-${resource.name}`}
                                >
                                  <TbPlus /> Add DB
                                </Button>
                              </Flex>
                              {resource.databases.map((db, idx) => (
                                <Flex key={idx} gap="1" mb="1" align="center">
                                  <Text fontSize="xs" color="aspire.400">💾</Text>
                                  <Input
                                    size="xs"
                                    value={db}
                                    onChange={(e) => { e.stopPropagation(); updateDatabase(resource.id, idx, e.target.value); }}
                                    onClick={(e) => e.stopPropagation()}
                                    flex="1"
                                    data-testid={`db-input-${resource.name}-${idx}`}
                                  />
                                  <IconButton
                                    aria-label="Remove database"
                                    size="xs"
                                    variant="ghost"
                                    colorPalette="red"
                                    onClick={(e) => { e.stopPropagation(); removeDatabase(resource.id, idx); }}
                                  >
                                    <TbTrash />
                                  </IconButton>
                                </Flex>
                              ))}
                            </Box>
                          )}

                          {/* References */}
                          {resource.references.length > 0 && (
                            <Box>
                              <Text fontSize="xs" color="dark.muted" mb="1">References</Text>
                              <Flex gap="1" flexWrap="wrap">
                                {resource.references.map((refId) => (
                                  <Badge
                                    key={refId}
                                    colorPalette="purple"
                                    variant="subtle"
                                    fontSize="2xs"
                                    cursor="pointer"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      toggleReference(resource.id, refId);
                                    }}
                                    data-testid={`ref-badge-${resource.name}-${getResourceName(refId)}`}
                                  >
                                    🔗 {getResourceName(refId)} ✕
                                  </Badge>
                                ))}
                              </Flex>
                            </Box>
                          )}
                        </Card.Body>
                      </Card.Root>
                    );
                  })}
                </Flex>
              )}
            </Card.Body>
          </Card.Root>
        </Box>

        {/* ── Right panel: Generated Code ────────────────────────────────── */}
        <Box w={{ base: '100%', lg: '380px' }} flexShrink={0}>
          <Card.Root variant="outline" {...retroCardProps} bg="game.retroBg" position="sticky" top="4">
            <Card.Body p="3">
              <Flex justify="space-between" align="center" mb="3">
                <Text {...pixelFontProps} fontSize="2xs" color="aspire.300">
                  💻 AppHost Code
                </Text>
                <Button
                  size="xs"
                  variant="outline"
                  colorPalette={copied ? 'green' : 'purple'}
                  onClick={copyCode}
                  data-testid="copy-code-btn"
                >
                  <TbCopy /> {copied ? 'Copied!' : 'Copy'}
                </Button>
              </Flex>
              <Box
                borderRadius="sm"
                overflow="auto"
                maxH="600px"
                css={{
                  '& pre': { margin: 0, borderRadius: '4px', fontSize: '12px !important' },
                }}
                data-testid="generated-code"
              >
                <SyntaxHighlighter
                  language="csharp"
                  style={vscDarkPlus}
                  customStyle={{
                    background: '#0D0B1A',
                    padding: '12px',
                    borderRadius: '4px',
                    fontSize: '12px',
                    lineHeight: '1.5',
                  }}
                  showLineNumbers
                >
                  {generatedCode}
                </SyntaxHighlighter>
              </Box>
            </Card.Body>
          </Card.Root>
        </Box>
      </Flex>
    </Box>
  );
}
