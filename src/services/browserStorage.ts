import type { UiLanguage } from '@/i18n'
import type { AppearanceSettings } from '@/shared/types'
import { APPEARANCE_STORAGE_KEY, UI_LANGUAGE_STORAGE_KEY } from '@/shared/data/initialStore'

export function readUiLanguage(): UiLanguage {
  try {
    const saved = localStorage.getItem(UI_LANGUAGE_STORAGE_KEY)
    if (saved === 'en' || saved === 'mr' || saved === 'hi') return saved
  } catch (error) {
    console.error('Unable to load the saved language preference.', error)
  }
  return 'en'
}

export function readAppearance(): AppearanceSettings {
  try {
    const saved = localStorage.getItem(APPEARANCE_STORAGE_KEY)
    if (saved) {
      const parsed: unknown = JSON.parse(saved)
      if (typeof parsed === 'object' && parsed !== null && 'mode' in parsed && 'accent' in parsed) {
        const settings = parsed as { mode: unknown; accent: unknown }
        return {
          mode: settings.mode === 'dark' ? 'dark' : 'light',
          accent: settings.accent === 'blue' || settings.accent === 'violet' || settings.accent === 'rose' ? settings.accent : 'mint',
        }
      }
    }
  } catch (error) {
    console.error('Unable to load appearance preferences.', error)
  }
  return { mode: 'light', accent: 'mint' }
}
