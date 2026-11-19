import type { FormEvent } from 'react'
import type { AttendanceStatus } from '@/shared/types'
import { HEAD_PASSWORD, HEAD_USERNAME } from '@/shared/data/initialStore'
import type { LabAppState } from '@/hooks/useLabState'
import type { AppCoreActions } from '@/hooks/useAppCore'

export function useAttendance(state: LabAppState, { persist }: AppCoreActions) {
  const {
    store, attendanceDate, headUsername, headPassword, setHeadLoginError, setHeadAuthenticated,
    setHeadUsername, setHeadPassword, setSection, t,
  } = state

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

  return { loginHead, logoutHead, openAttendance, setTechnicianAttendance }
}
