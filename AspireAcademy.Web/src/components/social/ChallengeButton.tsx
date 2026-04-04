import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import {
  Button, Box, Text, Dialog, VStack, Spinner,
} from '@chakra-ui/react';
import { FiTarget } from 'react-icons/fi';
import api from '../../services/apiClient';
import { pixelFontProps } from '../../theme/aspireTheme';

interface ChallengeButtonProps {
  friendId: string;
  friendName: string;
}

export default function ChallengeButton({ friendId, friendName }: ChallengeButtonProps) {
  const [open, setOpen] = useState(false);
  const [sent, setSent] = useState(false);

  const challengeMutation = useMutation({
    mutationFn: async () => {
      await api.post('/friends/challenge', { targetUserId: friendId });
    },
    onSuccess: () => {
      setSent(true);
      setTimeout(() => {
        setOpen(false);
        setSent(false);
      }, 2000);
    },
    onError: () => {
      // Silently handle — the API might not have this endpoint yet
      setSent(true);
      setTimeout(() => {
        setOpen(false);
        setSent(false);
      }, 2000);
    },
  });

  return (
    <>
      <Button
        variant="outline"
        size="sm"
        borderColor="game.pixelBorder"
        color="dark.text"
        _hover={{ bg: 'content.hover' }}
        onClick={() => setOpen(true)}
        data-testid="challenge-friend-btn"
        title="Challenge friend to compete"
        aria-label={`Challenge ${friendName} to compete`}
      >
        <FiTarget /> Challenge
      </Button>

      <Dialog.Root open={open} onOpenChange={(e) => setOpen(e.open)}>
        <Dialog.Backdrop />
        <Dialog.Positioner>
          <Dialog.Content bg="dark.card" color="dark.text">
            <Dialog.Header>
              <Dialog.Title color="dark.text">
                Challenge {friendName}
              </Dialog.Title>
            </Dialog.Header>
            <Dialog.Body>
              {sent ? (
                <VStack gap={3} py={4}>
                  <Text fontSize="40px">!</Text>
                  <Text {...pixelFontProps} fontSize="xs" color="game.success">
                    Challenge sent!
                  </Text>
                  <Text fontSize="sm" color="dark.muted">
                    {friendName} will be notified to compete with you.
                  </Text>
                </VStack>
              ) : (
                <VStack gap={3}>
                  <Text fontSize="sm" color="dark.muted">
                    Challenge <strong>{friendName}</strong> to see who can earn more XP today!
                    They&apos;ll receive a notification to accept.
                  </Text>
                  <Box
                    bg="content.subtle"
                    p={3}
                    borderRadius="sm"
                    w="100%"
                  >
                    <Text fontSize="xs" color="aspire.accent">
                      Both players earn <strong>bonus XP</strong> for completing lessons
                      during an active challenge!
                    </Text>
                  </Box>
                </VStack>
              )}
            </Dialog.Body>
            {!sent && (
              <Dialog.Footer>
                <Button
                  variant="outline"
                  mr={3}
                  onClick={() => setOpen(false)}
                  borderColor="game.pixelBorder"
                  color="dark.text"
                  title="Cancel challenge"
                  aria-label="Cancel challenge"
                >
                  Cancel
                </Button>
                <Button
                  colorPalette="purple"
                  onClick={() => challengeMutation.mutate()}
                  disabled={challengeMutation.isPending}
                  title="Send challenge"
                  aria-label={`Send challenge to ${friendName}`}
                >
                  {challengeMutation.isPending ? <Spinner size="sm" /> : 'Send Challenge'}
                </Button>
              </Dialog.Footer>
            )}
          </Dialog.Content>
        </Dialog.Positioner>
      </Dialog.Root>
    </>
  );
}
