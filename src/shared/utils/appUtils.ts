import { dateLocale } from '@/i18n'
import type { UiLanguage } from '@/i18n'
import type { ExplanationLanguage, LabOrder, Patient, RevenueSummaryRow, Store, TestParameter } from '@/shared/types'

export function makeId(prefix: string) {
  return `${prefix}-${Date.now().toString(36)}`
}

export function nextRecordId(prefix: string, ids: string[], padding: number) {
  const highestId = ids.reduce((highest, id) => {
    const suffix = id.match(/(\d+)$/)?.[1]
    return Math.max(highest, suffix ? Number(suffix) : 0)
  }, 0)
  return `${prefix}${String(highestId + 1).padStart(padding, '0')}`
}

export function explanationLanguage(language: UiLanguage): ExplanationLanguage {
  return language === 'mr' ? 'Marathi' : language === 'hi' ? 'Hindi' : 'English'
}

export function formatDate(value: string, language: UiLanguage = 'en') {
  return new Intl.DateTimeFormat(dateLocale(language), { day: '2-digit', month: 'short', year: 'numeric' }).format(new Date(value))
}

export function getPatientName(store: Store, id: string) {
  return store.patients.find((patient) => patient.id === id)?.name ?? 'Unknown patient'
}

export function getTest(store: Store, id: string) {
  return store.tests.find((test) => test.id === id)
}

export function getTestParameters(store: Store, order: LabOrder): TestParameter[] {
  const test = getTest(store, order.testId)
  return test?.parameters?.length
    ? test.parameters
    : [{ id: test?.id ?? order.testId, name: 'Result', unit: test?.unit ?? '', reference: test?.reference ?? '' }]
}

export function isParameterGroupStart(parameters: TestParameter[], index: number) {
  const parameter = parameters[index]
  const previous = parameters[index - 1]
  if (!parameter?.groupName) return false
  if (parameter.groupId) return parameter.groupId !== previous?.groupId
  return parameter.groupName !== previous?.groupName || Boolean(previous?.groupId)
}

export function getParameterResult(order: LabOrder, parameter: TestParameter) {
  return order.parameterResults?.[parameter.id] ?? (parameter.id === order.testId ? order.result : '')
}

export function getLabTechnician(store: Store, id: string) {
  return store.labTechnicians.find((technician) => technician.id === id)?.name ?? '—'
}

export function getSampleCollector(store: Store, id: string) {
  return store.sampleCollectors.find((collector) => collector.id === id)?.name ?? '—'
}

export function getReferrer(store: Store, id: string) {
  return store.referrers.find((referrer) => referrer.id === id)?.name ?? '—'
}

export function summarizeRevenueByPerson(
  orders: LabOrder[],
  store: Store,
  people: { id: string; name: string }[],
  getPersonId: (patient: Patient) => string,
  unassignedLabel: string,
): RevenueSummaryRow[] {
  const summaries = new Map<string, RevenueSummaryRow>(
    people.map((person) => [person.id, { id: person.id, name: person.name, orders: 0, amount: 0 }]),
  )

  for (const order of orders) {
    const patient = store.patients.find((item) => item.id === order.patientId)
    const personId = patient ? getPersonId(patient) : ''
    const person = people.find((item) => item.id === personId)
    const key = person?.id ?? 'unassigned'
    const summary = summaries.get(key) ?? { id: key, name: unassignedLabel, orders: 0, amount: 0 }
    const price = getTest(store, order.testId)?.price ?? 0
    summary.orders += 1
    summary.amount += Number.isFinite(price) && price > 0 ? price : 0
    summaries.set(key, summary)
  }

  return [...summaries.values()].sort((first, second) => second.amount - first.amount || first.name.localeCompare(second.name))
}

export function formatRevenue(amount: number, language: UiLanguage) {
  return new Intl.NumberFormat(dateLocale(language), {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(amount)
}


export function dateInputValue(date = new Date()) {
  return new Date(date.getTime() - date.getTimezoneOffset() * 60_000).toISOString().slice(0, 10)
}
