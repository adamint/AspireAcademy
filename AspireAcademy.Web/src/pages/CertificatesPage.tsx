import { useQuery } from '@tanstack/react-query';
import {
  Box, Flex, Text, SimpleGrid, VStack, Button, Skeleton, Dialog, Badge, Progress,
} from '@chakra-ui/react';
import { FiDownload, FiCopy, FiEye, FiLock, FiAward } from 'react-icons/fi';
import { useState } from 'react';
import api from '../services/apiClient';
import { retroCardProps, pixelFontProps } from '../theme/aspireTheme';
import {
  Certificate,
  type CertificateData,
} from '../components/Certificate';
import {
  downloadCertificateSVG,
  copyCertificateSummary,
  generateCertificateId,
} from '../components/certificateUtils';

interface CertificateApiItem {
  worldId: string;
  worldName: string;
  worldIcon: string;
  worldSortOrder: number;
  completedAt: string | null;
  lessonsCompleted: number;
  totalLessons: number;
  xpEarned: number;
  quizzesPassed: number;
  isComplete: boolean;
}

interface CertificatesApiResponse {
  certificates: CertificateApiItem[];
  allWorldsComplete: boolean;
  totalXp: number;
  displayName: string;
}

export default function CertificatesPage() {
  const [viewCert, setViewCert] = useState<CertificateData | null>(null);
  const [copied, setCopied] = useState(false);

  const { data, isLoading, error } = useQuery<CertificatesApiResponse>({
    queryKey: ['certificates'],
    queryFn: async () => {
      const { data } = await api.get('/certificates');
      return data;
    },
  });

  const handleCopy = (certData: CertificateData) => {
    copyCertificateSummary(certData);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const buildCertData = (item: CertificateApiItem, displayName: string): CertificateData => ({
    worldId: item.worldId,
    worldName: item.worldName,
    worldIcon: item.worldIcon,
    worldSortOrder: item.worldSortOrder,
    displayName,
    completedAt: item.completedAt ?? new Date().toISOString(),
    lessonsCompleted: item.lessonsCompleted,
    xpEarned: item.xpEarned,
    quizzesPassed: item.quizzesPassed,
    certificateId: generateCertificateId(item.worldId, displayName, item.completedAt ?? ''),
  });

  const buildMasterCertData = (resp: CertificatesApiResponse): CertificateData => ({
    worldId: 'master',
    worldName: 'Full Curriculum',
    worldIcon: '👑',
    worldSortOrder: 0,
    displayName: resp.displayName,
    completedAt: resp.certificates
      .map(c => c.completedAt)
      .filter((d): d is string => d !== null)
      .sort()
      .pop() ?? new Date().toISOString(),
    lessonsCompleted: resp.certificates.reduce((s, c) => s + c.lessonsCompleted, 0),
    xpEarned: resp.totalXp,
    quizzesPassed: resp.certificates.reduce((s, c) => s + c.quizzesPassed, 0),
    certificateId: generateCertificateId('master', resp.displayName, 'all-worlds'),
    isMaster: true,
    allWorldIcons: resp.certificates.map(c => c.worldIcon),
  });

  if (isLoading) {
    return (
      <VStack maxW="1000px" mx="auto" p={6} gap={6}>
        <Skeleton h="40px" w="300px" borderRadius="sm" />
        <SimpleGrid columns={{ base: 1, md: 2 }} gap={6} w="100%">
          {[1, 2, 3, 4].map(i => (
            <Skeleton key={i} h="200px" borderRadius="sm" />
          ))}
        </SimpleGrid>
      </VStack>
    );
  }

  if (error) {
    return (
      <Box maxW="1000px" mx="auto" p={6}>
        <Box {...retroCardProps} bg="dark.card" p={6} textAlign="center">
          <Text fontSize="xl" color="game.error" mb={2}>Failed to load certificates</Text>
          <Text fontSize="sm" color="dark.muted">Please try again later.</Text>
        </Box>
      </Box>
    );
  }

  if (!data) return null;

  const earnedCount = data.certificates.filter(c => c.isComplete).length;

  return (
    <VStack maxW="1000px" mx="auto" p={6} gap={6} align="stretch">
      {/* Header */}
      <Box {...retroCardProps} bg="dark.card" p={5}>
        <Flex align="center" gap={3} mb={2}>
          <Text fontSize="24px">🏆</Text>
          <Text {...pixelFontProps} fontSize="lg" color="dark.text">Certificates</Text>
        </Flex>
        <Text fontSize="sm" color="dark.muted">
          Complete all lessons in a world to earn its certificate. Collect all {data.certificates.length} to unlock the Master Certificate!
        </Text>
        <Flex gap={4} mt={3}>
          <Badge {...pixelFontProps} fontSize="8px" colorPalette="purple" variant="solid" px={2} py={1}>
            {earnedCount}/{data.certificates.length} Earned
          </Badge>
          {data.allWorldsComplete && (
            <Badge {...pixelFontProps} fontSize="8px" colorPalette="yellow" variant="solid" px={2} py={1}>
              👑 Master Certified
            </Badge>
          )}
        </Flex>
      </Box>

      {/* Master Certificate (if all worlds complete) */}
      {data.allWorldsComplete && (
        <Box {...retroCardProps} bg="dark.card" p={5} borderColor="#FFD700" borderWidth="3px">
          <Flex align="center" justify="space-between" mb={3}>
            <Flex align="center" gap={2}>
              <Text fontSize="24px">👑</Text>
              <VStack align="flex-start" gap={0}>
                <Text {...pixelFontProps} fontSize="sm" color="game.xpGold">Master Certificate</Text>
                <Text fontSize="xs" color="dark.muted">Full Curriculum Mastery</Text>
              </VStack>
            </Flex>
            <Flex gap={2}>
              <Button
                size="sm" variant="outline" borderColor="game.xpGold" color="game.xpGold"
                _hover={{ bg: 'rgba(255, 215, 0, 0.1)' }}
                onClick={() => setViewCert(buildMasterCertData(data))}
              >
                <FiEye /> View
              </Button>
              <Button
                size="sm" variant="outline" borderColor="game.pixelBorder" color="dark.text"
                _hover={{ bg: 'content.hover' }}
                onClick={() => downloadCertificateSVG(buildMasterCertData(data))}
              >
                <FiDownload /> Download
              </Button>
            </Flex>
          </Flex>
          <Box borderRadius="sm" overflow="hidden" maxW="500px" mx="auto">
            <Certificate data={buildMasterCertData(data)} compact />
          </Box>
        </Box>
      )}

      {/* Certificate Grid */}
      <SimpleGrid columns={{ base: 1, md: 2 }} gap={5}>
        {data.certificates.map((cert) => {
          if (cert.isComplete) {
            const certData = buildCertData(cert, data.displayName);
            return (
              <Box key={cert.worldId} {...retroCardProps} bg="dark.card" p={4}>
                <Flex align="center" gap={2} mb={3}>
                  <Text fontSize="20px">{cert.worldIcon}</Text>
                  <VStack align="flex-start" gap={0} flex={1}>
                    <Text {...pixelFontProps} fontSize="10px" color="dark.text">
                      World {cert.worldSortOrder}: {cert.worldName}
                    </Text>
                    <Text fontSize="xs" color="dark.muted">
                      Completed {cert.completedAt ? new Date(cert.completedAt).toLocaleDateString() : ''}
                    </Text>
                  </VStack>
                  <FiAward color="#FFD700" size={20} />
                </Flex>

                {/* Mini stats */}
                <Flex gap={3} mb={3} flexWrap="wrap">
                  <Text fontSize="xs" color="dark.muted">
                    📚 {cert.lessonsCompleted} lessons
                  </Text>
                  <Text fontSize="xs" color="dark.muted">
                    ⭐ {cert.xpEarned.toLocaleString()} XP
                  </Text>
                  <Text fontSize="xs" color="dark.muted">
                    ✅ {cert.quizzesPassed} quizzes
                  </Text>
                </Flex>

                {/* Actions */}
                <Flex gap={2}>
                  <Button
                    size="xs" variant="outline" borderColor="game.pixelBorder" color="dark.text"
                    _hover={{ bg: 'content.hover' }}
                    onClick={() => setViewCert(certData)}
                  >
                    <FiEye /> View
                  </Button>
                  <Button
                    size="xs" variant="outline" borderColor="game.pixelBorder" color="dark.text"
                    _hover={{ bg: 'content.hover' }}
                    onClick={() => downloadCertificateSVG(certData)}
                  >
                    <FiDownload /> SVG
                  </Button>
                  <Button
                    size="xs" variant="outline" borderColor="game.pixelBorder" color="dark.text"
                    _hover={{ bg: 'content.hover' }}
                    onClick={() => handleCopy(certData)}
                  >
                    <FiCopy /> {copied ? 'Copied!' : 'Share'}
                  </Button>
                </Flex>
              </Box>
            );
          }

          // Incomplete world — locked card
          const pct = cert.totalLessons > 0
            ? Math.round((cert.lessonsCompleted / cert.totalLessons) * 100)
            : 0;

          return (
            <Box
              key={cert.worldId}
              {...retroCardProps}
              bg="dark.card"
              p={4}
              opacity={0.55}
            >
              <Flex align="center" gap={2} mb={3}>
                <Text fontSize="20px" filter="grayscale(100%)">{cert.worldIcon}</Text>
                <VStack align="flex-start" gap={0} flex={1}>
                  <Text {...pixelFontProps} fontSize="10px" color="dark.muted">
                    World {cert.worldSortOrder}: {cert.worldName}
                  </Text>
                  <Text fontSize="xs" color="dark.muted">
                    {cert.lessonsCompleted}/{cert.totalLessons} lessons completed
                  </Text>
                </VStack>
                <FiLock color="#8A8886" size={18} />
              </Flex>

              {/* Progress bar */}
              <Box mb={2}>
                <Progress.Root value={pct} size="sm" colorPalette="purple" borderRadius="sm">
                  <Progress.Track bg="dark.surface">
                    <Progress.Range />
                  </Progress.Track>
                </Progress.Root>
                <Text fontSize="10px" color="dark.muted" mt={1} textAlign="right">
                  {pct}%
                </Text>
              </Box>

              <Text {...pixelFontProps} fontSize="8px" color="dark.muted" textAlign="center">
                Complete all lessons to earn this certificate
              </Text>
            </Box>
          );
        })}
      </SimpleGrid>

      {/* View Certificate Dialog */}
      <Dialog.Root open={viewCert !== null} onOpenChange={(e) => !e.open && setViewCert(null)}>
        <Dialog.Backdrop />
        <Dialog.Positioner>
          <Dialog.Content bg="dark.card" color="dark.text" maxW="860px" w="95vw">
            <Dialog.Header>
              <Dialog.Title {...pixelFontProps} fontSize="sm" color="dark.text">
                {viewCert?.isMaster ? '👑 Master Certificate' : `${viewCert?.worldIcon} ${viewCert?.worldName}`}
              </Dialog.Title>
            </Dialog.Header>
            <Dialog.Body>
              {viewCert && <Certificate data={viewCert} />}
            </Dialog.Body>
            <Dialog.Footer>
              <Flex gap={2} flexWrap="wrap">
                <Button
                  size="sm" variant="outline" borderColor="game.pixelBorder" color="dark.text"
                  _hover={{ bg: 'content.hover' }}
                  onClick={() => viewCert && handleCopy(viewCert)}
                >
                  <FiCopy /> {copied ? 'Copied!' : 'Share'}
                </Button>
                <Button
                  size="sm" variant="outline" borderColor="game.pixelBorder" color="dark.text"
                  _hover={{ bg: 'content.hover' }}
                  onClick={() => viewCert && downloadCertificateSVG(viewCert)}
                >
                  <FiDownload /> Download SVG
                </Button>
                <Button
                  size="sm" variant="outline" borderColor="game.pixelBorder" color="dark.text"
                  onClick={() => setViewCert(null)}
                >
                  Close
                </Button>
              </Flex>
            </Dialog.Footer>
          </Dialog.Content>
        </Dialog.Positioner>
      </Dialog.Root>
    </VStack>
  );
}
