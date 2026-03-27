import { useState, useEffect, useCallback } from 'react';
import { useMutation } from '@tanstack/react-query';
import {
  Box, Flex, Text, VStack, Button, Input, Switch, Dialog,
  SegmentGroup, Spinner, Field,
} from '@chakra-ui/react';
import { FiDownload, FiTrash2, FiLock, FiCheck } from 'react-icons/fi';
import api from '../services/apiClient';
import { useAuthStore } from '../store/authStore';
import { useSettingsStore, type EditorFontSize } from '../store/settingsStore';
import { useColorMode } from '../hooks/useColorMode';
import { retroCardProps, pixelFontProps } from '../theme/aspireTheme';

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
  const { colorMode, setColorMode } = useColorMode();
  const logout = useAuthStore((s) => s.logout);

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

  const flashSaved = useCallback(() => {
    setSaved(true);
    const timer = setTimeout(() => setSaved(false), 1500);
    return () => clearTimeout(timer);
  }, []);

  const handleToggle = useCallback(
    (setter: (v: boolean) => void) => (checked: boolean) => {
      setter(checked);
      flashSaved();
    },
    [flashSaved],
  );

  const handleFontSize = useCallback(
    (details: { value: string }) => {
      settings.setEditorFontSize(details.value as EditorFontSize);
      flashSaved();
    },
    [settings, flashSaved],
  );

  // Keep color mode toggle synced through the existing hook
  const handleThemeChange = useCallback(
    (details: { value: string }) => {
      setColorMode(details.value as 'dark' | 'light');
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
      setTimeout(() => setChangePasswordOpen(false), 1500);
    },
    onError: (err) => {
      const axiosErr = err as { response?: { data?: { error?: string } } };
      setPasswordError(axiosErr?.response?.data?.error ?? 'Failed to change password.');
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
      a.download = `aspire-academy-export-${new Date().toISOString().slice(0, 10)}.json`;
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
      const axiosErr = err as { response?: { data?: { error?: string } } };
      setDeleteError(axiosErr?.response?.data?.error ?? 'Failed to delete account.');
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
    if (!changePasswordOpen) {
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setPasswordError(null);
      setPasswordSuccess(false);
    }
  }, [changePasswordOpen]);

  useEffect(() => {
    if (!deleteOpen) {
      setDeleteConfirmation('');
      setDeleteError(null);
    }
  }, [deleteOpen]);

  return (
    <VStack maxW="700px" mx="auto" p={6} gap={6} align="stretch">
      <Text {...pixelFontProps} fontSize="xl" color="dark.text">
        ⚙️ Settings
      </Text>

      {/* ─── Appearance ─── */}
      <Box {...retroCardProps} bg="dark.card" p={5}>
        <Flex justify="space-between" align="center" mb={4}>
          <Text {...pixelFontProps} fontSize="xs" color="dark.text">
            🎨 Appearance
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
                  { value: 'dark', label: '🌙 Dark' },
                  { value: 'light', label: '☀️ Light' },
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
        </VStack>
      </Box>

      {/* ─── Notifications ─── */}
      <Box {...retroCardProps} bg="dark.card" p={5}>
        <Text {...pixelFontProps} fontSize="xs" color="dark.text" mb={4}>
          🔔 Notifications
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
          📚 Learning Preferences
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

      {/* ─── Account ─── */}
      <Box {...retroCardProps} bg="dark.card" p={5}>
        <Text {...pixelFontProps} fontSize="xs" color="dark.text" mb={4}>
          👤 Account
        </Text>
        <VStack align="stretch" gap={3}>
          <Button
            variant="outline"
            size="sm"
            borderColor="game.pixelBorder"
            color="dark.text"
            _hover={{ bg: 'content.hover' }}
            onClick={() => setChangePasswordOpen(true)}
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
          ⚠️ Danger Zone
        </Text>
        <Button
          variant="outline"
          size="sm"
          borderColor="game.error"
          color="game.error"
          _hover={{ bg: 'rgba(209, 52, 56, 0.1)' }}
          onClick={() => setDeleteOpen(true)}
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
              >
                Cancel
              </Button>
              <Button
                colorPalette="purple"
                onClick={handleSubmitPassword}
                disabled={changePasswordMutation.isPending}
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
              >
                Cancel
              </Button>
              <Button
                colorPalette="red"
                onClick={() => deleteMutation.mutate()}
                disabled={deleteConfirmation !== 'DELETE' || deleteMutation.isPending}
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
