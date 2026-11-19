import type { LabAppState } from '@/hooks/useLabState'
import type { Store } from '@/shared/types'
import { STORAGE_KEY } from '@/shared/data/initialStore'

export function useAppCore(state: LabAppState) {
  const { setStore, setToast, t } = state

  const persist = (next: Store) => {
    setStore(next)
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next))
    } catch (error) {
      console.error('Unable to save lab data in this browser.', error)
      setToast(t('Could not save changes in this browser.'))
    }
  }

  const notify = (message: string) => {
    setToast(t(message))
    window.setTimeout(() => setToast(''), 2600)
  }

  return { persist, notify }
}

export type AppCoreActions = ReturnType<typeof useAppCore>
