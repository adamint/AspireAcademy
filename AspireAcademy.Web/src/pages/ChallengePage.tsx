import { useState, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Box,
  Flex,
  Text,
  Heading,
  Button,
  Center,
  VStack,
  HStack,
  Input,
  Badge,
  Drawer,
  Skeleton,
} from '@chakra-ui/react';
import {
  FiUpload,
  FiSun,
  FiX,
  FiSend,
  FiArrowLeft,
  FiArrowRight,
} from 'react-icons/fi';
import Confetti from 'react-confetti';
import api from '../services/apiClient';
import { useGamificationStore } from '../store/gamificationStore';
import { retroCardProps, pixelFontProps } from '../theme/aspireTheme';
import CodeEditor from '../components/curriculum/CodeEditor';
import MarkdownContent from '../components/common/MarkdownContent';

// ── Types ────────────────────────────────────────────

interface TestCase {
  id: string;
  description: string;
  status: 'pending' | 'passed' | 'failed';
}

interface ChallengeData {
  id: string;
  title: string;
  lessonId: string;
  instructions: string;
  starterCode: string;
  language: string;
  testCases: TestCase[];
  hints: string[];
  nextLessonId?: string | null;
  isLocked: boolean;
}

// ── API response types (match backend DTOs) ─────────

interface ChallengeStepDto {
  id: string;
  instructionsMarkdown: string;
  starterCode: string;
  hints: string[];
  testCases: { id: string; name: string; type: string; expected?: string | null; description: string }[];
  requiredPackages: string[];
  stepTitle?: string | null;
}

interface LessonDetailResponse {
  id: string;
  title: string;
  type: string;
  nextLessonId?: string | null;
  isLocked?: boolean;
  challengeSteps?: ChallengeStepDto[];
}

interface SubmitApiResponse {
  compilationSuccess: boolean;
  compilationOutput: string;
  executionOutput: string;
  testResults: { testId: string; name: string; passed: boolean; description: string }[];
  allPassed: boolean;
  xpEarned: number;
  bonusXpEarned: number;
}

interface AiMessage {
  role: 'user' | 'assistant';
  content: string;
}

// ── Test case icon helper ────────────────────────────

function testIcon(status: string) {
  switch (status) {
    case 'passed': return '✅';
    case 'failed': return '❌';
    default: return '☐';
  }
}

// ── Component ────────────────────────────────────────

export default function ChallengePage() {
  const { lessonId } = useParams<{ lessonId: string }>();
  const navigate = useNavigate();
  const syncFromServer = useGamificationStore((s) => s.syncFromServer);

  // Data state
  const [challenge, setChallenge] = useState<ChallengeData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Editor state
  const [code, setCode] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [testCases, setTestCases] = useState<TestCase[]>([]);

  // Hints
  const [revealedHints, setRevealedHints] = useState(0);

  // AI sidebar
  const [aiOpen, setAiOpen] = useState(false);
  const [aiMessages, setAiMessages] = useState<AiMessage[]>([]);
  const [aiInput, setAiInput] = useState('');
  const [aiLoading, setAiLoading] = useState(false);

  // Success / Failure
  const [showSuccess, setShowSuccess] = useState(false);
  const [xpEarned, setXpEarned] = useState(0);
  const [failureMessage, setFailureMessage] = useState<string>('');

  // Fetch challenge data on mount
  const fetched = useState(false);
  if (!fetched[0]) {
    fetched[1](true);
    api
      .get<LessonDetailResponse>(`/lessons/${lessonId}`)
      .then((res) => {
        const data = res.data;
        const step = data.challengeSteps?.[0];
        if (!step) {
          setError('No challenge data available.');
          setLoading(false);
          return;
        }
        const mapped: ChallengeData = {
          id: step.id,
          title: data.title,
          lessonId: data.id,
          instructions: step.instructionsMarkdown,
          starterCode: step.starterCode,
          language: 'csharp',
          testCases: step.testCases.map((tc) => ({
            id: tc.id,
            description: tc.description || tc.name,
            status: 'pending' as const,
          })),
          hints: step.hints,
          nextLessonId: data.nextLessonId,
          isLocked: data.isLocked ?? false,
        };
        setChallenge(mapped);
        setCode(mapped.starterCode);
        setTestCases(mapped.testCases);
        setLoading(false);
      })
      .catch(() => {
        console.error('[ChallengePage] Failed to load challenge:', lessonId);
        setError('Failed to load challenge. Please try again.');
        setLoading(false);
      });
  }

  // ── Handlers ─────────────────────────────────────

  const handleSubmit = useCallback(async () => {
    if (!challenge || submitting || showSuccess) return;
    if (!code.trim()) {
      setFailureMessage('Please write some code before submitting.');
      return;
    }
    setSubmitting(true);
    setFailureMessage('');
    try {
      const res = await api.post<SubmitApiResponse>(
        `/challenges/${challenge.lessonId}/submit`,
        { code }
      );

      setTestCases((prev) =>
        prev.map((tc) => {
          const result = res.data.testResults.find((r) => r.testId === tc.id);
          return result
            ? { ...tc, status: result.passed ? 'passed' as const : 'failed' as const }
            : tc;
        })
      );

      if (res.data.allPassed) {
        setFailureMessage('');
        setXpEarned(res.data.xpEarned);
        setShowSuccess(true);
        if (res.data.xpEarned > 0) {
          const store = useGamificationStore.getState();
          syncFromServer({
            totalXp: store.totalXp + res.data.xpEarned,
            currentLevel: store.currentLevel,
            currentRank: store.currentRank,
            weeklyXp: store.weeklyXp + res.data.xpEarned,
            loginStreakDays: store.loginStreakDays,
          });
        }
      } else {
        const passed = res.data.testResults.filter((t) => t.passed).length;
        const total = res.data.testResults.length;
        setFailureMessage(`${passed}/${total} tests passed. Fix the failing tests and try again.`);
      }
    } catch {
      console.error('[ChallengePage] Failed to submit challenge:', lessonId);
      setFailureMessage('Submission failed. Please try again.');
    } finally {
      setSubmitting(false);
    }
  }, [challenge, code, syncFromServer, submitting, showSuccess, lessonId]);

  const handleRevealHint = useCallback(() => {
    setRevealedHints((n) => n + 1);
  }, []);

  const handleAiSend = useCallback(async () => {
    if (!aiInput.trim() || !challenge) return;
    const userMsg: AiMessage = { role: 'user', content: aiInput.trim() };
    setAiMessages((prev) => [...prev, userMsg]);
    setAiInput('');
    setAiLoading(true);
    try {
      const res = await api.post<{ reply: string }>('/ai/chat', {
        message: userMsg.content,
        context: {
          challengeId: challenge.id,
          code,
        },
      });
      setAiMessages((prev) => [
        ...prev,
        { role: 'assistant', content: res.data.reply },
      ]);
    } catch {
      console.error('[ChallengePage] Failed to get AI hint for challenge:', lessonId);
      setAiMessages((prev) => [
        ...prev,
        { role: 'assistant', content: 'Sorry, I could not process your request right now.' },
      ]);
    } finally {
      setAiLoading(false);
    }
  }, [aiInput, challenge, code, lessonId]);

  // ── Loading ──────────────────────────────────────

  if (loading) {
    return (
      <Flex direction="column" h="100%" minH="100vh">
        <Box px={5} py={3} bg="game.retroBg" borderBottom="2px solid" borderColor="game.pixelBorder">
          <Skeleton height="24px" width="250px" borderRadius="sm" />
        </Box>
        <Flex flex={1} overflow="hidden" direction={{ base: 'column', md: 'row' }}>
          <Box w={{ base: '100%', md: '40%' }} p={5} bg="game.retroBg">
            <Skeleton height="20px" width="200px" borderRadius="sm" mb={3} />
            <Skeleton height="120px" borderRadius="sm" mb={3} />
            <Skeleton height="80px" borderRadius="sm" />
          </Box>
          <Box flex={1} p={5}>
            <Skeleton height="300px" borderRadius="sm" mb={3} />
            <Skeleton height="120px" borderRadius="sm" />
          </Box>
        </Flex>
      </Flex>
    );
  }

  // ── Error ────────────────────────────────────────

  if (error || !challenge) {
    return (
      <Center h="60vh">
        <Box
          p={6}
          bg="game.retroBg"
          color="dark.text"
          {...retroCardProps}
          borderColor="game.error"
          textAlign="center"
        >
          <Text fontSize="lg" mb={3}>
            {error ?? 'Challenge not found.'}
          </Text>
          <Button
            variant="outline"
            borderColor="game.pixelBorder"
            color="dark.text"
            _hover={{ bg: 'content.hover' }}
            onClick={() => navigate(-1)}
          >
            <FiArrowLeft />
            Go back
          </Button>
        </Box>
      </Center>
    );
  }

  // ── Main render ──────────────────────────────────

  const isLocked = challenge.isLocked;

  return (
    <Flex direction="column" h="100%" minH="100vh">
      {/* Locked banner */}
      {isLocked && (
        <Box
          bg="rgba(255, 165, 0, 0.15)"
          border="1px solid"
          borderColor="orange.400"
          px="5"
          py="3"
          textAlign="center"
        >
          <Text fontSize="sm" color="orange.300">
            🔒 Unlock to attempt this challenge — complete prerequisites first
          </Text>
        </Box>
      )}
      {/* Celebration overlay */}
      {showSuccess && (
        <Flex
          position="fixed"
          inset={0}
          direction="column"
          align="center"
          justify="center"
          bg="blackAlpha.700"
          zIndex={1000}
        >
          <Confetti recycle={false} numberOfPieces={400} />
          <Box
            p={10}
            bg="game.retroBg"
            color="dark.text"
            textAlign="center"
            maxW="400px"
            w="90%"
            {...retroCardProps}
          >
            <Heading {...pixelFontProps} fontSize="md" mb={4}>
              🎉 All Tests Passed!
            </Heading>
            {xpEarned > 0 && (
              <Text
                {...pixelFontProps}
                fontSize="lg"
                color="game.xpGold"
                mb={4}
                css={{
                  animation: 'pulse 2s ease-in-out infinite',
                  '@keyframes pulse': {
                    '0%, 100%': { opacity: 1 },
                    '50%': { opacity: 0.7 },
                  },
                }}
              >
                +{xpEarned} XP
              </Text>
            )}
            <Button
              bg="aspire.600"
              color="white"
              _hover={{ bg: 'aspire.500' }}
              onClick={() => {
                setShowSuccess(false);
                if (challenge.nextLessonId) {
                  navigate(`/lessons/${challenge.nextLessonId}`);
                }
              }}
            >
              {challenge.nextLessonId ? 'Continue to Next Lesson' : 'Done!'}
              <FiArrowRight />
            </Button>
          </Box>
        </Flex>
      )}

      {/* Header */}
      <Flex
        justify="space-between"
        align="center"
        px={5}
        py={3}
        borderBottom="2px solid"
        borderColor="game.pixelBorder"
        bg="game.retroBg"
        wrap="wrap"
        gap={2}
      >
        <Heading size="sm" color="dark.text" display="flex" alignItems="center" gap={2}>
          💻 {challenge.title}
        </Heading>
        <Button
          variant="ghost"
          size="sm"
          color="dark.muted"
          _hover={{ color: 'gray.200' }}
          onClick={() => navigate(-1)}
        >
          <FiArrowLeft />
          Back
        </Button>
      </Flex>

      {/* Split pane: instructions 40% | editor 60% */}
      <Flex flex={1} overflow="hidden" direction={{ base: 'column', md: 'row' }}>
        {/* Left panel: instructions + tests + hints */}
        <Flex
          direction="column"
          w={{ base: '100%', md: '40%' }}
          minW="280px"
          borderRight={{ base: 'none', md: '2px solid' }}
          borderBottom={{ base: '2px solid', md: 'none' }}
          borderColor="game.pixelBorder"
          overflow="hidden"
          bg="game.retroBg"
        >
          {/* Instructions */}
          <Box
            flex={1}
            overflowY="auto"
            p={5}
            color="dark.text"
            fontSize="sm"
            lineHeight="tall"
            css={{
              '& h1, & h2, & h3': { color: 'var(--text-h)', marginTop: '1em', marginBottom: '0.5em' },
              '& code': { bg: 'var(--code-bg)', color: 'var(--accent)', px: '4px', borderRadius: '3px' },
              '& pre': { bg: 'var(--code-bg)', p: '12px', borderRadius: '4px', overflow: 'auto' },
              '& a': { color: '#9185D1' },
            }}
          >
            <MarkdownContent>{challenge.instructions}</MarkdownContent>
          </Box>

          {/* Failure banner */}
          {failureMessage && (
            <Box px={5} py={3} bg="red.900" borderTop="2px solid" borderBottom="2px solid" borderColor="red.500">
              <Text fontSize="sm" color="red.200" fontWeight="bold">
                ❌ {failureMessage}
              </Text>
            </Box>
          )}

          {/* Test cases */}
          <Box px={5} py={4} borderTop="2px solid" borderColor="game.pixelBorder">
            <Text
              fontSize="xs"
              fontWeight="bold"
              textTransform="uppercase"
              color="dark.muted"
              mb={2}
              letterSpacing="0.05em"
            >
              Tests</Text>
            <VStack align="stretch" gap={1}>
              {testCases.map((tc) => (
                <HStack key={tc.id} gap={2} py={1}>
                  <Text fontSize="md">{testIcon(tc.status)}</Text>
                  <Text fontSize="sm" color="dark.muted">{tc.description}</Text>
                </HStack>
              ))}
            </VStack>
          </Box>

          {/* Hints bar */}
          <Flex
            align="center"
            gap={2}
            px={5}
            py={3}
            borderTop="2px solid"
            borderColor="game.pixelBorder"
            wrap="wrap"
          >
            {challenge.hints.map((hint, i) => {
              const revealed = i < revealedHints;
              return revealed ? (
                <Box
                  key={i}
                  p={2}
                  bg="content.subtle"
                  borderRadius="sm"
                  border="1px solid"
                  borderColor="game.pixelBorder"
                  fontSize="xs"
                  color="yellow.200"
                >
                  💡 {hint}
                </Box>
              ) : (
                <Button
                  key={i}
                  size="xs"
                  variant="outline"
                  borderColor="game.pixelBorder"
                  color="dark.muted"
                  _hover={{ bg: 'content.hover', color: 'yellow.200' }}
                  onClick={i === revealedHints ? handleRevealHint : undefined}
                  disabled={i !== revealedHints}
                >
                  <FiSun />
                  Hint {i + 1}
                </Button>
              );
            })}
            <Button
              size="xs"
              variant="outline"
              borderColor="aspire.600"
              color="aspire.400"
              _hover={{ bg: 'aspire.900' }}
              onClick={() => setAiOpen(true)}
            >
              🤖 Ask AI
            </Button>
          </Flex>
        </Flex>

        {/* Right panel: editor + actions */}
        <Flex direction="column" flex={1} overflow="hidden">
          {/* Editor */}
          <Box flex={1} minH="300px">
            <CodeEditor
              value={code}
              onChange={(v) => { setCode(v); setFailureMessage(''); }}
              language={challenge.language || 'csharp'}
            />
          </Box>

          {/* Action bar */}
          <HStack
            justify="flex-end"
            gap={2}
            px={3}
            py={2}
            bg="#252526"
            borderTop="2px solid"
            borderColor="game.pixelBorder"
          >
            <Button
              data-testid="challenge-submit"
              size="sm"
              bg="aspire.600"
              color="white"
              _hover={{ bg: 'aspire.500' }}
              onClick={handleSubmit}
              disabled={submitting || showSuccess || !code.trim() || isLocked}
            >
              <FiUpload />
              {submitting ? 'Checking...' : 'Check & Submit'}
            </Button>
          </HStack>
        </Flex>
      </Flex>

      {/* AI Tutor drawer */}
      <Drawer.Root
        open={aiOpen}
        onOpenChange={(e) => setAiOpen(e.open)}
        placement="end"
        size="md"
      >
        <Drawer.Backdrop />
        <Drawer.Positioner>
          <Drawer.Content bg="dark.sidebar" color="whiteAlpha.900" borderLeft="3px solid" borderColor="game.pixelBorder">
            <Drawer.Header borderBottom="2px solid" borderColor="game.pixelBorder">
              <Flex justify="space-between" align="center" w="100%">
                <Drawer.Title {...pixelFontProps} fontSize="xs">
                  🤖 AI Tutor
                </Drawer.Title>
                <Drawer.CloseTrigger asChild>
                  <Button
                    variant="ghost"
                    size="sm"
                    color="gray.400"
                    _hover={{ color: 'gray.200' }}
                  >
                    <FiX />
                  </Button>
                </Drawer.CloseTrigger>
              </Flex>
            </Drawer.Header>

            <Drawer.Body display="flex" flexDirection="column" p={0}>
              {/* Messages */}
              <Flex
                flex={1}
                direction="column"
                gap={3}
                p={3}
                overflowY="auto"
              >
                {aiMessages.length === 0 && (
                  <Text color="dark.muted" p={3} fontStyle="italic" fontSize="sm">
                    Ask me for hints about this challenge!
                  </Text>
                )}
                {aiMessages.map((msg, i) => (
                  <Box
                    key={i}
                    alignSelf={msg.role === 'user' ? 'flex-end' : 'flex-start'}
                    maxW="85%"
                    px={4}
                    py={2}
                    borderRadius="lg"
                    fontSize="sm"
                    lineHeight="tall"
                    css={{ wordBreak: 'break-word' }}
                    bg={msg.role === 'user' ? 'aspire.700' : 'whiteAlpha.100'}
                    color={msg.role === 'user' ? 'white' : 'gray.200'}
                  >
                    {msg.content}
                  </Box>
                ))}
                {aiLoading && (
                  <Badge variant="outline" colorPalette="purple" alignSelf="flex-start">
                    Thinking...
                  </Badge>
                )}
              </Flex>

              {/* Chat input */}
              <HStack p={3} borderTop="2px solid" borderColor="game.pixelBorder" gap={2}>
                <Input
                  flex={1}
                  placeholder="Ask for a hint..."
                  value={aiInput}
                  onChange={(e) => setAiInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      handleAiSend();
                    }
                  }}
                  disabled={aiLoading}
                  bg="whiteAlpha.100"
                  border="2px solid"
                  borderColor="game.pixelBorder"
                  color="gray.100"
                  _placeholder={{ color: 'dark.muted' }}
                  _focus={{ borderColor: 'aspire.500' }}
                  size="sm"
                />
                <Button
                  size="sm"
                  bg="aspire.600"
                  color="white"
                  _hover={{ bg: 'aspire.500' }}
                  onClick={handleAiSend}
                  disabled={aiLoading || !aiInput.trim()}
                >
                  <FiSend />
                </Button>
              </HStack>
            </Drawer.Body>
          </Drawer.Content>
        </Drawer.Positioner>
      </Drawer.Root>
    </Flex>
  );
}
