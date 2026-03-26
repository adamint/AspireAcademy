import Editor from '@monaco-editor/react';
import type { Monaco } from '@monaco-editor/react';
import { Box, Spinner } from '@chakra-ui/react';
import { retroCardProps } from '../../theme/aspireTheme';
import { registerAspireCompletions } from './aspireCompletions';

interface CodeEditorProps {
  value: string;
  onChange: (value: string) => void;
  language?: string;
  readOnly?: boolean;
  height?: string;
}

export default function CodeEditor({
  value,
  onChange,
  language = 'csharp',
  readOnly = false,
  height = '100%',
}: CodeEditorProps) {
  const handleBeforeMount = (monaco: Monaco) => {
    registerAspireCompletions(monaco);
  };

  return (
    <Box
      w="100%"
      h="100%"
      minH="300px"
      overflow="hidden"
      {...retroCardProps}
      borderWidth="2px"
    >
      <Editor
        height={height}
        language={language}
        theme="vs-dark"
        value={value}
        onChange={(v) => onChange(v ?? '')}
        beforeMount={handleBeforeMount}
        loading={<Spinner size="lg" color="aspire.500" />}
        options={{
          minimap: { enabled: false },
          lineNumbers: 'on',
          fontSize: 14,
          scrollBeyondLastLine: false,
          automaticLayout: true,
          readOnly,
          wordWrap: 'on',
          padding: { top: 12 },
          quickSuggestions: true,
          suggestOnTriggerCharacters: true,
        }}
      />
    </Box>
  );
}
