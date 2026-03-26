import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { ChakraProvider } from '@chakra-ui/react'
import { system } from '../../theme/aspireTheme'
import { useAuthStore } from '../../store/authStore'
import { useGamificationStore } from '../../store/gamificationStore'
import LoginPage from '../LoginPage'

// Track navigation
const mockNavigate = vi.fn()
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom')
  return { ...actual, useNavigate: () => mockNavigate }
})

// Mock the API client
vi.mock('../../services/apiClient', () => ({
  default: {
    post: vi.fn(),
    interceptors: { request: { use: vi.fn() }, response: { use: vi.fn() } },
  },
}))

import api from '../../services/apiClient'
const mockedApi = vi.mocked(api)

function renderLogin() {
  return render(
    <MemoryRouter initialEntries={['/login']}>
      <ChakraProvider value={system}>
        <LoginPage />
      </ChakraProvider>
    </MemoryRouter>,
  )
}

describe('LoginPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    useAuthStore.setState({ token: null, user: null })
    useGamificationStore.setState({
      totalXp: 0,
      currentLevel: 1,
      currentRank: 'aspire-intern',
      weeklyXp: 0,
      loginStreakDays: 0,
      pendingLevelUp: null,
      pendingAchievements: [],
    })
  })

  it('renders login form with username and password fields', () => {
    renderLogin()

    expect(screen.getByText('Aspire Academy')).toBeInTheDocument()
    expect(screen.getByLabelText(/Username or Email/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/Password/i)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /log in/i })).toBeInTheDocument()
  })

  it('shows error on failed login', async () => {
    mockedApi.post.mockRejectedValueOnce({
      response: { data: { message: 'Invalid credentials' } },
    })

    renderLogin()

    fireEvent.change(screen.getByLabelText(/Username or Email/i), {
      target: { value: 'bad' },
    })
    fireEvent.change(screen.getByLabelText(/Password/i), {
      target: { value: 'wrong' },
    })
    fireEvent.click(screen.getByRole('button', { name: /log in/i }))

    await waitFor(() => {
      expect(screen.getByText('Invalid credentials')).toBeInTheDocument()
    })
  })

  it('navigates to /dashboard on successful login', async () => {
    const fakeUser = {
      id: 'u1',
      username: 'hero',
      displayName: 'Hero',
      email: 'hero@aspire.dev',
      avatarUrl: 'https://gravatar.com/avatar/test?d=retro&s=128',
      bio: null,
      currentLevel: 2,
      currentRank: 'apprentice',
      totalXp: 800,
      loginStreakDays: 3,
      createdAt: '2025-01-01T00:00:00Z',
    }

    mockedApi.post.mockResolvedValueOnce({
      data: { token: 'jwt-abc', user: fakeUser },
    })

    renderLogin()

    fireEvent.change(screen.getByLabelText(/Username or Email/i), {
      target: { value: 'hero' },
    })
    fireEvent.change(screen.getByLabelText(/Password/i), {
      target: { value: 'pass123' },
    })
    fireEvent.click(screen.getByRole('button', { name: /log in/i }))

    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith('/dashboard')
    })

    expect(useAuthStore.getState().token).toBe('jwt-abc')
    expect(useAuthStore.getState().user?.username).toBe('hero')
  })
})
