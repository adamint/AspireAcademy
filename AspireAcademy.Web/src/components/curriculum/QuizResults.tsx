import { Box, Flex, Text, Heading, Button, Separator, HStack } from '@chakra-ui/react';
import { useNavigate } from 'react-router-dom';
import Confetti from 'react-confetti';
import { FiArrowRight, FiRotateCcw } from 'react-icons/fi';
import { retroCardProps, pixelFontProps } from '../../theme/aspireTheme';
import type { QuestionResult } from '../../pages/QuizPage';

interface QuizResultsProps {
  quizName: string;
  score: number;
  maxScore: number;
  passed: boolean;
  xpEarned: number;
  results: QuestionResult[];
  nextLessonId?: string | null;
  onReview?: () => void;
}

export default function QuizResults({
  quizName,
  score,
  maxScore,
  passed,
  xpEarned,
  results,
  nextLessonId,
  onReview,
}: QuizResultsProps) {
  const navigate = useNavigate();
  const percentage = maxScore > 0 ? Math.round((score / maxScore) * 100) : 0;
  const isPerfect = score === maxScore && maxScore > 0;

  return (
    <>
      {isPerfect && <Confetti recycle={false} numberOfPieces={400} />}

      <Box
        w="100%"
        maxW="720px"
        p={8}
        bg="game.retroBg"
        color="gray.100"
        {...retroCardProps}
      >
        <Heading
          size="md"
          mb={2}
          {...pixelFontProps}
          fontSize="sm"
        >
          📊 {quizName} — Results
        </Heading>

        {/* Score row */}
        <Flex
          align="center"
          justify="space-between"
          wrap="wrap"
          gap={4}
          mb={4}
        >
          <Text {...pixelFontProps} fontSize="2xl" color="game.xpGold">
            {score}/{maxScore} ({percentage}%)
          </Text>
          <Box
            px={4}
            py={1}
            borderRadius="sm"
            fontWeight="bold"
            fontSize="sm"
            bg={passed ? 'game.success' : 'game.error'}
            color="white"
            border="2px solid"
            borderColor="game.pixelBorder"
            boxShadow="2px 2px 0 var(--chakra-colors-game-pixel-border, #2B1260)"
          >
            {passed ? '✅ PASSED' : '❌ FAILED'}
          </Box>
        </Flex>

        {/* XP banner */}
        {xpEarned > 0 && (
          <Box
            textAlign="center"
            py={3}
            px={4}
            mb={4}
            bg="whiteAlpha.100"
            borderRadius="sm"
            border="2px solid"
            borderColor="game.xpGold"
            boxShadow="2px 2px 0 #FFD700"
          >
            <Text
              {...pixelFontProps}
              fontSize="md"
              color="game.xpGold"
              css={{
                animation: 'pulse 2s ease-in-out infinite',
                '@keyframes pulse': {
                  '0%, 100%': { opacity: 1 },
                  '50%': { opacity: 0.7 },
                },
              }}
            >
              🎉 +{xpEarned} XP earned!
            </Text>
          </Box>
        )}

        <Separator borderColor="whiteAlpha.200" mb={4} />

        {/* Per-question result icons */}
        <Flex gap={2} wrap="wrap" mb={6}>
          {results.map((r, i) => (
            <Flex
              key={i}
              w="40px"
              h="40px"
              align="center"
              justify="center"
              borderRadius="sm"
              fontSize="xs"
              fontWeight="bold"
              color="white"
              bg={r.correct ? 'game.success' : 'game.error'}
              border="2px solid"
              borderColor="game.pixelBorder"
              boxShadow="2px 2px 0 var(--chakra-colors-game-pixel-border, #2B1260)"
              title={`Q${i + 1}: ${r.correct ? 'Correct' : 'Incorrect'}`}
            >
              Q{i + 1}
            </Flex>
          ))}
        </Flex>

        {/* Actions */}
        <HStack gap={3} justify="flex-end" wrap="wrap">
          {onReview && (
            <Button
              variant="outline"
              borderColor="game.pixelBorder"
              color="gray.200"
              _hover={{ bg: 'whiteAlpha.100' }}
              onClick={onReview}
            >
              <FiRotateCcw />
              Review Answers
            </Button>
          )}
          {nextLessonId && (
            <Button
              bg="aspire.600"
              color="white"
              _hover={{ bg: 'aspire.500' }}
              onClick={() => navigate(`/lessons/${nextLessonId}`)}
            >
              Continue
              <FiArrowRight />
            </Button>
          )}
        </HStack>
      </Box>
    </>
  );
}
