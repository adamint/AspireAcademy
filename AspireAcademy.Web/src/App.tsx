import { lazy, Suspense } from 'react';
import { Routes, Route } from 'react-router-dom';
import { Flex, Spinner, Text } from '@chakra-ui/react';
import { ProtectedRoute } from './components/layout/ProtectedRoute';
import { AdminRoute } from './components/layout/AdminRoute';
import { AppShell } from './components/layout/AppShell';
import LoginPage from './pages/LoginPage';
import RegisterPage from './pages/RegisterPage';
import HomePage from './pages/HomePage';
import NotFoundPage from './pages/NotFoundPage';

const DashboardPage = lazy(() => import('./pages/DashboardPage'));
const ModulePage = lazy(() => import('./pages/ModulePage'));
const LessonPage = lazy(() => import('./pages/LessonPage'));
const ChallengePage = lazy(() => import('./pages/ChallengePage'));
const QuizPage = lazy(() => import('./pages/QuizPage'));
const ProfilePage = lazy(() => import('./pages/ProfilePage'));
const FriendsPage = lazy(() => import('./pages/FriendsPage'));
const LeaderboardPage = lazy(() => import('./pages/LeaderboardPage'));
const AchievementsPage = lazy(() => import('./pages/AchievementsPage'));
const CertificatesPage = lazy(() => import('./pages/CertificatesPage'));
const AdminPage = lazy(() => import('./pages/AdminPage'));
const SettingsPage = lazy(() => import('./pages/SettingsPage'));
const PlaygroundPage = lazy(() => import('./pages/PlaygroundPage'));
const ConceptMapPage = lazy(() => import('./pages/ConceptMapPage'));
const GalleryPage = lazy(() => import('./pages/GalleryPage'));
const WeeklyChallengePage = lazy(() => import('./pages/WeeklyChallengePage'));
const WhatsNewPage = lazy(() => import('./pages/WhatsNewPage'));

function LazyFallback() {
  return (
    <Flex align="center" justify="center" h="100%" p="12">
      <Flex direction="column" align="center" gap="3">
        <Spinner size="lg" color="aspire.600" borderWidth="3px" />
        <Text fontSize="sm" color="aspire.500" fontFamily="pixel">
          Loading...
        </Text>
      </Flex>
    </Flex>
  );
}

export default function App() {
  return (
    <Suspense fallback={<LazyFallback />}>
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/register" element={<RegisterPage />} />
        {/* Public curriculum routes — browsable without auth */}
        <Route element={<AppShell />}>
          <Route path="/dashboard" element={<DashboardPage />} />
          <Route path="/worlds/:worldId" element={<ModulePage />} />
          <Route path="/lessons/:lessonId" element={<LessonPage />} />
          <Route path="/challenges/:lessonId" element={<ChallengePage />} />
          <Route path="/quizzes/:lessonId" element={<QuizPage />} />
          <Route path="/playground" element={<PlaygroundPage />} />
          <Route path="/concept-map" element={<ConceptMapPage />} />
          <Route path="/gallery" element={<GalleryPage />} />
          <Route path="/whats-new" element={<WhatsNewPage />} />
          {/* Public leaderboard, achievements, and weekly challenge for discoverability */}
          <Route path="/leaderboard" element={<LeaderboardPage />} />
          <Route path="/achievements" element={<AchievementsPage />} />
          <Route path="/weekly-challenge" element={<WeeklyChallengePage />} />
        </Route>
        {/* Authenticated routes */}
        <Route element={<ProtectedRoute />}>
          <Route element={<AppShell />}>
            <Route path="/profile" element={<ProfilePage />} />
            <Route path="/users/:userId" element={<ProfilePage />} />
            <Route path="/friends" element={<FriendsPage />} />
            <Route path="/certificates" element={<CertificatesPage />} />
            <Route path="/settings" element={<SettingsPage />} />
            <Route path="/admin" element={<AdminRoute><AdminPage /></AdminRoute>} />
          </Route>
        </Route>
        <Route path="*" element={<NotFoundPage />} />
      </Routes>
    </Suspense>
  );
}
