import { useCallback } from 'react'
import type { LabAppState } from '@/hooks/useLabState'
import type { Store } from '@/shared/types'
import type { SetStateAction } from 'react'

export function useAppCore(state: LabAppState) {
  const { setStore, setToast, t } = state

  const updateStore = (next: SetStateAction<Store>) => {
    setStore(next)
  }

  const notify = useCallback((message: string) => {
    setToast(t(message))
    window.setTimeout(() => setToast(''), 2600)
  }, [setToast, t])

  return { updateStore, notify }
}

export type AppCoreActions = ReturnType<typeof useAppCore>
