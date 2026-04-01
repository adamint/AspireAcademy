import { useState, useCallback, useEffect } from 'react';
import { Outlet } from 'react-router-dom';
import { Flex, Box } from '@chakra-ui/react';
import { TopBar } from './TopBar';
import { Sidebar } from './Sidebar';
import { GuidedTour } from './GuidedTour';
import { ErrorBoundary } from '../common/ErrorBoundary';
import DailyRewardPopup from '../gamification/DailyRewardPopup';
import { useAuthStore } from '../../store/authStore';
import { useGamificationStore } from '../../store/gamificationStore';
import api from '../../services/apiClient';

export function AppShell() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const token = useAuthStore((s) => s.token);
  const syncFromServer = useGamificationStore((s) => s.syncFromServer);

  // Hydrate gamification state from server on mount (handles page reloads)
  useEffect(() => {
    if (!token) return;
    api.get('/xp').then((res) => {
      const d = res.data as { totalXp: number; currentLevel: number; currentRank: string; weeklyXp: number; loginStreakDays: number };
      syncFromServer({
        totalXp: d.totalXp,
        currentLevel: d.currentLevel,
        currentRank: d.currentRank,
        weeklyXp: d.weeklyXp,
        loginStreakDays: d.loginStreakDays,
      });
    }).catch((err) => {
      console.error('[AppShell] Failed to fetch XP stats:', err);
    });
  }, [token, syncFromServer]);

  const toggleSidebar = useCallback(() => setSidebarOpen((v) => !v), []);
  const closeSidebar = useCallback(() => setSidebarOpen(false), []);

  return (
    <Flex direction="column" h="100vh" overflow="hidden">
      <a href="#main-content" className="skip-to-main">Skip to main content</a>
      <TopBar onToggleSidebar={toggleSidebar} />
      <DailyRewardPopup />
      <GuidedTour />
      <Flex flexGrow={1} overflow="hidden">
        <Sidebar open={sidebarOpen} onClose={closeSidebar} />
        <Box
          id="main-content"
          as="main"
          flexGrow={1}
          overflowY="auto"
          p={{ base: '3', md: '6' }}
          maxH="calc(100vh - 56px)"
          bg="dark.bg"
        >
          <ErrorBoundary>
            <Outlet />
          </ErrorBoundary>
        </Box>
      </Flex>
    </Flex>
  );
}
