import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { PostReuseModal } from './PostReuseModal'

describe('PostReuseModal', () => {
  it('keeps the title and footer outside the scrolling results region', () => {
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })
    render(
      <QueryClientProvider client={queryClient}>
        <PostReuseModal
          initialView="scheduled"
          jobs={[]}
          onClose={vi.fn()}
          onReuse={vi.fn()}
          timezone="Europe/London"
        />
      </QueryClientProvider>,
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
