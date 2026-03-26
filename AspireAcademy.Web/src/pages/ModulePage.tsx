import { useParams, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  Box,
  Flex,
  Text,
  Badge,
  Heading,
  Skeleton,
  Progress,
} from '@chakra-ui/react';
import { FiArrowLeft } from 'react-icons/fi';
import { retroCardProps, pixelFontProps } from '../theme/aspireTheme';
import ModuleCard from '../components/curriculum/ModuleCard';
import api from '../services/apiClient';
import type { World } from '../types/curriculum';

export default function ModulePage() {
  const { worldId } = useParams<{ worldId: string }>();
  const navigate = useNavigate();

  const { data: world, isLoading } = useQuery<World>({
    queryKey: ['world', worldId],
    queryFn: () => api.get(`/worlds/${worldId}`).then((r) => r.data),
    enabled: !!worldId,
  });

  if (isLoading) {
    return (
      <Box maxW="900px" mx="auto" p="6" display="flex" flexDirection="column" gap="6">
        <Skeleton height="40px" width="300px" borderRadius="sm" />
        <Skeleton height="20px" width="500px" borderRadius="sm" />
        <Skeleton height="16px" borderRadius="sm" />
        {[1, 2, 3].map((i) => (
          <Skeleton key={i} height="120px" borderRadius="sm" />
        ))}
      </Box>
    );
  }

  if (!world) {
    return (
      <Box maxW="900px" mx="auto" p="6">
        <Text fontSize="lg">World not found.</Text>
      </Box>
    );
  }

  const progress = world.totalLessons > 0 ? world.completionPercentage : 0;

  return (
    <Box maxW="900px" mx="auto" p="6" display="flex" flexDirection="column" gap="6">
      {/* Back */}
      <Flex
        as="button"
        align="center"
        gap="1"
        cursor="pointer"
        color="aspire.600"
        fontSize="sm"
        bg="transparent"
        border="none"
        p="0"
        _hover={{ textDecoration: 'underline' }}
        onClick={() => navigate('/dashboard')}
      >
        <FiArrowLeft />
        <Text>Back to Dashboard</Text>
      </Flex>

      {/* World Header */}
      <Box {...retroCardProps} p="6">
        <Flex align="center" gap="3" mb="3">
          <Text fontSize="3xl">{world.icon}</Text>
          <Box>
            <Heading as="h1" {...pixelFontProps} fontSize="lg" mb="1">
              {world.name}
            </Heading>
            <Text fontSize="sm" color="aspire.500">
              {world.description}
            </Text>
          </Box>
        </Flex>

        <Flex align="center" gap="3" mt="4">
          <Box flex="1">
            <Progress.Root
              value={progress}
              colorPalette="purple"
              size="md"
            >
              <Progress.Track>
                <Progress.Range />
              </Progress.Track>
            </Progress.Root>
          </Box>
          <Badge
            {...pixelFontProps}
            fontSize="2xs"
            colorPalette="purple"
            variant="solid"
          >
            {progress}%
          </Badge>
        </Flex>

        <Text fontSize="xs" color="aspire.400" mt="2">
          {world.completedLessons} / {world.totalLessons} lessons complete
        </Text>
      </Box>

      {/* Modules */}
      <Flex flexDirection="column" gap="4">
        {world.modules
          .slice()
          .sort((a, b) => a.sortOrder - b.sortOrder)
          .map((mod) => (
            <ModuleCard key={mod.id} module={mod} worldId={world.id} />
          ))}
      </Flex>
    </Box>
  );
}
