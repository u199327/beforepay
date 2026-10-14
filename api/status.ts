import { env, json, type Bindings } from './_lib/http'

/** Which optional integrations this deployment has credentials for. Never returns the keys. */
export function GET(_req?: Request, bindings?: Bindings) {
  return json({
    server: true,
    ai: false,
    threat: Boolean(env('GOOGLE_WEB_RISK_KEY', bindings) || env('GOOGLE_SAFE_BROWSING_KEY', bindings)),
    threatProvider: env('GOOGLE_WEB_RISK_KEY', bindings) ? 'Google Web Risk' : 'Google Safe Browsing v5',
    registry: Boolean(env('COMPANIES_HOUSE_API_KEY', bindings)),
    rdap: true,
    expand: false,
  })
}
