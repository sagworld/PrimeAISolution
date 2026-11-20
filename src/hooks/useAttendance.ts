import { useCallback, useEffect } from 'react'
import type { AttendanceRecord, AttendanceStatus } from '@/shared/types'
import type { AuthenticatedUser } from '@/services/authService'
import { getAttendance, saveAttendance as saveAttendanceApi } from '@/services/labService'
import type { LabAppState } from '@/hooks/useLabState'
import type { AppCoreActions } from '@/hooks/useAppCore'

function replaceAttendanceRange(
  current: AttendanceRecord[],
  records: AttendanceRecord[],
  from: string,
  to: string,
): AttendanceRecord[] {
  return [
    ...current.filter((record) => record.date < from || record.date > to),
    ...records,
  ]
}

export function useAttendance(
  state: LabAppState,
  { notify }: AppCoreActions,
  user: AuthenticatedUser | null,
) {
  const {
    setStore, setSection, attendanceStartDate, attendanceEndDate,
  } = state

  const loadAttendanceRange = useCallback(async (from: string, to: string) => {
    try {
      const records = await getAttendance(from, to)
      setStore((current) => ({
        ...current,
        attendance: replaceAttendanceRange(current.attendance, records, from, to),
      }))
    } catch (reason) {
      notify(reason instanceof Error ? reason.message : 'Unable to load attendance records.')
    }
  }, [notify, setStore])

  useEffect(() => {
    if (user?.role !== 'owner') return
    let active = true
    void getAttendance(attendanceStartDate, attendanceEndDate).then((records) => {
      if (active) {
        setStore((current) => ({
          ...current,
          attendance: replaceAttendanceRange(current.attendance, records, attendanceStartDate, attendanceEndDate),
        }))
      }
    }).catch((reason: unknown) => {
      if (active) notify(reason instanceof Error ? reason.message : 'Unable to load attendance records.')
    })
    return () => { active = false }
  }, [attendanceEndDate, attendanceStartDate, notify, setStore, user?.id, user?.role])

  const saveTechnicianAttendance = async (
    date: string,
    statuses: Record<string, AttendanceStatus | ''>,
  ) => {
    try {
      const records = await saveAttendanceApi(date, statuses)
      setStore((current) => ({
        ...current,
        attendance: replaceAttendanceRange(current.attendance, records, date, date),
      }))
      notify('Attendance saved.')
    } catch (reason) {
      notify(reason instanceof Error ? reason.message : 'Unable to save attendance.')
    }
  }

  const openAdministration = () => {
    setSection('administration')
  }

  return { openAdministration, saveTechnicianAttendance, loadAttendanceRange }
}
