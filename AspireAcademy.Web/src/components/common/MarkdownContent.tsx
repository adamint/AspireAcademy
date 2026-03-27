import ReactMarkdown from 'react-markdown';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { oneDark } from 'react-syntax-highlighter/dist/esm/styles/prism';
import { Box, Flex, Text } from '@chakra-ui/react';
import { Link as RouterLink } from 'react-router-dom';
import type { Components } from 'react-markdown';

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
};

function detectCalloutType(text: string): CalloutStyle | null {
  for (const [prefix, style] of Object.entries(calloutStyles)) {
    if (text.startsWith(prefix)) return style;
  }
  return null;
}

const markdownComponents: Partial<Components> = {
  code({ className, children, ...props }) {
    const match = /language-(\w+)/.exec(className || '');
    const codeStr = String(children).replace(/\n$/, '');

    if (match) {
      return (
        <SyntaxHighlighter
          style={oneDark}
          language={match[1]}
          PreTag="div"
          customStyle={{ borderRadius: 6, fontSize: 14 }}
        >
          {codeStr}
        </SyntaxHighlighter>
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
        {...props}
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
  a({ href, children, node: _node, ...rest }) {
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
      <ReactMarkdown components={markdownComponents}>
        {children}
      </ReactMarkdown>
    </Box>
  );
}
