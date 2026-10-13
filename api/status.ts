import { env, json } from './_lib/http'

/** Which optional integrations this deployment has credentials for. Never returns the keys. */
export function GET() {
  return json({
    server: true,
    ai: Boolean(env('OPENAI_API_KEY')),
    threat: Boolean(env('GOOGLE_SAFE_BROWSING_KEY')),
    registry: Boolean(env('COMPANIES_HOUSE_API_KEY')),
    rdap: true,
    expand: true,
  })
}
