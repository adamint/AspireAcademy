import { describe, it, expect, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter, Routes, Route } from 'react-router-dom'
import { ChakraProvider } from '@chakra-ui/react'
import { system } from '../../../theme/aspireTheme'
import { useAuthStore } from '../../../store/authStore'
import { ProtectedRoute } from '../ProtectedRoute'

function renderWithRoute(initialPath: string) {
  return render(
    <MemoryRouter initialEntries={[initialPath]}>
      <ChakraProvider value={system}>
        <Routes>
          <Route path="/login" element={<div>Login Page</div>} />
          <Route element={<ProtectedRoute />}>
            <Route path="/dashboard" element={<div>Dashboard Content</div>} />
          </Route>
        </Routes>
      </ChakraProvider>
    </MemoryRouter>,
  )
}

describe('ProtectedRoute', () => {
  beforeEach(() => {
    useAuthStore.setState({ token: null, user: null })
  })

  it('redirects to /login when no token', () => {
    renderWithRoute('/dashboard')
    expect(screen.getByText('Login Page')).toBeInTheDocument()
    expect(screen.queryByText('Dashboard Content')).not.toBeInTheDocument()
  })

  it('renders children when authenticated', () => {
    useAuthStore.setState({
      token: 'valid-token',
      user: {
        id: 'u1',
        username: 'hero',
        displayName: 'Hero',
        email: 'hero@aspire.dev',
        avatarBase: 'b',
        avatarAccessories: [],
        avatarBackground: 'bg',
        avatarFrame: 'f',
        bio: null,
        currentLevel: 1,
        currentRank: 'intern',
        totalXp: 0,
        loginStreakDays: 0,
        createdAt: '2025-01-01T00:00:00Z',
      },
    })

    renderWithRoute('/dashboard')
    expect(screen.getByText('Dashboard Content')).toBeInTheDocument()
    expect(screen.queryByText('Login Page')).not.toBeInTheDocument()
  })
})
