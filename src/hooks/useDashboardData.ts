import { useMemo } from 'react'
import { dateLocale } from '@/i18n'
import type { LabAppState } from '@/hooks/useLabState'
import { getLabTechnician, getSampleCollector, getTest } from '@/shared/utils/appUtils'

export function useDashboardData(state: LabAppState) {
  const { store, search, orderStatusFilter, uiLanguage, t } = state

  const filteredPatients = useMemo(() => {
    const term = search.trim().toLowerCase()
    if (!term) return store.patients
    return store.patients.filter((patient) =>
      [patient.id, patient.name, patient.phone, getLabTechnician(store, patient.labTechnicianId), getSampleCollector(store, patient.sampleCollectorId)]
        .some((value) => value.toLowerCase().includes(term)),
    )
  }, [search, store])

  const filteredOrders = useMemo(() => {
    const term = search.trim().toLowerCase()
    return store.orders.filter((order) => {
      const patient = store.patients.find((item) => item.id === order.patientId)
      const test = getTest(store, order.testId)
      const matchesSearch = !term || [order.id, patient?.name ?? '', patient?.id ?? '', test?.name ?? ''].some((value) => value.toLowerCase().includes(term))
      return matchesSearch && (orderStatusFilter === 'All' || order.status === orderStatusFilter)
    })
  }, [orderStatusFilter, search, store])

  const pendingCount = store.orders.filter((order) => order.status === 'Pending').length
  const todayCount = store.orders.filter((order) => new Date(order.createdAt).toDateString() === new Date().toDateString()).length
  const completedCount = store.orders.filter((order) => order.status === 'Completed').length
  const revenue = store.orders.reduce((sum, order) => sum + (getTest(store, order.testId)?.price ?? 0), 0)
  const weeklyOrders = store.orders.filter((order) => (Date.now() - new Date(order.createdAt).getTime()) / 86400000 < 7)
  const volumeByDay = Array.from({ length: 7 }, (_, index) => {
    const date = new Date()
    date.setDate(date.getDate() - (6 - index))
    return {
      label: new Intl.DateTimeFormat(dateLocale(uiLanguage), { weekday: 'short' }).format(date),
      count: store.orders.filter((order) => new Date(order.createdAt).toDateString() === date.toDateString()).length,
    }
  })
  const maxDailyVolume = Math.max(1, ...volumeByDay.map((day) => day.count))
  const greetingHour = new Date().getHours()
  const greeting = t(greetingHour < 12 ? 'Good morning' : greetingHour < 18 ? 'Good afternoon' : 'Good evening')

  return { filteredPatients, filteredOrders, pendingCount, todayCount, completedCount, revenue, weeklyOrders, volumeByDay, maxDailyVolume, greeting }
}
