import { useEffect, useRef, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Box, Flex, Text, Heading, Button, SimpleGrid, Card, Badge, IconButton } from '@chakra-ui/react';
import { FiSun, FiMoon, FiGithub } from 'react-icons/fi';
import { useAuthStore } from '../store/authStore';
import { useColorMode } from '../hooks/useColorMode';
import { retroCardProps, pixelFontProps } from '../theme/aspireTheme';
import api from '../services/apiClient';
import type { World } from '../types/curriculum';
import type { PersonaSummary } from '../types';

/* ───────────────────────────── constants ───────────────────────────── */

function buildStats(worlds: World[] | undefined) {
  const worldCount = worlds?.length ?? 13;
  const lessonCount = worlds?.reduce((sum, w) => sum + w.totalLessons, 0) ?? 174;
  return [
    { label: 'Worlds', value: String(worldCount), num: worldCount },
    { label: 'Lessons', value: String(lessonCount), num: lessonCount },
    { label: 'Code Challenges', value: '27', num: 27 },
    { label: 'Fun', value: '∞', num: -1 },
  ];
}

const HOW_IT_WORKS = [
  { step: '1', title: 'Understand', desc: 'Each lesson explains why a concept matters before showing you the API' },
  { step: '2', title: 'Build', desc: 'Code challenges have you wire real Aspire apps — not toy examples' },
  { step: '3', title: 'Go Deep', desc: 'From your first aspire run to reading the Aspire source code' },
];



/* ───────────────────────── CSS keyframes ───────────────────────── */

const KEYFRAMES = `
@keyframes rainbow-glow {
  0%,100% { text-shadow: 0 0 15px rgba(107,79,187,0.6), 0 0 40px rgba(107,79,187,0.2); }
  33%     { text-shadow: 0 0 15px rgba(45,212,191,0.6), 0 0 40px rgba(45,212,191,0.2); }
  66%     { text-shadow: 0 0 15px rgba(251,191,36,0.6), 0 0 40px rgba(251,191,36,0.2); }
}
@keyframes typewriter-cursor { 0%,100%{opacity:1} 50%{opacity:0} }
@keyframes float-node {
  0%,100% { transform:translateY(0); }
  50%     { transform:translateY(-8px); }
}
@keyframes xp-bar-fill {
  from { width:0; }
  to   { width:72%; }
}
@keyframes card-glow {
  0%,100% { box-shadow:4px 4px 0 #2B1260; }
  50%     { box-shadow:4px 4px 0 #2B1260, 0 0 12px rgba(107,79,187,0.4); }
}
@keyframes slide-up-fade {
  from { opacity:0; transform:translateY(20px); }
  to   { opacity:1; transform:translateY(0); }
}
@keyframes shimmer {
  0%   { text-shadow: 0 0 4px rgba(255,215,0,0.3); }
  50%  { text-shadow: 0 0 12px rgba(255,215,0,0.7), 0 0 24px rgba(255,215,0,0.3); }
  100% { text-shadow: 0 0 4px rgba(255,215,0,0.3); }
}
@keyframes step-pulse {
  0%,100% { transform:scale(1); box-shadow:0 0 0 rgba(107,79,187,0); }
  50%     { transform:scale(1.08); box-shadow:0 0 20px rgba(107,79,187,0.5); }
}
`;

/* ─────────────────── Network canvas background ──────────────────── */

function NetworkCanvas() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animId = 0;
    // Jewel-tone particle palette
    const PARTICLE_COLORS = [
      'rgba(107,79,187,0.5)',   // purple
      'rgba(45,212,191,0.45)',  // teal
      'rgba(251,191,36,0.4)',   // amber
      'rgba(251,113,133,0.4)',  // rose
      'rgba(52,211,153,0.4)',   // emerald
      'rgba(56,189,248,0.35)',  // sky
    ];
    const LINE_COLORS = [
      [107,79,187],   // purple
      [45,212,191],   // teal
      [251,191,36],   // amber
      [52,211,153],   // emerald
    ];
    const nodes: { x: number; y: number; vx: number; vy: number; r: number; color: string; lineColor: number[] }[] = [];
    const NODE_COUNT = 40;
    const CONNECT_DIST = 140;

    function resize() {
      canvas!.width = canvas!.offsetWidth * devicePixelRatio;
      canvas!.height = canvas!.offsetHeight * devicePixelRatio;
      ctx!.setTransform(1, 0, 0, 1, 0, 0);
      ctx!.scale(devicePixelRatio, devicePixelRatio);
    }

    function initNodes() {
      nodes.length = 0;
      const w = canvas!.offsetWidth;
      const h = canvas!.offsetHeight;
      for (let i = 0; i < NODE_COUNT; i++) {
        const colorIdx = Math.floor(Math.random() * PARTICLE_COLORS.length);
        nodes.push({
          x: Math.random() * w,
          y: Math.random() * h,
          vx: (Math.random() - 0.5) * 0.4,
          vy: (Math.random() - 0.5) * 0.4,
          r: Math.random() * 2 + 1.5,
          color: PARTICLE_COLORS[colorIdx],
          lineColor: LINE_COLORS[colorIdx % LINE_COLORS.length],
        });
      }
    }

    function draw() {
      const w = canvas!.offsetWidth;
      const h = canvas!.offsetHeight;
      ctx!.clearRect(0, 0, w, h);

      // Update positions
      for (const n of nodes) {
        n.x += n.vx;
        n.y += n.vy;
        if (n.x < 0 || n.x > w) n.vx *= -1;
        if (n.y < 0 || n.y > h) n.vy *= -1;
      }

      // Draw connections
      ctx!.lineWidth = 1;
      for (let i = 0; i < nodes.length; i++) {
        for (let j = i + 1; j < nodes.length; j++) {
          const dx = nodes[i].x - nodes[j].x;
          const dy = nodes[i].y - nodes[j].y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist < CONNECT_DIST) {
            const alpha = 0.12 * (1 - dist / CONNECT_DIST);
            const c = nodes[i].lineColor;
            ctx!.strokeStyle = `rgba(${c[0]},${c[1]},${c[2]},${alpha})`;
            ctx!.beginPath();
            ctx!.moveTo(nodes[i].x, nodes[i].y);
            ctx!.lineTo(nodes[j].x, nodes[j].y);
            ctx!.stroke();
          }
        }
      }

      // Draw nodes
      for (const n of nodes) {
        ctx!.fillStyle = n.color;
        ctx!.beginPath();
        ctx!.arc(n.x, n.y, n.r, 0, Math.PI * 2);
        ctx!.fill();
      }

      animId = requestAnimationFrame(draw);
    }

    resize();
    initNodes();
    draw();

    const handleResize = () => {
      resize();
      initNodes();
    };
    window.addEventListener('resize', handleResize);
    return () => {
      cancelAnimationFrame(animId);
      window.removeEventListener('resize', handleResize);
    };
  }, []);

  return (
    <Box
      ref={canvasRef}
      as="canvas"
      position="absolute"
      inset="0"
      w="100%"
      h="100%"
      pointerEvents="none"
      zIndex={0}
      aria-hidden="true"
      role="presentation"
    />
  );
}

/* ─────────────────── Typewriter hook ──────────────────── */

function useTypewriter(text: string, speed = 60) {
  const [displayed, setDisplayed] = useState('');
  const [done, setDone] = useState(false);

  useEffect(() => {
    setDisplayed('');
    setDone(false);
    let i = 0;
    const id = setInterval(() => {
      i++;
      setDisplayed(text.slice(0, i));
      if (i >= text.length) {
        clearInterval(id);
        setDone(true);
      }
    }, speed);
    return () => clearInterval(id);
  }, [text, speed]);

  return { displayed, done };
}

/* ─────────────────── Count-up (immediate) ──────────────────── */

function CountUp({ target, suffix = '', color }: { target: number; suffix?: string; color?: string }) {
  return (
    <Text
      as="span"
      {...pixelFontProps}
      fontSize={{ base: '24px', md: '36px' }}
      color={color ?? 'game.gold'}
    >
      {target < 0 ? '∞' : target}
      {suffix}
    </Text>
  );
}

/* ═══════════════════════ MAIN COMPONENT ═══════════════════════ */

export default function HomePage() {
  useEffect(() => { document.title = 'Aspire Learn'; }, []);
  const navigate = useNavigate();
  const { colorMode, toggleColorMode } = useColorMode();
  const user = useAuthStore((s) => s.user);
  const token = useAuthStore((s) => s.token);
  const isLoggedIn = !!token;

  const { data: worlds } = useQuery<World[]>({
    queryKey: ['worlds'],
    queryFn: () => api.get('/worlds').then((r) => r.data),
    staleTime: 5 * 60_000,
  });

  const { data: personas } = useQuery<PersonaSummary[]>({
    queryKey: ['personas'],
    queryFn: () => api.get('/personas').then((r) => r.data),
    staleTime: 5 * 60_000,
  });

  const stats = buildStats(worlds);

  const tagline = useTypewriter('Master Aspire through play', 55);

  const scrollTo = useCallback((id: string) => {
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' });
  }, []);

  return (
    <>
      <style>{KEYFRAMES}</style>

      <Box
        data-testid="home-page"
        bg="dark.bg"
        color="dark.text"
        minH="100vh"
        overflowX="hidden"
        position="relative"
      >
        {/* ─── Sticky nav bar ─── */}
        <Flex
          data-testid="home-navbar"
          as="nav"
          position="sticky"
          top="0"
          zIndex={50}
          align="center"
          h="56px"
          px="5"
          bg="dark.sidebar"
          backdropFilter="blur(10px)"
          borderBottom="2px solid"
          borderColor="game.pixelBorder"
        >
          <Text
            {...pixelFontProps}
            fontSize={{ base: '10px', md: '14px' }}
            color="aspire.600"
            cursor="pointer"
            role="button"
            tabIndex={0}
            onClick={() => scrollTo('hero')}
            onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); scrollTo('hero'); } }}
          >
            Aspire Learn
          </Text>

          <Box flexGrow={1} />

          <Flex gap="3" align="center">
            <Text
              as="button"
              display={{ base: 'none', md: 'block' }}
              fontSize="sm"
              color="dark.text"
              cursor="pointer"
              bg="transparent"
              border="none"
              _hover={{ color: 'game.gold' }}
              onClick={() => scrollTo('worlds')}
            >
              Worlds
            </Text>
            <Text
              as="button"
              display={{ base: 'none', md: 'block' }}
              fontSize="sm"
              color="dark.text"
              cursor="pointer"
              bg="transparent"
              border="none"
              _hover={{ color: 'game.gold' }}
              onClick={() => scrollTo('how-it-works')}
            >
              How It Works
            </Text>
            <Box display={{ base: 'none', md: 'block' }}>
              <a
                href="https://aspire.dev/docs/"
                target="_blank"
                rel="noopener noreferrer"
              >
                <Text fontSize="sm" color="dark.text" cursor="pointer" _hover={{ color: 'game.gold' }}>
                  Docs
                </Text>
              </a>
            </Box>
            <Box display={{ base: 'none', md: 'block' }}>
              <a
                href="https://github.com/microsoft/aspire"
                target="_blank"
                rel="noopener noreferrer"
              >
                <Flex align="center" gap="1.5" cursor="pointer" _hover={{ color: 'game.gold' }}>
                  <FiGithub size={14} color="currentColor" />
                  <Text fontSize="sm" color="dark.text">
                    GitHub
                  </Text>
                </Flex>
              </a>
            </Box>

            {/* Theme toggle */}
            <IconButton
              aria-label="Toggle color mode"
              title={colorMode === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
              variant="ghost"
              size="sm"
              color="dark.text"
              _hover={{ bg: 'content.hover' }}
              onClick={toggleColorMode}
            >
              {colorMode === 'dark' ? <FiSun /> : <FiMoon />}
            </IconButton>

            {isLoggedIn ? (
              <Button
                size="sm"
                bg="aspire.600"
                color="white"
                {...pixelFontProps}
                fontSize="10px"
                _hover={{ bg: 'aspire.700' }}
                onClick={() => navigate('/dashboard')}
              >
                Dashboard
              </Button>
            ) : (
              <Button
                size="sm"
                bg="game.xpGold"
                color="dark.bg"
                {...pixelFontProps}
                fontSize="10px"
                _hover={{ bg: '#FFC107' }}
                onClick={() => navigate('/login')}
              >
                Sign In
              </Button>
            )}
          </Flex>
        </Flex>

        {/* ═══════════════════ HERO ═══════════════════ */}
        <Box id="hero" position="relative" minH={{ base: 'auto', md: '440px' }} overflow="hidden">
          <NetworkCanvas />
          <Box position="absolute" inset="0" background="linear-gradient(135deg, rgba(107,79,187,0.12), rgba(45,212,191,0.08), rgba(251,191,36,0.04))" pointerEvents="none" zIndex={0} aria-hidden="true" />

          {/* Split hero: left content + right side panel */}
          <Flex position="relative" zIndex={1} direction={{ base: 'column', md: 'row' }} minH={{ base: 'auto', md: '440px' }}>
            {/* Left: main hero content */}
            <Flex flex="1" direction="column" justify="center" px={{ base: '6', md: '14' }} py={{ base: '12', md: '14' }} gap="4">
              {isLoggedIn && user && (
                <Box data-testid="welcome-back" px="4" py="2" borderRadius="md" bg="dark.card" border="1px solid" borderColor="game.pixelBorder" display="inline-block" alignSelf="flex-start">
                  <Text {...pixelFontProps} fontSize="10px" color="game.gold">
                    Welcome back, {user.displayName || user.username}!
                  </Text>
                  <Text fontSize="xs" color="dark.muted" mt="1">Continue your journey where you left off</Text>
                </Box>
              )}

              <Heading data-testid="hero-title" as="h1" {...pixelFontProps} fontSize={{ base: '28px', sm: '36px', md: '44px', lg: '48px' }} color="aspire.600" lineHeight="1.3" style={{ animation: 'rainbow-glow 4s ease-in-out infinite' }}>
                ASPIRE<br />LEARN
              </Heading>

              <Box h="24px" data-testid="hero-tagline">
                <Text fontSize={{ base: 'md', md: 'lg' }} color="dark.text" letterSpacing="wide">
                  {tagline.displayed}
                  <Text as="span" style={{ animation: tagline.done ? 'typewriter-cursor 1s step-end infinite' : 'none', opacity: tagline.done ? undefined : 1 }} ml="1px">|</Text>
                </Text>
              </Box>

              <Text maxW="440px" fontSize={{ base: 'sm', md: 'md' }} color="dark.muted" lineHeight="1.7">
                Distributed apps are hard — tangled configs, scattered logs, painful deploys. Aspire fixes that. Learn the platform by building real apps.
              </Text>

              <Flex data-testid="hero-ctas" direction={{ base: 'column', sm: 'row' }} gap="3" mt="2">
                <Button data-testid="cta-start-journey" size="lg" bg="aspire.600" color="white" {...pixelFontProps} fontSize={{ base: '10px', md: '12px' }} px="7" py="5" {...retroCardProps} borderColor="aspire.600" boxShadow="0 0 20px rgba(139,92,246,0.3), 4px 4px 0 #4C1D95" _hover={{ transform: 'translateY(-2px)', boxShadow: '0 0 30px rgba(139,92,246,0.4), 4px 6px 0 #4C1D95' }} transition="all 0.2s" onClick={() => navigate(isLoggedIn ? '/dashboard' : '/register')}>
                  {isLoggedIn ? 'Continue Journey' : 'Start Your Journey'}
                </Button>
                <Button data-testid="cta-browse-curriculum" size="lg" bg="transparent" color="accent.teal" {...pixelFontProps} fontSize={{ base: '10px', md: '12px' }} px="7" py="5" border="3px solid" borderColor="accent.teal" boxShadow="4px 4px 0 rgba(45,212,191,0.2)" borderRadius="sm" _hover={{ bg: 'rgba(45,212,191,0.1)', transform: 'translateY(-2px)' }} transition="all 0.2s" onClick={() => navigate('/dashboard')}>
                  Browse Curriculum
                </Button>
              </Flex>
            </Flex>

            {/* Right: side panel with mini-cards */}
            <Flex direction="column" w={{ base: '100%', md: '380px' }} gap="2.5" px={{ base: '6', md: '7' }} py={{ base: '6', md: '10' }} borderLeft={{ base: 'none', md: '1px solid' }} borderTop={{ base: '1px solid', md: 'none' }} borderColor="dark.border" justify="center">
              {[
                { icon: '🎮', label: 'Playground', sub: 'Build app models visually', to: '/playground', accentBg: 'rgba(45,212,191,0.1)', accentBorder: 'rgba(45,212,191,0.3)', testId: 'hero-link-playground' },
                { icon: '🖼️', label: 'Gallery', sub: '12 architecture examples', to: '/gallery', accentBg: 'rgba(251,191,36,0.1)', accentBorder: 'rgba(251,191,36,0.3)', testId: 'hero-link-gallery' },
                { icon: '🗺️', label: 'Concept Map', sub: 'Explore Aspire concepts', to: '/concept-map', accentBg: 'rgba(52,211,153,0.1)', accentBorder: 'rgba(52,211,153,0.3)', testId: 'hero-link-conceptmap' },
                { icon: '📚', label: 'Curriculum', sub: `${worlds?.length ?? 13} worlds, ${worlds?.reduce((s, w) => s + w.totalLessons, 0) ?? 174} lessons`, to: '/dashboard', accentBg: 'rgba(56,189,248,0.1)', accentBorder: 'rgba(56,189,248,0.3)', testId: 'hero-link-curriculum' },
                { icon: '📰', label: "What's New", sub: 'Latest updates & features', to: '/whats-new', accentBg: 'rgba(251,146,60,0.1)', accentBorder: 'rgba(251,146,60,0.3)', testId: 'hero-link-whatsnew' },
                { icon: '🎓', label: 'Learning Tracks', sub: 'Find your personalized path', to: '/personas', accentBg: 'rgba(52,211,153,0.1)', accentBorder: 'rgba(52,211,153,0.3)', testId: 'hero-link-tracks' },
              ].map((card) => (
                <Flex
                  key={card.label}
                  data-testid={card.testId}
                  align="center"
                  gap="3"
                  px="4"
                  py="3"
                  borderRadius="lg"
                  bg="dark.card"
                  border="1px solid"
                  borderColor="dark.border"
                  cursor="pointer"
                  transition="all 0.2s"
                  role="link"
                  tabIndex={0}
                  _hover={{ borderColor: card.accentBorder, transform: 'translateX(4px)', boxShadow: `0 0 12px ${card.accentBg}` }}
                  onClick={() => navigate(card.to)}
                  onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); navigate(card.to); } }}
                >
                  <Flex align="center" justify="center" w="36px" h="36px" borderRadius="lg" bg={card.accentBg} border="1px solid" borderColor={card.accentBorder} flexShrink={0}>
                    <Text fontSize="16px">{card.icon}</Text>
                  </Flex>
                  <Box>
                    <Text fontSize="12px" color="dark.text" fontWeight="bold">{card.label}</Text>
                    <Text fontSize="10px" color="dark.muted" mt="0.5">{card.sub}</Text>
                  </Box>
                </Flex>
              ))}
            </Flex>
          </Flex>
        </Box>

        {/* ═══════════════════ WHY ASPIRE ═══════════════════ */}
        <Box id="why-aspire" py={{ base: '10', md: '14' }} px="4">
            <Heading
              as="h2"
              fontSize={{ base: 'xl', md: '2xl' }}
              textAlign="center"
              color="aspire.accent"
              mb="3"
            >
              Why Aspire?
            </Heading>
            <Text textAlign="center" color="dark.muted" mb="6" maxW="700px" mx="auto" lineHeight="1.7">
              Every team that splits into services inherits the same problems: wiring connection strings,
              coordinating startup, reading four log files to debug one request, maintaining separate configs
              per environment.
            </Text>
            <SimpleGrid columns={{ base: 1, sm: 2, lg: 4 }} gap="4" maxW="1100px" mx="auto">
              {[
                {
                  icon: '🏗️',
                  title: 'Declare your app, not your infrastructure',
                  desc: 'Define services, databases, and their relationships in code. One readable file replaces Docker Compose, env scripts, and tribal knowledge.',
                  linkLabel: 'Try it → Playground',
                  linkTo: '/playground',
                  accent: '#2DD4BF',
                  accentBg: 'rgba(45,212,191,0.12)',
                },
                {
                  icon: '▶️',
                  title: 'Start everything with one command',
                  desc: '\u003Ccode\u003Easpire run\u003C/code\u003E starts containers, waits for health checks, injects connection strings, and opens a dashboard. New developer? Clone, run, done.',
                  linkLabel: 'See how → Gallery',
                  linkTo: '/gallery',
                  accent: '#FBBF24',
                  accentBg: 'rgba(251,191,36,0.12)',
                },
                {
                  icon: '📡',
                  title: 'Manage and observe from a live dashboard',
                  desc: 'Real-time logs, distributed traces, health checks, and custom commands — seed data, flush caches, run migrations — all from one dashboard.',
                  linkLabel: 'Learn more → Dashboard Lesson',
                  linkTo: '/lessons/1.1.2',
                  accent: '#FB7185',
                  accentBg: 'rgba(251,113,133,0.12)',
                },
                {
                  icon: '🚀',
                  title: 'Ship the same app to any cloud',
                  desc: 'Your dev topology compiles to Docker Compose, Kubernetes Helm charts, or Azure Bicep. No rewrites. Pick your target when you\'re ready.',
                  linkLabel: 'Explore → Concept Map',
                  linkTo: '/concept-map',
                  accent: '#34D399',
                  accentBg: 'rgba(52,211,153,0.12)',
                },
              ].map((card) => (
                <Flex
                  key={card.title}
                  direction="column"
                  borderRadius="md"
                  bg="dark.card"
                  p="4"
                  cursor="pointer"
                  role="link"
                  tabIndex={0}
                  border="1px solid"
                  borderColor="dark.border"
                  css={{ borderTopWidth: '3px', borderTopColor: card.accent }}
                  _hover={{
                    transform: 'translateY(-4px)',
                    borderColor: card.accent,
                    boxShadow: `0 8px 32px ${card.accentBg}`,
                  }}
                  transition="all 0.3s ease"
                  onClick={() => navigate(card.linkTo)}
                  onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); navigate(card.linkTo); } }}
                >
                  <Text fontSize="2xl" mb="2">{card.icon}</Text>
                  <Text fontWeight="bold" fontSize="sm" color="dark.text" mb="2">{card.title}</Text>
                  <Text fontSize="11px" color="dark.muted" lineHeight="1.6" flex="1"
                    dangerouslySetInnerHTML={{ __html: card.desc }}
                  />
                  <Text
                    fontSize="10px"
                    color={card.accent}
                    cursor="pointer"
                    mt="3"
                    _hover={{ textDecoration: 'underline' }}
                    onClick={(e) => { e.stopPropagation(); navigate(card.linkTo); }}
                  >
                    {card.linkLabel}
                  </Text>
                </Flex>
              ))}
            </SimpleGrid>
        </Box>

        {/* ═══════════════════ STATS ═══════════════════ */}
        <Box
          id="stats"
          py="7"
          px="4"
          background="linear-gradient(90deg, rgba(45,212,191,0.06), rgba(139,92,246,0.08), rgba(251,191,36,0.06))"
          borderTop="1px solid"
          borderBottom="1px solid"
          borderColor="dark.border"
        >
            <Flex
              data-testid="stats-section"
              justify="center"
              gap={{ base: '8', md: '16' }}
              flexWrap="wrap"
            >
              {stats.map((s, i) => {
                const statColors = ['#38BDF8', '#34D399', '#FBBF24', '#FB7185'];
                return (
                <Box key={s.label} textAlign="center">
                  <CountUp target={s.num} color={statColors[i]} />
                  <Text
                    {...pixelFontProps}
                    fontSize={{ base: '8px', md: '10px' }}
                    color="dark.muted"
                    textTransform="uppercase"
                    mt="1"
                  >
                    {s.label}
                  </Text>
                </Box>
                );
              })}
            </Flex>
        </Box>

        {/* ═══════════════════ LEARNING TRACKS ═══════════════════ */}
        {(personas ?? []).length > 0 && (
          <Box py={{ base: '10', md: '14' }} px="4">
              <Heading
                as="h2"
                {...pixelFontProps}
                fontSize={{ base: '16px', md: '22px' }}
                textAlign="center"
                color="aspire.accent"
                mb="3"
              >
                Built for Your Role
              </Heading>
              <Text textAlign="center" color="dark.muted" mb="10" maxW="600px" mx="auto">
                Whether you're a DevOps engineer, a C# developer, a JS/TS developer, or leading a polyglot team —
                we've got a personalized path for you
              </Text>

            <SimpleGrid
              columns={{ base: 1, sm: 2, md: 4 }}
              gap="5"
              maxW="1000px"
              mx="auto"
            >
              {(personas ?? []).map(p => (
                  <Card.Root
                    {...retroCardProps}
                    bg="dark.card"
                    p="5"
                    textAlign="center"
                    cursor="pointer"
                    transition="all 0.25s"
                    role="link"
                    tabIndex={0}
                    borderTop="3px solid"
                    borderTopColor={p.color}
                    _hover={{
                      transform: 'scale(1.05) translateY(-4px)',
                      borderColor: p.color,
                    }}
                    onClick={() => navigate(`/personas/${p.id}`)}
                    onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); navigate(`/personas/${p.id}`); } }}
                  >
                    <Flex
                      align="center"
                      justify="center"
                      w="52px"
                      h="52px"
                      mx="auto"
                      mb="2"
                      borderRadius="lg"
                      bg={`${p.color}20`}
                    >
                      <Text fontSize="28px">{p.icon}</Text>
                    </Flex>
                    <Text
                      {...pixelFontProps}
                      fontSize={{ base: '9px', md: '10px' }}
                      color="aspire.300"
                      mb="2"
                    >
                      {p.name}
                    </Text>
                    <Text fontSize="xs" color="dark.muted" lineHeight="1.5" mb="3">
                      {p.description.length > 80 ? p.description.slice(0, 80) + '…' : p.description}
                    </Text>
                    <Flex wrap="wrap" justify="center" gap="1">
                      {p.focusAreas.slice(0, 2).map((area) => (
                        <Badge
                          key={area}
                          fontSize="2xs"
                          colorPalette="purple"
                          variant="subtle"
                        >
                          {area}
                        </Badge>
                      ))}
                    </Flex>
                  </Card.Root>
              ))}
            </SimpleGrid>

              <Flex justify="center" mt="8">
                <Button
                  size="sm"
                  variant="outline"
                  borderColor="aspire.600"
                  color="aspire.accent"
                  {...pixelFontProps}
                  fontSize="10px"
                  _hover={{ bg: 'rgba(107,79,187,0.15)' }}
                  onClick={() => navigate('/personas')}
                >
                  Explore All Tracks →
                </Button>
              </Flex>
          </Box>
        )}

        {/* ═══════════════════ WORLDS ═══════════════════ */}
        <Box id="worlds" py={{ base: '10', md: '14' }} px="4">
            <Heading
              data-testid="worlds-heading"
              as="h2"
              {...pixelFontProps}
              fontSize={{ base: '16px', md: '22px' }}
              textAlign="center"
              color="aspire.accent"
              mb="3"
            >
              🗺️ Choose Your World
            </Heading>
            <Text textAlign="center" color="dark.muted" mb="10" maxW="600px" mx="auto">
              {worlds ? `${worlds.length} themed worlds` : 'Themed worlds'} take you from cloud fundamentals to production-ready distributed apps
            </Text>

          <Flex
            data-testid="worlds-grid"
            gap="3"
            overflowX="auto"
            pb="2"
            maxW="1000px"
            mx="auto"
          >
            {(worlds ?? []).map((w, i) => {
              const worldAccents = ['#2DD4BF', '#FBBF24', '#FB7185', '#34D399', '#38BDF8', '#FB923C', '#A78BFA', '#F472B6'];
              const accent = worldAccents[i % worldAccents.length];
              return (
                <Card.Root
                  key={w.id}
                  bg="dark.card"
                  border="1px solid"
                  borderColor={accent}
                  borderRadius="lg"
                  p="3"
                  minW="155px"
                  maxW="155px"
                  flexShrink={0}
                  textAlign="center"
                  cursor="pointer"
                  transition="all 0.25s"
                  role="link"
                  tabIndex={0}
                  _hover={{
                    transform: 'scale(1.05) translateY(-4px)',
                    boxShadow: `0 0 20px ${accent}33`,
                  }}
                  onClick={() => navigate(`/worlds/${w.id}`)}
                  onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); navigate(`/worlds/${w.id}`); } }}
                >
                  <Text fontSize="28px" mb="1">{w.icon}</Text>
                  <Text
                    {...pixelFontProps}
                    fontSize="8px"
                    color={accent}
                    mb="1"
                    noOfLines={1}
                  >
                    {w.name}
                  </Text>
                  <Text fontSize="9px" color="dark.muted" lineHeight="1.4" noOfLines={1}>
                    {w.description}
                  </Text>
                </Card.Root>
              );
            })}
          </Flex>
        </Box>

        {/* ═══════════════════ HOW IT WORKS ═══════════════════ */}
        <Box id="how-it-works" py={{ base: '10', md: '14' }} px="4" bg="dark.surface">
            <Heading
              data-testid="how-it-works-heading"
              as="h2"
              {...pixelFontProps}
              fontSize={{ base: '16px', md: '22px' }}
              textAlign="center"
              color="aspire.accent"
              mb="12"
            >
              How It Works
            </Heading>

          <Flex
            direction={{ base: 'column', md: 'row' }}
            align="center"
            justify="center"
            maxW="900px"
            mx="auto"
            gap={{ base: '4', md: '0' }}
          >
              {HOW_IT_WORKS.map((item, i) => {
                const stepColors = ['#2DD4BF', '#FBBF24', '#FB7185'];
                const stepBgs = ['rgba(45,212,191,0.15)', 'rgba(251,191,36,0.15)', 'rgba(251,113,133,0.15)'];
                return (
                <Box key={item.step} display="contents">
                  <Flex direction="column" align="center" textAlign="center" flex="1" px="4">
                    <Flex
                      align="center"
                      justify="center"
                      w="48px"
                      h="48px"
                      bg={stepBgs[i]}
                      borderRadius="full"
                      border="2px solid"
                      borderColor={stepColors[i]}
                      mb="3"
                    >
                      <Text {...pixelFontProps} fontSize="18px" color={stepColors[i]}>{item.step}</Text>
                    </Flex>
                    <Text {...pixelFontProps} fontSize="14px" color={stepColors[i]} mb="2">
                      {item.title}
                    </Text>
                    <Text fontSize="sm" color="dark.muted" maxW="200px">
                      {item.desc}
                    </Text>
                  </Flex>
                  {i < HOW_IT_WORKS.length - 1 && (
                    <Text
                      display={{ base: 'none', md: 'block' }}
                      {...pixelFontProps}
                      fontSize="22px"
                      color="dark.border"
                      mx="2"
                      mt="-40px"
                    >
                      →
                    </Text>
                  )}
                  {i < HOW_IT_WORKS.length - 1 && (
                    <Text
                      display={{ base: 'block', md: 'none' }}
                      {...pixelFontProps}
                      fontSize="18px"
                      color="dark.border"
                      textAlign="center"
                    >
                      ▼
                    </Text>
                  )}
                </Box>
                );
              })}
          </Flex>
        </Box>

        {/* ═══════════════════ FOOTER CTA ═══════════════════ */}
        <Box
          data-testid="footer-cta"
          py={{ base: '10', md: '14' }}
          px="4"
          background="linear-gradient(135deg, rgba(139,92,246,0.05), rgba(45,212,191,0.03))"
          textAlign="center"
        >
            <Text {...pixelFontProps} fontSize={{ base: '14px', md: '20px' }} color="aspire.accent" mb="4">
              Ready to make your services work as one?
            </Text>
            <Text color="dark.muted" mb="8" maxW="500px" mx="auto">
              From your first aspire run to deploying to production — learn the platform that makes
              distributed apps simple.
            </Text>
            <Button
              data-testid="footer-cta-button"
              size="lg"
              bg="linear-gradient(135deg, #8B5CF6, #2DD4BF)"
              color="white"
              {...pixelFontProps}
              fontSize={{ base: '11px', md: '13px' }}
              px="10"
              py="6"
              border="none"
              borderRadius="md"
              boxShadow="0 0 25px rgba(139,92,246,0.2), 0 0 25px rgba(45,212,191,0.1)"
              _hover={{
                transform: 'translateY(-2px)',
                boxShadow: '0 0 35px rgba(139,92,246,0.3), 0 0 35px rgba(45,212,191,0.15)',
              }}
              transition="all 0.2s"
              onClick={() => navigate(isLoggedIn ? '/dashboard' : '/register')}
            >
              {isLoggedIn ? 'Continue Journey' : 'Start Your Journey'}
            </Button>
        </Box>

        {/* ─── Footer ─── */}
        <Flex
          as="footer"
          direction="column"
          align="center"
          gap="2"
          py="8"
          px="4"
          borderTop="2px solid"
          borderColor="game.pixelBorder"
        >
          <Text {...pixelFontProps} fontSize="10px" color="aspire.600">
            Aspire Learn
          </Text>
          <Text fontSize="xs" color="dark.muted">
            Learn Aspire · Build real apps · Level up your stack
          </Text>
          <Flex gap="4" mt="2">
            <a
              href="https://aspire.dev/docs/"
              target="_blank"
              rel="noopener noreferrer"
            >
              <Text fontSize="xs" color="dark.muted" _hover={{ color: 'aspire.accent' }}>
                Aspire Docs
              </Text>
            </a>
            <a
              href="https://github.com/microsoft/aspire"
              target="_blank"
              rel="noopener noreferrer"
            >
              <Flex align="center" gap="1.5" _hover={{ color: 'aspire.accent' }}>
                <FiGithub size={14} />
                <Text fontSize="xs" color="dark.muted">
                  GitHub
                </Text>
              </Flex>
            </a>
          </Flex>
        </Flex>
      </Box>
    </>
  );
}
