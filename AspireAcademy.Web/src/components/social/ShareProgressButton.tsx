import { useState } from 'react';
import { Button } from '@chakra-ui/react';
import { FiShare2 } from 'react-icons/fi';

interface ShareProgressProps {
  displayName: string;
  level: number;
  rank: string;
  completedLessons: number;
  totalLessons: number;
  achievementCount: number;
  streakDays: number;
}

function formatRank(rank: string): string {
  return rank
    .split(/[-_]/)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
}

export default function ShareProgressButton({
  displayName,
  level,
  rank,
  completedLessons,
  totalLessons,
  achievementCount,
  streakDays,
}: ShareProgressProps) {
  const [copied, setCopied] = useState(false);

  const handleShare = async () => {
    const percentage = totalLessons > 0
      ? Math.round((completedLessons / totalLessons) * 100)
      : 0;

    const text = [
      `🎮 I'm Level ${level} (${formatRank(rank)}) on Aspire Academy!`,
      `📚 ${completedLessons}/${totalLessons} lessons completed (${percentage}%)`,
      `🏆 ${achievementCount} achievements unlocked`,
      streakDays > 0 ? `🔥 ${streakDays}-day learning streak` : null,
      '',
      'Master distributed app development with Aspire!',
      'https://aspire.dev',
    ]
      .filter(Boolean)
      .join('\n');

    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      // Clipboard not available
    }
  };

  return (
    <Button
      variant="outline"
      size="sm"
      borderColor="game.pixelBorder"
      color="dark.text"
      _hover={{ bg: 'content.hover' }}
      onClick={handleShare}
      data-testid="share-progress-btn"
    >
      <FiShare2 />
      {copied ? '✓ Copied!' : 'Share My Progress'}
    </Button>
  );
}
