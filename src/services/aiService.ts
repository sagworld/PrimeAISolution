export async function readApiJson<T>(response: Response): Promise<T> {
  const body = await response.text()
  if (!body.trim()) {
    throw new Error('The AI service returned an empty response. Restart it with npm run ai:server and try again.')
  }
  try {
    return JSON.parse(body) as T
  } catch {
    throw new Error('The AI service returned an invalid response. Restart it with npm run ai:server and try again.')
  }
}
