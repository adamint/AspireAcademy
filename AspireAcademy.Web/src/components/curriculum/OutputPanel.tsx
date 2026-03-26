import { useState } from 'react';
import { Box, Flex, Text, Tabs } from '@chakra-ui/react';
import { retroCardProps } from '../../theme/aspireTheme';

interface OutputPanelProps {
  output: string;
  errors: string;
  isLoading?: boolean;
}

export default function OutputPanel({
  output,
  errors,
  isLoading = false,
}: OutputPanelProps) {
  const [activeTab, setActiveTab] = useState<string>('output');
  const hasErrors = errors.trim().length > 0;

  return (
    <Flex
      direction="column"
      h="100%"
      minH="150px"
      bg="#1A0B2E"
      overflow="hidden"
      {...retroCardProps}
      borderWidth="2px"
    >
      <Tabs.Root
        value={activeTab}
        onValueChange={(e) => setActiveTab(e.value)}
        size="sm"
        variant="line"
      >
        <Tabs.List bg="#252526" px={2} borderBottom="1px solid #444">
          <Tabs.Trigger
            value="output"
            color="#d4d4d4"
            _selected={{ color: '#50fa7b', borderColor: '#50fa7b' }}
            fontSize="xs"
            fontWeight="bold"
          >
            Output
          </Tabs.Trigger>
          <Tabs.Trigger
            value="errors"
            color="#d4d4d4"
            _selected={{ color: '#ff5555', borderColor: '#ff5555' }}
            fontSize="xs"
            fontWeight="bold"
          >
            Errors{hasErrors ? ' ⚠' : ''}
          </Tabs.Trigger>
        </Tabs.List>

        <Box
          flex={1}
          p={3}
          overflowY="auto"
          maxH="250px"
          fontFamily="'Cascadia Code', 'Fira Code', 'Consolas', monospace"
          fontSize="xs"
          lineHeight="1.6"
          whiteSpace="pre-wrap"
          css={{ wordBreak: 'break-word' }}
        >
          <Tabs.Content value="output" p={0}>
            {isLoading ? (
              <Text color="#888" fontStyle="italic">Running...</Text>
            ) : output.trim() ? (
              <Text color="#50fa7b">{output}</Text>
            ) : (
              <Text color="#666" fontStyle="italic">Click Run to see output</Text>
            )}
          </Tabs.Content>

          <Tabs.Content value="errors" p={0}>
            {isLoading ? (
              <Text color="#888" fontStyle="italic">Running...</Text>
            ) : errors.trim() ? (
              <Text color="#ff5555">{errors}</Text>
            ) : (
              <Text color="#666" fontStyle="italic">No errors</Text>
            )}
          </Tabs.Content>
        </Box>
      </Tabs.Root>
    </Flex>
  );
}
