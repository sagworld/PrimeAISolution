import { dateLocale } from '@/i18n'
import type { LabAppState } from '@/hooks/useLabState'
import { dateInputValue, getTest, summarizeRevenueByPerson } from '@/shared/utils/appUtils'

export function useRevenueData(state: LabAppState) {
  const { store, revenueDate, revenuePeriod, uiLanguage, t } = state
  const revenueAnchor = new Date(`${revenueDate}T00:00:00`)
  const revenueStart = new Date(revenueAnchor)
  const revenueEnd = new Date(revenueAnchor)
  if (revenuePeriod === 'Weekly') {
    revenueStart.setDate(revenueStart.getDate() - ((revenueStart.getDay() + 6) % 7))
    revenueEnd.setTime(revenueStart.getTime())
    revenueEnd.setDate(revenueEnd.getDate() + 6)
  } else if (revenuePeriod === 'Monthly') {
    revenueStart.setDate(1)
    revenueEnd.setMonth(revenueEnd.getMonth() + 1, 0)
  }
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
  const revenueByDay = Array.from({ length: revenuePeriod === 'Daily' ? 1 : revenuePeriod === 'Weekly' ? 7 : revenueEnd.getDate() }, (_, index) => {
    const date = new Date(revenueStart)
    date.setDate(date.getDate() + index)
    const dateKey = dateInputValue(date)
    const orders = revenueOrders.filter((order) => dateInputValue(new Date(order.createdAt)) === dateKey)
    const amount = orders.reduce((sum, order) => {
      const price = getTest(store, order.testId)?.price ?? 0
      return sum + (Number.isFinite(price) && price > 0 ? price : 0)
    }, 0)
    return { date, orders: orders.length, amount }
  })
  const doctorRevenue = summarizeRevenueByPerson(revenueOrders, store, store.referrers, (patient) => patient.referrerId, t('Unassigned'))
  const technicianRevenue = summarizeRevenueByPerson(revenueOrders, store, store.labTechnicians, (patient) => patient.labTechnicianId, t('Unassigned'))
  const collectorRevenue = summarizeRevenueByPerson(revenueOrders, store, store.sampleCollectors, (patient) => patient.sampleCollectorId, t('Unassigned'))
  const revenueDateFormatter = new Intl.DateTimeFormat(dateLocale(uiLanguage), { day: '2-digit', month: 'short', year: 'numeric' })
  const revenueRangeLabel = revenuePeriod === 'Daily'
    ? revenueDateFormatter.format(revenueStart)
    : `${revenueDateFormatter.format(revenueStart)} – ${revenueDateFormatter.format(revenueEnd)}`

  return { revenueOrders, revenueTotal, unpricedRevenueOrders, revenueByDay, doctorRevenue, technicianRevenue, collectorRevenue, revenueRangeLabel }
}
