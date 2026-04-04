import { Box, Flex, Text } from '@chakra-ui/react';
import {
  FiHome,
  FiGrid,
  FiUser,
  FiUsers,
  FiAward,
  FiBarChart2,
  FiFileText,
  FiGlobe,
  FiChevronDown,
  FiChevronRight,
  FiLock,
  FiShield,
  FiCpu,
  FiMap,
  FiImage,
  FiTarget,
  FiStar,
  FiExternalLink,
  FiGithub,
  FiCompass,
} from 'react-icons/fi';
import { NavLink, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useState, type ReactNode } from 'react';
import api from '../../services/apiClient';
import { useAuthStore } from '../../store/authStore';
import { pixelFontProps } from '../../theme/aspireTheme';
import type { World, Module } from '../../types';

interface SidebarProps {
  open: boolean;
  onClose: () => void;
}

function SideNavLink({
  to,
  icon,
  children,
  onClose,
}: {
  to: string;
  icon: ReactNode;
  children: ReactNode;
  onClose: () => void;
}) {
  return (
    <NavLink
      to={to}
      onClick={onClose}
      end={to === '/'}
      style={{ textDecoration: 'none' }}
    >
      {({ isActive }) => (
        <Flex
          align="center"
          gap="3"
          px="3"
          py="2"
          borderRadius="md"
          fontSize="sm"
          color={isActive ? 'game.gold' : 'dark.text'}
          bg={isActive ? 'content.hover' : 'transparent'}
          fontWeight={isActive ? '600' : '400'}
          _hover={{ bg: 'content.hover', color: 'dark.text' }}
          transition="all 0.15s"
        >
          {icon}
          {children}
        </Flex>
      )}
    </NavLink>
  );
}

function WorldModules({
  worldId,
  onNav,
}: {
  worldId: string;
  onNav: (path: string) => void;
}) {
  const { data: modules } = useQuery<Module[]>({
    queryKey: ['worldModules', worldId],
    queryFn: () => api.get(`/worlds/${worldId}/modules`).then((r) => r.data),
    staleTime: 1000 * 60 * 5,
  });

  if (!modules) return null;

  return modules.map((mod) => (
    <Flex
      key={mod.id}
      align="center"
      gap="2"
      pl="9"
      pr="3"
      py="1"
      borderRadius="md"
      fontSize="12px"
      color={!mod.isUnlocked ? 'dark.muted' : 'dark.muted'}
      cursor={mod.isUnlocked ? 'pointer' : 'default'}
      _hover={mod.isUnlocked ? { bg: 'content.hover', color: 'dark.text' } : undefined}
      onClick={() => mod.isUnlocked && onNav(`/worlds/${worldId}`)}
      role="button"
      tabIndex={mod.isUnlocked ? 0 : -1}
      aria-label={mod.isUnlocked ? mod.name : `${mod.name} - Locked`}
      onKeyDown={(e) => {
        if (mod.isUnlocked && (e.key === 'Enter' || e.key === ' ')) {
          e.preventDefault();
          onNav(`/worlds/${worldId}`);
        }
      }}
    >
      {!mod.isUnlocked && <FiLock size={10} />}
      {mod.name}
    </Flex>
  ));
}

export function Sidebar({ open, onClose }: SidebarProps) {
  const navigate = useNavigate();
  const user = useAuthStore((s) => s.user);
  const isAdmin = user?.username?.toLowerCase() === 'admin';
  const [expandedWorlds, setExpandedWorlds] = useState<Set<string>>(new Set());

  const { data: worlds } = useQuery<World[]>({
    queryKey: ['worlds'],
    queryFn: async () => {
      try {
        return (await api.get('/worlds')).data;
      } catch (err) {
        console.error('[Sidebar] Failed to fetch worlds:', err);
        throw err;
      }
    },
    staleTime: 1000 * 60 * 5,
  });

  const toggleWorld = (id: string) => {
    setExpandedWorlds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const navTo = (path: string) => {
    navigate(path);
    onClose();
  };

  return (
    <>
      {/* Mobile overlay */}
      {open && (
        <Box
          display={{ base: 'block', md: 'none' }}
          position="fixed"
          inset="0"
          bg="blackAlpha.500"
          zIndex={199}
          onClick={onClose}
        />
      )}

      {/* Sidebar */}
      <Box
        as="nav"
        w="250px"
        minW="250px"
        bg="dark.sidebar"
        h="100%"
        overflowY="auto"
        display={{
          base: open ? 'flex' : 'none',
          md: 'flex',
        }}
        flexDirection="column"
        pt="2"
        pb="4"
        className="dark-scrollbar"
        position={{ base: 'fixed', md: 'relative' }}
        top={{ base: '56px', md: 'auto' }}
        left="0"
        bottom={{ base: '0', md: 'auto' }}
        zIndex={{ base: 200, md: 'auto' }}
        boxShadow={{ base: 'lg', md: 'none' }}
      >
        {/* Main nav */}
        <Box px="2" mb="1" data-tour="sidebar-home">
          <SideNavLink to="/" icon={<FiHome size={16} />} onClose={onClose}>
            Home
          </SideNavLink>
          <SideNavLink to="/dashboard" icon={<FiGrid size={16} />} onClose={onClose}>
            Dashboard
          </SideNavLink>
        </Box>

        {/* Worlds */}
        <Box px="2" data-tour="sidebar-worlds">
          <Text
            fontSize="10px"
            fontWeight="700"
            color="dark.muted"
            textTransform="uppercase"
            letterSpacing="0.5px"
            px="3"
            pt="3"
            pb="1"
            {...pixelFontProps}
          >
            Worlds
          </Text>
          {worlds?.map((world) => (
            <Box key={world.id}>
              <Flex
                data-testid={`sidebar-world-${world.id}`}
                as="button"
                align="center"
                gap="2"
                w="100%"
                px="3"
                py="1.5"
                borderRadius="md"
                fontSize="13px"
                color={!world.isUnlocked ? 'dark.muted' : 'dark.text'}
                bg="transparent"
                border="none"
                cursor={world.isUnlocked ? 'pointer' : 'default'}
                textAlign="left"
                _hover={world.isUnlocked ? { bg: 'content.hover' } : undefined}
                onClick={() => world.isUnlocked && toggleWorld(world.id)}
                title={world.isUnlocked ? `Toggle ${world.name} world` : `${world.name} - Locked`}
                aria-label={world.isUnlocked ? `Toggle ${world.name} world` : `${world.name} world - Locked`}
                aria-expanded={world.isUnlocked ? expandedWorlds.has(world.id) : undefined}
              >
                <FiGlobe size={14} />
                <Text as="span" flex="1" truncate>
                  {world.icon} {world.name}
                </Text>
                {!world.isUnlocked ? (
                  <FiLock size={12} />
                ) : expandedWorlds.has(world.id) ? (
                  <FiChevronDown size={12} />
                ) : (
                  <FiChevronRight size={12} />
                )}
              </Flex>

              {world.isUnlocked &&
                expandedWorlds.has(world.id) && (
                  <WorldModules worldId={world.id} onNav={navTo} />
                )}
            </Box>
          ))}
        </Box>

        {/* Explore */}
        <Box px="2" mt="2" data-tour="sidebar-explore">
          <Text
            fontSize="10px"
            fontWeight="700"
            color="dark.muted"
            textTransform="uppercase"
            letterSpacing="0.5px"
            px="3"
            pt="3"
            pb="1"
            {...pixelFontProps}
          >
            Explore
          </Text>
          <SideNavLink to="/playground" icon={<Flex align="center" gap="0"><Box w="6px" h="6px" borderRadius="full" bg="#2DD4BF" mr="2" flexShrink={0} /><FiCpu size={16} /></Flex>} onClose={onClose}>
            Playground
          </SideNavLink>
          <SideNavLink to="/concept-map" icon={<Flex align="center" gap="0"><Box w="6px" h="6px" borderRadius="full" bg="#34D399" mr="2" flexShrink={0} /><FiMap size={16} /></Flex>} onClose={onClose}>
            Concept Map
          </SideNavLink>
          <SideNavLink to="/gallery" icon={<Flex align="center" gap="0"><Box w="6px" h="6px" borderRadius="full" bg="#FBBF24" mr="2" flexShrink={0} /><FiImage size={16} /></Flex>} onClose={onClose}>
            Gallery
          </SideNavLink>
          <SideNavLink to="/weekly-challenge" icon={<Flex align="center" gap="0"><Box w="6px" h="6px" borderRadius="full" bg="#FB7185" mr="2" flexShrink={0} /><FiTarget size={16} /></Flex>} onClose={onClose}>
            Weekly Challenge
          </SideNavLink>
          <SideNavLink to="/whats-new" icon={<FiStar size={16} />} onClose={onClose}>
            What's New
          </SideNavLink>
          <SideNavLink to="/personas" icon={<FiCompass size={16} />} onClose={onClose}>
            Learning Tracks
          </SideNavLink>
        </Box>

        {/* Social */}
        <Box px="2" mt="2" data-tour="sidebar-social">
          <Text
            fontSize="10px"
            fontWeight="700"
            color="dark.muted"
            textTransform="uppercase"
            letterSpacing="0.5px"
            px="3"
            pt="3"
            pb="1"
            {...pixelFontProps}
          >
            Social
          </Text>
          <SideNavLink to="/profile" icon={<FiUser size={16} />} onClose={onClose}>
            Profile
          </SideNavLink>
          <SideNavLink to="/friends" icon={<FiUsers size={16} />} onClose={onClose}>
            Friends
          </SideNavLink>
          <SideNavLink to="/leaderboard" icon={<FiBarChart2 size={16} />} onClose={onClose}>
            Leaderboard
          </SideNavLink>
          <SideNavLink to="/achievements" icon={<FiAward size={16} />} onClose={onClose}>
            Achievements
          </SideNavLink>
          <SideNavLink to="/certificates" icon={<FiFileText size={16} />} onClose={onClose}>
            Certificates
          </SideNavLink>
        </Box>

        {/* Aspire Links */}
        <Box px="2" mt="2">
          <Text
            fontSize="10px"
            fontWeight="700"
            color="dark.muted"
            textTransform="uppercase"
            letterSpacing="0.5px"
            px="3"
            pt="3"
            pb="1"
            {...pixelFontProps}
          >
            Aspire
          </Text>
          <a
            href="https://aspire.dev/docs/"
            target="_blank"
            rel="noopener noreferrer"
          >
            <Flex
              align="center"
              gap="3"
              px="3"
              py="2"
              borderRadius="md"
              color="dark.text"
              fontSize="sm"
              transition="background 0.15s"
              _hover={{ bg: 'content.hover', color: 'dark.text' }}
            >
              <FiExternalLink size={16} />
              <Text fontSize="sm">Aspire Docs</Text>
            </Flex>
          </a>
          <a
            href="https://github.com/microsoft/aspire"
            target="_blank"
            rel="noopener noreferrer"
          >
            <Flex
              align="center"
              gap="3"
              px="3"
              py="2"
              borderRadius="md"
              color="dark.text"
              fontSize="sm"
              transition="background 0.15s"
              _hover={{ bg: 'content.hover', color: 'dark.text' }}
            >
              <FiGithub size={16} />
              <Text fontSize="sm">Aspire on GitHub</Text>
            </Flex>
          </a>
        </Box>

        {/* Admin */}
        {isAdmin && (
          <Box px="2" mt="2">
            <Text
              fontSize="10px"
              fontWeight="700"
              color="dark.muted"
              textTransform="uppercase"
              letterSpacing="0.5px"
              px="3"
              pt="3"
              pb="1"
              {...pixelFontProps}
            >
              Admin
            </Text>
            <SideNavLink to="/admin" icon={<FiShield size={16} />} onClose={onClose}>
              Admin Panel
            </SideNavLink>
          </Box>
        )}
      </Box>
    </>
  );
}
