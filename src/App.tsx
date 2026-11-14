import { useEffect, useMemo, useState, type FormEvent, type ReactNode } from 'react'
import './App.css'

type Section = 'overview' | 'masters' | 'patients' | 'results' | 'report-generation' | 'reports'
type MasterTab = 'doctors' | 'referrers' | 'tests'
type ReportPeriod = 'Daily' | 'Weekly' | 'Monthly'
type OrderStatus = 'Pending' | 'Completed'
type ExplanationLanguage = 'Marathi' | 'English' | 'Hindi'

type Doctor = { id: string; name: string; specialty: string; phone: string }
type Referrer = { id: string; name: string; organization: string; phone: string }
type Patient = {
  id: string
  name: string
  age: number
  gender: string
  phone: string
  doctorId: string
  referrerId: string
  createdAt: string
}
type TestParameter = { id: string; name: string; unit: string; reference?: string }
type LabTest = {
  id: string
  name: string
  category: string
  price: number
  unit: string
  reference: string
  parameters?: TestParameter[]
}
type LabOrder = {
  id: string
  patientId: string
  testId: string
  createdAt: string
  result: string
  parameterResults?: Record<string, string>
  status: OrderStatus
}
type Store = {
  doctors: Doctor[]
  referrers: Referrer[]
  patients: Patient[]
  tests: LabTest[]
  orders: LabOrder[]
}

const STORAGE_KEY = 'primeaisolution-lab-v1'
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

function daysAgo(days: number) {
  const date = new Date()
  date.setDate(date.getDate() - days)
  return date.toISOString()
}

const initialStore: Store = {
  doctors: [
    { id: 'dr-1', name: 'Dr. Ananya Rao', specialty: 'General Medicine', phone: '+91 98765 43210' },
    { id: 'dr-2', name: 'Dr. Karan Mehta', specialty: 'Cardiology', phone: '+91 98765 43211' },
    { id: 'dr-3', name: 'Dr. Sana Iyer', specialty: 'Endocrinology', phone: '+91 98765 43212' },
  ],
  referrers: [
    { id: 'ref-1', name: 'Dr. Vivek Shah', organization: 'Greenfield Clinic', phone: '+91 98765 43213' },
    { id: 'ref-2', name: 'Dr. Meera Nair', organization: 'City Care Centre', phone: '+91 98765 43214' },
  ],
  patients: [
    { id: 'PT-2401', name: 'Aarav Sharma', age: 34, gender: 'Male', phone: '+91 98100 11001', doctorId: 'dr-1', referrerId: 'ref-1', createdAt: daysAgo(0) },
    { id: 'PT-2402', name: 'Diya Patel', age: 28, gender: 'Female', phone: '+91 98100 11002', doctorId: 'dr-2', referrerId: 'ref-2', createdAt: daysAgo(0) },
    { id: 'PT-2403', name: 'Kabir Verma', age: 46, gender: 'Male', phone: '+91 98100 11003', doctorId: 'dr-1', referrerId: 'ref-1', createdAt: daysAgo(1) },
    { id: 'PT-2404', name: 'Anika Das', age: 52, gender: 'Female', phone: '+91 98100 11004', doctorId: 'dr-3', referrerId: 'ref-2', createdAt: daysAgo(2) },
    { id: 'PT-2405', name: 'Rohan Kapoor', age: 39, gender: 'Male', phone: '+91 98100 11005', doctorId: 'dr-2', referrerId: 'ref-1', createdAt: daysAgo(3) },
  ],
  tests: [
    { id: 'test-1', name: 'CBC – Complete Blood Count', category: 'Hematology', price: 450, unit: 'g/dL', reference: '12.0–17.5', parameters: cbcParameters },
    { id: 'test-2', name: 'Fasting Blood Glucose', category: 'Biochemistry', price: 250, unit: 'mg/dL', reference: '70–100' },
    { id: 'test-3', name: 'Lipid Profile', category: 'Biochemistry', price: 850, unit: 'mg/dL', reference: '< 200 total' },
    { id: 'test-4', name: 'Thyroid Profile (TSH)', category: 'Immunology', price: 600, unit: 'µIU/mL', reference: '0.4–4.0' },
    { id: 'test-5', name: 'Liver Function Test', category: 'Biochemistry', price: 950, unit: 'U/L', reference: '7–56' },
    { id: 'test-6', name: 'Peripheral Blood Smear', category: 'Hematology', price: 500, unit: '', reference: '', parameters: smearParameters },
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
}

function readStore(): Store {
  try {
    const saved = localStorage.getItem(STORAGE_KEY)
    if (!saved) return initialStore
    const parsed: unknown = JSON.parse(saved)
    if (
      typeof parsed === 'object' &&
      parsed !== null &&
      'doctors' in parsed &&
      'referrers' in parsed &&
      'patients' in parsed &&
      'tests' in parsed &&
      'orders' in parsed &&
      Array.isArray(parsed.doctors) &&
      Array.isArray(parsed.referrers) &&
      Array.isArray(parsed.patients) &&
      Array.isArray(parsed.tests) &&
      Array.isArray(parsed.orders)
    ) {
      const savedStore = parsed as Store
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
      return { ...savedStore, tests, orders }
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

function formatDate(value: string) {
  return new Intl.DateTimeFormat('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }).format(new Date(value))
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

function getDoctor(store: Store, id: string) {
  return store.doctors.find((doctor) => doctor.id === id)?.name ?? '—'
}

function getReferrer(store: Store, id: string) {
  return store.referrers.find((referrer) => referrer.id === id)?.name ?? '—'
}

function Dialog({ title, onClose, children, className = '' }: { title: string; onClose: () => void; children: ReactNode; className?: string }) {
  return (
    <div className="dialog-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose() }}>
      <section className={`dialog ${className}`} role="dialog" aria-modal="true" aria-labelledby="dialog-title">
        <div className="dialog-heading">
          <div><span className="eyebrow">PRIME AI LAB</span><h2 id="dialog-title">{title}</h2></div>
          <button className="icon-button" aria-label="Close dialog" onClick={onClose}><Icon name="close" /></button>
        </div>
        {children}
      </section>
    </div>
  )
}

function App() {
  const [store, setStore] = useState<Store>(readStore)
  const [section, setSection] = useState<Section>('overview')
  const [masterTab, setMasterTab] = useState<MasterTab>('doctors')
  const [reportPeriod, setReportPeriod] = useState<ReportPeriod>('Daily')
  const [search, setSearch] = useState('')
  const [patientDialog, setPatientDialog] = useState(false)
  const [testDialog, setTestDialog] = useState(false)
  const [masterDialog, setMasterDialog] = useState<MasterTab | null>(null)
  const [reportPatientId, setReportPatientId] = useState<string | null>(null)
  const [reportOrderIds, setReportOrderIds] = useState<string[] | null>(null)
  const [generationPatientId, setGenerationPatientId] = useState('')
  const [aiLanguage, setAiLanguage] = useState<ExplanationLanguage>('Marathi')
  const [aiInterpretation, setAiInterpretation] = useState<{ text: string; model: string } | null>(null)
  const [aiLoading, setAiLoading] = useState(false)
  const [aiError, setAiError] = useState('')
  const [selectedPatientId, setSelectedPatientId] = useState('')
  const [selectedTestIds, setSelectedTestIds] = useState<string[]>([])
  const [patientDraft, setPatientDraft] = useState({ name: '', age: '', gender: 'Female', phone: '', doctorId: '', referrerId: '' })
  const [masterDraft, setMasterDraft] = useState({ name: '', specialty: '', organization: '', phone: '', category: '', price: '', unit: '', reference: '' })
  const [resultDrafts, setResultDrafts] = useState<Record<string, string>>({})
  const [toast, setToast] = useState('')

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
      setToast('Could not save changes in this browser.')
    }
  }

  const notify = (message: string) => {
    setToast(message)
    window.setTimeout(() => setToast(''), 2600)
  }

  const updateOrder = (id: string, changes: Partial<LabOrder>) => {
    persist({ ...store, orders: store.orders.map((order) => order.id === id ? { ...order, ...changes } : order) })
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

  const filteredPatients = useMemo(() => {
    const term = search.trim().toLowerCase()
    if (!term) return store.patients
    return store.patients.filter((patient) =>
      [patient.id, patient.name, patient.phone, getDoctor(store, patient.doctorId)].some((value) => value.toLowerCase().includes(term)),
    )
  }, [search, store])

  const filteredOrders = useMemo(() => {
    const term = search.trim().toLowerCase()
    return store.orders.filter((order) => {
      const patient = store.patients.find((item) => item.id === order.patientId)
      const test = getTest(store, order.testId)
      return !term || [order.id, patient?.name ?? '', patient?.id ?? '', test?.name ?? ''].some((value) => value.toLowerCase().includes(term))
    })
  }, [search, store])

  const pendingCount = store.orders.filter((order) => order.status === 'Pending').length
  const todayCount = store.orders.filter((order) => new Date(order.createdAt).toDateString() === new Date().toDateString()).length
  const completedCount = store.orders.filter((order) => order.status === 'Completed').length
  const revenue = store.orders.reduce((sum, order) => sum + (getTest(store, order.testId)?.price ?? 0), 0)
  const weeklyOrders = store.orders.filter((order) => (Date.now() - new Date(order.createdAt).getTime()) / 86400000 < 7)
  const volumeByDay = Array.from({ length: 7 }, (_, index) => {
    const date = new Date()
    date.setDate(date.getDate() - (6 - index))
    return {
      label: new Intl.DateTimeFormat('en-IN', { weekday: 'short' }).format(date),
      count: store.orders.filter((order) => new Date(order.createdAt).toDateString() === date.toDateString()).length,
    }
  })
  const maxDailyVolume = Math.max(1, ...volumeByDay.map((day) => day.count))
  const greetingHour = new Date().getHours()
  const greeting = greetingHour < 12 ? 'Good morning' : greetingHour < 18 ? 'Good afternoon' : 'Good evening'

  const openTestDialog = (patientId = '') => {
    setSelectedPatientId(patientId)
    setSelectedTestIds([])
    setTestDialog(true)
  }

  const addPatient = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const patient: Patient = {
      id: nextRecordId('PT-', store.patients.map((item) => item.id), 4),
      name: patientDraft.name.trim(),
      age: Number(patientDraft.age),
      gender: patientDraft.gender,
      phone: patientDraft.phone.trim(),
      doctorId: patientDraft.doctorId,
      referrerId: patientDraft.referrerId,
      createdAt: new Date().toISOString(),
    }
    persist({ ...store, patients: [patient, ...store.patients] })
    setPatientDraft({ name: '', age: '', gender: 'Female', phone: '', doctorId: '', referrerId: '' })
    setPatientDialog(false)
    notify('Patient registered successfully.')
  }

  const addTestOrder = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!selectedPatientId || !selectedTestIds.length) {
      notify('Select a patient and at least one test.')
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
    if (masterDialog === 'doctors') {
      persist({ ...store, doctors: [{ id: makeId('dr'), name: masterDraft.name.trim(), specialty: masterDraft.specialty.trim(), phone: masterDraft.phone.trim() }, ...store.doctors] })
    } else if (masterDialog === 'referrers') {
      persist({ ...store, referrers: [{ id: makeId('ref'), name: masterDraft.name.trim(), organization: masterDraft.organization.trim(), phone: masterDraft.phone.trim() }, ...store.referrers] })
    } else if (masterDialog === 'tests') {
      persist({ ...store, tests: [{ id: makeId('test'), name: masterDraft.name.trim(), category: masterDraft.category.trim(), price: Number(masterDraft.price), unit: masterDraft.unit.trim(), reference: masterDraft.reference.trim() }, ...store.tests] })
    }
    setMasterDialog(null)
    setMasterDraft({ name: '', specialty: '', organization: '', phone: '', category: '', price: '', unit: '', reference: '' })
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

  const selectedReportPatient = reportPatientId ? store.patients.find((patient) => patient.id === reportPatientId) : undefined
  const selectedPatientOrders = reportPatientId
    ? store.orders.filter((order) => order.patientId === reportPatientId && (!reportOrderIds || reportOrderIds.includes(order.id)))
    : []
  const generationOrders = generationPatientId
    ? store.orders.filter((order) => order.patientId === generationPatientId)
    : []

  const generateAiInterpretation = async () => {
    setAiLoading(true)
    setAiError('')
    setAiInterpretation(null)
    try {
      const healthResponse = await fetch('/api/health')
      const health = await healthResponse.json() as { available?: boolean; model?: string; error?: string }
      if (!healthResponse.ok || !health.available) {
        throw new Error(health.error ?? 'Local AI is unavailable. Start the AI server and Ollama.')
      }

      const response = await fetch('/api/interpret', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          language: aiLanguage,
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
      const result = await response.json() as { interpretation?: string; model?: string; error?: string }
      if (!response.ok || !result.interpretation) {
        throw new Error(result.error ?? 'Could not generate an explanation. Please try again.')
      }
      setAiInterpretation({ text: result.interpretation, model: result.model ?? health.model ?? 'Local model' })
    } catch (error) {
      const message = error instanceof Error ? error.message : ''
      setAiError(message === 'Failed to fetch'
        ? 'Local AI service is unreachable. Start Ollama and run npm run ai:server in a terminal.'
        : message || 'Could not generate an explanation. Please try again.')
    } finally {
      setAiLoading(false)
    }
  }

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <a className="brand" href="#" onClick={(event) => { event.preventDefault(); setSection('overview') }}>
          <span className="brand-mark"><Icon name="flask" size={21} /></span>
          <span className="brand-copy"><strong>prime<span>ai</span></strong><small>LAB MANAGEMENT</small></span>
        </a>
        <div className="workspace-label">WORKSPACE</div>
        <nav className="side-nav" aria-label="Main navigation">
          <button className={`nav-item ${section === 'overview' ? 'active' : ''}`} onClick={() => setSection('overview')}><Icon name="dashboard" /><span>Overview</span></button>
          <div className="nav-separator" />
          <button className={`nav-item ${section === 'masters' ? 'active' : ''}`} onClick={() => setSection('masters')}><Icon name="masters" /><span>Masters</span></button>
          <button className={`nav-item ${section === 'patients' ? 'active' : ''}`} onClick={() => setSection('patients')}><Icon name="patients" /><span>Patients</span><span className="nav-count">{store.patients.length}</span></button>
          <button className={`nav-item ${section === 'results' ? 'active' : ''}`} onClick={() => setSection('results')}><Icon name="flask" /><span>Test results</span>{pendingCount > 0 && <span className="nav-count warning">{pendingCount}</span>}</button>
          <button className={`nav-item ${section === 'report-generation' ? 'active' : ''}`} onClick={() => setSection('report-generation')}><Icon name="print" /><span>Report generation</span></button>
          <button className={`nav-item ${section === 'reports' ? 'active' : ''}`} onClick={() => setSection('reports')}><Icon name="report" /><span>Reports</span></button>
        </nav>
        <div className="sidebar-bottom">
          <div className="support-card">
            <span className="support-icon"><Icon name="spark" size={16} /></span>
            <strong>Lab workspace</strong>
            <p>Your data is saved in this browser.</p>
            <span className="secure-label"><span /> LOCAL DEMO MODE</span>
          </div>
          <button className="profile-button">
            <span className="avatar">PS</span>
            <span className="profile-copy"><strong>Priya Singh</strong><small>Lab administrator</small></span>
            <span className="profile-more">···</span>
          </button>
        </div>
      </aside>

      <main className="main-panel">
        <header className="topbar">
          <div className="breadcrumbs"><span>Prime AI Lab</span><span className="crumb-slash">/</span><strong>{section === 'overview' ? 'Overview' : section === 'results' ? 'Test results' : section === 'report-generation' ? 'Report generation' : section[0].toUpperCase() + section.slice(1)}</strong></div>
          <div className="topbar-actions">
            <label className="global-search"><Icon name="search" size={17} /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search patients, tests..." aria-label="Search patients and tests" /><kbd>⌘ K</kbd></label>
            <button className="icon-button notification-button" aria-label="Notifications"><Icon name="bell" size={18} /><i /></button>
            <div className="topbar-divider" />
            <span className="today-date">{new Intl.DateTimeFormat('en-IN', { weekday: 'short', day: 'numeric', month: 'short' }).format(new Date())}</span>
          </div>
        </header>

        <div className="page-content">
          {section === 'overview' && (
            <section className="page-section">
              <div className="page-heading overview-heading">
                <div><span className="eyebrow">{new Intl.DateTimeFormat('en-IN', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }).format(new Date()).toUpperCase()}</span><h1>{greeting}, Priya <span className="wave">✦</span></h1><p>Here’s what’s happening in your lab today.</p></div>
                <button className="button button-primary" onClick={() => setPatientDialog(true)}><Icon name="plus" size={17} /> Register patient</button>
              </div>

              <div className="stats-grid">
                <article className="stat-card"><div className="stat-top"><span className="stat-icon mint"><Icon name="patients" /></span><span className="stat-trend"><Icon name="trend" size={13} /> 12.5%</span></div><span className="stat-label">Total patients</span><strong>{store.patients.length.toLocaleString('en-IN')}</strong><small>Registered in the system</small></article>
                <article className="stat-card"><div className="stat-top"><span className="stat-icon violet"><Icon name="flask" /></span><span className="stat-trend"><Icon name="trend" size={13} /> 8.2%</span></div><span className="stat-label">Tests today</span><strong>{todayCount.toLocaleString('en-IN')}</strong><small>Across all test categories</small></article>
                <article className="stat-card"><div className="stat-top"><span className="stat-icon amber"><Icon name="clock" /></span><span className="stat-chip">{pendingCount} need attention</span></div><span className="stat-label">Pending results</span><strong>{pendingCount.toLocaleString('en-IN')}</strong><small>Awaiting result entry</small></article>
                <article className="stat-card"><div className="stat-top"><span className="stat-icon blue"><Icon name="trend" /></span><span className="stat-chip">All time</span></div><span className="stat-label">Catalogue value</span><strong>₹{revenue.toLocaleString('en-IN')}</strong><small>Based on test catalogue prices</small></article>
              </div>

              <div className="dashboard-grid">
                <article className="panel activity-panel">
                  <div className="panel-heading"><div><h2>Recent test activity</h2><p>Your latest patient tests and result status.</p></div><button className="text-button" onClick={() => setSection('results')}>View all <Icon name="arrow" size={15} /></button></div>
                  <OrderTable orders={store.orders.slice(0, 5)} store={store} onReport={openPatientReport} compact />
                </article>
                <article className="panel chart-panel">
                  <div className="panel-heading"><div><h2>Test volume</h2><p>Orders received this week</p></div><span className="period-pill">This week <span>⌄</span></span></div>
                  <div className="chart-summary"><strong>{weeklyOrders.length}</strong><span>tests this week</span><span className="chart-change">{store.orders.length} total</span></div>
                  <div className="bar-chart" aria-label="Test volume chart">
                    {volumeByDay.map((day) => <div className="bar-column" key={day.label}><div className={`bar ${day.label === new Intl.DateTimeFormat('en-IN', { weekday: 'short' }).format(new Date()) ? 'bar-current' : ''}`} style={{ height: `${day.count ? (day.count / maxDailyVolume) * 100 : 6}%` }} title={`${day.count} tests`} /><span>{day.label}</span></div>)}
                  </div>
                </article>
              </div>

              <div className="dashboard-grid lower-grid">
                <article className="panel quick-panel">
                  <div className="panel-heading"><div><h2>Quick actions</h2><p>Common tasks, right at your fingertips.</p></div></div>
                  <div className="quick-actions">
                    <button onClick={() => setPatientDialog(true)}><span className="quick-icon quick-mint"><Icon name="patients" /></span><span><strong>New patient</strong><small>Register a patient</small></span><Icon name="arrow" size={16} /></button>
                    <button onClick={() => openTestDialog()}><span className="quick-icon quick-violet"><Icon name="flask" /></span><span><strong>Add a test</strong><small>Create a test order</small></span><Icon name="arrow" size={16} /></button>
                    <button onClick={() => setSection('reports')}><span className="quick-icon quick-blue"><Icon name="report" /></span><span><strong>View reports</strong><small>Explore lab activity</small></span><Icon name="arrow" size={16} /></button>
                  </div>
                </article>
                <article className="panel completion-panel">
                  <div className="panel-heading"><div><h2>Result completion</h2><p>Overall test processing status.</p></div><span className="completion-value">{store.orders.length ? Math.round((completedCount / store.orders.length) * 100) : 0}%</span></div>
                  <div className="progress-track"><span style={{ width: `${store.orders.length ? (completedCount / store.orders.length) * 100 : 0}%` }} /></div>
                  <div className="completion-legend"><span><i className="legend-dot green-dot" /> Completed <strong>{completedCount}</strong></span><span><i className="legend-dot amber-dot" /> Pending <strong>{pendingCount}</strong></span></div>
                  <div className="completion-note"><span className="note-icon"><Icon name="spark" size={15} /></span><p><strong>AI-assisted reporting</strong><br />Create a structured draft from entered results. All reports require professional review.</p></div>
                </article>
              </div>
              <p className="demo-notice">Demo workspace · Sample records are fictional. Do not enter real patient information.</p>
            </section>
          )}

          {section === 'masters' && (
            <section className="page-section">
              <div className="page-heading"><div><span className="eyebrow">CONFIGURATION</span><h1>Masters</h1><p>Manage doctors, referral partners and your test catalogue.</p></div><button className="button button-primary" onClick={() => setMasterDialog(masterTab)}><Icon name="plus" size={17} /> Add {masterTab === 'doctors' ? 'doctor' : masterTab === 'referrers' ? 'referrer' : 'test'}</button></div>
              <div className="tab-bar">
                {([['doctors', 'Doctors'], ['referrers', 'Referrers'], ['tests', 'Test catalogue']] as const).map(([key, label]) => <button key={key} className={masterTab === key ? 'selected' : ''} onClick={() => setMasterTab(key)}>{label}<span>{key === 'doctors' ? store.doctors.length : key === 'referrers' ? store.referrers.length : store.tests.length}</span></button>)}
              </div>
              <div className="panel list-panel">
                {masterTab === 'doctors' && <table><thead><tr><th>DOCTOR</th><th>SPECIALTY</th><th>PHONE</th><th>REFERRED PATIENTS</th><th /></tr></thead><tbody>{store.doctors.filter((doctor) => !search || `${doctor.name} ${doctor.specialty} ${doctor.phone}`.toLowerCase().includes(search.toLowerCase())).map((doctor, index) => <tr key={doctor.id}><td><div className="person-cell"><span className={`avatar avatar-${index % 4}`}>{doctor.name.split(' ').slice(-1)[0].slice(0, 1)}</span><strong>{doctor.name}</strong></div></td><td>{doctor.specialty}</td><td>{doctor.phone || '—'}</td><td>{store.patients.filter((patient) => patient.doctorId === doctor.id).length} patients</td><td><button className="row-action" aria-label={`Add patient for ${doctor.name}`} onClick={() => { setPatientDraft({ ...patientDraft, doctorId: doctor.id }); setPatientDialog(true) }}>•••</button></td></tr>)}</tbody></table>}
                {masterTab === 'referrers' && <table><thead><tr><th>REFERRAL PARTNER</th><th>ORGANIZATION</th><th>PHONE</th><th>REFERRED PATIENTS</th><th /></tr></thead><tbody>{store.referrers.filter((referrer) => !search || `${referrer.name} ${referrer.organization} ${referrer.phone}`.toLowerCase().includes(search.toLowerCase())).map((referrer, index) => <tr key={referrer.id}><td><div className="person-cell"><span className={`avatar avatar-${(index + 2) % 4}`}>{referrer.name.split(' ').slice(-1)[0].slice(0, 1)}</span><strong>{referrer.name}</strong></div></td><td>{referrer.organization}</td><td>{referrer.phone || '—'}</td><td>{store.patients.filter((patient) => patient.referrerId === referrer.id).length} patients</td><td><button className="row-action" aria-label={`Referral partner actions for ${referrer.name}`}>•••</button></td></tr>)}</tbody></table>}
                {masterTab === 'tests' && <table><thead><tr><th>TEST NAME</th><th>CATEGORY</th><th>PRICE</th><th>UNIT</th><th>REFERENCE RANGE</th><th /></tr></thead><tbody>{store.tests.filter((test) => !search || `${test.name} ${test.category}`.toLowerCase().includes(search.toLowerCase())).map((test) => <tr key={test.id}><td><div className="test-name-cell"><span className="test-row-icon"><Icon name="flask" size={16} /></span><strong>{test.name}</strong></div></td><td><span className="category-tag">{test.category}</span></td><td>₹{test.price.toLocaleString('en-IN')}</td><td>{test.unit}</td><td>{test.reference}</td><td><button className="row-action" aria-label={`Actions for ${test.name}`}>•••</button></td></tr>)}</tbody></table>}
                <div className="table-footer"><span>Showing {masterTab === 'doctors' ? store.doctors.length : masterTab === 'referrers' ? store.referrers.length : store.tests.length} records</span><span>Demo data is stored in this browser</span></div>
              </div>
            </section>
          )}

          {section === 'patients' && (
            <section className="page-section">
              <div className="page-heading"><div><span className="eyebrow">PATIENT DIRECTORY</span><h1>Patients</h1><p>Manage patient profiles and their requested lab tests.</p></div><button className="button button-primary" onClick={() => setPatientDialog(true)}><Icon name="plus" size={17} /> Register patient</button></div>
              <div className="patient-summary-row"><div className="patient-summary"><span className="stat-icon mint"><Icon name="patients" /></span><span><small>Total patients</small><strong>{store.patients.length}</strong></span></div><div className="patient-summary"><span className="stat-icon violet"><Icon name="flask" /></span><span><small>Tests on record</small><strong>{store.orders.length}</strong></span></div><div className="patient-summary"><span className="stat-icon amber"><Icon name="clock" /></span><span><small>Awaiting results</small><strong>{pendingCount}</strong></span></div></div>
              <div className="panel list-panel">
                <div className="list-toolbar"><div><h2>All patients</h2><p>A complete record of registered patients.</p></div><label className="table-search"><Icon name="search" size={16} /><input aria-label="Filter patient list" placeholder="Filter patients" value={search} onChange={(event) => setSearch(event.target.value)} /></label></div>
                <table><thead><tr><th>PATIENT</th><th>PATIENT ID</th><th>AGE / GENDER</th><th>PHONE</th><th>DOCTOR</th><th>TESTS</th><th>REGISTERED</th><th /></tr></thead><tbody>
                  {filteredPatients.map((patient, index) => <tr key={patient.id}><td><div className="person-cell"><span className={`avatar avatar-${index % 4}`}>{patient.name.split(' ').map((word) => word[0]).slice(0, 2).join('')}</span><strong>{patient.name}</strong></div></td><td><span className="id-text">{patient.id}</span></td><td>{patient.age} yrs <span className="muted">/ {patient.gender}</span></td><td>{patient.phone}</td><td>{getDoctor(store, patient.doctorId)}</td><td><span className="test-count">{store.orders.filter((order) => order.patientId === patient.id).length}</span></td><td>{formatDate(patient.createdAt)}</td><td><button className="button button-small button-outline" onClick={() => openTestDialog(patient.id)}><Icon name="plus" size={14} /> Add test</button></td></tr>)}
                  {!filteredPatients.length && <tr><td className="empty-cell" colSpan={8}>No patients match your search.</td></tr>}
                </tbody></table>
                <div className="table-footer"><span>Showing {filteredPatients.length} of {store.patients.length} patients</span><span>Page 1 of 1</span></div>
              </div>
            </section>
          )}

          {section === 'results' && (
            <section className="page-section">
              <div className="page-heading"><div><span className="eyebrow">LAB WORKFLOW</span><h1>Test results</h1><p>Enter and review results, then prepare a patient report.</p></div><button className="button button-primary" onClick={() => openTestDialog()}><Icon name="plus" size={17} /> Add test order</button></div>
              <div className="result-cards"><div className="result-card"><span className="result-number">{store.orders.length}</span><span>Total orders</span></div><div className="result-card"><span className="result-number">{pendingCount}</span><span><i className="legend-dot amber-dot" /> Pending</span></div><div className="result-card"><span className="result-number">{completedCount}</span><span><i className="legend-dot green-dot" /> Completed</span></div></div>
              <div className="panel list-panel">
                <div className="list-toolbar"><div><h2>Test queue</h2><p>Results are entered and saved in this browser.</p></div><label className="table-search"><Icon name="search" size={16} /><input aria-label="Filter test orders" placeholder="Filter tests" value={search} onChange={(event) => setSearch(event.target.value)} /></label></div>
                <table><thead><tr><th>ORDER / PATIENT</th><th>TEST</th><th>ORDERED</th><th>RESULT</th><th>REFERENCE</th><th>STATUS</th><th>ACTIONS</th></tr></thead><tbody>
                  {filteredOrders.map((order) => {
                    const test = getTest(store, order.testId)
                    const parameters = getTestParameters(store, order)
                    const isParameterized = Boolean(test?.parameters?.length)
                    return <tr key={order.id}>
                      <td><div className="order-patient"><strong>{getPatientName(store, order.patientId)}</strong><small>{order.id} · {order.patientId}</small></div></td>
                      <td><strong className="normal-weight">{test?.name ?? 'Test removed'}</strong></td>
                      <td>{formatDate(order.createdAt)}</td>
                      <td>{isParameterized
                        ? <div className="parameter-result-inputs">{parameters.map((parameter) => {
                          const draftKey = `${order.id}:${parameter.id}`
                          return <label key={parameter.id}><span>{parameter.name}{parameter.unit ? ` · ${parameter.unit}` : ''}</span><input className={`result-input ${order.status === 'Completed' ? 'result-input-complete' : ''}`} aria-label={`${parameter.name} result for ${order.id}`} placeholder="Enter result" value={resultDrafts[draftKey] ?? getParameterResult(order, parameter)} onChange={(event) => setResultDrafts({ ...resultDrafts, [draftKey]: event.target.value })} /></label>
                        })}</div>
                        : <input className={`result-input ${order.status === 'Completed' ? 'result-input-complete' : ''}`} aria-label={`Result for ${order.id}`} placeholder="Enter result" value={resultDrafts[order.id] ?? order.result} onChange={(event) => setResultDrafts({ ...resultDrafts, [order.id]: event.target.value })} />}
                      </td>
                      <td>{isParameterized ? 'See parameter ranges' : test?.reference ?? '—'}</td>
                      <td><span className={`status-pill ${order.status === 'Completed' ? 'status-complete' : 'status-pending'}`}><i />{order.status}</span></td>
                      <td><div className="action-group"><button className="button button-small button-outline" onClick={() => saveOrderResults(order)}>Save</button><button className="row-action" title="Show report" onClick={() => openPatientReport(order.patientId)}><Icon name="report" size={16} /></button></div></td>
                    </tr>
                  })}
                  {!filteredOrders.length && <tr><td className="empty-cell" colSpan={7}>No test orders match your search.</td></tr>}
                </tbody></table>
                <div className="table-footer"><span>{filteredOrders.length} test orders</span><span>Results must be reviewed by qualified laboratory staff</span></div>
              </div>
            </section>
          )}

          {section === 'report-generation' && (
            <section className="page-section">
              <div className="page-heading"><div><span className="eyebrow">PATIENT REPORTS</span><h1>Report generation</h1><p>Review and enter individual test parameters, then print one or all patient tests.</p></div></div>
              <div className="panel report-generator-panel">
                <div className="report-generator-toolbar">
                  <label className="patient-picker"><span>Select patient</span><select value={generationPatientId} onChange={(event) => setGenerationPatientId(event.target.value)}><option value="">Choose a patient</option>{store.patients.map((patient) => <option key={patient.id} value={patient.id}>{patient.name} · {patient.id}</option>)}</select></label>
                  {generationPatientId && <button className="button button-primary" disabled={!generationOrders.length} onClick={() => openTestReport(generationPatientId, null)}><Icon name="print" size={15} /> Print all tests</button>}
                </div>
                {!generationPatientId && <div className="report-empty-state"><span className="stat-icon mint"><Icon name="patients" /></span><strong>Select a patient to get started</strong><p>The patient’s ordered tests and report parameters will appear here.</p></div>}
                {generationPatientId && <>
                  {generationOrders.length > 0
                    ? <div className="report-table-scroll"><table className="generation-table"><thead><tr><th>TEST NAME</th><th>PARAMETER</th><th>RESULT</th><th>UNIT</th><th>REFERENCE RANGE</th><th>PRINT</th></tr></thead><tbody>
                      {generationOrders.map((order) => {
                        const test = getTest(store, order.testId)
                        const parameters = getTestParameters(store, order)
                        return parameters.map((parameter, index) => {
                          const draftKey = `${order.id}:${parameter.id}`
                          return <tr key={`${order.id}:${parameter.id}`}>
                            {index === 0 && <td rowSpan={parameters.length}><div className="generation-test-name"><strong>{test?.name ?? 'Test removed'}</strong><small>{order.id} · {order.status}</small></div></td>}
                            <td>{parameter.name}</td>
                            <td><input className="result-input generation-result-input" aria-label={`${parameter.name} for ${getPatientName(store, generationPatientId)}`} placeholder="Enter result" value={resultDrafts[draftKey] ?? getParameterResult(order, parameter)} onChange={(event) => updateParameterResult(order, parameter, event.target.value)} /></td>
                            <td>{parameter.unit || '—'}</td>
                            <td>{parameter.reference || '—'}</td>
                            {index === 0 && <td rowSpan={parameters.length}><button className="button button-small button-outline" onClick={() => openTestReport(generationPatientId, [order.id])}><Icon name="print" size={14} /> Print test</button></td>}
                          </tr>
                        })
                      })}
                    </tbody></table></div>
                    : <div className="report-empty-state"><span className="stat-icon amber"><Icon name="flask" /></span><strong>No tests ordered for this patient</strong><p>Add one or more tests from the Patients or Test results tab first.</p></div>}
                </>}
                <div className="table-footer"><span>{generationOrders.length} test{generationOrders.length === 1 ? '' : 's'} for selected patient</span><span>Report values are saved as you enter them</span></div>
              </div>
              <p className="demo-notice">Reports are drafts. Verify every value and have a qualified professional review before release.</p>
            </section>
          )}

          {section === 'reports' && (
            <section className="page-section">
              <div className="page-heading"><div><span className="eyebrow">INSIGHTS & DOCUMENTS</span><h1>Reports</h1><p>Review report collection, activity trends and lab performance.</p></div><button className="button button-outline" onClick={() => window.print()}><Icon name="download" size={16} /> Export / print</button></div>
              <div className="report-period-tabs">{(['Daily', 'Weekly', 'Monthly'] as const).map((period) => <button key={period} className={reportPeriod === period ? 'selected' : ''} onClick={() => setReportPeriod(period)}>{period}</button>)}</div>
              <div className="stats-grid report-stats">
                <article className="stat-card"><span className="stat-label">{reportPeriod} collections</span><strong>{filteredReports.length}</strong><small>Test orders in selected period</small></article>
                <article className="stat-card"><span className="stat-label">Completed reports</span><strong>{filteredReports.filter((order) => order.status === 'Completed').length}</strong><small>Ready for review and printing</small></article>
                <article className="stat-card"><span className="stat-label">Awaiting results</span><strong>{filteredReports.filter((order) => order.status === 'Pending').length}</strong><small>Pending in selected period</small></article>
                <article className="stat-card"><span className="stat-label">Collection value</span><strong>₹{filteredReports.reduce((sum, order) => sum + (getTest(store, order.testId)?.price ?? 0), 0).toLocaleString('en-IN')}</strong><small>Estimated from catalogue prices</small></article>
              </div>
              <div className="dashboard-grid report-grid">
                <article className="panel report-collection">
                  <div className="panel-heading"><div><h2>{reportPeriod} report collection</h2><p>Open a patient report for review or printing.</p></div><span className="period-pill">{reportPeriod} <span>⌄</span></span></div>
                  <OrderTable orders={filteredReports} store={store} onReport={openPatientReport} compact />
                  {!filteredReports.length && <p className="empty-message">No orders found for this period.</p>}
                </article>
                <article className="panel analysis-panel">
                  <div className="panel-heading"><div><h2>Analysis</h2><p>Test category distribution</p></div><span className="chart-icon"><Icon name="trend" size={17} /></span></div>
                  {Array.from(new Set(store.tests.map((test) => test.category))).slice(0, 4).map((category, index) => {
                    const count = store.orders.filter((order) => getTest(store, order.testId)?.category === category).length
                    const percent = store.orders.length ? (count / store.orders.length) * 100 : 0
                    return <div className="analysis-row" key={category}><div><span>{category}</span><strong>{count} tests</strong></div><div className="analysis-track"><span className={`analysis-fill fill-${index}`} style={{ width: `${Math.max(percent, 4)}%` }} /></div></div>
                  })}
                  <div className="analysis-foot"><span>Based on {store.orders.length} orders</span><span><Icon name="trend" size={13} /> Live</span></div>
                </article>
              </div>
              <p className="demo-notice">Reports and analytics are based on the records currently saved in this browser.</p>
            </section>
          )}
        </div>
      </main>

      {patientDialog && <Dialog title="Register a patient" onClose={() => setPatientDialog(false)}>
        <form className="dialog-form" onSubmit={addPatient}>
          <p className="form-intro">Create a profile to start adding lab tests. Demo mode only — please use fictional data.</p>
          <label>Full name<input required autoFocus value={patientDraft.name} onChange={(event) => setPatientDraft({ ...patientDraft, name: event.target.value })} placeholder="e.g. Maya Sharma" /></label>
          <div className="form-row"><label>Age<input required type="number" min="0" max="120" value={patientDraft.age} onChange={(event) => setPatientDraft({ ...patientDraft, age: event.target.value })} placeholder="Age" /></label><label>Gender<select value={patientDraft.gender} onChange={(event) => setPatientDraft({ ...patientDraft, gender: event.target.value })}><option>Female</option><option>Male</option><option>Other</option><option>Prefer not to say</option></select></label></div>
          <label>Phone number<input required value={patientDraft.phone} onChange={(event) => setPatientDraft({ ...patientDraft, phone: event.target.value })} placeholder="+91 00000 00000" /></label>
          <div className="form-row"><label>Doctor<select value={patientDraft.doctorId} onChange={(event) => setPatientDraft({ ...patientDraft, doctorId: event.target.value })}><option value="">Select doctor</option>{store.doctors.map((doctor) => <option key={doctor.id} value={doctor.id}>{doctor.name}</option>)}</select></label><label>Referred by<select value={patientDraft.referrerId} onChange={(event) => setPatientDraft({ ...patientDraft, referrerId: event.target.value })}><option value="">Select referrer</option>{store.referrers.map((referrer) => <option key={referrer.id} value={referrer.id}>{referrer.name}</option>)}</select></label></div>
          <div className="dialog-actions"><button type="button" className="button button-outline" onClick={() => setPatientDialog(false)}>Cancel</button><button type="submit" className="button button-primary">Register patient</button></div>
        </form>
      </Dialog>}

      {testDialog && <Dialog title="Add a test order" onClose={() => setTestDialog(false)}>
        <form className="dialog-form" onSubmit={addTestOrder}>
          <p className="form-intro">Select a patient and one or more tests. Each selected test will create its own order with the required result parameters.</p>
          <label>Patient<select required value={selectedPatientId} onChange={(event) => setSelectedPatientId(event.target.value)}><option value="">Select patient</option>{store.patients.map((patient) => <option key={patient.id} value={patient.id}>{patient.name} · {patient.id}</option>)}</select></label>
          <fieldset className="test-selection"><legend>Tests <span>{selectedTestIds.length} selected</span></legend>
            {store.tests.map((test) => <label className="test-option" key={test.id}><input type="checkbox" checked={selectedTestIds.includes(test.id)} onChange={(event) => setSelectedTestIds(event.target.checked ? [...selectedTestIds, test.id] : selectedTestIds.filter((id) => id !== test.id))} /><span><strong>{test.name}</strong><small>{test.category}{test.parameters?.length ? ` · ${test.parameters.length} parameters` : ''}</small></span><b>₹{test.price.toLocaleString('en-IN')}</b></label>)}
          </fieldset>
          <div className="dialog-actions"><button type="button" className="button button-outline" onClick={() => setTestDialog(false)}>Cancel</button><button type="submit" className="button button-primary" disabled={!selectedPatientId || !selectedTestIds.length}>Add {selectedTestIds.length || ''} to queue</button></div>
        </form>
      </Dialog>}

      {masterDialog && <Dialog title={`Add ${masterDialog === 'doctors' ? 'doctor' : masterDialog === 'referrers' ? 'referral partner' : 'test'}`} onClose={() => setMasterDialog(null)}>
        <form className="dialog-form" onSubmit={addMaster}>
          <label>{masterDialog === 'tests' ? 'Test name' : 'Full name'}<input required autoFocus value={masterDraft.name} onChange={(event) => setMasterDraft({ ...masterDraft, name: event.target.value })} placeholder={masterDialog === 'tests' ? 'e.g. Vitamin D' : 'e.g. Dr. Maya Rao'} /></label>
          {masterDialog === 'doctors' && <label>Specialty<input required value={masterDraft.specialty} onChange={(event) => setMasterDraft({ ...masterDraft, specialty: event.target.value })} placeholder="e.g. General Medicine" /></label>}
          {masterDialog === 'referrers' && <label>Organization<input required value={masterDraft.organization} onChange={(event) => setMasterDraft({ ...masterDraft, organization: event.target.value })} placeholder="Clinic or hospital" /></label>}
          {masterDialog === 'tests' && <><div className="form-row"><label>Category<input required value={masterDraft.category} onChange={(event) => setMasterDraft({ ...masterDraft, category: event.target.value })} placeholder="e.g. Biochemistry" /></label><label>Price (₹)<input required type="number" min="0" value={masterDraft.price} onChange={(event) => setMasterDraft({ ...masterDraft, price: event.target.value })} placeholder="0" /></label></div><div className="form-row"><label>Result unit<input required value={masterDraft.unit} onChange={(event) => setMasterDraft({ ...masterDraft, unit: event.target.value })} placeholder="e.g. mg/dL" /></label><label>Reference range<input required value={masterDraft.reference} onChange={(event) => setMasterDraft({ ...masterDraft, reference: event.target.value })} placeholder="e.g. 70–100" /></label></div></>}
          {masterDialog !== 'tests' && <label>Phone number<input value={masterDraft.phone} onChange={(event) => setMasterDraft({ ...masterDraft, phone: event.target.value })} placeholder="+91 00000 00000" /></label>}
          <div className="dialog-actions"><button type="button" className="button button-outline" onClick={() => setMasterDialog(null)}>Cancel</button><button type="submit" className="button button-primary">Add record</button></div>
        </form>
      </Dialog>}

      {selectedReportPatient && <Dialog title="Patient report" onClose={() => { setReportPatientId(null); setReportOrderIds(null); setAiInterpretation(null); setAiError('') }} className="report-dialog">
        <div className="report-toolbar"><span className="status-pill status-complete"><i /> Review before release</span><button className="button button-outline button-small" onClick={() => window.print()}><Icon name="print" size={15} /> Print report</button></div>
        <div className="printable-report">
          <div className="report-brand"><span className="brand-mark"><Icon name="flask" size={19} /></span><div><strong>PRIME AI LAB</strong><small>LABORATORY TEST REPORT</small></div></div>
          <div className="report-patient-info"><div><small>PATIENT NAME</small><strong>{selectedReportPatient.name}</strong></div><div><small>PATIENT ID</small><strong>{selectedReportPatient.id}</strong></div><div><small>AGE / GENDER</small><strong>{selectedReportPatient.age} yrs / {selectedReportPatient.gender}</strong></div><div><small>REPORT DATE</small><strong>{formatDate(new Date().toISOString())}</strong></div><div><small>ORDERING DOCTOR</small><strong>{getDoctor(store, selectedReportPatient.doctorId)}</strong></div><div><small>REFERRED BY</small><strong>{getReferrer(store, selectedReportPatient.referrerId)}</strong></div></div>
          <table className="report-results-table"><thead><tr><th>TEST</th><th>PARAMETER</th><th>RESULT</th><th>UNIT</th><th>REFERENCE RANGE</th><th>STATUS</th></tr></thead><tbody>{selectedPatientOrders.flatMap((order) => {
            const test = getTest(store, order.testId)
            return getTestParameters(store, order).map((parameter) => <tr key={`${order.id}:${parameter.id}`}><td>{test?.name ?? 'Test removed'}</td><td>{parameter.name}</td><td><strong>{getParameterResult(order, parameter) || 'Pending'}</strong></td><td>{parameter.unit || '—'}</td><td>{parameter.reference || '—'}</td><td>{order.status}</td></tr>)
          })}</tbody></table>
          <section className="ai-interpretation" aria-live="polite">
            <div className="ai-interpretation-heading"><div><strong><Icon name="spark" size={15} /> Plain-language explanation</strong><small>Local AI · no patient name or ID is sent</small></div><div className="ai-controls"><label htmlFor="ai-language">Language</label><select id="ai-language" value={aiLanguage} onChange={(event) => { const language = event.target.value; if (language === 'Marathi' || language === 'English' || language === 'Hindi') setAiLanguage(language) }}><option value="Marathi">मराठी</option><option value="English">English</option><option value="Hindi">हिन्दी</option></select><button className="button button-small button-primary" disabled={aiLoading || !selectedPatientOrders.length} onClick={generateAiInterpretation}><Icon name="spark" size={14} />{aiLoading ? 'Generating…' : 'Explain results'}</button></div></div>
            {aiError && <p className="ai-error" role="alert">{aiError}</p>}
            {aiLoading && <p className="ai-status">The local model is preparing a short explanation. The first request may take a few minutes while the model loads; keep this report open.</p>}
            {aiInterpretation && <div className="ai-interpretation-result"><span>Generated with {aiInterpretation.model}</span><p>{aiInterpretation.text}</p></div>}
            {!aiError && !aiLoading && !aiInterpretation && <p className="ai-status">Explanation compares results only with the reference ranges shown. It is educational, not a diagnosis; clinician review is required.</p>}
          </section>
          <div className="ai-disclaimer"><span><Icon name="spark" size={17} /></span><p><strong>AI-assisted explanation</strong><br />The optional AI text is educational and may be inaccurate. It is not a diagnosis or treatment advice. A qualified professional must verify results and review the report before release.</p></div>
          <div className="report-signoff"><span>Authorized by: ____________________</span><span>Signature: ____________________</span></div>
          <p className="report-footer-note">Confidential laboratory record · Prepared for professional review</p>
        </div>
      </Dialog>}
      {toast && <div className="toast-message" role="status"><Icon name="check" size={16} />{toast}</div>}
    </div>
  )
}

function OrderTable({ orders, store, onReport, compact = false }: { orders: LabOrder[]; store: Store; onReport: (patientId: string) => void; compact?: boolean }) {
  const rows = compact ? orders.slice(0, 5) : orders
  return (
    <table className="activity-table"><thead><tr><th>PATIENT</th><th>TEST</th><th>DATE</th><th>STATUS</th><th /></tr></thead><tbody>
      {rows.map((order) => <tr key={order.id}><td><div className="order-patient"><strong>{getPatientName(store, order.patientId)}</strong><small>{order.id}</small></div></td><td>{getTest(store, order.testId)?.name ?? 'Test removed'}</td><td>{formatDate(order.createdAt)}</td><td><span className={`status-pill ${order.status === 'Completed' ? 'status-complete' : 'status-pending'}`}><i />{order.status}</span></td><td><button className="row-action" aria-label={`Show report for ${getPatientName(store, order.patientId)}`} onClick={() => onReport(order.patientId)}><Icon name="arrow" size={15} /></button></td></tr>)}
      {!rows.length && <tr><td colSpan={5} className="empty-cell">No activity yet. Add a patient test to get started.</td></tr>}
    </tbody></table>
  )
}

export default App
