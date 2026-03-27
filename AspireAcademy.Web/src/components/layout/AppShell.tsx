import { useState, useCallback } from 'react';
import { Outlet } from 'react-router-dom';
import { Flex, Box } from '@chakra-ui/react';
import { TopBar } from './TopBar';
import { Sidebar } from './Sidebar';
import { ErrorBoundary } from '../common/ErrorBoundary';
import DailyRewardPopup from '../gamification/DailyRewardPopup';

export function AppShell() {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const toggleSidebar = useCallback(() => setSidebarOpen((v) => !v), []);
  const closeSidebar = useCallback(() => setSidebarOpen(false), []);

  return (
    <Flex direction="column" h="100vh" overflow="hidden">
      <TopBar onToggleSidebar={toggleSidebar} />
      <DailyRewardPopup />
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
