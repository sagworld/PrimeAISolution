import type { LabAppState } from '@/hooks/useLabState'

export function useReportCollection(state: LabAppState) {
  const { store, reportPeriod } = state
  const filteredReports = store.orders.filter((order) => {
    const orderDate = new Date(order.createdAt)
    const start = new Date()
    start.setHours(0, 0, 0, 0)
    if (reportPeriod === 'Daily') return orderDate >= start
    if (reportPeriod === 'Weekly') {
      start.setDate(start.getDate() - ((start.getDay() + 6) % 7))
      return orderDate >= start
    }
    start.setDate(1)
    return orderDate >= start
  })
  return { filteredReports }
}
