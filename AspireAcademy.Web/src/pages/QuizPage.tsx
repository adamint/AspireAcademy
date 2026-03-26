import { useState, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
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
import { useGamificationStore } from '../store/gamificationStore';
import { retroCardProps, pixelFontProps } from '../theme/aspireTheme';
import QuestionCard from '../components/curriculum/QuestionCard';
import QuestionFeedback from '../components/curriculum/QuestionFeedback';
import QuizResults from '../components/curriculum/QuizResults';

// ── Types ────────────────────────────────────────────

export interface QuizQuestion {
  id: string;
  text: string;
  questionType: 'multiple-choice' | 'multi-select' | 'code-prediction' | 'fill-in-blank';
  options?: string[];
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
}

interface AnswerResponse {
  correct: boolean;
  explanation: string;
  correctAnswer?: string;
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

  // Fetch quiz data on mount
  const fetched = useState(false);
  if (!fetched[0]) {
    fetched[1](true);
    api
      .get<QuizData>(`/lessons/${lessonId}`)
      .then((res) => {
        setQuiz(res.data);
        setLoading(false);
      })
      .catch(() => {
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
    } catch {
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
    if (!quiz) return;

    if (isLastQuestion) {
      try {
        const res = await api.post<QuizSubmitResponse>(
          `/quizzes/${lessonId}/submit`,
          { results: [...questionResults] }
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
        setQuizResult({
          score: runningScore,
          maxScore,
          passed: runningScore >= (quiz.passingScore ?? 0),
          xpEarned: 0,
          results: questionResults,
        });
      }
    } else {
      setCurrentIndex((i) => i + 1);
      setSelectedAnswer(null);
      setFeedback(null);
    }
  }, [quiz, lessonId, isLastQuestion, questionResults, runningScore, maxScore, syncFromServer]);

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
            color="gray.100"
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
              color="gray.200"
              _hover={{ bg: 'whiteAlpha.100' }}
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
        <Heading size="md" color="gray.100" display="flex" alignItems="center" gap={2}>
          🧪 {quiz.title}
        </Heading>
        <Flex gap={4} align="center">
          <Text fontSize="sm" color="gray.400">
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
          disabled={!!feedback}
        />
      )}

      {/* Feedback */}
      {feedback && (
        <Flex direction="column" align="center" w="100%">
          <QuestionFeedback
            isCorrect={feedback.correct}
            explanation={feedback.explanation}
            correctAnswer={feedback.correctAnswer}
            pointsAwarded={feedback.pointsAwarded}
          />
        </Flex>
      )}

      {/* Submit / Next */}
      <Flex mt={5} w="100%" maxW="720px" justify="flex-end">
        {!feedback ? (
          <Button
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
          >
            {isLastQuestion ? 'See Results' : 'Next Question'}
            <FiArrowRight />
          </Button>
        )}
      </Flex>
    </Flex>
  );
}
