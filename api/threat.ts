import { env, guardedFetch, isUnsafeHost, json, rateLimited, type Bindings } from './_lib/http'

type Result = { status: 'clean' | 'flagged'; threats: string[]; source: { label: string; url: string }; checkedAt: string }
// Cache only hashed lookup identifiers and bounded results. Never log submitted URLs.
const cache = new Map<string, { result: Result; expires: number }>()

/** Safe Browsing v5 for noncommercial deployments, or Web Risk Lookup for commercial use. */
export async function POST(req: Request, bindings?: Bindings) {
  const webRisk = env('GOOGLE_WEB_RISK_KEY', bindings)
  const key = webRisk || env('GOOGLE_SAFE_BROWSING_KEY', bindings)
  if (!key) return json({ status: 'not_configured' }, 501)
  if (rateLimited(req, 20)) return json({ error: 'rate_limited' }, 429)
  let url: URL
  try {
    if (Number(req.headers.get('content-length')) > 5000) return json({ error: 'body_too_large' }, 413)
    const reader = req.body?.getReader()
    if (!reader) throw new Error()
    let raw = ''
    let size = 0
    const decoder = new TextDecoder()
    for (;;) {
      const { done, value } = await reader.read()
      if (done) break
      size += value.byteLength
      if (size > 5000) { await reader.cancel(); return json({ error: 'body_too_large' }, 413) }
      raw += decoder.decode(value, { stream: true })
    }
    raw += decoder.decode()
    const body = JSON.parse(raw) as { url?: string }
    url = new URL(String(body.url ?? ''))
    if (!/^https?:$/.test(url.protocol) || url.href.length > 2048 || isUnsafeHost(url.hostname)) throw new Error()
    url.username = ''; url.password = ''; url.hash = ''
  } catch { return json({ error: 'invalid_url' }, 400) }
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(`${webRisk ? 'web-risk' : 'safe-browsing'}:${url.href}`))
  const id = Array.from(new Uint8Array(digest), n => n.toString(16).padStart(2, '0')).join('')
  const cached = cache.get(id)
  if (cached && cached.expires > Date.now()) return json(cached.result)
  try {
    const endpoint = new URL(webRisk ? 'https://webrisk.googleapis.com/v1/uris:search' : 'https://safebrowsing.googleapis.com/v5/urls:search')
    endpoint.searchParams.set(webRisk ? 'uri' : 'urls', url.href)
    if (webRisk) for (const type of ['MALWARE', 'SOCIAL_ENGINEERING', 'UNWANTED_SOFTWARE']) endpoint.searchParams.append('threatTypes', type)
    const res = await guardedFetch(endpoint.href, { headers: { 'X-Goog-Api-Key': key }, timeoutMs: 5000 })
    if (res.status !== 200) return json({ status: 'error' }, 502)
    const data = JSON.parse(res.text || '{}') as { threats?: { threatTypes?: string[] }[]; threat?: { threatTypes?: string[]; expireTime?: string }; cacheDuration?: string; error?: unknown }
    if (data.error || (data.threats !== undefined && !Array.isArray(data.threats))) throw new Error('invalid upstream result')
    const threats = [...new Set(webRisk ? data.threat?.threatTypes ?? [] : (data.threats ?? []).flatMap(t => t.threatTypes ?? []))]
    const result: Result = { status: threats.length ? 'flagged' : 'clean', threats, checkedAt: new Date().toISOString(), source: webRisk ? { label: 'Google Web Risk', url: 'https://cloud.google.com/web-risk' } : { label: 'Google Safe Browsing v5', url: 'https://developers.google.com/safe-browsing/reference' } }
    const expires = webRisk ? (data.threat?.expireTime ? Date.parse(data.threat.expireTime) : Date.now() + 300_000) : Date.now() + Math.min(86400, Math.max(0, parseFloat(data.cacheDuration ?? '0'))) * 1000
    for (const [hash, item] of cache) if (item.expires <= Date.now()) cache.delete(hash)
    if (cache.size >= 500) cache.delete(cache.keys().next().value!)
    if (expires > Date.now()) cache.set(id, { result, expires })
    return json(result)
  } catch { return json({ status: 'error' }, 502) }
}
