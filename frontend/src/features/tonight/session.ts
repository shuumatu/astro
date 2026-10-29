import type { TonightRequest, TonightTargetType } from './types'

// Keep a successful plan's settings while navigating this app. No coordinates
// are persisted to disk; a page reload starts a fresh observing session.
export const tonightSession = {
  request: null as TonightRequest | null,
  preset: 'shenzhen',
  filter: 'all' as 'all' | TonightTargetType,
}
