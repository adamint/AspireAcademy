import { useState, useCallback, useEffect } from 'react';
import { Outlet } from 'react-router-dom';
import { Flex, Box } from '@chakra-ui/react';
import { TopBar } from './TopBar';
import { Sidebar } from './Sidebar';
import { ErrorBoundary } from '../common/ErrorBoundary';
import DailyRewardPopup from '../gamification/DailyRewardPopup';
import { SearchPalette } from '../SearchPalette';
import { useSearchStore } from '../../store/searchStore';

export function AppShell() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const setSearchOpen = useSearchStore((s) => s.setOpen);

  // Global Cmd+K / Ctrl+K keyboard shortcut
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setSearchOpen(true);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [setSearchOpen]);

  const toggleSidebar = useCallback(() => setSidebarOpen((v) => !v), []);
  const closeSidebar = useCallback(() => setSidebarOpen(false), []);

  return (
    <Flex direction="column" h="100vh" overflow="hidden">
      <TopBar onToggleSidebar={toggleSidebar} />
      <DailyRewardPopup />
      <SearchPalette />
      <Flex flexGrow={1} overflow="hidden">
        <Sidebar open={sidebarOpen} onClose={closeSidebar} />
        <Box
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
