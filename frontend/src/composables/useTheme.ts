import { onScopeDispose, ref } from 'vue'

type Theme = 'dark' | 'light'

const storageKey = 'astro-theme'
const themeColors: Record<Theme, string> = { dark: '#090e1b', light: '#f5f6fa' }

function parseTheme(value: string | null): Theme | null {
  return value === 'dark' || value === 'light' ? value : null
}

function readPreference(): Theme | null {
  try {
    return parseTheme(window.localStorage.getItem(storageKey))
  } catch {
    return null
  }
}

export function useTheme() {
  let systemPreference: MediaQueryList | undefined
  try {
    systemPreference = window.matchMedia?.('(prefers-color-scheme: light)')
  } catch {
    // A restricted browser can still use an explicit theme or the dark fallback.
  }

  let explicitPreference = readPreference()
  const systemTheme = (): Theme => systemPreference?.matches ? 'light' : 'dark'
  const theme = ref<Theme>(explicitPreference ?? systemTheme())

  function applyTheme(nextTheme: Theme) {
    theme.value = nextTheme
    document.documentElement.dataset.theme = nextTheme
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', themeColors[nextTheme])
  }

  function toggleTheme() {
    explicitPreference = theme.value === 'dark' ? 'light' : 'dark'
    applyTheme(explicitPreference)
    try {
      window.localStorage.setItem(storageKey, explicitPreference)
    } catch {
      // The choice remains active for this session when storage is unavailable.
    }
  }

  function handleSystemChange(event: MediaQueryListEvent) {
    if (explicitPreference === null) applyTheme(event.matches ? 'light' : 'dark')
  }

  function handleStorage(event: StorageEvent) {
    if (event.key !== storageKey && event.key !== null) return
    try {
      if (event.storageArea && event.storageArea !== window.localStorage) return
    } catch {
      return
    }
    explicitPreference = parseTheme(event.newValue)
    applyTheme(explicitPreference ?? systemTheme())
  }

  applyTheme(theme.value)
  if (systemPreference?.addEventListener) {
    systemPreference.addEventListener('change', handleSystemChange)
  } else {
    systemPreference?.addListener(handleSystemChange)
  }
  window.addEventListener('storage', handleStorage)

  onScopeDispose(() => {
    if (systemPreference?.removeEventListener) {
      systemPreference.removeEventListener('change', handleSystemChange)
    } else {
      systemPreference?.removeListener(handleSystemChange)
    }
    window.removeEventListener('storage', handleStorage)
  })

  return { theme, toggleTheme }
}
