import type { FormEvent } from 'react'
import type { LabOrder, LabTest, MasterTab, Patient } from '@/shared/types'
import { belongsToProfile } from '@/shared/data/initialStore'
import { makeId, nextRecordId } from '@/shared/utils/appUtils'
import type { LabAppState } from '@/hooks/useLabState'
import type { AppCoreActions } from '@/hooks/useAppCore'

export function useLabWorkflows(state: LabAppState, { persist, notify }: AppCoreActions) {
  const {
    store, selectedPatientId, selectedTestProfile, selectedTestIds, patientDraft, masterDialog,
    masterDraft, parameterDrafts, reagentDrafts, generationPatientId, setTestDialog, setSelectedPatientId,
    setSelectedTestProfile, setSelectedTestIds, setMasterDraft, setParameterDrafts, setReagentDrafts, setMasterDialog,
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
    setParameterDrafts([{ name: '', isGroup: false, parameters: [{ name: '', unit: '', reference: '' }] }])
    setReagentDrafts([])
    setMasterDialog(tab)
  }

  const addPatient = (event: FormEvent<HTMLFormElement>, createdBySampleCollector = false) => {
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
      createdBySampleCollector,
      createdAt: new Date().toISOString(),
    }
    persist({ ...store, patients: [patient, ...store.patients] })
    setPatientDraft({ name: '', age: '', gender: 'Female', phone: '', labTechnicianId: '', sampleCollectorId: '', referrerId: '' })
    setPatientDialog(false)
    notify('Patient registered successfully.')
  }

  const updatePatient = (patientId: string, event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const currentPatient = store.patients.find((patient) => patient.id === patientId)
    if (!currentPatient) {
      notify('Patient record could not be found.')
      return false
    }
    const updatedPatient: Patient = {
      ...currentPatient,
      name: patientDraft.name.trim(),
      age: Number(patientDraft.age),
      gender: patientDraft.gender,
      phone: patientDraft.phone.trim(),
      labTechnicianId: patientDraft.labTechnicianId,
      sampleCollectorId: currentPatient.createdBySampleCollector ? currentPatient.sampleCollectorId : patientDraft.sampleCollectorId,
      referrerId: currentPatient.createdBySampleCollector ? currentPatient.referrerId : patientDraft.referrerId,
    }
    persist({
      ...store,
      patients: store.patients.map((patient) => patient.id === patientId ? updatedPatient : patient),
    })
    setPatientDraft({ name: '', age: '', gender: 'Female', phone: '', labTechnicianId: '', sampleCollectorId: '', referrerId: '' })
    setPatientDialog(false)
    notify('Patient details updated successfully.')
    return true
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
      if (reagentDrafts.some((reagent) => !reagent.itemId || !reagent.quantity.trim() || !Number.isFinite(Number(reagent.quantity)) || Number(reagent.quantity) <= 0 || Math.abs(Number(reagent.quantity) * 100 - Math.round(Number(reagent.quantity) * 100)) > 1e-8)) {
        notify('Select a reagent and enter a valid quantity used.')
        return
      }
      const testId = makeId('test')
      let parameterIndex = 0
      const parameters = parameterDrafts.flatMap((group, groupIndex) => {
        const groupName = group.isGroup ? group.name.trim() : ''
        const groupId = groupName ? `${testId}-group-${groupIndex + 1}` : ''
        return group.parameters.map((parameter) => {
          parameterIndex += 1
          return {
            id: `${makeId('parameter')}-${parameterIndex}`,
            name: parameter.name.trim(),
            unit: parameter.unit.trim(),
            reference: parameter.reference.trim(),
            ...(groupId ? { groupId, groupName } : {}),
          }
        })
      }).filter((parameter) => parameter.name)
      if (!parameters.length) {
        notify('Add at least one named test parameter.')
        return
      }
      const test: LabTest = {
        id: testId,
        name: masterDraft.name.trim(),
        category: masterDraft.category.trim(),
        price: Number(masterDraft.price),
        unit: '',
        reference: '',
        parameters,
        reagents: reagentDrafts.map((reagent) => ({ itemId: reagent.itemId, quantity: Number(reagent.quantity) })),
      }
      persist({ ...store, tests: [test, ...store.tests] })
    }
    setMasterDialog(null)
    setMasterDraft({ name: '', specialty: '', organization: '', phone: '', category: '', price: '' })
    setParameterDrafts([{ name: '', isGroup: false, parameters: [{ name: '', unit: '', reference: '' }] }])
    setReagentDrafts([])
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

  return { openTestDialog, openMasterDialog, addPatient, updatePatient, addTestOrder, addMaster, selectedProfileTests, generationOrders, masterTabDetails }
}
