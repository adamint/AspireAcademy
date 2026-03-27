import { useState } from 'react';
import { Box, Flex, Text, Button } from '@chakra-ui/react';
import { retroCardProps, pixelFontProps } from '../../theme/aspireTheme';

interface TryItPromptProps {
  lessonTitle?: string;
}

export default function TryItPrompt({ lessonTitle }: TryItPromptProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText('dotnet new aspire');
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard not available
    }
  };

  return (
    <Box
      {...retroCardProps}
      bg="rgba(107, 79, 187, 0.1)"
      borderColor="aspire.600"
      p={5}
      data-testid="try-it-prompt"
    >
      <Flex align="center" gap={2} mb={2}>
        <Text fontSize="lg">🛠️</Text>
        <Text {...pixelFontProps} fontSize="xs" color="dark.text">
          Try it in your own project!
        </Text>
      </Flex>

      <Text fontSize="sm" color="dark.muted" mb={3}>
        {lessonTitle
          ? `Great job completing "${lessonTitle}"! `
          : 'Great job completing this challenge! '}
        Ready to try this for real?
      </Text>

      <Flex gap={2} flexWrap="wrap" align="center">
        <Text fontSize="xs" color="aspire.400">Run:</Text>
        <Box
          bg="dark.surface"
          px={3}
          py={1}
          borderRadius="sm"
          border="1px solid"
          borderColor="dark.border"
        >
          <Text fontSize="xs" fontFamily="mono" color="game.xpGold">
            dotnet new aspire
          </Text>
        </Box>
        <Button
          size="xs"
          variant="outline"
          colorPalette="purple"
          onClick={handleCopy}
        >
          {copied ? '✓ Copied!' : '📋 Copy'}
        </Button>
      </Flex>
    </Box>
  );
}
