import { GET as status } from './status'
import { GET as rdap } from './rdap'
import { GET as registry } from './registry'
import { POST as threat } from './threat'
import { json, type Bindings } from './_lib/http'

const ALLOWED = new Set(['https://aleetreny.github.io'])

/** Optional Web-standard API. No submitted payment URL is fetched. */
export async function routeApi(req: Request, bindings: Bindings = {}): Promise<Response> {
  const origin = req.headers.get('origin')
  if (origin && origin !== new URL(req.url).origin && !ALLOWED.has(origin)) return json({ error: 'origin_not_allowed' }, 403)
  const cors: Record<string, string> = origin ? { 'access-control-allow-origin': origin, 'vary': 'Origin' } : {}
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: { ...cors, 'access-control-allow-methods': 'GET, POST, OPTIONS', 'access-control-allow-headers': 'Content-Type', 'access-control-max-age': '600' } })
  const routes: Record<string, { method: string; handler: (req: Request, bindings: Bindings) => Response | Promise<Response> }> = {
    '/api/status': { method: 'GET', handler: status },
    '/api/rdap': { method: 'GET', handler: rdap },
    '/api/registry': { method: 'GET', handler: registry },
    '/api/threat': { method: 'POST', handler: threat },
  }
  const route = routes[new URL(req.url).pathname]
  let response: Response
  if (!route) response = json({ error: 'not_found' }, 404)
  else if (req.method !== route.method) response = json({ error: 'method_not_allowed' }, 405, { allow: route.method })
  else { try { response = await route.handler(req, bindings) } catch { response = json({ error: 'service_unavailable' }, 503) } }
  const headers = new Headers(response.headers)
  for (const [key, value] of Object.entries(cors)) headers.set(key, value)
  headers.set('referrer-policy', 'no-referrer')
  headers.set('x-content-type-options', 'nosniff')
  return new Response(response.body, { status: response.status, headers })
}
