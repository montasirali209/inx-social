import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { ManualCampaignEditor, type CampaignImport } from './ManualCampaignEditor'

const emptyCampaign: CampaignImport = { id: 'manual', title: 'Manual campaign', source: 'manual', textPosts: 0, imagePosts: 0, total: 0, orderMode: 'custom', posts: [] }

describe('ManualCampaignEditor', () => {
  it('splits pasted posts at two empty lines and allows alternating order', () => {
    const onTextAdd = vi.fn()
    const onOrderModeChange = vi.fn()
    render(<ManualCampaignEditor campaign={emptyCampaign} onClose={vi.fn()} onMediaAdd={vi.fn()} onOrderModeChange={onOrderModeChange} onPostEdit={vi.fn()} onPostMove={vi.fn()} onPostRemove={vi.fn()} onTextAdd={onTextAdd} onTitleChange={vi.fn()} running={false} />)

    fireEvent.change(screen.getByLabelText('Paste text posts'), { target: { value: 'First paragraph\n\nSecond paragraph\n\n\nAnother post' } })
    expect(screen.getByText('2 posts detected')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Add 2 text posts' }))
    expect(onTextAdd).toHaveBeenCalledWith(['First paragraph\n\nSecond paragraph', 'Another post'])
    fireEvent.click(screen.getByLabelText('Alternate · text first'))
    expect(onOrderModeChange).toHaveBeenCalledWith('alternate_text')
  })
})
