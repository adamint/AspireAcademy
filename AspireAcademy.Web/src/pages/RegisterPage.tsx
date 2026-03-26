import { useState, type FormEvent } from 'react';
import { Box, Flex, Text, Input, Button, Spinner } from '@chakra-ui/react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';
import { useGamificationStore } from '../store/gamificationStore';
import api from '../services/apiClient';
import { retroCardProps, pixelFontProps } from '../theme/aspireTheme';
import type { AuthResponse } from '../types';

interface FormErrors {
  username?: string;
  email?: string;
  password?: string;
  confirmPassword?: string;
}

function FieldError({ message }: { message?: string }) {
  if (!message) return null;
  return (
    <Text fontSize="xs" color="game.error" mt="1">
      {message}
    </Text>
  );
}

export default function RegisterPage() {
  const navigate = useNavigate();
  const setAuth = useAuthStore((s) => s.setAuth);
  const syncFromServer = useGamificationStore((s) => s.syncFromServer);

  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [serverError, setServerError] = useState('');
  const [fieldErrors, setFieldErrors] = useState<FormErrors>({});
  const [loading, setLoading] = useState(false);

  const clearFieldError = (field: keyof FormErrors) => {
    if (fieldErrors[field]) {
      setFieldErrors((prev) => {
        const next = { ...prev };
        delete next[field];
        return next;
      });
    }
  };

  const validate = (): boolean => {
    const errors: FormErrors = {};

    if (username.length < 3 || username.length > 30 || !/^[a-zA-Z0-9_]+$/.test(username)) {
      errors.username = 'Username must be 3-30 alphanumeric characters or underscores.';
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      errors.email = 'Please enter a valid email address.';
    }

    if (password.length < 8 || !/[A-Z]/.test(password) || !/\d/.test(password)) {
      errors.password = 'Password must be 8+ characters with an uppercase letter and a digit.';
    }

    if (password !== confirmPassword) {
      errors.confirmPassword = 'Passwords do not match.';
    }

    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setServerError('');

    if (!validate()) {
      return;
    }

    setLoading(true);

    try {
      const { data } = await api.post<AuthResponse>('/auth/register', {
        username,
        email,
        displayName: displayName || username,
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
      console.error('[RegisterPage] Registration failed:', err);
      const axiosErr = err as { response?: { data?: { error?: string; message?: string } } };
      const msg =
        axiosErr?.response?.data?.error ??
        axiosErr?.response?.data?.message ??
        'Registration failed. Please try again.';
      setServerError(msg);
    } finally {
      setLoading(false);
    }
  };

  const inputStyles = {
    bg: 'dark.surface',
    borderColor: 'game.pixelBorder',
    color: 'dark.text',
    _placeholder: { color: 'dark.muted' },
    _focus: { borderColor: 'aspire.600', boxShadow: '0 0 0 1px var(--chakra-colors-aspire-600)' },
  } as const;

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
        maxW="460px"
        bg="dark.card"
        px="8"
        py="9"
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
          Create your hero account
        </Text>

        {/* Server error */}
        {serverError && (
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
              {serverError}
            </Text>
          </Box>
        )}

        <form onSubmit={handleSubmit}>
          <Flex direction="column" gap="3.5">
            {/* Username */}
            <Box>
              <Text as="label" htmlFor="reg-user" fontSize="sm" fontWeight="600" mb="1" display="block" color="dark.text">
                Username <Text as="span" color="game.error">*</Text>
              </Text>
              <Input
                id="reg-user"
                value={username}
                onChange={(e) => { setUsername(e.target.value); clearFieldError('username'); }}
                placeholder="hero_dev"
                autoComplete="username"
                size="md"
                {...inputStyles}
              />
              <FieldError message={fieldErrors.username} />
            </Box>

            {/* Email */}
            <Box>
              <Text as="label" htmlFor="reg-email" fontSize="sm" fontWeight="600" mb="1" display="block" color="dark.text">
                Email <Text as="span" color="game.error">*</Text>
              </Text>
              <Input
                id="reg-email"
                type="email"
                value={email}
                onChange={(e) => { setEmail(e.target.value); clearFieldError('email'); }}
                placeholder="hero@aspire.dev"
                autoComplete="email"
                size="md"
                {...inputStyles}
              />
              <FieldError message={fieldErrors.email} />
            </Box>

            {/* Display Name */}
            <Box>
              <Text as="label" htmlFor="reg-display" fontSize="sm" fontWeight="600" mb="1" display="block" color="dark.text">
                Display Name
              </Text>
              <Input
                id="reg-display"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                placeholder="Your display name (optional)"
                size="md"
                {...inputStyles}
              />
            </Box>

            {/* Password */}
            <Box>
              <Text as="label" htmlFor="reg-pass" fontSize="sm" fontWeight="600" mb="1" display="block" color="dark.text">
                Password <Text as="span" color="game.error">*</Text>
              </Text>
              <Input
                id="reg-pass"
                type="password"
                value={password}
                onChange={(e) => { setPassword(e.target.value); clearFieldError('password'); }}
                placeholder="••••••••"
                autoComplete="new-password"
                size="md"
                {...inputStyles}
              />
              <FieldError message={fieldErrors.password} />
            </Box>

            {/* Confirm Password */}
            <Box>
              <Text as="label" htmlFor="reg-confirm" fontSize="sm" fontWeight="600" mb="1" display="block" color="dark.text">
                Confirm Password <Text as="span" color="game.error">*</Text>
              </Text>
              <Input
                id="reg-confirm"
                type="password"
                value={confirmPassword}
                onChange={(e) => { setConfirmPassword(e.target.value); clearFieldError('confirmPassword'); }}
                placeholder="••••••••"
                autoComplete="new-password"
                size="md"
                {...inputStyles}
              />
              <FieldError message={fieldErrors.confirmPassword} />
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
              {loading ? <Spinner size="sm" /> : 'Create Account'}
            </Button>
          </Flex>
        </form>

        <Text textAlign="center" mt="5" fontSize="sm" color="dark.muted">
          Already have an account?{' '}
          <Link to="/login" style={{ color: '#9185D1', fontWeight: 600 }}>
            Log In
          </Link>
        </Text>
      </Box>
    </Flex>
  );
}
