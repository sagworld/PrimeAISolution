import { useState, useSyncExternalStore } from 'react'
import { storeExpenditureService } from '@/features/store-expenditure/services/storeExpenditureService'
import type { StoreItem } from '@/features/store-expenditure/types'
import { filterInventory, getInventoryRows, hasBillsForItem } from '@/features/store-expenditure/utils'

export function useInventory() {
  const data = useSyncExternalStore(
    storeExpenditureService.subscribe,
    storeExpenditureService.getSnapshot,
    storeExpenditureService.getSnapshot,
  )
  const [search, setSearch] = useState('')
  const [lowStockOnly, setLowStockOnly] = useState(false)
  const items = getInventoryRows(data)

  return {
    items: filterInventory(items, search, lowStockOnly),
    search,
    setSearch,
    lowStockOnly,
    setLowStockOnly,
    addItem: storeExpenditureService.addItem.bind(storeExpenditureService),
    updateItem: storeExpenditureService.updateItem.bind(storeExpenditureService),
    removeItem: storeExpenditureService.removeItem.bind(storeExpenditureService),
    hasBills: (item: StoreItem) => hasBillsForItem(data, item),
  }
}
