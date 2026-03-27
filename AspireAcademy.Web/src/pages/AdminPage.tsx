import { useState, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Box,
  Flex,
  Text,
  Heading,
  Card,
  SimpleGrid,
  Button,
  Input,
  Table,
  Badge,
  Spinner,
} from '@chakra-ui/react';
import { FiUsers, FiActivity, FiStar, FiZap, FiGlobe, FiLayers, FiBookOpen, FiTrash2, FiRefreshCw, FiDatabase } from 'react-icons/fi';
import { retroCardProps, pixelFontProps } from '../theme/aspireTheme';
import api from '../services/apiClient';
import { formatDate } from '../utils/formatters';

interface AdminStats {
  totalUsers: number;
  totalLessonsCompleted: number;
  totalXpEarned: number;
  activeUsers: number;
  worldsCount: number;
  modulesCount: number;
  lessonsCount: number;
}

interface AdminUser {
  id: string;
  username: string;
  email: string;
  displayName: string;
  level: number;
  totalXp: number;
  lastLoginAt: string | null;
  createdAt: string;
}

interface AdminUsersResponse {
  users: AdminUser[];
  totalCount: number;
  page: number;
  pageSize: number;
}

export default function AdminPage() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [actionMessage, setActionMessage] = useState<{ text: string; isError: boolean } | null>(null);

  const showMessage = useCallback((text: string, isError = false) => {
    setActionMessage({ text, isError });
    setTimeout(() => setActionMessage(null), 5000);
  }, []);

  // Stats query
  const { data: stats, isLoading: statsLoading } = useQuery<AdminStats>({
    queryKey: ['admin-stats'],
    queryFn: () => api.get('/admin/stats').then((r) => r.data).catch((err) => {
      console.error('[AdminPage] Failed to fetch admin stats:', err);
      throw err;
    }),
  });

  // Users query
  const { data: usersData, isLoading: usersLoading } = useQuery<AdminUsersResponse>({
    queryKey: ['admin-users', page, search],
    queryFn: () =>
      api.get('/admin/users', { params: { page, pageSize: 20, search: search || undefined } }).then((r) => r.data).catch((err) => {
        console.error('[AdminPage] Failed to fetch admin users:', err);
        throw err;
      }),
  });

  // Mutations
  const reloadCurriculum = useMutation({
    mutationFn: () => api.post('/admin/reload-curriculum'),
    onSuccess: () => {
      showMessage('Curriculum reloaded successfully!');
      queryClient.invalidateQueries({ queryKey: ['admin-stats'] });
    },
    onError: (err) => { console.error('[AdminPage] Failed to reload curriculum:', err); showMessage('Failed to reload curriculum.', true); },
  });

  const flushDb = useMutation({
    mutationFn: () => api.post('/admin/flush-db'),
    onSuccess: () => {
      showMessage('Database flushed and curriculum reloaded!');
      queryClient.invalidateQueries({ queryKey: ['admin-stats'] });
      queryClient.invalidateQueries({ queryKey: ['admin-users'] });
    },
    onError: (err) => { console.error('[AdminPage] Failed to flush database:', err); showMessage('Failed to flush database.', true); },
  });

  const deleteUser = useMutation({
    mutationFn: (userId: string) => api.delete(`/admin/users/${userId}`),
    onSuccess: () => {
      showMessage('User deleted.');
      queryClient.invalidateQueries({ queryKey: ['admin-users'] });
      queryClient.invalidateQueries({ queryKey: ['admin-stats'] });
    },
    onError: (err) => { console.error('[AdminPage] Failed to delete user:', err); showMessage('Failed to delete user.', true); },
  });

  const seedTestData = useMutation({
    mutationFn: () => api.post('/admin/seed-test-data'),
    onSuccess: () => {
      showMessage('Test data seeded!');
      queryClient.invalidateQueries({ queryKey: ['admin-users'] });
      queryClient.invalidateQueries({ queryKey: ['admin-stats'] });
    },
    onError: (err) => { console.error('[AdminPage] Failed to seed test data:', err); showMessage('Failed to seed test data.', true); },
  });

  const totalPages = usersData ? Math.ceil(usersData.totalCount / usersData.pageSize) : 1;

  return (
    <Box maxW="1200px" mx="auto" p="6" display="flex" flexDirection="column" gap="6">
      {/* Header */}
      <Flex justify="space-between" align="center" flexWrap="wrap" gap="3">
        <Heading as="h1" size="2xl" color="dark.text">
          🛡️ Admin Dashboard
        </Heading>
        <Badge {...pixelFontProps} fontSize="2xs" colorPalette="red" variant="solid" px="3" py="1">
          ADMIN
        </Badge>
      </Flex>

      {/* Action message toast */}
      <Box role="status" aria-live="polite" aria-atomic="true">
        {actionMessage && (
          <Card.Root
            variant="outline"
            {...retroCardProps}
            borderColor={actionMessage.isError ? 'game.error' : 'game.success'}
            bg={actionMessage.isError ? 'red.900' : 'green.900'}
          >
            <Card.Body p="3">
              <Text fontSize="sm" color="white">
                {actionMessage.isError ? '❌' : '✅'} {actionMessage.text}
              </Text>
            </Card.Body>
          </Card.Root>
        )}
      </Box>

      {/* Stats Cards */}
      {statsLoading ? (
        <Flex justify="center" p="8" role="status" aria-label="Loading statistics">
          <Spinner size="lg" color="aspire.600" aria-hidden="true" />
        </Flex>
      ) : stats ? (
        <SimpleGrid columns={{ base: 1, sm: 2, lg: 4 }} gap="4">
          <StatCard icon={<FiUsers size={20} />} label="Total Users" value={stats.totalUsers} color="aspire.500" />
          <StatCard icon={<FiActivity size={20} />} label="Lessons Completed" value={stats.totalLessonsCompleted} color="game.success" />
          <StatCard icon={<FiStar size={20} />} label="Total XP Earned" value={stats.totalXpEarned} color="game.xpGold" />
          <StatCard icon={<FiZap size={20} />} label="Active Users (7d)" value={stats.activeUsers} color="game.streak" />
          <StatCard icon={<FiGlobe size={20} />} label="Worlds" value={stats.worldsCount} color="aspire.400" />
          <StatCard icon={<FiLayers size={20} />} label="Modules" value={stats.modulesCount} color="aspire.400" />
          <StatCard icon={<FiBookOpen size={20} />} label="Lessons" value={stats.lessonsCount} color="aspire.400" />
        </SimpleGrid>
      ) : null}

      {/* Admin Actions */}
      <Card.Root variant="outline" {...retroCardProps} bg="game.retroBg">
        <Card.Body p="5" display="flex" flexDirection="column" gap="4">
          <Text {...pixelFontProps} fontSize="xs" color="aspire.300">
            Admin Actions
          </Text>
          <Flex gap="3" flexWrap="wrap">
            <Button
              colorPalette="purple"
              size="sm"
              onClick={() => reloadCurriculum.mutate()}
              disabled={reloadCurriculum.isPending}
            >
              <FiRefreshCw />
              {reloadCurriculum.isPending ? 'Reloading…' : 'Reload Curriculum'}
            </Button>
            <Button
              colorPalette="red"
              size="sm"
              onClick={() => {
                if (window.confirm('⚠️ This will DROP all tables, recreate the schema, and reload curriculum. All user data will be lost. Continue?')) {
                  flushDb.mutate();
                }
              }}
              disabled={flushDb.isPending}
            >
              <FiDatabase />
              {flushDb.isPending ? 'Flushing…' : 'Flush Database'}
            </Button>
            <Button
              colorPalette="green"
              size="sm"
              onClick={() => seedTestData.mutate()}
              disabled={seedTestData.isPending}
            >
              {seedTestData.isPending ? 'Seeding…' : '🌱 Seed Test Data'}
            </Button>
          </Flex>
        </Card.Body>
      </Card.Root>

      {/* Users Table */}
      <Card.Root variant="outline" {...retroCardProps} bg="game.retroBg">
        <Card.Body p="5" display="flex" flexDirection="column" gap="4">
          <Flex justify="space-between" align="center" flexWrap="wrap" gap="3">
            <Text {...pixelFontProps} fontSize="xs" color="aspire.300">
              Users ({usersData?.totalCount ?? 0})
            </Text>
            <Input
              placeholder="Search users…"
              size="sm"
              maxW="250px"
              bg="dark.surface"
              color="dark.text"
              borderColor="dark.border"
              _placeholder={{ color: 'dark.muted' }}
              aria-label="Search users by username, email, or display name"
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
            />
          </Flex>

          {usersLoading ? (
            <Flex justify="center" p="6" role="status" aria-label="Loading users">
              <Spinner size="md" color="aspire.500" aria-hidden="true" />
            </Flex>
          ) : (
            <>
              <Box overflowX="auto">
                <Table.Root size="sm">
                  <Table.Header>
                    <Table.Row>
                      <Table.ColumnHeader color="aspire.400" fontSize="xs">Username</Table.ColumnHeader>
                      <Table.ColumnHeader color="aspire.400" fontSize="xs">Email</Table.ColumnHeader>
                      <Table.ColumnHeader color="aspire.400" fontSize="xs">Level</Table.ColumnHeader>
                      <Table.ColumnHeader color="aspire.400" fontSize="xs">XP</Table.ColumnHeader>
                      <Table.ColumnHeader color="aspire.400" fontSize="xs">Last Login</Table.ColumnHeader>
                      <Table.ColumnHeader color="aspire.400" fontSize="xs">Joined</Table.ColumnHeader>
                      <Table.ColumnHeader color="aspire.400" fontSize="xs"></Table.ColumnHeader>
                    </Table.Row>
                  </Table.Header>
                  <Table.Body>
                    {usersData?.users.map((user) => (
                      <Table.Row key={user.id} _hover={{ bg: 'content.hover' }}>
                        <Table.Cell color="dark.text" fontSize="sm" fontWeight="600">
                          {user.username}
                        </Table.Cell>
                        <Table.Cell color="dark.muted" fontSize="xs">
                          {user.email}
                        </Table.Cell>
                        <Table.Cell>
                          <Badge {...pixelFontProps} fontSize="2xs" colorPalette="purple" variant="solid">
                            Lv.{user.level}
                          </Badge>
                        </Table.Cell>
                        <Table.Cell>
                          <Text fontSize="xs" color="game.xpGold" fontWeight="600">
                            {user.totalXp.toLocaleString()} XP
                          </Text>
                        </Table.Cell>
                        <Table.Cell color="dark.muted" fontSize="xs">
                          {formatDate(user.lastLoginAt)}
                        </Table.Cell>
                        <Table.Cell color="dark.muted" fontSize="xs">
                          {formatDate(user.createdAt)}
                        </Table.Cell>
                        <Table.Cell>
                          <Button
                            size="xs"
                            colorPalette="red"
                            variant="ghost"
                            aria-label={`Delete user ${user.username}`}
                            onClick={() => {
                              if (window.confirm(`Delete user "${user.username}"? This cannot be undone.`)) {
                                deleteUser.mutate(user.id);
                              }
                            }}
                            disabled={deleteUser.isPending}
                          >
                            <FiTrash2 />
                          </Button>
                        </Table.Cell>
                      </Table.Row>
                    ))}
                    {usersData?.users.length === 0 && (
                      <Table.Row>
                        <Table.Cell colSpan={7}>
                          <Text textAlign="center" color="dark.muted" py="4" fontSize="sm">
                            No users found.
                          </Text>
                        </Table.Cell>
                      </Table.Row>
                    )}
                  </Table.Body>
                </Table.Root>
              </Box>

              {/* Pagination */}
              {totalPages > 1 && (
                <Flex justify="center" gap="2" pt="2">
                  <Button
                    size="xs"
                    variant="ghost"
                    color="dark.muted"
                    disabled={page <= 1}
                    onClick={() => setPage((p) => p - 1)}
                  >
                    ← Prev
                  </Button>
                  <Text fontSize="xs" color="dark.muted" alignSelf="center">
                    Page {page} of {totalPages}
                  </Text>
                  <Button
                    size="xs"
                    variant="ghost"
                    color="dark.muted"
                    disabled={page >= totalPages}
                    onClick={() => setPage((p) => p + 1)}
                  >
                    Next →
                  </Button>
                </Flex>
              )}
            </>
          )}
        </Card.Body>
      </Card.Root>
    </Box>
  );
}

function StatCard({
  icon,
  label,
  value,
  color,
}: {
  icon: React.ReactNode;
  label: string;
  value: number;
  color: string;
}) {
  return (
    <Card.Root variant="outline" {...retroCardProps} bg="game.retroBg">
      <Card.Body p="4">
        <Flex align="center" gap="3">
          <Box color={color}>{icon}</Box>
          <Box>
            <Text fontSize="xs" color="aspire.300" mb="1">
              {label}
            </Text>
            <Text {...pixelFontProps} fontSize="xs" color={color}>
              {value.toLocaleString()}
            </Text>
          </Box>
        </Flex>
      </Card.Body>
    </Card.Root>
  );
}
