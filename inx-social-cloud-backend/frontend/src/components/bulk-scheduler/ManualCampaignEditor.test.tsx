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
    onMediaMove: vi.fn(),
    onMediaReorder: vi.fn(),
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

    expect(screen.getAllByRole('button', { name: 'Add images or videos' }).at(-1)).toBeInTheDocument()
    const aiButton = screen.getByRole('button', { name: 'AI captions · 1 empty' })
    expect(aiButton).toBeEnabled()
    fireEvent.click(aiButton)
    expect(props.onGenerateAICaptions).toHaveBeenCalledTimes(1)
    expect(screen.getAllByText(/never replaces your existing text/i).length).toBeGreaterThan(0)
  })

  it('reorders media with arrow controls and exposes the preview as the drag handle', () => {
    const props = baseProps()
    const campaign: CampaignImport = {
      ...emptyCampaign,
      imagePosts: 2,
      total: 2,
      posts: [
        { id: 'image-post-0001', sequence: 1, contentType: 'IMAGE', caption: '', thumbnailUrl: 'blob:one', fileName: 'one.png' },
        { id: 'image-post-0002', sequence: 2, contentType: 'IMAGE', caption: '', thumbnailUrl: 'blob:two', fileName: 'two.png' },
      ],
    }
    render(<ManualCampaignEditor campaign={campaign} {...props} />)

    const upButton = screen.getAllByRole('button', { name: 'Move two.png up in media order' }).at(-1)
    expect(upButton).toBeEnabled()
    fireEvent.click(upButton!)
    expect(props.onMediaMove).toHaveBeenCalledWith('image-post-0002', -1)

    const dragHandle = screen.getAllByRole('button', { name: 'Drag two.png to reorder' }).at(-1)
    expect(dragHandle).toHaveAttribute('aria-grabbed', 'false')
    fireEvent.keyDown(dragHandle!, { key: 'ArrowUp' })
    expect(props.onMediaMove).toHaveBeenCalledWith('image-post-0002', -1)
  })

  it('clears drag selection on global pointer up so a dropped item never stays selected', () => {
    const props = baseProps()
    const campaign: CampaignImport = {
      ...emptyCampaign,
      imagePosts: 2,
      total: 2,
      posts: [
        { id: 'image-post-0001', sequence: 1, contentType: 'IMAGE', caption: '', thumbnailUrl: 'blob:one', fileName: 'one.png' },
        { id: 'image-post-0002', sequence: 2, contentType: 'IMAGE', caption: '', thumbnailUrl: 'blob:two', fileName: 'two.png' },
      ],
    }
    render(<ManualCampaignEditor campaign={campaign} {...props} />)

    const dragHandle = screen.getAllByRole('button', { name: 'Drag one.png to reorder' }).at(-1)!
    fireEvent.pointerDown(dragHandle, { pointerId: 7, pointerType: 'mouse', button: 0, clientX: 20, clientY: 20 })
    fireEvent.pointerMove(window, { pointerId: 7, pointerType: 'mouse', clientX: 30, clientY: 36 })
    expect(dragHandle).toHaveAttribute('aria-grabbed', 'true')

    fireEvent.pointerUp(window, { pointerId: 7, pointerType: 'mouse', clientX: 30, clientY: 36 })
    expect(dragHandle).toHaveAttribute('aria-grabbed', 'false')
  })

})
