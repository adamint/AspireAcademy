import { useNavigate } from 'react-router-dom';
import { Flex, Text, Badge } from '@chakra-ui/react';
import { pixelFontProps } from '../../theme/aspireTheme';
import type { Lesson, LessonStatus, LessonType } from '../../types/curriculum';

interface LessonListItemProps {
  lesson: Lesson;
}

const statusIcons: Record<LessonStatus, string> = {
  completed: '✅',
  perfect: '⭐',
  in_progress: '🔵',
  available: '○',
  locked: '🔒',
};

const typeIcons: Record<LessonType, string> = {
  learn: '📖',
  quiz: '🧪',
  challenge: '💻',
  build: '🏗️',
  boss: '🎮',
};

export default function LessonListItem({ lesson }: LessonListItemProps) {
  const navigate = useNavigate();

  const isClickable = lesson.status !== 'locked';

  const handleClick = () => {
    if (!isClickable) return;
    switch (lesson.type) {
      case 'quiz':
        navigate(`/quizzes/${lesson.id}`);
        break;
      case 'challenge':
      case 'build':
      case 'boss':
        navigate(`/challenges/${lesson.id}`);
        break;
      default:
        navigate(`/lessons/${lesson.id}`);
    }
  };

  const statusColor = (): string => {
    switch (lesson.status) {
      case 'completed':
        return 'game.success';
      case 'perfect':
        return 'game.perfect';
      case 'in_progress':
        return 'aspire.600';
      case 'locked':
        return 'game.locked';
      default:
        return 'aspire.400';
    }
  };

  return (
    <Flex
      align="center"
      gap="2.5"
      px="3"
      py="2"
      borderRadius="sm"
      cursor={isClickable ? 'pointer' : 'default'}
      opacity={isClickable ? 1 : 0.5}
      _hover={isClickable ? { bg: 'aspire.50' } : {}}
      onClick={handleClick}
      role="button"
      tabIndex={isClickable ? 0 : -1}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') handleClick();
      }}
    >
      <Text w="5" textAlign="center" fontSize="sm" flexShrink={0}>
        {statusIcons[lesson.status]}
      </Text>
      <Text w="5" textAlign="center" fontSize="sm" flexShrink={0}>
        {typeIcons[lesson.type]}
      </Text>
      <Text fontSize="sm" flex="1" minW="0" truncate color={statusColor()}>
        {lesson.title}
      </Text>
      <Badge
        {...pixelFontProps}
        fontSize="2xs"
        colorPalette="yellow"
        variant="subtle"
      >
        {lesson.xpReward} XP
      </Badge>
    </Flex>
  );
}
