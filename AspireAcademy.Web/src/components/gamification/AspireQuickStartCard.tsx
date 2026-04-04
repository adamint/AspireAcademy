import { useState } from 'react';
import { Box, Flex, Text, Button, Badge } from '@chakra-ui/react';
import { retroCardProps, pixelFontProps } from '../../theme/aspireTheme';

export default function AspireQuickStartCard() {
  const [copied, setCopied] = useState<string | null>(null);

  const handleCopy = async (text: string, label: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(label);
      setTimeout(() => setCopied(null), 2000);
    } catch {
      // Clipboard API not available
    }
  };

  return (
    <Box
      {...retroCardProps}
      bg="game.retroBg"
      p={4}
      data-testid="aspire-quickstart-card"
    >
      <Flex align="center" gap={2} mb={3}>
        <Text {...pixelFontProps} fontSize="xs" color="dark.text">
          Get Started with Aspire
        </Text>
      </Flex>

      <Text fontSize="xs" color="dark.muted" mb={3}>
        Ready to build your own distributed app? Start here:
      </Text>

      {/* Install command */}
      <Box mb={2}>
        <Text fontSize="2xs" color="aspire.accent" mb={1}>Install the Aspire CLI:</Text>
        <Flex
          bg="dark.surface"
          p={2}
          borderRadius="sm"
          border="1px solid"
          borderColor="dark.border"
          align="center"
          justify="space-between"
          gap={2}
        >
          <Text fontSize="xs" fontFamily="mono" color="game.gold" overflow="hidden" textOverflow="ellipsis" whiteSpace="nowrap">
            curl -sSL https://aspire.dev/install.sh | bash
          </Text>
          <Button
            size="xs"
            variant="ghost"
            color="aspire.accent"
            onClick={() => handleCopy('curl -sSL https://aspire.dev/install.sh | bash', 'install')}
            flexShrink={0}
            title="Copy install command"
            aria-label="Copy install command to clipboard"
          >
            {copied === 'install' ? '✓' : '📋'}
          </Button>
        </Flex>
      </Box>

      {/* New project command */}
      <Box mb={3}>
        <Text fontSize="2xs" color="aspire.accent" mb={1}>Create a project:</Text>
        <Flex
          bg="dark.surface"
          p={2}
          borderRadius="sm"
          border="1px solid"
          borderColor="dark.border"
          align="center"
          justify="space-between"
          gap={2}
        >
          <Text fontSize="xs" fontFamily="mono" color="game.gold" overflow="hidden" textOverflow="ellipsis" whiteSpace="nowrap">
            aspire new
          </Text>
          <Button
            size="xs"
            variant="ghost"
            color="aspire.accent"
            onClick={() => handleCopy('aspire new', 'new')}
            flexShrink={0}
            title="Copy new project command"
            aria-label="Copy new project command to clipboard"
          >
            {copied === 'new' ? '✓' : '📋'}
          </Button>
        </Flex>
      </Box>

      <Badge
        {...pixelFontProps}
        fontSize="2xs"
        colorPalette="purple"
        variant="outline"
      >
        Learn → Build → Ship 🚢
      </Badge>
    </Box>
  );
}
