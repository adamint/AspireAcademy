import ReactMarkdown from 'react-markdown';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { oneDark } from 'react-syntax-highlighter/dist/esm/styles/prism';
import { Box } from '@chakra-ui/react';
import type { Components } from 'react-markdown';

function extractText(node: React.ReactNode): string {
  if (typeof node === 'string') return node;
  if (Array.isArray(node)) return node.map(extractText).join('');
  if (node && typeof node === 'object' && 'props' in node) {
    return extractText((node as React.ReactElement).props.children);
  }
  return '';
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
          background: 'var(--code-bg)',
          color: 'var(--text-h)',
          padding: '2px 6px',
          borderRadius: 4,
          fontSize: '0.9em',
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
  blockquote({ children }) {
    const text = extractText(children);
    const isInsight = text.startsWith('💡');
    const isWarning = text.startsWith('⚠️');

    if (isInsight) {
      return (
        <Box
          borderLeft="4px solid"
          borderColor="aspire.500"
          bg="aspire.50"
          p="4"
          borderRadius="sm"
          mb="4"
        >
          {children}
        </Box>
      );
    }

    if (isWarning) {
      return (
        <Box
          borderLeft="4px solid"
          borderColor="game.error"
          bg="rgba(209, 52, 56, 0.15)"
          p="4"
          borderRadius="sm"
          mb="4"
        >
          {children}
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
    <ReactMarkdown components={markdownComponents}>
      {children}
    </ReactMarkdown>
  );
}
