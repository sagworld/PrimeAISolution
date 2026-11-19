import type { LabAppState } from '@/hooks/useLabState'
import { dateInputValue, getTest, summarizeRevenueByPerson } from '@/shared/utils/appUtils'

export function useRevenueData(state: LabAppState) {
  const { store, revenueFromDate, revenueToDate, t } = state
  const revenueStart = new Date(`${revenueFromDate}T00:00:00`)
  const revenueEnd = new Date(`${revenueToDate}T00:00:00`)
  const revenueStartKey = dateInputValue(revenueStart)
  const revenueEndKey = dateInputValue(revenueEnd)
  const revenueOrders = store.orders.filter((order) => {
    const orderDate = new Date(order.createdAt)
    if (Number.isNaN(orderDate.getTime())) return false
    const orderDateKey = dateInputValue(orderDate)
    return orderDateKey >= revenueStartKey && orderDateKey <= revenueEndKey
  })
  const revenueTotal = revenueOrders.reduce((sum, order) => {
    const price = getTest(store, order.testId)?.price ?? 0
    return sum + (Number.isFinite(price) && price > 0 ? price : 0)
  }, 0)
  const unpricedRevenueOrders = revenueOrders.filter((order) => {
    const price = getTest(store, order.testId)?.price ?? 0
    return !Number.isFinite(price) || price <= 0
  }).length
  const doctorRevenue = summarizeRevenueByPerson(revenueOrders, store, store.referrers, (patient) => patient.referrerId, t('Unassigned'))
  const technicianRevenue = summarizeRevenueByPerson(revenueOrders, store, store.labTechnicians, (patient) => patient.labTechnicianId, t('Unassigned'))
  const collectorRevenue = summarizeRevenueByPerson(revenueOrders, store, store.sampleCollectors, (patient) => patient.sampleCollectorId, t('Unassigned'))
  return { revenueOrders, revenueTotal, unpricedRevenueOrders, doctorRevenue, technicianRevenue, collectorRevenue }
}
