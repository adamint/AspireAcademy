import { useState, useCallback, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
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
  Input,
} from '@chakra-ui/react';
import { retroCardProps, pixelFontProps } from '../theme/aspireTheme';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism';
import api from '../services/apiClient';
import ArchitectureDiagram from '../components/common/ArchitectureDiagram';
import { serviceTypeColors } from '../components/common/architectureDiagramTypes';
import type { ServiceNode, DiagramConnection } from '../components/common/architectureDiagramTypes';

// ─── Concept Map Types (for "Learn this" links) ───────────────────────────────

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
  layers: Record<string, { label: string; color: string }>;
  concepts: ConceptNode[];
}

// ─── Playground Types (for bridge) ────────────────────────────────────────────

type ResourceType =
  | 'postgres'
  | 'redis'
  | 'sqlserver'
  | 'mongodb'
  | 'rabbitmq'
  | 'kafka'
  | 'project'
  | 'container'
  | 'npmapp'
  | 'pythonapp'
  | 'azurestorage'
  | 'keyvault'
  | 'parameter';

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
  envVars: { key: string; value: string }[];
  isPersistent: boolean;
  isSecret: boolean;
  args: string;
  scriptPath: string;
  projectPath: string;
  projectLanguage: 'csharp' | 'typescript';
}

const PLAYGROUND_STORAGE_KEY = 'aspire-playground-resources';

// ─── Gallery Types ─────────────────────────────────────────────────────────────

interface KeyPattern {
  name: string;
  description: string;
}

interface GalleryExplanation {
  overview: string;
  whyAspire: string;
  keyPatterns: KeyPattern[];
  scalingNotes: string;
}

interface GalleryEntry {
  id: string;
  title: string;
  category: string;
  difficulty: 'beginner' | 'intermediate' | 'advanced';
  description: string;
  services: ServiceNode[];
  connections: DiagramConnection[];
  code: string;
  concepts: string[];
  tryPrompt: string;
  explanation: GalleryExplanation;
}

const CATEGORIES = [
  { label: 'All', value: 'all', icon: '🏛️' },
  { label: 'Web & Commerce', value: 'Web & Commerce', icon: '🌐' },
  { label: 'AI & Intelligence', value: 'AI & Intelligence', icon: '🤖' },
  { label: 'Data & Streaming', value: 'Data & Streaming', icon: '📊' },
  { label: 'Event-Driven', value: 'Event-Driven', icon: '⚡' },
  { label: 'Enterprise', value: 'Enterprise', icon: '🏢' },
];

const difficultyConfig = {
  beginner: { label: 'Beginner', color: '#22c55e', bg: 'rgba(34, 197, 94, 0.15)' },
  intermediate: { label: 'Intermediate', color: '#f59e0b', bg: 'rgba(245, 158, 11, 0.15)' },
  advanced: { label: 'Advanced', color: '#ef4444', bg: 'rgba(239, 68, 68, 0.15)' },
} as const;

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



// ─── Project File Generation ───────────────────────────────────────────────────

interface ProjectFile {
  path: string;
  content: string;
  language: string;
}

function toVarName(name: string): string {
  return name.replace(/\n/g, '').replace(/\s+/g, '').replace(/[^a-zA-Z0-9]/g, '');
}

function buildProjectFiles(entry: GalleryEntry): ProjectFile[] {
  const files: ProjectFile[] = [];

  // AppHost/Program.cs
  files.push({ path: 'AppHost/Program.cs', content: entry.code, language: 'csharp' });

  // AppHost .csproj
  const projectRefs = entry.services
    .filter((s) => s.type === 'api' || s.type === 'worker' || s.type === 'frontend')
    .map((s) => {
      const name = toVarName(s.name);
      return `    <ProjectReference Include="..\\${name}\\${name}.csproj" />`;
    });
  files.push({
    path: 'AppHost/AppHost.csproj',
    content: `<Project Sdk="Microsoft.NET.Sdk">

  <Sdk Name="Aspire.AppHost.Sdk" Version="9.1.0" />

  <PropertyGroup>
    <OutputType>Exe</OutputType>
    <TargetFramework>net9.0</TargetFramework>
    <ImplicitUsings>enable</ImplicitUsings>
    <Nullable>enable</Nullable>
  </PropertyGroup>

  <ItemGroup>
${projectRefs.join('\n')}
  </ItemGroup>

</Project>`,
    language: 'xml',
  });

  // ServiceDefaults
  files.push({
    path: 'ServiceDefaults/Extensions.cs',
    content: `using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Diagnostics.HealthChecks;
using OpenTelemetry;
using OpenTelemetry.Metrics;
using OpenTelemetry.Trace;

namespace ServiceDefaults;

public static class Extensions
{
    public static IHostApplicationBuilder AddServiceDefaults(
        this IHostApplicationBuilder builder)
    {
        builder.ConfigureOpenTelemetry();
        builder.AddDefaultHealthChecks();

        builder.Services.AddServiceDiscovery();
        builder.Services.ConfigureHttpClientDefaults(http =>
        {
            http.AddStandardResilienceHandler();
            http.AddServiceDiscovery();
        });

        return builder;
    }

    public static IHostApplicationBuilder ConfigureOpenTelemetry(
        this IHostApplicationBuilder builder)
    {
        builder.Logging.AddOpenTelemetry(logging =>
        {
            logging.IncludeFormattedMessage = true;
            logging.IncludeScopes = true;
        });

        builder.Services.AddOpenTelemetry()
            .WithMetrics(metrics => metrics
                .AddAspNetCoreInstrumentation()
                .AddHttpClientInstrumentation()
                .AddRuntimeInstrumentation())
            .WithTracing(tracing => tracing
                .AddAspNetCoreInstrumentation()
                .AddHttpClientInstrumentation());

        builder.AddOpenTelemetryExporters();
        return builder;
    }

    // ... additional helper methods
}`,
    language: 'csharp',
  });

  files.push({
    path: 'ServiceDefaults/ServiceDefaults.csproj',
    content: `<Project Sdk="Microsoft.NET.Sdk">

  <PropertyGroup>
    <TargetFramework>net9.0</TargetFramework>
    <ImplicitUsings>enable</ImplicitUsings>
    <Nullable>enable</Nullable>
    <IsAspireSharedProject>true</IsAspireSharedProject>
  </PropertyGroup>

  <ItemGroup>
    <FrameworkReference Include="Microsoft.AspNetCore.App" />
    <PackageReference Include="Microsoft.Extensions.Http.Resilience" Version="9.1.0" />
    <PackageReference Include="Microsoft.Extensions.ServiceDiscovery" Version="9.1.0" />
    <PackageReference Include="OpenTelemetry.Exporter.OpenTelemetryProtocol" Version="1.10.0" />
    <PackageReference Include="OpenTelemetry.Extensions.Hosting" Version="1.10.0" />
    <PackageReference Include="OpenTelemetry.Instrumentation.AspNetCore" Version="1.10.0" />
    <PackageReference Include="OpenTelemetry.Instrumentation.Http" Version="1.10.0" />
    <PackageReference Include="OpenTelemetry.Instrumentation.Runtime" Version="1.10.0" />
  </ItemGroup>

</Project>`,
    language: 'xml',
  });

  // Per-service files
  for (const svc of entry.services) {
    if (svc.type === 'database' || svc.type === 'cache' || svc.type === 'messaging') continue;

    const name = toVarName(svc.name);
    const incoming = entry.connections
      .filter((c) => c.to === svc.id)
      .map((c) => entry.services.find((s) => s.id === c.from)?.name.replace(/\n/g, ' ') ?? c.from);
    const outgoing = entry.connections
      .filter((c) => c.from === svc.id)
      .map((c) => entry.services.find((s) => s.id === c.to)?.name.replace(/\n/g, ' ') ?? c.to);

    // Check if it's a Node.js/npm project (heuristic from code)
    const isNpm = entry.code.includes('AddNpmApp') && entry.code.toLowerCase().includes(svc.id);

    if (isNpm) {
      files.push({
        path: `${name}/package.json`,
        content: JSON.stringify({
          name: name.toLowerCase(),
          version: '1.0.0',
          type: 'module',
          scripts: { dev: 'vite', build: 'vite build', start: 'node dist/index.js' },
          dependencies: { react: '^19.0.0', 'react-dom': '^19.0.0' },
          devDependencies: { vite: '^6.0.0', '@vitejs/plugin-react': '^4.0.0', typescript: '^5.7.0' },
        }, null, 2),
        language: 'json',
      });
      files.push({
        path: `${name}/src/App.tsx`,
        content: `import { useEffect, useState } from 'react';

export default function App() {
  const [data, setData] = useState(null);

  useEffect(() => {
    fetch('/api/health')
      .then((r) => r.json())
      .then(setData);
  }, []);

  return (
    <div>
      <h1>${svc.name.replace(/\n/g, ' ')}</h1>
      <pre>{JSON.stringify(data, null, 2)}</pre>
    </div>
  );
}`,
        language: 'typescriptreact',
      });
    } else if (svc.type === 'worker') {
      const aspirePackages = getAspirePackages(svc, entry);
      files.push({
        path: `${name}/Program.cs`,
        content: `var builder = Host.CreateApplicationBuilder(args);

builder.AddServiceDefaults();
${aspirePackages.services.length > 0 ? '\n' + aspirePackages.services.join('\n') + '\n' : ''}
builder.Services.AddHostedService<${name}Worker>();

var host = builder.Build();
host.Run();

// Background worker${incoming.length > 0 ? `\n// Consumes from: ${incoming.join(', ')}` : ''}${outgoing.length > 0 ? `\n// Produces to: ${outgoing.join(', ')}` : ''}
public class ${name}Worker(ILogger<${name}Worker> logger) : BackgroundService
{
    protected override async Task ExecuteAsync(CancellationToken ct)
    {
        while (!ct.IsCancellationRequested)
        {
            logger.LogInformation("${name} processing at {Time}", DateTimeOffset.Now);
            await Task.Delay(5000, ct);
        }
    }
}`,
        language: 'csharp',
      });
    } else {
      // API or frontend .NET service
      const aspirePackages = getAspirePackages(svc, entry);
      files.push({
        path: `${name}/Program.cs`,
        content: `var builder = WebApplication.CreateBuilder(args);

builder.AddServiceDefaults();
${aspirePackages.services.length > 0 ? '\n' + aspirePackages.services.join('\n') + '\n' : ''}
var app = builder.Build();

app.MapDefaultEndpoints();
${incoming.length > 0 ? `\n// Receives requests from: ${incoming.join(', ')}` : ''}${outgoing.length > 0 ? `\n// Depends on: ${outgoing.join(', ')}` : ''}

app.MapGet("/", () => Results.Json(new { service = "${name}", status = "running" }));

app.Run();`,
        language: 'csharp',
      });
    }
  }

  return files;
}

function getAspirePackages(svc: ServiceNode, entry: GalleryEntry): { services: string[] } {
  const services: string[] = [];
  const outRefs = entry.connections
    .filter((c) => c.from === svc.id)
    .map((c) => entry.services.find((s) => s.id === c.to))
    .filter((s): s is ServiceNode => s !== undefined);

  for (const ref of outRefs) {
    switch (ref.type) {
      case 'database':
        if (ref.name.toLowerCase().includes('mongo')) {
          services.push(`builder.AddMongoDBClient("${ref.id}");`);
        } else {
          services.push(`builder.AddNpgsqlDataSource("${ref.id}");`);
        }
        break;
      case 'cache':
        services.push(`builder.AddRedisDistributedCache("${ref.id}");`);
        break;
      case 'messaging':
        if (ref.name.toLowerCase().includes('kafka')) {
          services.push(`builder.AddKafkaProducer<string, string>("${ref.id}");`);
        } else {
          services.push(`builder.AddRabbitMQClient("${ref.id}");`);
        }
        break;
    }
  }

  return { services };
}

// ─── File Browser Component ────────────────────────────────────────────────────

function FileBrowser({ files }: { files: ProjectFile[] }) {
  const [selectedPath, setSelectedPath] = useState<string>(files[0]?.path ?? '');

  const selectedFile = files.find((f) => f.path === selectedPath);

  // Build tree structure from flat file list
  const tree = useMemo(() => {
    const folders = new Map<string, string[]>();
    for (const f of files) {
      const parts = f.path.split('/');
      const folder = parts.length > 1 ? parts.slice(0, -1).join('/') : '';
      if (!folders.has(folder)) folders.set(folder, []);
      folders.get(folder)!.push(f.path);
    }
    return folders;
  }, [files]);

  return (
    <Flex direction={{ base: 'column', md: 'row' }} gap="4" minH="400px">
      {/* File tree */}
      <Box
        w={{ base: '100%', md: '220px' }}
        flexShrink={0}
        bg="dark.surface"
        borderRadius="sm"
        border="1px solid"
        borderColor="dark.border"
        overflow="auto"
        maxH="600px"
        p="2"
      >
        <Text fontSize="8px" color="dark.muted" {...pixelFontProps} mb="2" px="1">
          📁 Project Structure
        </Text>
        {Array.from(tree.entries()).map(([folder, paths]) => (
          <Box key={folder} mb="2">
            {folder && (
              <Text
                fontSize="9px"
                color="aspire.400"
                fontWeight="bold"
                px="1"
                mb="1"
                {...pixelFontProps}
              >
                📂 {folder}/
              </Text>
            )}
            {paths.map((path) => {
              const fileName = path.split('/').pop()!;
              const isSelected = path === selectedPath;
              return (
                <Box
                  key={path}
                  px="2"
                  py="1.5"
                  ml={folder ? '3' : '0'}
                  cursor="pointer"
                  borderRadius="sm"
                  bg={isSelected ? 'aspire.200' : 'transparent'}
                  color={isSelected ? 'aspire.400' : 'dark.muted'}
                  _hover={{ bg: isSelected ? 'aspire.200' : 'dark.card' }}
                  role="button"
                  tabIndex={0}
                  onClick={() => setSelectedPath(path)}
                  onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setSelectedPath(path); } }}
                  transition="all 0.1s"
                >
                  <Text fontSize="10px" fontFamily="mono">
                    {getFileIcon(fileName)} {fileName}
                  </Text>
                </Box>
              );
            })}
          </Box>
        ))}
      </Box>

      {/* File content */}
      <Box flex="1" minW="0">
        {selectedFile ? (
          <Box>
            <Flex justify="space-between" align="center" mb="2">
              <Text fontSize="10px" color="dark.muted" fontFamily="mono">
                {selectedFile.path}
              </Text>
              <CopyButton text={selectedFile.content} />
            </Flex>
            <Box
              borderRadius="sm"
              overflow="auto"
              maxH="550px"
              border="1px solid"
              borderColor="dark.border"
              css={{
                '& pre': {
                  margin: '0 !important',
                  borderRadius: '4px !important',
                  fontSize: '12px !important',
                  lineHeight: '1.5 !important',
                },
              }}
            >
              <SyntaxHighlighter
                language={selectedFile.language === 'typescriptreact' ? 'tsx' : selectedFile.language}
                style={vscDarkPlus}
                customStyle={{
                  background: '#0D0B1A',
                  padding: '16px',
                  borderRadius: '4px',
                }}
                showLineNumbers
              >
                {selectedFile.content}
              </SyntaxHighlighter>
            </Box>
          </Box>
        ) : (
          <Flex align="center" justify="center" h="100%" color="dark.muted">
            <Text fontSize="sm">Select a file to view</Text>
          </Flex>
        )}
      </Box>
    </Flex>
  );
}

function getFileIcon(fileName: string): string {
  if (fileName.endsWith('.cs')) return '🟣';
  if (fileName.endsWith('.csproj') || fileName.endsWith('.xml')) return '📋';
  if (fileName.endsWith('.json')) return '📦';
  if (fileName.endsWith('.ts') || fileName.endsWith('.tsx')) return '🔷';
  if (fileName.endsWith('.py')) return '🐍';
  if (fileName.endsWith('.sln')) return '🗂️';
  if (fileName.endsWith('.txt')) return '📝';
  return '📄';
}

// ─── Gallery Card Component ───────────────────────────────────────────────────

function DifficultyBadge({ difficulty }: { difficulty: GalleryEntry['difficulty'] }) {
  const config = difficultyConfig[difficulty];
  return (
    <Badge
      fontSize="2xs"
      bg={config.bg}
      color={config.color}
      px="2"
      py="0.5"
      {...pixelFontProps}
      borderRadius="sm"
    >
      {config.label}
    </Badge>
  );
}

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
      role="button"
      tabIndex={0}
      onClick={onClick}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onClick(); } }}
      transition="all 0.2s"
      _hover={{
        transform: 'translateY(-4px)',
        boxShadow: '4px 4px 0 #6B4FBB, 0 0 20px rgba(107, 79, 187, 0.3)',
      }}
    >
      <Card.Body p="4" gap="3">
        {/* Title row with difficulty badge */}
        <Flex justify="space-between" align="flex-start" gap="2">
          <Heading size="sm" color="dark.text" {...pixelFontProps} lineHeight="1.4" flex="1">
            {entry.title}
          </Heading>
          <DifficultyBadge difficulty={entry.difficulty} />
        </Flex>

        <Text fontSize="xs" color="dark.muted" lineHeight="1.5" lineClamp={2}>
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

        {/* Bottom row: concept tags + service count */}
        <Flex justify="space-between" align="center" gap="2">
          <Flex gap="1" flexWrap="wrap" flex="1">
            {entry.concepts.slice(0, 3).map((concept) => (
              <Badge
                key={concept}
                fontSize="2xs"
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
                fontSize="2xs"
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
          <Text fontSize="9px" color="dark.muted" {...pixelFontProps} flexShrink={0}>
            {entry.services.length} services
          </Text>
        </Flex>
      </Card.Body>
    </Card.Root>
  );
}

// ─── Gallery Detail View ──────────────────────────────────────────────────────

function mapServiceToResourceType(svc: ServiceNode): ResourceType {
  const name = svc.name.toLowerCase();
  switch (svc.type) {
    case 'database':
      if (name.includes('postgres')) return 'postgres';
      if (name.includes('sql server') || name.includes('sqlserver') || name.includes('mssql')) return 'sqlserver';
      if (name.includes('mongo')) return 'mongodb';
      return 'postgres';
    case 'cache':
      return 'redis';
    case 'messaging':
      if (name.includes('kafka')) return 'kafka';
      return 'rabbitmq';
    case 'frontend':
      return 'npmapp';
    case 'api':
    case 'worker':
      return 'project';
    default:
      return 'container';
  }
}

function convertToPlaygroundResources(
  services: ServiceNode[],
  connections: DiagramConnection[],
): PlaygroundResource[] {
  return services.map((svc) => {
    const refs = connections
      .filter((c) => c.from === svc.id)
      .map((c) => c.to);
    const waits = connections
      .filter((c) => c.from === svc.id)
      .map((c) => c.to);
    return {
      id: svc.id,
      type: mapServiceToResourceType(svc),
      name: svc.name.replace(/\n/g, ' '),
      databases: [],
      image: '',
      references: refs,
      waitFor: waits,
      hasDataVolume: svc.type === 'database',
      hasExternalEndpoints: svc.type === 'api' || svc.type === 'frontend',
      ports: '',
      envVars: [],
      isPersistent: false,
      isSecret: false,
      args: '',
      scriptPath: '',
      projectPath: '',
      projectLanguage: 'csharp',
    };
  });
}

function GalleryDetail({
  entry,
  onBack,
}: {
  entry: GalleryEntry;
  onBack: () => void;
}) {
  const navigate = useNavigate();
  const projectFiles = useMemo(() => buildProjectFiles(entry), [entry]);
  const [showFullOverview, setShowFullOverview] = useState(false);
  const [showFullWhyAspire, setShowFullWhyAspire] = useState(false);
  const [expandedPatterns, setExpandedPatterns] = useState<Set<string>>(new Set());

  const togglePattern = useCallback((name: string) => {
    setExpandedPatterns((prev) => {
      const next = new Set(prev);
      if (next.has(name)) next.delete(name);
      else next.add(name);
      return next;
    });
  }, []);

  const { data: conceptsData } = useQuery<ConceptsData>({
    queryKey: ['concepts'],
    queryFn: () => api.get('/concepts').then((r) => r.data),
    staleTime: 10 * 60_000,
  });

  const relatedLessons = useMemo(() => {
    if (!conceptsData) return [];
    return entry.concepts
      .map((concept) => {
        const match = conceptsData.concepts.find(
          (c) => c.label.toLowerCase() === concept.toLowerCase(),
        );
        return match ? { concept, lessonId: match.lessonId, emoji: match.emoji } : null;
      })
      .filter((r): r is { concept: string; lessonId: string; emoji: string } => r !== null && !!r.lessonId);
  }, [entry.concepts, conceptsData]);

  const handleOpenInPlayground = useCallback(() => {
    const resources = convertToPlaygroundResources(entry.services, entry.connections);
    localStorage.setItem(PLAYGROUND_STORAGE_KEY, JSON.stringify(resources));
    navigate('/playground');
  }, [entry.services, entry.connections, navigate]);

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
          data-testid="gallery-back-button"
        >
          ← Back to Gallery
        </Button>
      </Flex>

      <Heading size="lg" color="dark.text" {...pixelFontProps} mb="2" lineHeight="1.6">
        {entry.title}
      </Heading>

      {/* Category + Difficulty row */}
      <Flex gap="2" align="center" mb="3">
        <Badge fontSize="8px" bg="dark.surface" color="dark.muted" px="3" py="1" {...pixelFontProps}>
          {CATEGORIES.find(c => c.value === entry.category)?.icon} {entry.category}
        </Badge>
        <DifficultyBadge difficulty={entry.difficulty} />
        <Text fontSize="8px" color="dark.muted" {...pixelFontProps}>
          {entry.services.length} services · {entry.connections.length} connections
        </Text>
      </Flex>

      <Text fontSize="sm" color="dark.muted" mb="3" lineHeight="1.6" maxW="700px">
        {entry.description}
      </Text>

      {/* Concept Tags + Related Lessons (combined row) */}
      <Flex gap="2" flexWrap="wrap" mb="3" align="center" data-testid="related-lessons">
        {entry.concepts.map((concept) => {
          const lesson = relatedLessons.find((l) => l.concept === concept);
          if (lesson) {
            return (
              <Badge
                key={concept}
                fontSize="8px"
                bg="aspire.100"
                color="aspire.400"
                px="3"
                py="1"
                cursor="pointer"
                role="link"
                tabIndex={0}
                _hover={{ bg: 'aspire.200', color: 'aspire.500' }}
                onClick={() => navigate(`/lessons/${lesson.lessonId}`)}
                onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); navigate(`/lessons/${lesson.lessonId}`); } }}
                {...pixelFontProps}
                data-testid={`related-lesson-${lesson.lessonId}`}
              >
                {lesson.emoji} {concept} →
              </Badge>
            );
          }
          return (
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
          );
        })}
      </Flex>

      {/* Open in Playground */}
      <Box mb="3">
        <Button
          size="sm"
          bg="aspire.300"
          color="aspire.500"
          _hover={{ bg: 'aspire.400', color: 'white' }}
          onClick={handleOpenInPlayground}
          {...pixelFontProps}
          fontSize="10px"
          data-testid="open-in-playground"
        >
          🎮 Open in Playground
        </Button>
      </Box>

      {/* Architecture Overview — collapsible with Why Aspire callout */}
      <Card.Root {...retroCardProps} bg="dark.card" p="4" mb="3">
        <Card.Body gap="3">
          <Box>
            <Heading size="sm" mb="2" color="dark.text" {...pixelFontProps}>
              📖 Architecture Overview
            </Heading>
            <Box bg="dark.surface" borderRadius="sm" border="1px solid" borderColor="dark.border" p="3">
              {(() => {
                const paragraphs = entry.explanation.overview.split('\n\n');
                const visibleParagraphs = showFullOverview ? paragraphs : paragraphs.slice(0, 1);
                return (
                  <>
                    {visibleParagraphs.map((paragraph, i) => (
                      <Text key={i} fontSize="sm" color="dark.muted" lineHeight="1.7" mb={i < visibleParagraphs.length - 1 ? '2' : '0'}>
                        {paragraph}
                      </Text>
                    ))}
                    {paragraphs.length > 1 && (
                      <Button
                        variant="ghost"
                        size="xs"
                        fontSize="xs"
                        color="aspire.400"
                        mt="1"
                        px="0"
                        h="auto"
                        minW="auto"
                        _hover={{ color: 'aspire.500' }}
                        onClick={() => setShowFullOverview((v) => !v)}
                        {...pixelFontProps}
                      >
                        {showFullOverview ? 'Show less ▲' : 'Show more ▼'}
                      </Button>
                    )}
                  </>
                );
              })()}
            </Box>
          </Box>

          {/* Why Aspire — compact callout */}
          <Flex
            align="flex-start"
            gap="2"
            bg="rgba(107, 79, 187, 0.08)"
            borderRadius="sm"
            border="1px solid"
            borderColor="aspire.300"
            px="3"
            py="2"
          >
            <Text flexShrink={0} fontSize="sm">✨</Text>
            <Box>
              <Text fontSize="xs" color="dark.muted" lineHeight="1.5" as="span">
                {showFullWhyAspire
                  ? entry.explanation.whyAspire
                  : entry.explanation.whyAspire.length > 120
                    ? entry.explanation.whyAspire.slice(0, 120) + '...'
                    : entry.explanation.whyAspire}
              </Text>
              {entry.explanation.whyAspire.length > 120 && (
                <Button
                  variant="ghost"
                  size="xs"
                  fontSize="xs"
                  color="aspire.400"
                  ml="1"
                  px="0"
                  h="auto"
                  minW="auto"
                  verticalAlign="baseline"
                  _hover={{ color: 'aspire.500' }}
                  onClick={() => setShowFullWhyAspire((v) => !v)}
                  {...pixelFontProps}
                >
                  {showFullWhyAspire ? 'less' : 'more'}
                </Button>
              )}
            </Box>
          </Flex>
        </Card.Body>
      </Card.Root>

      {/* Tabbed Content */}
      <Tabs.Root defaultValue="diagram" variant="enclosed">
        <Tabs.List
          bg="dark.surface"
          border="2px solid"
          borderColor="dark.border"
          borderRadius="sm"
          p="1"
          gap="1"
          mb="3"
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
            Diagram
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
            AppHost Code
          </Tabs.Trigger>
          <Tabs.Trigger
            value="files"
            fontSize="10px"
            px="4"
            py="2"
            {...pixelFontProps}
            color="dark.muted"
            _selected={{ bg: 'aspire.200', color: 'aspire.400' }}
            borderRadius="sm"
          >
            Project Files
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
            Deep Dive
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

        {/* Project Files Tab */}
        <Tabs.Content value="files">
          <Card.Root {...retroCardProps} bg="dark.card" p="4">
            <Card.Body>
              <Heading size="sm" mb="4" color="dark.text" {...pixelFontProps}>
                Full Project Structure ({projectFiles.length} files)
              </Heading>
              <FileBrowser files={projectFiles} />
            </Card.Body>
          </Card.Root>
        </Tabs.Content>

        {/* Explanation Tab */}
        <Tabs.Content value="explanation">
          <Card.Root {...retroCardProps} bg="dark.card" p="4">
            <Card.Body gap="4">
              {/* Key Architecture Patterns — compact list, expand on click */}
              <Box>
                <Heading size="sm" mb="2" color="dark.text" {...pixelFontProps}>
                  🏗️ Key Architecture Patterns
                </Heading>
                <Flex direction="column" gap="1">
                  {entry.explanation.keyPatterns.map((pattern) => {
                    const isExpanded = expandedPatterns.has(pattern.name);
                    return (
                      <Box
                        key={pattern.name}
                        bg="dark.surface"
                        borderRadius="sm"
                        border="1px solid"
                        borderColor="dark.border"
                        borderLeft="3px solid"
                        borderLeftColor="aspire.400"
                        cursor="pointer"
                        role="button"
                        tabIndex={0}
                        onClick={() => togglePattern(pattern.name)}
                        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); togglePattern(pattern.name); } }}
                        px="3"
                        py="2"
                        transition="all 0.15s"
                        _hover={{ bg: 'dark.card' }}
                      >
                        <Flex align="center" justify="space-between">
                          <Text fontSize="xs" color="aspire.400" fontWeight="bold" {...pixelFontProps}>
                            {pattern.name}
                          </Text>
                          <Text fontSize="xs" color="dark.muted">
                            {isExpanded ? '▲' : '▼'}
                          </Text>
                        </Flex>
                        {isExpanded && (
                          <Text fontSize="sm" color="dark.muted" lineHeight="1.6" mt="1">
                            {pattern.description}
                          </Text>
                        )}
                      </Box>
                    );
                  })}
                </Flex>
              </Box>

              {/* Aspire Concepts Used */}
              <Box>
                <Heading size="sm" mb="3" color="dark.text" {...pixelFontProps}>
                  ⭐ Aspire Concepts Used
                </Heading>
                <SimpleGrid columns={{ base: 1, md: 2 }} gap="2">
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
                      <Text color="game.xpGold" fontSize="sm">⭐</Text>
                      <Text fontSize="xs" color="dark.text">{concept}</Text>
                    </Flex>
                  ))}
                </SimpleGrid>
              </Box>

              {/* Scaling Notes */}
              <Box>
                <Heading size="sm" mb="3" color="dark.text" {...pixelFontProps}>
                  📈 Scaling Considerations
                </Heading>
                <Box
                  bg="dark.surface"
                  borderRadius="sm"
                  border="1px solid"
                  borderColor="dark.border"
                  p="4"
                >
                  <Text fontSize="sm" color="dark.muted" lineHeight="1.7">
                    {entry.explanation.scalingNotes}
                  </Text>
                </Box>
              </Box>

              {/* Services & Connections Summary */}
              <Box>
                <Heading size="sm" mb="3" color="dark.text" {...pixelFontProps}>
                  🔌 Services & Connections
                </Heading>
                <SimpleGrid columns={{ base: 1, md: 2 }} gap="4">
                  <Box>
                    <Text fontSize="8px" color="dark.muted" {...pixelFontProps} mb="2">
                      Services ({entry.services.length})
                    </Text>
                    <Flex direction="column" gap="1">
                      {entry.services.map((svc) => {
                        const colors = serviceTypeColors[svc.type];
                        return (
                          <Flex
                            key={svc.id}
                            align="center"
                            gap="2"
                            p="1.5"
                            bg="dark.surface"
                            borderRadius="sm"
                          >
                            <Box w="8px" h="8px" bg={colors.border} borderRadius="sm" flexShrink={0} />
                            <Text fontSize="xs" color="dark.text">{svc.name.replace('\n', ' ')}</Text>
                            <Badge fontSize="2xs" bg={colors.bg} color={colors.border} px="1.5" ml="auto">
                              {svc.type}
                            </Badge>
                          </Flex>
                        );
                      })}
                    </Flex>
                  </Box>
                  <Box>
                    <Text fontSize="8px" color="dark.muted" {...pixelFontProps} mb="2">
                      Connections ({entry.connections.length})
                    </Text>
                    <Flex direction="column" gap="1">
                      {entry.connections.map((conn, i) => {
                        const fromSvc = entry.services.find((s) => s.id === conn.from);
                        const toSvc = entry.services.find((s) => s.id === conn.to);
                        return (
                          <Flex key={i} align="center" gap="2" p="1.5" fontSize="xs" color="dark.muted">
                            <Text color="dark.text">{fromSvc?.name.replace('\n', ' ')}</Text>
                            <Text color="aspire.500">→</Text>
                            <Text color="dark.text">{toSvc?.name.replace('\n', ' ')}</Text>
                            {conn.label && (
                              <Badge fontSize="2xs" bg="aspire.100" color="aspire.400" px="1.5" ml="auto">
                                {conn.label}
                              </Badge>
                            )}
                          </Flex>
                        );
                      })}
                    </Flex>
                  </Box>
                </SimpleGrid>
              </Box>
            </Card.Body>
          </Card.Root>
        </Tabs.Content>
      </Tabs.Root>

      {/* Try This CTA */}
      <Card.Root
        mt="3"
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
  const { projectId } = useParams<{ projectId: string }>();
  const navigate = useNavigate();
  const [activeCategory, setActiveCategory] = useState<string>('all');
  const [search, setSearch] = useState('');

  const { data: galleryEntries = [] } = useQuery<GalleryEntry[]>({
    queryKey: ['gallery'],
    queryFn: () => api.get('/gallery').then((r) => r.data),
    staleTime: 10 * 60_000,
  });

  const filteredEntries = useMemo(() => {
    let entries = activeCategory === 'all'
      ? galleryEntries
      : galleryEntries.filter((e) => e.category === activeCategory);

    if (search.trim()) {
      const q = search.trim().toLowerCase();
      entries = entries.filter(
        (e) =>
          e.title.toLowerCase().includes(q) ||
          e.description.toLowerCase().includes(q) ||
          e.category.toLowerCase().includes(q) ||
          e.concepts.some((c) => c.toLowerCase().includes(q)),
      );
    }

    return entries;
  }, [activeCategory, galleryEntries, search]);

  const categoryCounts = useMemo(() => {
    const counts: Record<string, number> = { all: galleryEntries.length };
    for (const entry of galleryEntries) {
      counts[entry.category] = (counts[entry.category] ?? 0) + 1;
    }
    return counts;
  }, [galleryEntries]);

  const selectedEntry = useMemo(
    () => (projectId ? galleryEntries.find((e) => e.id === projectId) ?? null : null),
    [projectId, galleryEntries],
  );

  if (selectedEntry) {
    return (
      <Box maxW="900px" mx="auto" p="6">
        <GalleryDetail
          entry={selectedEntry}
          onBack={() => navigate('/gallery')}
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
          Explore production-ready Aspire architectures across {galleryEntries.length} real-world examples.
          Each includes an interactive diagram, complete AppHost code, and in-depth explanations
          of architecture patterns and Aspire concepts.
        </Text>
      </Box>

      {/* Search Bar */}
      <Flex justify="center" mb="5">
        <Input
          placeholder="🔍 Search projects..."
          value={search}
          onChange={(e: React.ChangeEvent<HTMLInputElement>) => setSearch(e.target.value)}
          size="sm"
          maxW="340px"
          bg="dark.card"
          color="dark.text"
          borderColor="dark.border"
          _placeholder={{ color: 'dark.muted' }}
          {...pixelFontProps}
          fontSize="2xs"
          data-testid="gallery-search"
        />
      </Flex>

      {/* Category Filter */}
      <Flex
        gap="2"
        flexWrap="wrap"
        justify="center"
        mb="5"
        p="2"
        bg="dark.surface"
        borderRadius="sm"
        border="2px solid"
        borderColor="dark.border"
      >
        {CATEGORIES.map((cat) => {
          const isActive = activeCategory === cat.value;
          const count = categoryCounts[cat.value] ?? 0;
          return (
            <Button
              key={cat.value}
              size="xs"
              variant="ghost"
              onClick={() => setActiveCategory(cat.value)}
              bg={isActive ? 'aspire.200' : 'transparent'}
              color={isActive ? 'aspire.400' : 'dark.muted'}
              _hover={{ bg: isActive ? 'aspire.200' : 'dark.card' }}
              {...pixelFontProps}
              fontSize="9px"
              px="3"
              py="2"
              borderRadius="sm"
              transition="all 0.15s"
            >
              {cat.icon} {cat.label}
              <Badge
                ml="1.5"
                fontSize="2xs"
                bg={isActive ? 'aspire.300' : 'dark.border'}
                color={isActive ? 'aspire.500' : 'dark.muted'}
                px="1.5"
                borderRadius="full"
                minW="18px"
                textAlign="center"
              >
                {count}
              </Badge>
            </Button>
          );
        })}
      </Flex>

      {/* Service Type Legend */}
      <ServiceLegend />

      {/* Gallery Grid */}
      <SimpleGrid columns={{ base: 1, md: 2 }} gap="4">
        {filteredEntries.map((entry) => (
          <GalleryCard
            key={entry.id}
            entry={entry}
            onClick={() => navigate(`/gallery/${entry.id}`)}
          />
        ))}
      </SimpleGrid>

      {/* Empty state */}
      {filteredEntries.length === 0 && galleryEntries.length > 0 && (
        <Box textAlign="center" py="12">
          <Text fontSize="xl" mb="2">🏗️</Text>
          <Text fontSize="sm" color="dark.muted">
            No architectures in this category yet.
          </Text>
        </Box>
      )}

      {/* Footer */}
      <Box textAlign="center" mt="8">
        <Text fontSize="9px" color="dark.muted" {...pixelFontProps}>
          All architectures use Aspire for orchestration · {galleryEntries.length} examples across {CATEGORIES.length - 1} categories
        </Text>
        <Text fontSize="xs" color="dark.muted" mt="1">
          Click any card to explore the full architecture diagram, AppHost code, and detailed explanation
        </Text>
      </Box>
    </Box>
  );
}
