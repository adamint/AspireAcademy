import { useEffect, useRef, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Box, Flex, Text, Heading, Button, SimpleGrid, Card } from '@chakra-ui/react';
import { useAuthStore } from '../store/authStore';
import { retroCardProps, pixelFontProps } from '../theme/aspireTheme';

/* ───────────────────────────── constants ───────────────────────────── */

const WORLDS = [
  { icon: '🌌', name: 'Cloud Foundations', desc: 'Azure basics & cloud-native concepts' },
  { icon: '🏗️', name: 'App Host Mastery', desc: 'Orchestrate your first distributed app' },
  { icon: '🔌', name: 'Service Discovery', desc: 'Connect services seamlessly' },
  { icon: '🗄️', name: 'Data & Storage', desc: 'Databases, caches, and state' },
  { icon: '📡', name: 'Messaging & Events', desc: 'Queues, topics, and event-driven design' },
  { icon: '📊', name: 'Observability', desc: 'Logging, tracing, and metrics' },
  { icon: '🚀', name: 'Deployment', desc: 'Ship to Azure with confidence' },
  { icon: '🏆', name: 'Boss Challenges', desc: 'Prove your mastery end-to-end' },
] as const;

const STATS: { label: string; value: string; num: number }[] = [
  { label: 'Worlds', value: '8', num: 8 },
  { label: 'Lessons', value: '174', num: 174 },
  { label: 'Code Challenges', value: '27', num: 27 },
  { label: 'Fun', value: '∞', num: -1 },
];

const HOW_IT_WORKS = [
  { step: '1', icon: '📖', title: 'Learn', desc: 'Bite-sized lessons on every Aspire concept' },
  { step: '2', icon: '💻', title: 'Practice', desc: 'Hands-on code challenges & quizzes' },
  { step: '3', icon: '⭐', title: 'Master', desc: 'Earn XP, rank up, and unlock achievements' },
];

const SAMPLE_ACHIEVEMENTS = [
  { icon: '🌱', name: 'First Steps', desc: 'Complete your first lesson' },
  { icon: '🔥', name: 'On Fire', desc: '7-day login streak' },
  { icon: '💎', name: 'Perfectionist', desc: 'Score 100% on any quiz' },
  { icon: '🏗️', name: 'Architect', desc: 'Complete all 8 worlds' },
];

const MOCK_LEADERBOARD = [
  { rank: 1, name: 'CloudNinja42', xp: 12_450, badge: '👑' },
  { rank: 2, name: 'AspireHero', xp: 11_200, badge: '🥈' },
  { rank: 3, name: 'DevQuester', xp: 10_800, badge: '🥉' },
  { rank: 4, name: 'You?', xp: 0, badge: '🎯' },
];

/* ───────────────────────── CSS keyframes ───────────────────────── */

const KEYFRAMES = `
@keyframes glow-pulse {
  0%, 100% { text-shadow: 0 0 10px rgba(107,79,187,0.6), 0 0 30px rgba(107,79,187,0.3); }
  50%      { text-shadow: 0 0 20px rgba(107,79,187,0.9), 0 0 60px rgba(107,79,187,0.5), 0 0 80px rgba(107,79,187,0.2); }
}
@keyframes typewriter-cursor { 0%,100%{opacity:1} 50%{opacity:0} }
@keyframes fade-in-up {
  from { opacity:0; transform:translateY(24px); }
  to   { opacity:1; transform:translateY(0); }
}
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

/* ─────────────────── Count-up on scroll ──────────────────── */

function CountUp({ target, suffix = '' }: { target: number; suffix?: string }) {
  const ref = useRef<HTMLSpanElement>(null);
  const [value, setValue] = useState(0);
  const [started, setStarted] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && !started) setStarted(true);
      },
      { threshold: 0.3 },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [started]);

  useEffect(() => {
    if (!started || target < 0) return;
    const duration = 1500;
    const steps = 40;
    const increment = target / steps;
    let current = 0;
    const id = setInterval(() => {
      current += increment;
      if (current >= target) {
        setValue(target);
        clearInterval(id);
      } else {
        setValue(Math.floor(current));
      }
    }, duration / steps);
    return () => clearInterval(id);
  }, [started, target]);

  return (
    <Text
      as="span"
      ref={ref as React.Ref<HTMLParagraphElement>}
      {...pixelFontProps}
      fontSize={{ base: '24px', md: '36px' }}
      color="game.xpGold"
    >
      {target < 0 ? '∞' : value}
      {suffix}
    </Text>
  );
}

/* ─────────────────── Scroll-triggered fade-in ──────────────────── */

function FadeInSection({ children, delay = 0 }: { children: React.ReactNode; delay?: number }) {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) setVisible(true); },
      { threshold: 0.15 },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return (
    <Box
      ref={ref}
      style={{
        opacity: visible ? 1 : 0,
        transform: visible ? 'translateY(0)' : 'translateY(24px)',
        transition: `opacity 0.6s ease ${delay}s, transform 0.6s ease ${delay}s`,
      }}
    >
      {children}
    </Box>
  );
}

/* ═══════════════════════ MAIN COMPONENT ═══════════════════════ */

export default function HomePage() {
  const navigate = useNavigate();
  const user = useAuthStore((s) => s.user);
  const token = useAuthStore((s) => s.token);
  const isLoggedIn = !!token;

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
        <Box id="hero" position="relative" minH={{ base: '90vh', md: '92vh' }} overflow="hidden">
          <NetworkCanvas />

          <Flex
            position="relative"
            zIndex={1}
            direction="column"
            align="center"
            justify="center"
            textAlign="center"
            minH={{ base: '90vh', md: '92vh' }}
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
                mb="2"
              >
                <Text {...pixelFontProps} fontSize={{ base: '10px', md: '12px' }} color="game.xpGold">
                  Welcome back, {user.displayName || user.username}! 🎮
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
              ACADEMY
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
                🎮 {isLoggedIn ? 'Continue Journey' : 'Start Your Journey'}
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
                📖 Browse Curriculum
              </Button>
            </Flex>

            {/* Scroll hint */}
            <Text
              mt="10"
              fontSize="xs"
              color="whiteAlpha.500"
              style={{ animation: 'float-node 2s ease-in-out infinite' }}
              cursor="pointer"
              onClick={() => scrollTo('stats')}
            >
              ▼ Scroll to explore ▼
            </Text>
          </Flex>
        </Box>

        {/* ═══════════════════ STATS ═══════════════════ */}
        <Box id="stats" py={{ base: '16', md: '20' }} px="4" bg="#151224">
          <FadeInSection>
            <SimpleGrid
              data-testid="stats-section"
              columns={{ base: 2, md: 4 }}
              gap="6"
              maxW="900px"
              mx="auto"
            >
              {STATS.map((s) => (
                <Flex
                  key={s.label}
                  direction="column"
                  align="center"
                  gap="2"
                  {...retroCardProps}
                  bg="rgba(26,11,46,0.6)"
                  p="6"
                >
                  <CountUp target={s.num} />
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
          </FadeInSection>
        </Box>

        {/* ═══════════════════ WORLDS ═══════════════════ */}
        <Box id="worlds" py={{ base: '16', md: '20' }} px="4">
          <FadeInSection>
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
              Eight themed worlds take you from cloud fundamentals to production-ready distributed apps
            </Text>
          </FadeInSection>

          <SimpleGrid
            data-testid="worlds-grid"
            columns={{ base: 2, sm: 2, md: 4 }}
            gap="5"
            maxW="1000px"
            mx="auto"
          >
            {WORLDS.map((w, i) => (
              <FadeInSection key={w.name} delay={i * 0.08}>
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
                  style={{ animation: 'card-glow 4s ease-in-out infinite' }}
                  onClick={() => navigate(`/worlds/world-${i + 1}`)}
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
                    {w.desc}
                  </Text>
                </Card.Root>
              </FadeInSection>
            ))}
          </SimpleGrid>
        </Box>

        {/* ═══════════════════ HOW IT WORKS ═══════════════════ */}
        <Box id="how-it-works" py={{ base: '16', md: '20' }} px="4" bg="#151224">
          <FadeInSection>
            <Heading
              data-testid="how-it-works-heading"
              as="h2"
              {...pixelFontProps}
              fontSize={{ base: '16px', md: '22px' }}
              textAlign="center"
              color="aspire.400"
              mb="12"
            >
              ⚔️ How It Works
            </Heading>
          </FadeInSection>

          <SimpleGrid columns={{ base: 1, md: 3 }} gap="8" maxW="900px" mx="auto">
            {HOW_IT_WORKS.map((item, i) => (
              <FadeInSection key={item.title} delay={i * 0.15}>
                <Flex direction="column" align="center" textAlign="center" gap="3">
                  <Flex
                    align="center"
                    justify="center"
                    w="72px"
                    h="72px"
                    {...retroCardProps}
                    bg="rgba(107,79,187,0.2)"
                    borderColor="aspire.600"
                    borderRadius="md"
                  >
                    <Text fontSize="32px">{item.icon}</Text>
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
              </FadeInSection>
            ))}
          </SimpleGrid>

          {/* Horizontal arrows between steps (desktop) */}
          <Flex
            display={{ base: 'none', md: 'flex' }}
            justify="center"
            gap="220px"
            mt="-100px"
            mb="8"
            pointerEvents="none"
          >
            <Text {...pixelFontProps} fontSize="24px" color="aspire.600">→</Text>
            <Text {...pixelFontProps} fontSize="24px" color="aspire.600">→</Text>
          </Flex>
        </Box>

        {/* ═══════════════════ SOCIAL PROOF / GAMIFICATION ═══════════════════ */}
        <Box py={{ base: '16', md: '20' }} px="4">
          <FadeInSection>
            <Heading
              data-testid="gamification-heading"
              as="h2"
              {...pixelFontProps}
              fontSize={{ base: '16px', md: '22px' }}
              textAlign="center"
              color="aspire.400"
              mb="12"
            >
              🏆 Level Up Your Skills
            </Heading>
          </FadeInSection>

          <SimpleGrid columns={{ base: 1, md: 2 }} gap="8" maxW="900px" mx="auto">
            {/* Achievements preview */}
            <FadeInSection delay={0.1}>
              <Box {...retroCardProps} bg="rgba(26,11,46,0.7)" p="5">
                <Text {...pixelFontProps} fontSize="12px" color="game.xpGold" mb="4">
                  🎖️ Achievements
                </Text>
                <Flex direction="column" gap="3">
                  {SAMPLE_ACHIEVEMENTS.map((a) => (
                    <Flex key={a.name} align="center" gap="3">
                      <Flex
                        align="center"
                        justify="center"
                        w="36px"
                        h="36px"
                        bg="rgba(107,79,187,0.2)"
                        border="2px solid #2B1260"
                        borderRadius="sm"
                        flexShrink={0}
                      >
                        <Text fontSize="18px">{a.icon}</Text>
                      </Flex>
                      <Box>
                        <Text {...pixelFontProps} fontSize="9px" color="aspire.300">
                          {a.name}
                        </Text>
                        <Text fontSize="xs" color="whiteAlpha.600">{a.desc}</Text>
                      </Box>
                    </Flex>
                  ))}
                </Flex>
              </Box>
            </FadeInSection>

            {/* Leaderboard preview + XP bar */}
            <FadeInSection delay={0.2}>
              <Flex direction="column" gap="5">
                <Box {...retroCardProps} bg="rgba(26,11,46,0.7)" p="5">
                  <Text {...pixelFontProps} fontSize="12px" color="game.xpGold" mb="4">
                    📊 Leaderboard
                  </Text>
                  <Flex direction="column" gap="2">
                    {MOCK_LEADERBOARD.map((entry) => (
                      <Flex
                        key={entry.rank}
                        align="center"
                        justify="space-between"
                        px="3"
                        py="2"
                        bg={entry.rank === 4 ? 'rgba(107,79,187,0.15)' : 'transparent'}
                        border={entry.rank === 4 ? '1px dashed' : 'none'}
                        borderColor="aspire.600"
                        borderRadius="sm"
                      >
                        <Flex align="center" gap="2">
                          <Text fontSize="sm">{entry.badge}</Text>
                          <Text
                            {...pixelFontProps}
                            fontSize="9px"
                            color={entry.rank === 4 ? 'game.xpGold' : 'whiteAlpha.800'}
                          >
                            {entry.name}
                          </Text>
                        </Flex>
                        <Text {...pixelFontProps} fontSize="9px" color="game.xpGold">
                          {entry.rank === 4 ? '???' : entry.xp.toLocaleString()} XP
                        </Text>
                      </Flex>
                    ))}
                  </Flex>
                </Box>

                {/* XP bar animation */}
                <Box {...retroCardProps} bg="rgba(26,11,46,0.7)" p="5">
                  <Text {...pixelFontProps} fontSize="10px" color="whiteAlpha.700" mb="2">
                    Level Progress
                  </Text>
                  <Box
                    h="20px"
                    bg="rgba(232,224,240,0.1)"
                    border="2px solid #2B1260"
                    borderRadius="sm"
                    overflow="hidden"
                    position="relative"
                  >
                    <Box
                      h="100%"
                      bg="linear-gradient(90deg, #FFC107, #FFD700)"
                      style={{ animation: 'xp-bar-fill 2s ease-out forwards' }}
                    />
                    <Text
                      position="absolute"
                      top="50%"
                      left="50%"
                      transform="translate(-50%, -50%)"
                      {...pixelFontProps}
                      fontSize="8px"
                      color="#0D0B1A"
                    >
                      720 / 1000 XP
                    </Text>
                  </Box>
                </Box>
              </Flex>
            </FadeInSection>
          </SimpleGrid>
        </Box>

        {/* ═══════════════════ FOOTER CTA ═══════════════════ */}
        <Box
          data-testid="footer-cta"
          py={{ base: '16', md: '20' }}
          px="4"
          bg="#151224"
          textAlign="center"
        >
          <FadeInSection>
            <Text {...pixelFontProps} fontSize={{ base: '14px', md: '20px' }} color="aspire.400" mb="4">
              Ready to build distributed apps?
            </Text>
            <Text color="whiteAlpha.600" mb="8" maxW="500px" mx="auto">
              Join thousands of developers learning Aspire the fun way.
              Earn XP, unlock achievements, and climb the leaderboard.
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
              🎮 {isLoggedIn ? 'Continue Journey' : 'Start Your Journey'}
            </Button>
          </FadeInSection>
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
