import { Flex, Box, Text, IconButton, Button } from '@chakra-ui/react';
import { FiMenu, FiLogOut, FiUser, FiSun, FiMoon, FiSettings } from 'react-icons/fi';
import { useNavigate, Link as RouterLink } from 'react-router-dom';
import { useRef, useState } from 'react';
import { useAuthStore } from '../../store/authStore';
import { useGamificationStore } from '../../store/gamificationStore';
import { useEffectsStore } from '../../store/effectsStore';
import { useColorMode } from '../../hooks/useColorMode';
import { XPProgressBar } from '../gamification/XPProgressBar';
import { pixelFontProps } from '../../theme/aspireTheme';

interface TopBarProps {
  onToggleSidebar: () => void;
}

export function TopBar({ onToggleSidebar }: TopBarProps) {
  const navigate = useNavigate();
  const user = useAuthStore((s) => s.user);
  const token = useAuthStore((s) => s.token);
  const logout = useAuthStore((s) => s.logout);
  const loginStreakDays = useGamificationStore((s) => s.loginStreakDays);
  const { colorMode, toggleColorMode } = useColorMode();
  const soundEnabled = useEffectsStore((s) => s.soundEnabled);
  const toggleSound = useEffectsStore((s) => s.toggleSound);
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const isAuthenticated = !!token && !!user;

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <Flex
      as="header"
      align="center"
      h="56px"
      px="4"
      bg="dark.sidebar"
      borderBottom="2px solid"
      borderColor="game.pixelBorder"
      gap="3"
      position="sticky"
      top="0"
      zIndex={100}
      role="banner"
    >
      {/* Mobile hamburger */}
      <IconButton
        display={{ base: 'flex', md: 'none' }}
        aria-label="Toggle navigation"
        title="Toggle navigation"
        variant="ghost"
        size="sm"
        color="whiteAlpha.800"
        onClick={onToggleSidebar}
      >
        <FiMenu />
      </IconButton>

      {/* Logo */}
      <Text
        {...pixelFontProps}
        fontSize={{ base: '10px', md: '14px' }}
        color="aspire.600"
        cursor="pointer"
        userSelect="none"
        whiteSpace="nowrap"
        onClick={() => navigate('/')}
        title="Go to homepage"
        role="button"
        tabIndex={0}
        aria-label="Aspire Learn homepage"
      >
        Aspire Learn
      </Text>

      <Box flexGrow={1} />

      {/* Right section */}
      <Flex align="center" gap="3">
        {isAuthenticated ? (
          <>
            <Box data-tour="xp-bar">
              <XPProgressBar />
            </Box>

            {loginStreakDays > 0 && (
              <Text {...pixelFontProps} fontSize="10px" color="game.streak" whiteSpace="nowrap">
                🔥 {loginStreakDays}
              </Text>
            )}

            {/* Sound effects toggle */}
            <IconButton
              data-testid="sound-toggle"
              aria-label="Toggle sound effects"
              title={soundEnabled ? "Disable sound effects" : "Enable sound effects"}
              variant="ghost"
              size="sm"
              color="whiteAlpha.800"
              _hover={{ bg: 'whiteAlpha.200' }}
              onClick={toggleSound}
            >
              <Text fontSize="sm">{soundEnabled ? '🔊' : '🔇'}</Text>
            </IconButton>

            {/* Theme toggle */}
            <IconButton
              data-testid="theme-toggle"
              aria-label="Toggle color mode"
              title={colorMode === 'dark' ? "Switch to light mode" : "Switch to dark mode"}
              variant="ghost"
              size="sm"
              color="whiteAlpha.800"
              _hover={{ bg: 'whiteAlpha.200' }}
              onClick={toggleColorMode}
            >
              {colorMode === 'dark' ? <FiSun /> : <FiMoon />}
            </IconButton>

            {/* Avatar with dropdown menu */}
            <Box position="relative" ref={menuRef}>
              <Flex
                as="button"
                align="center"
                justify="center"
                w="32px"
                h="32px"
                borderRadius="full"
                bg="aspire.600"
                color="white"
                fontWeight="bold"
                fontSize="sm"
                cursor="pointer"
                _hover={{ bg: 'aspire.700' }}
                onClick={() => setMenuOpen((v) => !v)}
                aria-label="User menu"
                title="Open user menu"
              >
                {(user?.displayName ?? user?.username ?? '?').charAt(0).toUpperCase()}
              </Flex>

              {menuOpen && (
                <>
                  <Box
                    position="fixed"
                    inset="0"
                    zIndex={199}
                    onClick={() => setMenuOpen(false)}
                  />
                  <Box
                    position="absolute"
                    right="0"
                    top="40px"
                    bg="dark.sidebar"
                    border="2px solid"
                    borderColor="game.pixelBorder"
                    borderRadius="md"
                    boxShadow="lg"
                    zIndex={200}
                    minW="180px"
                    py="2"
                  >
                    <Box px="3" pb="2" borderBottom="1px solid" borderColor="game.pixelBorder">
                      <Text fontWeight="600" fontSize="sm" color="whiteAlpha.900">
                        {user?.displayName ?? user?.username}
                      </Text>
                      <Text
                        fontSize="xs"
                        color="aspire.500"
                        {...pixelFontProps}
                        mt="1"
                      >
                        {user?.currentRank}
                      </Text>
                    </Box>
                    <Flex
                      as="button"
                      align="center"
                      gap="2"
                      w="100%"
                      px="3"
                      py="2"
                      fontSize="sm"
                      bg="transparent"
                      border="none"
                      cursor="pointer"
                      color="whiteAlpha.900"
                      _hover={{ bg: 'whiteAlpha.100' }}
                      onClick={() => {
                        setMenuOpen(false);
                        navigate('/profile');
                      }}
                      title="Go to profile"
                      aria-label="Go to profile"
                    >
                      <FiUser /> Profile
                    </Flex>
                    <Flex
                      as="button"
                      align="center"
                      gap="2"
                      w="100%"
                      px="3"
                      py="2"
                      fontSize="sm"
                      bg="transparent"
                      border="none"
                      cursor="pointer"
                      color="whiteAlpha.900"
                      _hover={{ bg: 'whiteAlpha.100' }}
                      onClick={() => {
                        setMenuOpen(false);
                        navigate('/settings');
                      }}
                      title="Go to settings"
                      aria-label="Go to settings"
                    >
                      <FiSettings /> Settings
                    </Flex>
                    <Flex
                      as="button"
                      align="center"
                      gap="2"
                      w="100%"
                      px="3"
                      py="2"
                      fontSize="sm"
                      bg="transparent"
                      border="none"
                      cursor="pointer"
                      color="game.error"
                      _hover={{ bg: 'whiteAlpha.100' }}
                      onClick={handleLogout}
                      title="Log out"
                      aria-label="Log out"
                    >
                      <FiLogOut /> Log Out
                    </Flex>
                  </Box>
                </>
              )}
            </Box>
          </>
        ) : (
          <>
            {/* Theme toggle for anonymous users */}
            <IconButton
              aria-label="Toggle color mode"
              title={colorMode === 'dark' ? "Switch to light mode" : "Switch to dark mode"}
              variant="ghost"
              size="sm"
              color="whiteAlpha.800"
              _hover={{ bg: 'whiteAlpha.200' }}
              onClick={toggleColorMode}
            >
              {colorMode === 'dark' ? <FiSun /> : <FiMoon />}
            </IconButton>

            <Button
              asChild
              variant="ghost"
              size="sm"
              color="whiteAlpha.800"
              _hover={{ bg: 'whiteAlpha.200' }}
              title="Go to login page"
            >
              <RouterLink to="/login">Log In</RouterLink>
            </Button>
            <Button
              asChild
              size="sm"
              bg="aspire.600"
              color="white"
              _hover={{ bg: 'aspire.500' }}
              title="Go to registration page"
            >
              <RouterLink to="/register">Sign Up</RouterLink>
            </Button>
          </>
        )}
      </Flex>
    </Flex>
  );
}
