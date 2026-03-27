import { useNavigate } from 'react-router-dom';
import { Flex, Text, Badge } from '@chakra-ui/react';
import { pixelFontProps } from '../../theme/aspireTheme';
import { LessonType, ProgressStatus } from '../../constants';
import type { Lesson, LessonStatus, LessonType as LessonTypeUnion } from '../../types/curriculum';

interface LessonListItemProps {
  lesson: Lesson;
}

const statusIcons: Record<LessonStatus, string> = {
  completed: '✅',
  perfect: '⭐',
  in_progress: '🔵',
  available: '○',
  locked: '🔒',
  skipped: '⏭️',
};

const typeIcons: Record<string, string> = {
  learn: '📖',
  quiz: '🧪',
  challenge: '💻',
  build: '🏗️',
  boss: '🎮',
  'boss-battle': '🎮',
  'build-project': '🏗️',
};

export default function LessonListItem({ lesson }: LessonListItemProps) {
  const navigate = useNavigate();

  // All lessons are clickable now — locked ones navigate to preview
  const isClickable = true;

  const handleClick = () => {
    if (!isClickable) return;
    switch (lesson.type) {
      case LessonType.Quiz:
        navigate(`/quizzes/${lesson.id}`);
        break;
      case LessonType.Challenge:
      case LessonType.Build:
      case LessonType.Boss:
      case LessonType.BossBattle:
      case LessonType.BuildProject:
        navigate(`/challenges/${lesson.id}`);
        break;
      default:
        navigate(`/lessons/${lesson.id}`);
    }
  };

  const statusColor = (): string => {
    switch (lesson.status) {
      case ProgressStatus.Completed:
        return 'game.success';
      case ProgressStatus.Perfect:
        return 'game.perfect';
      case ProgressStatus.InProgressUnderscore:
        return 'aspire.600';
      case ProgressStatus.Skipped:
        return 'dark.muted';
      case ProgressStatus.Locked:
        return 'game.locked';
      default:
        return 'aspire.400';
    }
  };

  const isLocked = lesson.status === ProgressStatus.Locked;
  const isSkipped = lesson.status === ProgressStatus.Skipped;

  return (
    <Flex
      data-testid={`lesson-${lesson.id}`}
      align="center"
      gap="2.5"
      px="3"
      py="2"
      borderRadius="sm"
      cursor={isClickable ? 'pointer' : 'default'}
      opacity={isLocked ? 0.7 : isSkipped ? 0.75 : 1}
      _hover={isClickable ? { bg: 'content.hover' } : {}}
      onClick={handleClick}
      role="button"
      tabIndex={isClickable ? 0 : -1}
      title={`${lesson.title} - ${lesson.type} lesson (${lesson.xpReward} XP)`}
      aria-label={`${lesson.title} - ${lesson.type} lesson (${lesson.xpReward} XP)`}
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
      {isLocked && (
        <Badge fontSize="2xs" colorPalette="gray" variant="subtle">
          👁️ preview
        </Badge>
      )}
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
