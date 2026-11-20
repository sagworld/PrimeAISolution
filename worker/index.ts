import { handleAuthRequest } from './auth'
import { handleDomainRequest } from './domain'
import { handleInventoryRequest } from './inventory'
import { handleLabSettingsRequest } from './labSettings'
import { handleMasterRequest } from './masters'
import { handleReportRequest } from './reports'

interface Env {
  DB: D1Database
  ASSETS: R2Bucket
  BOOTSTRAP_TOKEN?: string
  AUTH_HMAC_SECRET?: string
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': 'no-store',
    },
  })
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url)
    const authResponse = await handleAuthRequest(request, env)
    if (authResponse) return authResponse
    const domainResponse = await handleDomainRequest(request, env)
    if (domainResponse) return domainResponse
    const labSettingsResponse = await handleLabSettingsRequest(request, env)
    if (labSettingsResponse) return labSettingsResponse
    const inventoryResponse = await handleInventoryRequest(request, env)
    if (inventoryResponse) return inventoryResponse
    const reportResponse = await handleReportRequest(request, env)
    if (reportResponse) return reportResponse
    const masterResponse = await handleMasterRequest(request, env)
    if (masterResponse) return masterResponse

    if (url.pathname !== '/api/health') {
      return jsonResponse({ error: 'API route not found.' }, 404)
    }
    if (request.method !== 'GET') {
      return new Response(null, {
        status: 405,
        headers: { allow: 'GET' },
      })
    }

    try {
      await env.DB.prepare('SELECT 1').first()
      return jsonResponse({ status: 'ok' })
    } catch (error) {
      console.error('D1 health check failed.', error)
      return jsonResponse({ error: 'Database unavailable.' }, 503)
    }
  },
}
