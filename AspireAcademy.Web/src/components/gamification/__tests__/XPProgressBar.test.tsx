import { describe, it, expect, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { ChakraProvider } from '@chakra-ui/react'
import { system } from '../../../theme/aspireTheme'
import { useGamificationStore } from '../../../store/gamificationStore'
import { XPProgressBar } from '../XPProgressBar'

function renderBar() {
  return render(
    <ChakraProvider value={system}>
      <XPProgressBar />
    </ChakraProvider>,
  )
}

describe('XPProgressBar', () => {
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

  it('renders the level number', () => {
    useGamificationStore.setState({ currentLevel: 7 })
    renderBar()
    expect(screen.getByText('Lvl 7')).toBeInTheDocument()
  })

  it('shows correct XP values', () => {
    useGamificationStore.setState({ totalXp: 1250 }) // 1250 % 500 = 250
    renderBar()
    expect(screen.getByText('250/500')).toBeInTheDocument()
  })

  it('progress bar has correct width percentage', () => {
    useGamificationStore.setState({ totalXp: 200 }) // 200/500 = 40%
    renderBar()
    const fill = document.querySelector('.xp-bar-fill') as HTMLElement
    expect(fill).not.toBeNull()
    expect(fill.style.width).toBe('40%')
  })

  it('shows 0/500 when XP is exactly on a level boundary', () => {
    useGamificationStore.setState({ totalXp: 1000, currentLevel: 3 })
    renderBar()
    expect(screen.getByText('0/500')).toBeInTheDocument()
  })
})
