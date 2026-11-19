import { useEffect, useMemo, useRef, useState, type FormEvent, type ReactNode } from 'react'
import { dateLocale, translate, type UiLanguage } from './i18n'
import './App.css'

type Section = 'overview' | 'masters' | 'patients' | 'attendance' | 'results' | 'report-generation' | 'reports' | 'revenue'
type MasterTab = 'lab-technicians' | 'referrers' | 'sample-collectors' | 'tests'
type ReportPeriod = 'Daily' | 'Weekly' | 'Monthly'
type OrderStatus = 'Pending' | 'Completed'
type OrderStatusFilter = 'All' | OrderStatus
type ExplanationLanguage = 'Marathi' | 'English' | 'Hindi'
type TestProfile = 'preoperative' | 'anc' | 'other'
type AttendanceStatus = 'Present' | 'Absent' | 'Leave'
type AppearanceMode = 'light' | 'dark'
type AccentTheme = 'mint' | 'blue' | 'violet' | 'rose'
type AppearanceSettings = { mode: AppearanceMode; accent: AccentTheme }
type RevenueSummaryRow = { id: string; name: string; orders: number; amount: number }

type LabTechnician = { id: string; name: string; specialty: string; phone: string }
type Referrer = { id: string; name: string; organization: string; phone: string }
type SampleCollector = { id: string; name: string; phone: string }
type Patient = {
  id: string
  name: string
  age: number
  gender: string
  phone: string
  labTechnicianId: string
  sampleCollectorId: string
  referrerId: string
  createdAt: string
}
type AttendanceRecord = { id: string; labTechnicianId: string; date: string; status: AttendanceStatus; updatedAt: string }
type PersistedPatient = Omit<Patient, 'labTechnicianId' | 'sampleCollectorId'> &
  Partial<Pick<Patient, 'labTechnicianId' | 'sampleCollectorId'>> & { doctorId?: string }
type TestParameter = { id: string; name: string; unit: string; reference?: string }
type LabTest = {
  id: string
  name: string
  category: string
  price: number
  unit: string
  reference: string
  parameters?: TestParameter[]
  profiles?: TestProfile[]
}
type LabOrder = {
  id: string
  patientId: string
  testId: string
  createdAt: string
  result: string
  parameterResults?: Record<string, string>
  status: OrderStatus
  printedAt?: string
}
type Store = {
  labTechnicians: LabTechnician[]
  referrers: Referrer[]
  sampleCollectors: SampleCollector[]
  patients: Patient[]
  tests: LabTest[]
  orders: LabOrder[]
  attendance: AttendanceRecord[]
}

const STORAGE_KEY = 'primeaisolution-lab-v1'
const UI_LANGUAGE_STORAGE_KEY = 'primeaisolution-ui-language'
const APPEARANCE_STORAGE_KEY = 'primeaisolution-appearance'
const HEAD_USERNAME = 'head'
const HEAD_PASSWORD = 'lab123'
const accentThemes: { id: AccentTheme; label: string; color: string }[] = [
  { id: 'mint', label: 'Mint', color: '#168466' },
  { id: 'blue', label: 'Ocean blue', color: '#3478c4' },
  { id: 'violet', label: 'Violet', color: '#7961bd' },
  { id: 'rose', label: 'Rose', color: '#c75f76' },
]
const cbcParameters: TestParameter[] = [
  { id: 'hemoglobin', name: 'Hemoglobin (Hb)', unit: 'g/dL', reference: '12.0–17.5' },
  { id: 'rbc-count', name: 'RBC Count', unit: 'million/µL', reference: '4.0–5.5' },
  { id: 'wbc-count', name: 'WBC Count', unit: 'cells/µL', reference: '4,000–11,000' },
  { id: 'platelet-count', name: 'Platelet Count', unit: 'cells/µL', reference: '150,000–450,000' },
  { id: 'hematocrit', name: 'Hematocrit (PCV)', unit: '%', reference: '36–52' },
  { id: 'mcv', name: 'MCV', unit: 'fL', reference: '80–100' },
]
const smearParameters: TestParameter[] = [
  { id: 'rbc-morphology', name: 'RBC Morphology', unit: '' },
  { id: 'wbc-morphology', name: 'WBC Morphology', unit: '' },
  { id: 'platelet-morphology', name: 'Platelet Morphology', unit: '' },
  { id: 'blood-cell-abnormalities', name: 'Blood Cell Abnormalities', unit: '' },
]

const testProfiles: { id: TestProfile; label: string }[] = [
  { id: 'preoperative', label: 'Preoperative Profile' },
  { id: 'anc', label: 'ANC Profile (Antenatal Care)' },
  { id: 'other', label: 'Other tests' },
]

function profileTest(
  id: string,
  name: string,
  category: string,
  profiles: TestProfile[],
  parameters: { name: string; unit?: string }[],
): LabTest {
  return {
    id,
    name,
    category,
    price: 0,
    unit: '',
    reference: '',
    profiles,
    parameters: parameters.map((parameter, index) => ({
      id: `${id}-parameter-${index + 1}`,
      name: parameter.name,
      unit: parameter.unit ?? '',
      reference: '',
    })),
  }
}

function belongsToProfile(test: LabTest, profile: TestProfile) {
  return profile === 'other' ? !test.profiles?.length : Boolean(test.profiles?.includes(profile))
}

const profileTests: LabTest[] = [
  profileTest('profile-preop-cbc', 'CBC (Complete Blood Count)', 'Hematology', ['preoperative'], [
    { name: 'Hemoglobin (Hb)' },
    { name: 'RBC Count' },
    { name: 'Total WBC Count (TC)' },
    { name: 'Neutrophils' },
    { name: 'Lymphocytes' },
    { name: 'Monocytes' },
    { name: 'Eosinophils' },
    { name: 'Basophils' },
    { name: 'Platelet Count' },
    { name: 'PCV' },
    { name: 'MCV' },
    { name: 'MCH' },
    { name: 'MCHC' },
    { name: 'ESR' },
  ]),
  profileTest('profile-anc-cbc', 'CBC (Complete Blood Count)', 'Hematology', ['anc'], [
    { name: 'Hemoglobin (Hb)' },
    { name: 'RBC Count' },
    { name: 'Total WBC Count (TC)' },
    { name: 'Neutrophils' },
    { name: 'Lymphocytes' },
    { name: 'Monocytes' },
    { name: 'Eosinophils' },
    { name: 'Basophils' },
    { name: 'Platelet Count' },
    { name: 'PCV' },
    { name: 'MCV' },
    { name: 'MCH' },
    { name: 'MCHC' },
  ]),
  profileTest('profile-blood-group-rh', 'Blood Group & Rh Type', 'Hematology', ['preoperative', 'anc'], [
    { name: 'ABO Group (A, B, AB, O)' },
    { name: 'Rh Factor (Positive / Negative)' },
  ]),
  profileTest('profile-preop-bt', 'Bleeding Time (BT)', 'Hematology', ['preoperative'], [
    { name: 'Bleeding Time', unit: 'minutes/seconds' },
  ]),
  profileTest('profile-preop-ct', 'Clotting Time (CT)', 'Hematology', ['preoperative'], [
    { name: 'Clotting Time', unit: 'minutes/seconds' },
  ]),
  profileTest('profile-preop-pt', 'Prothrombin Time (PT)', 'Hematology', ['preoperative'], [
    { name: 'PT', unit: 'seconds' },
    { name: 'Control Time', unit: 'seconds' },
    { name: 'INR' },
  ]),
  profileTest('profile-preop-blood-sugar', 'Blood Sugar (Fasting / Random)', 'Biochemistry', ['preoperative'], [
    { name: 'Blood Glucose level' },
  ]),
  profileTest('profile-anc-blood-sugar', 'Blood Sugar (Fasting / Post-Prandial / Random)', 'Biochemistry', ['anc'], [
    { name: 'Blood Glucose level' },
  ]),
  profileTest('profile-preop-blood-urea', 'Blood Urea', 'Biochemistry', ['preoperative'], [
    { name: 'Blood Urea level' },
    { name: 'BUN' },
  ]),
  profileTest('profile-preop-creatinine', 'S. Creatinine', 'Biochemistry', ['preoperative'], [
    { name: 'Serum Creatinine level' },
  ]),
  profileTest('profile-anc-tsh', 'TSH (Thyroid Stimulating Hormone)', 'Immunology', ['anc'], [
    { name: 'Serum TSH level' },
  ]),
  profileTest('profile-hiv', 'H.I.V. Test', 'Immunology', ['preoperative', 'anc'], [
    { name: 'HIV-1 & HIV-2 Antibodies' },
    { name: 'p24 Antigen' },
  ]),
  profileTest('profile-hbsag', 'Australia Antigen (HBsAg)', 'Immunology', ['preoperative', 'anc'], [
    { name: 'Hepatitis B Surface Antigen' },
  ]),
  profileTest('profile-hcv', 'H.C.V.', 'Immunology', ['preoperative', 'anc'], [
    { name: 'Anti-HCV Antibodies' },
  ]),
  profileTest('profile-anc-vdrl', 'V.D.R.L.', 'Immunology', ['anc'], [
    { name: 'Reagin Antibodies (Reactive / Non-reactive)' },
  ]),
  profileTest('profile-anc-urine-routine', 'Urine Routine', 'Clinical Pathology', ['anc'], [
    { name: 'Color' },
    { name: 'Appearance' },
    { name: 'Specific Gravity' },
    { name: 'pH' },
    { name: 'Protein/Albumin' },
    { name: 'Glucose' },
    { name: 'Ketones' },
    { name: 'Pus cells' },
    { name: 'RBCs' },
    { name: 'Epithelial cells' },
    { name: 'Casts' },
    { name: 'Crystals' },
  ]),
]

function daysAgo(days: number) {
  const date = new Date()
  date.setDate(date.getDate() - days)
  return date.toISOString()
}

function dateInputValue(date = new Date()) {
  return new Date(date.getTime() - date.getTimezoneOffset() * 60_000).toISOString().slice(0, 10)
}

const initialStore: Store = {
  labTechnicians: [
    { id: 'tech-1', name: 'Ananya Rao', specialty: 'Hematology', phone: '+91 98765 43210' },
    { id: 'tech-2', name: 'Karan Mehta', specialty: 'Biochemistry', phone: '+91 98765 43211' },
    { id: 'tech-3', name: 'Sana Iyer', specialty: 'Immunology', phone: '+91 98765 43212' },
  ],
  referrers: [
    { id: 'ref-1', name: 'Dr. Vivek Shah', organization: 'Greenfield Clinic', phone: '+91 98765 43213' },
    { id: 'ref-2', name: 'Dr. Meera Nair', organization: 'City Care Centre', phone: '+91 98765 43214' },
  ],
  sampleCollectors: [
    { id: 'collector-1', name: 'Priya Menon', phone: '+91 98765 43215' },
    { id: 'collector-2', name: 'Rahul Desai', phone: '+91 98765 43216' },
  ],
  patients: [
    { id: 'PT-2401', name: 'Aarav Sharma', age: 34, gender: 'Male', phone: '+91 98100 11001', labTechnicianId: 'tech-1', sampleCollectorId: 'collector-1', referrerId: 'ref-1', createdAt: daysAgo(0) },
    { id: 'PT-2402', name: 'Diya Patel', age: 28, gender: 'Female', phone: '+91 98100 11002', labTechnicianId: 'tech-2', sampleCollectorId: 'collector-2', referrerId: 'ref-2', createdAt: daysAgo(0) },
    { id: 'PT-2403', name: 'Kabir Verma', age: 46, gender: 'Male', phone: '+91 98100 11003', labTechnicianId: 'tech-1', sampleCollectorId: 'collector-1', referrerId: 'ref-1', createdAt: daysAgo(1) },
    { id: 'PT-2404', name: 'Anika Das', age: 52, gender: 'Female', phone: '+91 98100 11004', labTechnicianId: 'tech-3', sampleCollectorId: 'collector-2', referrerId: 'ref-2', createdAt: daysAgo(2) },
    { id: 'PT-2405', name: 'Rohan Kapoor', age: 39, gender: 'Male', phone: '+91 98100 11005', labTechnicianId: 'tech-2', sampleCollectorId: 'collector-1', referrerId: 'ref-1', createdAt: daysAgo(3) },
  ],
  tests: [
    { id: 'test-1', name: 'CBC – Complete Blood Count', category: 'Hematology', price: 450, unit: 'g/dL', reference: '12.0–17.5', parameters: cbcParameters },
    { id: 'test-2', name: 'Fasting Blood Glucose', category: 'Biochemistry', price: 250, unit: 'mg/dL', reference: '70–100' },
    { id: 'test-3', name: 'Lipid Profile', category: 'Biochemistry', price: 850, unit: 'mg/dL', reference: '< 200 total' },
    { id: 'test-4', name: 'Thyroid Profile (TSH)', category: 'Immunology', price: 600, unit: 'µIU/mL', reference: '0.4–4.0' },
    { id: 'test-5', name: 'Liver Function Test', category: 'Biochemistry', price: 950, unit: 'U/L', reference: '7–56' },
    { id: 'test-6', name: 'Peripheral Blood Smear', category: 'Hematology', price: 500, unit: '', reference: '', parameters: smearParameters },
    ...profileTests,
  ],
  orders: [
    { id: 'ORD-101', patientId: 'PT-2401', testId: 'test-1', createdAt: daysAgo(0), result: '14.2', parameterResults: { hemoglobin: '14.2', 'rbc-count': '4.8', 'wbc-count': '7,200', 'platelet-count': '265,000', hematocrit: '42', mcv: '88' }, status: 'Completed' },
    { id: 'ORD-102', patientId: 'PT-2401', testId: 'test-2', createdAt: daysAgo(0), result: '', status: 'Pending' },
    { id: 'ORD-103', patientId: 'PT-2402', testId: 'test-3', createdAt: daysAgo(0), result: '186', status: 'Completed' },
    { id: 'ORD-104', patientId: 'PT-2403', testId: 'test-4', createdAt: daysAgo(1), result: '', status: 'Pending' },
    { id: 'ORD-105', patientId: 'PT-2404', testId: 'test-5', createdAt: daysAgo(2), result: '32', status: 'Completed' },
    { id: 'ORD-106', patientId: 'PT-2405', testId: 'test-2', createdAt: daysAgo(3), result: '96', status: 'Completed' },
    { id: 'ORD-107', patientId: 'PT-2401', testId: 'test-6', createdAt: daysAgo(0), result: '', parameterResults: { 'rbc-morphology': 'Normocytic, normochromic', 'wbc-morphology': 'Within expected limits', 'platelet-morphology': 'Adequate on smear', 'blood-cell-abnormalities': 'None observed' }, status: 'Completed' },
  ],
  attendance: [],
}

function readStore(): Store {
  try {
    const saved = localStorage.getItem(STORAGE_KEY)
    if (!saved) return initialStore
    const parsed: unknown = JSON.parse(saved)
    if (
      typeof parsed === 'object' &&
      parsed !== null &&
      'referrers' in parsed &&
      'patients' in parsed &&
      'tests' in parsed &&
      'orders' in parsed &&
      Array.isArray(parsed.referrers) &&
      Array.isArray(parsed.patients) &&
      Array.isArray(parsed.tests) &&
      Array.isArray(parsed.orders) &&
      (('labTechnicians' in parsed && Array.isArray(parsed.labTechnicians)) ||
        ('doctors' in parsed && Array.isArray(parsed.doctors)))
    ) {
      const savedStore = parsed as Omit<Partial<Store>, 'patients'> & {
        doctors?: LabTechnician[]
        patients: PersistedPatient[]
        referrers: Referrer[]
        tests: LabTest[]
        orders: LabOrder[]
      }
      const labTechnicians = savedStore.labTechnicians ?? savedStore.doctors ?? initialStore.labTechnicians
      const sampleCollectors = savedStore.sampleCollectors ?? initialStore.sampleCollectors
      const patients = savedStore.patients.map((patient) => ({
        ...patient,
        labTechnicianId: patient.labTechnicianId ?? patient.doctorId ?? '',
        sampleCollectorId: patient.sampleCollectorId ?? '',
      }))
      const tests = initialStore.tests.map((defaultTest) => {
        const savedTest = savedStore.tests.find((test) => test.id === defaultTest.id)
        return savedTest
          ? { ...defaultTest, ...savedTest, parameters: savedTest.parameters?.length ? savedTest.parameters : defaultTest.parameters }
          : defaultTest
      })
      const savedTestIds = new Set(tests.map((test) => test.id))
      tests.push(...savedStore.tests.filter((test) => !savedTestIds.has(test.id)))
      const seededOrders = initialStore.orders.filter((order) => !savedStore.orders.some((savedOrder) => savedOrder.id === order.id))
      const orders = [...savedStore.orders, ...seededOrders].map((order) => {
        const test = tests.find((item) => item.id === order.testId)
        if (!test?.parameters?.length) return order
        const parameterResults = order.parameterResults ?? (order.result ? { [test.parameters[0].id]: order.result } : {})
        const hasAllParameters = test.parameters.every((parameter) => parameterResults[parameter.id]?.trim())
        return {
          ...order,
          parameterResults,
          status: order.status === 'Completed' && !hasAllParameters ? 'Pending' as const : order.status,
        }
      })
      const attendance = Array.isArray(savedStore.attendance) ? savedStore.attendance : []
      return { labTechnicians, referrers: savedStore.referrers, sampleCollectors, patients, tests, orders, attendance }
    }
  } catch (error) {
    console.error('Unable to load saved lab data.', error)
  }
  return initialStore
}

function Icon({ name, size = 18 }: { name: string; size?: number }) {
  const paths: Record<string, ReactNode> = {
    dashboard: <><rect x="3" y="3" width="7" height="7" rx="1" /><rect x="14" y="3" width="7" height="7" rx="1" /><rect x="14" y="14" width="7" height="7" rx="1" /><rect x="3" y="14" width="7" height="7" rx="1" /></>,
    masters: <><path d="M12 3v18" /><path d="M5 8h14" /><path d="M5 16h14" /><circle cx="8" cy="8" r="2" /><circle cx="16" cy="16" r="2" /></>,
    patients: <><path d="M16 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" /><circle cx="10" cy="7" r="4" /><path d="M20 8v6m3-3h-6" /></>,
    flask: <><path d="M9 3h6" /><path d="M10 3v6.5l-5.8 9.2A2.2 2.2 0 0 0 6 22h12a2.2 2.2 0 0 0 1.8-3.3L14 9.5V3" /><path d="M8 16h8" /></>,
    report: <><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><path d="M14 2v6h6M8 13h8m-8 4h8" /></>,
    search: <><circle cx="11" cy="11" r="7" /><path d="m20 20-4-4" /></>,
    bell: <><path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9" /><path d="M10 21h4" /></>,
    plus: <><path d="M12 5v14m-7-7h14" /></>,
    arrow: <><path d="M5 12h14" /><path d="m13 6 6 6-6 6" /></>,
    close: <><path d="m18 6-12 12M6 6l12 12" /></>,
    print: <><path d="M6 9V2h12v7" /><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2" /><path d="M6 14h12v8H6z" /></>,
    check: <><path d="m5 12 4 4L19 6" /></>,
    clock: <><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></>,
    download: <><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><path d="m7 10 5 5 5-5m-5 5V3" /></>,
    trend: <><path d="m3 17 6-6 4 4 8-8" /><path d="M15 7h6v6" /></>,
    menu: <><path d="M4 6h16M4 12h16M4 18h16" /></>,
    spark: <><path d="m12 3 1.9 5.8L20 11l-6.1 2.2L12 19l-1.9-5.8L4 11l6.1-2.2L12 3Z" /><path d="m19 14 .9 2.1L22 17l-2.1.9L19 20l-.9-2.1L16 17l2.1-.9L19 14Z" /></>,
    palette: <><path d="M12 3a9 9 0 1 0 0 18h1.2a1.8 1.8 0 0 0 1.3-3.1 1.8 1.8 0 0 1 1.3-3.1H18a3 3 0 0 0 3-3c0-4.9-4-8.8-9-8.8Z" /><circle cx="7.5" cy="11" r="1" /><circle cx="10" cy="7.5" r="1" /><circle cx="15" cy="8" r="1" /></>,
  }

  return (
    <svg aria-hidden="true" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      {paths[name] ?? paths.report}
    </svg>
  )
}

function makeId(prefix: string) {
  return `${prefix}-${Date.now().toString(36)}`
}

function nextRecordId(prefix: string, ids: string[], padding: number) {
  const highestId = ids.reduce((highest, id) => {
    const suffix = id.match(/(\d+)$/)?.[1]
    return Math.max(highest, suffix ? Number(suffix) : 0)
  }, 0)
  return `${prefix}${String(highestId + 1).padStart(padding, '0')}`
}

function readUiLanguage(): UiLanguage {
  try {
    const saved = localStorage.getItem(UI_LANGUAGE_STORAGE_KEY)
    if (saved === 'en' || saved === 'mr' || saved === 'hi') return saved
  } catch (error) {
    console.error('Unable to load the saved language preference.', error)
  }
  return 'en'
}

function readAppearance(): AppearanceSettings {
  try {
    const saved = localStorage.getItem(APPEARANCE_STORAGE_KEY)
    if (saved) {
      const parsed: unknown = JSON.parse(saved)
      if (typeof parsed === 'object' && parsed !== null && 'mode' in parsed && 'accent' in parsed) {
        const settings = parsed as { mode: unknown; accent: unknown }
        return {
          mode: settings.mode === 'dark' ? 'dark' : 'light',
          accent: settings.accent === 'blue' || settings.accent === 'violet' || settings.accent === 'rose' ? settings.accent : 'mint',
        }
      }
    }
  } catch (error) {
    console.error('Unable to load appearance preferences.', error)
  }
  return { mode: 'light', accent: 'mint' }
}

function explanationLanguage(language: UiLanguage): ExplanationLanguage {
  return language === 'mr' ? 'Marathi' : language === 'hi' ? 'Hindi' : 'English'
}

function formatDate(value: string, language: UiLanguage = 'en') {
  return new Intl.DateTimeFormat(dateLocale(language), { day: '2-digit', month: 'short', year: 'numeric' }).format(new Date(value))
}

async function readApiJson<T>(response: Response): Promise<T> {
  const body = await response.text()
  if (!body.trim()) {
    throw new Error('The AI service returned an empty response. Restart it with npm run ai:server and try again.')
  }
  try {
    return JSON.parse(body) as T
  } catch {
    throw new Error('The AI service returned an invalid response. Restart it with npm run ai:server and try again.')
  }
}

function getPatientName(store: Store, id: string) {
  return store.patients.find((patient) => patient.id === id)?.name ?? 'Unknown patient'
}

function getTest(store: Store, id: string) {
  return store.tests.find((test) => test.id === id)
}

function getTestParameters(store: Store, order: LabOrder): TestParameter[] {
  const test = getTest(store, order.testId)
  return test?.parameters?.length
    ? test.parameters
    : [{ id: test?.id ?? order.testId, name: 'Result', unit: test?.unit ?? '', reference: test?.reference ?? '' }]
}

function getParameterResult(order: LabOrder, parameter: TestParameter) {
  return order.parameterResults?.[parameter.id] ?? (parameter.id === order.testId ? order.result : '')
}

function getLabTechnician(store: Store, id: string) {
  return store.labTechnicians.find((technician) => technician.id === id)?.name ?? '—'
}

function getSampleCollector(store: Store, id: string) {
  return store.sampleCollectors.find((collector) => collector.id === id)?.name ?? '—'
}

function getReferrer(store: Store, id: string) {
  return store.referrers.find((referrer) => referrer.id === id)?.name ?? '—'
}

function summarizeRevenueByPerson(
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

function Dialog({ title, onClose, children, className = '', language }: { title: string; onClose: () => void; children: ReactNode; className?: string; language: UiLanguage }) {
  return (
    <div className="dialog-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose() }}>
      <section className={`dialog ${className}`} role="dialog" aria-modal="true" aria-labelledby="dialog-title">
        <div className="dialog-heading">
          <div><span className="eyebrow">PRIME AI LAB</span><h2 id="dialog-title">{title}</h2></div>
          <button className="icon-button" aria-label={translate(language, 'Close dialog')} onClick={onClose}><Icon name="close" /></button>
        </div>
        {children}
      </section>
    </div>
  )
}

function formatRevenue(amount: number, language: UiLanguage) {
  return new Intl.NumberFormat(dateLocale(language), {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(amount)
}

function RevenueBreakdownPanel({ title, rows, language }: { title: string; rows: RevenueSummaryRow[]; language: UiLanguage }) {
  const t = (text: string) => translate(language, text)
  return (
    <article className="panel revenue-breakdown-panel">
      <div className="panel-heading"><div><h2>{title}</h2><p>{t('Revenue by assigned staff')}</p></div></div>
      <div className="revenue-table-wrap">
        <table className="revenue-table">
          <thead><tr><th>{t('Name')}</th><th>{t('Orders')}</th><th>{t('Business')}</th></tr></thead>
          <tbody>{rows.map((row) => <tr key={row.id}><td>{row.name}</td><td>{row.orders.toLocaleString(dateLocale(language))}</td><td><strong>{formatRevenue(row.amount, language)}</strong></td></tr>)}</tbody>
        </table>
        {!rows.length && <p className="empty-message">{t('No staff found.')}</p>}
      </div>
    </article>
  )
}

function App() {
  const [store, setStore] = useState<Store>(readStore)
  const [uiLanguage, setUiLanguage] = useState<UiLanguage>(readUiLanguage)
  const [appearance, setAppearance] = useState<AppearanceSettings>(readAppearance)
  const [section, setSection] = useState<Section>('overview')
  const [headAuthenticated, setHeadAuthenticated] = useState(false)
  const [headUsername, setHeadUsername] = useState('')
  const [headPassword, setHeadPassword] = useState('')
  const [headLoginError, setHeadLoginError] = useState('')
  const [attendanceDate, setAttendanceDate] = useState(() => dateInputValue())
  const [masterTab, setMasterTab] = useState<MasterTab>('lab-technicians')
  const [reportPeriod, setReportPeriod] = useState<ReportPeriod>('Daily')
  const [revenuePeriod, setRevenuePeriod] = useState<ReportPeriod>('Daily')
  const [revenueDate, setRevenueDate] = useState(() => dateInputValue())
  const [orderStatusFilter, setOrderStatusFilter] = useState<OrderStatusFilter>('All')
  const [search, setSearch] = useState('')
  const [patientDialog, setPatientDialog] = useState(false)
  const [testDialog, setTestDialog] = useState(false)
  const [masterDialog, setMasterDialog] = useState<MasterTab | null>(null)
  const [reportPatientId, setReportPatientId] = useState<string | null>(null)
  const [reportOrderIds, setReportOrderIds] = useState<string[] | null>(null)
  const [generationPatientId, setGenerationPatientId] = useState('')
  const [aiLanguage, setAiLanguage] = useState<ExplanationLanguage>(() => explanationLanguage(uiLanguage))
  const [aiInterpretation, setAiInterpretation] = useState<{ text: string; model: string } | null>(null)
  const [aiLoading, setAiLoading] = useState(false)
  const [aiError, setAiError] = useState('')
  const [sharingReport, setSharingReport] = useState(false)
  const reportRef = useRef<HTMLDivElement>(null)
  const [selectedPatientId, setSelectedPatientId] = useState('')
  const [selectedTestProfile, setSelectedTestProfile] = useState<TestProfile | ''>('')
  const [selectedTestIds, setSelectedTestIds] = useState<string[]>([])
  const [patientDraft, setPatientDraft] = useState({ name: '', age: '', gender: 'Female', phone: '', labTechnicianId: '', sampleCollectorId: '', referrerId: '' })
  const [masterDraft, setMasterDraft] = useState({ name: '', specialty: '', organization: '', phone: '', category: '', price: '' })
  const [parameterDrafts, setParameterDrafts] = useState([{ name: '', unit: '', reference: '' }])
  const [resultDrafts, setResultDrafts] = useState<Record<string, string>>({})
  const [toast, setToast] = useState('')
  const t = (text: string) => translate(uiLanguage, text)

  const updateAppearance = (next: AppearanceSettings) => {
    setAppearance(next)
    try {
      localStorage.setItem(APPEARANCE_STORAGE_KEY, JSON.stringify(next))
    } catch (error) {
      console.error('Unable to save appearance preferences.', error)
      setToast(t('Could not save appearance settings.'))
    }
  }

  const changeUiLanguage = (language: UiLanguage) => {
    setUiLanguage(language)
    setAiLanguage(explanationLanguage(language))
    try {
      localStorage.setItem(UI_LANGUAGE_STORAGE_KEY, language)
    } catch (error) {
      console.error('Unable to save the language preference.', error)
      setToast(t('Could not save language preference.'))
    }
  }

  useEffect(() => {
    const handleSearchShortcut = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault()
        document.querySelector<HTMLInputElement>('.global-search input')?.focus()
      }
    }

    window.addEventListener('keydown', handleSearchShortcut)
    return () => window.removeEventListener('keydown', handleSearchShortcut)
  }, [])

  const persist = (next: Store) => {
    setStore(next)
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next))
    } catch (error) {
      console.error('Unable to save lab data in this browser.', error)
      setToast(t('Could not save changes in this browser.'))
    }
  }

  const notify = (message: string) => {
    setToast(t(message))
    window.setTimeout(() => setToast(''), 2600)
  }

  const loginHead = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (headUsername.trim() !== HEAD_USERNAME || headPassword !== HEAD_PASSWORD) {
      setHeadLoginError(t('Incorrect Head username or password.'))
      return
    }
    setHeadAuthenticated(true)
    setHeadUsername('')
    setHeadPassword('')
    setHeadLoginError('')
  }

  const logoutHead = () => {
    setHeadAuthenticated(false)
    setHeadUsername('')
    setHeadPassword('')
    setHeadLoginError('')
    setSection('overview')
  }

  const openAttendance = () => {
    setHeadLoginError('')
    setSection('attendance')
  }

  const setTechnicianAttendance = (labTechnicianId: string, status: AttendanceStatus | '') => {
    const remaining = store.attendance.filter((record) =>
      record.labTechnicianId !== labTechnicianId || record.date !== attendanceDate,
    )
    const attendance = status
      ? [{ id: `${attendanceDate}:${labTechnicianId}`, labTechnicianId, date: attendanceDate, status, updatedAt: new Date().toISOString() }, ...remaining]
      : remaining
    persist({ ...store, attendance })
  }

  const updateOrder = (id: string, changes: Partial<LabOrder>) => {
    persist({ ...store, orders: store.orders.map((order) => order.id === id ? { ...order, ...changes, printedAt: undefined } : order) })
  }

  const saveOrderResults = (order: LabOrder) => {
    const parameters = getTestParameters(store, order)
    const isParameterized = Boolean(getTest(store, order.testId)?.parameters?.length)
    if (isParameterized) {
      const parameterResults = Object.fromEntries(parameters.map((parameter) => {
        const draftKey = `${order.id}:${parameter.id}`
        return [parameter.id, resultDrafts[draftKey] ?? getParameterResult(order, parameter)]
      }))
      const hasAnyResult = Object.values(parameterResults).some((value) => value.trim())
      if (!hasAnyResult) {
        notify('Enter at least one parameter result before saving.')
        return
      }
      const isComplete = parameters.every((parameter) => parameterResults[parameter.id]?.trim())
      updateOrder(order.id, { parameterResults, result: parameterResults[parameters[0].id] ?? '', status: isComplete ? 'Completed' : 'Pending' })
      notify(isComplete ? 'All test parameter results saved.' : 'Parameter results saved. This test remains pending until all parameters are entered.')
      return
    }

    const result = resultDrafts[order.id]?.trim() ?? order.result.trim()
    if (!result) {
      notify('Enter a result before saving this order.')
      return
    }
    updateOrder(order.id, { result, status: 'Completed' })
    notify('Result saved.')
  }

  const updateParameterResult = (order: LabOrder, parameter: TestParameter, value: string) => {
    const parameters = getTestParameters(store, order)
    const parameterResults = { ...order.parameterResults, [parameter.id]: value }
    const status = parameters.every((item) => parameterResults[item.id]?.trim()) ? 'Completed' : 'Pending'
    setResultDrafts((drafts) => ({ ...drafts, [`${order.id}:${parameter.id}`]: value }))
    updateOrder(order.id, {
      parameterResults,
      result: parameter.id === parameters[0].id ? value : order.result,
      status,
    })
  }

  const openPatientReport = (patientId: string) => {
    setReportOrderIds(null)
    setReportPatientId(patientId)
    setAiInterpretation(null)
    setAiError('')
  }

  const openTestReport = (patientId: string, orderIds: string[] | null) => {
    setReportOrderIds(orderIds)
    setReportPatientId(patientId)
    setAiInterpretation(null)
    setAiError('')
  }

  const printPatientReport = () => {
    const printedOrderIds = new Set(selectedPatientOrders.map((order) => order.id))
    window.print()
    if (!window.confirm(t('Was this report printed successfully?'))) return
    const printedAt = new Date().toISOString()
    persist({
      ...store,
      orders: store.orders.map((order) => printedOrderIds.has(order.id) ? { ...order, printedAt } : order),
    })
  }

  const sharePatientReportOnWhatsApp = async () => {
    if (!selectedReportPatient) return
    const phoneDigits = selectedReportPatient.phone.replace(/\D/g, '')
    if (phoneDigits.length < 10 || phoneDigits.length > 15) {
      notify('Enter a valid patient phone number before sharing this report.')
      return
    }
    const phone = phoneDigits.length === 10 ? `91${phoneDigits}` : phoneDigits
    if (!window.confirm(t('This creates a PDF containing confidential health information. Review the recipient before sharing it on WhatsApp.'))) return
    if (!reportRef.current) {
      notify('Could not create the PDF report. Try Print report and save as PDF.')
      return
    }

    const fileShareSupported = typeof navigator.share === 'function'
      && typeof navigator.canShare === 'function'
      && navigator.canShare({ files: [new File([], 'report.pdf', { type: 'application/pdf' })] })
    const whatsAppWindow = fileShareSupported ? null : window.open('', '_blank')
    let pdfContainer: HTMLDivElement | null = null
    setSharingReport(true)

    try {
      const { default: html2pdf } = await import('html2pdf.js')
      const reportClone = reportRef.current.cloneNode(true) as HTMLDivElement
      reportClone.querySelector('.ai-controls')?.remove()
      const resultsScroll = reportClone.querySelector<HTMLElement>('.report-results-scroll')
      if (resultsScroll) resultsScroll.style.overflow = 'visible'

      pdfContainer = document.createElement('div')
      pdfContainer.className = 'app-shell'
      pdfContainer.dataset.mode = 'light'
      pdfContainer.dataset.accent = document.querySelector<HTMLElement>('.app-shell')?.dataset.accent ?? 'mint'
      pdfContainer.style.position = 'fixed'
      pdfContainer.style.left = '-10000px'
      pdfContainer.style.top = '0'
      pdfContainer.style.width = '760px'
      pdfContainer.style.background = '#fff'
      pdfContainer.append(reportClone)
      document.body.append(pdfContainer)

      const filename = `Patient_Lab_Report_${new Date().toISOString().slice(0, 10)}.pdf`
      const pdfBlob = await html2pdf()
        .set({
          margin: 8,
          filename,
          image: { type: 'jpeg', quality: 0.98 },
          html2canvas: { scale: 2, useCORS: true, backgroundColor: '#ffffff', scrollY: 0 },
          jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' },
        })
        .from(pdfContainer)
        .outputPdf('blob') as Blob
      const pdfFile = new File([pdfBlob], filename, { type: 'application/pdf' })

      if (fileShareSupported) {
        try {
          await navigator.share({ files: [pdfFile], title: t('Patient report') })
          notify('PDF share completed. Confirm it was sent in WhatsApp.')
          return
        } catch (error) {
          if (error instanceof Error && error.name === 'AbortError') return
          console.error('Unable to share the patient report PDF.', error)
        }
      }

      const downloadUrl = URL.createObjectURL(pdfBlob)
      const downloadLink = document.createElement('a')
      downloadLink.href = downloadUrl
      downloadLink.download = filename
      document.body.append(downloadLink)
      downloadLink.click()
      downloadLink.remove()
      window.setTimeout(() => URL.revokeObjectURL(downloadUrl), 1000)

      const shareUrl = `https://wa.me/${phone}?text=${encodeURIComponent(t('Please find the attached patient lab report PDF.'))}`
      if (whatsAppWindow) {
        whatsAppWindow.location.href = shareUrl
        notify('The PDF was downloaded. Attach it in WhatsApp before sending.')
      } else {
        notify('The PDF was downloaded. Open WhatsApp, attach it, and send it to the patient.')
      }
    } catch (error) {
      console.error('Unable to create the patient report PDF.', error)
      whatsAppWindow?.close()
      notify('Could not create the PDF report. Try Print report and save as PDF.')
    } finally {
      pdfContainer?.remove()
      setSharingReport(false)
    }
  }

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

  const openTestDialog = (patientId = '') => {
    setSelectedPatientId(patientId)
    setSelectedTestProfile('')
    setSelectedTestIds([])
    setTestDialog(true)
  }

  const openMasterDialog = (tab: MasterTab) => {
    setMasterDraft({ name: '', specialty: '', organization: '', phone: '', category: '', price: '' })
    setParameterDrafts([{ name: '', unit: '', reference: '' }])
    setMasterDialog(tab)
  }

  const addPatient = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const patient: Patient = {
      id: nextRecordId('PT-', store.patients.map((item) => item.id), 4),
      name: patientDraft.name.trim(),
      age: Number(patientDraft.age),
      gender: patientDraft.gender,
      phone: patientDraft.phone.trim(),
      labTechnicianId: patientDraft.labTechnicianId,
      sampleCollectorId: patientDraft.sampleCollectorId,
      referrerId: patientDraft.referrerId,
      createdAt: new Date().toISOString(),
    }
    persist({ ...store, patients: [patient, ...store.patients] })
    setPatientDraft({ name: '', age: '', gender: 'Female', phone: '', labTechnicianId: '', sampleCollectorId: '', referrerId: '' })
    setPatientDialog(false)
    notify('Patient registered successfully.')
  }

  const addTestOrder = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!selectedPatientId || !selectedTestProfile) {
      notify('Select a patient, profile and at least one test.')
      return
    }
    const availableTestIds = new Set(store.tests.filter((test) => belongsToProfile(test, selectedTestProfile)).map((test) => test.id))
    if (!selectedTestIds.length || selectedTestIds.some((id) => !availableTestIds.has(id))) {
      notify('Select a patient, profile and at least one test.')
      return
    }
    const existingIds = store.orders.map((item) => item.id)
    const createdAt = new Date().toISOString()
    const newOrders = selectedTestIds.reduce<LabOrder[]>((orders, testId) => {
      orders.push({
        id: nextRecordId('ORD-', [...existingIds, ...orders.map((order) => order.id)], 3),
        patientId: selectedPatientId,
        testId,
        createdAt,
        result: '',
        parameterResults: {},
        status: 'Pending',
      })
      return orders
    }, [])
    persist({ ...store, orders: [...newOrders, ...store.orders] })
    setTestDialog(false)
    setSelectedTestIds([])
    notify(`${newOrders.length} test${newOrders.length === 1 ? '' : 's'} added to the patient queue.`)
  }

  const addMaster = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (masterDialog === 'lab-technicians') {
      persist({ ...store, labTechnicians: [{ id: makeId('tech'), name: masterDraft.name.trim(), specialty: masterDraft.specialty.trim(), phone: masterDraft.phone.trim() }, ...store.labTechnicians] })
    } else if (masterDialog === 'referrers') {
      persist({ ...store, referrers: [{ id: makeId('ref'), name: masterDraft.name.trim(), organization: masterDraft.organization.trim(), phone: masterDraft.phone.trim() }, ...store.referrers] })
    } else if (masterDialog === 'sample-collectors') {
      persist({ ...store, sampleCollectors: [{ id: makeId('collector'), name: masterDraft.name.trim(), phone: masterDraft.phone.trim() }, ...store.sampleCollectors] })
    } else if (masterDialog === 'tests') {
      const parameters = parameterDrafts.map((parameter, index) => ({
        id: `${makeId('parameter')}-${index + 1}`,
        name: parameter.name.trim(),
        unit: parameter.unit.trim(),
        reference: parameter.reference.trim(),
      })).filter((parameter) => parameter.name)
      if (!parameters.length) {
        notify('Add at least one named test parameter.')
        return
      }
      const test: LabTest = {
        id: makeId('test'),
        name: masterDraft.name.trim(),
        category: masterDraft.category.trim(),
        price: Number(masterDraft.price),
        unit: '',
        reference: '',
        parameters,
      }
      persist({ ...store, tests: [test, ...store.tests] })
    }
    setMasterDialog(null)
    setMasterDraft({ name: '', specialty: '', organization: '', phone: '', category: '', price: '' })
    setParameterDrafts([{ name: '', unit: '', reference: '' }])
    notify('Master record added.')
  }

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

  const selectedReportPatient = reportPatientId ? store.patients.find((patient) => patient.id === reportPatientId) : undefined
  const selectedPatientOrders = reportPatientId
    ? store.orders.filter((order) => order.patientId === reportPatientId && (!reportOrderIds || reportOrderIds.includes(order.id)))
    : []
  const selectedProfileTests = selectedTestProfile
    ? store.tests.filter((test) => belongsToProfile(test, selectedTestProfile))
    : []
  const generationOrders = generationPatientId
    ? store.orders.filter((order) => order.patientId === generationPatientId)
    : []
  const masterTabDetails: Record<MasterTab, { label: string; singular: string; count: number }> = {
    'lab-technicians': { label: t('Lab technicians'), singular: t('lab technician'), count: store.labTechnicians.length },
    referrers: { label: t('Referrers'), singular: t('referrer'), count: store.referrers.length },
    'sample-collectors': { label: t('Sample collectors'), singular: t('sample collector'), count: store.sampleCollectors.length },
    tests: { label: t('Test catalogue'), singular: t('test'), count: store.tests.length },
  }

  const generateAiInterpretation = async () => {
    setAiLoading(true)
    setAiError('')
    setAiInterpretation(null)
    try {
      const healthResponse = await fetch('/api/health')
      const health = await readApiJson<{ available?: boolean; provider?: string; model?: string; error?: string }>(healthResponse)
      if (!healthResponse.ok || !health.available) {
        throw new Error(health.error ?? 'The configured cloud AI provider is unavailable.')
      }

      const response = await fetch('/api/interpret', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          language: aiLanguage,
          patientAge: selectedReportPatient?.age ?? null,
          tests: selectedPatientOrders.map((order) => ({
            name: getTest(store, order.testId)?.name ?? 'Unknown test',
            parameters: getTestParameters(store, order).map((parameter) => ({
              name: parameter.name,
              value: getParameterResult(order, parameter).trim() || 'Not entered',
              unit: parameter.unit,
              reference: parameter.reference ?? '',
            })),
          })),
        }),
      })
      const result = await readApiJson<{ interpretation?: string; provider?: string; model?: string; error?: string }>(response)
      if (!response.ok || !result.interpretation) {
        throw new Error(result.error ?? 'Could not generate an explanation. Please try again.')
      }
      setAiInterpretation({ text: result.interpretation, model: `${result.provider ?? health.provider ?? 'Cloud AI'} · ${result.model ?? health.model ?? 'model'}` })
    } catch (error) {
      const message = error instanceof Error ? error.message : ''
      setAiError(message === 'Failed to fetch'
        ? t('AI service is unreachable. Start it with npm run ai:server and try again.')
        : t(message || 'Could not generate an explanation. Please try again.'))
    } finally {
      setAiLoading(false)
    }
  }

  return (
    <div className="app-shell" data-mode={appearance.mode} data-accent={appearance.accent}>
      <aside className="sidebar">
        <a className="brand" href="#" onClick={(event) => { event.preventDefault(); setSection('overview') }}>
          <span className="brand-mark"><Icon name="flask" size={21} /></span>
          <span className="brand-copy"><strong>prime<span>ai</span></strong><small>LAB MANAGEMENT</small></span>
        </a>
        <div className="workspace-label">{t('WORKSPACE')}</div>
        <nav className="side-nav" aria-label={t('Main navigation')}>
          <button className={`nav-item ${section === 'overview' ? 'active' : ''}`} onClick={() => setSection('overview')}><Icon name="dashboard" /><span>{t('Overview')}</span></button>
          <div className="nav-separator" />
          <button className={`nav-item ${section === 'masters' ? 'active' : ''}`} onClick={() => setSection('masters')}><Icon name="masters" /><span>{t('Masters')}</span></button>
          <button className={`nav-item ${section === 'patients' ? 'active' : ''}`} onClick={() => setSection('patients')}><Icon name="patients" /><span>{t('Patients')}</span><span className="nav-count">{store.patients.length}</span></button>
          <button className={`nav-item ${section === 'attendance' ? 'active' : ''}`} onClick={openAttendance}><Icon name="clock" /><span>{t('Attendance')}</span></button>
          <button className={`nav-item ${section === 'results' ? 'active' : ''}`} onClick={() => setSection('results')}><Icon name="flask" /><span>{t('Test results')}</span>{pendingCount > 0 && <span className="nav-count warning">{pendingCount}</span>}</button>
          <button className={`nav-item ${section === 'report-generation' ? 'active' : ''}`} onClick={() => setSection('report-generation')}><Icon name="print" /><span>{t('Report generation')}</span></button>
          <button className={`nav-item ${section === 'reports' ? 'active' : ''}`} onClick={() => setSection('reports')}><Icon name="report" /><span>{t('Reports')}</span></button>
          <button className={`nav-item ${section === 'revenue' ? 'active' : ''}`} onClick={() => setSection('revenue')}><Icon name="trend" /><span>{t('Revenue')}</span></button>
        </nav>
        <div className="sidebar-bottom">
          <div className="support-card">
            <span className="support-icon"><Icon name="spark" size={16} /></span>
            <strong>{t('Lab workspace')}</strong>
            <p>{t('Your data is saved in this browser.')}</p>
            <span className="secure-label"><span /> {t('LOCAL DEMO MODE')}</span>
          </div>
          <button className="profile-button">
            <span className="avatar">PS</span>
            <span className="profile-copy"><strong>Priya Singh</strong><small>{t('Lab administrator')}</small></span>
            <span className="profile-more">···</span>
          </button>
        </div>
      </aside>

      <main className="main-panel">
        <header className="topbar">
          <div className="breadcrumbs"><span>Prime AI Lab</span><span className="crumb-slash">/</span><strong>{t(section === 'overview' ? 'Overview' : section === 'results' ? 'Test results' : section === 'report-generation' ? 'Report generation' : section === 'masters' ? 'Masters' : section === 'patients' ? 'Patients' : section === 'attendance' ? 'Attendance' : section === 'revenue' ? 'Revenue' : 'Reports')}</strong></div>
          <div className="topbar-actions">
            <label className="global-search"><Icon name="search" size={17} /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder={t('Search patients, tests...')} aria-label={t('Search patients and tests')} /><kbd>⌘ K</kbd></label>
            <label className="ui-language-picker"><span>{t('Language')}</span><select aria-label={t('Language')} value={uiLanguage} onChange={(event) => { const language = event.target.value; if (language === 'en' || language === 'mr' || language === 'hi') changeUiLanguage(language) }}><option value="en">English</option><option value="mr">मराठी</option><option value="hi">हिन्दी</option></select></label>
            <details className="appearance-menu">
              <summary className="icon-button appearance-trigger" aria-label={t('Appearance')} title={t('Appearance')}><Icon name="palette" size={18} /></summary>
              <div className="appearance-panel">
                <div className="appearance-panel-heading"><strong>{t('Appearance')}</strong><small>{t('Personalize the app colors.')}</small></div>
                <label className="appearance-mode-picker">{t('Display mode')}<select value={appearance.mode} onChange={(event) => { const mode = event.target.value; if (mode === 'light' || mode === 'dark') updateAppearance({ ...appearance, mode }) }}><option value="light">{t('Light')}</option><option value="dark">{t('Dark')}</option></select></label>
                <div className="appearance-theme-picker"><span>{t('Accent theme')}</span><div className="theme-choice-grid" role="group" aria-label={t('Accent theme')}>
                  {accentThemes.map((theme) => <button key={theme.id} type="button" className={`theme-choice ${appearance.accent === theme.id ? 'selected' : ''}`} aria-label={t(theme.label)} aria-pressed={appearance.accent === theme.id} title={t(theme.label)} onClick={() => updateAppearance({ ...appearance, accent: theme.id })}><span className="theme-swatch" style={{ backgroundColor: theme.color }} /><small>{t(theme.label)}</small></button>)}
                </div></div>
              </div>
            </details>
            <button className="icon-button notification-button" aria-label={t('Notifications')}><Icon name="bell" size={18} /><i /></button>
            <div className="topbar-divider" />
            <span className="today-date">{new Intl.DateTimeFormat(dateLocale(uiLanguage), { weekday: 'short', day: 'numeric', month: 'short' }).format(new Date())}</span>
          </div>
        </header>

        <div className="page-content">
          {section === 'overview' && (
            <section className="page-section">
              <div className="page-heading overview-heading">
                <div><span className="eyebrow">{new Intl.DateTimeFormat(dateLocale(uiLanguage), { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }).format(new Date()).toUpperCase()}</span><h1>{greeting}, Priya <span className="wave">✦</span></h1><p>{t('Here’s what’s happening in your lab today.')}</p></div>
                <button className="button button-primary" onClick={() => setPatientDialog(true)}><Icon name="plus" size={17} /> {t('Register patient')}</button>
              </div>

              <div className="stats-grid">
                <article className="stat-card"><div className="stat-top"><span className="stat-icon mint"><Icon name="patients" /></span><span className="stat-trend"><Icon name="trend" size={13} /> 12.5%</span></div><span className="stat-label">{t('Total patients')}</span><strong>{store.patients.length.toLocaleString(dateLocale(uiLanguage))}</strong><small>{t('Registered in the system')}</small></article>
                <article className="stat-card"><div className="stat-top"><span className="stat-icon violet"><Icon name="flask" /></span><span className="stat-trend"><Icon name="trend" size={13} /> 8.2%</span></div><span className="stat-label">{t('Tests today')}</span><strong>{todayCount.toLocaleString(dateLocale(uiLanguage))}</strong><small>{t('Across all test categories')}</small></article>
                <article className="stat-card"><div className="stat-top"><span className="stat-icon amber"><Icon name="clock" /></span><span className="stat-chip">{pendingCount} {t('need attention')}</span></div><span className="stat-label">{t('Pending results')}</span><strong>{pendingCount.toLocaleString(dateLocale(uiLanguage))}</strong><small>{t('Awaiting result entry')}</small></article>
                <article className="stat-card"><div className="stat-top"><span className="stat-icon blue"><Icon name="trend" /></span><span className="stat-chip">{t('All time')}</span></div><span className="stat-label">{t('Catalogue value')}</span><strong>₹{revenue.toLocaleString(dateLocale(uiLanguage))}</strong><small>{t('Based on test catalogue prices')}</small></article>
              </div>

              <div className="dashboard-grid">
                <article className="panel activity-panel">
                  <div className="panel-heading"><div><h2>{t('Recent test activity')}</h2><p>{t('Your latest patient tests and result status.')}</p></div><button className="text-button" onClick={() => setSection('results')}>{t('View all')} <Icon name="arrow" size={15} /></button></div>
                  <OrderTable orders={store.orders.slice(0, 5)} store={store} onReport={openPatientReport} compact language={uiLanguage} />
                </article>
                <article className="panel chart-panel">
                  <div className="panel-heading"><div><h2>{t('Test volume')}</h2><p>{t('Orders received this week')}</p></div><span className="period-pill">{t('This week')} <span>⌄</span></span></div>
                  <div className="chart-summary"><strong>{weeklyOrders.length}</strong><span>{t('tests this week')}</span><span className="chart-change">{store.orders.length} {t('total')}</span></div>
                  <div className="bar-chart" aria-label="Test volume chart">
                    {volumeByDay.map((day) => <div className="bar-column" key={day.label}><div className={`bar ${day.label === new Intl.DateTimeFormat(dateLocale(uiLanguage), { weekday: 'short' }).format(new Date()) ? 'bar-current' : ''}`} style={{ height: `${day.count ? (day.count / maxDailyVolume) * 100 : 6}%` }} title={`${day.count} ${t('test')}`} /><span>{day.label}</span></div>)}
                  </div>
                </article>
              </div>

              <div className="dashboard-grid lower-grid">
                <article className="panel quick-panel">
                  <div className="panel-heading"><div><h2>{t('Quick actions')}</h2><p>{t('Common tasks, right at your fingertips.')}</p></div></div>
                  <div className="quick-actions">
                    <button onClick={() => setPatientDialog(true)}><span className="quick-icon quick-mint"><Icon name="patients" /></span><span><strong>{t('New patient')}</strong><small>{t('Register a patient')}</small></span><Icon name="arrow" size={16} /></button>
                    <button onClick={() => openTestDialog()}><span className="quick-icon quick-violet"><Icon name="flask" /></span><span><strong>{t('Add a test')}</strong><small>{t('Create a test order')}</small></span><Icon name="arrow" size={16} /></button>
                    <button onClick={() => setSection('reports')}><span className="quick-icon quick-blue"><Icon name="report" /></span><span><strong>{t('View reports')}</strong><small>{t('Explore lab activity')}</small></span><Icon name="arrow" size={16} /></button>
                  </div>
                </article>
                <article className="panel completion-panel">
                  <div className="panel-heading"><div><h2>{t('Result completion')}</h2><p>{t('Overall test processing status.')}</p></div><span className="completion-value">{store.orders.length ? Math.round((completedCount / store.orders.length) * 100) : 0}%</span></div>
                  <div className="progress-track"><span style={{ width: `${store.orders.length ? (completedCount / store.orders.length) * 100 : 0}%` }} /></div>
                  <div className="completion-legend"><span><i className="legend-dot green-dot" /> {t('Completed')} <strong>{completedCount}</strong></span><span><i className="legend-dot amber-dot" /> {t('Pending')} <strong>{pendingCount}</strong></span></div>
                  <div className="completion-note"><span className="note-icon"><Icon name="spark" size={15} /></span><p><strong>{t('AI-assisted reporting')}</strong><br />{t('Create a structured draft from entered results. All reports require professional review.')}</p></div>
                </article>
              </div>
              <p className="demo-notice">{t('Demo workspace · Sample records are fictional. Do not enter real patient information.')}</p>
            </section>
          )}

          {section === 'masters' && (
            <section className="page-section">
              <div className="page-heading"><div><span className="eyebrow">{t('CONFIGURATION')}</span><h1>{t('Masters')}</h1><p>{t('Manage lab technicians, referral partners, sample collectors and tests.')}</p></div><button className="button button-primary" onClick={() => openMasterDialog(masterTab)}><Icon name="plus" size={17} /> {t('Add')} {masterTabDetails[masterTab].singular}</button></div>
              <div className="tab-bar">
                {(['lab-technicians', 'referrers', 'sample-collectors', 'tests'] as const).map((key) => <button key={key} className={masterTab === key ? 'selected' : ''} onClick={() => setMasterTab(key)}>{masterTabDetails[key].label}<span>{masterTabDetails[key].count}</span></button>)}
              </div>
              <div className="panel list-panel">
                {masterTab === 'lab-technicians' && <table><thead><tr><th>{t('LAB TECHNICIAN')}</th><th>{t('DEPARTMENT / SPECIALTY')}</th><th>{t('PHONE')}</th><th>{t('ASSIGNED PATIENTS')}</th><th /></tr></thead><tbody>{store.labTechnicians.filter((technician) => !search || `${technician.name} ${technician.specialty} ${technician.phone}`.toLowerCase().includes(search.toLowerCase())).map((technician, index) => <tr key={technician.id}><td><div className="person-cell"><span className={`avatar avatar-${index % 4}`}>{technician.name.split(' ').slice(-1)[0].slice(0, 1)}</span><strong>{technician.name}</strong></div></td><td>{technician.specialty}</td><td>{technician.phone || '—'}</td><td>{store.patients.filter((patient) => patient.labTechnicianId === technician.id).length} {t('Patients').toLowerCase()}</td><td><button className="row-action" aria-label={`${t('Add patient for')} ${technician.name}`} onClick={() => { setPatientDraft({ name: '', age: '', gender: 'Female', phone: '', labTechnicianId: technician.id, sampleCollectorId: '', referrerId: '' }); setPatientDialog(true) }}>•••</button></td></tr>)}</tbody></table>}
                {masterTab === 'referrers' && <table><thead><tr><th>{t('REFERRAL PARTNER')}</th><th>{t('ORGANIZATION')}</th><th>{t('PHONE')}</th><th>{t('REFERRED PATIENTS')}</th><th /></tr></thead><tbody>{store.referrers.filter((referrer) => !search || `${referrer.name} ${referrer.organization} ${referrer.phone}`.toLowerCase().includes(search.toLowerCase())).map((referrer, index) => <tr key={referrer.id}><td><div className="person-cell"><span className={`avatar avatar-${(index + 2) % 4}`}>{referrer.name.split(' ').slice(-1)[0].slice(0, 1)}</span><strong>{referrer.name}</strong></div></td><td>{referrer.organization}</td><td>{referrer.phone || '—'}</td><td>{store.patients.filter((patient) => patient.referrerId === referrer.id).length} {t('Patients').toLowerCase()}</td><td><button className="row-action" aria-label={`${t('Referral partner actions for')} ${referrer.name}`}>•••</button></td></tr>)}</tbody></table>}
                {masterTab === 'sample-collectors' && <table><thead><tr><th>{t('SAMPLE COLLECTOR')}</th><th>{t('PHONE')}</th><th>{t('ASSIGNED PATIENTS')}</th><th /></tr></thead><tbody>{store.sampleCollectors.filter((collector) => !search || `${collector.name} ${collector.phone}`.toLowerCase().includes(search.toLowerCase())).map((collector, index) => <tr key={collector.id}><td><div className="person-cell"><span className={`avatar avatar-${index % 4}`}>{collector.name.split(' ').slice(-1)[0].slice(0, 1)}</span><strong>{collector.name}</strong></div></td><td>{collector.phone || '—'}</td><td>{store.patients.filter((patient) => patient.sampleCollectorId === collector.id).length} {t('Patients').toLowerCase()}</td><td><button className="row-action" aria-label={`${t('Add patient for')} ${collector.name}`} onClick={() => { setPatientDraft({ name: '', age: '', gender: 'Female', phone: '', labTechnicianId: '', sampleCollectorId: collector.id, referrerId: '' }); setPatientDialog(true) }}>•••</button></td></tr>)}</tbody></table>}
                {masterTab === 'tests' && <table><thead><tr><th>{t('TEST NAME')}</th><th>{t('CATEGORY')}</th><th>{t('PRICE')}</th><th>{t('PARAMETERS')}</th><th /></tr></thead><tbody>{store.tests.filter((test) => !search || `${test.name} ${test.category} ${test.parameters?.map((parameter) => parameter.name).join(' ') ?? ''}`.toLowerCase().includes(search.toLowerCase())).map((test) => <tr key={test.id}><td><div className="test-name-cell"><span className="test-row-icon"><Icon name="flask" size={16} /></span><span className="test-name-copy"><strong>{test.name}</strong><small>{test.profiles?.length ? test.profiles.map((profile) => t(testProfiles.find((item) => item.id === profile)?.label ?? 'Other tests')).join(', ') : t('Other tests')}</small></span></div></td><td><span className="category-tag">{test.category}</span></td><td>{test.price ? `₹${test.price.toLocaleString(dateLocale(uiLanguage))}` : t('Price not set')}</td><td>{test.parameters?.length ? test.parameters.map((parameter) => parameter.name).join(', ') : `Result${test.unit ? ` · ${test.unit}` : ''}${test.reference ? ` · ${test.reference}` : ''}`}</td><td><button className="row-action" aria-label={`${t('Actions for')} ${test.name}`}>•••</button></td></tr>)}</tbody></table>}
                <div className="table-footer"><span>{t('Showing')} {masterTabDetails[masterTab].count} {t('records')}</span><span>{t('Demo data is stored in this browser')}</span></div>
              </div>
            </section>
          )}

          {section === 'attendance' && !headAuthenticated && (
            <section className="page-section">
              <div className="page-heading"><div><span className="eyebrow">{t('RESTRICTED AREA')}</span><h1>{t('Head login')}</h1><p>{t('Log in to manage lab technician attendance.')}</p></div></div>
              <div className="attendance-login-card panel">
                <form className="dialog-form" onSubmit={loginHead}>
                  <p className="form-intro">{t('Only the lab head should access the attendance manager.')}</p>
                  <label>{t('Username')}<input required autoComplete="username" value={headUsername} onChange={(event) => setHeadUsername(event.target.value)} /></label>
                  <label>{t('Password')}<input required type="password" autoComplete="current-password" value={headPassword} onChange={(event) => setHeadPassword(event.target.value)} /></label>
                  {headLoginError && <p className="attendance-login-error" role="alert">{headLoginError}</p>}
                  <button type="submit" className="button button-primary">{t('Log in')}</button>
                </form>
                <p className="attendance-security-note">{t('Demo login only: it is not secure authentication and does not protect browser data.')}</p>
              </div>
            </section>
          )}

          {section === 'attendance' && headAuthenticated && (
            <section className="page-section">
              <div className="page-heading">
                <div><span className="eyebrow">{t('LAB WORKFLOW')}</span><h1>{t('Technician attendance')}</h1><p>{t('Manage daily attendance for lab technicians.')}</p></div>
                <button className="button button-outline" onClick={logoutHead}>{t('Log out')}</button>
              </div>
              <div className="result-cards attendance-summary">
                <div className="result-card"><span className="result-number">{store.attendance.filter((record) => record.date === attendanceDate && record.status === 'Present').length}</span><span>{t('Present')}</span></div>
                <div className="result-card"><span className="result-number">{store.attendance.filter((record) => record.date === attendanceDate && record.status === 'Absent').length}</span><span>{t('Absent')}</span></div>
                <div className="result-card"><span className="result-number">{store.attendance.filter((record) => record.date === attendanceDate && record.status === 'Leave').length}</span><span>{t('Leave')}</span></div>
                <div className="result-card"><span className="result-number">{store.labTechnicians.length - store.attendance.filter((record) => record.date === attendanceDate).length}</span><span>{t('Not marked')}</span></div>
              </div>
              <div className="panel list-panel attendance-list-panel">
                <div className="list-toolbar"><div><h2>{t('Attendance register')}</h2><p>{t('Select a status for each lab technician. Changes save in this browser.')}</p></div><label className="attendance-date-picker"><span>{t('Date')}</span><input type="date" value={attendanceDate} onChange={(event) => setAttendanceDate(event.target.value)} /></label></div>
                <table><thead><tr><th>{t('LAB TECHNICIAN')}</th><th>{t('DEPARTMENT / SPECIALTY')}</th><th>{t('ATTENDANCE STATUS')}</th></tr></thead><tbody>
                  {store.labTechnicians.map((technician) => {
                    const record = store.attendance.find((item) => item.labTechnicianId === technician.id && item.date === attendanceDate)
                    return <tr key={technician.id}>
                      <td><div className="person-cell"><span className="avatar">{technician.name.split(' ').slice(-1)[0].slice(0, 1)}</span><strong>{technician.name}</strong></div></td>
                      <td>{technician.specialty}</td>
                      <td><select className="attendance-status-select" aria-label={`${t('Attendance status for')} ${technician.name}`} value={record?.status ?? ''} onChange={(event) => {
                        const value = event.target.value
                        if (value === '' || value === 'Present' || value === 'Absent' || value === 'Leave') setTechnicianAttendance(technician.id, value)
                      }}>
                        <option value="">{t('Not marked')}</option>
                        <option value="Present">{t('Present')}</option>
                        <option value="Absent">{t('Absent')}</option>
                        <option value="Leave">{t('Leave')}</option>
                      </select></td>
                    </tr>
                  })}
                  {!store.labTechnicians.length && <tr><td className="empty-cell" colSpan={3}>{t('No lab technicians found.')}</td></tr>}
                </tbody></table>
                <div className="table-footer"><span>{store.labTechnicians.length} {t('Lab technicians').toLowerCase()}</span><span>{t('Attendance is stored in this browser.')}</span></div>
              </div>
              <p className="demo-notice">{t('Demo login only: it is not secure authentication and does not protect browser data.')}</p>
            </section>
          )}

          {section === 'patients' && (
            <section className="page-section">
              <div className="page-heading"><div><span className="eyebrow">{t('PATIENT DIRECTORY')}</span><h1>{t('Patients')}</h1><p>{t('Manage patient profiles and their requested lab tests.')}</p></div><button className="button button-primary" onClick={() => setPatientDialog(true)}><Icon name="plus" size={17} /> {t('Register patient')}</button></div>
              <div className="patient-summary-row"><div className="patient-summary"><span className="stat-icon mint"><Icon name="patients" /></span><span><small>{t('Total patients')}</small><strong>{store.patients.length}</strong></span></div><div className="patient-summary"><span className="stat-icon violet"><Icon name="flask" /></span><span><small>{t('Tests on record')}</small><strong>{store.orders.length}</strong></span></div><div className="patient-summary"><span className="stat-icon amber"><Icon name="clock" /></span><span><small>{t('Awaiting results')}</small><strong>{pendingCount}</strong></span></div></div>
              <div className="panel list-panel">
                <div className="list-toolbar"><div><h2>{t('All patients')}</h2><p>{t('A complete record of registered patients.')}</p></div><label className="table-search"><Icon name="search" size={16} /><input aria-label={t('Filter patient list')} placeholder={t('Filter patients')} value={search} onChange={(event) => setSearch(event.target.value)} /></label></div>
                <table><thead><tr><th>{t('PATIENT')}</th><th>{t('PATIENT ID')}</th><th>{t('AGE / GENDER')}</th><th>{t('PHONE')}</th><th>{t('LAB TECHNICIAN')}</th><th>{t('SAMPLE COLLECTOR')}</th><th>{t('TESTS')}</th><th>{t('REGISTERED')}</th><th /></tr></thead><tbody>
                  {filteredPatients.map((patient, index) => <tr key={patient.id}><td><div className="person-cell"><span className={`avatar avatar-${index % 4}`}>{patient.name.split(' ').map((word) => word[0]).slice(0, 2).join('')}</span><strong>{patient.name}</strong></div></td><td><span className="id-text">{patient.id}</span></td><td>{patient.age} {t('yrs')} <span className="muted">/ {t(patient.gender)}</span></td><td>{patient.phone}</td><td>{getLabTechnician(store, patient.labTechnicianId)}</td><td>{getSampleCollector(store, patient.sampleCollectorId)}</td><td><span className="test-count">{store.orders.filter((order) => order.patientId === patient.id).length}</span></td><td>{formatDate(patient.createdAt, uiLanguage)}</td><td><button className="button button-small button-outline" onClick={() => openTestDialog(patient.id)}><Icon name="plus" size={14} /> {t('Add test')}</button></td></tr>)}
                  {!filteredPatients.length && <tr><td className="empty-cell" colSpan={9}>{t('No patients match your search.')}</td></tr>}
                </tbody></table>
                <div className="table-footer"><span>{t('Showing')} {filteredPatients.length} {t('of')} {store.patients.length} {t('Patients').toLowerCase()}</span><span>{t('Page')} 1 of 1</span></div>
              </div>
            </section>
          )}

          {section === 'results' && (
            <section className="page-section">
              <div className="page-heading"><div><span className="eyebrow">{t('LAB WORKFLOW')}</span><h1>{t('Test results')}</h1><p>{t('Enter and review results, then prepare a patient report.')}</p></div><button className="button button-primary" onClick={() => openTestDialog()}><Icon name="plus" size={17} /> {t('Add test order')}</button></div>
              <div className="result-cards"><div className="result-card"><span className="result-number">{store.orders.length}</span><span>{t('Total orders')}</span></div><div className="result-card"><span className="result-number">{pendingCount}</span><span><i className="legend-dot amber-dot" /> {t('Pending')}</span></div><div className="result-card"><span className="result-number">{completedCount}</span><span><i className="legend-dot green-dot" /> {t('Completed')}</span></div></div>
              <div className="panel list-panel">
                <div className="list-toolbar"><div><h2>{t('Test queue')}</h2><p>{t('Results are entered and saved in this browser.')}</p></div><div className="result-list-controls"><label className="status-filter">{t('Status')}<select aria-label={t('Filter tests by status')} value={orderStatusFilter} onChange={(event) => setOrderStatusFilter(event.target.value as OrderStatusFilter)}><option value="All">{t('All')}</option><option value="Pending">{t('Pending')}</option><option value="Completed">{t('Completed')}</option></select></label><label className="table-search"><Icon name="search" size={16} /><input aria-label={t('Filter test orders')} placeholder={t('Filter tests')} value={search} onChange={(event) => setSearch(event.target.value)} /></label></div></div>
                <table><thead><tr><th>{t('ORDER / PATIENT')}</th><th>{t('TEST')}</th><th>{t('ORDERED')}</th><th>{t('RESULT')}</th><th>{t('REFERENCE')}</th><th>{t('Status').toUpperCase()}</th><th>{t('ACTIONS')}</th></tr></thead><tbody>
                  {filteredOrders.map((order) => {
                    const test = getTest(store, order.testId)
                    const parameters = getTestParameters(store, order)
                    const isParameterized = Boolean(test?.parameters?.length)
                    return <tr key={order.id}>
                      <td><div className="order-patient"><strong>{getPatientName(store, order.patientId)}</strong><small>{order.id} · {order.patientId}</small></div></td>
                      <td><strong className="normal-weight">{test?.name ?? t('Test removed')}</strong></td>
                      <td>{formatDate(order.createdAt, uiLanguage)}</td>
                      <td>{isParameterized
                        ? <div className="parameter-result-inputs">{parameters.map((parameter) => {
                          const draftKey = `${order.id}:${parameter.id}`
                          return <label key={parameter.id}><span>{parameter.name}{parameter.unit ? ` · ${parameter.unit}` : ''}</span><input className={`result-input ${order.status === 'Completed' ? 'result-input-complete' : ''}`} aria-label={`${parameter.name} ${t('result for')} ${order.id}`} placeholder={t('Enter result')} value={resultDrafts[draftKey] ?? getParameterResult(order, parameter)} onChange={(event) => setResultDrafts({ ...resultDrafts, [draftKey]: event.target.value })} /></label>
                        })}</div>
                        : <input className={`result-input ${order.status === 'Completed' ? 'result-input-complete' : ''}`} aria-label={`${t('Result for')} ${order.id}`} placeholder={t('Enter result')} value={resultDrafts[order.id] ?? order.result} onChange={(event) => setResultDrafts({ ...resultDrafts, [order.id]: event.target.value })} />}
                      </td>
                      <td>{isParameterized ? t('See parameter ranges') : test?.reference ?? '—'}</td>
                      <td><span className={`status-pill ${order.status === 'Completed' ? 'status-complete' : 'status-pending'}`}><i />{t(order.status)}</span></td>
                      <td><div className="action-group"><button className="button button-small button-outline" onClick={() => saveOrderResults(order)}>{t('Save')}</button><button className="row-action" title={t('Show report')} onClick={() => openPatientReport(order.patientId)}><Icon name="report" size={16} /></button></div></td>
                    </tr>
                  })}
                  {!filteredOrders.length && <tr><td className="empty-cell" colSpan={7}>{t('No test orders match your search.')}</td></tr>}
                </tbody></table>
                <div className="table-footer"><span>{filteredOrders.length} {t('test orders')}</span><span>{t('Results must be reviewed by qualified laboratory staff')}</span></div>
              </div>
            </section>
          )}

          {section === 'report-generation' && (
            <section className="page-section">
              <div className="page-heading"><div><span className="eyebrow">{t('PATIENT REPORTS')}</span><h1>{t('Report generation')}</h1><p>{t('Review and enter individual test parameters, then print one or all patient tests.')}</p></div></div>
              <div className="panel report-generator-panel">
                <div className="report-generator-toolbar">
                  <label className="patient-picker"><span>{t('Select patient')}</span><select value={generationPatientId} onChange={(event) => setGenerationPatientId(event.target.value)}><option value="">{t('Choose a patient')}</option>{store.patients.map((patient) => <option key={patient.id} value={patient.id}>{patient.name} · {patient.id}</option>)}</select></label>
                  {generationPatientId && <button className="button button-primary" disabled={!generationOrders.length} onClick={() => openTestReport(generationPatientId, null)}><Icon name="print" size={15} /> {t('Print all tests')}</button>}
                </div>
                {!generationPatientId && <div className="report-empty-state"><span className="stat-icon mint"><Icon name="patients" /></span><strong>{t('Select a patient to get started')}</strong><p>{t('The patient’s ordered tests and report parameters will appear here.')}</p></div>}
                {generationPatientId && <>
                  {generationOrders.length > 0
                    ? <div className="report-table-scroll"><table className="generation-table"><thead><tr><th>{t('TEST NAME')}</th><th>{t('PARAMETER')}</th><th>{t('RESULT')}</th><th>{t('UNIT')}</th><th>{t('REFERENCE RANGE')}</th><th>{t('PRINT')}</th></tr></thead><tbody>
                      {generationOrders.map((order) => {
                        const test = getTest(store, order.testId)
                        const parameters = getTestParameters(store, order)
                        return parameters.map((parameter, index) => {
                          const draftKey = `${order.id}:${parameter.id}`
                          return <tr key={`${order.id}:${parameter.id}`}>
                            {index === 0 && <td rowSpan={parameters.length}><div className="generation-test-name"><strong>{test?.name ?? t('Test removed')}</strong><small>{order.id} · {t(order.status)}</small></div></td>}
                            <td>{parameter.name}</td>
                            <td><input className="result-input generation-result-input" aria-label={`${parameter.name} ${t('for')} ${getPatientName(store, generationPatientId)}`} placeholder={t('Enter result')} value={resultDrafts[draftKey] ?? getParameterResult(order, parameter)} onChange={(event) => updateParameterResult(order, parameter, event.target.value)} /></td>
                            <td>{parameter.unit || '—'}</td>
                            <td>{parameter.reference || '—'}</td>
                            {index === 0 && <td rowSpan={parameters.length}><div className="print-action"><button className="button button-small button-outline" onClick={() => openTestReport(generationPatientId, [order.id])}><Icon name="print" size={14} /> {t('Print test')}</button>{order.printedAt && <span className="printed-indicator" title={`${t('Report already printed')} · ${formatDate(order.printedAt, uiLanguage)}`} aria-label={t('Report already printed')}><Icon name="check" size={15} /></span>}</div></td>}
                          </tr>
                        })
                      })}
                    </tbody></table></div>
                    : <div className="report-empty-state"><span className="stat-icon amber"><Icon name="flask" /></span><strong>{t('No tests ordered for this patient')}</strong><p>{t('Add one or more tests from the Patients or Test results tab first.')}</p></div>}
                </>}
                <div className="table-footer"><span>{generationOrders.length} {t(generationOrders.length === 1 ? 'test for selected patient' : 'tests for selected patient')}</span><span>{t('Report values are saved as you enter them')}</span></div>
              </div>
              <p className="demo-notice">{t('Reports are drafts. Verify every value and have a qualified professional review before release.')}</p>
            </section>
          )}

          {section === 'reports' && (
            <section className="page-section">
              <div className="page-heading"><div><span className="eyebrow">{t('INSIGHTS & DOCUMENTS')}</span><h1>{t('Reports')}</h1><p>{t('Review report collection, activity trends and lab performance.')}</p></div><button className="button button-outline" onClick={() => window.print()}><Icon name="download" size={16} /> {t('Export / print')}</button></div>
              <div className="report-period-tabs">{(['Daily', 'Weekly', 'Monthly'] as const).map((period) => <button key={period} className={reportPeriod === period ? 'selected' : ''} onClick={() => setReportPeriod(period)}>{t(period)}</button>)}</div>
              <div className="stats-grid report-stats">
                <article className="stat-card"><span className="stat-label">{t(reportPeriod)} {t('collections')}</span><strong>{filteredReports.length}</strong><small>{t('Test orders in selected period')}</small></article>
                <article className="stat-card"><span className="stat-label">{t('Completed reports')}</span><strong>{filteredReports.filter((order) => order.status === 'Completed').length}</strong><small>{t('Ready for review and printing')}</small></article>
                <article className="stat-card"><span className="stat-label">{t('Awaiting results')}</span><strong>{filteredReports.filter((order) => order.status === 'Pending').length}</strong><small>{t('Pending in selected period')}</small></article>
                <article className="stat-card"><span className="stat-label">{t('Collection value')}</span><strong>₹{filteredReports.reduce((sum, order) => sum + (getTest(store, order.testId)?.price ?? 0), 0).toLocaleString(dateLocale(uiLanguage))}</strong><small>{t('Estimated from catalogue prices')}</small></article>
              </div>
              <div className="dashboard-grid report-grid">
                <article className="panel report-collection">
                  <div className="panel-heading"><div><h2>{t(reportPeriod)} {t('report collection')}</h2><p>{t('Open a patient report for review or printing.')}</p></div><span className="period-pill">{t(reportPeriod)} <span>⌄</span></span></div>
                  <OrderTable orders={filteredReports} store={store} onReport={openPatientReport} compact language={uiLanguage} />
                  {!filteredReports.length && <p className="empty-message">{t('No orders found for this period.')}</p>}
                </article>
                <article className="panel analysis-panel">
                  <div className="panel-heading"><div><h2>{t('Analysis')}</h2><p>{t('Test category distribution')}</p></div><span className="chart-icon"><Icon name="trend" size={17} /></span></div>
                  {Array.from(new Set(store.tests.map((test) => test.category))).slice(0, 4).map((category, index) => {
                    const count = store.orders.filter((order) => getTest(store, order.testId)?.category === category).length
                    const percent = store.orders.length ? (count / store.orders.length) * 100 : 0
                    return <div className="analysis-row" key={category}><div><span>{category}</span><strong>{count} {t('test')}</strong></div><div className="analysis-track"><span className={`analysis-fill fill-${index}`} style={{ width: `${Math.max(percent, 4)}%` }} /></div></div>
                  })}
                  <div className="analysis-foot"><span>{t('Based on')} {store.orders.length} {t('orders')}</span><span><Icon name="trend" size={13} /> {t('Live')}</span></div>
                </article>
              </div>
              <p className="demo-notice">{t('Reports and analytics are based on the records currently saved in this browser.')}</p>
            </section>
          )}

          {section === 'revenue' && (
            <section className="page-section">
              <div className="page-heading"><div><span className="eyebrow">{t('REVENUE OVERVIEW')}</span><h1>{t('Revenue')}</h1><p>{t('See estimated business by date and assigned staff.')}</p></div></div>
              <div className="revenue-toolbar">
                <div className="report-period-tabs" role="group" aria-label={t('Revenue period')}>
                  {(['Daily', 'Weekly', 'Monthly'] as const).map((period) => <button key={period} className={revenuePeriod === period ? 'selected' : ''} aria-pressed={revenuePeriod === period} onClick={() => setRevenuePeriod(period)}>{t(period)}</button>)}
                </div>
                <label className="revenue-date-control"><span>{t('Select date')}</span><input type="date" value={revenueDate} onChange={(event) => { if (event.target.value) setRevenueDate(event.target.value) }} /></label>
              </div>
              <p className="revenue-range-label">{revenueRangeLabel}</p>
              <div className="stats-grid revenue-stats">
                <article className="stat-card"><span className="stat-label">{t('Total estimated revenue')}</span><strong>{formatRevenue(revenueTotal, uiLanguage)}</strong><small>{t('Based on test catalogue prices')}</small></article>
                <article className="stat-card"><span className="stat-label">{t('Test orders')}</span><strong>{revenueOrders.length.toLocaleString(dateLocale(uiLanguage))}</strong><small>{t('Orders in selected period')}</small></article>
                <article className="stat-card"><span className="stat-label">{t('Orders without price')}</span><strong>{unpricedRevenueOrders.toLocaleString(dateLocale(uiLanguage))}</strong><small>{t('Not included in estimated revenue')}</small></article>
              </div>
              <article className="panel revenue-daily-panel">
                <div className="panel-heading"><div><h2>{t('Revenue by date')}</h2><p>{revenueRangeLabel}</p></div></div>
                <div className="revenue-table-wrap">
                  <table className="revenue-table revenue-date-table">
                    <thead><tr><th>{t('Date')}</th><th>{t('Test orders')}</th><th>{t('Business')}</th></tr></thead>
                    <tbody>{revenueByDay.map((day) => <tr key={dateInputValue(day.date)}><td>{new Intl.DateTimeFormat(dateLocale(uiLanguage), { weekday: revenuePeriod === 'Daily' ? 'long' : 'short', day: 'numeric', month: revenuePeriod === 'Daily' ? 'long' : 'short', year: revenuePeriod === 'Daily' ? 'numeric' : undefined }).format(day.date)}</td><td>{day.orders.toLocaleString(dateLocale(uiLanguage))}</td><td><strong>{formatRevenue(day.amount, uiLanguage)}</strong></td></tr>)}</tbody>
                  </table>
                </div>
              </article>
              <div className="revenue-breakdown-grid">
                <RevenueBreakdownPanel title={t('Doctor / referrer')} rows={doctorRevenue} language={uiLanguage} />
                <RevenueBreakdownPanel title={t('Lab technicians')} rows={technicianRevenue} language={uiLanguage} />
                <RevenueBreakdownPanel title={t('Sample collectors')} rows={collectorRevenue} language={uiLanguage} />
              </div>
              <p className="demo-notice">{t('Revenue is estimated from current catalogue prices for orders placed in the selected period. Orders without a price are not included; this is not a payment or profit report.')}</p>
            </section>
          )}
        </div>
      </main>

      {patientDialog && <Dialog title={t('Register a patient')} onClose={() => setPatientDialog(false)} language={uiLanguage}>
        <form className="dialog-form" onSubmit={addPatient}>
          <p className="form-intro">{t('Create a profile to start adding lab tests. Demo mode only — please use fictional data.')}</p>
          <label>{t('Full name')}<input required autoFocus value={patientDraft.name} onChange={(event) => setPatientDraft({ ...patientDraft, name: event.target.value })} placeholder={t('e.g. Maya Sharma')} /></label>
          <div className="form-row"><label>{t('Age')}<input required type="number" min="0" max="120" value={patientDraft.age} onChange={(event) => setPatientDraft({ ...patientDraft, age: event.target.value })} placeholder={t('Age')} /></label><label>{t('Gender')}<select value={patientDraft.gender} onChange={(event) => setPatientDraft({ ...patientDraft, gender: event.target.value })}><option value="Female">{t('Female')}</option><option value="Male">{t('Male')}</option><option value="Other">{t('Other')}</option><option value="Prefer not to say">{t('Prefer not to say')}</option></select></label></div>
          <label>{t('Phone number')}<input required value={patientDraft.phone} onChange={(event) => setPatientDraft({ ...patientDraft, phone: event.target.value })} placeholder="+91 00000 00000" /></label>
          <div className="form-row"><label>{t('lab technician')}<select value={patientDraft.labTechnicianId} onChange={(event) => setPatientDraft({ ...patientDraft, labTechnicianId: event.target.value })}><option value="">{t('Select lab technician')}</option>{store.labTechnicians.map((technician) => <option key={technician.id} value={technician.id}>{technician.name}</option>)}</select></label><label>{t('sample collector')}<select value={patientDraft.sampleCollectorId} onChange={(event) => setPatientDraft({ ...patientDraft, sampleCollectorId: event.target.value })}><option value="">{t('Select sample collector')}</option>{store.sampleCollectors.map((collector) => <option key={collector.id} value={collector.id}>{collector.name}</option>)}</select></label></div>
          <label>{t('Referred by')}<select value={patientDraft.referrerId} onChange={(event) => setPatientDraft({ ...patientDraft, referrerId: event.target.value })}><option value="">{t('Select referrer')}</option>{store.referrers.map((referrer) => <option key={referrer.id} value={referrer.id}>{referrer.name}</option>)}</select></label>
          <div className="dialog-actions"><button type="button" className="button button-outline" onClick={() => setPatientDialog(false)}>{t('Cancel')}</button><button type="submit" className="button button-primary">{t('Register patient')}</button></div>
        </form>
      </Dialog>}

      {testDialog && <Dialog title={t('Add a test order')} onClose={() => setTestDialog(false)} language={uiLanguage}>
        <form className="dialog-form" onSubmit={addTestOrder}>
          <p className="form-intro">{t('Select a patient and profile, then choose one or more tests from that profile.')}</p>
          <label>{t('Patient')}<select required value={selectedPatientId} onChange={(event) => setSelectedPatientId(event.target.value)}><option value="">{t('Select patient')}</option>{store.patients.map((patient) => <option key={patient.id} value={patient.id}>{patient.name} · {patient.id}</option>)}</select></label>
          <label>{t('Test profile')}<select required value={selectedTestProfile} onChange={(event) => { setSelectedTestProfile(event.target.value as TestProfile | ''); setSelectedTestIds([]) }}><option value="">{t('Select test profile')}</option>{testProfiles.map((profile) => <option key={profile.id} value={profile.id}>{t(profile.label)}</option>)}</select></label>
          <fieldset className="test-selection"><legend>{t('Tests')} <span>{selectedTestIds.length} {t('selected')}</span></legend>
            {!selectedTestProfile && <p className="empty-message">{t('Select a profile to see its tests.')}</p>}
            {selectedTestProfile && selectedProfileTests.map((test) => <label className="test-option" key={test.id}><input type="checkbox" checked={selectedTestIds.includes(test.id)} onChange={(event) => setSelectedTestIds(event.target.checked ? [...selectedTestIds, test.id] : selectedTestIds.filter((id) => id !== test.id))} /><span><strong>{test.name}</strong><small>{test.category}{test.parameters?.length ? ` · ${test.parameters.length} ${t('parameters')}` : ''}</small></span><b>{test.price ? `₹${test.price.toLocaleString(dateLocale(uiLanguage))}` : t('Price not set')}</b></label>)}
          </fieldset>
          <div className="dialog-actions"><button type="button" className="button button-outline" onClick={() => setTestDialog(false)}>{t('Cancel')}</button><button type="submit" className="button button-primary" disabled={!selectedPatientId || !selectedTestIds.length}>{t('Add')} {selectedTestIds.length || ''} {t('Add to queue')}</button></div>
        </form>
      </Dialog>}

      {masterDialog && <Dialog title={`${t('Add')} ${masterTabDetails[masterDialog].singular}`} onClose={() => setMasterDialog(null)} className={masterDialog === 'tests' ? 'test-master-dialog' : ''} language={uiLanguage}>
        <form className="dialog-form" onSubmit={addMaster}>
          <label>{t(masterDialog === 'tests' ? 'Test name' : 'Full name')}<input required autoFocus value={masterDraft.name} onChange={(event) => setMasterDraft({ ...masterDraft, name: event.target.value })} placeholder={t(masterDialog === 'tests' ? 'e.g. Vitamin D' : 'e.g. Maya Rao')} /></label>
          {masterDialog === 'lab-technicians' && <label>{t('Department / specialty')}<input required value={masterDraft.specialty} onChange={(event) => setMasterDraft({ ...masterDraft, specialty: event.target.value })} placeholder={t('e.g. Hematology')} /></label>}
          {masterDialog === 'referrers' && <label>{t('Organization')}<input required value={masterDraft.organization} onChange={(event) => setMasterDraft({ ...masterDraft, organization: event.target.value })} placeholder={t('Clinic or hospital')} /></label>}
          {masterDialog === 'tests' && <>
            <div className="form-row"><label>{t('Category')}<input required value={masterDraft.category} onChange={(event) => setMasterDraft({ ...masterDraft, category: event.target.value })} placeholder={t('e.g. Biochemistry')} /></label><label>{t('Price (₹)')}<input required type="number" min="0" value={masterDraft.price} onChange={(event) => setMasterDraft({ ...masterDraft, price: event.target.value })} placeholder="0" /></label></div>
            <div className="test-parameter-editor">
              <div className="parameter-editor-heading"><strong>{t('Test parameters')}</strong><button type="button" className="button button-small button-outline" onClick={() => setParameterDrafts((drafts) => [...drafts, { name: '', unit: '', reference: '' }])}><Icon name="plus" size={13} /> {t('Add parameter')}</button></div>
              {parameterDrafts.map((parameter, index) => <div className="parameter-draft-row" key={index}>
                <label>{t('Parameter name')}<input required value={parameter.name} onChange={(event) => setParameterDrafts((drafts) => drafts.map((draft, row) => row === index ? { ...draft, name: event.target.value } : draft))} placeholder={t('e.g. Hemoglobin')} /></label>
                <label>{t('Unit')}<input value={parameter.unit} onChange={(event) => setParameterDrafts((drafts) => drafts.map((draft, row) => row === index ? { ...draft, unit: event.target.value } : draft))} placeholder={t('e.g. g/dL')} /></label>
                <label>{t('REFERENCE RANGE')}<input value={parameter.reference} onChange={(event) => setParameterDrafts((drafts) => drafts.map((draft, row) => row === index ? { ...draft, reference: event.target.value } : draft))} placeholder={t('Optional')} /></label>
                <button type="button" className="button button-small button-outline parameter-remove" aria-label={`${t('Remove parameter')} ${index + 1}`} disabled={parameterDrafts.length === 1} onClick={() => setParameterDrafts((drafts) => drafts.filter((_, row) => row !== index))}>{t('Remove')}</button>
              </div>)}
            </div>
          </>}
          {masterDialog !== 'tests' && <label>{t('Phone number')}<input value={masterDraft.phone} onChange={(event) => setMasterDraft({ ...masterDraft, phone: event.target.value })} placeholder="+91 00000 00000" /></label>}
          <div className="dialog-actions"><button type="button" className="button button-outline" onClick={() => setMasterDialog(null)}>{t('Cancel')}</button><button type="submit" className="button button-primary">{t('Add record')}</button></div>
        </form>
      </Dialog>}

      {selectedReportPatient && <Dialog title={t('Patient report')} onClose={() => { setReportPatientId(null); setReportOrderIds(null); setAiInterpretation(null); setAiError('') }} className="report-dialog" language={uiLanguage}>
        <div className="report-toolbar"><span className="status-pill status-complete"><i /> {t('Review before release')}</span><div className="report-toolbar-actions"><button className="button button-outline button-small" disabled={sharingReport} onClick={sharePatientReportOnWhatsApp}>{sharingReport ? t('Creating PDF…') : t('Send PDF on WhatsApp')}</button><button className="button button-outline button-small" onClick={printPatientReport}><Icon name="print" size={15} /> {t('Print report')}</button></div></div>
        <div className="printable-report" ref={reportRef}>
          <div className="report-brand"><span className="brand-mark"><Icon name="flask" size={19} /></span><div><strong>PRIME AI LAB</strong><small>{t('LABORATORY TEST REPORT')}</small></div></div>
          <div className="report-patient-info"><div><small>{t('PATIENT NAME')}</small><strong>{selectedReportPatient.name}</strong></div><div><small>{t('PATIENT ID')}</small><strong>{selectedReportPatient.id}</strong></div><div><small>{t('AGE / GENDER')}</small><strong>{selectedReportPatient.age} {t('yrs')} / {t(selectedReportPatient.gender)}</strong></div><div><small>{t('REPORT DATE')}</small><strong>{formatDate(new Date().toISOString(), uiLanguage)}</strong></div><div><small>{t('LAB TECHNICIAN')}</small><strong>{getLabTechnician(store, selectedReportPatient.labTechnicianId)}</strong></div><div><small>{t('SAMPLE COLLECTOR')}</small><strong>{getSampleCollector(store, selectedReportPatient.sampleCollectorId)}</strong></div><div><small>{t('REFERRED BY')}</small><strong>{getReferrer(store, selectedReportPatient.referrerId)}</strong></div></div>
          <div className="report-results-scroll"><table className="report-results-table"><thead><tr><th>{t('TEST')}</th><th>{t('PARAMETER')}</th><th>{t('RESULT')}</th><th>{t('UNIT')}</th><th>{t('REFERENCE RANGE')}</th><th>{t('Status').toUpperCase()}</th></tr></thead><tbody>{selectedPatientOrders.flatMap((order) => {
            const test = getTest(store, order.testId)
            return getTestParameters(store, order).map((parameter) => <tr key={`${order.id}:${parameter.id}`}><td>{test?.name ?? t('Test removed')}</td><td>{parameter.name}</td><td><strong>{getParameterResult(order, parameter) || t('Pending')}</strong></td><td>{parameter.unit || '—'}</td><td>{parameter.reference || '—'}</td><td>{t(order.status)}</td></tr>)
          })}</tbody></table></div>
          <section className="ai-interpretation" aria-live="polite">
            <div className="ai-interpretation-heading"><div><strong><Icon name="spark" size={15} /> {t('Plain-language explanation')}</strong><small>{t('Cloud AI · test results and age are sent; name, ID, and phone are not')}</small></div><div className="ai-controls"><label htmlFor="ai-language">{t('Language')}</label><select id="ai-language" value={aiLanguage} onChange={(event) => { const language = event.target.value; if (language === 'Marathi' || language === 'English' || language === 'Hindi') setAiLanguage(language) }}><option value="Marathi">मराठी</option><option value="English">English</option><option value="Hindi">हिन्दी</option></select><button className="button button-small button-primary" disabled={aiLoading || !selectedPatientOrders.length} onClick={generateAiInterpretation}><Icon name="spark" size={14} />{aiLoading ? t('Generating…') : t('Explain results')}</button></div></div>
            {aiError && <p className="ai-error" role="alert">{aiError}</p>}
            {aiLoading && <p className="ai-status">{t('The selected cloud AI provider is preparing a short explanation. Keep this report open.')}</p>}
            {aiInterpretation && <div className="ai-interpretation-result"><span>{t('Generated with')} {aiInterpretation.model}</span><p>{aiInterpretation.text}</p></div>}
            {!aiError && !aiLoading && !aiInterpretation && <p className="ai-status">{t('Explanation compares values with the shown ranges and may describe general possible contributors and safe next steps. It is educational, not a diagnosis or treatment; clinician review is required.')}</p>}
          </section>
          <div className="ai-disclaimer"><span><Icon name="spark" size={17} /></span><p><strong>{t('AI-assisted explanation')}</strong><br />{t('The optional AI text is educational and may be inaccurate. It is not a diagnosis or treatment advice. A qualified professional must verify results and review the report before release.')}</p></div>
          <div className="report-signoff"><span>{t('Authorized by: ____________________')}</span><span>{t('Signature: ____________________')}</span></div>
          <p className="report-footer-note">{t('Confidential laboratory record · Prepared for professional review')}</p>
        </div>
      </Dialog>}
      {toast && <div className="toast-message" role="status"><Icon name="check" size={16} />{toast}</div>}
    </div>
  )
}

function OrderTable({ orders, store, onReport, compact = false, language }: { orders: LabOrder[]; store: Store; onReport: (patientId: string) => void; compact?: boolean; language: UiLanguage }) {
  const t = (text: string) => translate(language, text)
  const rows = compact ? orders.slice(0, 5) : orders
  return (
    <table className="activity-table"><thead><tr><th>{t('PATIENT')}</th><th>{t('TEST')}</th><th>{t('DATE')}</th><th>{t('Status').toUpperCase()}</th><th /></tr></thead><tbody>
      {rows.map((order) => <tr key={order.id}><td><div className="order-patient"><strong>{getPatientName(store, order.patientId)}</strong><small>{order.id}</small></div></td><td>{getTest(store, order.testId)?.name ?? t('Test removed')}</td><td>{formatDate(order.createdAt, language)}</td><td><span className={`status-pill ${order.status === 'Completed' ? 'status-complete' : 'status-pending'}`}><i />{t(order.status)}</span></td><td><button className="row-action" aria-label={`${t('Show report for')} ${getPatientName(store, order.patientId)}`} onClick={() => onReport(order.patientId)}><Icon name="arrow" size={15} /></button></td></tr>)}
      {!rows.length && <tr><td colSpan={5} className="empty-cell">{t('No activity yet. Add a patient test to get started.')}</td></tr>}
    </tbody></table>
  )
}

export default App
