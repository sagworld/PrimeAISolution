import { useEffect, useState, useSyncExternalStore } from 'react'
import { useAppContext } from '@/context/useAppContext'
import { storeExpenditureService } from '@/features/store-expenditure/services/storeExpenditureService'

export function useStoreExpenditureData() {
  const { section } = useAppContext()
  const data = useSyncExternalStore(
    storeExpenditureService.subscribe,
    storeExpenditureService.getSnapshot,
    storeExpenditureService.getSnapshot,
  )
  const [isLoading, setIsLoading] = useState(!storeExpenditureService.isLoaded())
  const [error, setError] = useState('')

  useEffect(() => {
    if (storeExpenditureService.isLoaded() && section !== 'store-expenditure') {
      setIsLoading(false)
      return
    }
    let active = true
    setIsLoading(true)
    setError('')
    void storeExpenditureService.load(section === 'store-expenditure')
      .catch((loadError: unknown) => {
        if (active) setError(loadError instanceof Error ? loadError.message : 'Unable to load inventory data.')
      })
      .finally(() => {
        if (active) setIsLoading(false)
      })
    return () => {
      active = false
    }
  }, [section])

  return { data, isLoading, error }
}
