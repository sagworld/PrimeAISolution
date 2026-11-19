import type { FormEvent } from 'react'
import type { AttendanceStatus } from '@/shared/types'
import { HEAD_PASSWORD, HEAD_USERNAME } from '@/shared/data/initialStore'
import type { LabAppState } from '@/hooks/useLabState'
import type { AppCoreActions } from '@/hooks/useAppCore'

export function useAttendance(state: LabAppState, { persist, notify }: AppCoreActions) {
  const {
    store, headUsername, headPassword, setHeadLoginError, setHeadAuthenticated,
    setHeadUsername, setHeadPassword, setSection, setAdministrationTab, t,
  } = state
  const saveTechnicianAttendance = (
    date: string,
    statuses: Record<string, AttendanceStatus | ''>,
  ) => {
    const technicianIds = new Set(store.labTechnicians.map((technician) => technician.id))
    const remaining = store.attendance.filter((record) =>
      record.date !== date || !technicianIds.has(record.labTechnicianId),
    )
    const updatedAt = new Date().toISOString()
    const attendance = Object.entries(statuses).flatMap(([labTechnicianId, status]) =>
      status ? [{ id: `${date}:${labTechnicianId}`, labTechnicianId, date, status, updatedAt }] : [],
    )
    persist({ ...store, attendance: [...attendance, ...remaining] })
    notify('Attendance saved.')
  }

  const loginHead = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (headUsername.trim() !== HEAD_USERNAME || headPassword !== HEAD_PASSWORD) {
      setHeadLoginError(t('Incorrect username or password.'))
      return
    }
    setHeadAuthenticated(true)
    setAdministrationTab('attendance')
    setHeadUsername('')
    setHeadPassword('')
    setHeadLoginError('')
  }

  const logoutHead = () => {
    setHeadAuthenticated(false)
    setHeadUsername('')
    setHeadPassword('')
    setHeadLoginError('')
    setSection('administration')
    setAdministrationTab('attendance')
  }

  const openAdministration = () => {
    setHeadLoginError('')
    setSection('administration')
  }

  return { loginHead, logoutHead, openAdministration, saveTechnicianAttendance }
}
