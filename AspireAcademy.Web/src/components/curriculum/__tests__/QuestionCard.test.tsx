import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ChakraProvider } from '@chakra-ui/react'
import { system } from '../../../theme/aspireTheme'
import QuestionCard from '../QuestionCard'
import type { QuizQuestion, QuizOption } from '../../../pages/QuizPage'

function renderCard(
  question: QuizQuestion,
  selected: string | string[] | null = null,
  onChange = vi.fn(),
) {
  return {
    onChange,
    ...render(
      <ChakraProvider value={system}>
        <QuestionCard
          question={question}
          selectedAnswer={selected}
          onAnswerChange={onChange}
          disabled={false}
        />
      </ChakraProvider>,
    ),
  }
}

const mcQuestion: QuizQuestion = {
  id: 'q1',
  text: 'What is 2 + 2?',
  questionType: 'multiple-choice',
  options: [
    { id: 'a', text: '3' },
    { id: 'b', text: '4' },
    { id: 'c', text: '5' },
  ],
  points: 10,
}

const msQuestion: QuizQuestion = {
  id: 'q2',
  text: 'Select all prime numbers',
  questionType: 'multi-select',
  options: [
    { id: 'a', text: '2' },
    { id: 'b', text: '4' },
    { id: 'c', text: '5' },
    { id: 'd', text: '9' },
  ],
  points: 10,
}

const fibQuestion: QuizQuestion = {
  id: 'q3',
  text: 'The keyword to declare a variable is ___',
  questionType: 'fill-in-blank',
  points: 10,
}

describe('QuestionCard', () => {
  it('renders multiple-choice with radio buttons', () => {
    renderCard(mcQuestion)

    expect(screen.getByText('What is 2 + 2?')).toBeInTheDocument()
    const radios = screen.getAllByRole('radio')
    expect(radios).toHaveLength(3)
    expect(screen.getByText('3')).toBeInTheDocument()
    expect(screen.getByText('4')).toBeInTheDocument()
    expect(screen.getByText('5')).toBeInTheDocument()
  })

  it('renders multi-select with checkboxes', () => {
    renderCard(msQuestion)

    expect(screen.getByText('Select all prime numbers')).toBeInTheDocument()
    expect(screen.getByText('Select all that apply')).toBeInTheDocument()
    const checkboxes = screen.getAllByRole('checkbox')
    expect(checkboxes).toHaveLength(4)
  })

  it('renders fill-in-blank with input', () => {
    renderCard(fibQuestion)

    expect(screen.getByText(/The keyword to declare a variable is/)).toBeInTheDocument()
    expect(screen.getByPlaceholderText('Your answer...')).toBeInTheDocument()
  })

  it('calls onChange with option id when a multiple-choice option is selected', async () => {
    const onChange = vi.fn()
    renderCard(mcQuestion, null, onChange)

    const user = userEvent.setup()
    await user.click(screen.getByText('4'))
    expect(onChange).toHaveBeenCalledWith('b')
  })

  it('calls onChange when fill-in-blank input changes', () => {
    const onChange = vi.fn()
    renderCard(fibQuestion, null, onChange)

    const input = screen.getByPlaceholderText('Your answer...')
    fireEvent.change(input, { target: { value: 'var' } })
    expect(onChange).toHaveBeenCalledWith('var')
  })
})
