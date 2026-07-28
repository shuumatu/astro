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

export function selectInterfaceLanguageName(
  names: SkyName[],
  interfaceLanguage: string,
): string | undefined {
  const normalizedInterfaceLanguage = interfaceLanguage.toLowerCase()
  const baseInterfaceLanguage = normalizedInterfaceLanguage.split('-')[0]
  for (const language of new Set([normalizedInterfaceLanguage, baseInterfaceLanguage])) {
    const candidates = names.filter((name) => name.language.toLowerCase() === language)
    if (candidates.length > 0) return (candidates.find((name) => name.preferred) ?? candidates[0]).value
  }
  return undefined
}

export function selectStarLabelName(
  names: SkyName[],
  interfaceLanguage: string,
): string | undefined {
  const localizedName = selectInterfaceLanguageName(names, interfaceLanguage)
  if (localizedName) return localizedName
  for (const type of ['bayer', 'flamsteed'] as const) {
    const candidates = names.filter((name) => name.type === type)
    if (candidates.length > 0) return (candidates.find((name) => name.preferred) ?? candidates[0]).value
  }
  return undefined
}
