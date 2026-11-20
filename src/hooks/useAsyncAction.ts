import { useCallback, useRef, useState } from 'react'

export function useAsyncAction<TArgs extends unknown[], TResult>(
  action: (...args: TArgs) => Promise<TResult>,
) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<Error | null>(null)
  const [data, setData] = useState<TResult | null>(null)
  const pendingCount = useRef(0)
  const latestRequest = useRef(0)

  const execute = useCallback(async (...args: TArgs): Promise<TResult> => {
    const requestId = latestRequest.current + 1
    latestRequest.current = requestId
    pendingCount.current += 1
    setLoading(true)
    setError(null)
    try {
      const result = await action(...args)
      if (requestId === latestRequest.current) setData(result)
      return result
    } catch (reason) {
      const actionError = reason instanceof Error ? reason : new Error('The request could not be completed.')
      if (requestId === latestRequest.current) setError(actionError)
      throw actionError
    } finally {
      pendingCount.current -= 1
      setLoading(pendingCount.current > 0)
    }
  }, [action])

  const clearError = useCallback(() => setError(null), [])

  return { data, error, loading, execute, clearError }
}
