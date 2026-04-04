import { useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import {
  Box, Flex, Text, SimpleGrid, Card, Heading, Badge, Spinner,
} from '@chakra-ui/react';
import { retroCardProps, pixelFontProps } from '../theme/aspireTheme';
import { useAuthStore } from '../store/authStore';
import api from '../services/apiClient';
import type { PersonaSummary } from '../types';

export default function PersonaHubPage() {
  useEffect(() => { document.title = 'Learning Tracks | Aspire Learn'; }, []);
  const navigate = useNavigate();
  const user = useAuthStore((s) => s.user);

  const { data: personas, isLoading } = useQuery<PersonaSummary[]>({
    queryKey: ['personas'],
    queryFn: () => api.get('/personas').then((r) => r.data),
  });

  if (isLoading) {
    return (
      <Flex justify="center" align="center" h="60vh">
        <Spinner size="lg" color="aspire.600" />
      </Flex>
    );
  }

  return (
    <Box maxW="900px" mx="auto" p="6">
      <Heading as="h1" size="xl" color="dark.text" mb="2" {...pixelFontProps}>
        Learning Tracks
      </Heading>
      <Text color="dark.muted" mb="6" fontSize="sm">
        Choose a track that matches your role. This personalizes your learning experience
        by highlighting the most relevant lessons — but you can always access everything.
      </Text>

      <SimpleGrid columns={{ base: 1, md: 2 }} gap="5">
        {personas?.map((persona) => {
          const isSelected = user?.persona === persona.id;

          return (
            <Card.Root
              key={persona.id}
              {...retroCardProps}
              cursor="pointer"
              onClick={() => navigate(`/personas/${persona.id}`)}
              borderColor={isSelected ? persona.color : 'game.pixelBorder'}
              borderWidth={isSelected ? '3px' : '2px'}
              bg={isSelected ? 'rgba(107,79,187,0.08)' : 'dark.card'}
              _hover={{ borderColor: persona.color, transform: 'translateY(-2px)', transition: 'all 0.15s' }}
              transition="all 0.15s"
            >
              <Card.Body p="5">
                <Flex align="center" gap="3" mb="3">
                  <Text fontSize="2xl">{persona.icon}</Text>
                  <Box flex="1">
                    <Flex align="center" gap="2">
                      <Text fontWeight="bold" color="dark.text" fontSize="md">
                        {persona.name}
                      </Text>
                      {isSelected && (
                        <Badge colorPalette="purple" fontSize="2xs" variant="solid">
                          Your Track
                        </Badge>
                      )}
                    </Flex>
                  </Box>
                </Flex>
                <Text color="dark.muted" fontSize="sm" mb="3">
                  {persona.description}
                </Text>
                <Flex wrap="wrap" gap="1.5">
                  {persona.focusAreas.slice(0, 3).map((area) => (
                    <Badge
                      key={area}
                      fontSize="2xs"
                      colorPalette="gray"
                      variant="subtle"
                    >
                      {area}
                    </Badge>
                  ))}
                  {persona.focusAreas.length > 3 && (
                    <Badge fontSize="2xs" colorPalette="gray" variant="subtle">
                      +{persona.focusAreas.length - 3} more
                    </Badge>
                  )}
                </Flex>
              </Card.Body>
            </Card.Root>
          );
        })}
      </SimpleGrid>

      {user?.persona && (
        <Text color="dark.muted" fontSize="xs" mt="4" textAlign="center">
          Your current track: <strong>{personas?.find((p) => p.id === user.persona)?.name}</strong>.
          Change it anytime in Settings.
        </Text>
      )}
    </Box>
  );
}
