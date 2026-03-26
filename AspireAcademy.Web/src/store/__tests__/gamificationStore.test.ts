import { describe, it, expect, beforeEach } from 'vitest'
import { useGamificationStore } from '../gamificationStore'

describe('gamificationStore', () => {
  beforeEach(() => {
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

  it('syncFromServer updates all fields', () => {
    useGamificationStore.getState().syncFromServer({
      totalXp: 2500,
      currentLevel: 5,
      currentRank: 'apprentice',
      weeklyXp: 300,
      loginStreakDays: 7,
    })

    const state = useGamificationStore.getState()
    expect(state.totalXp).toBe(2500)
    expect(state.currentLevel).toBe(5)
    expect(state.currentRank).toBe('apprentice')
    expect(state.weeklyXp).toBe(300)
    expect(state.loginStreakDays).toBe(7)
  })

  it('setPendingLevelUp stores and clears', () => {
    const levelUp = {
      newLevel: 6,
      newRank: 'journeyman',
      previousLevel: 5,
      previousRank: 'apprentice',
    }

    useGamificationStore.getState().setPendingLevelUp(levelUp)
    expect(useGamificationStore.getState().pendingLevelUp).toEqual(levelUp)

    useGamificationStore.getState().setPendingLevelUp(null)
    expect(useGamificationStore.getState().pendingLevelUp).toBeNull()
  })

  it('addPendingAchievement queues achievements', () => {
    const a1 = { id: 'a1', name: 'First Steps', description: 'Complete lesson 1', icon: '🎯', rarity: 'common', xpReward: 50 }
    const a2 = { id: 'a2', name: 'Streak!', description: '3-day streak', icon: '🔥', rarity: 'uncommon', xpReward: 100 }

    useGamificationStore.getState().addPendingAchievement(a1)
    useGamificationStore.getState().addPendingAchievement(a2)

    const pending = useGamificationStore.getState().pendingAchievements
    expect(pending).toHaveLength(2)
    expect(pending[0].id).toBe('a1')
    expect(pending[1].id).toBe('a2')
  })

  it('clearPendingAchievement removes by id', () => {
    const a1 = { id: 'a1', name: 'First Steps', description: 'Done', icon: '🎯', rarity: 'common', xpReward: 50 }
    const a2 = { id: 'a2', name: 'Streak!', description: 'Done', icon: '🔥', rarity: 'uncommon', xpReward: 100 }

    useGamificationStore.getState().addPendingAchievement(a1)
    useGamificationStore.getState().addPendingAchievement(a2)
    useGamificationStore.getState().clearPendingAchievement('a1')

    const pending = useGamificationStore.getState().pendingAchievements
    expect(pending).toHaveLength(1)
    expect(pending[0].id).toBe('a2')
  })

  it('clearPendingAchievement is a no-op for unknown id', () => {
    const a1 = { id: 'a1', name: 'First Steps', description: 'Done', icon: '🎯', rarity: 'common', xpReward: 50 }
    useGamificationStore.getState().addPendingAchievement(a1)
    useGamificationStore.getState().clearPendingAchievement('unknown')

    expect(useGamificationStore.getState().pendingAchievements).toHaveLength(1)
  })
})
