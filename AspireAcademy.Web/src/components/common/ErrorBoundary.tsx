import { Component, type ReactNode } from 'react';
import { Box, Button, Heading, Text } from '@chakra-ui/react';
import { retroCardProps, pixelFontProps } from '../../theme/aspireTheme';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  handleRetry = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (this.state.hasError) {
      return (
        <Box
          display="flex"
          alignItems="center"
          justifyContent="center"
          minH="60vh"
          p="6"
        >
          <Box
            {...retroCardProps}
            bg="game.retroBg"
            color="dark.text"
            p="8"
            maxW="480px"
            w="100%"
            textAlign="center"
          >
            <Text fontSize="3xl" mb="3">
              💥
            </Text>
            <Heading {...pixelFontProps} fontSize="sm" color="game.error" mb="4">
              Something went wrong
            </Heading>
            <Text fontSize="sm" color="dark.muted" mb="6">
              {this.state.error?.message ?? 'An unexpected error occurred.'}
            </Text>
            <Button
              bg="aspire.600"
              color="white"
              _hover={{ bg: 'aspire.500' }}
              onClick={this.handleRetry}
            >
              🔄 Try Again
            </Button>
          </Box>
        </Box>
      );
    }

    return this.props.children;
  }
}
