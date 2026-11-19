import { MasterRecordDialog } from '@/features/workflows/MasterRecordDialog'
import { PatientRegistrationDialog } from '@/features/workflows/PatientRegistrationDialog'
import { PatientReportDialog } from '@/features/workflows/PatientReportDialog'
import { TestOrderDialog } from '@/features/workflows/TestOrderDialog'

export function WorkflowDialogs({ sampleCollectorMode = false, sampleCollectorId = '', editingPatientId = null, onEditingPatientComplete }: { sampleCollectorMode?: boolean; sampleCollectorId?: string; editingPatientId?: string | null; onEditingPatientComplete?: () => void }) {
  return (
    <>
      <PatientRegistrationDialog
        sampleCollectorMode={sampleCollectorMode}
        sampleCollectorId={sampleCollectorId}
        editingPatientId={editingPatientId}
        onEditingComplete={onEditingPatientComplete}
      />
      <TestOrderDialog sampleCollectorMode={sampleCollectorMode} />
      {!sampleCollectorMode && <MasterRecordDialog />}
      <PatientReportDialog sampleCollectorMode={sampleCollectorMode} />
    </>
  )
}
