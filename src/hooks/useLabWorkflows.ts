import type { FormEvent } from 'react'
import type { MasterTab } from '@/shared/types'
import { belongsToProfile } from '@/shared/data/initialStore'
import type { LabAppState } from '@/hooks/useLabState'
import type { AppCoreActions } from '@/hooks/useAppCore'
import { createMaster, createOrders, createPatient, createTest, updatePatient as updatePatientApi } from '@/services/labService'

export function useLabWorkflows(state: LabAppState, { updateStore, notify }: AppCoreActions) {
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

  const addPatient = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    try {
      const patient = await createPatient({
        name: patientDraft.name.trim(),
        age: Number(patientDraft.age),
        gender: patientDraft.gender,
        phone: patientDraft.phone.trim(),
        labTechnicianId: patientDraft.labTechnicianId,
        sampleCollectorId: patientDraft.sampleCollectorId,
        referrerId: patientDraft.referrerId,
      })
      updateStore((current) => ({ ...current, patients: [patient, ...current.patients] }))
      setPatientDraft({ name: '', age: '', gender: 'Female', phone: '', labTechnicianId: '', sampleCollectorId: '', referrerId: '' })
      setPatientDialog(false)
      notify('Patient registered successfully.')
    } catch (reason) {
      notify(reason instanceof Error ? reason.message : 'Unable to register this patient.')
    }
  }

  const updatePatient = async (patientId: string, event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const currentPatient = store.patients.find((patient) => patient.id === patientId)
    if (!currentPatient) {
      notify('Patient record could not be found.')
      return false
    }
    try {
      const updatedPatient = await updatePatientApi(patientId, {
        name: patientDraft.name.trim(),
        age: Number(patientDraft.age),
        gender: patientDraft.gender,
        phone: patientDraft.phone.trim(),
        labTechnicianId: patientDraft.labTechnicianId,
        sampleCollectorId: currentPatient.createdBySampleCollector ? currentPatient.sampleCollectorId : patientDraft.sampleCollectorId,
        referrerId: currentPatient.createdBySampleCollector ? currentPatient.referrerId : patientDraft.referrerId,
      })
      updateStore((current) => ({
        ...current,
        patients: current.patients.map((patient) => patient.id === patientId ? updatedPatient : patient),
      }))
      setPatientDraft({ name: '', age: '', gender: 'Female', phone: '', labTechnicianId: '', sampleCollectorId: '', referrerId: '' })
      setPatientDialog(false)
      notify('Patient details updated successfully.')
      return true
    } catch (reason) {
      notify(reason instanceof Error ? reason.message : 'Unable to update this patient.')
      return false
    }
  }

  const addTestOrder = async (event: FormEvent<HTMLFormElement>) => {
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
    try {
      const newOrders = await createOrders(selectedPatientId, selectedTestProfile, selectedTestIds)
      updateStore((current) => ({ ...current, orders: [...newOrders, ...current.orders] }))
      setTestDialog(false)
      setSelectedTestIds([])
      notify(`${newOrders.length} test${newOrders.length === 1 ? '' : 's'} added to the patient queue.`)
    } catch (reason) {
      notify(reason instanceof Error ? reason.message : 'Unable to add these tests.')
    }
  }

  const addMaster = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    try {
      if (masterDialog === 'lab-technicians') {
        const record = await createMaster('lab-technicians', {
          name: masterDraft.name.trim(),
          specialty: masterDraft.specialty.trim(),
          phone: masterDraft.phone.trim(),
        })
        updateStore((current) => ({ ...current, labTechnicians: [record, ...current.labTechnicians] }))
      } else if (masterDialog === 'referrers') {
        const record = await createMaster('referrers', {
          name: masterDraft.name.trim(),
          organization: masterDraft.organization.trim(),
          phone: masterDraft.phone.trim(),
        })
        updateStore((current) => ({ ...current, referrers: [record, ...current.referrers] }))
      } else if (masterDialog === 'sample-collectors') {
        const record = await createMaster('sample-collectors', {
          name: masterDraft.name.trim(),
          phone: masterDraft.phone.trim(),
        })
        updateStore((current) => ({ ...current, sampleCollectors: [record, ...current.sampleCollectors] }))
      } else if (masterDialog === 'tests') {
        if (reagentDrafts.some((reagent) => !reagent.itemId || !reagent.quantity.trim() || !Number.isFinite(Number(reagent.quantity)) || Number(reagent.quantity) <= 0 || Math.abs(Number(reagent.quantity) * 100 - Math.round(Number(reagent.quantity) * 100)) > 1e-8)) {
          notify('Select a reagent and enter a valid quantity used.')
          return
        }
        const parameterGroups = parameterDrafts.map((group) => ({
          name: group.isGroup ? group.name.trim() : '',
          parameters: group.parameters
            .filter((parameter) => parameter.name.trim())
            .map((parameter) => ({
              name: parameter.name.trim(),
              unit: parameter.unit.trim(),
              reference: parameter.reference.trim(),
            })),
        })).filter((group) => group.parameters.length > 0)
        if (!parameterGroups.length) {
          notify('Add at least one named test parameter.')
          return
        }
        const test = await createTest({
          name: masterDraft.name.trim(),
          category: masterDraft.category.trim(),
          price: Number(masterDraft.price),
          profiles: [],
          parameterGroups,
          reagents: reagentDrafts.map((reagent) => ({ itemId: reagent.itemId, quantity: Number(reagent.quantity) })),
        })
        updateStore((current) => ({ ...current, tests: [test, ...current.tests] }))
      }
      if (!masterDialog) return
      setMasterDialog(null)
      setMasterDraft({ name: '', specialty: '', organization: '', phone: '', category: '', price: '' })
      setParameterDrafts([{ name: '', isGroup: false, parameters: [{ name: '', unit: '', reference: '' }] }])
      setReagentDrafts([])
      notify('Master record added.')
    } catch (reason) {
      notify(reason instanceof Error ? reason.message : 'Unable to add this master record.')
    }
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
