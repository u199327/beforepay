/** Shared helpers for BeforePay serverless functions (Web-standard Request/Response). */

export const json = (data: unknown, status = 200, extra: Record<string, string> = {}) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store', ...extra },
  })

export type Bindings = Record<string, string | undefined>
export const env = (name: string, bindings?: Bindings): string | undefined => {
  const v = bindings?.[name] ?? (typeof process !== 'undefined' ? process.env[name] : undefined)
  return v && v.trim() ? v.trim() : undefined
}

/** True for IP literals and names that must never be contacted from the server. */
export function isUnsafeHost(host: string): boolean {
  const h = host.toLowerCase().replace(/^\[|\]$/g, '')
  if (!h || h === 'localhost' || h.endsWith('.localhost') || h.endsWith('.local') || h.endsWith('.internal')) return true
  if (/^[\d.]+$/.test(h) || h.includes(':')) return true // any IP literal
  return false
}

/** fetch with a hard timeout and a response-size ceiling. Never follows redirects on its own. */
export async function guardedFetch(
  url: string,
  init: RequestInit & { timeoutMs?: number; maxBytes?: number } = {},
): Promise<{ status: number; headers: Headers; text: string }> {
  const u = new URL(url)
  if (u.protocol !== 'https:') throw new Error('https only')
  if (isUnsafeHost(u.hostname)) throw new Error('unsafe host')
  const ctrl = new AbortController()
  const timer = setTimeout(() => ctrl.abort(), init.timeoutMs ?? 5000)
  try {
    const res = await fetch(u, { ...init, redirect: 'manual', signal: ctrl.signal })
    const max = init.maxBytes ?? 256_000
    let text = ''
    if (res.body && init.method !== 'HEAD') {
      const reader = res.body.getReader()
      const decoder = new TextDecoder()
      let size = 0
      for (;;) {
        const { done, value } = await reader.read()
        if (done) break
        size += value.byteLength
        if (size > max) {
          await reader.cancel()
          throw new Error('response too large')
        }
        text += decoder.decode(value, { stream: true })
      }
    }
    return { status: res.status, headers: res.headers, text }
  } finally {
    clearTimeout(timer)
  }
}

/** Minimal per-instance rate limit; serverless instances are short-lived, this just blunts bursts. */
const hits = new Map<string, number[]>()
export function rateLimited(req: Request, limit = 30, windowMs = 60_000): boolean {
  const key = req.headers.get('cf-connecting-ip') || req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'anon'
  const now = Date.now()
  const list = (hits.get(key) ?? []).filter((t) => now - t < windowMs)
  list.push(now)
  hits.set(key, list)
  if (hits.size > 5000) hits.clear()
  return list.length > limit
}
