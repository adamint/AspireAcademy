import { Box, Flex, Text, VStack, Button } from '@chakra-ui/react';
import { useState } from 'react';
import { retroCardProps, pixelFontProps } from '../theme/aspireTheme';

interface Skill {
  name: string;
  score: number;
  lessonsCompleted?: number;
  totalLessons?: number;
}

interface SkillRadarProps {
  skills: Skill[];
  size?: number;
}

const getPoint = (centerX: number, centerY: number, radius: number, angle: number) => ({
  x: centerX + radius * Math.cos(angle - Math.PI / 2),
  y: centerY + radius * Math.sin(angle - Math.PI / 2),
});

const GRID_LEVELS = 5;
const GRID_COLOR = 'rgba(107, 79, 187, 0.2)';
const AXIS_COLOR = 'rgba(107, 79, 187, 0.3)';
const DATA_FILL = 'rgba(107, 92, 231, 0.3)';
const DATA_STROKE = '#6B5CE7';
const DOT_COLOR = '#FFD700';
const LABEL_COLOR = '#E8E0F0';

export default function SkillRadar({ skills, size = 300 }: SkillRadarProps) {
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);

  if (skills.length < 3) {
    return null;
  }

  const padding = 50;
  const svgSize = size + padding * 2;
  const center = svgSize / 2;
  const maxRadius = size / 2;
  const angleStep = (2 * Math.PI) / skills.length;

  const getPolygonPoints = (radiusFraction: number) =>
    skills
      .map((_, i) => {
        const angle = i * angleStep;
        const p = getPoint(center, center, maxRadius * radiusFraction, angle);
        return `${p.x},${p.y}`;
      })
      .join(' ');

  const dataPoints = skills.map((skill, i) => {
    const angle = i * angleStep;
    const radius = (skill.score / 100) * maxRadius;
    return getPoint(center, center, radius, angle);
  });

  const dataPolygon = dataPoints.map((p) => `${p.x},${p.y}`).join(' ');

  const handleCopySkills = () => {
    const lines = skills.map((s) => `${s.name}: ${s.score}%`);
    const text = `🎯 My Aspire Learn Skills\n${lines.join('\n')}`;
    navigator.clipboard.writeText(text);
  };

  return (
    <Box {...retroCardProps} p={5} bg="dark.card">
      <Text {...pixelFontProps} fontSize="md" fontWeight="bold" mb={4} color="dark.text">
        🎯 Skill Map
      </Text>

      <Flex justify="center" mb={4}>
        <Box position="relative">
          <svg
            width="100%"
            height="100%"
            viewBox={`0 0 ${svgSize} ${svgSize}`}
            style={{ maxWidth: size + padding * 2, maxHeight: size + padding * 2 }}
          >
            {/* Background grid polygons */}
            {Array.from({ length: GRID_LEVELS }, (_, level) => {
              const fraction = (level + 1) / GRID_LEVELS;
              return (
                <polygon
                  key={`grid-${level}`}
                  points={getPolygonPoints(fraction)}
                  fill="none"
                  stroke={GRID_COLOR}
                  strokeWidth={1}
                />
              );
            })}

            {/* Axis lines from center to each vertex */}
            {skills.map((_, i) => {
              const angle = i * angleStep;
              const outerPoint = getPoint(center, center, maxRadius, angle);
              return (
                <line
                  key={`axis-${i}`}
                  x1={center}
                  y1={center}
                  x2={outerPoint.x}
                  y2={outerPoint.y}
                  stroke={AXIS_COLOR}
                  strokeWidth={1}
                />
              );
            })}

            {/* Data polygon fill + stroke */}
            <polygon
              points={dataPolygon}
              fill={DATA_FILL}
              stroke={DATA_STROKE}
              strokeWidth={2}
            />

            {/* Data point dots */}
            {dataPoints.map((p, i) => (
              <circle
                key={`dot-${i}`}
                cx={p.x}
                cy={p.y}
                r={hoveredIndex === i ? 6 : 4}
                fill={DOT_COLOR}
                stroke={DATA_STROKE}
                strokeWidth={1.5}
                style={{ cursor: 'pointer', transition: 'r 0.15s ease' }}
                onMouseEnter={() => setHoveredIndex(i)}
                onMouseLeave={() => setHoveredIndex(null)}
              />
            ))}

            {/* Skill labels at each vertex */}
            {skills.map((skill, i) => {
              const angle = i * angleStep;
              const labelRadius = maxRadius + 24;
              const labelPoint = getPoint(center, center, labelRadius, angle);

              const normalizedAngle = ((angle - Math.PI / 2) % (2 * Math.PI) + 2 * Math.PI) % (2 * Math.PI);
              let textAnchor: 'start' | 'middle' | 'end' = 'middle';
              if (normalizedAngle > Math.PI * 0.1 && normalizedAngle < Math.PI * 0.9) {
                textAnchor = 'start';
              } else if (normalizedAngle > Math.PI * 1.1 && normalizedAngle < Math.PI * 1.9) {
                textAnchor = 'end';
              }

              return (
                <text
                  key={`label-${i}`}
                  x={labelPoint.x}
                  y={labelPoint.y}
                  textAnchor={textAnchor}
                  dominantBaseline="central"
                  fill={LABEL_COLOR}
                  fontSize={10}
                  fontFamily='"Press Start 2P", monospace'
                >
                  {skill.name}
                </text>
              );
            })}

            {/* Hover tooltip */}
            {hoveredIndex !== null && (() => {
              const skill = skills[hoveredIndex];
              const p = dataPoints[hoveredIndex];
              const tooltipWidth = 100;
              const tooltipHeight = 28;
              let tx = p.x - tooltipWidth / 2;
              let ty = p.y - tooltipHeight - 12;
              if (ty < 4) {
                ty = p.y + 14;
              }
              if (tx < 4) {
                tx = 4;
              }
              if (tx + tooltipWidth > svgSize - 4) {
                tx = svgSize - tooltipWidth - 4;
              }
              return (
                <g>
                  <rect
                    x={tx}
                    y={ty}
                    width={tooltipWidth}
                    height={tooltipHeight}
                    rx={4}
                    fill="rgba(26, 11, 46, 0.95)"
                    stroke={DATA_STROKE}
                    strokeWidth={1}
                  />
                  <text
                    x={tx + tooltipWidth / 2}
                    y={ty + tooltipHeight / 2}
                    textAnchor="middle"
                    dominantBaseline="central"
                    fill={DOT_COLOR}
                    fontSize={11}
                    fontFamily='"Press Start 2P", monospace'
                  >
                    {skill.score}%
                  </text>
                </g>
              );
            })()}
          </svg>
        </Box>
      </Flex>

      {/* Legend / score list */}
      <VStack gap={2} align="stretch" mb={4}>
        {skills.map((skill) => (
          <Flex key={skill.name} align="center" gap={3}>
            <Text
              {...pixelFontProps}
              fontSize="9px"
              color="dark.text"
              minW="100px"
              textAlign="right"
            >
              {skill.name}
            </Text>
            <Box flex={1} h="10px" bg="dark.surface" borderRadius="sm" overflow="hidden">
              <Box
                h="100%"
                w={`${skill.score}%`}
                bg="aspire.600"
                borderRadius="sm"
                transition="width 0.5s ease"
              />
            </Box>
            <Text {...pixelFontProps} fontSize="9px" color="game.xpGold" minW="40px">
              {skill.score}%
            </Text>
          </Flex>
        ))}
      </VStack>

      <Flex justify="center">
        <Button
          size="sm"
          variant="outline"
          borderColor="game.pixelBorder"
          color="dark.text"
          _hover={{ bg: 'content.hover' }}
          onClick={handleCopySkills}
        >
          📋 Share Skills
        </Button>
      </Flex>
    </Box>
  );
}
