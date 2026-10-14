import { afterEach, describe, expect, it, vi } from 'vitest'
import { routeApi } from '../api/router'
afterEach(() => vi.unstubAllGlobals())

const request = (path: string, init?: RequestInit) => new Request(`https://api.beforepay.example/api/${path}`, init)
const body = (url: string) => ({ method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ url }) })
describe('Optional APIs with Worker bindings', () => {
  it('reports capabilities without returning secrets', async () => {
    const r = await routeApi(request('status'), { COMPANIES_HOUSE_API_KEY: 'private-test-key', GOOGLE_WEB_RISK_KEY: 'private-risk-key' })
    const data = await r.json()
    expect(data).toMatchObject({ server: true, registry: true, threat: true, ai: false, expand: false, threatProvider: 'Google Web Risk' })
    expect(JSON.stringify(data)).not.toContain('private-')
  })
  it('keeps missing threat keys unchecked', async () => {
    const r = await routeApi(request('threat', body('https://www.paypal.com/pay')))
    expect(r.status).toBe(501)
    expect(await r.json()).toEqual({ status: 'not_configured' })
  })
  it('permits the Pages origin and blocks other browser origins', async () => {
    expect((await routeApi(request('status', { headers: { origin: 'https://evil.example' } }))).status).toBe(403)
    const r = await routeApi(request('status', { headers: { origin: 'https://aleetreny.github.io' } }))
    expect(r.headers.get('access-control-allow-origin')).toBe('https://aleetreny.github.io')
  })
  it('uses Safe Browsing v5 and caches the stated duration', async () => {
    const fetcher = vi.fn().mockResolvedValue(new Response(JSON.stringify({ threats: [{ threatTypes: ['SOCIAL_ENGINEERING'] }], cacheDuration: '60s' }), { status: 200 }))
    vi.stubGlobal('fetch', fetcher)
    const url = 'https://unique-v5.example/pay?session=sensitive-session'
    const bindings = { GOOGLE_SAFE_BROWSING_KEY: 'test-sb-key' }
    const r = await routeApi(request('threat', body(url)), bindings)
    expect(await r.json()).toMatchObject({ status: 'flagged', threats: ['SOCIAL_ENGINEERING'] })
    const target = new URL(fetcher.mock.calls[0][0])
    expect(target.pathname).toBe('/v5/urls:search')
    expect(target.searchParams.get('urls')).toBe(url)
    expect(target.searchParams.has('key')).toBe(false)
    await routeApi(request('threat', body(url)), bindings)
    expect(fetcher).toHaveBeenCalledTimes(1)
  })
  it('uses Web Risk in preference to noncommercial Safe Browsing', async () => {
    const fetcher = vi.fn().mockResolvedValue(new Response('{}', { status: 200 }))
    vi.stubGlobal('fetch', fetcher)
    const r = await routeApi(request('threat', body('https://unique-risk.example/pay')), { GOOGLE_WEB_RISK_KEY: 'test-wr-key', GOOGLE_SAFE_BROWSING_KEY: 'test-sb-key' })
    expect(await r.json()).toMatchObject({ status: 'clean', source: { label: 'Google Web Risk' } })
    expect(new URL(fetcher.mock.calls[0][0]).hostname).toBe('webrisk.googleapis.com')
  })
  it('keeps upstream failures out of clean results', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('{}', { status: 403 })))
    const r = await routeApi(request('threat', body('https://unique-error.example/pay')), { GOOGLE_WEB_RISK_KEY: 'invalid-key' })
    expect(r.status).toBe(502)
    expect(await r.json()).toEqual({ status: 'error' })
  })
  it('rejects private hosts and oversized requests', async () => {
    const binding = { GOOGLE_SAFE_BROWSING_KEY: 'test-key' }
    expect((await routeApi(request('threat', body('http://127.0.0.1/pay')), binding)).status).toBe(400)
    expect((await routeApi(request('threat', body('https://example.com/' + 'a'.repeat(6000))), binding)).status).toBe(413)
  })
  it('does not offer payment-page expansion or remote screenshot uploads', async () => {
    expect((await routeApi(request('expand?url=https://bit.ly/test'))).status).toBe(404)
    expect((await routeApi(request('vision', body('https://example.com')))).status).toBe(404)
  })
})
