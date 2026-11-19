export type Section = 'overview' | 'masters' | 'patients' | 'administration' | 'results' | 'report-generation' | 'reports'
export type AdministrationTab = 'attendance' | 'revenue'
export type MasterTab = 'lab-technicians' | 'referrers' | 'sample-collectors' | 'tests'
export type ReportPeriod = 'Daily' | 'Weekly' | 'Monthly'
export type RevenueCategory = 'doctor' | 'technician' | 'collector'
export type OrderStatus = 'Pending' | 'Completed'
export type OrderStatusFilter = 'All' | OrderStatus
export type ExplanationLanguage = 'Marathi' | 'English' | 'Hindi'
export type TestProfile = 'preoperative' | 'anc' | 'other'
export type AttendanceStatus = 'Present' | 'Absent' | 'Leave'
export type AppearanceMode = 'light' | 'dark'
export type AccentTheme = 'mint' | 'blue' | 'violet' | 'rose'
export type AppearanceSettings = { mode: AppearanceMode; accent: AccentTheme }
export type RevenueSummaryRow = { id: string; name: string; orders: number; amount: number }
export type LabTechnician = { id: string; name: string; specialty: string; phone: string }
export type Referrer = { id: string; name: string; organization: string; phone: string }
export type SampleCollector = { id: string; name: string; phone: string }
export type Patient = {
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
export type AttendanceRecord = { id: string; labTechnicianId: string; date: string; status: AttendanceStatus; updatedAt: string }
export type PersistedPatient = Omit<Patient, 'labTechnicianId' | 'sampleCollectorId'> &
  Partial<Pick<Patient, 'labTechnicianId' | 'sampleCollectorId'>> & { doctorId?: string }
export type TestParameter = { id: string; name: string; unit: string; reference?: string }
export type LabTest = {
  id: string
  name: string
  category: string
  price: number
  unit: string
  reference: string
  parameters?: TestParameter[]
  profiles?: TestProfile[]
}
export type LabOrder = {
  id: string
  patientId: string
  testId: string
  createdAt: string
  result: string
  parameterResults?: Record<string, string>
  status: OrderStatus
  printedAt?: string
}
export type Store = {
  labTechnicians: LabTechnician[]
  referrers: Referrer[]
  sampleCollectors: SampleCollector[]
  patients: Patient[]
  tests: LabTest[]
  orders: LabOrder[]
  attendance: AttendanceRecord[]
}
