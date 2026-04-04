import { useState, useCallback, useEffect, useRef } from 'react';
import { useParams, useNavigate, Link as RouterLink } from 'react-router-dom';
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
import { FiArrowLeft, FiArrowRight, FiClock, FiSkipForward, FiUsers } from 'react-icons/fi';
import { AnimatePresence, motion } from 'framer-motion';
import { pixelFontProps } from '../theme/aspireTheme';
import { LessonType, ProgressStatus } from '../constants';
import api from '../services/apiClient';
import { useAuthStore } from '../store/authStore';
import { useGamificationStore } from '../store/gamificationStore';
import type { LessonDetail, CompleteResponse } from '../types/curriculum';
import MarkdownContent from '../components/common/MarkdownContent';
import EncouragingMessage from '../components/gamification/EncouragingMessage';
import NextAchievementTeaser from '../components/gamification/NextAchievementTeaser';

const lessonTypeLabel: Record<string, string> = {
  learn: '📖 Learn',
  quiz: '🧪 Quiz',
  challenge: '💻 Challenge',
  build: '🏗️ Build',
  boss: '🎮 Boss',
  'boss-battle': '🎮 Boss Battle',
  'build-project': '🏗️ Build Project',
};

export default function LessonPage() {
  const { lessonId } = useParams<{ lessonId: string }>();

  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const syncFromServer = useGamificationStore((s) => s.syncFromServer);
  const setPendingLevelUp = useGamificationStore((s) => s.setPendingLevelUp);
  const addPendingAchievement = useGamificationStore((s) => s.addPendingAchievement);
  const token = useAuthStore((s) => s.token);
  const user = useAuthStore((s) => s.user);
  const isAuthenticated = !!token && !!user;

  const [xpAnim, setXpAnim] = useState<number | null>(null);
  const xpAnimTimerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  useEffect(() => {
    return () => { if (xpAnimTimerRef.current) clearTimeout(xpAnimTimerRef.current); };
  }, []);

  const { data: lesson, isLoading } = useQuery<LessonDetail>({
    queryKey: ['lesson', lessonId],
    queryFn: () => api.get(`/lessons/${lessonId}`).then((r) => r.data).catch((err) => {
      console.error('[LessonPage] Failed to fetch lesson:', err);
      throw err;
    }),
    enabled: !!lessonId,
  });

  const { data: lessonStats } = useQuery<{ completionCount: number }>({
    queryKey: ['lesson-stats', lessonId],
    queryFn: () => api.get(`/lessons/${lessonId}/stats`).then((r) => r.data).catch((err) => {
      console.error('[LessonPage] Failed to fetch lesson stats:', err);
      throw err;
    }),
    enabled: !!lessonId,
  });

  useEffect(() => {
    document.title = lesson ? `${lesson.title} | Aspire Learn` : 'Aspire Learn';
  }, [lesson]);

  const completeMutation = useMutation<CompleteResponse, Error>({
    mutationFn: () =>
      api.post('/progress/complete', { lessonId }).then((r) => r.data),
    onSuccess: (data) => {
      setXpAnim(data.xpEarned);
      xpAnimTimerRef.current = setTimeout(() => setXpAnim(null), 1800);

      syncFromServer({
        totalXp: data.totalXp,
        currentLevel: data.currentLevel,
        currentRank: data.currentRank,
        weeklyXp: data.weeklyXp ?? useGamificationStore.getState().weeklyXp,
        loginStreakDays: useGamificationStore.getState().loginStreakDays,
      });

      if (data.levelUp) {
        setPendingLevelUp(data.levelUp);
      }

      data.achievements?.forEach((a) => addPendingAchievement(a));

      queryClient.invalidateQueries({ queryKey: ['lesson', lessonId] });
      queryClient.invalidateQueries({ queryKey: ['worlds'] });
      queryClient.invalidateQueries({ queryKey: ['world'] });
      queryClient.invalidateQueries({ queryKey: ['worldModules'] });
      queryClient.invalidateQueries({ queryKey: ['xp'] });
    },
    onError: (err) => {
      console.error('[LessonPage] Failed to complete lesson:', err);
    },
  });

  const skipMutation = useMutation({
    mutationFn: () =>
      api.post('/progress/skip', { lessonId }).then((r) => r.data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['lesson', lessonId] });
      queryClient.invalidateQueries({ queryKey: ['worlds'] });
      queryClient.invalidateQueries({ queryKey: ['world'] });
      queryClient.invalidateQueries({ queryKey: ['worldModules'] });
    },
    onError: (err) => {
      console.error('[LessonPage] Failed to skip lesson:', err);
    },
  });

  const unskipMutation = useMutation({
    mutationFn: () =>
      api.post('/progress/unskip', { lessonId }).then((r) => r.data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['lesson', lessonId] });
      queryClient.invalidateQueries({ queryKey: ['worlds'] });
      queryClient.invalidateQueries({ queryKey: ['world'] });
      queryClient.invalidateQueries({ queryKey: ['worldModules'] });
    },
    onError: (err) => {
      console.error('[LessonPage] Failed to unskip lesson:', err);
    },
  });

  // Reset mutation states when navigating to a different lesson
  useEffect(() => {
    return () => {
      completeMutation.reset();
      skipMutation.reset();
      unskipMutation.reset();
      setXpAnim(null);
    };
  }, [lessonId]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleComplete = useCallback(() => {
    if (!lesson?.isCompleted && !completeMutation.isPending) {
      completeMutation.mutate();
    }
  }, [lesson, completeMutation]);

  const navigateToLesson = (id: string | undefined, type?: string) => {
    if (!id) return;
    switch (type) {
      case LessonType.Quiz:
        navigate(`/quizzes/${id}`);
        break;
      case LessonType.Challenge:
      case LessonType.Build:
      case LessonType.BossBattle:
      case LessonType.BuildProject:
        navigate(`/challenges/${id}`);
        break;
      default:
        navigate(`/lessons/${id}`);
        break;
    }
  };

  // Redirect non-learn lessons to the correct page
  useEffect(() => {
    if (!lesson || isLoading) return;
    if (lesson.type !== LessonType.Learn) {
      navigateToLesson(lesson.id, lesson.type);
    }
  }, [lesson, isLoading]); // eslint-disable-line react-hooks/exhaustive-deps

  if (isLoading) {
    return (
      <Box maxW="820px" mx="auto" p="6" display="flex" flexDirection="column" gap="5" role="status" aria-busy="true" aria-label="Loading lesson">
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
  const isSkipped = lesson.status === ProgressStatus.Skipped;
  const isLocked = lesson.isLocked;

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
        color="aspire.accent"
        fontSize="sm"
        bg="transparent"
        border="none"
        p="0"
        _hover={{ textDecoration: 'underline' }}
        onClick={() => {
          if (lesson.worldId) {
            navigate(`/worlds/${lesson.worldId}`);
          } else {
            navigate(-1);
          }
        }}
      >
        <FiArrowLeft />
        <Text>Back to {lesson.moduleName}</Text>
      </Flex>

      {/* Header */}
      <Flex align="center" gap="3" flexWrap="wrap">
        <Badge colorPalette="purple" variant="outline">
          {typeInfo}
        </Badge>
        <Flex align="center" gap="1" color="aspire.accent">
          <FiClock size={14} />
          <Text fontSize="xs">~{lesson.estimatedMinutes} min</Text>
        </Flex>
      </Flex>

      <Heading as="h1" size="xl">
        {lesson.title}
      </Heading>

      {lessonStats && lessonStats.completionCount > 0 && (
        <Flex align="center" gap="1.5" data-testid="lesson-completion-count">
          <FiUsers size={14} color="var(--chakra-colors-aspire-400)" />
          <Text fontSize="sm" color="gray.400">
            {lessonStats.completionCount.toLocaleString()} {lessonStats.completionCount === 1 ? 'learner' : 'learners'} completed
          </Text>
        </Flex>
      )}

      {/* Locked preview banner */}
      {isLocked && (
        <Box
          bg="rgba(255, 165, 0, 0.15)"
          border="1px solid"
          borderColor="orange.400"
          p="4"
          borderRadius="sm"
          textAlign="center"
        >
          <Text fontSize="sm" color="orange.300">
            🔒 Preview Mode — complete prerequisites to unlock this lesson and earn XP
          </Text>
        </Box>
      )}

      {/* Skipped banner */}
      {isSkipped && (
        <Box
          bg="rgba(100, 100, 200, 0.15)"
          border="1px solid"
          borderColor="aspire.400"
          p="4"
          borderRadius="sm"
          textAlign="center"
        >
          <Flex align="center" justify="center" gap="3" flexWrap="wrap">
            <Text fontSize="sm" color="aspire.300">
              ⏭️ Skipped — you can come back later
            </Text>
            <Button
              size="sm"
              variant="outline"
              colorPalette="purple"
              onClick={() => unskipMutation.mutate()}
              disabled={unskipMutation.isPending}
              data-testid="undo-skip-btn"
            >
              {unskipMutation.isPending ? 'Reverting…' : 'Undo Skip'}
            </Button>
          </Flex>
        </Box>
      )}

      {/* Content */}
      <Card.Root bg="dark.card">
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
          <MarkdownContent>{lesson.contentMarkdown}</MarkdownContent>
        </Card.Body>
      </Card.Root>

      {/* Mark Complete / Skip / Sign-up CTA */}
      {!isLocked && !isSkipped && (
        <Flex justify="center" gap="3" py="2" flexWrap="wrap">
          {isAuthenticated ? (
            <>
              <Button
                colorPalette={lesson.isCompleted ? 'green' : 'purple'}
                size="lg"
                disabled={lesson.isCompleted || completeMutation.isPending || completeMutation.isSuccess}
                onClick={handleComplete}
                data-testid="mark-complete-btn"
              >
                {lesson.isCompleted || completeMutation.isSuccess
                  ? '✅ Completed'
                  : completeMutation.isPending
                    ? 'Completing…'
                    : `Mark Complete (+${lesson.xpReward} XP)`}
              </Button>
              {!lesson.isCompleted && !completeMutation.isSuccess && (
                <Button
                  variant="outline"
                  size="lg"
                  colorPalette="gray"
                  onClick={() => skipMutation.mutate()}
                  disabled={skipMutation.isPending}
                  data-testid="skip-lesson-btn"
                >
                  <FiSkipForward />
                  {skipMutation.isPending ? 'Skipping…' : 'Skip Lesson'}
                </Button>
              )}
            </>
          ) : (
            <Button
              asChild
              colorPalette="purple"
              size="lg"
            >
              <RouterLink to="/register">🔐 Sign up to track your progress</RouterLink>
            </Button>
          )}
        </Flex>
      )}

      {completeMutation.isError && (
        <Box bg="rgba(209, 52, 56, 0.15)" color="game.error" p="3" borderRadius="sm" textAlign="center">
          Failed to mark complete. Please try again.
        </Box>
      )}

      {/* Encouraging message after completion */}
      {(lesson.isCompleted || completeMutation.isSuccess) && (
        <EncouragingMessage xpEarned={xpAnim ?? lesson.xpReward} />
      )}

      {/* Next achievement teaser */}
      {(lesson.isCompleted || completeMutation.isSuccess) && (
        <NextAchievementTeaser />
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
          onClick={() => navigateToLesson(lesson.previousLessonId, lesson.previousLessonType)}
        >
          <FiArrowLeft />
          <Text ml="1">{lesson.previousLessonTitle ?? 'Previous'}</Text>
        </Button>
        <Button
          variant="ghost"
          size="sm"
          disabled={!lesson.nextLessonId}
          onClick={() => navigateToLesson(lesson.nextLessonId, lesson.nextLessonType)}
        >
          <Text mr="1">{lesson.nextLessonTitle ?? 'Next'}</Text>
          <FiArrowRight />
        </Button>
      </Flex>
    </Box>
  );
}
