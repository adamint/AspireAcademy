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
const PersonaHubPage = lazy(() => import('./pages/PersonaHubPage'));
const PersonaDetailPage = lazy(() => import('./pages/PersonaDetailPage'));

function LazyFallback() {
  return (
    <Flex align="center" justify="center" h="100%" p="12" role="status" aria-label="Loading page">
      <Flex direction="column" align="center" gap="3">
        <Spinner size="lg" color="aspire.600" borderWidth="3px" aria-hidden="true" />
        <Text fontSize="sm" color="aspire.500" fontFamily="pixel">
          Loading...
        </Text>
      </Flex>
    </Flex>
  );
}

export default function App() {
  return (
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/register" element={<RegisterPage />} />
        {/* Public curriculum routes — browsable without auth */}
        <Route element={<AppShell />}>
          <Route path="/dashboard" element={<Suspense fallback={<LazyFallback />}><DashboardPage /></Suspense>} />
          <Route path="/worlds/:worldId" element={<Suspense fallback={<LazyFallback />}><ModulePage /></Suspense>} />
          <Route path="/lessons/:lessonId" element={<Suspense fallback={<LazyFallback />}><LessonPage /></Suspense>} />
          <Route path="/challenges/:lessonId" element={<Suspense fallback={<LazyFallback />}><ChallengePage /></Suspense>} />
          <Route path="/quizzes/:lessonId" element={<Suspense fallback={<LazyFallback />}><QuizPage /></Suspense>} />
          <Route path="/playground" element={<Suspense fallback={<LazyFallback />}><PlaygroundPage /></Suspense>} />
          <Route path="/concept-map" element={<Suspense fallback={<LazyFallback />}><ConceptMapPage /></Suspense>} />
          <Route path="/gallery" element={<Suspense fallback={<LazyFallback />}><GalleryPage /></Suspense>} />
          <Route path="/whats-new" element={<Suspense fallback={<LazyFallback />}><WhatsNewPage /></Suspense>} />
          <Route path="/personas" element={<Suspense fallback={<LazyFallback />}><PersonaHubPage /></Suspense>} />
          <Route path="/personas/:personaId" element={<Suspense fallback={<LazyFallback />}><PersonaDetailPage /></Suspense>} />
          {/* Public leaderboard, achievements, and weekly challenge for discoverability */}
          <Route path="/leaderboard" element={<Suspense fallback={<LazyFallback />}><LeaderboardPage /></Suspense>} />
          <Route path="/achievements" element={<Suspense fallback={<LazyFallback />}><AchievementsPage /></Suspense>} />
          <Route path="/weekly-challenge" element={<Suspense fallback={<LazyFallback />}><WeeklyChallengePage /></Suspense>} />
        </Route>
        {/* Authenticated routes */}
        <Route element={<ProtectedRoute />}>
          <Route element={<AppShell />}>
            <Route path="/profile" element={<Suspense fallback={<LazyFallback />}><ProfilePage /></Suspense>} />
            <Route path="/users/:userId" element={<Suspense fallback={<LazyFallback />}><ProfilePage /></Suspense>} />
            <Route path="/friends" element={<Suspense fallback={<LazyFallback />}><FriendsPage /></Suspense>} />
            <Route path="/certificates" element={<Suspense fallback={<LazyFallback />}><CertificatesPage /></Suspense>} />
            <Route path="/settings" element={<Suspense fallback={<LazyFallback />}><SettingsPage /></Suspense>} />
            <Route path="/admin" element={<AdminRoute><Suspense fallback={<LazyFallback />}><AdminPage /></Suspense></AdminRoute>} />
          </Route>
        </Route>
        <Route path="*" element={<NotFoundPage />} />
      </Routes>
  );
}
