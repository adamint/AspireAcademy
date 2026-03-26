import { useState } from 'react';
import { Box, Text, VStack, Input, RadioGroup, Checkbox } from '@chakra-ui/react';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism';
import type { QuizQuestion } from '../../pages/QuizPage';
import { retroCardProps } from '../../theme/aspireTheme';

interface QuestionCardProps {
  question: QuizQuestion;
  selectedAnswer: string | string[] | null;
  onAnswerChange: (answer: string | string[]) => void;
  disabled?: boolean;
}

export default function QuestionCard({
  question,
  selectedAnswer,
  onAnswerChange,
  disabled = false,
}: QuestionCardProps) {
  switch (question.questionType) {
    case 'multiple-choice':
      return (
        <Box
          w="100%"
          maxW="720px"
          p={6}
          bg="game.retroBg"
          color="gray.100"
          {...retroCardProps}
        >
          <Text fontSize="md" lineHeight="tall" mb={4} fontWeight="medium">
            {question.text}
          </Text>
          <RadioGroup.Root
            value={(selectedAnswer as string) ?? ''}
            onValueChange={(e) => onAnswerChange(e.value)}
            disabled={disabled}
          >
            <VStack align="stretch" gap={2}>
              {question.options?.map((opt) => (
                <RadioGroup.Item
                  key={opt}
                  value={opt}
                  cursor="pointer"
                  p={3}
                  borderRadius="sm"
                  border="2px solid"
                  borderColor="game.pixelBorder"
                  bg="whiteAlpha.50"
                  _hover={{ bg: 'whiteAlpha.100' }}
                  _checked={{ bg: 'aspire.800', borderColor: 'aspire.500' }}
                >
                  <RadioGroup.ItemHiddenInput />
                  <RadioGroup.ItemIndicator />
                  <RadioGroup.ItemText>{opt}</RadioGroup.ItemText>
                </RadioGroup.Item>
              ))}
            </VStack>
          </RadioGroup.Root>
        </Box>
      );

    case 'multi-select':
      return (
        <MultiSelectCard
          question={question}
          selectedAnswer={selectedAnswer}
          onAnswerChange={onAnswerChange}
          disabled={disabled}
        />
      );

    case 'code-prediction':
      return (
        <Box
          w="100%"
          maxW="720px"
          p={6}
          bg="game.retroBg"
          color="gray.100"
          {...retroCardProps}
        >
          <Text fontSize="md" lineHeight="tall" mb={4} fontWeight="medium">
            {question.text}
          </Text>
          {question.codeSnippet && (
            <Box
              mb={4}
              borderRadius="sm"
              overflow="hidden"
              border="2px solid"
              borderColor="game.pixelBorder"
            >
              <SyntaxHighlighter language="csharp" style={vscDarkPlus}>
                {question.codeSnippet}
              </SyntaxHighlighter>
            </Box>
          )}
          <Text fontSize="sm" color="gray.400" mb={3} fontStyle="italic">
            What will this code output?
          </Text>
          <RadioGroup.Root
            value={(selectedAnswer as string) ?? ''}
            onValueChange={(e) => onAnswerChange(e.value)}
            disabled={disabled}
          >
            <VStack align="stretch" gap={2}>
              {question.options?.map((opt) => (
                <RadioGroup.Item
                  key={opt}
                  value={opt}
                  cursor="pointer"
                  p={3}
                  borderRadius="sm"
                  border="2px solid"
                  borderColor="game.pixelBorder"
                  bg="whiteAlpha.50"
                  _hover={{ bg: 'whiteAlpha.100' }}
                  _checked={{ bg: 'aspire.800', borderColor: 'aspire.500' }}
                  fontFamily="mono"
                >
                  <RadioGroup.ItemHiddenInput />
                  <RadioGroup.ItemIndicator />
                  <RadioGroup.ItemText>{opt}</RadioGroup.ItemText>
                </RadioGroup.Item>
              ))}
            </VStack>
          </RadioGroup.Root>
        </Box>
      );

    case 'fill-in-blank':
      return (
        <Box
          w="100%"
          maxW="720px"
          p={6}
          bg="game.retroBg"
          color="gray.100"
          {...retroCardProps}
        >
          <Text fontSize="md" lineHeight="tall" mb={4} fontWeight="medium">
            {question.text}
          </Text>
          <Box maxW="400px">
            <Text fontSize="sm" color="gray.400" mb={2}>
              Type your answer
            </Text>
            <Input
              value={(selectedAnswer as string) ?? ''}
              onChange={(e) => onAnswerChange(e.target.value)}
              disabled={disabled}
              placeholder="Your answer..."
              bg="whiteAlpha.100"
              border="2px solid"
              borderColor="game.pixelBorder"
              color="gray.100"
              _placeholder={{ color: 'gray.500' }}
              _focus={{ borderColor: 'aspire.500', boxShadow: '0 0 0 1px var(--chakra-colors-aspire-500)' }}
            />
          </Box>
        </Box>
      );

    default:
      return null;
  }
}

function MultiSelectCard({
  question,
  selectedAnswer,
  onAnswerChange,
  disabled,
}: QuestionCardProps) {
  const [selected, setSelected] = useState<string[]>(
    Array.isArray(selectedAnswer) ? selectedAnswer : []
  );

  const handleToggle = (option: string, checked: boolean) => {
    const next = checked
      ? [...selected, option]
      : selected.filter((s) => s !== option);
    setSelected(next);
    onAnswerChange(next);
  };

  return (
    <Box
      w="100%"
      maxW="720px"
      p={6}
      bg="game.retroBg"
      color="gray.100"
      {...retroCardProps}
    >
      <Text fontSize="md" lineHeight="tall" mb={2} fontWeight="medium">
        {question.text}
      </Text>
      <Text fontSize="xs" color="gray.400" mb={4} fontStyle="italic">
        Select all that apply
      </Text>
      <VStack align="stretch" gap={2}>
        {question.options?.map((opt) => (
          <Checkbox.Root
            key={opt}
            checked={selected.includes(opt)}
            onCheckedChange={(e) => handleToggle(opt, !!e.checked)}
            disabled={disabled}
            cursor="pointer"
          >
            <Box
              display="flex"
              alignItems="center"
              gap={3}
              p={3}
              borderRadius="sm"
              border="2px solid"
              borderColor={selected.includes(opt) ? 'aspire.500' : 'game.pixelBorder'}
              bg={selected.includes(opt) ? 'aspire.800' : 'whiteAlpha.50'}
              _hover={{ bg: 'whiteAlpha.100' }}
            >
              <Checkbox.HiddenInput />
              <Checkbox.Control>
                <Checkbox.Indicator />
              </Checkbox.Control>
              <Checkbox.Label>{opt}</Checkbox.Label>
            </Box>
          </Checkbox.Root>
        ))}
      </VStack>
    </Box>
  );
}
