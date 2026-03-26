import { useState, type FormEvent } from 'react';
import { Box, Flex, Text, Input, Button, Spinner } from '@chakra-ui/react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';
import { useGamificationStore } from '../store/gamificationStore';
import api from '../services/apiClient';
import { retroCardProps, pixelFontProps } from '../theme/aspireTheme';
import type { AuthResponse } from '../types';

export default function LoginPage() {
  const navigate = useNavigate();
  const setAuth = useAuthStore((s) => s.setAuth);
  const syncFromServer = useGamificationStore((s) => s.syncFromServer);

  const [usernameOrEmail, setUsernameOrEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const { data } = await api.post<AuthResponse>('/auth/login', {
        usernameOrEmail,
        password,
      });
      setAuth(data.token, data.user);
      syncFromServer({
        totalXp: data.user.totalXp,
        currentLevel: data.user.currentLevel,
        currentRank: data.user.currentRank,
        weeklyXp: 0,
        loginStreakDays: data.user.loginStreakDays,
      });
      navigate('/dashboard');
    } catch (err: unknown) {
      console.error('[LoginPage] Login failed:', err);
      const axiosErr = err as { response?: { data?: { error?: string; message?: string } } };
      const msg =
        axiosErr?.response?.data?.error ??
        axiosErr?.response?.data?.message ??
        'Login failed. Please check your credentials.';
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Flex
      minH="100vh"
      align="center"
      justify="center"
      bgGradient="linear-gradient(135deg, var(--chakra-colors-aspire-900) 0%, var(--chakra-colors-aspire-600) 100%)"
      p="4"
    >
      <Box
        w="100%"
        maxW="420px"
        bg="dark.card"
        px="8"
        py="10"
        {...retroCardProps}
        boxShadow="6px 6px 0 #2B1260"
        borderColor="aspire.600"
      >
        {/* Pixel art title */}
        <Text
          {...pixelFontProps}
          fontSize="18px"
          color="aspire.600"
          textAlign="center"
          mb="1"
        >
          Aspire Academy
        </Text>
        <Text textAlign="center" color="dark.muted" mb="6" fontSize="sm">
          Welcome back, adventurer!
        </Text>

        {/* Error message */}
        {error && (
          <Box
            bg="rgba(209, 52, 56, 0.15)"
            border="2px solid"
            borderColor="game.error"
            borderRadius="sm"
            px="3"
            py="2"
            mb="4"
          >
            <Text color="game.error" fontSize="sm">
              {error}
            </Text>
          </Box>
        )}

        <form onSubmit={handleSubmit}>
          <Flex direction="column" gap="4">
            {/* Username / Email */}
            <Box>
              <Text as="label" htmlFor="login-user" fontSize="sm" fontWeight="600" mb="1" display="block" color="dark.text">
                Username or Email <Text as="span" color="game.error">*</Text>
              </Text>
              <Input
                id="login-user"
                value={usernameOrEmail}
                onChange={(e) => setUsernameOrEmail(e.target.value)}
                placeholder="hero@aspire.dev"
                autoComplete="username"
                required
                size="md"
                bg="dark.surface"
                borderColor="game.pixelBorder"
                color="dark.text"
                _placeholder={{ color: 'dark.muted' }}
                _focus={{ borderColor: 'aspire.600', boxShadow: '0 0 0 1px var(--chakra-colors-aspire-600)' }}
              />
            </Box>

            {/* Password */}
            <Box>
              <Text as="label" htmlFor="login-pass" fontSize="sm" fontWeight="600" mb="1" display="block" color="dark.text">
                Password <Text as="span" color="game.error">*</Text>
              </Text>
              <Input
                id="login-pass"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                autoComplete="current-password"
                required
                size="md"
                bg="dark.surface"
                borderColor="game.pixelBorder"
                color="dark.text"
                _placeholder={{ color: 'dark.muted' }}
                _focus={{ borderColor: 'aspire.600', boxShadow: '0 0 0 1px var(--chakra-colors-aspire-600)' }}
              />
            </Box>

            {/* Submit */}
            <Button
              type="submit"
              disabled={loading}
              bg="game.xpGold"
              color="game.retroBg"
              fontWeight="bold"
              border="3px solid"
              borderColor="game.pixelBorder"
              borderRadius="sm"
              boxShadow="3px 3px 0 #2B1260"
              _hover={{ bg: '#FFE44D' }}
              _active={{ boxShadow: '1px 1px 0 #2B1260', transform: 'translate(2px, 2px)' }}
              size="md"
              w="100%"
              mt="2"
            >
              {loading ? <Spinner size="sm" /> : 'Log In'}
            </Button>
          </Flex>
        </form>

        <Text textAlign="center" mt="5" fontSize="sm" color="dark.muted">
          Don&apos;t have an account?{' '}
          <Link to="/register" style={{ color: '#9185D1', fontWeight: 600 }}>
            Register
          </Link>
        </Text>
      </Box>
    </Flex>
  );
}
