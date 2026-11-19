import { MasterRecordDialog } from '@/features/workflows/MasterRecordDialog'
import { PatientRegistrationDialog } from '@/features/workflows/PatientRegistrationDialog'
import { PatientReportDialog } from '@/features/workflows/PatientReportDialog'
import { TestOrderDialog } from '@/features/workflows/TestOrderDialog'

export function WorkflowDialogs() {
  return (
    <>
      <PatientRegistrationDialog />
      <TestOrderDialog />
      <MasterRecordDialog />
      <PatientReportDialog />
    </>
  )
}
