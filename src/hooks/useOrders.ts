import type { LabOrder, TestParameter } from '@/shared/types'
import { getParameterResult, getTest, getTestParameters } from '@/shared/utils/appUtils'
import { storeExpenditureService } from '@/features/store-expenditure/services/storeExpenditureService'
import { StoreExpenditureError } from '@/features/store-expenditure/types'
import type { LabAppState } from '@/hooks/useLabState'
import type { AppCoreActions } from '@/hooks/useAppCore'

export function useOrders(state: LabAppState, { persist, notify }: AppCoreActions) {
  const { store, resultDrafts, setResultDrafts } = state

  const updateOrder = (id: string, changes: Partial<LabOrder>) => {
    persist({ ...store, orders: store.orders.map((order) => order.id === id ? { ...order, ...changes, printedAt: undefined } : order) })
  }

  const deductTestReagents = (order: LabOrder) => {
    const test = getTest(store, order.testId)
    if (!test?.reagents?.length || order.reagentsDeductedAt) return { ok: true as const, deductedAt: order.reagentsDeductedAt }
    try {
      storeExpenditureService.deductStockForOrder(order.id, test.reagents)
      return { ok: true as const, deductedAt: new Date().toISOString() }
    } catch (error) {
      if (error instanceof StoreExpenditureError) {
        notify(error.message)
        return { ok: false as const }
      }
      throw error
    }
  }

  const saveOrderResults = (order: LabOrder) => {
    const test = getTest(store, order.testId)
    const parameters = getTestParameters(store, order)
    const isParameterized = Boolean(test?.parameters?.length)
    if (isParameterized) {
      const parameterResults = Object.fromEntries(parameters.map((parameter) => {
        const draftKey = `${order.id}:${parameter.id}`
        return [parameter.id, resultDrafts[draftKey] ?? getParameterResult(order, parameter)]
      }))
      const hasAnyResult = Object.values(parameterResults).some((value) => value.trim())
      if (!hasAnyResult) {
        notify('Enter at least one parameter result before saving.')
        return
      }
      const isComplete = parameters.every((parameter) => parameterResults[parameter.id]?.trim())
      const reagentDeduction = isComplete ? deductTestReagents(order) : null
      if (reagentDeduction && !reagentDeduction.ok) return
      updateOrder(order.id, {
        parameterResults,
        result: parameterResults[parameters[0].id] ?? '',
        status: isComplete ? 'Completed' : 'Pending',
        ...(reagentDeduction?.ok && reagentDeduction.deductedAt ? { reagentsDeductedAt: reagentDeduction.deductedAt } : {}),
      })
      notify(isComplete ? 'All test parameter results saved.' : 'Parameter results saved. This test remains pending until all parameters are entered.')
      return
    }

    const result = resultDrafts[order.id]?.trim() ?? order.result.trim()
    if (!result) {
      notify('Enter a result before saving this order.')
      return
    }
    const reagentDeduction = deductTestReagents(order)
    if (!reagentDeduction.ok) return
    updateOrder(order.id, {
      result,
      status: 'Completed',
      ...(reagentDeduction.deductedAt ? { reagentsDeductedAt: reagentDeduction.deductedAt } : {}),
    })
    notify('Result saved.')
  }

  const updateParameterResult = (order: LabOrder, parameter: TestParameter, value: string) => {
    const parameters = getTestParameters(store, order)
    const parameterResults = { ...order.parameterResults, [parameter.id]: value }
    const status = parameters.every((item) => parameterResults[item.id]?.trim()) ? 'Completed' : 'Pending'
    const reagentDeduction = status === 'Completed' ? deductTestReagents(order) : null
    setResultDrafts((drafts) => ({ ...drafts, [`${order.id}:${parameter.id}`]: value }))
    updateOrder(order.id, {
      parameterResults,
      result: parameter.id === parameters[0].id ? value : order.result,
      status: reagentDeduction && !reagentDeduction.ok ? 'Pending' : status,
      ...(reagentDeduction?.ok && reagentDeduction.deductedAt ? { reagentsDeductedAt: reagentDeduction.deductedAt } : {}),
    })
  }

  return { updateOrder, saveOrderResults, updateParameterResult }
}
