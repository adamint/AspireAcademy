import { useState, useCallback } from 'react';
import { useParams, useNavigate, Link as RouterLink } from 'react-router-dom';
import {
  Box,
  Flex,
  Text,
  Heading,
  Button,
  Spinner,
  Center,
  VStack,
  Skeleton,
} from '@chakra-ui/react';
import { FiSend, FiArrowRight, FiArrowLeft } from 'react-icons/fi';
import api from '../services/apiClient';
import { useAuthStore } from '../store/authStore';
import { useGamificationStore } from '../store/gamificationStore';
import { retroCardProps, pixelFontProps } from '../theme/aspireTheme';
import QuestionCard from '../components/curriculum/QuestionCard';
import QuestionFeedback from '../components/curriculum/QuestionFeedback';
import QuizResults from '../components/curriculum/QuizResults';

// ── Types ────────────────────────────────────────────

export interface QuizOption {
  id: string;
  text: string;
}

export interface QuizQuestion {
  id: string;
  text: string;
  questionType: 'multiple-choice' | 'multi-select' | 'code-prediction' | 'fill-in-blank';
  options?: QuizOption[];
  codeSnippet?: string;
  points: number;
}

interface QuizData {
  id: string;
  title: string;
  lessonId: string;
  questions: QuizQuestion[];
  passingScore: number;
  nextLessonId?: string | null;
  isLocked: boolean;
}

interface AnswerResponse {
  correct: boolean;
  explanation: string;
  correctOptionIds?: string[];
  pointsAwarded: number;
}

export interface QuestionResult {
  questionId: string;
  correct: boolean;
  pointsAwarded: number;
}

interface QuizSubmitResponse {
  score: number;
  maxScore: number;
  passed: boolean;
  xpEarned: number;
  results: QuestionResult[];
}

// ── Component ────────────────────────────────────────

export default function QuizPage() {
  const { lessonId } = useParams<{ lessonId: string }>();
  const navigate = useNavigate();
  const syncFromServer = useGamificationStore((s) => s.syncFromServer);
  const token = useAuthStore((s) => s.token);
  const user = useAuthStore((s) => s.user);
  const isAuthenticated = !!token && !!user;

  const [quiz, setQuiz] = useState<QuizData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [currentIndex, setCurrentIndex] = useState(0);
  const [selectedAnswer, setSelectedAnswer] = useState<string | string[] | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [feedback, setFeedback] = useState<AnswerResponse | null>(null);

  const [runningScore, setRunningScore] = useState(0);
  const [questionResults, setQuestionResults] = useState<QuestionResult[]>([]);
  const [quizResult, setQuizResult] = useState<QuizSubmitResponse | null>(null);
  const [finalizingQuiz, setFinalizingQuiz] = useState(false);
  const [submittedAnswers, setSubmittedAnswers] = useState<{ questionId: string; selectedOptionIds?: string[]; freeTextAnswer?: string }[]>([]);

  // Fetch quiz data on mount
  const fetched = useState(false);
  if (!fetched[0]) {
    fetched[1](true);
    api
      .get(`/lessons/${lessonId}`)
      .then((res) => {
        const lesson = res.data as Record<string, unknown>;
        const quizData = lesson.quiz as Record<string, unknown> | undefined;
        const rawQuestions = (quizData?.questions ?? []) as Record<string, unknown>[];

        // Map API question shape to frontend QuizQuestion shape
        const questions: QuizQuestion[] = rawQuestions.map((q) => ({
          id: q.id as string,
          text: (q.questionText ?? q.text) as string,
          questionType: ((q.questionType as string) ?? '').replace(/_/g, '-') as QuizQuestion['questionType'],
          options: Array.isArray(q.options)
            ? q.options.map((o: unknown) => {
                if (typeof o === 'object' && o !== null && 'id' in o && 'text' in o) {
                  const obj = o as Record<string, string>;
                  return { id: obj.id, text: obj.text } as QuizOption;
                }
                const str = String(o);
                return { id: str, text: str } as QuizOption;
              })
            : undefined,
          codeSnippet: q.codeSnippet as string | undefined,
          points: (q.points ?? 0) as number,
        }));

        setQuiz({
          id: lesson.id as string,
          title: lesson.title as string,
          lessonId: lessonId!,
          questions,
          passingScore: (quizData?.passingScore ?? quizData?.passingScorePercent ?? 70) as number,
          nextLessonId: (lesson.nextLessonId as string) ?? null,
          isLocked: (lesson.isLocked as boolean) ?? false,
        });
        setLoading(false);
      })
      .catch(() => {
        console.error('[QuizPage] Failed to load quiz for lesson:', lessonId);
        setError('Failed to load quiz. Please try again.');
        setLoading(false);
      });
  }

  const currentQuestion = quiz?.questions[currentIndex] ?? null;
  const isLastQuestion = quiz ? currentIndex >= quiz.questions.length - 1 : false;
  const maxScore = quiz?.questions.reduce((sum, q) => sum + q.points, 0) ?? 0;

  const handleSubmitAnswer = useCallback(async () => {
    if (!quiz || !currentQuestion || selectedAnswer === null) return;
    setSubmitting(true);
    setFeedback(null);

    try {
      const res = await api.post<AnswerResponse>(
        `/quizzes/${quiz.id}/answer`,
        {
          questionId: currentQuestion.id,
          answer: selectedAnswer,
        }
      );
      const fb = res.data;
      setFeedback(fb);
      setRunningScore((s) => s + fb.pointsAwarded);
      setQuestionResults((prev) => [
        ...prev,
        {
          questionId: currentQuestion.id,
          correct: fb.correct,
          pointsAwarded: fb.pointsAwarded,
        },
      ]);
      // Track the actual answer for final submission
      const answerEntry: { questionId: string; selectedOptionIds?: string[]; freeTextAnswer?: string } = { questionId: currentQuestion.id };
      if (currentQuestion.questionType === 'fill-in-blank') {
        answerEntry.freeTextAnswer = typeof selectedAnswer === 'string' ? selectedAnswer : undefined;
      } else {
        answerEntry.selectedOptionIds = Array.isArray(selectedAnswer) ? selectedAnswer : selectedAnswer ? [selectedAnswer] : undefined;
      }
      setSubmittedAnswers((prev) => [...prev, answerEntry]);
    } catch {
      console.error('[QuizPage] Failed to submit answer for question:', currentQuestion.id);
      setFeedback({
        correct: false,
        explanation: 'Something went wrong submitting your answer.',
        pointsAwarded: 0,
      });
    } finally {
      setSubmitting(false);
    }
  }, [quiz, currentQuestion, selectedAnswer]);

  const handleNext = useCallback(async () => {
    if (!quiz || finalizingQuiz) return;

    if (isLastQuestion) {
      setFinalizingQuiz(true);
      try {
        const res = await api.post<QuizSubmitResponse>(
          `/quizzes/${lessonId}/submit`,
          { answers: [...submittedAnswers] }
        );
        setQuizResult(res.data);
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
      } catch {
        console.error('[QuizPage] Failed to submit quiz for lesson:', lessonId);
        const fallbackPercentage = maxScore > 0 ? Math.round((runningScore / maxScore) * 100) : 0;
        setQuizResult({
          score: runningScore,
          maxScore,
          passed: fallbackPercentage >= (quiz.passingScore ?? 70),
          xpEarned: 0,
          results: questionResults,
        });
      }
    } else {
      setCurrentIndex((i) => i + 1);
      setSelectedAnswer(null);
      setFeedback(null);
    }
  }, [quiz, lessonId, isLastQuestion, questionResults, submittedAnswers, runningScore, maxScore, syncFromServer, finalizingQuiz]);

  // ── Loading ──────────────────────────────────────

  if (loading) {
    return (
      <Box maxW="720px" mx="auto" p={{ base: 4, md: 8 }} display="flex" flexDirection="column" gap="5">
        <Skeleton height="32px" width="300px" borderRadius="sm" />
        <Skeleton height="16px" width="200px" borderRadius="sm" />
        <Skeleton height="200px" borderRadius="sm" />
        <Skeleton height="200px" borderRadius="sm" />
        <Skeleton height="40px" width="150px" borderRadius="sm" alignSelf="flex-end" />
      </Box>
    );
  }

  // ── Error ────────────────────────────────────────

  if (error || !quiz) {
    return (
      <Center h="60vh">
        <VStack gap={4}>
          <Box
            p={6}
            bg="game.retroBg"
            color="dark.text"
            {...retroCardProps}
            borderColor="game.error"
            textAlign="center"
          >
            <Text fontSize="lg" mb={3}>
              {error ?? 'Quiz not found.'}
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
        </VStack>
      </Center>
    );
  }

  // ── Results ──────────────────────────────────────

  if (quizResult) {
    return (
      <Flex direction="column" align="center" p={{ base: 4, md: 8 }} minH="100%">
        <QuizResults
          quizName={quiz.title}
          score={quizResult.score}
          maxScore={quizResult.maxScore}
          passed={quizResult.passed}
          xpEarned={quizResult.xpEarned}
          results={quizResult.results}
          nextLessonId={quiz.nextLessonId}
        />
      </Flex>
    );
  }

  // ── Wizard view ──────────────────────────────────

  return (
    <Flex direction="column" align="center" p={{ base: 4, md: 8 }} minH="100%">
      {/* Locked banner */}
      {quiz.isLocked && (
        <Box
          w="100%"
          maxW="720px"
          mb={4}
          bg="rgba(255, 165, 0, 0.15)"
          border="1px solid"
          borderColor="orange.400"
          p="4"
          borderRadius="sm"
          textAlign="center"
        >
          <Text fontSize="sm" color="orange.300">
            🔒 Unlock to submit answers — complete prerequisites first
          </Text>
        </Box>
      )}

      {/* Header */}
      <Flex
        w="100%"
        maxW="720px"
        justify="space-between"
        align="center"
        wrap="wrap"
        gap={2}
        mb={6}
      >
        <Heading size="md" color="dark.text" display="flex" alignItems="center" gap={2}>
          🧪 {quiz.title}
        </Heading>
        <Flex gap={4} align="center">
          <Text fontSize="sm" color="dark.muted">
            Question {currentIndex + 1} of {quiz.questions.length}
          </Text>
          <Box
            px={3}
            py={1}
            bg="game.retroBg"
            {...retroCardProps}
            {...pixelFontProps}
            fontSize="xs"
            color="game.xpGold"
          >
            Score: {runningScore}/{maxScore}
          </Box>
        </Flex>
      </Flex>

      {/* Question */}
      {currentQuestion && (
        <QuestionCard
          question={currentQuestion}
          selectedAnswer={selectedAnswer}
          onAnswerChange={setSelectedAnswer}
          disabled={!!feedback || quiz.isLocked || !isAuthenticated}
        />
      )}

      {/* Feedback */}
      {feedback && (
        <Flex direction="column" align="center" w="100%">
          <QuestionFeedback
            isCorrect={feedback.correct}
            explanation={feedback.explanation}
            correctAnswer={
              !feedback.correct && feedback.correctOptionIds && currentQuestion?.options
                ? feedback.correctOptionIds
                    .map((id) => currentQuestion.options?.find((o) => o.id === id)?.text)
                    .filter(Boolean)
                    .join(', ')
                : undefined
            }
            pointsAwarded={feedback.pointsAwarded}
          />
        </Flex>
      )}

      {/* Submit / Next / Sign-up CTA */}
      {!quiz.isLocked && (
        <Flex mt={5} w="100%" maxW="720px" justify="flex-end">
          {!isAuthenticated ? (
            <Button
              as={RouterLink}
              to="/register"
              bg="aspire.600"
              color="white"
              _hover={{ bg: 'aspire.500' }}
            >
              🔐 Sign up to take this quiz
            </Button>
          ) : !feedback ? (
            <Button
              data-testid="quiz-submit"
              bg="aspire.600"
              color="white"
              _hover={{ bg: 'aspire.500' }}
              disabled={selectedAnswer === null || submitting}
              onClick={handleSubmitAnswer}
            >
              {submitting ? (
                <>
                  <Spinner size="sm" /> Submitting...
                </>
              ) : (
                <>
                  <FiSend /> Submit Answer
                </>
              )}
            </Button>
          ) : (
            <Button
              bg="aspire.600"
              color="white"
              _hover={{ bg: 'aspire.500' }}
              onClick={handleNext}
              disabled={finalizingQuiz}
            >
              {finalizingQuiz ? 'Finishing…' : isLastQuestion ? 'See Results' : 'Next Question'}
              <FiArrowRight />
            </Button>
          )}
        </Flex>
      )}
    </Flex>
  );
}
