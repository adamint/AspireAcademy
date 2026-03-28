import { useMemo } from 'react';
import { Box } from '@chakra-ui/react';
import type { World } from '../../types/curriculum';

export interface BazaarProgressTrackerProps {
  worlds: World[];
}

const W = 112;
const H = 46;

interface NodeDef {
  id: string;
  label: string;
  tech: string;
  cx: number;
  cy: number;
  /** sortOrder of the world that unlocks this component */
  sortOrder: number;
}

/*
 * Layout — API centered so connections fan out cleanly:
 *   [bazaar-web] ──→ [bazaar-api]
 *                   /      |      \
 *       [PostgreSQL]    [Redis]   [RabbitMQ]
 *            |                        |
 *       [bazaar-recs]           [bazaar-worker]
 */
const NODES: NodeDef[] = [
  { id: 'bazaar-web',    label: 'bazaar-web',    tech: 'TypeScript', cx: 95,  cy: 40,  sortOrder: 3 },
  { id: 'bazaar-api',    label: 'bazaar-api',    tech: 'C#',         cx: 250, cy: 40,  sortOrder: 1 },
  { id: 'postgres',      label: 'PostgreSQL',    tech: 'Database',   cx: 75,  cy: 140, sortOrder: 5 },
  { id: 'redis',         label: 'Redis',         tech: 'Cache',      cx: 250, cy: 140, sortOrder: 5 },
  { id: 'rabbitmq',      label: 'RabbitMQ',      tech: 'Broker',     cx: 425, cy: 140, sortOrder: 5 },
  { id: 'bazaar-recs',   label: 'bazaar-recs',   tech: 'Python',     cx: 120, cy: 240, sortOrder: 3 },
  { id: 'bazaar-worker', label: 'bazaar-worker', tech: 'Go',         cx: 380, cy: 240, sortOrder: 3 },
];

const EDGES: [string, string][] = [
  ['bazaar-web',  'bazaar-api'],
  ['bazaar-api',  'postgres'],
  ['bazaar-api',  'redis'],
  ['bazaar-api',  'rabbitmq'],
  ['postgres',    'bazaar-recs'],
  ['rabbitmq',    'bazaar-worker'],
];

function lineEndpoints(a: NodeDef, b: NodeDef) {
  // Same row → horizontal line
  if (Math.abs(a.cy - b.cy) < H) {
    const dir = b.cx > a.cx ? 1 : -1;
    return {
      x1: a.cx + dir * (W / 2 + 2),
      y1: a.cy,
      x2: b.cx - dir * (W / 2 + 2),
      y2: b.cy,
    };
  }
  // Different rows → exit bottom, enter top
  return {
    x1: a.cx,
    y1: a.cy + H / 2 + 2,
    x2: b.cx,
    y2: b.cy - H / 2 - 2,
  };
}

const ACCENT = '#6B4FBB';
const ACTIVE_STROKE = '#B5B7E7';
const SUB_COLOR = '#9185D1';
const MUTED = '#4A5568';
const HEALTH = '#107C10';

export default function BazaarProgressTracker({ worlds }: BazaarProgressTrackerProps) {
  const done = useMemo(() => {
    const s = new Set<number>();
    for (const w of worlds) {
      if (w.completionPercentage === 100) s.add(w.sortOrder);
    }
    return s;
  }, [worlds]);

  const wired = done.has(4);
  const observable = done.has(6);

  const byId = useMemo(() => new Map(NODES.map(n => [n.id, n])), []);

  return (
    <Box data-testid="bazaar-progress-tracker" w="100%" maxW="520px" mx="auto">
      <svg
        viewBox="0 0 500 270"
        width="100%"
        role="img"
        aria-label="Bazaar app architecture progress"
      >
        <defs>
          <filter id="bazaar-glow">
            <feGaussianBlur stdDeviation="2" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
          <marker
            id="arr-on"
            viewBox="0 0 10 7"
            refX="9"
            refY="3.5"
            markerWidth="7"
            markerHeight="5"
            orient="auto"
          >
            <path d="M0 0L10 3.5L0 7z" fill={ACCENT} />
          </marker>
          <marker
            id="arr-off"
            viewBox="0 0 10 7"
            refX="9"
            refY="3.5"
            markerWidth="7"
            markerHeight="5"
            orient="auto"
          >
            <path d="M0 0L10 3.5L0 7z" fill={`${MUTED}44`} />
          </marker>
        </defs>

        {/* Connection lines (behind nodes) */}
        {EDGES.map(([fId, tId]) => {
          const f = byId.get(fId)!;
          const t = byId.get(tId)!;
          const { x1, y1, x2, y2 } = lineEndpoints(f, t);

          return (
            <line
              key={`${fId}-${tId}`}
              x1={x1}
              y1={y1}
              x2={x2}
              y2={y2}
              stroke={wired ? ACCENT : `${MUTED}33`}
              strokeWidth={wired ? 2 : 1.5}
              strokeDasharray={wired ? undefined : '4 3'}
              markerEnd={wired ? 'url(#arr-on)' : 'url(#arr-off)'}
              data-testid={`connection-${fId}-${tId}`}
            />
          );
        })}

        {/* Component nodes */}
        {NODES.map(n => {
          const on = done.has(n.sortOrder);
          const x = n.cx - W / 2;
          const y = n.cy - H / 2;

          return (
            <g
              key={n.id}
              data-testid={`bazaar-node-${n.id}`}
              opacity={on ? 1 : 0.4}
            >
              <rect
                rx="6"
                ry="6"
                x={x}
                y={y}
                width={W}
                height={H}
                fill={on ? 'rgba(107,79,187,.15)' : 'rgba(74,85,104,.06)'}
                stroke={on ? ACTIVE_STROKE : MUTED}
                strokeWidth={on ? 2 : 1.5}
                filter={on ? 'url(#bazaar-glow)' : undefined}
              />
              <text
                x={n.cx}
                y={n.cy - 4}
                textAnchor="middle"
                fill={
                  on
                    ? 'var(--chakra-colors-dark-text, #E8E0F0)'
                    : 'var(--chakra-colors-dark-muted, #9B93B0)'
                }
                fontSize="10"
                fontWeight="600"
                fontFamily="system-ui, -apple-system, sans-serif"
              >
                {n.label}
              </text>
              <text
                x={n.cx}
                y={n.cy + 12}
                textAnchor="middle"
                fill={on ? SUB_COLOR : MUTED}
                fontSize="8"
                fontFamily="system-ui, -apple-system, sans-serif"
              >
                {n.tech}
              </text>

              {/* Observability health indicator (World 6) */}
              {observable && on && (
                <circle
                  cx={x + W - 8}
                  cy={y + 8}
                  r="3"
                  fill={HEALTH}
                  data-testid={`observability-${n.id}`}
                >
                  <animate
                    attributeName="opacity"
                    values="1;.3;1"
                    dur="2s"
                    repeatCount="indefinite"
                  />
                </circle>
              )}
            </g>
          );
        })}
      </svg>
    </Box>
  );
}
