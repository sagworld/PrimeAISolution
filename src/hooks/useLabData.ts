import { useCallback, useEffect, useRef } from 'react'
import type { AuthenticatedUser } from '@/services/authService'
import { loadLabStore } from '@/services/labService'
import { getLabSettings } from '@/services/labSettingsService'
import { emptyLabProfile, emptyStore } from '@/shared/data/emptyStore'
import type { LabAppState } from '@/hooks/useLabState'

export function useLabData(state: LabAppState, user: AuthenticatedUser | null) {
  const { setStore, setLabProfile, setDataLoading, setDataError } = state
  const requestId = useRef(0)

  const refreshLabData = useCallback(async () => {
    const currentRequestId = ++requestId.current
    if (!user) {
      setStore(emptyStore)
      setLabProfile(emptyLabProfile)
      setDataError('')
      setDataLoading(false)
      return
    }

    setDataLoading(true)
    setDataError('')
    try {
      const [labData, labProfile] = await Promise.all([
        loadLabStore(),
        user.role === 'sample-collector' ? Promise.resolve(emptyLabProfile) : getLabSettings(),
      ])
      if (requestId.current !== currentRequestId) return
      setStore((current) => ({ ...emptyStore, ...labData, attendance: current.attendance }))
      setLabProfile(labProfile)
    } catch (reason) {
      if (requestId.current !== currentRequestId) return
      const message = reason instanceof Error ? reason.message : 'Unable to load lab data.'
      setDataError(message)
    } finally {
      if (requestId.current === currentRequestId) setDataLoading(false)
    }
  }, [setDataError, setDataLoading, setLabProfile, setStore, user])

  useEffect(() => {
    if (user) {
      setStore(emptyStore)
      setLabProfile(emptyLabProfile)
    }
    void refreshLabData()
    return () => { requestId.current += 1 }
  }, [refreshLabData, setLabProfile, setStore, user])

  return { refreshLabData }
}
