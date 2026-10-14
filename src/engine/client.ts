import { getDomain } from 'tldts'
import { lookupDns } from './dns'
import { analyze } from './analyze'
import { DEMOS, type DemoScenario } from './demos'
import { SHORTENERS } from './reference'
import { summariseRdap } from './rdap'
import type { Externals, InputSource, PaymentContext, RdapInfo, RegistryInfo, Report, ScreenshotFindings, ThreatInfo } from './types'
import { redactUrl } from '../lib/ingest'

export interface Capabilities {
  server: boolean
  ai: boolean
  threat: boolean
  registry: boolean
  expand: boolean
  threatProvider?: string
}

const NO_SERVER: Capabilities = { server: false, ai: false, threat: false, registry: false, expand: false }
let capsPromise: Promise<Capabilities> | null = null
const API_BASE = (import.meta.env.VITE_API_BASE ?? '').replace(/\/$/, '')
const api = (path: string) => `${API_BASE}/api/${path}`

async function getJson<T>(input: string, init?: RequestInit & { timeoutMs?: number }): Promise<{ status: number; data: T | null }> {
  const ctrl = new AbortController()
  const t = setTimeout(() => ctrl.abort(), init?.timeoutMs ?? 6000)
  try {
    const res = await fetch(input, { ...init, signal: ctrl.signal })
    const type = res.headers.get('content-type') ?? ''
    if (!type.includes('json')) return { status: res.status, data: null }
    return { status: res.status, data: (await res.json()) as T }
  } finally {
    clearTimeout(t)
  }
}

/** Which optional services this deployment offers. Static hosting (no /api) → all false. */
export function capabilities(): Promise<Capabilities> {
  if (import.meta.env.VITE_STATIC_HOST === 'true' && !API_BASE) return Promise.resolve(NO_SERVER)
  capsPromise ??= getJson<Capabilities>(api('status'), { timeoutMs: 3000 })
    .then((r) => (r.data && r.data.server ? r.data : NO_SERVER))
    .catch(() => NO_SERVER)
  return capsPromise
}

const offline = () => typeof navigator !== 'undefined' && navigator.onLine === false

async function lookupRdap(domain: string | null, caps: Capabilities): Promise<RdapInfo> {
  if (!domain) return { status: 'unavailable', reason: 'no domain' }
  if (offline()) return { status: 'unavailable', reason: 'offline' }
  const sourceUrl = `https://rdap.org/domain/${encodeURIComponent(domain)}`
  if (caps.server) {
    try {
      const r = await getJson<RdapInfo & { sourceUrl?: string }>(api(`rdap?domain=${encodeURIComponent(domain)}`))
      if (r.data?.status === 'ok') return { ...r.data, source: { label: 'Domain registry (RDAP)', url: sourceUrl } }
      // Registries may reject server/datacentre traffic while allowing browser CORS.
      // An unavailable proxy response must not disable the existing direct lookup.
    } catch {
      /* fall back to a direct lookup */
    }
  }
  // RDAP is a public, read-only registry protocol with open CORS: the browser can ask directly.
  try {
    const r = await getJson<Record<string, unknown>>(sourceUrl, { headers: { accept: 'application/rdap+json' } })
    if (r.status === 200 && r.data) return { ...summariseRdap(r.data), source: { label: 'Domain registry (RDAP)', url: sourceUrl } }
    return { status: 'unavailable', reason: r.status === 404 ? 'not found in registry' : 'registry unavailable' }
  } catch {
    return { status: 'unavailable', reason: 'registry unavailable' }
  }
}

async function lookupThreat(href: string, caps: Capabilities): Promise<ThreatInfo> {
  if (!caps.threat) return { status: 'not_configured' }
  if (offline()) return { status: 'offline' }
  try {
    const r = await getJson<ThreatInfo>(api('threat'), { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ url: href }) })
    if (r.data && (r.data.status === 'clean' || r.data.status === 'flagged')) {
      return { ...r.data, source: r.data.source ?? { label: caps.threatProvider ?? 'Google threat lookup', url: 'https://safebrowsing.google.com/' } }
    }
    return { status: r.status === 501 ? 'not_configured' : 'error' }
  } catch {
    return { status: 'error' }
  }
}

export async function searchRegistry(name: string): Promise<RegistryInfo> {
  const caps = await capabilities()
  if (!caps.registry) return { status: 'not_configured' }
  try {
    const r = await getJson<RegistryInfo>(api(`registry?q=${encodeURIComponent(name)}`))
    return r.data?.status === 'ok' ? r.data : { status: 'error' }
  } catch {
    return { status: 'error' }
  }
}

async function expand(url: URL, caps: Capabilities): Promise<URL | null> {
  if (!caps.expand || offline()) return null
  try {
    const r = await getJson<{ status: string; location?: string }>(api(`expand?url=${encodeURIComponent(url.href)}`))
    return r.data?.status === 'ok' && r.data.location ? new URL(r.data.location) : null
  } catch {
    return null
  }
}

export interface CheckOptions {
  source: InputSource
  expected?: string
  context?: PaymentContext
  screenshot?: ScreenshotFindings
}

/** A live check of a real URL. The URL itself is never opened. */
export async function runCheck(url: URL, opts: CheckOptions): Promise<Report> {
  const caps = await capabilities()
  let target = url
  let expandedFrom: string | undefined
  for (let hop = 0; hop < 3; hop++) {
    const domain = getDomain(target.hostname)
    if (!domain || !SHORTENERS.includes(domain)) break
    const next = await expand(target, caps)
    if (!next) break
    expandedFrom ??= redactUrl(url).href
    target = next
  }
  const domain = getDomain(target.hostname)
  const tenant = getDomain(target.hostname, { allowPrivateDomains: true })
  const [rdap, threat, dns] = await Promise.all([
    tenant !== domain ? Promise.resolve({ status: 'unavailable' as const, reason: 'shared platform: the registry age belongs to the platform, not this merchant' }) : lookupRdap(domain, caps),
    lookupThreat(target.href, caps), lookupDns(target.hostname),
  ])
  const externals: Externals = { rdap, threat, dns, expandedFrom }
  return analyze(target, externals, opts)
}

export function runDemo(demo: DemoScenario, expectedOverride?: string, context?: PaymentContext): Report {
  return analyze(new URL(demo.url), demo.externals(new Date()), {
    source: 'demo',
    expected: expectedOverride ?? demo.expected,
    context,
    screenshot: demo.screenshot,
    extraBrands: demo.extraBrands,
    simulation: demo.simulation,
  })
}

export function findDemo(id: string | null): DemoScenario | undefined {
  return DEMOS.find((d) => d.id === id)
}

export interface VisionResult {
  status: 'ok' | 'not_configured' | 'error'
  findings?: ScreenshotFindings
  reason?: string
}

export async function readScreenshot(dataUrl: string): Promise<VisionResult> {
  try {
    const r = await getJson<{ status: string; findings?: ScreenshotFindings; reason?: string; error?: string }>(api('vision'), {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ image: dataUrl }),
      timeoutMs: 30_000,
    })
    if (r.status === 501) return { status: 'not_configured' }
    if (r.data?.status === 'ok' && r.data.findings) {
      const f = r.data.findings
      return { status: 'ok', findings: { ...f, suspicious: f.suspicious ?? [], offPlatformRequest: Boolean(f.offPlatformRequest) } }
    }
    return { status: 'error', reason: r.data?.reason ?? r.data?.error ?? 'The image could not be read.' }
  } catch {
    return { status: 'error', reason: 'The AI service did not respond.' }
  }
}
