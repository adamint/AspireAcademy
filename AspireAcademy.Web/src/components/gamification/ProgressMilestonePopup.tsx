import { useState } from 'react';
import { Box, Text, Button, Flex } from '@chakra-ui/react';
import { AnimatePresence, motion } from 'framer-motion';
import { pixelFontProps } from '../../theme/aspireTheme';
import type { World } from '../../types/curriculum';

const milestoneMessages: Record<number, { emoji: string; title: string; message: string }> = {
  25: {
    emoji: '🌱',
    title: 'Quarter Way There!',
    message: 'You\'re building strong foundations. Keep exploring!',
  },
  50: {
    emoji: '⚡',
    title: 'Halfway Champion!',
    message: 'You\'re halfway through — the real power is unlocking now!',
  },
  75: {
    emoji: '🔥',
    title: 'Almost There!',
    message: 'Just a few more lessons to master this world!',
  },
  100: {
    emoji: '🏆',
    title: 'World Complete!',
    message: 'You\'ve mastered this world. Time to conquer the next one!',
  },
};

const realWorldCards: Record<string, string> = {
  'world-1': 'In production, Aspire\'s app model lets you define your entire distributed system in one place — no more scattered config files!',
  'world-2': 'Companies use Aspire service defaults to standardize health checks, OpenTelemetry, and resilience across all microservices.',
  'world-3': 'Real-world apps use Aspire\'s container integration to spin up Redis, PostgreSQL, and RabbitMQ with a single line of code.',
  'world-4': 'Production teams use Aspire\'s deployment manifests to go from local dev to Azure Container Apps in minutes.',
  'world-5': 'Enterprises use Aspire\'s testing support to write integration tests that spin up the entire app model.',
  'world-6': 'Cloud-native teams rely on Aspire\'s Azure integrations for managed databases, storage, and messaging.',
  'world-7': 'Advanced teams use Aspire custom resources to integrate proprietary services into their distributed architecture.',
  'world-8': 'Production-grade apps use Aspire\'s observability features for end-to-end distributed tracing across all services.',
  'world-9': 'Polyglot teams use Aspire\'s RemoteHost bridge so Node.js, Python, and Go services participate in the same app model as .NET.',
  'world-10': 'DevOps teams use Aspire\'s publish pipeline to generate Docker Compose, Kubernetes Helm charts, and Azure Bicep from one app model.',
  'world-11': 'The Aspire CLI and VS Code extension give developers fast inner-loop iteration, while the MCP server enables AI-assisted workflows.',
  'world-12': 'Teams extend Aspire with custom lifecycle events and resources — hooking into startup, health checks, and teardown.',
  'world-13': 'Open-source contributors use knowledge of Aspire internals — DCP, the backchannel, and the Dashboard — to ship features upstream.',
};

interface ProgressMilestonePopupProps {
  worlds: World[];
}

const MILESTONE_KEY = 'aspire-milestones-seen';

function getSeenMilestones(): Record<string, number[]> {
  try {
    return JSON.parse(localStorage.getItem(MILESTONE_KEY) ?? '{}');
  } catch {
    return {};
  }
}

function markMilestoneSeen(worldId: string, milestone: number) {
  const seen = getSeenMilestones();
  if (!seen[worldId]) seen[worldId] = [];
  if (!seen[worldId].includes(milestone)) {
    seen[worldId].push(milestone);
    localStorage.setItem(MILESTONE_KEY, JSON.stringify(seen));
  }
}

export default function ProgressMilestonePopup({ worlds }: ProgressMilestonePopupProps) {
  const [activeMilestone, setActiveMilestone] = useState<{
    world: World;
    milestone: number;
  } | null>(() => {
    if (!worlds.length) return null;

    const seen = getSeenMilestones();
    const milestones = [25, 50, 75, 100];

    for (const world of worlds) {
      const pct = world.completionPercentage;
      const worldSeen = seen[world.id] ?? [];

      for (const m of milestones) {
        if (pct >= m && !worldSeen.includes(m)) {
          return { world, milestone: m };
        }
      }
    }
    return null;
  });

  const handleDismiss = () => {
    if (activeMilestone) {
      markMilestoneSeen(activeMilestone.world.id, activeMilestone.milestone);
    }
    setActiveMilestone(null);
  };

  if (!activeMilestone) return null;

  const info = milestoneMessages[activeMilestone.milestone];
  const realWorldTip = activeMilestone.milestone === 100
    ? realWorldCards[activeMilestone.world.id]
    : null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, scale: 0.85 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.85 }}
        transition={{ duration: 0.4 }}
        style={{
          position: 'fixed',
          inset: 0,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1900,
          background: 'rgba(0,0,0,0.6)',
        }}
        data-testid="progress-milestone-popup"
      >
        <Box
          bg="game.retroBg"
          border="3px solid"
          borderColor="game.xpGold"
          borderRadius="sm"
          boxShadow="0 0 30px rgba(255, 215, 0, 0.3)"
          p={8}
          maxW="400px"
          w="90%"
          textAlign="center"
          role="dialog"
          aria-modal="true"
          aria-labelledby="milestone-title"
          onKeyDown={(e) => { if (e.key === 'Escape') handleDismiss(); }}
        >
          <Text fontSize="48px" mb={2} aria-hidden="true">{info.emoji}</Text>
          <Text id="milestone-title" {...pixelFontProps} fontSize="sm" color="game.gold" mb={2}>
            {info.title}
          </Text>
          <Text fontSize="sm" color="dark.muted" mb={2}>
            {activeMilestone.world.icon} {activeMilestone.world.name}
          </Text>

          {/* Progress bar */}
          <Box
            w="100%"
            h="12px"
            bg="dark.surface"
            borderRadius="full"
            mb={3}
            overflow="hidden"
            border="1px solid"
            borderColor="dark.border"
          >
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: `${activeMilestone.milestone}%` }}
              transition={{ duration: 1, ease: 'easeOut', delay: 0.3 }}
              style={{
                height: '100%',
                background: 'linear-gradient(90deg, #6B4FBB, #FFD700)',
                borderRadius: '999px',
              }}
            />
          </Box>

          <Text fontSize="sm" color="dark.muted" mb={4}>
            {info.message}
          </Text>

          {/* Real-world use case card for 100% completion */}
          {realWorldTip && (
            <Box
              bg="content.subtle"
              p={3}
              borderRadius="sm"
              border="1px solid"
              borderColor="aspire.600"
              mb={4}
            >
              <Flex align="center" gap={2} mb={1}>
                <Text fontSize="sm">🌍</Text>
                <Text {...pixelFontProps} fontSize="2xs" color="aspire.accent">
                  In the real world...
                </Text>
              </Flex>
              <Text fontSize="xs" color="dark.muted">
                {realWorldTip}
              </Text>
            </Box>
          )}

          <Button
            colorPalette="purple"
            size="md"
            onClick={handleDismiss}
            data-testid="milestone-dismiss-btn"
          >
            {activeMilestone.milestone === 100 ? '🏆 Onward!' : 'Keep Going!'}
          </Button>
        </Box>
      </motion.div>
    </AnimatePresence>
  );
}
