import { useMemo } from 'react';
import { Box, Text } from '@chakra-ui/react';
import { motion } from 'framer-motion';
import { pixelFontProps } from '../../theme/aspireTheme';

const messages = [
  '🔥 You\'re on fire!',
  '⭐ Aspire expert in the making!',
  '🚀 One step closer to production-ready apps!',
  '💪 Keep crushing it!',
  '🎯 Another lesson down — you\'re unstoppable!',
  '🌟 Your Aspire skills are leveling up!',
  '💎 Brilliant work! Keep going!',
  '🏗️ Building distributed apps like a pro!',
  '⚡ Lightning fast progress!',
  '🎮 Achievement: Lesson Complete! +Respect',
];

interface EncouragingMessageProps {
  xpEarned?: number;
}

export default function EncouragingMessage({ xpEarned }: EncouragingMessageProps) {
  const message = useMemo(
    () => messages[Math.floor(Math.random() * messages.length)],
    []
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
          <Text fontSize="xs" color="aspire.400">
            Keep learning to master .NET Aspire!
          </Text>
        )}
      </Box>
    </motion.div>
  );
}
