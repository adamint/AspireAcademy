import { Box, Button, Heading, Text } from '@chakra-ui/react';
import { useNavigate } from 'react-router-dom';
import { retroCardProps, pixelFontProps } from '../theme/aspireTheme';

export default function NotFoundPage() {
  const navigate = useNavigate();

  return (
    <Box
      display="flex"
      alignItems="center"
      justifyContent="center"
      minH="100vh"
      bg="dark.bg"
      p="6"
    >
      <Box
        {...retroCardProps}
        bg="game.retroBg"
        color="dark.text"
        p="10"
        maxW="480px"
        w="100%"
        textAlign="center"
      >
        <Heading {...pixelFontProps} fontSize="xl" color="game.gold" mb="4">
          404
        </Heading>
        <Text {...pixelFontProps} fontSize="xs" color="aspire.accent" mb="2">
          Page Not Found
        </Text>
        <Text fontSize="sm" color="dark.muted" mb="6">
          The page you're looking for doesn't exist or has been moved.
        </Text>
        <Button
          bg="aspire.600"
          color="white"
          _hover={{ bg: 'aspire.500' }}
          onClick={() => navigate('/dashboard')}
        >
          🏠 Go to Dashboard
        </Button>
      </Box>
    </Box>
  );
}
