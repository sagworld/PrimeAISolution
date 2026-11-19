import { createContext } from 'react'
import { useLabApp } from '@/hooks/useLabApp'

export const AppContextValue = createContext<ReturnType<typeof useLabApp> | null>(null)
