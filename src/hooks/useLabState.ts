import { useEffect, useRef, useState } from 'react'
import { type UiLanguage } from '@/i18n'
import type {
  AppearanceSettings,
  AdministrationTab,
  ExplanationLanguage,
  MasterTab,
  OrderStatusFilter,
  LabProfile,
  ReportPeriod,
  RevenueCategory,
  Section,
  Store,
  TestProfile,
} from '@/shared/types'
import { dateInputValue, explanationLanguage } from '@/shared/utils/appUtils'
import { readAppearance, readLabProfile, readStore, readUiLanguage } from '@/services/browserStorage'
import { LAB_PROFILE_STORAGE_KEY, STORAGE_KEY } from '@/shared/data/initialStore'
import { translate } from '@/i18n'

export function useLabState() {
  const [store, setStore] = useState<Store>(readStore)
  const [labProfile, setLabProfile] = useState<LabProfile>(readLabProfile)
  const [uiLanguage, setUiLanguage] = useState<UiLanguage>(readUiLanguage)
  const [appearance, setAppearance] = useState<AppearanceSettings>(readAppearance)
  const [section, setSection] = useState<Section>('overview')
  const [administrationTab, setAdministrationTab] = useState<AdministrationTab>('attendance')
  const [headAuthenticated, setHeadAuthenticated] = useState(false)
  const [headUsername, setHeadUsername] = useState('')
  const [headPassword, setHeadPassword] = useState('')
  const [headLoginError, setHeadLoginError] = useState('')
  const [attendanceStartDate, setAttendanceStartDate] = useState(() => dateInputValue())
  const [attendanceEndDate, setAttendanceEndDate] = useState(() => dateInputValue())
  const [attendanceMarkDate, setAttendanceMarkDate] = useState(() => dateInputValue())
  const [attendanceInfoTechnicianId, setAttendanceInfoTechnicianId] = useState<string | null>(null)
  const [masterTab, setMasterTab] = useState<MasterTab>('lab-technicians')
  const [reportPeriod, setReportPeriod] = useState<ReportPeriod>('Daily')
  const [revenueCategory, setRevenueCategory] = useState<RevenueCategory>('doctor')
  const [revenueFromDate, setRevenueFromDate] = useState(() => dateInputValue())
  const [revenueToDate, setRevenueToDate] = useState(() => dateInputValue())
  const [orderStatusFilter, setOrderStatusFilter] = useState<OrderStatusFilter>('All')
  const [search, setSearch] = useState('')
  const [patientDialog, setPatientDialog] = useState(false)
  const [testDialog, setTestDialog] = useState(false)
  const [masterDialog, setMasterDialog] = useState<MasterTab | null>(null)
  const [reportPatientId, setReportPatientId] = useState<string | null>(null)
  const [reportOrderIds, setReportOrderIds] = useState<string[] | null>(null)
  const [reportHeaderEnabled, setReportHeaderEnabled] = useState(true)
  const [generationPatientId, setGenerationPatientId] = useState('')
  const [aiLanguage, setAiLanguage] = useState<ExplanationLanguage>(() => explanationLanguage(uiLanguage))
  const [aiInterpretation, setAiInterpretation] = useState<{ text: string; model: string } | null>(null)
  const [aiLoading, setAiLoading] = useState(false)
  const [aiError, setAiError] = useState('')
  const [sharingReport, setSharingReport] = useState(false)
  const reportRef = useRef<HTMLDivElement>(null)
  const [selectedPatientId, setSelectedPatientId] = useState('')
  const [selectedTestProfile, setSelectedTestProfile] = useState<TestProfile | ''>('')
  const [selectedTestIds, setSelectedTestIds] = useState<string[]>([])
  const [patientDraft, setPatientDraft] = useState({ name: '', age: '', gender: 'Female', phone: '', labTechnicianId: '', sampleCollectorId: '', referrerId: '' })
  const [masterDraft, setMasterDraft] = useState({ name: '', specialty: '', organization: '', phone: '', category: '', price: '' })
  const [parameterDrafts, setParameterDrafts] = useState([{ name: '', isGroup: false, parameters: [{ name: '', unit: '', reference: '' }] }])
  const [reagentDrafts, setReagentDrafts] = useState<{ itemId: string; quantity: string }[]>([])
  const [resultDrafts, setResultDrafts] = useState<Record<string, string>>({})
  const [toast, setToast] = useState('')
  const t = (text: string) => translate(uiLanguage, text)

  useEffect(() => {
    const syncWorkspaceFromOtherTab = (event: StorageEvent) => {
      if (event.key === STORAGE_KEY || event.key === null) setStore(readStore())
      if (event.key === LAB_PROFILE_STORAGE_KEY || event.key === null) setLabProfile(readLabProfile())
    }
    window.addEventListener('storage', syncWorkspaceFromOtherTab)
    return () => window.removeEventListener('storage', syncWorkspaceFromOtherTab)
  }, [])

  return {
    store, setStore, labProfile, setLabProfile, uiLanguage, setUiLanguage, appearance, setAppearance, section, setSection,
    administrationTab, setAdministrationTab,
    headAuthenticated, setHeadAuthenticated, headUsername, setHeadUsername, headPassword, setHeadPassword,
    headLoginError, setHeadLoginError, attendanceStartDate, setAttendanceStartDate,
    attendanceEndDate, setAttendanceEndDate, attendanceMarkDate, setAttendanceMarkDate,
    attendanceInfoTechnicianId, setAttendanceInfoTechnicianId,
    masterTab, setMasterTab,
    reportPeriod, setReportPeriod, revenueCategory, setRevenueCategory,
    revenueFromDate, setRevenueFromDate, revenueToDate, setRevenueToDate,
    orderStatusFilter, setOrderStatusFilter, search, setSearch, patientDialog, setPatientDialog,
    testDialog, setTestDialog, masterDialog, setMasterDialog, reportPatientId, setReportPatientId,
    reportOrderIds, setReportOrderIds, reportHeaderEnabled, setReportHeaderEnabled,
    generationPatientId, setGenerationPatientId, aiLanguage, setAiLanguage,
    aiInterpretation, setAiInterpretation, aiLoading, setAiLoading, aiError, setAiError, sharingReport,
    setSharingReport, reportRef, selectedPatientId, setSelectedPatientId, selectedTestProfile,
    setSelectedTestProfile, selectedTestIds, setSelectedTestIds, patientDraft, setPatientDraft,
    masterDraft, setMasterDraft, parameterDrafts, setParameterDrafts, reagentDrafts, setReagentDrafts,
    resultDrafts, setResultDrafts,
    toast, setToast, t,
  }
}

export type LabAppState = ReturnType<typeof useLabState>
