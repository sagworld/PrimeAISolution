import type { ReactNode } from 'react'
import { useLabApp } from '@/hooks/useLabApp'
import { AppContextValue } from '@/context/AppContextValue'

export function AppProvider({ children }: { children: ReactNode }) {
  const value = useLabApp()
  return <AppContextValue.Provider value={value}>{children}</AppContextValue.Provider>
}
