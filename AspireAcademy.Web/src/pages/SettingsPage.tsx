import { useState, useEffect, useCallback, useRef } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import {
  Box, Flex, Text, VStack, Button, Input, Switch, Dialog,
  SegmentGroup, Spinner, Field, Card, Badge,
} from '@chakra-ui/react';
import { FiDownload, FiTrash2, FiLock, FiCheck, FiCompass } from 'react-icons/fi';
import api from '../services/apiClient';
import { useAuthStore } from '../store/authStore';
import { useSettingsStore, type EditorFontSize } from '../store/settingsStore';
import { extractErrorMessage } from '../utils/errorHandler';
import { useColorMode } from '../hooks/useColorMode';
import { retroCardProps, pixelFontProps } from '../theme/aspireTheme';
import { resetTour } from '../components/layout/tourUtils';
import type { PersonaSummary } from '../types';

function SettingSwitch({ label, checked, onChange }: {
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <Flex justify="space-between" align="center" py="2">
      <Text color="dark.text" fontSize="sm">{label}</Text>
      <Switch.Root
        checked={checked}
        onCheckedChange={(e) => onChange(e.checked)}
        colorPalette="purple"
      >
        <Switch.HiddenInput />
        <Switch.Control>
          <Switch.Thumb />
        </Switch.Control>
      </Switch.Root>
    </Flex>
  );
}

function SavedIndicator({ visible }: { visible: boolean }) {
  if (!visible) return null;
  return (
    <Flex align="center" gap="1" color="game.success" fontSize="xs">
      <FiCheck /> Saved
    </Flex>
  );
}

export default function SettingsPage() {
  useEffect(() => { document.title = 'Settings | Aspire Learn'; }, []);
  const { colorMode, setColorMode } = useColorMode();
  const logout = useAuthStore((s) => s.logout);
  const user = useAuthStore((s) => s.user);
  const updateUser = useAuthStore((s) => s.updateUser);

  const settings = useSettingsStore();

  const [saved, setSaved] = useState(false);
  const [changePasswordOpen, setChangePasswordOpen] = useState(false);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [passwordSuccess, setPasswordSuccess] = useState(false);

  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteConfirmation, setDeleteConfirmation] = useState('');
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const savedTimerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const passwordCloseTimerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  useEffect(() => {
    return () => {
      if (savedTimerRef.current) clearTimeout(savedTimerRef.current);
      if (passwordCloseTimerRef.current) clearTimeout(passwordCloseTimerRef.current);
    };
  }, []);

  const flashSaved = useCallback(() => {
    setSaved(true);
    if (savedTimerRef.current) clearTimeout(savedTimerRef.current);
    savedTimerRef.current = setTimeout(() => setSaved(false), 1500);
  }, []);

  const handleToggle = useCallback(
    (setter: (v: boolean) => void) => (checked: boolean) => {
      setter(checked);
      flashSaved();
    },
    [flashSaved],
  );

  const handleFontSize = useCallback(
    (details: { value: string | null }) => {
      if (details.value) settings.setEditorFontSize(details.value as EditorFontSize);
      flashSaved();
    },
    [settings, flashSaved],
  );

  // Keep color mode toggle synced through the existing hook
  const handleThemeChange = useCallback(
    (details: { value: string | null }) => {
      if (details.value) setColorMode(details.value as 'dark' | 'light');
      flashSaved();
    },
    [setColorMode, flashSaved],
  );

  const changePasswordMutation = useMutation({
    mutationFn: async () => {
      const { data } = await api.put('/auth/change-password', {
        currentPassword,
        newPassword,
      });
      return data;
    },
    onSuccess: () => {
      setPasswordSuccess(true);
      setPasswordError(null);
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      passwordCloseTimerRef.current = setTimeout(() => setChangePasswordOpen(false), 1500);
    },
    onError: (err) => {
      setPasswordError(extractErrorMessage(err, 'Failed to change password.'));
      setPasswordSuccess(false);
    },
  });

  const exportMutation = useMutation({
    mutationFn: async () => {
      const { data } = await api.get('/settings/export');
      return data;
    },
    onSuccess: (data) => {
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `aspire-learn-export-${new Date().toISOString().slice(0, 10)}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async () => {
      await api.delete('/auth/account', { data: { confirmation: deleteConfirmation } });
    },
    onSuccess: () => {
      logout();
    },
    onError: (err) => {
      setDeleteError(extractErrorMessage(err, 'Failed to delete account.'));
    },
  });

  const handleSubmitPassword = () => {
    setPasswordError(null);
    setPasswordSuccess(false);

    if (!currentPassword || !newPassword) {
      setPasswordError('All fields are required.');
      return;
    }
    if (newPassword !== confirmPassword) {
      setPasswordError('New passwords do not match.');
      return;
    }
    if (newPassword.length < 8) {
      setPasswordError('Password must be at least 8 characters.');
      return;
    }
    changePasswordMutation.mutate();
  };

  // Reset dialog state when closed
  useEffect(() => {
    return () => {
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setPasswordError(null);
      setPasswordSuccess(false);
    };
  }, [changePasswordOpen]);

  useEffect(() => {
    return () => {
      setDeleteConfirmation('');
      setDeleteError(null);
    };
  }, [deleteOpen]);

  return (
    <VStack maxW="700px" mx="auto" p={6} gap={6} align="stretch">
      <Text {...pixelFontProps} fontSize="xl" color="dark.text">
        Settings
      </Text>

      {/* ─── Appearance ─── */}
      <Box {...retroCardProps} bg="dark.card" p={5}>
        <Flex justify="space-between" align="center" mb={4}>
          <Text {...pixelFontProps} fontSize="xs" color="dark.text">
            Appearance
          </Text>
          <SavedIndicator visible={saved} />
        </Flex>

        <VStack align="stretch" gap={3}>
          {/* Theme */}
          <Flex justify="space-between" align="center" py="2">
            <Text color="dark.text" fontSize="sm">Theme</Text>
            <SegmentGroup.Root
              size="sm"
              value={colorMode}
              onValueChange={handleThemeChange}
            >
              <SegmentGroup.Indicator />
              <SegmentGroup.Items
                items={[
                  { value: 'dark', label: 'Dark' },
                  { value: 'light', label: 'Light' },
                ]}
              />
            </SegmentGroup.Root>
          </Flex>

          {/* Editor font size */}
          <Flex justify="space-between" align="center" py="2">
            <Text color="dark.text" fontSize="sm">Code editor font size</Text>
            <SegmentGroup.Root
              size="sm"
              value={settings.editorFontSize}
              onValueChange={handleFontSize}
            >
              <SegmentGroup.Indicator />
              <SegmentGroup.Items
                items={[
                  { value: 'small', label: 'S' },
                  { value: 'medium', label: 'M' },
                  { value: 'large', label: 'L' },
                ]}
              />
            </SegmentGroup.Root>
          </Flex>

          <SettingSwitch
            label="Animations"
            checked={settings.animationsEnabled}
            onChange={handleToggle(settings.setAnimationsEnabled)}
          />

          {/* Restart tour */}
          <Flex justify="space-between" align="center" py="2">
            <Flex align="center" gap="2">
              <FiCompass size={14} />
              <Text color="dark.text" fontSize="sm">Guided tour</Text>
            </Flex>
            <Button
              size="xs"
              variant="outline"
              borderColor="aspire.600"
              color="aspire.accent"
              _hover={{ bg: 'aspire.200' }}
              fontSize="xs"
              onClick={() => {
                resetTour();
                setSaved(true);
                if (savedTimerRef.current) clearTimeout(savedTimerRef.current);
                savedTimerRef.current = setTimeout(() => setSaved(false), 1500);
              }}
            >
              Restart Tour
            </Button>
          </Flex>
        </VStack>
      </Box>

      {/* ─── Notifications ─── */}
      <Box {...retroCardProps} bg="dark.card" p={5}>
        <Text {...pixelFontProps} fontSize="xs" color="dark.text" mb={4}>
          Notifications
        </Text>
        <VStack align="stretch" gap={1}>
          <SettingSwitch
            label="Achievement notifications"
            checked={settings.achievementNotifications}
            onChange={handleToggle(settings.setAchievementNotifications)}
          />
          <SettingSwitch
            label="Daily reminder"
            checked={settings.dailyReminder}
            onChange={handleToggle(settings.setDailyReminder)}
          />
          <SettingSwitch
            label="Friend activity"
            checked={settings.friendActivity}
            onChange={handleToggle(settings.setFriendActivity)}
          />
        </VStack>
      </Box>

      {/* ─── Learning Preferences ─── */}
      <Box {...retroCardProps} bg="dark.card" p={5}>
        <Text {...pixelFontProps} fontSize="xs" color="dark.text" mb={4}>
          Learning Preferences
        </Text>
        <VStack align="stretch" gap={1}>
          <SettingSwitch
            label="Show hints by default in challenges"
            checked={settings.showHintsByDefault}
            onChange={handleToggle(settings.setShowHintsByDefault)}
          />
          <SettingSwitch
            label="Auto-advance to next lesson on completion"
            checked={settings.autoAdvance}
            onChange={handleToggle(settings.setAutoAdvance)}
          />
          <SettingSwitch
            label="Show line numbers in code editor"
            checked={settings.showLineNumbers}
            onChange={handleToggle(settings.setShowLineNumbers)}
          />
        </VStack>
      </Box>

      {/* ─── Learning Track ─── */}
      <PersonaSettings user={user} updateUser={updateUser} flashSaved={flashSaved} />

      {/* ─── Account ─── */}
      <Box {...retroCardProps} bg="dark.card" p={5}>
        <Text {...pixelFontProps} fontSize="xs" color="dark.text" mb={4}>
          Account
        </Text>
        <VStack align="stretch" gap={3}>
          <Button
            variant="outline"
            size="sm"
            borderColor="game.pixelBorder"
            color="dark.text"
            _hover={{ bg: 'content.hover' }}
            onClick={() => setChangePasswordOpen(true)}
            title="Change your password"
            aria-label="Change your password"
          >
            <FiLock /> Change Password
          </Button>

          <Button
            variant="outline"
            size="sm"
            borderColor="game.pixelBorder"
            color="dark.text"
            _hover={{ bg: 'content.hover' }}
            onClick={() => exportMutation.mutate()}
            disabled={exportMutation.isPending}
            title="Export your account data"
            aria-label="Export your account data"
          >
            {exportMutation.isPending
              ? <><Spinner size="sm" /> Exporting…</>
              : <><FiDownload /> Export My Data</>}
          </Button>
        </VStack>
      </Box>

      {/* ─── Danger Zone ─── */}
      <Box
        {...retroCardProps}
        bg="dark.card"
        p={5}
        borderColor="game.error"
        boxShadow="4px 4px 0 var(--chakra-colors-game-error, #D13438)"
      >
        <Text {...pixelFontProps} fontSize="xs" color="game.error" mb={4}>
          Danger Zone
        </Text>
        <Button
          variant="outline"
          size="sm"
          borderColor="game.error"
          color="game.error"
          _hover={{ bg: 'rgba(209, 52, 56, 0.1)' }}
          onClick={() => setDeleteOpen(true)}
          title="Delete your account"
          aria-label="Delete your account"
        >
          <FiTrash2 /> Delete Account
        </Button>
      </Box>

      {/* ─── Change Password Dialog ─── */}
      <Dialog.Root open={changePasswordOpen} onOpenChange={(e) => setChangePasswordOpen(e.open)}>
        <Dialog.Backdrop />
        <Dialog.Positioner>
          <Dialog.Content bg="dark.card" color="dark.text">
            <Dialog.Header>
              <Dialog.Title color="dark.text">Change Password</Dialog.Title>
            </Dialog.Header>
            <Dialog.Body>
              <VStack gap={4}>
                {passwordError && (
                  <Box w="100%" bg="rgba(209, 52, 56, 0.15)" border="2px solid" borderColor="game.error" borderRadius="sm" px="3" py="2">
                    <Text color="game.error" fontSize="sm">{passwordError}</Text>
                  </Box>
                )}
                {passwordSuccess && (
                  <Box w="100%" bg="rgba(16, 124, 16, 0.15)" border="2px solid" borderColor="game.success" borderRadius="sm" px="3" py="2">
                    <Flex align="center" gap="1">
                      <FiCheck />
                      <Text color="game.success" fontSize="sm">Password changed successfully!</Text>
                    </Flex>
                  </Box>
                )}
                <Field.Root>
                  <Field.Label color="dark.text">Current Password</Field.Label>
                  <Input
                    type="password"
                    value={currentPassword}
                    onChange={(e) => setCurrentPassword(e.target.value)}
                    bg="dark.surface"
                    borderColor="game.pixelBorder"
                    color="dark.text"
                  />
                </Field.Root>
                <Field.Root>
                  <Field.Label color="dark.text">New Password</Field.Label>
                  <Input
                    type="password"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    bg="dark.surface"
                    borderColor="game.pixelBorder"
                    color="dark.text"
                  />
                </Field.Root>
                <Field.Root>
                  <Field.Label color="dark.text">Confirm New Password</Field.Label>
                  <Input
                    type="password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    bg="dark.surface"
                    borderColor="game.pixelBorder"
                    color="dark.text"
                  />
                </Field.Root>
              </VStack>
            </Dialog.Body>
            <Dialog.Footer>
              <Button
                variant="outline"
                mr={3}
                onClick={() => setChangePasswordOpen(false)}
                borderColor="game.pixelBorder"
                color="dark.text"
                title="Cancel password change"
                aria-label="Cancel password change"
              >
                Cancel
              </Button>
              <Button
                colorPalette="purple"
                onClick={handleSubmitPassword}
                disabled={changePasswordMutation.isPending}
                title="Save new password"
                aria-label="Save new password"
              >
                {changePasswordMutation.isPending
                  ? <><Spinner size="sm" /> Saving…</>
                  : 'Change Password'}
              </Button>
            </Dialog.Footer>
          </Dialog.Content>
        </Dialog.Positioner>
      </Dialog.Root>

      {/* ─── Delete Account Dialog ─── */}
      <Dialog.Root open={deleteOpen} onOpenChange={(e) => setDeleteOpen(e.open)}>
        <Dialog.Backdrop />
        <Dialog.Positioner>
          <Dialog.Content bg="dark.card" color="dark.text">
            <Dialog.Header>
              <Dialog.Title color="game.error">Delete Account</Dialog.Title>
            </Dialog.Header>
            <Dialog.Body>
              <VStack gap={4}>
                <Text fontSize="sm" color="dark.text">
                  This action cannot be undone. All your progress, achievements, and data will be permanently removed.
                </Text>
                {deleteError && (
                  <Box w="100%" bg="rgba(209, 52, 56, 0.15)" border="2px solid" borderColor="game.error" borderRadius="sm" px="3" py="2">
                    <Text color="game.error" fontSize="sm">{deleteError}</Text>
                  </Box>
                )}
                <Field.Root>
                  <Field.Label color="dark.text">
                    Type <Text as="span" fontWeight="bold" color="game.error">DELETE</Text> to confirm
                  </Field.Label>
                  <Input
                    value={deleteConfirmation}
                    onChange={(e) => setDeleteConfirmation(e.target.value)}
                    placeholder="DELETE"
                    bg="dark.surface"
                    borderColor="game.error"
                    color="dark.text"
                  />
                </Field.Root>
              </VStack>
            </Dialog.Body>
            <Dialog.Footer>
              <Button
                variant="outline"
                mr={3}
                onClick={() => setDeleteOpen(false)}
                borderColor="game.pixelBorder"
                color="dark.text"
                title="Cancel account deletion"
                aria-label="Cancel account deletion"
              >
                Cancel
              </Button>
              <Button
                colorPalette="red"
                onClick={() => deleteMutation.mutate()}
                disabled={deleteConfirmation !== 'DELETE' || deleteMutation.isPending}
                title="Confirm account deletion"
                aria-label="Confirm account deletion"
              >
                {deleteMutation.isPending
                  ? <><Spinner size="sm" /> Deleting…</>
                  : 'Delete My Account'}
              </Button>
            </Dialog.Footer>
          </Dialog.Content>
        </Dialog.Positioner>
      </Dialog.Root>
    </VStack>
  );
}

function PersonaSettings({ user, updateUser, flashSaved }: {
  user: ReturnType<typeof useAuthStore.getState>['user'];
  updateUser: (updates: Partial<{ persona: string | null }>) => void;
  flashSaved: () => void;
}) {
  const { data: personas } = useQuery<PersonaSummary[]>({
    queryKey: ['personas'],
    queryFn: () => api.get('/personas').then((r) => r.data),
  });

  const selectMutation = useMutation({
    mutationFn: (personaId: string | null) =>
      api.put('/personas/select', { personaId }),
    onSuccess: (_, personaId) => {
      updateUser({ persona: personaId });
      flashSaved();
    },
  });

  return (
    <Box {...retroCardProps} bg="dark.card" p={5}>
      <Text {...pixelFontProps} fontSize="xs" color="dark.text" mb={2}>
        🎯 Learning Track
      </Text>
      <Text color="dark.muted" fontSize="xs" mb={4}>
        Highlights the most relevant lessons for your role. Doesn't hide any content.
      </Text>
      <Flex direction="column" gap="2.5">
        {personas?.map((p) => {
          const isSelected = user?.persona === p.id;
          return (
            <Card.Root
              key={p.id}
              {...retroCardProps}
              cursor="pointer"
              onClick={() =>
                selectMutation.mutate(isSelected ? null : p.id)
              }
              borderColor={isSelected ? p.color : 'game.pixelBorder'}
              borderWidth={isSelected ? '3px' : '2px'}
              bg={isSelected ? 'rgba(107,79,187,0.06)' : 'dark.surface'}
              _hover={{ borderColor: p.color }}
              transition="all 0.15s"
            >
              <Card.Body p="3">
                <Flex align="center" gap="2.5">
                  <Text fontSize="lg">{p.icon}</Text>
                  <Box flex="1">
                    <Flex align="center" gap="2">
                      <Text fontWeight="bold" color="dark.text" fontSize="sm">
                        {p.name}
                      </Text>
                      {isSelected && (
                        <Badge colorPalette="purple" fontSize="2xs" variant="solid">
                          Active
                        </Badge>
                      )}
                    </Flex>
                    <Text color="dark.muted" fontSize="xs">
                      {p.description}
                    </Text>
                  </Box>
                </Flex>
              </Card.Body>
            </Card.Root>
          );
        })}
        {user?.persona && (
          <Button
            variant="ghost"
            color="dark.muted"
            size="xs"
            onClick={() => selectMutation.mutate(null)}
            disabled={selectMutation.isPending}
          >
            Clear track — show everything equally
          </Button>
        )}
      </Flex>
    </Box>
  );
}
