import { Box, Flex, Text } from '@chakra-ui/react';
import {
  FiHome,
  FiGrid,
  FiUser,
  FiUsers,
  FiAward,
  FiBarChart2,
  FiGlobe,
  FiChevronDown,
  FiChevronRight,
  FiLock,
  FiShield,
} from 'react-icons/fi';
import { NavLink, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useState, type ReactNode } from 'react';
import api from '../../services/apiClient';
import { useAuthStore } from '../../store/authStore';
import type { World } from '../../types';

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
          color={isActive ? 'game.xpGold' : 'whiteAlpha.800'}
          bg={isActive ? 'whiteAlpha.100' : 'transparent'}
          fontWeight={isActive ? '600' : '400'}
          _hover={{ bg: 'whiteAlpha.100', color: 'white' }}
          transition="all 0.15s"
        >
          {icon}
          {children}
        </Flex>
      )}
    </NavLink>
  );
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
        <Box px="2" mb="1">
          <SideNavLink to="/" icon={<FiHome size={16} />} onClose={onClose}>
            Home
          </SideNavLink>
          <SideNavLink to="/dashboard" icon={<FiGrid size={16} />} onClose={onClose}>
            Dashboard
          </SideNavLink>
        </Box>

        {/* Worlds */}
        <Box px="2">
          <Text
            fontSize="10px"
            fontWeight="700"
            color="whiteAlpha.500"
            textTransform="uppercase"
            letterSpacing="0.5px"
            px="3"
            pt="3"
            pb="1"
            fontFamily="pixel"
          >
            Worlds
          </Text>
          {worlds?.map((world) => (
            <Box key={world.id}>
              <Flex
                as="button"
                align="center"
                gap="2"
                w="100%"
                px="3"
                py="1.5"
                borderRadius="md"
                fontSize="13px"
                color={!world.isUnlocked ? 'whiteAlpha.400' : 'whiteAlpha.800'}
                bg="transparent"
                border="none"
                cursor={world.isUnlocked ? 'pointer' : 'default'}
                textAlign="left"
                _hover={world.isUnlocked ? { bg: 'whiteAlpha.100' } : undefined}
                onClick={() => world.isUnlocked && toggleWorld(world.id)}
              >
                <FiGlobe size={14} />
                <Text as="span" flex="1" truncate>
                  {world.iconEmoji} {world.name}
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
                expandedWorlds.has(world.id) &&
                world.modules?.map((mod) => (
                  <Flex
                    key={mod.id}
                    align="center"
                    gap="2"
                    pl="9"
                    pr="3"
                    py="1"
                    borderRadius="md"
                    fontSize="12px"
                    color={!mod.isUnlocked ? 'whiteAlpha.300' : 'whiteAlpha.700'}
                    cursor={mod.isUnlocked ? 'pointer' : 'default'}
                    _hover={mod.isUnlocked ? { bg: 'whiteAlpha.100', color: 'white' } : undefined}
                    onClick={() => mod.isUnlocked && navTo(`/worlds/${world.id}`)}
                    role="button"
                    tabIndex={mod.isUnlocked ? 0 : -1}
                  >
                    {!mod.isUnlocked && <FiLock size={10} />}
                    {mod.name}
                  </Flex>
                ))}
            </Box>
          ))}
        </Box>

        {/* Social */}
        <Box px="2" mt="2">
          <Text
            fontSize="10px"
            fontWeight="700"
            color="whiteAlpha.500"
            textTransform="uppercase"
            letterSpacing="0.5px"
            px="3"
            pt="3"
            pb="1"
            fontFamily="pixel"
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
        </Box>

        {/* Admin */}
        {isAdmin && (
          <Box px="2" mt="2">
            <Text
              fontSize="10px"
              fontWeight="700"
              color="whiteAlpha.500"
              textTransform="uppercase"
              letterSpacing="0.5px"
              px="3"
              pt="3"
              pb="1"
              fontFamily="pixel"
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
