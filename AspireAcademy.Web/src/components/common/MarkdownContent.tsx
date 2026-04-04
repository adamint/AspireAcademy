import { isValidElement } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeRaw from 'rehype-raw';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { oneDark } from 'react-syntax-highlighter/dist/esm/styles/prism';
import { Box, Flex, Text } from '@chakra-ui/react';
import { Link as RouterLink } from 'react-router-dom';
import type { Components } from 'react-markdown';
import ArchitectureDiagram from './ArchitectureDiagram';
import type { ServiceNode, DiagramConnection } from './architectureDiagramTypes';
import { RevealBlock, DeepDiveCollapse, BeforeAfterComparison, ScenarioBlock, TerminalSimulation, TimelineBlock } from './InteractiveBlocks';

function extractText(node: React.ReactNode): string {
  if (typeof node === 'string') return node;
  if (Array.isArray(node)) return node.map(extractText).join('');
  if (node && typeof node === 'object' && 'props' in node) {
    return extractText((node as React.ReactElement<{ children?: React.ReactNode }>).props.children);
  }
  return '';
}

interface CalloutStyle {
  borderColor: string;
  bg: string;
  label: string;
  labelColor: string;
}

const calloutStyles: Record<string, CalloutStyle> = {
  '💡': { borderColor: 'aspire.500', bg: 'aspire.50', label: 'Insight', labelColor: 'aspire.400' },
  '⚠️': { borderColor: 'game.error', bg: 'rgba(209, 52, 56, 0.15)', label: 'Warning', labelColor: 'game.error' },
  '🎯': { borderColor: '#22c55e', bg: 'rgba(34, 197, 94, 0.10)', label: 'Learning Objectives', labelColor: '#4ade80' },
  '📝': { borderColor: '#3b82f6', bg: 'rgba(59, 130, 246, 0.10)', label: 'Definition', labelColor: '#60a5fa' },
  '🔧': { borderColor: '#f59e0b', bg: 'rgba(245, 158, 11, 0.10)', label: 'Try It Yourself', labelColor: '#fbbf24' },
  '📋': { borderColor: '#8b5cf6', bg: 'rgba(139, 92, 246, 0.10)', label: 'Key Takeaways', labelColor: '#a78bfa' },
  '🏗️': { borderColor: '#06b6d4', bg: 'rgba(6, 182, 212, 0.10)', label: 'Step by Step', labelColor: '#22d3ee' },
  '🔍': { borderColor: '#ec4899', bg: 'rgba(236, 72, 153, 0.10)', label: 'Deep Dive', labelColor: '#f472b6' },
  '🧠': { borderColor: '#14b8a6', bg: 'rgba(20, 184, 166, 0.10)', label: 'Concept Check', labelColor: '#2dd4bf' },
  '🤓': { borderColor: '#f97316', bg: 'rgba(249, 115, 22, 0.08)', label: 'Did You Know?', labelColor: '#fb923c' },
  '💥': { borderColor: '#ef4444', bg: 'rgba(239, 68, 68, 0.08)', label: 'Common Gotcha', labelColor: '#f87171' },
  '🏢': { borderColor: '#a855f7', bg: 'rgba(168, 85, 247, 0.08)', label: 'Real-World Story', labelColor: '#c084fc' },
  '🎮': { borderColor: '#eab308', bg: 'rgba(234, 179, 8, 0.08)', label: 'Challenge', labelColor: '#facc15' },
};

function detectCalloutType(text: string): CalloutStyle | null {
  for (const [prefix, style] of Object.entries(calloutStyles)) {
    if (text.startsWith(prefix)) return style;
  }
  return null;
}

const markdownComponents: Partial<Components> = {
  code(props) {
    const { className, children, ...rest } = props;
    const match = /language-(\w+)/.exec(className || '');
    const codeStr = String(children).replace(/\n$/, '');
    const node = (props as {
      node?: { position?: { start?: { line?: number }; end?: { line?: number } } };
    }).node;
    const isBlockCode =
      Boolean(className) ||
      codeStr.includes('\n') ||
      (node?.position?.start?.line !== undefined &&
        node?.position?.end?.line !== undefined &&
        node.position.start.line !== node.position.end.line);

    if (match?.[1] === 'architecture') {
      try {
        const data = JSON.parse(codeStr) as {
          services: ServiceNode[];
          connections: DiagramConnection[];
          title?: string;
          compact?: boolean;
        };
        return (
          <ArchitectureDiagram
            services={data.services}
            connections={data.connections}
            title={data.title}
            compact={data.compact}
          />
        );
      } catch {
        // Fall through to regular code rendering on parse error
      }
    }

    // Interactive comparison block: ```compare
    if (match?.[1] === 'compare') {
      try {
        const data = JSON.parse(codeStr);
        return <BeforeAfterComparison data={data} />;
      } catch {
        // Fall through
      }
    }

    // Interactive scenario block: ```scenario
    if (match?.[1] === 'scenario') {
      try {
        const data = JSON.parse(codeStr);
        return <ScenarioBlock data={data} />;
      } catch {
        // Fall through
      }
    }

    // Reveal block: ```reveal
    if (match?.[1] === 'reveal') {
      try {
        const data = JSON.parse(codeStr) as { question: string; answer: string };
        return <RevealBlock question={data.question} answer={data.answer} />;
      } catch {
        // Fall through
      }
    }

    // Collapsible deep dive: ```deepdive
    if (match?.[1] === 'deepdive') {
      try {
        const data = JSON.parse(codeStr) as { title: string; content: string };
        return (
          <DeepDiveCollapse title={data.title}>
            <ReactMarkdown
              remarkPlugins={[remarkGfm]}
              rehypePlugins={[rehypeRaw]}
              components={markdownComponents}
            >
              {data.content}
            </ReactMarkdown>
          </DeepDiveCollapse>
        );
      } catch {
        // Fall through
      }
    }

    // Animated terminal simulation: ```terminal
    if (match?.[1] === 'terminal') {
      try {
        const data = JSON.parse(codeStr);
        return <TerminalSimulation data={data} />;
      } catch {
        // Fall through
      }
    }

    // Timeline block: ```timeline
    if (match?.[1] === 'timeline') {
      try {
        const data = JSON.parse(codeStr);
        return <TimelineBlock data={data} />;
      } catch {
        // Fall through
      }
    }

    if (match) {
      return (
        <SyntaxHighlighter
          style={oneDark}
          language={match[1]}
          PreTag="pre"
          customStyle={{ borderRadius: 6, fontSize: 14 }}
        >
          {codeStr}
        </SyntaxHighlighter>
      );
    }

    if (isBlockCode) {
      return (
        <Box
          as="pre"
          p="3"
          mb="4"
          borderRadius="sm"
          bg="rgba(30, 20, 50, 0.5)"
          overflow="auto"
          fontSize="0.82rem"
          lineHeight="1.6"
          fontFamily="'JetBrains Mono', 'Fira Code', monospace"
          color="var(--text)"
          whiteSpace="pre"
        >
          <code className={className} {...rest}>{codeStr}</code>
        </Box>
      );
    }

    return (
      <code
        className={className}
        style={{
          background: 'rgba(139, 92, 246, 0.15)',
          padding: '1px 5px',
          borderRadius: 4,
          fontSize: '0.85em',
        }}
        {...rest}
      >
        {children}
      </code>
    );
  },
  table({ children }) {
    return (
      <Box
        as="table"
        width="100%"
        my="4"
        borderRadius="sm"
        overflow="hidden"
        css={{
          borderCollapse: 'collapse',
          '& th, & td': {
            padding: '10px 14px',
            textAlign: 'left',
            borderBottom: '1px solid var(--chakra-colors-dark-border, #2B1260)',
          },
          '& th': {
            fontWeight: 600,
            background: 'var(--chakra-colors-aspire-50, #2A2445)',
          },
          '& tr:last-child td': {
            borderBottom: 'none',
          },
        }}
      >
        {children}
      </Box>
    );
  },
  a({ href, children, ...rest }) {
    if (href && href.startsWith('/')) {
      return (
        <RouterLink to={href}>
          {children}
        </RouterLink>
      );
    }
    return (
      <a {...rest} href={href} target="_blank" rel="noopener noreferrer">
        {children}
      </a>
    );
  },
  blockquote({ children }) {
    const text = extractText(children);
    const callout = detectCalloutType(text);

    if (callout) {
      return (
        <Box
          borderLeft="4px solid"
          borderColor={callout.borderColor}
          bg={callout.bg}
          borderRadius="sm"
          mb="4"
          overflow="hidden"
        >
          <Flex align="center" gap="2" px="4" pt="3" pb="1">
            <Text fontSize="xs" fontWeight="bold" color={callout.labelColor} textTransform="uppercase" letterSpacing="wider">
              {callout.label}
            </Text>
          </Flex>
          <Box px="4" pb="3" css={{ '& > p:first-of-type': { marginTop: 0 } }}>
            {children}
          </Box>
        </Box>
      );
    }

    return (
      <Box
        as="blockquote"
        borderLeft="4px solid"
        borderColor="aspire.400"
        pl="4"
        my="3"
        color="dark.muted"
      >
        {children}
      </Box>
    );
  },
  pre({ children }) {
    // Interactive blocks (RevealBlock, CompareBlock, etc.) are rendered by the
    // code component inside a <pre> wrapper from react-markdown. Unwrap custom
    // components so they don't inherit white-space: pre, which breaks text wrapping.
    if (isValidElement(children) && typeof children.type !== 'string') {
      return <>{children}</>;
    }
    return <pre>{children}</pre>;
  },
};

interface MarkdownContentProps {
  children: string;
}

export default function MarkdownContent({ children }: MarkdownContentProps) {
  return (
    <Box
      css={{
        '& h1': {
          fontSize: '1.6rem',
          fontWeight: 600,
          color: 'var(--text-h)',
          margin: '0 0 0.75rem',
          lineHeight: 1.3,
          letterSpacing: '-0.5px',
        },
        '& h2': {
          fontSize: '1.25rem',
          fontWeight: 600,
          color: 'var(--text-h)',
          margin: '1.5rem 0 0.5rem',
          lineHeight: 1.35,
        },
        '& h3': {
          fontSize: '1.05rem',
          fontWeight: 600,
          color: 'var(--text-h)',
          margin: '1.25rem 0 0.4rem',
          lineHeight: 1.4,
        },
        '& h4': {
          fontSize: '0.95rem',
          fontWeight: 600,
          color: 'var(--text-h)',
          margin: '1rem 0 0.35rem',
        },
        '& p': {
          fontSize: '0.9rem',
          lineHeight: 1.7,
          color: 'var(--text)',
          margin: '0 0 0.75rem',
        },
        '& ul, & ol': {
          margin: '0.25rem 0 0.75rem',
          paddingLeft: '1.5rem',
        },
        '& li': {
          fontSize: '0.9rem',
          lineHeight: 1.65,
          color: 'var(--text)',
          marginBottom: '0.3rem',
        },
        '& li::marker': {
          color: 'var(--accent)',
        },
        '& a': {
          color: 'var(--accent)',
          textDecoration: 'underline',
          textDecorationColor: 'rgba(107, 79, 187, 0.4)',
          textUnderlineOffset: '2px',
          transition: 'color 0.15s, text-decoration-color 0.15s',
          '&:hover': {
            color: '#8B6FDB',
            textDecorationColor: '#8B6FDB',
          },
        },
        '& strong': {
          color: 'var(--text-h)',
          fontWeight: 600,
        },
        '& em': {
          fontStyle: 'italic',
        },
        '& hr': {
          border: 'none',
          borderTop: '1px solid var(--border)',
          margin: '1.25rem 0',
        },
        '& code': {
          fontSize: '0.82rem',
        },
        '& > *:last-child': {
          marginBottom: 0,
        },
      }}
    >
      <ReactMarkdown remarkPlugins={[remarkGfm]} rehypePlugins={[rehypeRaw]} components={markdownComponents}>
        {children}
      </ReactMarkdown>
    </Box>
  );
}
