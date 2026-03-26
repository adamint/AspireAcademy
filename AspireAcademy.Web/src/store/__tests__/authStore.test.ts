import { describe, it, expect, beforeEach } from 'vitest'
import { useAuthStore } from '../authStore'
import type { User } from '../authStore'

const testUser: User = {
  id: 'u1',
  username: 'hero',
  displayName: 'Hero Dev',
  email: 'hero@aspire.dev',
  avatarUrl: 'https://gravatar.com/avatar/test?d=retro&s=128',
  bio: null,
  currentLevel: 3,
  currentRank: 'apprentice',
  totalXp: 1200,
  loginStreakDays: 5,
  createdAt: '2025-01-01T00:00:00Z',
}

describe('authStore', () => {
  beforeEach(() => {
    useAuthStore.setState({ token: null, user: null })
    localStorage.clear()
  })

  it('setAuth stores token and user', () => {
    useAuthStore.getState().setAuth('tok-123', testUser)
    const { token, user } = useAuthStore.getState()

    expect(token).toBe('tok-123')
    expect(user).toEqual(testUser)
  })

  it('logout clears token and user', () => {
    useAuthStore.getState().setAuth('tok-123', testUser)
    useAuthStore.getState().logout()
    const { token, user } = useAuthStore.getState()

    expect(token).toBeNull()
    expect(user).toBeNull()
  })

  it('updateUser merges partial updates', () => {
    useAuthStore.getState().setAuth('tok-123', testUser)
    useAuthStore.getState().updateUser({ displayName: 'New Name', totalXp: 9999 })
    const user = useAuthStore.getState().user!

    expect(user.displayName).toBe('New Name')
    expect(user.totalXp).toBe(9999)
    // unchanged fields preserved
    expect(user.username).toBe('hero')
    expect(user.email).toBe('hero@aspire.dev')
  })

  it('updateUser is a no-op when no user is set', () => {
    useAuthStore.getState().updateUser({ displayName: 'Ghost' })
    expect(useAuthStore.getState().user).toBeNull()
  })

  it('persists to localStorage under aspire-academy-auth', () => {
    useAuthStore.getState().setAuth('tok-persist', testUser)

    const raw = localStorage.getItem('aspire-academy-auth')
    expect(raw).not.toBeNull()
    const parsed = JSON.parse(raw!)
    expect(parsed.state.token).toBe('tok-persist')
    expect(parsed.state.user.username).toBe('hero')
  })
})
