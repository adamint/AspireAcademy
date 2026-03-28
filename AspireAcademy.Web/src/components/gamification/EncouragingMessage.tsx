import { useState } from 'react';
import { Box, Text, Flex } from '@chakra-ui/react';
import { motion } from 'framer-motion';
import { pixelFontProps } from '../../theme/aspireTheme';
import { useGamificationStore } from '../../store/gamificationStore';

const baseMessages = [
  'You\'re on fire!',
  'Aspire expert in the making!',
  'One step closer to production-ready apps!',
  'Keep crushing it!',
  'Another lesson down — you\'re unstoppable!',
  'Your Aspire skills are leveling up!',
  'Brilliant work! Keep going!',
  'Building distributed apps like a pro!',
  'Lightning fast progress!',
  'Achievement: Lesson Complete! +Respect',
];

const streakMessages: Record<number, string[]> = {
  3:  ['3 days in a row! You\'re building momentum.'],
  7:  ['A full week streak! You\'re dedicated. 🔥'],
  14: ['Two weeks straight! That\'s serious commitment.'],
  30: ['30 day streak! You\'re a machine. Respect. 🏆'],
};

const levelMessages: Record<number, string[]> = {
  5:  ['Level 5! You\'re past the tutorial zone now.'],
  10: ['Double digits! The Aspire world is opening up.'],
  20: ['Level 20 — the concepts are connecting, right?'],
  30: ['You\'re in the top tier. Keep climbing.'],
};

const funLines = [
  '☕ Time for a coffee break? You\'ve earned it.',
  '🚀 Your app model is looking beautiful.',
  'DCP would be proud of you right now.',
  'You just saved future-you hours of debugging.',
  'That\'s one more microservice problem you\'ll never have.',
  'Your distributed systems knowledge is growing fast.',
  'One day this knowledge saves you at 2 AM in prod.',
  '// TODO: celebrate — done ✓',
  'Connection string management? You\'ve outgrown it.',
  'Your inner loop just got faster.',
];

function pickMessage(streakDays: number, level: number): string {
  // Prioritize streak milestones
  for (const [threshold, msgs] of Object.entries(streakMessages)) {
    if (streakDays === Number(threshold)) {
      return msgs[Math.floor(Math.random() * msgs.length)];
    }
  }
  // Then level milestones
  for (const [threshold, msgs] of Object.entries(levelMessages)) {
    if (level === Number(threshold)) {
      return msgs[Math.floor(Math.random() * msgs.length)];
    }
  }
  // 30% chance of fun/personality line
  if (Math.random() < 0.3) {
    return funLines[Math.floor(Math.random() * funLines.length)];
  }
  return baseMessages[Math.floor(Math.random() * baseMessages.length)];
}

interface EncouragingMessageProps {
  xpEarned?: number;
}

export default function EncouragingMessage({ xpEarned }: EncouragingMessageProps) {
  const streakDays = useGamificationStore((s) => s.loginStreakDays);
  const level = useGamificationStore((s) => s.currentLevel);

  const [message] = useState(
    () => pickMessage(streakDays, level)
  );

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.4, delay: 0.3 }}
    >
      <Box
        textAlign="center"
        py={3}
        px={4}
        bg="rgba(107, 79, 187, 0.15)"
        borderRadius="sm"
        border="1px solid"
        borderColor="aspire.600"
        data-testid="encouraging-message"
      >
        <Text {...pixelFontProps} fontSize="xs" color="game.xpGold" mb={1}>
          {message}
        </Text>
        {xpEarned !== undefined && xpEarned > 0 && (
          <Flex align="center" justify="center" gap="2">
            <Text fontSize="xs" color="aspire.400">
              Keep learning to master Aspire!
            </Text>
          </Flex>
        )}
      </Box>
    </motion.div>
  );
}
