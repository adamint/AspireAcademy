import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Box, Flex, Text, Skeleton } from '@chakra-ui/react';
import { retroCardProps, pixelFontProps } from '../theme/aspireTheme';
import api from '../services/apiClient';
import { formatDateLabel } from '../utils/formatters';

interface ActivityDay {
  date: string;
  count: number;
}

interface ActivityHeatmapResponse {
  days: ActivityDay[];
}

interface DayCell {
  date: string;
  count: number;
  dayOfWeek: number;
}

const CELL_SIZE = 14;
const GAP = 2;

const HEATMAP_COLORS = {
  empty: 'aspire.50',
  level1: 'aspire.200',
  level2: 'aspire.500',
  level3: 'aspire.600',
  level4: 'game.xpGold',
} as const;

function getColor(count: number): string {
  if (count === 0) return HEATMAP_COLORS.empty;
  if (count === 1) return HEATMAP_COLORS.level1;
  if (count <= 3) return HEATMAP_COLORS.level2;
  if (count <= 6) return HEATMAP_COLORS.level3;
  return HEATMAP_COLORS.level4;
}

const MONTH_LABELS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const DAY_LABELS = ['', 'Mon', '', 'Wed', '', 'Fri', ''];

function generateGrid(activityData: Map<string, number>): DayCell[] {
  const today = new Date();
  const days: DayCell[] = [];
  for (let i = 364; i >= 0; i--) {
    const date = new Date(today);
    date.setDate(date.getDate() - i);
    const key = date.toISOString().split('T')[0];
    days.push({ date: key, count: activityData.get(key) || 0, dayOfWeek: date.getDay() });
  }
  return days;
}

function computeStreak(days: DayCell[]): number {
  let streak = 0;
  for (let i = days.length - 1; i >= 0; i--) {
    if (days[i].count > 0) {
      streak++;
    } else {
      // Allow today to have 0 if yesterday had activity
      if (i === days.length - 1) continue;
      break;
    }
  }
  return streak;
}

function computeLongestStreak(days: DayCell[]): number {
  let longest = 0;
  let current = 0;
  for (const day of days) {
    if (day.count > 0) {
      current++;
      if (current > longest) longest = current;
    } else {
      current = 0;
    }
  }
  return longest;
}

function getStreakMilestone(streak: number): string | null {
  if (streak >= 100) return '🔥 100 day streak!';
  if (streak >= 30) return '🔥 Month streak!';
  if (streak >= 7) return '🔥 Week streak!';
  return null;
}

function getMonthPositions(days: DayCell[], weekCount: number): { label: string; col: number }[] {
  const positions: { label: string; col: number }[] = [];
  let lastMonth = -1;

  for (let i = 0; i < days.length; i++) {
    const d = new Date(days[i].date);
    const month = d.getMonth();
    if (month !== lastMonth && d.getDay() === 0) {
      const weekIndex = Math.floor((i + (7 - (days[0].dayOfWeek || 7)) % 7) / 7);
      if (weekIndex < weekCount) {
        positions.push({ label: MONTH_LABELS[month], col: weekIndex });
      }
      lastMonth = month;
    }
  }
  return positions;
}

interface ActivityHeatmapProps {
  userId?: string;
  compact?: boolean;
}

export default function ActivityHeatmap({ userId, compact = false }: ActivityHeatmapProps) {
  const [tooltip, setTooltip] = useState<{ x: number; y: number; text: string } | null>(null);

  const { data, isLoading } = useQuery<ActivityHeatmapResponse>({
    queryKey: ['activity-heatmap', userId],
    queryFn: () => api.get('/profile/activity-heatmap').then((r) => r.data),
  });

  const { days, totalCount, streak, longestStreak, totalActiveDays, monthPositions } = useMemo(() => {
    const activityMap = new Map<string, number>();
    if (data?.days) {
      for (const d of data.days) {
        activityMap.set(d.date, d.count);
      }
    }
    const allDays = generateGrid(activityMap);
    const total = allDays.reduce((sum, d) => sum + d.count, 0);
    const currentStreak = computeStreak(allDays);
    const longest = computeLongestStreak(allDays);
    const activeDays = allDays.filter((d) => d.count > 0).length;
    const wc = compact ? 26 : 53;
    const visibleDays = compact ? allDays.slice(-26 * 7) : allDays;
    const positions = getMonthPositions(visibleDays, wc);
    return { days: visibleDays, totalCount: total, streak: currentStreak, longestStreak: longest, totalActiveDays: activeDays, monthPositions: positions, weekCount: wc };
  }, [data, compact]);

  // Pad start so first day aligns to its correct day-of-week row
  const paddedDays = useMemo(() => {
    if (days.length === 0) return [];
    const firstDayOfWeek = days[0].dayOfWeek;
    // Sunday = 0 in JS, we want Mon=0 row layout, so convert
    const adjustedFirst = firstDayOfWeek === 0 ? 6 : firstDayOfWeek - 1;
    const padding: DayCell[] = Array.from({ length: adjustedFirst }, (_, i) => ({
      date: '',
      count: -1,
      dayOfWeek: i,
    }));
    return [...padding, ...days];
  }, [days]);

  const todayStr = new Date().toISOString().split('T')[0];
  const streakMilestone = getStreakMilestone(streak);

  if (isLoading) {
    return (
      <Box {...retroCardProps} p={4} bg="dark.card">
        <Skeleton h="120px" borderRadius="sm" />
      </Box>
    );
  }

  const handleMouseEnter = (e: React.MouseEvent, day: DayCell) => {
    if (day.count < 0) return;
    const rect = (e.target as HTMLElement).getBoundingClientRect();
    const container = (e.target as HTMLElement).closest('[data-heatmap]')?.getBoundingClientRect();
    if (!container) return;
    setTooltip({
      x: rect.left - container.left + CELL_SIZE / 2,
      y: rect.top - container.top - 8,
      text: day.count === 0
        ? `No activity on ${formatDateLabel(day.date)}`
        : `${day.count} ${day.count === 1 ? 'activity' : 'activities'} on ${formatDateLabel(day.date)}`,
    });
  };

  return (
    <Box {...retroCardProps} p={4} bg="dark.card" data-testid="activity-heatmap">
      <Flex justify="space-between" align="center" mb={3} flexWrap="wrap" gap={2}>
        <Text {...pixelFontProps} fontSize="xs" color="dark.text">
          Activity
        </Text>
        <Text fontSize="xs" color="dark.muted">
          {totalCount} {totalCount === 1 ? 'activity' : 'activities'} in the last year
        </Text>
      </Flex>

      {!compact && (
        <Flex gap={4} mb={3} flexWrap="wrap" align="center">
          <Flex align="center" gap={1}>
            <Text {...pixelFontProps} fontSize="10px" color="game.streak" data-testid="streak-count">
              🔥 {streak} days
            </Text>
          </Flex>
          <Flex align="center" gap={1}>
            <Text {...pixelFontProps} fontSize="10px" color="aspire.400" data-testid="longest-streak">
              🏆 {longestStreak} longest
            </Text>
          </Flex>
          <Flex align="center" gap={1}>
            <Text {...pixelFontProps} fontSize="10px" color="game.xpGold" data-testid="total-active-days">
              ⭐ {totalActiveDays} active days
            </Text>
          </Flex>
          {streakMilestone && (
            <Text {...pixelFontProps} fontSize="10px" color="game.streak" data-testid="streak-milestone">
              {streakMilestone}
            </Text>
          )}
        </Flex>
      )}

      <Box position="relative" data-heatmap overflowX="auto">
        {/* Month labels */}
        <Flex ml={`${30 + GAP}px`} mb="2px" h="14px">
          {monthPositions.map((mp, i) => (
            <Text
              key={i}
              fontSize="9px"
              color="dark.muted"
              position="absolute"
              left={`${30 + mp.col * (CELL_SIZE + GAP)}px`}
              top="0"
              userSelect="none"
            >
              {mp.label}
            </Text>
          ))}
        </Flex>

        <Flex>
          {/* Day labels */}
          <Flex direction="column" gap={`${GAP}px`} mr={`${GAP}px`} flexShrink={0} w="28px" mt="0px">
            {DAY_LABELS.map((label, i) => (
              <Flex key={i} h={`${CELL_SIZE}px`} align="center">
                <Text fontSize="9px" color="dark.muted" userSelect="none">
                  {label}
                </Text>
              </Flex>
            ))}
          </Flex>

          {/* Grid */}
          <Box
            display="grid"
            gridTemplateRows={`repeat(7, ${CELL_SIZE}px)`}
            gridAutoFlow="column"
            gridAutoColumns={`${CELL_SIZE}px`}
            gap={`${GAP}px`}
          >
            {paddedDays.map((day, i) => (
              <Box
                key={i}
                w={`${CELL_SIZE}px`}
                h={`${CELL_SIZE}px`}
                borderRadius="2px"
                bg={day.count < 0 ? 'transparent' : getColor(day.count)}
                cursor={day.count >= 0 ? 'pointer' : 'default'}
                transition="transform 0.1s, box-shadow 0.2s"
                outline={day.date === todayStr ? '2px solid' : undefined}
                outlineColor={day.date === todayStr ? 'game.xpGold' : undefined}
                boxShadow={day.date === todayStr ? '0 0 6px rgba(255, 215, 0, 0.5)' : undefined}
                _hover={day.count >= 0 ? { transform: 'scale(1.3)', outline: '1px solid rgba(255,255,255,0.3)' } : {}}
                onMouseEnter={(e) => handleMouseEnter(e, day)}
                onMouseLeave={() => setTooltip(null)}
              />
            ))}
          </Box>
        </Flex>

        {/* Tooltip */}
        {tooltip && (
          <Box
            position="absolute"
            left={`${tooltip.x}px`}
            top={`${tooltip.y}px`}
            transform="translate(-50%, -100%)"
            bg="#1a1630"
            color="white"
            px={2}
            py={1}
            borderRadius="4px"
            fontSize="11px"
            whiteSpace="nowrap"
            pointerEvents="none"
            border="1px solid #2B1260"
            zIndex={10}
            boxShadow="0 2px 8px rgba(0,0,0,0.5)"
          >
            {tooltip.text}
          </Box>
        )}

        {/* Legend */}
        <Flex mt={2} justify="flex-end" align="center" gap={1}>
          <Text fontSize="9px" color="dark.muted" mr={1}>Less</Text>
          {[HEATMAP_COLORS.empty, HEATMAP_COLORS.level1, HEATMAP_COLORS.level2, HEATMAP_COLORS.level3, HEATMAP_COLORS.level4].map((color, i) => (
            <Box key={i} w="10px" h="10px" borderRadius="2px" bg={color} />
          ))}
          <Text fontSize="9px" color="dark.muted" ml={1}>More</Text>
        </Flex>
      </Box>
    </Box>
  );
}
