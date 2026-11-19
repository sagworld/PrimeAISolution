import type { LabOrder, TestParameter } from '@/shared/types'
import { getParameterResult, getTest, getTestParameters } from '@/shared/utils/appUtils'
import type { LabAppState } from '@/hooks/useLabState'
import type { AppCoreActions } from '@/hooks/useAppCore'

export function useOrders(state: LabAppState, { persist, notify }: AppCoreActions) {
  const { store, resultDrafts, setResultDrafts } = state

  const updateOrder = (id: string, changes: Partial<LabOrder>) => {
    persist({ ...store, orders: store.orders.map((order) => order.id === id ? { ...order, ...changes, printedAt: undefined } : order) })
  }

  const saveOrderResults = (order: LabOrder) => {
    const parameters = getTestParameters(store, order)
    const isParameterized = Boolean(getTest(store, order.testId)?.parameters?.length)
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
      updateOrder(order.id, { parameterResults, result: parameterResults[parameters[0].id] ?? '', status: isComplete ? 'Completed' : 'Pending' })
      notify(isComplete ? 'All test parameter results saved.' : 'Parameter results saved. This test remains pending until all parameters are entered.')
      return
    }

    const result = resultDrafts[order.id]?.trim() ?? order.result.trim()
    if (!result) {
      notify('Enter a result before saving this order.')
      return
    }
    updateOrder(order.id, { result, status: 'Completed' })
    notify('Result saved.')
  }

  const updateParameterResult = (order: LabOrder, parameter: TestParameter, value: string) => {
    const parameters = getTestParameters(store, order)
    const parameterResults = { ...order.parameterResults, [parameter.id]: value }
    const status = parameters.every((item) => parameterResults[item.id]?.trim()) ? 'Completed' : 'Pending'
    setResultDrafts((drafts) => ({ ...drafts, [`${order.id}:${parameter.id}`]: value }))
    updateOrder(order.id, {
      parameterResults,
      result: parameter.id === parameters[0].id ? value : order.result,
      status,
    })
  }

  return { updateOrder, saveOrderResults, updateParameterResult }
}
