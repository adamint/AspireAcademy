import { useEffect, useRef, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Box, Flex, Text, Heading, Button, SimpleGrid, Card, Badge } from '@chakra-ui/react';
import { useAuthStore } from '../store/authStore';
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
@keyframes glow-pulse {
  0%, 100% { text-shadow: 0 0 10px rgba(107,79,187,0.6), 0 0 30px rgba(107,79,187,0.3); }
  50%      { text-shadow: 0 0 20px rgba(107,79,187,0.9), 0 0 60px rgba(107,79,187,0.5), 0 0 80px rgba(107,79,187,0.2); }
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
    const nodes: { x: number; y: number; vx: number; vy: number; r: number }[] = [];
    const NODE_COUNT = 40;
    const CONNECT_DIST = 140;

    function resize() {
      canvas!.width = canvas!.offsetWidth * devicePixelRatio;
      canvas!.height = canvas!.offsetHeight * devicePixelRatio;
      ctx!.scale(devicePixelRatio, devicePixelRatio);
    }

    function initNodes() {
      nodes.length = 0;
      const w = canvas!.offsetWidth;
      const h = canvas!.offsetHeight;
      for (let i = 0; i < NODE_COUNT; i++) {
        nodes.push({
          x: Math.random() * w,
          y: Math.random() * h,
          vx: (Math.random() - 0.5) * 0.4,
          vy: (Math.random() - 0.5) * 0.4,
          r: Math.random() * 2 + 1.5,
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
      ctx!.strokeStyle = 'rgba(107,79,187,0.15)';
      ctx!.lineWidth = 1;
      for (let i = 0; i < nodes.length; i++) {
        for (let j = i + 1; j < nodes.length; j++) {
          const dx = nodes[i].x - nodes[j].x;
          const dy = nodes[i].y - nodes[j].y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist < CONNECT_DIST) {
            const alpha = 0.15 * (1 - dist / CONNECT_DIST);
            ctx!.strokeStyle = `rgba(107,79,187,${alpha})`;
            ctx!.beginPath();
            ctx!.moveTo(nodes[i].x, nodes[i].y);
            ctx!.lineTo(nodes[j].x, nodes[j].y);
            ctx!.stroke();
          }
        }
      }

      // Draw nodes
      for (const n of nodes) {
        ctx!.fillStyle = 'rgba(107,79,187,0.5)';
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

function CountUp({ target, suffix = '' }: { target: number; suffix?: string }) {
  return (
    <Text
      as="span"
      {...pixelFontProps}
      fontSize={{ base: '24px', md: '36px' }}
      color="game.xpGold"
    >
      {target < 0 ? '∞' : target}
      {suffix}
    </Text>
  );
}

/* ═══════════════════════ MAIN COMPONENT ═══════════════════════ */

export default function HomePage() {
  const navigate = useNavigate();
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
        bg="#0D0B1A"
        color="#E8E0F0"
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
          bg="rgba(10,8,24,0.92)"
          backdropFilter="blur(10px)"
          borderBottom="2px solid #2B1260"
        >
          <Text
            {...pixelFontProps}
            fontSize={{ base: '10px', md: '14px' }}
            color="aspire.600"
            cursor="pointer"
            onClick={() => scrollTo('hero')}
          >
            Aspire Learn
          </Text>

          <Box flexGrow={1} />

          <Flex gap="3" align="center">
            <Text
              as="button"
              display={{ base: 'none', md: 'block' }}
              fontSize="sm"
              color="whiteAlpha.800"
              cursor="pointer"
              bg="transparent"
              border="none"
              _hover={{ color: 'game.xpGold' }}
              onClick={() => scrollTo('worlds')}
            >
              Worlds
            </Text>
            <Text
              as="button"
              display={{ base: 'none', md: 'block' }}
              fontSize="sm"
              color="whiteAlpha.800"
              cursor="pointer"
              bg="transparent"
              border="none"
              _hover={{ color: 'game.xpGold' }}
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
                <Text fontSize="sm" color="whiteAlpha.800" cursor="pointer" _hover={{ color: 'game.xpGold' }}>
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
                <Text fontSize="sm" color="whiteAlpha.800" cursor="pointer" _hover={{ color: 'game.xpGold' }}>
                  GitHub
                </Text>
              </a>
            </Box>

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
                color="#0D0B1A"
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
        <Box id="hero" position="relative" minH={{ base: '70vh', md: '75vh' }} overflow="hidden">
          <NetworkCanvas />

          <Flex
            position="relative"
            zIndex={1}
            direction="column"
            align="center"
            justify="center"
            textAlign="center"
            minH={{ base: '70vh', md: '75vh' }}
            pt={{ base: '8', md: '12' }}
            px="4"
            gap="6"
          >
            {/* Welcome back banner */}
            {isLoggedIn && user && (
              <Box
                data-testid="welcome-back"
                {...retroCardProps}
                bg="rgba(26,11,46,0.85)"
                px="6"
                py="3"
                mb="6"
              >
                <Text {...pixelFontProps} fontSize={{ base: '10px', md: '12px' }} color="game.xpGold">
                  Welcome back, {user.displayName || user.username}!
                </Text>
                <Text fontSize="sm" color="whiteAlpha.700" mt="1">
                  Continue your journey where you left off
                </Text>
              </Box>
            )}

            {/* Main title */}
            <Heading
              data-testid="hero-title"
              as="h1"
              {...pixelFontProps}
              fontSize={{ base: '28px', sm: '36px', md: '56px', lg: '64px' }}
              color="aspire.600"
              lineHeight="1.3"
              style={{ animation: 'glow-pulse 3s ease-in-out infinite' }}
            >
              ASPIRE
              <br />
              LEARN
            </Heading>

            {/* Tagline with typewriter */}
            <Box h="28px" data-testid="hero-tagline">
              <Text
                fontSize={{ base: 'md', md: 'xl' }}
                color="whiteAlpha.800"
                letterSpacing="wide"
              >
                {tagline.displayed}
                <Text
                  as="span"
                  style={{
                    animation: tagline.done ? 'typewriter-cursor 1s step-end infinite' : 'none',
                    opacity: tagline.done ? undefined : 1,
                  }}
                  ml="1px"
                >
                  |
                </Text>
              </Text>
            </Box>

            {/* Value proposition subtitle */}
            <Text
              maxW="520px"
              fontSize={{ base: 'sm', md: 'md' }}
              color="whiteAlpha.600"
              lineHeight="1.7"
              mt="2"
            >
              Distributed apps are hard — tangled configs, scattered logs, painful deploys.
              Aspire fixes that. Learn the platform by building real apps.
            </Text>

            {/* CTA buttons */}
            <Flex
              data-testid="hero-ctas"
              direction={{ base: 'column', sm: 'row' }}
              gap="4"
              mt="4"
            >
              <Button
                data-testid="cta-start-journey"
                size="lg"
                bg="game.xpGold"
                color="#0D0B1A"
                {...pixelFontProps}
                fontSize={{ base: '11px', md: '13px' }}
                px="8"
                py="6"
                {...retroCardProps}
                borderColor="game.xpGold"
                boxShadow="4px 4px 0 rgba(255,215,0,0.4)"
                _hover={{
                  transform: 'translateY(-2px)',
                  boxShadow: '4px 6px 0 rgba(255,215,0,0.5)',
                }}
                transition="all 0.2s"
                onClick={() => navigate(isLoggedIn ? '/dashboard' : '/register')}
              >
                {isLoggedIn ? 'Continue Journey' : 'Start Your Journey'}
              </Button>

              <Button
                data-testid="cta-browse-curriculum"
                size="lg"
                bg="transparent"
                color="aspire.400"
                {...pixelFontProps}
                fontSize={{ base: '11px', md: '13px' }}
                px="8"
                py="6"
                border="3px solid"
                borderColor="aspire.600"
                boxShadow="4px 4px 0 #2B1260"
                borderRadius="sm"
                _hover={{
                  bg: 'rgba(107,79,187,0.15)',
                  transform: 'translateY(-2px)',
                }}
                transition="all 0.2s"
                onClick={() => navigate('/dashboard')}
              >
                Browse Curriculum
              </Button>
            </Flex>

            {/* Scroll hint */}
            <Text
              mt="10"
              fontSize="xs"
              color="whiteAlpha.500"
              style={{ animation: 'float-node 2s ease-in-out infinite' }}
              cursor="pointer"
              onClick={() => scrollTo('why-aspire')}
            >
              ▼ Scroll to explore ▼
            </Text>
          </Flex>
        </Box>

        {/* ═══════════════════ QUICK LINKS BAR ═══════════════════ */}
        <Flex
          justify="center"
          align="center"
          gap={{ base: '3', md: '6' }}
          py="4"
          px="4"
          bg="rgba(21,18,36,0.85)"
          borderTop="1px solid rgba(107,79,187,0.2)"
          borderBottom="1px solid rgba(107,79,187,0.2)"
          wrap="wrap"
        >
          {[
            { icon: '🎮', label: 'Playground', to: '/playground' },
            { icon: '🖼️', label: 'Gallery', to: '/gallery' },
            { icon: '🗺️', label: 'Concept Map', to: '/concept-map' },
            { icon: '📚', label: 'Curriculum', to: '/dashboard' },
          ].map((link) => (
            <Flex
              key={link.label}
              align="center"
              gap="2"
              px="4"
              py="2"
              borderRadius="full"
              bg="rgba(107,79,187,0.1)"
              border="1px solid rgba(107,79,187,0.25)"
              cursor="pointer"
              transition="all 0.25s ease"
              _hover={{
                bg: 'rgba(107,79,187,0.25)',
                borderColor: 'aspire.400',
                boxShadow: '0 0 16px rgba(107,79,187,0.3)',
                transform: 'translateY(-1px)',
              }}
              onClick={() => navigate(link.to)}
            >
              <Text fontSize="sm">{link.icon}</Text>
              <Text fontSize="xs" color="aspire.300" fontWeight="bold" letterSpacing="wide">
                {link.label}
              </Text>
            </Flex>
          ))}
        </Flex>

        {/* ═══════════════════ WHY ASPIRE ═══════════════════ */}
        <Box id="why-aspire" py={{ base: '16', md: '20' }} px="4">
            <Heading
              as="h2"
              fontSize={{ base: 'xl', md: '2xl' }}
              textAlign="center"
              color="aspire.400"
              mb="3"
            >
              Why Aspire?
            </Heading>
            <Text textAlign="center" color="whiteAlpha.700" mb="10" maxW="700px" mx="auto" lineHeight="1.7">
              Every team that splits into services inherits the same problems: wiring connection strings,
              coordinating startup, reading four log files to debug one request, maintaining separate configs
              per environment.
            </Text>
            <SimpleGrid columns={{ base: 1, sm: 2 }} gap="5" maxW="1000px" mx="auto">
              {[
                {
                  icon: '🏗️',
                  title: 'Declare your app, not your infrastructure',
                  desc: 'Define services, databases, and their relationships in code. One readable file replaces Docker Compose, env scripts, and tribal knowledge.',
                  linkLabel: 'Try it → Playground',
                  linkTo: '/playground',
                },
                {
                  icon: '▶️',
                  title: 'Start everything with one command',
                  desc: '\u003Ccode\u003Easpire run\u003C/code\u003E starts containers, waits for health checks, injects connection strings, and opens a dashboard. New developer? Clone, run, done.',
                  linkLabel: 'See how → Gallery',
                  linkTo: '/gallery',
                },
                {
                  icon: '📡',
                  title: 'Manage and observe from a live dashboard',
                  desc: 'Real-time logs, distributed traces, health checks, and custom commands — seed data, flush caches, run migrations — all from one dashboard.',
                  linkLabel: 'Learn more → Dashboard Lesson',
                  linkTo: '/lessons/1.1.2',
                },
                {
                  icon: '🚀',
                  title: 'Ship the same app to any cloud',
                  desc: 'Your dev topology compiles to Docker Compose, Kubernetes Helm charts, or Azure Bicep. No rewrites. Pick your target when you\'re ready.',
                  linkLabel: 'Explore → Concept Map',
                  linkTo: '/concept-map',
                },
              ].map((card) => (
                <Box
                  key={card.title}
                  border="2px solid"
                  borderColor="aspire.600"
                  borderRadius="md"
                  position="relative"
                  overflow="hidden"
                  bg="rgba(26,11,46,0.6)"
                  p="5"
                  cursor="pointer"
                  _before={{
                    content: '""',
                    position: 'absolute',
                    inset: '-1px',
                    background: 'linear-gradient(135deg, rgba(107,79,187,0.3), transparent, rgba(107,79,187,0.15))',
                    borderRadius: 'md',
                    zIndex: 0,
                    pointerEvents: 'none',
                  }}
                  _hover={{
                    transform: 'translateY(-4px)',
                    borderColor: 'aspire.400',
                    boxShadow: '0 8px 32px rgba(107,79,187,0.3)',
                  }}
                  transition="all 0.3s ease"
                  onClick={() => navigate(card.linkTo)}
                >
                  <Box position="relative" zIndex={1}>
                    <Text fontSize="2xl" mb="2">{card.icon}</Text>
                    <Text fontWeight="bold" color="aspire.300" mb="1">{card.title}</Text>
                    <Text fontSize="sm" color="whiteAlpha.700" lineHeight="1.6" mb="3"
                      dangerouslySetInnerHTML={{ __html: card.desc }}
                    />
                    <Text
                      fontSize="xs"
                      color="aspire.400"
                      cursor="pointer"
                      _hover={{ textDecoration: 'underline' }}
                      onClick={(e) => { e.stopPropagation(); navigate(card.linkTo); }}
                    >
                      {card.linkLabel}
                    </Text>
                  </Box>
                </Box>
              ))}
            </SimpleGrid>
        </Box>

        {/* ═══════════════════ STATS ═══════════════════ */}
        <Box id="stats" py={{ base: '16', md: '20' }} px="4" bg="#151224">
            <SimpleGrid
              data-testid="stats-section"
              columns={{ base: 2, md: 4 }}
              gap="6"
              maxW="900px"
              mx="auto"
            >
              {stats.map((s, i) => (
                <Flex
                  key={s.label}
                  direction="column"
                  align="center"
                  gap="2"
                  {...retroCardProps}
                  bg="rgba(26,11,46,0.6)"
                  p="6"
                  transition="all 0.3s ease"
                  _hover={{
                    transform: 'scale(1.06)',
                    boxShadow: '0 0 20px rgba(107,79,187,0.4), 4px 4px 0 #2B1260',
                  }}
                  style={{
                    animation: `card-glow 4s ease-in-out ${i * 0.5}s infinite`,
                  }}
                >
                  <Box style={{ animation: `shimmer 3s ease-in-out ${i * 0.7}s infinite` }}>
                    <CountUp target={s.num} />
                  </Box>
                  <Text
                    {...pixelFontProps}
                    fontSize={{ base: '8px', md: '10px' }}
                    color="whiteAlpha.700"
                    textTransform="uppercase"
                  >
                    {s.label}
                  </Text>
                </Flex>
              ))}
            </SimpleGrid>
        </Box>

        {/* ═══════════════════ LEARNING TRACKS ═══════════════════ */}
        {(personas ?? []).length > 0 && (
          <Box py={{ base: '16', md: '20' }} px="4">
              <Heading
                as="h2"
                {...pixelFontProps}
                fontSize={{ base: '16px', md: '22px' }}
                textAlign="center"
                color="aspire.400"
                mb="3"
              >
                Built for Your Role
              </Heading>
              <Text textAlign="center" color="whiteAlpha.600" mb="10" maxW="600px" mx="auto">
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
                    bg="rgba(26,11,46,0.7)"
                    p="5"
                    textAlign="center"
                    cursor="pointer"
                    transition="all 0.25s"
                    _hover={{
                      transform: 'scale(1.05) translateY(-4px)',
                      borderColor: p.color,
                    }}
                    onClick={() => navigate(`/personas/${p.id}`)}
                  >
                    <Text fontSize="36px" mb="2">{p.icon}</Text>
                    <Text
                      {...pixelFontProps}
                      fontSize={{ base: '9px', md: '10px' }}
                      color="aspire.300"
                      mb="2"
                    >
                      {p.name}
                    </Text>
                    <Text fontSize="xs" color="whiteAlpha.600" lineHeight="1.5" mb="3">
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
                  color="aspire.400"
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
        <Box id="worlds" py={{ base: '16', md: '20' }} px="4">
            <Heading
              data-testid="worlds-heading"
              as="h2"
              {...pixelFontProps}
              fontSize={{ base: '16px', md: '22px' }}
              textAlign="center"
              color="aspire.400"
              mb="3"
            >
              🗺️ Choose Your World
            </Heading>
            <Text textAlign="center" color="whiteAlpha.600" mb="10" maxW="600px" mx="auto">
              {worlds ? `${worlds.length} themed worlds` : 'Themed worlds'} take you from cloud fundamentals to production-ready distributed apps
            </Text>

          <SimpleGrid
            data-testid="worlds-grid"
            columns={{ base: 2, sm: 2, md: 4 }}
            gap="5"
            maxW="1000px"
            mx="auto"
          >
            {(worlds ?? []).map((w, i) => (
                <Card.Root
                  {...retroCardProps}
                  bg="rgba(26,11,46,0.7)"
                  p="5"
                  textAlign="center"
                  cursor="pointer"
                  transition="all 0.25s"
                  _hover={{
                    transform: 'scale(1.05) translateY(-4px)',
                    borderColor: 'aspire.600',
                  }}
                  style={{
                    animation: `card-glow 4s ease-in-out infinite, slide-up-fade 0.6s ease-out ${i * 0.08}s both`,
                  }}
                  onClick={() => navigate(`/worlds/${w.id}`)}
                >
                  <Text fontSize="36px" mb="2">{w.icon}</Text>
                  <Text
                    {...pixelFontProps}
                    fontSize={{ base: '8px', md: '10px' }}
                    color="aspire.300"
                    mb="2"
                  >
                    {w.name}
                  </Text>
                  <Text fontSize="xs" color="whiteAlpha.600" lineHeight="1.5">
                    {w.description}
                  </Text>
                </Card.Root>
            ))}
          </SimpleGrid>
        </Box>

        {/* ═══════════════════ HOW IT WORKS ═══════════════════ */}
        <Box id="how-it-works" py={{ base: '16', md: '20' }} px="4" bg="#151224">
            <Heading
              data-testid="how-it-works-heading"
              as="h2"
              {...pixelFontProps}
              fontSize={{ base: '16px', md: '22px' }}
              textAlign="center"
              color="aspire.400"
              mb="12"
            >
              How It Works
            </Heading>

          <Box position="relative" maxW="900px" mx="auto">
            {/* Connecting timeline bar (desktop only) */}
            <Box
              display={{ base: 'none', md: 'block' }}
              position="absolute"
              top="36px"
              left="16%"
              right="16%"
              h="4px"
              borderRadius="full"
              background="linear-gradient(90deg, rgba(107,79,187,0.15), rgba(107,79,187,0.5), rgba(255,215,0,0.4), rgba(107,79,187,0.5), rgba(107,79,187,0.15))"
              zIndex={0}
            />

            <SimpleGrid columns={{ base: 1, md: 3 }} gap="8" position="relative" zIndex={1}>
              {HOW_IT_WORKS.map((item, i) => (
                <Flex key={item.step} direction="column" align="center" textAlign="center" gap="3">
                  <Flex
                    align="center"
                    justify="center"
                    w="72px"
                    h="72px"
                    bg="rgba(107,79,187,0.2)"
                    border="2px solid"
                    borderColor="aspire.600"
                    borderRadius="md"
                    transition="all 0.3s ease"
                    _hover={{
                      animation: 'step-pulse 1s ease-in-out',
                      borderColor: 'game.xpGold',
                    }}
                  >
                    <Text {...pixelFontProps} fontSize="24px" color="game.xpGold">{item.step}</Text>
                  </Flex>
                  <Text {...pixelFontProps} fontSize="14px" color="game.xpGold">
                    {item.title}
                  </Text>
                  <Text fontSize="sm" color="whiteAlpha.700" maxW="240px">
                    {item.desc}
                  </Text>
                  {i < HOW_IT_WORKS.length - 1 && (
                    <Text
                      display={{ base: 'block', md: 'none' }}
                      {...pixelFontProps}
                      fontSize="18px"
                      color="aspire.600"
                      mt="2"
                    >
                      ▼
                    </Text>
                  )}
                </Flex>
              ))}
            </SimpleGrid>
          </Box>
        </Box>

        {/* ═══════════════════ FOOTER CTA ═══════════════════ */}
        <Box
          data-testid="footer-cta"
          py={{ base: '16', md: '20' }}
          px="4"
          bg="#151224"
          textAlign="center"
        >
            <Text {...pixelFontProps} fontSize={{ base: '14px', md: '20px' }} color="aspire.400" mb="4">
              Ready to make your services work as one?
            </Text>
            <Text color="whiteAlpha.600" mb="8" maxW="500px" mx="auto">
              From your first aspire run to deploying to production — learn the platform that makes
              distributed apps simple.
            </Text>
            <Button
              data-testid="footer-cta-button"
              size="lg"
              bg="game.xpGold"
              color="#0D0B1A"
              {...pixelFontProps}
              fontSize={{ base: '11px', md: '13px' }}
              px="10"
              py="6"
              {...retroCardProps}
              borderColor="game.xpGold"
              boxShadow="4px 4px 0 rgba(255,215,0,0.4)"
              _hover={{
                transform: 'translateY(-2px)',
                boxShadow: '4px 6px 0 rgba(255,215,0,0.5)',
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
          borderTop="2px solid #2B1260"
        >
          <Text {...pixelFontProps} fontSize="10px" color="aspire.600">
            Aspire Learn
          </Text>
          <Text fontSize="xs" color="whiteAlpha.400">
            Learn Aspire · Build distributed apps · Have fun doing it
          </Text>
          <Flex gap="4" mt="2">
            <a
              href="https://aspire.dev/docs/"
              target="_blank"
              rel="noopener noreferrer"
            >
              <Text fontSize="xs" color="whiteAlpha.500" _hover={{ color: 'aspire.400' }}>
                Aspire Docs
              </Text>
            </a>
            <a
              href="https://github.com/microsoft/aspire"
              target="_blank"
              rel="noopener noreferrer"
            >
              <Text fontSize="xs" color="whiteAlpha.500" _hover={{ color: 'aspire.400' }}>
                GitHub
              </Text>
            </a>
          </Flex>
        </Flex>
      </Box>
    </>
  );
}
