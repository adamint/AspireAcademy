import { useState, useCallback, useMemo } from 'react';
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
} from '@chakra-ui/react';
import { retroCardProps, pixelFontProps } from '../theme/aspireTheme';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism';
import api from '../services/apiClient';

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
  api:       { bg: '#1E3A5F', border: '#3B82F6', label: 'API' },
  database:  { bg: '#1A3A2A', border: '#22C55E', label: 'DB' },
  cache:     { bg: '#3A2A1A', border: '#F59E0B', label: 'Cache' },
  messaging: { bg: '#3A1A2A', border: '#EF4444', label: 'Messaging' },
  frontend:  { bg: '#2A1A3A', border: '#A855F7', label: 'Frontend' },
  worker:    { bg: '#1A2A3A', border: '#06B6D4', label: 'Worker' },
  container: { bg: '#2A2A1A', border: '#84CC16', label: 'Container' },
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
                  onClick={() => setSelectedPath(path)}
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
  const projectFiles = useMemo(() => buildProjectFiles(entry), [entry]);

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
            Explanation
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

  const { data: galleryEntries = [] } = useQuery<GalleryEntry[]>({
    queryKey: ['gallery'],
    queryFn: () => api.get('/gallery').then((r) => r.data),
    staleTime: 10 * 60_000,
  });

  const selectedEntry = useMemo(
    () => galleryEntries.find((e) => e.id === selectedId) ?? null,
    [selectedId, galleryEntries],
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
