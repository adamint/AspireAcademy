import { Box, Flex, Text } from '@chakra-ui/react';
import { FiCheck, FiX } from 'react-icons/fi';
import { retroCardProps, pixelFontProps } from '../../theme/aspireTheme';
import MarkdownContent from '../common/MarkdownContent';

interface QuestionFeedbackProps {
  isCorrect: boolean;
  explanation: string;
  correctAnswer?: string;
  pointsAwarded: number;
}

export default function QuestionFeedback({
  isCorrect,
  explanation,
  correctAnswer,
  pointsAwarded,
}: QuestionFeedbackProps) {
  return (
    <Box
      w="100%"
      maxW="720px"
      mt={3}
      p={5}
      bg={isCorrect ? '#0d3320' : '#3d0f0f'}
      {...retroCardProps}
      borderColor={isCorrect ? 'game.success' : 'game.error'}
      boxShadow={
        isCorrect
          ? '4px 4px 0 #107C10'
          : '4px 4px 0 #D13438'
      }
      role="status"
      aria-live="polite"
    >
      <Flex justify="space-between" align="center" mb={2}>
        <Flex align="center" gap={2}>
          {isCorrect ? (
            <Box as={FiCheck} color="green.300" boxSize={5} aria-hidden="true" />
          ) : (
            <Box as={FiX} color="red.300" boxSize={5} aria-hidden="true" />
          )}
          <Text
            fontWeight="bold"
            fontSize="lg"
            color={isCorrect ? 'green.200' : 'red.200'}
          >
            {isCorrect ? 'Correct!' : 'Incorrect'}
          </Text>
        </Flex>
        <Text
          {...pixelFontProps}
          fontSize="xs"
          color={isCorrect ? 'game.xpGold' : 'red.300'}
        >
          {isCorrect ? `+${pointsAwarded} pts` : '0 pts'}
        </Text>
      </Flex>

      {!isCorrect && correctAnswer && (
        <Text color="yellow.200" fontWeight="semibold" mb={2} fontSize="sm">
          ✦ Correct answer: {correctAnswer}
        </Text>
      )}

      <Box color="dark.text" fontSize="sm" lineHeight="tall">
        <MarkdownContent>{explanation}</MarkdownContent>
      </Box>
    </Box>
  );
}
