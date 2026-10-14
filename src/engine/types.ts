export type Verdict = 'clear' | 'unverified' | 'warning'

/** Outcome of a single evidence check. */
export type Status = 'pass' | 'caution' | 'fail' | 'not_checked' | 'info'

/** How well an assertion on the Merchant Identity Card is supported. */
export type Assurance = 'verified' | 'inferred' | 'not_verified'

export type InputSource = 'paste' | 'link' | 'share' | 'qr' | 'screenshot' | 'demo'

export interface Source {
  label: string
  url?: string
}

export interface Field {
  key: string
  label: string
  value: string | null
  assurance: Assurance
  note?: string
  source?: Source
  mono?: boolean
}

export interface ChainNode {
  role: 'website' | 'merchant' | 'processor' | 'recipient'
  label: string
  value: string | null
  assurance: Assurance
  note: string
}

export interface EvidenceRow {
  id: 'domain' | 'reputation' | 'impersonation' | 'expected' | 'content'
  title: string
  status: Status
  summary: string
  details: string[]
  sources: Source[]
  simulated?: boolean
  aiAssisted?: boolean
}

export type Severity = 'warning' | 'caution' | 'positive' | 'info'

export interface Signal {
  id: string
  severity: Severity
  text: string
}

export interface ParsedUrl {
  href: string // redacted
  protocol: 'http:' | 'https:'
  hostname: string // ASCII / punycode form
  displayHost: string // unicode form when IDN
  port: string
  registrableDomain: string | null
  publicSuffix: string | null
  subdomain: string | null
  domainWithoutSuffix: string | null
  isIp: boolean
  isPrivateSuffix: boolean
  path: string // redacted path + redacted query
  hasCredentials: boolean
  credentialText: string | null
  redactions: number
}

export interface RdapInfo {
  status: 'ok' | 'unavailable'
  registered?: string // ISO date
  expires?: string
  registrar?: string
  registrantHidden?: boolean
  source?: Source
  reason?: string
}

export interface ThreatInfo {
  status: 'clean' | 'flagged' | 'not_configured' | 'error' | 'offline'
  threats?: string[]
  source?: Source
}

export interface RegistryMatch {
  name: string
  number: string
  status: string
  created?: string
  url: string
}

export interface RegistryInfo {
  status: 'ok' | 'not_configured' | 'error' | 'skipped'
  query?: string
  matches?: RegistryMatch[]
}

/** Facts read from an image (by AI, or authored for a simulation). */
export interface ScreenshotFindings {
  visibleMerchant: string | null
  amount: string | null
  paymentUrl: string | null
  provider: string | null
  suspicious: string[]
  offPlatformRequest: boolean
  summary: string | null
  simulated?: boolean
  readingMethod?: 'local_ocr' | 'ai'
}

export interface PaymentContext {
  channel?: 'website' | 'message' | 'email' | 'marketplace' | 'qr'
  method?: 'card' | 'personal' | 'bank' | 'crypto'
  amount?: string
  message?: string
}

export interface Externals {
  rdap: RdapInfo
  threat: ThreatInfo
  registry?: RegistryInfo
  expandedFrom?: string // original shortened link (redacted)
  dns?: DnsInfo
  simulated?: boolean
}

export interface Brand {
  name: string
  tokens: string[]
  official: string[] // registrable domains
  distinctive: boolean
  fictional?: boolean
}

export interface ProcessorMatch {
  name: string
  kind: 'hosted' | 'p2p' | 'platform' | 'crypto'
  handle?: string
  note: string
}

export interface Simulation {
  id: string
  title: string
  premise: string
  note: string
}

export interface DnsInfo {
  status: 'resolved' | 'not_found' | 'unavailable' | 'skipped'
  addresses?: string[]
  reason?: string
  checkedAt?: string
  source?: Source
}

export interface Criterion {
  id: string
  title: string
  status: Status
  summary: string
  detail: string
  basis: 'Address rule' | 'Reference list' | 'Live lookup' | 'Optional service' | 'User input' | 'Simulation'
  source?: Source
}

export interface Report {
  id: string
  source: InputSource
  url: ParsedUrl
  verdict: Verdict
  headline: string
  explanation: string
  nextStep: { title: string; body: string }
  fields: Field[]
  chain: ChainNode[]
  evidence: EvidenceRow[]
  signals: Signal[]
  criteria: Criterion[]
  dns?: DnsInfo
  engineVersion: string
  notChecked: string[]
  checkedAt: string
  expected?: string
  context?: PaymentContext
  screenshot?: ScreenshotFindings
  registry?: RegistryInfo
  simulation?: Simulation
  expandedFrom?: string
}
