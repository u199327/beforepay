import { env, guardedFetch, json, rateLimited, type Bindings } from './_lib/http'

/**
 * UK Companies House name search. Results are possible matches by NAME ONLY —
 * the client must never present them as the legal identity behind a website.
 */
export async function GET(req: Request, bindings?: Bindings) {
  const key = env('COMPANIES_HOUSE_API_KEY', bindings)
  if (!key) return json({ status: 'not_configured' }, 501)
  if (rateLimited(req, 20)) return json({ error: 'rate_limited' }, 429)
  const q = (new URL(req.url).searchParams.get('q') ?? '').trim().slice(0, 80)
  if (q.length < 3) return json({ error: 'query_too_short' }, 400)
  try {
    const res = await guardedFetch(
      `https://api.company-information.service.gov.uk/search/companies?q=${encodeURIComponent(q)}&items_per_page=3`,
      { headers: { authorization: `Basic ${btoa(`${key}:`)}` }, timeoutMs: 5000 },
    )
    if (res.status !== 200) return json({ status: 'error' }, 502)
    const data = JSON.parse(res.text) as { items?: { title: string; company_number: string; company_status?: string; date_of_creation?: string }[] }
    return json({
      status: 'ok',
      query: q,
      matches: (data.items ?? []).slice(0, 3).map((c) => ({
        name: c.title,
        number: c.company_number,
        status: c.company_status ?? 'unknown',
        created: c.date_of_creation,
        url: `https://find-and-update.company-information.service.gov.uk/company/${encodeURIComponent(c.company_number)}`,
      })),
    })
  } catch {
    return json({ status: 'error' }, 502)
  }
}
