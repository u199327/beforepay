import { getDomain } from 'tldts'
import { guardedFetch, isUnsafeHost, json, rateLimited } from './_lib/http'
import { summariseRdap } from '../src/engine/rdap'

/**
 * Domain registration facts via RDAP (the registries' official replacement for WHOIS).
 * Only a validated registrable domain is accepted; the user's URL is never fetched.
 */
export async function GET(req: Request) {
  if (rateLimited(req, 40)) return json({ error: 'rate_limited' }, 429)
  const domain = (new URL(req.url).searchParams.get('domain') ?? '').toLowerCase().trim()
  if (!domain || domain.length > 253 || getDomain(domain) !== domain || isUnsafeHost(domain)) {
    return json({ error: 'invalid_domain' }, 400)
  }
  let target = `https://rdap.org/domain/${encodeURIComponent(domain)}`
  try {
    for (let hop = 0; hop < 3; hop++) {
      const res = await guardedFetch(target, { headers: { accept: 'application/rdap+json' }, timeoutMs: 5000 })
      if (res.status >= 300 && res.status < 400) {
        const loc = res.headers.get('location')
        if (!loc) break
        target = new URL(loc, target).toString() // guardedFetch re-validates https + host
        continue
      }
      if (res.status === 404) return json({ status: 'unavailable', reason: 'not found in registry' })
      if (res.status !== 200) return json({ status: 'unavailable', reason: `registry returned ${res.status}` })
      return json({ ...summariseRdap(JSON.parse(res.text)), sourceUrl: target })
    }
    return json({ status: 'unavailable', reason: 'too many redirects' })
  } catch (e) {
    return json({ status: 'unavailable', reason: (e as Error).name === 'AbortError' ? 'timed out' : 'lookup failed' })
  }
}

