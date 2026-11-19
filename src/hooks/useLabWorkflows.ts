import type { FormEvent } from 'react'
import type { LabOrder, LabTest, MasterTab, Patient } from '@/shared/types'
import { belongsToProfile } from '@/shared/data/initialStore'
import { makeId, nextRecordId } from '@/shared/utils/appUtils'
import type { LabAppState } from '@/hooks/useLabState'
import type { AppCoreActions } from '@/hooks/useAppCore'

export function useLabWorkflows(state: LabAppState, { persist, notify }: AppCoreActions) {
  const {
    store, selectedPatientId, selectedTestProfile, selectedTestIds, patientDraft, masterDialog,
    masterDraft, parameterDrafts, generationPatientId, setTestDialog, setSelectedPatientId,
    setSelectedTestProfile, setSelectedTestIds, setMasterDraft, setParameterDrafts, setMasterDialog,
    setPatientDraft, setPatientDialog,
  } = state
  const t = state.t

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

  return { openTestDialog, openMasterDialog, addPatient, addTestOrder, addMaster, selectedProfileTests, generationOrders, masterTabDetails }
}
