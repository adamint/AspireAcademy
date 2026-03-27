import { useState, useRef, useEffect, useCallback } from 'react';
import { Box, Flex, Text, Button, IconButton, Input, Drawer } from '@chakra-ui/react';
import { FiSend, FiX } from 'react-icons/fi';
import ReactMarkdown from 'react-markdown';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import vscDarkPlus from 'react-syntax-highlighter/dist/esm/styles/prism/vsc-dark-plus';
import { useAuthStore } from '../../store/authStore';
import { useProgressStore } from '../../store/progressStore';
import { retroCardProps, pixelFontProps } from '../../theme/aspireTheme';

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

export default function AiTutorSidebar() {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [streaming, setStreaming] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const token = useAuthStore((s) => s.token);
  const currentLessonId = useProgressStore((s) => s.currentLesson);

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, scrollToBottom]);

  const handleSend = async () => {
    const text = input.trim();
    if (!text || streaming) return;

    const userMessage: ChatMessage = { role: 'user', content: text };
    const history = [...messages, userMessage];
    setMessages(history);
    setInput('');
    setStreaming(true);

    setMessages((prev) => [...prev, { role: 'assistant', content: '' }]);

    try {
      const response = await fetch('/api/ai/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
          Accept: 'text/event-stream',
        },
        body: JSON.stringify({
          messages: history.map((m) => ({ role: m.role, content: m.content })),
          lessonId: currentLessonId,
        }),
      });

      if (!response.body) throw new Error('No response body');

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let accumulated = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value, { stream: true });
        const lines = chunk.split('\n');

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const data = line.slice(6);
            if (data === '[DONE]') break;
            try {
              const parsed = JSON.parse(data);
              accumulated += parsed.content ?? parsed.delta?.content ?? '';
            } catch {
              accumulated += data;
            }
            setMessages((prev) => {
              const updated = [...prev];
              updated[updated.length - 1] = { role: 'assistant', content: accumulated };
              return updated;
            });
          }
        }
      }
    } catch {
      console.error('[AiTutorSidebar] Failed to stream AI chat response');
      setMessages((prev) => {
        const updated = [...prev];
        updated[updated.length - 1] = {
          role: 'assistant',
          content: 'AI tutor is not available. Make sure an OpenAI API key is configured in the Dashboard (click the "openai" resource → "Set parameter value").',
        };
        return updated;
      });
    } finally {
      setStreaming(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <>
      {/* Floating button */}
      {!open && (
        <Box
          as="button"
          position="fixed"
          bottom="24px"
          right="24px"
          w="56px"
          h="56px"
          display="flex"
          alignItems="center"
          justifyContent="center"
          fontSize="24px"
          cursor="pointer"
          zIndex={1000}
          bg="game.xpGold"
          color="game.retroBg"
          {...retroCardProps}
          borderRadius="full"
          borderColor="game.pixelBorder"
          _hover={{ transform: 'scale(1.1)' }}
          transition="transform 0.15s ease"
          onClick={() => setOpen(true)}
          aria-label="Open AI Tutor"
          title="Open AI Tutor for help"
        >
          AI
        </Box>
      )}

      {/* Chat Drawer */}
      <Drawer.Root
        open={open}
        onOpenChange={(e) => setOpen(e.open)}
        placement="end"
      >
        <Drawer.Backdrop />
        <Drawer.Positioner>
          <Drawer.Content maxW="400px" w="100%" bg="dark.card" color="dark.text">
            {/* Header */}
            <Drawer.Header bg="dark.sidebar" py={3} px={4}>
              <Flex align="center" justify="space-between" w="100%">
                <Text {...pixelFontProps} fontSize="10px" color="whiteAlpha.900">
                  AI Tutor
                </Text>
                <IconButton
                  aria-label="Close"
                  title="Close AI Tutor"
                  variant="ghost"
                  size="sm"
                  color="whiteAlpha.900"
                  _hover={{ bg: 'whiteAlpha.200' }}
                  onClick={() => setOpen(false)}
                >
                  <FiX />
                </IconButton>
              </Flex>
            </Drawer.Header>

            {/* Messages */}
            <Drawer.Body p={4} display="flex" flexDirection="column" gap={3} overflowY="auto" aria-live="polite" aria-relevant="additions">
              {messages.length === 0 && (
                <Text textAlign="center" color="dark.muted" mt={8} fontSize="sm">
                  Ask me anything about Aspire! I&apos;m here to help you learn.
                </Text>
              )}
              {messages.map((msg, i) => (
                <Box
                  key={i}
                  alignSelf={msg.role === 'user' ? 'flex-end' : 'flex-start'}
                  bg={msg.role === 'user' ? 'aspire.600' : 'dark.surface'}
                  color="dark.text"
                  px={3}
                  py={2}
                  borderRadius={msg.role === 'user' ? '12px 12px 4px 12px' : '12px 12px 12px 4px'}
                  maxW="80%"
                  css={{ wordBreak: 'break-word' }}
                  fontSize="sm"
                >
                  {msg.role === 'assistant' ? (
                    <ReactMarkdown
                      components={{
                        code({ className, children, ...props }) {
                          const match = /language-(\w+)/.exec(className || '');
                          const codeString = String(children).replace(/\n$/, '');
                          return match ? (
                            <SyntaxHighlighter style={vscDarkPlus} language={match[1]} PreTag="div">
                              {codeString}
                            </SyntaxHighlighter>
                          ) : (
                            <code className={className} {...props}>{children}</code>
                          );
                        },
                      }}
                    >
                      {msg.content}
                    </ReactMarkdown>
                  ) : (
                    msg.content
                  )}
                </Box>
              ))}
              <div ref={messagesEndRef} />
            </Drawer.Body>

            {/* Input */}
            <Drawer.Footer borderTop="1px solid" borderColor="dark.border" p={3}>
              <Flex gap={2} w="100%">
                <Input
                  flex={1}
                  placeholder="Ask a question..."
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={handleKeyDown}
                  disabled={streaming}
                  size="sm"
                  bg="dark.surface"
                  color="dark.text"
                  borderColor="dark.border"
                  _placeholder={{ color: 'dark.muted' }}
                  aria-label="Ask a question to AI Tutor"
                />
                <Button
                  colorPalette="purple"
                  size="sm"
                  onClick={handleSend}
                  disabled={streaming || !input.trim()}
                  title="Send message to AI Tutor"
                  aria-label="Send message to AI Tutor"
                >
                  <FiSend />
                </Button>
              </Flex>
            </Drawer.Footer>
          </Drawer.Content>
        </Drawer.Positioner>
      </Drawer.Root>
    </>
  );
}
