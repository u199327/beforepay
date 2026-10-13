import { env, guardedFetch, json, rateLimited } from './_lib/http'

/**
 * Google Safe Browsing v4 lookup. Sends only the URL to Google; never fetches it.
 * Returns 501 when no key is configured so the client can say "Not checked".
 */
export async function POST(req: Request) {
  const key = env('GOOGLE_SAFE_BROWSING_KEY')
  if (!key) return json({ status: 'not_configured' }, 501)
  if (rateLimited(req, 30)) return json({ error: 'rate_limited' }, 429)
  let url: URL
  try {
    const body = (await req.json()) as { url?: string }
    url = new URL(String(body.url ?? ''))
    if (!/^https?:$/.test(url.protocol) || url.href.length > 2048) throw new Error()
  } catch {
    return json({ error: 'invalid_url' }, 400)
  }
  try {
    const res = await guardedFetch(`https://safebrowsing.googleapis.com/v4/threatMatches:find?key=${encodeURIComponent(key)}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      timeoutMs: 5000,
      body: JSON.stringify({
        client: { clientId: 'beforepay', clientVersion: '1.0.0' },
        threatInfo: {
          threatTypes: ['MALWARE', 'SOCIAL_ENGINEERING', 'UNWANTED_SOFTWARE', 'POTENTIALLY_HARMFUL_APPLICATION'],
          platformTypes: ['ANY_PLATFORM'],
          threatEntryTypes: ['URL'],
          threatEntries: [{ url: url.href }],
        },
      }),
    })
    if (res.status !== 200) return json({ status: 'error' }, 502)
    const data = JSON.parse(res.text || '{}') as { matches?: { threatType: string }[] }
    const threats = [...new Set((data.matches ?? []).map((m) => m.threatType))]
    return json({ status: threats.length ? 'flagged' : 'clean', threats })
  } catch {
    return json({ status: 'error' }, 502)
  }
}
