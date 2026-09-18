export function readSessionCache<T>(key: string): T | undefined {
  if (typeof window === 'undefined') return undefined
  try {
    const raw = window.sessionStorage.getItem(key)
    if (!raw) return undefined
    const parsed = JSON.parse(raw)
    return parsed?.data as T | undefined
  } catch {
    return undefined
  }
}

export function writeSessionCache<T>(key: string, data: T) {
  if (typeof window === 'undefined') return
  try {
    window.sessionStorage.setItem(key, JSON.stringify({ savedAt: Date.now(), data }))
  } catch {
    // Session cache is an optional performance enhancement.
  }
}
