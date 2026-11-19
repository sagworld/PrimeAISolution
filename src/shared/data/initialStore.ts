import type { AccentTheme, LabTest, Store, TestParameter, TestProfile } from '@/shared/types'

export const STORAGE_KEY = 'primeaisolution-lab-v1'
export const UI_LANGUAGE_STORAGE_KEY = 'primeaisolution-ui-language'
export const APPEARANCE_STORAGE_KEY = 'primeaisolution-appearance'
export const HEAD_USERNAME = 'head'
export const HEAD_PASSWORD = 'lab123'
export const accentThemes: { id: AccentTheme; label: string; color: string }[] = [
  { id: 'mint', label: 'Mint', color: '#168466' },
  { id: 'blue', label: 'Ocean blue', color: '#3478c4' },
  { id: 'violet', label: 'Violet', color: '#7961bd' },
  { id: 'rose', label: 'Rose', color: '#c75f76' },
]
const cbcParameters: TestParameter[] = [
  { id: 'hemoglobin', name: 'Hemoglobin (Hb)', unit: 'g/dL', reference: '12.0–17.5', groupId: 'cbc-rbc', groupName: 'RBC' },
  { id: 'rbc-count', name: 'RBC Count', unit: 'million/µL', reference: '4.0–5.5', groupId: 'cbc-rbc', groupName: 'RBC' },
  { id: 'hematocrit', name: 'Hematocrit (PCV)', unit: '%', reference: '36–52', groupId: 'cbc-rbc', groupName: 'RBC' },
  { id: 'mcv', name: 'MCV', unit: 'fL', reference: '80–100', groupId: 'cbc-rbc', groupName: 'RBC' },
  { id: 'wbc-count', name: 'WBC Count', unit: 'cells/µL', reference: '4,000–11,000', groupId: 'cbc-wbc', groupName: 'WBC' },
  { id: 'platelet-count', name: 'Platelet Count', unit: 'cells/µL', reference: '150,000–450,000', groupId: 'cbc-platelets', groupName: 'Platelets' },
]
const smearParameters: TestParameter[] = [
  { id: 'rbc-morphology', name: 'RBC Morphology', unit: '' },
  { id: 'wbc-morphology', name: 'WBC Morphology', unit: '' },
  { id: 'platelet-morphology', name: 'Platelet Morphology', unit: '' },
  { id: 'blood-cell-abnormalities', name: 'Blood Cell Abnormalities', unit: '' },
]

export const testProfiles: { id: TestProfile; label: string }[] = [
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

export function belongsToProfile(test: LabTest, profile: TestProfile) {
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



export const initialStore: Store = {
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

