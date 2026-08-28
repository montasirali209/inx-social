import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { Button } from './Button'

describe('Button', () => {
  it('renders a labelled, disabled control', () => {
    render(<Button disabled>Publish post</Button>)
    expect(screen.getByRole('button', { name: 'Publish post' })).toBeDisabled()
  })
})
