import { getDomain } from 'tldts'
import { guardedFetch, json, rateLimited } from './_lib/http'

/** Only these well-known public shorteners may be contacted, and only to read one redirect header. */
const ALLOWED = new Set([
  'bit.ly', 'tinyurl.com', 't.co', 'ow.ly', 'is.gd', 'buff.ly', 'cutt.ly', 'rebrand.ly', 'shorturl.at', 'rb.gy',
  'tiny.cc', 't.ly', 'qrco.de', 's.id', 'bl.ink', 'lnkd.in', 'v.gd',
])

export async function GET(req: Request) {
  if (rateLimited(req, 20)) return json({ error: 'rate_limited' }, 429)
  let url: URL
  try {
    url = new URL(new URL(req.url).searchParams.get('url') ?? '')
  } catch {
    return json({ error: 'invalid_url' }, 400)
  }
  const domain = getDomain(url.hostname)
  if (!domain || !ALLOWED.has(domain) || url.username || url.port) return json({ error: 'not_a_known_shortener' }, 400)
  url.protocol = 'https:'
  try {
    let res = await guardedFetch(url.href, { method: 'HEAD', timeoutMs: 4000 })
    if (res.status === 405 || res.status === 403) res = await guardedFetch(url.href, { method: 'GET', timeoutMs: 4000, maxBytes: 64_000 })
    const loc = res.headers.get('location')
    if (res.status < 300 || res.status >= 400 || !loc) return json({ status: 'unresolved' })
    const target = new URL(loc, url)
    if (!/^https?:$/.test(target.protocol)) return json({ status: 'unresolved' })
    return json({ status: 'ok', location: target.href })
  } catch {
    return json({ status: 'unresolved' })
  }
}
