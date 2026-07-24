import type { SkyName } from './types'

export function selectLocalizedName(
  names: SkyName[],
  interfaceLanguage: string,
  defaultLanguage: string,
): string {
  const normalizedInterfaceLanguage = interfaceLanguage.toLowerCase()
  const baseInterfaceLanguage = normalizedInterfaceLanguage.split('-')[0]
  const fallbackLanguages = [
    normalizedInterfaceLanguage,
    baseInterfaceLanguage,
    defaultLanguage.toLowerCase(),
    'en',
  ]
  for (const language of new Set(fallbackLanguages)) {
    const candidates = names.filter((name) => name.language.toLowerCase() === language)
    if (candidates.length > 0) return (candidates.find((name) => name.preferred) ?? candidates[0]).value
  }
  return (names.find((name) => name.preferred) ?? names[0]).value
}
