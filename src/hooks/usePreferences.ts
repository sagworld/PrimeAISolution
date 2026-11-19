import { explanationLanguage } from '@/shared/utils/appUtils'
import { APPEARANCE_STORAGE_KEY, UI_LANGUAGE_STORAGE_KEY } from '@/shared/data/initialStore'
import type { LabAppState } from '@/hooks/useLabState'
import type { AppearanceSettings } from '@/shared/types'
import type { UiLanguage } from '@/i18n'

export function usePreferences(state: LabAppState) {
  const { setAppearance, setUiLanguage, setAiLanguage, setToast, t } = state

  const updateAppearance = (next: AppearanceSettings) => {
    setAppearance(next)
    try {
      localStorage.setItem(APPEARANCE_STORAGE_KEY, JSON.stringify(next))
    } catch (error) {
      console.error('Unable to save appearance preferences.', error)
      setToast(t('Could not save appearance settings.'))
    }
  }

  const changeUiLanguage = (language: UiLanguage) => {
    setUiLanguage(language)
    setAiLanguage(explanationLanguage(language))
    try {
      localStorage.setItem(UI_LANGUAGE_STORAGE_KEY, language)
    } catch (error) {
      console.error('Unable to save the language preference.', error)
      setToast(t('Could not save language preference.'))
    }
  }

  return { updateAppearance, changeUiLanguage }
}
