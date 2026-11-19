import type { UiLanguage } from '@/i18n'
import type { AppearanceSettings, LabOrder, LabTechnician, LabTest, PersistedPatient, Referrer, Store } from '@/shared/types'
import { APPEARANCE_STORAGE_KEY, initialStore, STORAGE_KEY, UI_LANGUAGE_STORAGE_KEY } from '@/shared/data/initialStore'

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
