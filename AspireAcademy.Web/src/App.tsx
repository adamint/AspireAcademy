import { lazy, Suspense } from 'react';
import { Routes, Route } from 'react-router-dom';
import { Flex, Spinner, Text } from '@chakra-ui/react';
import { ProtectedRoute } from './components/layout/ProtectedRoute';
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
const AdminPage = lazy(() => import('./pages/AdminPage'));

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
        <Route path="/login" element={<LoginPage />} />
        <Route path="/register" element={<RegisterPage />} />
        <Route element={<ProtectedRoute />}>
          <Route element={<AppShell />}>
            <Route path="/" element={<HomePage />} />
            <Route path="/dashboard" element={<DashboardPage />} />
            <Route path="/worlds/:worldId" element={<ModulePage />} />
            <Route path="/lessons/:lessonId" element={<LessonPage />} />
            <Route path="/challenges/:lessonId" element={<ChallengePage />} />
            <Route path="/quizzes/:lessonId" element={<QuizPage />} />
            <Route path="/profile" element={<ProfilePage />} />
            <Route path="/users/:userId" element={<ProfilePage />} />
            <Route path="/friends" element={<FriendsPage />} />
            <Route path="/leaderboard" element={<LeaderboardPage />} />
            <Route path="/achievements" element={<AchievementsPage />} />
            <Route path="/admin" element={<AdminPage />} />
          </Route>
        </Route>
        <Route path="*" element={<NotFoundPage />} />
      </Routes>
    </Suspense>
  );
}
