import { useState } from 'react';
import { Box, Text, VStack, Input, RadioGroup, Checkbox } from '@chakra-ui/react';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { oneDark } from 'react-syntax-highlighter/dist/esm/styles/prism';
import type { QuizQuestion, QuizOption } from '../../pages/QuizPage';
import { retroCardProps } from '../../theme/aspireTheme';
import MarkdownContent from '../common/MarkdownContent';

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
          color="dark.text"
          {...retroCardProps}
        >
          <Box fontSize="md" lineHeight="tall" mb={4} fontWeight="medium">
            <MarkdownContent>{question.text}</MarkdownContent>
          </Box>
          <RadioGroup.Root
            value={(selectedAnswer as string) ?? ''}
            onValueChange={(e) => onAnswerChange(e.value)}
            disabled={disabled}
          >
            <VStack align="stretch" gap={2}>
              {question.options?.map((opt) => (
                <RadioGroup.Item
                  key={opt.id}
                  value={opt.id}
                  cursor="pointer"
                  p={3}
                  borderRadius="sm"
                  border="2px solid"
                  borderColor="game.pixelBorder"
                  bg="content.subtle"
                  _hover={{ bg: 'content.hover' }}
                  _checked={{ bg: 'aspire.800', borderColor: 'aspire.500' }}
                >
                  <RadioGroup.ItemHiddenInput />
                  <RadioGroup.ItemIndicator />
                  <RadioGroup.ItemText>{opt.text}</RadioGroup.ItemText>
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
          color="dark.text"
          {...retroCardProps}
        >
          <Box fontSize="md" lineHeight="tall" mb={4} fontWeight="medium">
            <MarkdownContent>{question.text}</MarkdownContent>
          </Box>
          {question.codeSnippet && (
            <Box
              mb={4}
              borderRadius="sm"
              overflow="hidden"
              border="2px solid"
              borderColor="game.pixelBorder"
            >
              <SyntaxHighlighter language="csharp" style={oneDark}>
                {question.codeSnippet}
              </SyntaxHighlighter>
            </Box>
          )}
          <Text fontSize="sm" color="dark.muted" mb={3} fontStyle="italic">
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
                  key={opt.id}
                  value={opt.id}
                  cursor="pointer"
                  p={3}
                  borderRadius="sm"
                  border="2px solid"
                  borderColor="game.pixelBorder"
                  bg="content.subtle"
                  _hover={{ bg: 'content.hover' }}
                  _checked={{ bg: 'aspire.800', borderColor: 'aspire.500' }}
                  fontFamily="mono"
                >
                  <RadioGroup.ItemHiddenInput />
                  <RadioGroup.ItemIndicator />
                  <RadioGroup.ItemText>{opt.text}</RadioGroup.ItemText>
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
          color="dark.text"
          {...retroCardProps}
        >
          <Box fontSize="md" lineHeight="tall" mb={4} fontWeight="medium">
            <MarkdownContent>{question.text}</MarkdownContent>
          </Box>
          <Box maxW="400px">
            <Text fontSize="sm" color="dark.muted" mb={2}>
              Type your answer
            </Text>
            <Input
              value={(selectedAnswer as string) ?? ''}
              onChange={(e) => onAnswerChange(e.target.value)}
              disabled={disabled}
              placeholder="Your answer..."
              bg="dark.surface"
              border="2px solid"
              borderColor="game.pixelBorder"
              color="dark.text"
              _placeholder={{ color: 'dark.muted' }}
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

  const handleToggle = (optionId: string, checked: boolean) => {
    const next = checked
      ? [...selected, optionId]
      : selected.filter((s) => s !== optionId);
    setSelected(next);
    onAnswerChange(next);
  };

  return (
    <Box
      w="100%"
      maxW="720px"
      p={6}
      bg="game.retroBg"
      color="dark.text"
      {...retroCardProps}
    >
      <Box fontSize="md" lineHeight="tall" mb={2} fontWeight="medium">
        <MarkdownContent>{question.text}</MarkdownContent>
      </Box>
      <Text fontSize="xs" color="dark.muted" mb={4} fontStyle="italic">
        Select all that apply
      </Text>
      <VStack align="stretch" gap={2}>
        {question.options?.map((opt) => (
          <Checkbox.Root
            key={opt.id}
            checked={selected.includes(opt.id)}
            onCheckedChange={(e) => handleToggle(opt.id, !!e.checked)}
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
              borderColor={selected.includes(opt.id) ? 'aspire.500' : 'game.pixelBorder'}
              bg={selected.includes(opt.id) ? 'aspire.800' : 'content.subtle'}
              _hover={{ bg: 'content.hover' }}
            >
              <Checkbox.HiddenInput />
              <Checkbox.Control>
                <Checkbox.Indicator />
              </Checkbox.Control>
              <Checkbox.Label>{opt.text}</Checkbox.Label>
            </Box>
          </Checkbox.Root>
        ))}
      </VStack>
    </Box>
  );
}
