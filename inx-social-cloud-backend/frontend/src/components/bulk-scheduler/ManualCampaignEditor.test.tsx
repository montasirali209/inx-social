import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { ManualCampaignEditor, type CampaignImport } from './ManualCampaignEditor'

const emptyCampaign: CampaignImport = { id: 'manual-campaign', title: 'Manual campaign', source: 'manual', textPosts: 0, imagePosts: 0, total: 0, orderMode: 'custom', posts: [] }

function baseProps() {
  return {
    aiCaptionBusy: false,
    aiCaptioningIds: new Set<string>(),
    aiCaptionMessage: '',
    onClose: vi.fn(),
    onGenerateAICaptions: vi.fn(),
    onMediaAdd: vi.fn(),
    onOrderModeChange: vi.fn(),
    onPostEdit: vi.fn(),
    onPostMove: vi.fn(),
    onPostRemove: vi.fn(),
    onTextAdd: vi.fn(),
    onTitleChange: vi.fn(),
    running: false,
  }
}

describe('ManualCampaignEditor', () => {
  it('splits pasted posts at two empty lines and allows alternating order', () => {
    const props = baseProps()
    render(<ManualCampaignEditor campaign={emptyCampaign} {...props} />)

    fireEvent.change(screen.getByLabelText('Paste text posts'), { target: { value: 'First paragraph\n\nSecond paragraph\n\n\nAnother post' } })
    expect(screen.getByText('2 posts detected')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Add 2 text posts' }))
    expect(props.onTextAdd).toHaveBeenCalledWith(['First paragraph\n\nSecond paragraph', 'Another post'])
    fireEvent.click(screen.getByLabelText('Alternate · text first'))
    expect(props.onOrderModeChange).toHaveBeenCalledWith('alternate_text')
  })

  it('offers AI captions only for empty image captions and keeps the button beside media upload', () => {
    const props = baseProps()
    const campaign: CampaignImport = {
      ...emptyCampaign,
      imagePosts: 2,
      total: 2,
      posts: [
        { id: 'image-post-0001', sequence: 1, contentType: 'IMAGE', caption: '', thumbnailUrl: 'blob:one', fileName: 'one.png' },
        { id: 'image-post-0002', sequence: 2, contentType: 'IMAGE', caption: 'Already written', thumbnailUrl: 'blob:two', fileName: 'two.png' },
      ],
    }
    render(<ManualCampaignEditor campaign={campaign} {...props} />)

    expect(screen.getByRole('button', { name: 'Add images or videos' })).toBeInTheDocument()
    const aiButton = screen.getByRole('button', { name: 'AI captions · 1 empty' })
    expect(aiButton).toBeEnabled()
    fireEvent.click(aiButton)
    expect(props.onGenerateAICaptions).toHaveBeenCalledTimes(1)
    expect(screen.getByText(/existing captions are never replaced/i)).toBeInTheDocument()
  })
})
