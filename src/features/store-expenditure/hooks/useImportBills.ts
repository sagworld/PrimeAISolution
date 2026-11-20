import { useMemo, useState } from 'react'
import { storeExpenditureService } from '@/features/store-expenditure/services/storeExpenditureService'
import type { BillStatusFilter, BillsGroupBy } from '@/features/store-expenditure/types'
import { filterImportBills, getBillTotals, getItemNames, getSuppliers, groupImportBills } from '@/features/store-expenditure/utils'
import { useStoreExpenditureData } from '@/features/store-expenditure/hooks/useStoreExpenditureData'

export function useImportBills() {
  const { data, isLoading, error } = useStoreExpenditureData()
  const [itemName, setItemName] = useState('')
  const [supplierName, setSupplierName] = useState('')
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const [status, setStatus] = useState<BillStatusFilter>('all')
  const [groupBy, setGroupBy] = useState<BillsGroupBy>('none')
  const filteredBills = useMemo(
    () => filterImportBills(data.bills, { itemName, supplierName, from, to, status }),
    [data.bills, itemName, supplierName, from, to, status],
  )

  return {
    bills: filteredBills,
    isLoading,
    error,
    groupedBills: groupBy === 'none' ? [] : groupImportBills(filteredBills, groupBy),
    groupBy,
    setGroupBy,
    filters: { itemName, supplierName, from, to, status },
    setItemName,
    setSupplierName,
    setFrom,
    setTo,
    setStatus,
    clearFilters: () => {
      setItemName('')
      setSupplierName('')
      setFrom('')
      setTo('')
      setStatus('all')
      setGroupBy('none')
    },
    itemNames: getItemNames(data),
    suppliers: getSuppliers(data),
    totals: getBillTotals(filteredBills),
    recordImport: storeExpenditureService.recordImport.bind(storeExpenditureService),
    recordPayment: storeExpenditureService.recordPayment.bind(storeExpenditureService),
  }
}
