import { afterEach, expect, it, vi } from 'vitest'
import { apiRequest } from './api-client'
import { connectPostForMePlatform } from './connections-api'

vi.mock('./api-client', () => ({ apiRequest: vi.fn() }))

afterEach(() => {
  vi.useRealTimers()
  vi.restoreAllMocks()
  vi.mocked(apiRequest).mockReset()
})

it('keeps X authorization pending across an isolated popup and confirms the new provider account', async () => {
  vi.useFakeTimers()
  const popup = { closed: true, focus: vi.fn(), close: vi.fn() } as unknown as Window
  vi.spyOn(window, 'open').mockReturnValue(popup)
  vi.mocked(apiRequest).mockImplementation(async (path) => {
    if (path.endsWith('/start')) return { authorizationUrl: 'https://x.com/i/oauth2/authorize', existingConnectionIds: ['old'] } as never
    return { connections: [{ id: 'old', platform: 'x', status: 'ACTIVE' }, { id: 'new', platform: 'x', status: 'ACTIVE' }] } as never
  })

  const connection = connectPostForMePlatform('x')
  await vi.waitFor(() => expect(window.open).toHaveBeenCalled())
  let finished = false
  void connection.then(() => { finished = true })
  await vi.advanceTimersByTimeAsync(2500)
  expect(finished).toBe(false)
  await vi.advanceTimersByTimeAsync(12_000)
  await expect(connection).resolves.toMatchObject({ ok: true, platform: 'x' })
  expect(popup.close).toHaveBeenCalled()
})
