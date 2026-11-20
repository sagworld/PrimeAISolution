import type { UiLanguage } from '@/i18n'
import type { AppearanceSettings, LabOrder, LabProfile, LabTechnician, LabTest, PersistedPatient, Referrer, Store, TestReagentUsage } from '@/shared/types'
import { APPEARANCE_STORAGE_KEY, initialStore, LAB_PROFILE_STORAGE_KEY, STORAGE_KEY, UI_LANGUAGE_STORAGE_KEY } from '@/shared/data/initialStore'

const emptyLabProfile: LabProfile = {
  name: '',
  address: '',
  ownerName: '',
  mobile: '',
  logoDataUrl: '',
  signatureDataUrl: '',
}
const maxImageDataUrlLength = 700_000

function isLabImage(value: unknown): value is string {
  return value === '' ||
    (typeof value === 'string' && value.length <= maxImageDataUrlLength &&
      /^data:image\/(?:png|jpeg);base64,[A-Za-z0-9+/]+={0,2}$/.test(value))
}

function isLabProfile(value: unknown): value is LabProfile {
  if (typeof value !== 'object' || value === null) return false
  return 'name' in value && typeof value.name === 'string' && value.name.length <= 120 &&
    'address' in value && typeof value.address === 'string' && value.address.length <= 500 &&
    'ownerName' in value && typeof value.ownerName === 'string' && value.ownerName.length <= 120 &&
    'mobile' in value && typeof value.mobile === 'string' && value.mobile.length <= 40 &&
    'logoDataUrl' in value && isLabImage(value.logoDataUrl) &&
    'signatureDataUrl' in value && isLabImage(value.signatureDataUrl)
}

export function readLabProfile(): LabProfile {
  try {
    const saved = localStorage.getItem(LAB_PROFILE_STORAGE_KEY)
    if (!saved) return emptyLabProfile
    const parsed: unknown = JSON.parse(saved)
    if (isLabProfile(parsed)) return parsed
    console.error('Saved lab profile settings are invalid.')
  } catch (error) {
    console.error('Unable to load lab profile settings.', error)
  }
  return emptyLabProfile
}

export function saveLabProfile(profile: LabProfile): void {
  if (!isLabProfile(profile) || !profile.name.trim() || !profile.address.trim() ||
    !profile.ownerName.trim() || !profile.mobile.trim()) {
    throw new Error('Enter the lab name, address, owner name, and mobile number.')
  }
  try {
    localStorage.setItem(LAB_PROFILE_STORAGE_KEY, JSON.stringify({
      ...profile,
      name: profile.name.trim(),
      address: profile.address.trim(),
      ownerName: profile.ownerName.trim(),
      mobile: profile.mobile.trim(),
    }))
  } catch (error) {
    console.error('Unable to save lab profile settings.', error)
    throw new Error('Could not save lab settings in this browser.')
  }
}

export function readUiLanguage(): UiLanguage {
  try {
    const saved = localStorage.getItem(UI_LANGUAGE_STORAGE_KEY)
    if (saved === 'en' || saved === 'mr' || saved === 'hi') return saved
  } catch (error) {
    console.error('Unable to load the saved language preference.', error)
  }
  return 'en'
}

export function readAppearance(): AppearanceSettings {
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

function isTestReagentUsage(value: unknown): value is TestReagentUsage {
  return typeof value === 'object' && value !== null &&
    'itemId' in value && typeof value.itemId === 'string' &&
    'quantity' in value && typeof value.quantity === 'number' && Number.isFinite(value.quantity) && value.quantity > 0
}

function normalizeTestReagents(value: unknown) {
  return Array.isArray(value) ? value.filter(isTestReagentUsage) : []
}

export function readStore(): Store {
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
          ? {
              ...defaultTest,
              ...savedTest,
              parameters: savedTest.parameters?.length
                ? savedTest.parameters.map((parameter) => ({
                    ...defaultTest.parameters?.find((item) => item.id === parameter.id),
                    ...parameter,
                    groupName: parameter.groupName ?? defaultTest.parameters?.find((item) => item.id === parameter.id)?.groupName,
                    groupId: parameter.groupId ?? defaultTest.parameters?.find((item) => item.id === parameter.id)?.groupId,
                  }))
                : defaultTest.parameters,
              reagents: normalizeTestReagents(savedTest.reagents),
            }
          : defaultTest
      })
      const savedTestIds = new Set(tests.map((test) => test.id))
      tests.push(...savedStore.tests.filter((test) => !savedTestIds.has(test.id)).map((test) => ({
        ...test,
        reagents: normalizeTestReagents(test.reagents),
      })))
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
