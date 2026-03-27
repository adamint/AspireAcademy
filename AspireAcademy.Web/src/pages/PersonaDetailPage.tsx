import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation } from '@tanstack/react-query';
import {
  Box, Flex, Text, Button, Badge, Heading, Spinner,
} from '@chakra-ui/react';
import { retroCardProps, pixelFontProps } from '../theme/aspireTheme';
import { useAuthStore } from '../store/authStore';
import api from '../services/apiClient';
import MarkdownContent from '../components/common/MarkdownContent';
import type { PersonaDetail } from '../types';

export default function PersonaDetailPage() {
  const { personaId } = useParams<{ personaId: string }>();
  const navigate = useNavigate();
  const user = useAuthStore((s) => s.user);
  const token = useAuthStore((s) => s.token);
  const updateUser = useAuthStore((s) => s.updateUser);
  const isAuthenticated = !!token && !!user;

  const { data: persona, isLoading } = useQuery<PersonaDetail>({
    queryKey: ['persona', personaId],
    queryFn: () => api.get(`/personas/${personaId}`).then((r) => r.data),
    enabled: !!personaId,
  });

  const selectMutation = useMutation({
    mutationFn: (id: string | null) =>
      api.put('/personas/select', { personaId: id }),
    onSuccess: (_, id) => {
      updateUser({ persona: id });
    },
  });

  const isSelected = user?.persona === personaId;

  if (isLoading) {
    return (
      <Flex justify="center" align="center" h="60vh">
        <Spinner size="lg" color="aspire.600" />
      </Flex>
    );
  }

  if (!persona) {
    return (
      <Box maxW="800px" mx="auto" p="6">
        <Text color="dark.muted">Persona not found.</Text>
      </Box>
    );
  }

  return (
    <Box maxW="800px" mx="auto" p="6">
      {/* Hero */}
      <Box {...retroCardProps} bg="dark.card" p="6" mb="6">
        <Flex align="center" gap="4" mb="4">
          <Text fontSize="4xl">{persona.icon}</Text>
          <Box flex="1">
            <Flex align="center" gap="2" mb="1">
              <Heading as="h1" size="lg" color="dark.text" {...pixelFontProps}>
                {persona.name}
              </Heading>
              {isSelected && (
                <Badge colorPalette="purple" variant="solid" fontSize="xs">
                  Your Track
                </Badge>
              )}
            </Flex>
            <Text color="dark.muted" fontSize="sm">
              {persona.description}
            </Text>
          </Box>
        </Flex>

        <Flex wrap="wrap" gap="2" mb="5">
          {persona.focusAreas.map((area) => (
            <Badge
              key={area}
              fontSize="xs"
              colorPalette="purple"
              variant="subtle"
            >
              {area}
            </Badge>
          ))}
        </Flex>

        {isAuthenticated && (
          <Flex gap="3">
            {isSelected ? (
              <Button
                size="sm"
                variant="outline"
                borderColor="dark.muted"
                color="dark.muted"
                onClick={() => selectMutation.mutate(null)}
                disabled={selectMutation.isPending}
              >
                Remove Track
              </Button>
            ) : (
              <Button
                size="sm"
                bg={persona.color}
                color="white"
                _hover={{ opacity: 0.9 }}
                onClick={() => selectMutation.mutate(persona.id)}
                disabled={selectMutation.isPending}
              >
                Select This Track
              </Button>
            )}
            <Button
              size="sm"
              variant="outline"
              borderColor="aspire.600"
              color="aspire.600"
              onClick={() => navigate('/dashboard')}
            >
              Start Learning
            </Button>
          </Flex>
        )}

        {!isAuthenticated && (
          <Button
            size="sm"
            bg="game.xpGold"
            color="game.retroBg"
            onClick={() => navigate('/register')}
          >
            Sign Up to Select Track
          </Button>
        )}
      </Box>

      {/* Guide Content */}
      {persona.guideContent && (
        <Box {...retroCardProps} bg="dark.card" p="6">
          <MarkdownContent>{persona.guideContent}</MarkdownContent>
        </Box>
      )}
    </Box>
  );
}
