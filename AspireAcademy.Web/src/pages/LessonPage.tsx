import { useState, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Box,
  Flex,
  Text,
  Button,
  Card,
  Badge,
  Heading,
  Skeleton,
} from '@chakra-ui/react';
import { FiArrowLeft, FiArrowRight, FiClock } from 'react-icons/fi';
import { AnimatePresence, motion } from 'framer-motion';
import ReactMarkdown from 'react-markdown';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { oneDark } from 'react-syntax-highlighter/dist/esm/styles/prism';
import { pixelFontProps } from '../theme/aspireTheme';
import api from '../services/apiClient';
import { useGamificationStore } from '../store/gamificationStore';
import type { LessonDetail, CompleteResponse } from '../types/curriculum';
import type { Components } from 'react-markdown';

const lessonTypeLabel: Record<string, { emoji: string; label: string }> = {
  learn: { emoji: '📖', label: 'Learn' },
  quiz: { emoji: '🧪', label: 'Quiz' },
  challenge: { emoji: '💻', label: 'Challenge' },
  build: { emoji: '🏗️', label: 'Build' },
  boss: { emoji: '🎮', label: 'Boss' },
};

function extractText(node: React.ReactNode): string {
  if (typeof node === 'string') return node;
  if (Array.isArray(node)) return node.map(extractText).join('');
  if (node && typeof node === 'object' && 'props' in node) {
    return extractText((node as React.ReactElement).props.children);
  }
  return '';
}

export default function LessonPage() {
  const { lessonId } = useParams<{ lessonId: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const syncFromServer = useGamificationStore((s) => s.syncFromServer);
  const setPendingLevelUp = useGamificationStore((s) => s.setPendingLevelUp);
  const addPendingAchievement = useGamificationStore((s) => s.addPendingAchievement);

  const [xpAnim, setXpAnim] = useState<number | null>(null);

  const { data: lesson, isLoading } = useQuery<LessonDetail>({
    queryKey: ['lesson', lessonId],
    queryFn: () => api.get(`/lessons/${lessonId}`).then((r) => r.data).catch((err) => {
      console.error('[LessonPage] Failed to fetch lesson:', err);
      throw err;
    }),
    enabled: !!lessonId,
  });

  const completeMutation = useMutation<CompleteResponse, Error>({
    mutationFn: () =>
      api.post('/progress/complete', { lessonId }).then((r) => r.data),
    onSuccess: (data) => {
      setXpAnim(data.xpEarned);
      setTimeout(() => setXpAnim(null), 1800);

      syncFromServer({
        totalXp: data.totalXp,
        currentLevel: data.currentLevel,
        currentRank: data.currentRank,
        weeklyXp: 0,
        loginStreakDays: 0,
      });

      if (data.levelUp) {
        setPendingLevelUp(data.levelUp);
      }

      data.achievements?.forEach((a) => addPendingAchievement(a));

      queryClient.invalidateQueries({ queryKey: ['lesson', lessonId] });
      queryClient.invalidateQueries({ queryKey: ['worlds'] });
      queryClient.invalidateQueries({ queryKey: ['xp'] });
    },
    onError: (err) => {
      console.error('[LessonPage] Failed to complete lesson:', err);
    },
  });

  const handleComplete = useCallback(() => {
    if (!lesson?.isCompleted && !completeMutation.isPending) {
      completeMutation.mutate();
    }
  }, [lesson, completeMutation]);

  const navigateToLesson = (id: string | undefined) => {
    if (id) navigate(`/lessons/${id}`);
  };

  if (isLoading) {
    return (
      <Box maxW="820px" mx="auto" p="6" display="flex" flexDirection="column" gap="5">
        <Skeleton height="20px" width="200px" borderRadius="sm" />
        <Skeleton height="32px" width="400px" borderRadius="sm" />
        <Skeleton height="400px" borderRadius="sm" />
      </Box>
    );
  }

  if (!lesson) {
    return (
      <Box maxW="820px" mx="auto" p="6">
        <Text fontSize="lg">Lesson not found.</Text>
      </Box>
    );
  }

  const typeInfo = lessonTypeLabel[lesson.type] ?? lessonTypeLabel.learn;

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
            background: '#2D2D2D',
            color: '#E0E0E0',
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
          color="aspire.600"
        >
          {children}
        </Box>
      );
    },
  };

  return (
    <Box maxW="820px" mx="auto" p="6" display="flex" flexDirection="column" gap="5">
      {/* XP Animation */}
      <AnimatePresence>
        {xpAnim !== null && (
          <motion.div
            initial={{ opacity: 1, y: 0 }}
            animate={{ opacity: 0, y: -60 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 1.5, ease: 'easeOut' }}
            style={{
              position: 'fixed',
              bottom: 100,
              left: '50%',
              transform: 'translateX(-50%)',
              zIndex: 1000,
            }}
          >
            <Badge
              {...pixelFontProps}
              fontSize="md"
              px="5"
              py="2"
              bg="game.xpGold"
              color="black"
              borderRadius="md"
            >
              +{xpAnim} XP
            </Badge>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Back nav */}
      <Flex
        as="button"
        align="center"
        gap="1"
        cursor="pointer"
        color="aspire.400"
        fontSize="sm"
        bg="transparent"
        border="none"
        p="0"
        _hover={{ textDecoration: 'underline' }}
        onClick={() => navigate(`/worlds/${lesson.worldId}`)}
      >
        <FiArrowLeft />
        <Text>Back to {lesson.moduleName}</Text>
      </Flex>

      {/* Header */}
      <Flex align="center" gap="3" flexWrap="wrap">
        <Badge colorPalette="purple" variant="outline">
          {typeInfo.emoji} {typeInfo.label}
        </Badge>
        <Flex align="center" gap="1" color="aspire.400">
          <FiClock size={14} />
          <Text fontSize="xs">~{lesson.estimatedMinutes} min</Text>
        </Flex>
      </Flex>

      <Heading as="h1" size="xl">
        {lesson.title}
      </Heading>

      {/* Content */}
      <Card.Root>
        <Card.Body
          p="6"
          lineHeight="1.7"
          fontSize="md"
          css={{
            '& h1, & h2, & h3': {
              marginTop: '24px',
              marginBottom: '8px',
            },
            '& p': { marginBottom: '12px' },
            '& ul, & ol': {
              paddingLeft: '24px',
              marginBottom: '12px',
            },
          }}
        >
          <ReactMarkdown components={markdownComponents}>
            {lesson.contentMarkdown}
          </ReactMarkdown>
        </Card.Body>
      </Card.Root>

      {/* Mark Complete */}
      <Flex justify="center" py="2">
        <Button
          colorPalette={lesson.isCompleted ? 'green' : 'purple'}
          size="lg"
          disabled={lesson.isCompleted || completeMutation.isPending}
          onClick={handleComplete}
        >
          {lesson.isCompleted
            ? '✅ Completed'
            : completeMutation.isPending
              ? 'Completing…'
              : `Mark Complete (+${lesson.xpReward} XP)`}
        </Button>
      </Flex>

      {completeMutation.isError && (
        <Box bg="rgba(209, 52, 56, 0.15)" color="game.error" p="3" borderRadius="sm" textAlign="center">
          Failed to mark complete. Please try again.
        </Box>
      )}

      {/* Previous / Next */}
      <Flex
        justify="space-between"
        align="center"
        pt="4"
        borderTop="1px solid"
        borderColor="game.pixelBorder"
      >
        <Button
          variant="ghost"
          size="sm"
          disabled={!lesson.previousLessonId}
          onClick={() => navigateToLesson(lesson.previousLessonId)}
        >
          <FiArrowLeft />
          <Text ml="1">{lesson.previousLessonTitle ?? 'Previous'}</Text>
        </Button>
        <Button
          variant="ghost"
          size="sm"
          disabled={!lesson.nextLessonId}
          onClick={() => navigateToLesson(lesson.nextLessonId)}
        >
          <Text mr="1">{lesson.nextLessonTitle ?? 'Next'}</Text>
          <FiArrowRight />
        </Button>
      </Flex>
    </Box>
  );
}
