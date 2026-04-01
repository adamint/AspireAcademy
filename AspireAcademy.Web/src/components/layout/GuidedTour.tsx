import { useState, useEffect, useCallback, useRef } from 'react';
import { Box, Flex, Text, Button } from '@chakra-ui/react';
import { useLocation } from 'react-router-dom';
import { pixelFontProps } from '../../theme/aspireTheme';
import { TOUR_STORAGE_KEY } from './tourUtils';

/* ─── Tour Step Definition ──────────────────────────────────────────────────── */

export interface TourStep {
  target: string;
  title: string;
  description: string;
  placement: 'top' | 'bottom' | 'left' | 'right';
  icon: string;
}

const TOUR_STEPS: TourStep[] = [
  {
    target: '[data-tour="sidebar-home"]',
    title: 'Your Command Center',
    icon: '🏠',
    description: 'Welcome! This sidebar is your main navigation. The Dashboard shows your progress, active lessons, and personalized recommendations. Head here whenever you want an overview of your journey.',
    placement: 'right',
  },
  {
    target: '[data-tour="sidebar-worlds"]',
    title: 'Worlds — Your Learning Path',
    icon: '🌍',
    description: 'The curriculum is organized into Worlds — from fundamentals to advanced topics. Each World has modules with lessons, code challenges, and quizzes. They unlock progressively as you learn. Start with World 1: Welcome to Aspire!',
    placement: 'right',
  },
  {
    target: '[data-tour="sidebar-explore"]',
    title: 'Hands-On Tools',
    icon: '🧪',
    description: 'The Playground lets you write and run real AppHost code in the browser. The Gallery showcases 12 production-ready architectures you can learn from. The Concept Map visualizes how all Aspire concepts connect.',
    placement: 'right',
  },
  {
    target: '[data-tour="sidebar-social"]',
    title: 'Community & Achievements',
    icon: '🏆',
    description: 'Track your achievements, compete on the leaderboard, connect with fellow learners, and earn certificates as you master Aspire. Every lesson and challenge earns you XP toward your next rank!',
    placement: 'right',
  },
  {
    target: '[data-tour="xp-bar"]',
    title: 'Your XP & Level',
    icon: '⭐',
    description: 'This bar tracks your experience points. Complete lessons, ace quizzes, and finish challenges to earn XP. As you level up, you\'ll unlock new ranks and badges. Keep your daily streak going for bonus XP!',
    placement: 'bottom',
  },
];

const APPSHELL_ROUTES = ['/dashboard', '/worlds', '/playground', '/gallery', '/concept-map', '/leaderboard', '/achievements', '/weekly-challenge', '/whats-new', '/personas'];

/* ─── Positioning Logic ─────────────────────────────────────────────────────── */

interface TooltipPos {
  top: number;
  left: number;
  arrowSide: 'top' | 'bottom' | 'left' | 'right';
}

function calcPosition(
  rect: DOMRect,
  placement: TourStep['placement'],
  tooltipW: number,
  tooltipH: number,
): TooltipPos {
  const gap = 16;

  switch (placement) {
    case 'right':
      return {
        top: rect.top + rect.height / 2 - tooltipH / 2,
        left: rect.right + gap,
        arrowSide: 'left',
      };
    case 'left':
      return {
        top: rect.top + rect.height / 2 - tooltipH / 2,
        left: rect.left - tooltipW - gap,
        arrowSide: 'right',
      };
    case 'bottom':
      return {
        top: rect.bottom + gap,
        left: rect.left + rect.width / 2 - tooltipW / 2,
        arrowSide: 'top',
      };
    case 'top':
      return {
        top: rect.top - tooltipH - gap,
        left: rect.left + rect.width / 2 - tooltipW / 2,
        arrowSide: 'bottom',
      };
  }
}

/* ─── Arrow ─────────────────────────────────────────────────────────────────── */

const ARROW = 10;
const ARROW_COLOR = '#1A1630';

function Arrow({ side }: { side: TooltipPos['arrowSide'] }) {
  const common: React.CSSProperties = { position: 'absolute', width: 0, height: 0 };

  const map: Record<string, React.CSSProperties> = {
    left:   { ...common, left: -ARROW, top: '50%', transform: 'translateY(-50%)', borderTop: `${ARROW}px solid transparent`, borderBottom: `${ARROW}px solid transparent`, borderRight: `${ARROW}px solid ${ARROW_COLOR}` },
    right:  { ...common, right: -ARROW, top: '50%', transform: 'translateY(-50%)', borderTop: `${ARROW}px solid transparent`, borderBottom: `${ARROW}px solid transparent`, borderLeft: `${ARROW}px solid ${ARROW_COLOR}` },
    top:    { ...common, top: -ARROW, left: '50%', transform: 'translateX(-50%)', borderLeft: `${ARROW}px solid transparent`, borderRight: `${ARROW}px solid transparent`, borderBottom: `${ARROW}px solid ${ARROW_COLOR}` },
    bottom: { ...common, bottom: -ARROW, left: '50%', transform: 'translateX(-50%)', borderLeft: `${ARROW}px solid transparent`, borderRight: `${ARROW}px solid transparent`, borderTop: `${ARROW}px solid ${ARROW_COLOR}` },
  };

  return <div style={map[side]} />;
}

/* ─── Progress Dots ─────────────────────────────────────────────────────────── */

function ProgressDots({ current, total }: { current: number; total: number }) {
  return (
    <Flex gap="1.5" align="center">
      {Array.from({ length: total }, (_, i) => (
        <Box
          key={i}
          w={i === current ? '20px' : '8px'}
          h="8px"
          borderRadius="full"
          bg={i === current ? 'aspire.500' : i < current ? 'aspire.600' : 'whiteAlpha.300'}
          transition="all 0.3s ease"
        />
      ))}
    </Flex>
  );
}

/* ─── Main Tour Component ───────────────────────────────────────────────────── */

export function GuidedTour() {
  const location = useLocation();
  const [active, setActive] = useState(false);
  const [stepIndex, setStepIndex] = useState(0);
  const [pos, setPos] = useState<TooltipPos | null>(null);
  const [rect, setRect] = useState<DOMRect | null>(null);
  const [animating, setAnimating] = useState(false);
  const tooltipRef = useRef<HTMLDivElement>(null);
  const TOOLTIP_W = 340;

  const completeTour = useCallback(() => {
    localStorage.setItem(TOUR_STORAGE_KEY, 'true');
    setActive(false);
  }, []);

  const goToStep = useCallback((idx: number) => {
    setAnimating(true);
    setTimeout(() => {
      setStepIndex(idx);
      setAnimating(false);
    }, 150);
  }, []);

  const nextStep = useCallback(() => {
    if (stepIndex < TOUR_STEPS.length - 1) goToStep(stepIndex + 1);
    else completeTour();
  }, [stepIndex, goToStep, completeTour]);

  const prevStep = useCallback(() => {
    if (stepIndex > 0) goToStep(stepIndex - 1);
  }, [stepIndex, goToStep]);

  // Show tour on first visit to any AppShell route
  useEffect(() => {
    const completed = localStorage.getItem(TOUR_STORAGE_KEY);
    if (completed) return;
    const isAppShellRoute = APPSHELL_ROUTES.some(r => location.pathname.startsWith(r));
    if (!isAppShellRoute) return;

    const timer = setTimeout(() => setActive(true), 1000);
    return () => clearTimeout(timer);
  }, [location.pathname]);

  // Reposition on step change or resize
  useEffect(() => {
    if (!active) return;
    const step = TOUR_STEPS[stepIndex];
    if (!step) return;

    function doReposition() {
      const el = document.querySelector(step.target);
      if (!el) {
        if (stepIndex < TOUR_STEPS.length - 1) setStepIndex(s => s + 1);
        else completeTour();
        return;
      }

      const r = el.getBoundingClientRect();
      setRect(r);

      const tooltipH = tooltipRef.current?.offsetHeight ?? 220;
      const p = calcPosition(r, step.placement, TOOLTIP_W, tooltipH);

      p.left = Math.max(12, Math.min(p.left, window.innerWidth - TOOLTIP_W - 12));
      p.top = Math.max(12, Math.min(p.top, window.innerHeight - tooltipH - 12));
      setPos(p);
    }

    doReposition();
    window.addEventListener('resize', doReposition);
    return () => window.removeEventListener('resize', doReposition);
  }, [active, stepIndex, completeTour]);

  // Keyboard support
  useEffect(() => {
    if (!active) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') completeTour();
      else if (e.key === 'ArrowRight' || e.key === 'Enter') nextStep();
      else if (e.key === 'ArrowLeft') prevStep();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [active, completeTour, nextStep, prevStep]);

  if (!active || !pos) return null;

  const step = TOUR_STEPS[stepIndex];
  const isLast = stepIndex === TOUR_STEPS.length - 1;

  return (
    <>
      {/* Dark overlay — single layer using box-shadow on the spotlight */}
      <Box
        position="fixed"
        inset="0"
        zIndex={9997}
        bg="rgba(0,0,0,0.6)"
        pointerEvents="auto"
        onClick={completeTour}
      />

      {/* Spotlight cutout around target */}
      {rect && (
        <Box
          position="fixed"
          top={`${rect.top - 6}px`}
          left={`${rect.left - 6}px`}
          width={`${rect.width + 12}px`}
          height={`${rect.height + 12}px`}
          borderRadius="lg"
          zIndex={9998}
          pointerEvents="none"
          transition="all 0.3s ease"
          css={{
            boxShadow: '0 0 0 9999px rgba(0,0,0,0.6), 0 0 30px rgba(107,79,187,0.4), inset 0 0 0 2px rgba(145,133,209,0.6)',
          }}
        />
      )}

      {/* Tooltip card */}
      <Box
        ref={tooltipRef}
        position="fixed"
        top={`${pos.top}px`}
        left={`${pos.left}px`}
        width={`${TOOLTIP_W}px`}
        zIndex={10000}
        pointerEvents="auto"
        onClick={(e) => e.stopPropagation()}
        opacity={animating ? 0 : 1}
        transform={animating ? 'scale(0.95)' : 'scale(1)'}
        transition="opacity 0.2s ease, transform 0.2s ease"
      >
        <Box
          bg="#1A1630"
          border="2px solid"
          borderColor="aspire.500"
          borderRadius="lg"
          p="5"
          position="relative"
          css={{ boxShadow: '0 12px 40px rgba(0,0,0,0.6), 0 0 30px rgba(107,79,187,0.15)' }}
        >
          <Arrow side={pos.arrowSide} />

          {/* Header: icon + title */}
          <Flex align="center" gap="3" mb="3">
            <Flex
              align="center"
              justify="center"
              w="36px"
              h="36px"
              borderRadius="lg"
              bg="aspire.200"
              flexShrink={0}
              fontSize="lg"
            >
              {step.icon}
            </Flex>
            <Box flex="1">
              <Text
                fontSize="10px"
                fontWeight="bold"
                color="aspire.300"
                {...pixelFontProps}
                lineHeight="1.8"
              >
                {step.title}
              </Text>
            </Box>
          </Flex>

          {/* Description */}
          <Text fontSize="sm" color="whiteAlpha.800" lineHeight="1.7" mb="4">
            {step.description}
          </Text>

          {/* Footer: progress + nav */}
          <Flex justify="space-between" align="center">
            <ProgressDots current={stepIndex} total={TOUR_STEPS.length} />
            <Flex gap="2" align="center">
              {stepIndex > 0 && (
                <Button
                  size="xs"
                  variant="ghost"
                  color="whiteAlpha.500"
                  onClick={prevStep}
                  _hover={{ color: 'white' }}
                  fontSize="xs"
                >
                  Back
                </Button>
              )}
              <Button
                size="sm"
                bg={isLast ? 'game.xpGold' : 'aspire.600'}
                color={isLast ? '#0D0B1A' : 'white'}
                _hover={{ bg: isLast ? '#FFC107' : 'aspire.500' }}
                onClick={nextStep}
                fontSize="xs"
                fontWeight="bold"
                px="4"
              >
                {isLast ? "Let's Go! 🚀" : 'Next'}
              </Button>
            </Flex>
          </Flex>

          {/* Skip hint */}
          <Text fontSize="xs" color="whiteAlpha.300" textAlign="center" mt="3">
            Press Esc to skip · Arrow keys to navigate
          </Text>
        </Box>
      </Box>
    </>
  );
}
