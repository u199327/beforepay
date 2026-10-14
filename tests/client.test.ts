import { afterEach, expect, it, vi } from 'vitest'
import { runCheck } from '../src/engine/client'
afterEach(() => vi.unstubAllGlobals())
const response = (data: unknown) => new Response(JSON.stringify(data), { headers: { 'content-type': 'application/json' } })

it('falls back to browser RDAP when a registry rejects the server proxy', async () => {
  const fetcher = vi.fn(async (input: string | URL | Request) => {
    const url = String(input)
    if (url.endsWith('/api/status')) return response({ server: true, threat: false, registry: false, ai: false, expand: false })
    if (url.includes('/api/rdap')) return response({ status: 'unavailable', reason: 'registry returned 403' })
    if (url.startsWith('https://rdap.org/')) return response({ events: [{ eventAction: 'registration', eventDate: '2000-01-01T00:00:00Z' }] })
    return response({ Status: 0, Answer: [{ type: 1, data: '1.1.1.1' }] })
  })
  vi.stubGlobal('fetch', fetcher)
  const report = await runCheck(new URL('https://www.paypal.com/checkoutnow'), { source: 'paste' })
  expect(report.fields.find(field => field.key === 'registered')?.assurance).toBe('verified')
  expect(fetcher.mock.calls.some(([url]) => String(url).startsWith('https://rdap.org/'))).toBe(true)
})
