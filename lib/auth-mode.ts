const LOCAL_MODE_KEY = 'workout-logger:local-mode'

export function isLocalModeEnabled(): boolean {
  try {
    return window.localStorage.getItem(LOCAL_MODE_KEY) === '1'
  } catch {
    // Private browsing or blocked storage: treat as not chosen.
    return false
  }
}

export function enableLocalMode(): void {
  try {
    window.localStorage.setItem(LOCAL_MODE_KEY, '1')
  } catch {
    // Local mode still works for this tab even if the choice cannot be remembered.
  }
}

export function clearLocalMode(): void {
  try {
    window.localStorage.removeItem(LOCAL_MODE_KEY)
  } catch {
    // Nothing to clear if storage is unavailable.
  }
}
