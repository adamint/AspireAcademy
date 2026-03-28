import { useState, useEffect, useRef, type ReactNode } from 'react';
import { Box, Flex, Text, Badge } from '@chakra-ui/react';
import { AnimatePresence, motion } from 'framer-motion';
import { FiChevronDown, FiChevronRight, FiEye } from 'react-icons/fi';

// ─── Reveal Block ──────────────────────────────────────────────────────────────
// A "think before you peek" element. Shows a question/prompt and hides the
// answer behind a click. Forces active reading.

export function RevealBlock({ question, answer }: { question: string; answer: string }) {
  const [revealed, setRevealed] = useState(false);

  return (
    <Box
      borderLeft="4px solid"
      borderColor={revealed ? '#14b8a6' : '#f59e0b'}
      bg={revealed ? 'rgba(20, 184, 166, 0.08)' : 'rgba(245, 158, 11, 0.08)'}
      borderRadius="sm"
      mb="4"
      overflow="hidden"
      transition="all 0.3s ease"
    >
      <Flex align="center" gap="2" px="4" pt="3" pb="1">
        <Text fontSize="xs" fontWeight="bold" color={revealed ? '#2dd4bf' : '#fbbf24'} textTransform="uppercase" letterSpacing="wider">
          {revealed ? 'Answer' : 'Think About It'}
        </Text>
      </Flex>
      <Box px="4" pb="2">
        <Text fontSize="0.9rem" lineHeight="1.7" color="var(--text-h)" fontWeight="500" mb="2" whiteSpace="pre-wrap" overflowWrap="break-word">
          🤔 {question}
        </Text>
      </Box>
      {!revealed ? (
        <Flex
          as="button"
          align="center"
          gap="2"
          px="4"
          pb="3"
          cursor="pointer"
          bg="transparent"
          border="none"
          color="#fbbf24"
          fontSize="sm"
          fontWeight="600"
          _hover={{ color: '#f59e0b', textDecoration: 'underline' }}
          onClick={() => setRevealed(true)}
        >
          <FiEye size={14} />
          <Text>Reveal answer</Text>
        </Flex>
      ) : (
        <AnimatePresence>
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            transition={{ duration: 0.3, ease: 'easeOut' }}
          >
            <Box
              px="4"
              pb="3"
              borderTop="1px solid rgba(20, 184, 166, 0.2)"
              pt="2"
            >
              <Text fontSize="0.9rem" lineHeight="1.7" color="var(--text)" whiteSpace="pre-wrap" overflowWrap="break-word">
                {answer}
              </Text>
            </Box>
          </motion.div>
        </AnimatePresence>
      )}
    </Box>
  );
}

// ─── Deep Dive Collapse ────────────────────────────────────────────────────────
// Collapsible section for optional deeper content. Keeps the main flow tight
// while letting curious readers dig in.

export function DeepDiveCollapse({ title, children }: { title: string; children: ReactNode }) {
  const [open, setOpen] = useState(false);

  return (
    <Box
      border="1px solid"
      borderColor={open ? 'rgba(236, 72, 153, 0.4)' : 'rgba(236, 72, 153, 0.2)'}
      bg={open ? 'rgba(236, 72, 153, 0.06)' : 'rgba(236, 72, 153, 0.03)'}
      borderRadius="sm"
      mb="4"
      overflow="hidden"
      transition="all 0.2s ease"
    >
      <Flex
        as="button"
        align="center"
        gap="2"
        px="4"
        py="3"
        cursor="pointer"
        bg="transparent"
        border="none"
        width="100%"
        _hover={{ bg: 'rgba(236, 72, 153, 0.08)' }}
        onClick={() => setOpen(!open)}
      >
        {open ? <FiChevronDown size={16} color="#f472b6" /> : <FiChevronRight size={16} color="#f472b6" />}
        <Text fontSize="sm" fontWeight="600" color="#f472b6">
          🔬 {title}
        </Text>
        <Badge fontSize="0.6rem" px="1.5" py="0.5" bg="rgba(236, 72, 153, 0.15)" color="#f472b6" borderRadius="sm" ml="auto">
          {open ? 'COLLAPSE' : 'EXPAND'}
        </Badge>
      </Flex>
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.25, ease: 'easeInOut' }}
          >
            <Box
              px="4"
              pb="3"
              borderTop="1px solid rgba(236, 72, 153, 0.15)"
              pt="3"
            >
              <Box fontSize="0.88rem" lineHeight="1.75" color="var(--text)">
                {children}
              </Box>
            </Box>
          </motion.div>
        )}
      </AnimatePresence>
    </Box>
  );
}

// ─── Before/After Comparison ───────────────────────────────────────────────────
// Side-by-side code/approach comparison. Shows the "painful way" and the
// "Aspire way" with visual emphasis on the improvement.

interface ComparisonData {
  before: { label: string; code: string; language?: string };
  after: { label: string; code: string; language?: string };
  caption?: string;
}

export function BeforeAfterComparison({ data }: { data: ComparisonData }) {
  return (
    <Box mb="4" borderRadius="sm" overflow="hidden" border="1px solid rgba(139, 92, 246, 0.2)">
      {data.caption && (
        <Flex align="center" gap="2" px="4" py="2" bg="rgba(139, 92, 246, 0.08)">
          <Text fontSize="xs" fontWeight="bold" color="#a78bfa" textTransform="uppercase" letterSpacing="wider">
            ⚡ Compare
          </Text>
          <Text fontSize="sm" color="var(--text)" fontWeight="500">{data.caption}</Text>
        </Flex>
      )}
      <Flex direction={{ base: 'column', md: 'row' }} gap="0">
        <Box flex="1" minWidth={0} borderRight={{ md: '1px solid rgba(139, 92, 246, 0.15)' }}>
          <Flex align="center" gap="2" px="3" py="2" bg="rgba(209, 52, 56, 0.1)" borderBottom="1px solid rgba(209, 52, 56, 0.15)">
            <Text fontSize="xs" fontWeight="bold" color="#f87171">✗ {data.before.label}</Text>
          </Flex>
          <Box
            as="pre"
            p="3"
            fontSize="0.82rem"
            lineHeight="1.6"
            bg="rgba(30, 20, 50, 0.5)"
            overflow="auto"
            m="0"
            fontFamily="'JetBrains Mono', 'Fira Code', monospace"
            color="var(--text)"
            whiteSpace="pre-wrap"
          >
            {data.before.code}
          </Box>
        </Box>
        <Box flex="1" minWidth={0}>
          <Flex align="center" gap="2" px="3" py="2" bg="rgba(34, 197, 94, 0.1)" borderBottom="1px solid rgba(34, 197, 94, 0.15)">
            <Text fontSize="xs" fontWeight="bold" color="#4ade80">✓ {data.after.label}</Text>
          </Flex>
          <Box
            as="pre"
            p="3"
            fontSize="0.82rem"
            lineHeight="1.6"
            bg="rgba(30, 20, 50, 0.5)"
            overflow="auto"
            m="0"
            fontFamily="'JetBrains Mono', 'Fira Code', monospace"
            color="var(--text)"
            whiteSpace="pre-wrap"
          >
            {data.after.code}
          </Box>
        </Box>
      </Flex>
    </Box>
  );
}

// ─── Scenario Block ────────────────────────────────────────────────────────────
// Presents a real-world scenario with multiple choices. Click to see what
// happens for each option. Creates "what would you do?" decision moments.

interface ScenarioOption {
  label: string;
  outcome: string;
  correct?: boolean;
}

interface ScenarioData {
  situation: string;
  options: ScenarioOption[];
}

export function ScenarioBlock({ data }: { data: ScenarioData }) {
  const [selectedIdx, setSelectedIdx] = useState<number | null>(null);

  return (
    <Box
      border="1px solid rgba(6, 182, 212, 0.3)"
      bg="rgba(6, 182, 212, 0.05)"
      borderRadius="sm"
      mb="4"
      overflow="hidden"
    >
      <Flex align="center" gap="2" px="4" pt="3" pb="1">
        <Text fontSize="xs" fontWeight="bold" color="#22d3ee" textTransform="uppercase" letterSpacing="wider">
          🎯 Scenario
        </Text>
      </Flex>
      <Box px="4" pb="3">
        <Text fontSize="0.9rem" lineHeight="1.7" color="var(--text-h)" fontWeight="500" mb="3" whiteSpace="pre-wrap">
          {data.situation}
        </Text>
        <Flex direction="column" gap="2">
          {data.options.map((opt, i) => {
            const isSelected = selectedIdx === i;
            const showOutcome = selectedIdx !== null;
            return (
              <Box key={i}>
                <Flex
                  as="button"
                  align="center"
                  gap="2"
                  px="3"
                  py="2"
                  cursor={selectedIdx === null ? 'pointer' : 'default'}
                  bg={
                    isSelected && opt.correct
                      ? 'rgba(34, 197, 94, 0.12)'
                      : isSelected
                        ? 'rgba(209, 52, 56, 0.12)'
                        : 'rgba(139, 92, 246, 0.06)'
                  }
                  border="1px solid"
                  borderColor={
                    isSelected && opt.correct
                      ? 'rgba(34, 197, 94, 0.4)'
                      : isSelected
                        ? 'rgba(209, 52, 56, 0.4)'
                        : 'rgba(139, 92, 246, 0.15)'
                  }
                  borderRadius="sm"
                  width="100%"
                  _hover={selectedIdx === null ? { bg: 'rgba(139, 92, 246, 0.12)', borderColor: 'rgba(139, 92, 246, 0.3)' } : {}}
                  transition="all 0.15s"
                  onClick={() => { if (selectedIdx === null) setSelectedIdx(i); }}
                >
                  <Badge
                    fontSize="0.7rem"
                    px="1.5"
                    py="0.5"
                    bg={
                      isSelected && opt.correct
                        ? 'rgba(34, 197, 94, 0.2)'
                        : isSelected
                          ? 'rgba(209, 52, 56, 0.2)'
                          : 'rgba(139, 92, 246, 0.15)'
                    }
                    color={isSelected && opt.correct ? '#4ade80' : isSelected ? '#f87171' : '#a78bfa'}
                    borderRadius="sm"
                  >
                    {String.fromCharCode(65 + i)}
                  </Badge>
                  <Text
                    fontSize="0.88rem"
                    color={isSelected ? 'var(--text-h)' : 'var(--text)'}
                    fontWeight={isSelected ? '600' : '400'}
                    textAlign="left"
                    overflowWrap="break-word"
                    wordBreak="break-word"
                  >
                    {opt.label}
                  </Text>
                  {showOutcome && opt.correct && (
                    <Text fontSize="sm" ml="auto" color="#4ade80">✓</Text>
                  )}
                </Flex>
                <AnimatePresence>
                  {isSelected && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      transition={{ duration: 0.25 }}
                    >
                      <Box px="3" py="2" ml="2" borderLeft="2px solid" borderColor={opt.correct ? '#4ade80' : '#f87171'}>
                        <Text fontSize="0.85rem" lineHeight="1.65" color="var(--text)" whiteSpace="pre-wrap">
                          {opt.outcome}
                        </Text>
                      </Box>
                    </motion.div>
                  )}
                </AnimatePresence>
              </Box>
            );
          })}
        </Flex>
        {selectedIdx !== null && (
          <Flex justify="flex-end" mt="2">
            <Flex
              as="button"
              align="center"
              gap="1"
              bg="transparent"
              border="none"
              cursor="pointer"
              color="#22d3ee"
              fontSize="xs"
              fontWeight="600"
              _hover={{ textDecoration: 'underline' }}
              onClick={() => setSelectedIdx(null)}
            >
              Try again
            </Flex>
          </Flex>
        )}
      </Box>
    </Box>
  );
}

// ─── Terminal Simulation ───────────────────────────────────────────────────────
// Animated terminal output that types out line by line with delays.
// Makes "what happens when you run X" feel real and alive.

interface TerminalLine {
  text: string;
  delay?: number;
  color?: string;
  type?: 'command' | 'output' | 'success' | 'error' | 'info';
}

interface TerminalData {
  title?: string;
  lines: TerminalLine[];
}

const lineColors: Record<string, string> = {
  command: '#a78bfa',
  success: '#4ade80',
  error: '#f87171',
  info: '#60a5fa',
  output: '#d4d4d8',
};

export function TerminalSimulation({ data }: { data: TerminalData }) {
  const [visibleLines, setVisibleLines] = useState(0);
  const [started, setStarted] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!started) return;
    if (visibleLines >= data.lines.length) return;

    const delay = data.lines[visibleLines]?.delay ?? 400;
    const timer = setTimeout(() => {
      setVisibleLines((v) => v + 1);
      // Auto-scroll to bottom
      if (containerRef.current) {
        containerRef.current.scrollTop = containerRef.current.scrollHeight;
      }
    }, delay);

    return () => clearTimeout(timer);
  }, [started, visibleLines, data.lines]);

  return (
    <Box
      border="1px solid rgba(139, 92, 246, 0.3)"
      borderRadius="sm"
      mb="4"
      overflow="hidden"
      bg="rgba(10, 8, 24, 0.8)"
    >
      <Flex
        align="center"
        gap="2"
        px="3"
        py="2"
        bg="rgba(139, 92, 246, 0.08)"
        borderBottom="1px solid rgba(139, 92, 246, 0.15)"
      >
        <Flex gap="1.5">
          <Box w="10px" h="10px" borderRadius="full" bg="#ef4444" />
          <Box w="10px" h="10px" borderRadius="full" bg="#eab308" />
          <Box w="10px" h="10px" borderRadius="full" bg="#22c55e" />
        </Flex>
        <Text fontSize="xs" color="#a78bfa" fontFamily="monospace" flex="1" textAlign="center">
          {data.title ?? 'Terminal'}
        </Text>
      </Flex>
      <Box
        ref={containerRef}
        p="3"
        maxH="300px"
        overflow="auto"
        fontFamily="'JetBrains Mono', 'Fira Code', monospace"
        fontSize="0.82rem"
        lineHeight="1.7"
        minH="60px"
      >
        {!started ? (
          <Flex
            as="button"
            align="center"
            justify="center"
            py="4"
            width="100%"
            bg="transparent"
            border="none"
            cursor="pointer"
            color="#a78bfa"
            gap="2"
            _hover={{ color: '#c4b5fd' }}
            onClick={() => { setStarted(true); setVisibleLines(1); }}
          >
            <Text fontSize="sm" fontWeight="600">▶ Run</Text>
          </Flex>
        ) : (
          data.lines.slice(0, visibleLines).map((line, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, x: -5 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.15 }}
            >
              <Text
                color={lineColors[line.type ?? line.color ?? 'output'] ?? '#d4d4d8'}
                whiteSpace="pre-wrap"
              >
                {line.type === 'command' ? `$ ${line.text}` : line.text}
              </Text>
            </motion.div>
          ))
        )}
        {started && visibleLines < data.lines.length && (
          <Text color="#a78bfa" display="inline">
            <motion.span
              animate={{ opacity: [1, 0] }}
              transition={{ duration: 0.8, repeat: Infinity }}
            >
              █
            </motion.span>
          </Text>
        )}
      </Box>
    </Box>
  );
}

// ─── Timeline Block ────────────────────────────────────────────────────────────
// Shows a sequence of events/steps as a vertical timeline with numbers.
// Great for "what happens when" explanations.

interface TimelineStep {
  title: string;
  description: string;
  duration?: string;
}

interface TimelineData {
  title?: string;
  steps: TimelineStep[];
}

export function TimelineBlock({ data }: { data: TimelineData }) {
  return (
    <Box
      border="1px solid rgba(6, 182, 212, 0.2)"
      bg="rgba(6, 182, 212, 0.03)"
      borderRadius="sm"
      mb="4"
      overflow="hidden"
    >
      {data.title && (
        <Flex align="center" gap="2" px="4" py="2" bg="rgba(6, 182, 212, 0.06)" borderBottom="1px solid rgba(6, 182, 212, 0.1)">
          <Text fontSize="xs" fontWeight="bold" color="#22d3ee" textTransform="uppercase" letterSpacing="wider">
            ⏱ {data.title}
          </Text>
        </Flex>
      )}
      <Box px="4" py="3">
        {data.steps.map((step, i) => (
          <Flex key={i} gap="3" position="relative" mb={i < data.steps.length - 1 ? '3' : '0'}>
            {/* Timeline connector */}
            {i < data.steps.length - 1 && (
              <Box
                position="absolute"
                left="13px"
                top="28px"
                bottom="-12px"
                w="2px"
                bg="rgba(6, 182, 212, 0.2)"
              />
            )}
            {/* Step number */}
            <Flex
              align="center"
              justify="center"
              minW="28px"
              h="28px"
              borderRadius="full"
              bg="rgba(6, 182, 212, 0.15)"
              border="2px solid rgba(6, 182, 212, 0.3)"
              flexShrink={0}
            >
              <Text fontSize="xs" fontWeight="bold" color="#22d3ee">{i + 1}</Text>
            </Flex>
            {/* Content */}
            <Box flex="1" pt="2px">
              <Flex align="center" gap="2" mb="0.5">
                <Text fontSize="0.88rem" fontWeight="600" color="var(--text-h)">{step.title}</Text>
                {step.duration && (
                  <Badge fontSize="0.6rem" px="1.5" py="0.5" bg="rgba(6, 182, 212, 0.1)" color="#22d3ee" borderRadius="sm">
                    {step.duration}
                  </Badge>
                )}
              </Flex>
              <Text fontSize="0.85rem" lineHeight="1.65" color="var(--text)">{step.description}</Text>
            </Box>
          </Flex>
        ))}
      </Box>
    </Box>
  );
}
