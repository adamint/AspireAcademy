import { useState } from 'react';
import {
  Box,
  Flex,
  Text,
  Card,
  Badge,
} from '@chakra-ui/react';
import { FiChevronDown, FiChevronRight, FiLock } from 'react-icons/fi';
import { retroCardProps, pixelFontProps } from '../../theme/aspireTheme';
import LessonListItem from './LessonListItem';
import type { Module } from '../../types/curriculum';

interface ModuleCardProps {
  module: Module;
  worldId: string;
}

export default function ModuleCard({ module }: ModuleCardProps) {
  const [expanded, setExpanded] = useState(!module.isLocked);

  const toggle = () => {
    if (!module.isLocked) setExpanded((p) => !p);
  };

  const allComplete =
    module.completedLessons + (module.skippedLessons ?? 0) === module.totalLessons && module.totalLessons > 0;

  const skippedCount = module.skippedLessons ?? 0;

  return (
    <Card.Root data-testid={`module-card-${module.id}`} variant="outline" {...retroCardProps}>
      <Card.Body p="4">
        <Flex
          align="center"
          gap="3"
          cursor={module.isLocked ? 'default' : 'pointer'}
          opacity={module.isLocked ? 0.55 : 1}
          userSelect="none"
          onClick={toggle}
          title={module.isLocked ? `${module.name} - Locked` : `Toggle ${module.name} module`}
          aria-label={module.isLocked ? `${module.name} module - Locked` : `Toggle ${module.name} module`}
          aria-expanded={module.isLocked ? undefined : expanded}
          role="button"
          tabIndex={module.isLocked ? -1 : 0}
          onKeyDown={(e) => {
            if ((e.key === 'Enter' || e.key === ' ') && !module.isLocked) {
              e.preventDefault();
              toggle();
            }
          }}
        >
          <Box color={module.isLocked ? 'game.locked' : 'aspire.600'} fontSize="md">
            {module.isLocked ? (
              <FiLock />
            ) : expanded ? (
              <FiChevronDown />
            ) : (
              <FiChevronRight />
            )}
          </Box>

          <Text fontWeight="semibold" fontSize="md" flex="1">
            {module.name}
          </Text>

          <Badge
            {...pixelFontProps}
            fontSize="2xs"
            colorPalette={allComplete ? 'green' : 'purple'}
            variant="subtle"
          >
            {module.completedLessons}/{module.totalLessons}
            {skippedCount > 0 && ` (${skippedCount} skipped)`}
          </Badge>
        </Flex>

        {module.isLocked && (
          <Text fontSize="xs" color="game.locked" mt="1" pl="7">
            Complete the previous module to unlock
          </Text>
        )}

        {expanded && !module.isLocked && (
          <Flex
            flexDirection="column"
            gap="0.5"
            mt="3"
            pl="2"
            borderLeft="3px solid"
            borderColor="aspire.400"
          >
            {module.lessons
              .slice()
              .sort((a, b) => a.sortOrder - b.sortOrder)
              .map((lesson) => (
                <LessonListItem key={lesson.id} lesson={lesson} />
              ))}
          </Flex>
        )}
      </Card.Body>
    </Card.Root>
  );
}
