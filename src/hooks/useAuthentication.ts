import { useCallback, useEffect, useState } from 'react'
import { ApiError } from '@/services/apiClient'
import { getCurrentSession, signIn, signOut } from '@/services/authService'
import type { AuthenticatedUser } from '@/services/authService'

function messageFromError(reason: unknown): string {
  return reason instanceof Error ? reason.message : 'The authentication request could not be completed.'
}

export function useAuthentication() {
  const [user, setUser] = useState<AuthenticatedUser | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const checkSession = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const session = await getCurrentSession()
      setUser(session.user)
    } catch (reason) {
      if (reason instanceof ApiError && reason.status === 401) {
        setUser(null)
      } else {
        setError(messageFromError(reason))
      }
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void checkSession()
  }, [checkSession])

  const login = useCallback(async (username: string, password: string) => {
    setLoading(true)
    setError('')
    try {
      const session = await signIn(username, password)
      setUser(session.user)
    } catch (reason) {
      setError(messageFromError(reason))
    } finally {
      setLoading(false)
    }
  }, [])

  const logout = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      await signOut()
      setUser(null)
    } catch (reason) {
      if (reason instanceof ApiError && reason.status === 401) {
        setUser(null)
      } else {
        setError(messageFromError(reason))
      }
    } finally {
      setLoading(false)
    }
  }, [])

  return { user, loading, error, login, logout, checkSession }
}
