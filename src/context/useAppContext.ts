import { useContext } from 'react'
import { AppContextValue } from '@/context/AppContextValue'

export function useAppContext() {
  const context = useContext(AppContextValue)
  if (!context) throw new Error('useAppContext must be used within AppProvider')
  return context
}
