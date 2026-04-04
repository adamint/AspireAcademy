import { useState, useEffect } from 'react';
import { Box, Flex, Text, VStack } from '@chakra-ui/react';
import { retroCardProps, pixelFontProps } from '../theme/aspireTheme';
import { changelog } from '../data/changelog';
import type { ChangelogEntry } from '../data/changelog';
import { formatDateShort } from '../utils/formatters';

const typeConfig: Record<string, { icon: string; color: string; label: string }> = {
  feature: { icon: '🆕', color: '#107C10', label: 'Feature' },
  content: { icon: '📝', color: '#2196F3', label: 'Content' },
  fix: { icon: '🐛', color: '#D13438', label: 'Fix' },
  improvement: { icon: '⬆️', color: '#FF6B35', label: 'Improvement' },
};

const fadeInKeyframes = `
@keyframes pulseNew {
  0%, 100% { opacity: 1; }
  50%      { opacity: 0.5; }
}
`;

function VersionCard({
  entry,
  isLatest,
}: {
  entry: ChangelogEntry;
  index: number;
  isLatest: boolean;
}) {
  const [expanded, setExpanded] = useState(isLatest);

  return (
    <Flex
      gap={0}
      align="stretch"
    >
      {/* Timeline rail */}
      <Flex direction="column" align="center" minW="48px" position="relative">
        {/* Node */}
        <Box
          w="20px"
          h="20px"
          borderRadius="full"
          bg={isLatest ? 'aspire.600' : 'aspire.200'}
          border="3px solid"
          borderColor="aspire.700"
          mt="22px"
          zIndex={1}
          flexShrink={0}
        />
        {/* Connector line */}
        <Box
          flex="1"
          w="3px"
          bg="aspire.700"
          opacity={0.5}
          mt="2px"
        />
      </Flex>

      {/* Card */}
      <Box
        {...retroCardProps}
        bg="dark.card"
        p={5}
        mb={5}
        flex="1"
        cursor="pointer"
        transition="box-shadow 0.2s"
        _hover={{ boxShadow: '6px 6px 0 #551CA9' }}
        onClick={() => setExpanded((prev) => !prev)}
      >
        {/* Card header */}
        <Flex align="center" gap={3} wrap="wrap" mb={2}>
          {/* Version badge */}
          <Box
            px={3}
            py={1}
            bg="aspire.700"
            color="white"
            borderRadius="sm"
            {...pixelFontProps}
            fontSize="xs"
          >
            v{entry.version}
          </Box>

          {isLatest && (
            <Box
              px={2}
              py={0.5}
              bg="#FFD700"
              color="#1A0B2E"
              borderRadius="sm"
              {...pixelFontProps}
              fontSize="2xs"
              style={{ animation: 'pulseNew 1.8s ease-in-out infinite' }}
            >
              NEW
            </Box>
          )}

          <Text fontSize="xs" color="dark.muted">
            {formatDateShort(entry.date)}
          </Text>

          <Text ml="auto" fontSize="sm" color="dark.muted">
            {expanded ? '▲' : '▼'}
          </Text>
        </Flex>

        {/* Title */}
        <Text
          {...pixelFontProps}
          fontSize="sm"
          color="dark.text"
          mb={3}
        >
          {entry.title}
        </Text>

        {/* Highlight pills */}
        <Flex gap={2} wrap="wrap" mb={expanded ? 4 : 0}>
          {entry.highlights.map((h) => (
            <Box
              key={h}
              px={2}
              py={0.5}
              border="2px solid"
              borderColor="aspire.600"
              borderRadius="sm"
              fontSize="xs"
              color="aspire.400"
              {...pixelFontProps}
              lineHeight="1.6"
            >
              {h}
            </Box>
          ))}
        </Flex>

        {/* Expanded entries */}
        {expanded && (
          <VStack align="stretch" gap={1} mt={2}>
            {entry.entries.map((e, i) => {
              const cfg = typeConfig[e.type];
              return (
                <Flex key={i} align="flex-start" gap={2} py={1}>
                  <Text fontSize="sm" flexShrink={0}>
                    {cfg.icon}
                  </Text>
                  <Box
                    px={1.5}
                    py={0}
                    borderRadius="sm"
                    fontSize="2xs"
                    {...pixelFontProps}
                    color="white"
                    bg={cfg.color}
                    flexShrink={0}
                    lineHeight="1.8"
                  >
                    {cfg.label}
                  </Box>
                  <Text fontSize="sm" color="dark.text" lineHeight="1.5">
                    {e.text}
                  </Text>
                </Flex>
              );
            })}
          </VStack>
        )}
      </Box>
    </Flex>
  );
}

export default function WhatsNewPage() {
  useEffect(() => { document.title = "What's New | Aspire Learn"; }, []);
  return (
    <>
      <style>{fadeInKeyframes}</style>

      <VStack maxW="780px" mx="auto" p={6} gap={0} align="stretch">
        {/* Page header */}
        <Box textAlign="center" mb={8}>
          <Text
            {...pixelFontProps}
            fontSize={{ base: 'lg', md: 'xl' }}
            color="dark.text"
            mb={2}
          >
            📜 What&apos;s New
          </Text>
          <Text fontSize="sm" color="dark.muted">
            Everything we&apos;ve shipped, version by version.
          </Text>
        </Box>

        {/* Timeline */}
        {changelog.map((entry, i) => (
          <VersionCard
            key={entry.version}
            entry={entry}
            index={i}
            isLatest={i === 0}
          />
        ))}
      </VStack>
    </>
  );
}
