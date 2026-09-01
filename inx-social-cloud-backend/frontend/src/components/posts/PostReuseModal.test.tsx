import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { PostReuseModal } from './PostReuseModal'

describe('PostReuseModal', () => {
  it('keeps the title and footer outside the scrolling results region', () => {
    render(
      <PostReuseModal
        initialView="scheduled"
        jobs={[]}
        onClose={vi.fn()}
        onReuse={vi.fn()}
      />,
    )

    const dialog = screen.getByRole('dialog', { name: 'Reuse a post' })
    const heading = screen.getByRole('heading', { name: 'Reuse a post' })
    const header = heading.closest('header')
    const footer = dialog.querySelector('footer')

    expect(dialog).toHaveClass('min-h-0')
    expect(header).toHaveClass('shrink-0')
    expect(footer).toHaveClass('shrink-0')
  })
})
