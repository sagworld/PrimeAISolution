import type {
  AttendanceRecord,
  AttendanceStatus,
  LabOrder,
  LabTechnician,
  LabTest,
  Patient,
  Referrer,
  SampleCollector,
  Store,
  TestParameter,
  TestProfile,
} from '@/shared/types'
import { requestApiJson } from '@/services/apiClient'

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function invalidResponse(): never {
  throw new Error('The server returned invalid lab data.')
}

function readString(value: unknown): string {
  return typeof value === 'string' ? value : invalidResponse()
}

function readNullableString(value: unknown): string {
  return value === null || value === undefined ? '' : readString(value)
}

function readNumber(value: unknown): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : invalidResponse()
}

function readArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : invalidResponse()
}

function parseTechnician(value: unknown): LabTechnician {
  if (!isRecord(value)) return invalidResponse()
  return {
    id: readString(value.id),
    name: readString(value.name),
    specialty: readNullableString(value.specialty),
    phone: readNullableString(value.phone),
  }
}

function parseReferrer(value: unknown): Referrer {
  if (!isRecord(value)) return invalidResponse()
  return {
    id: readString(value.id),
    name: readString(value.name),
    organization: readNullableString(value.organization),
    phone: readNullableString(value.phone),
  }
}

function parseCollector(value: unknown): SampleCollector {
  if (!isRecord(value)) return invalidResponse()
  return {
    id: readString(value.id),
    name: readString(value.name),
    phone: readNullableString(value.phone),
  }
}

function parseMasters(value: unknown): Pick<Store, 'labTechnicians' | 'referrers' | 'sampleCollectors'> {
  if (!isRecord(value)) return invalidResponse()
  return {
    labTechnicians: readArray(value.labTechnicians).map(parseTechnician),
    referrers: readArray(value.referrers).map(parseReferrer),
    sampleCollectors: readArray(value.sampleCollectors).map(parseCollector),
  }
}

function parseTestParameter(value: unknown): TestParameter {
  if (!isRecord(value)) return invalidResponse()
  const groupId = value.groupId
  const groupName = value.groupName
  if (!(groupId === null || groupId === undefined || typeof groupId === 'string') ||
    !(groupName === null || groupName === undefined || typeof groupName === 'string')) {
    return invalidResponse()
  }
  return {
    id: readString(value.id),
    name: readString(value.name),
    unit: readNullableString(value.unit),
    reference: readNullableString(value.reference),
    ...(typeof groupId === 'string' ? { groupId } : {}),
    ...(typeof groupName === 'string' ? { groupName } : {}),
  }
}

function parseTest(value: unknown): LabTest {
  if (!isRecord(value)) return invalidResponse()
  const rawProfiles = value.profiles === undefined
    ? []
    : readArray(value.profiles).map((profile): TestProfile => {
        if (profile === 'preoperative' || profile === 'anc' || profile === 'other') return profile
        return invalidResponse()
      })
  const profiles = rawProfiles.length === 1 && rawProfiles[0] === 'other' ? [] : rawProfiles
  const parameters = value.parameters === undefined ? undefined : readArray(value.parameters).map(parseTestParameter)
  let reagents: LabTest['reagents']
  if (value.reagents !== undefined) {
    reagents = readArray(value.reagents).map((item) => {
      if (!isRecord(item)) return invalidResponse()
      const quantity = readNumber(item.quantity)
      if (quantity <= 0) return invalidResponse()
      return { itemId: readString(item.itemId), quantity }
    })
  }
  const price = value.price === undefined ? undefined : readNumber(value.price)
  return {
    id: readString(value.id),
    name: readString(value.name),
    category: readString(value.category),
    ...(price === undefined ? {} : { price }),
    unit: readNullableString(value.unit),
    reference: readNullableString(value.reference),
    profiles,
    ...(parameters === undefined ? {} : { parameters }),
    ...(reagents === undefined ? {} : { reagents }),
  }
}

function parsePatient(value: unknown): Patient {
  if (!isRecord(value) || typeof value.createdBySampleCollector !== 'boolean') return invalidResponse()
  const age = readNumber(value.age)
  if (!Number.isInteger(age)) return invalidResponse()
  return {
    id: readString(value.id),
    name: readString(value.name),
    age,
    gender: readString(value.gender),
    phone: readString(value.phone),
    labTechnicianId: readNullableString(value.labTechnicianId),
    sampleCollectorId: readNullableString(value.sampleCollectorId),
    referrerId: readNullableString(value.referrerId),
    createdBySampleCollector: value.createdBySampleCollector,
    createdAt: readString(value.createdAt),
  }
}

function parseOrder(value: unknown): LabOrder {
  if (!isRecord(value) || (value.status !== 'Pending' && value.status !== 'Completed')) return invalidResponse()
  if (value.parameterResults !== undefined && !isRecord(value.parameterResults)) return invalidResponse()
  let parameterResults: Record<string, string> | undefined
  if (isRecord(value.parameterResults)) {
    parameterResults = Object.fromEntries(
      Object.entries(value.parameterResults).map(([id, result]) => [id, readString(result)]),
    )
  }
  const reagentsDeductedAt = value.reagentsDeductedAt
  const printedAt = value.printedAt
  if (!(reagentsDeductedAt === null || reagentsDeductedAt === undefined || typeof reagentsDeductedAt === 'string') ||
    !(printedAt === null || printedAt === undefined || typeof printedAt === 'string')) {
    return invalidResponse()
  }
  return {
    id: readString(value.id),
    patientId: readString(value.patientId),
    testId: readString(value.testId),
    createdAt: readString(value.createdAt),
    result: readNullableString(value.result),
    ...(parameterResults === undefined ? {} : { parameterResults }),
    status: value.status,
    ...(typeof reagentsDeductedAt === 'string' ? { reagentsDeductedAt } : {}),
    ...(typeof printedAt === 'string' ? { printedAt } : {}),
  }
}

type Page<T> = { items: T[]; nextOffset: number | null }

function parsePage<T>(value: unknown, key: string, parseItem: (item: unknown) => T): Page<T> {
  if (!isRecord(value) || !isRecord(value.pagination)) return invalidResponse()
  const nextOffset = value.pagination.nextOffset
  if (!(nextOffset === null || (typeof nextOffset === 'number' && Number.isInteger(nextOffset) && nextOffset >= 0))) {
    return invalidResponse()
  }
  return { items: readArray(value[key]).map(parseItem), nextOffset }
}

async function loadPages<T>(
  path: string,
  key: string,
  parseItem: (item: unknown) => T,
): Promise<T[]> {
  const items: T[] = []
  let offset = 0
  for (;;) {
    const page = await requestApiJson(`/api/${path}?limit=100&offset=${offset}`, (value) => parsePage(value, key, parseItem))
    items.push(...page.items)
    if (page.nextOffset === null) return items
    if (page.nextOffset <= offset || page.nextOffset > 10_000) {
      throw new Error('The lab data exceeds the supported result limit. Narrow the data set before continuing.')
    }
    offset = page.nextOffset
  }
}

function parseTests(value: unknown): LabTest[] {
  if (!isRecord(value)) return invalidResponse()
  return readArray(value.tests).map(parseTest)
}

export async function loadLabStore(): Promise<Omit<Store, 'attendance'>> {
  const [masters, patients, tests, orders] = await Promise.all([
    requestApiJson('/api/masters', parseMasters),
    loadPages('patients', 'patients', parsePatient),
    requestApiJson('/api/tests', parseTests),
    loadPages('orders', 'orders', parseOrder),
  ])
  return { ...masters, patients, tests, orders }
}

export function createPatient(input: Omit<Patient, 'id' | 'createdAt' | 'createdBySampleCollector'>): Promise<Patient> {
  return requestApiJson('/api/patients', (value) => {
    if (!isRecord(value)) return invalidResponse()
    return parsePatient(value.patient)
  }, {
    method: 'POST',
    body: input,
  })
}

export function updatePatient(
  id: string,
  input: Omit<Patient, 'id' | 'createdAt' | 'createdBySampleCollector'>,
): Promise<Patient> {
  return requestApiJson(`/api/patients/${encodeURIComponent(id)}`, (value) => {
    if (!isRecord(value)) return invalidResponse()
    return parsePatient(value.patient)
  }, {
    method: 'PATCH',
    body: input,
  })
}

export function createOrders(patientId: string, profile: TestProfile, testIds: string[]): Promise<LabOrder[]> {
  return requestApiJson(`/api/patients/${encodeURIComponent(patientId)}/orders`, (value) => {
    if (!isRecord(value)) return invalidResponse()
    return readArray(value.orders).map(parseOrder)
  }, {
    method: 'POST',
    body: { profile, testIds },
  })
}

export function createMaster(resource: 'lab-technicians', body: Record<string, unknown>): Promise<LabTechnician>
export function createMaster(resource: 'referrers', body: Record<string, unknown>): Promise<Referrer>
export function createMaster(resource: 'sample-collectors', body: Record<string, unknown>): Promise<SampleCollector>
export function createMaster(
  resource: 'lab-technicians' | 'referrers' | 'sample-collectors',
  body: Record<string, unknown>,
): Promise<LabTechnician | Referrer | SampleCollector> {
  return requestApiJson(`/api/masters/${resource}`, (value) => {
    if (!isRecord(value)) return invalidResponse()
    return resource === 'lab-technicians'
      ? parseTechnician(value.record)
      : resource === 'referrers'
        ? parseReferrer(value.record)
        : parseCollector(value.record)
  }, { method: 'POST', body })
}

export function createTest(body: Record<string, unknown>): Promise<LabTest> {
  return requestApiJson('/api/masters/tests', (value) => {
    if (!isRecord(value)) return invalidResponse()
    return parseTest(value.test)
  }, { method: 'POST', body })
}

export function saveOrderResults(
  id: string,
  body: { result: string } | { parameterResults: Record<string, string> },
): Promise<Pick<LabOrder, 'id' | 'result' | 'parameterResults' | 'status' | 'reagentsDeductedAt' | 'printedAt'>> {
  return requestApiJson(`/api/orders/${encodeURIComponent(id)}/results`, (value) => {
    if (!isRecord(value) || !isRecord(value.order)) return invalidResponse()
    const order = value.order
    const status = order.status
    if (status !== 'Pending' && status !== 'Completed') return invalidResponse()
    if (order.parameterResults !== undefined && !isRecord(order.parameterResults)) return invalidResponse()
    const parameterResults = isRecord(order.parameterResults)
      ? Object.fromEntries(Object.entries(order.parameterResults).map(([key, result]) => [key, readString(result)]))
      : undefined
    const reagentsDeductedAt = order.reagentsDeductedAt
    const printedAt = order.printedAt
    if (!(reagentsDeductedAt === null || reagentsDeductedAt === undefined || typeof reagentsDeductedAt === 'string') ||
      !(printedAt === null || printedAt === undefined || typeof printedAt === 'string')) return invalidResponse()
    return {
      id: readString(order.id),
      result: readNullableString(order.result),
      ...(parameterResults === undefined ? {} : { parameterResults }),
      status,
      reagentsDeductedAt: typeof reagentsDeductedAt === 'string' ? reagentsDeductedAt : undefined,
      printedAt: typeof printedAt === 'string' ? printedAt : undefined,
    }
  }, { method: 'PUT', body })
}

export async function markOrdersPrinted(orderIds: string[]): Promise<string> {
  return requestApiJson('/api/orders/print', (value) => {
    if (!isRecord(value)) return invalidResponse()
    return readString(value.printedAt)
  }, { method: 'POST', body: { orderIds } })
}

function parseAttendance(value: unknown): AttendanceRecord {
  if (!isRecord(value) ||
    (value.status !== 'Present' && value.status !== 'Absent' && value.status !== 'Leave')) {
    return invalidResponse()
  }
  return {
    id: readString(value.id),
    labTechnicianId: readString(value.labTechnicianId),
    date: readString(value.date),
    status: value.status,
    updatedAt: readString(value.updatedAt),
  }
}

export function getAttendance(from: string, to: string): Promise<AttendanceRecord[]> {
  return requestApiJson(`/api/attendance?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`, (value) => {
    if (!isRecord(value)) return invalidResponse()
    return readArray(value.records).map(parseAttendance)
  })
}

export function saveAttendance(date: string, statuses: Record<string, AttendanceStatus | ''>): Promise<AttendanceRecord[]> {
  return requestApiJson(`/api/attendance/${encodeURIComponent(date)}`, (value) => {
    if (!isRecord(value)) return invalidResponse()
    return readArray(value.records).map(parseAttendance)
  }, { method: 'PUT', body: { statuses } })
}
