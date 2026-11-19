import { useAiInterpretation } from '@/hooks/useAiInterpretation'
import { useAppCore } from '@/hooks/useAppCore'
import { useAttendance } from '@/hooks/useAttendance'
import { useDashboardData } from '@/hooks/useDashboardData'
import { useGlobalSearchShortcut } from '@/hooks/useGlobalSearchShortcut'
import { useLabState } from '@/hooks/useLabState'
import { useLabWorkflows } from '@/hooks/useLabWorkflows'
import { useOrders } from '@/hooks/useOrders'
import { usePatientReport } from '@/hooks/usePatientReport'
import { usePreferences } from '@/hooks/usePreferences'
import { useReportCollection } from '@/hooks/useReportCollection'
import { useRevenueData } from '@/hooks/useRevenueData'

export function useLabApp() {
  const state = useLabState()
  useGlobalSearchShortcut()

  const core = useAppCore(state)
  const preferences = usePreferences(state)
  const attendance = useAttendance(state, core)
  const orders = useOrders(state, core)
  const workflows = useLabWorkflows(state, core)
  const dashboard = useDashboardData(state)
  const reportCollection = useReportCollection(state)
  const revenue = useRevenueData(state)
  const patientReport = usePatientReport(state, core)
  const aiInterpretation = useAiInterpretation(
    state,
    patientReport.selectedReportPatient,
    patientReport.selectedPatientOrders,
  )

  return {
    ...state,
    ...core,
    ...preferences,
    ...attendance,
    ...orders,
    ...workflows,
    ...dashboard,
    ...reportCollection,
    ...revenue,
    ...patientReport,
    ...aiInterpretation,
  }
}
