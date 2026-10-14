import { parse as parseDomain } from 'tldts'
import { toUnicode } from 'punycode'
import { buildCriteria, ENGINE_VERSION } from './criteria'
import { contextChecks } from './context'
import { redactUrl, redactUsername } from '../lib/ingest'
import {
  BRANDS,
  COMMERCE_PLATFORMS,
  CONTEXT_WORDS,
  SHORTENERS,
  SUSPICIOUS_HOST_WORDS,
  countryForSuffix,
  editDistance,
  foldConfusables,
  foldTyposquat,
  matchProcessor,
} from './reference'
import type {
  Brand,
  ChainNode,
  EvidenceRow,
  Externals,
  Field,
  InputSource,
  ParsedUrl,
  PaymentContext,
  ProcessorMatch,
  Report,
  ScreenshotFindings,
  Signal,
  Simulation,
  Source,
  Status,
  Verdict,
} from './types'

/* ------------------------------------------------------------------ */
/* Parsing                                                             */
/* ------------------------------------------------------------------ */

export function parseTarget(url: URL): ParsedUrl {
  const hostname = url.hostname.toLowerCase().replace(/\.$/, '')
  const info = parseDomain(hostname, { allowPrivateDomains: true })
  let displayHost = hostname
  if (hostname.includes('xn--')) {
    try {
      displayHost = toUnicode(hostname)
    } catch {
      /* keep ASCII */
    }
  }
  const redacted = redactUrl(url)
  return {
    href: redacted.href,
    protocol: url.protocol as 'http:' | 'https:',
    hostname,
    displayHost,
    port: url.port,
    registrableDomain: info.isIp ? null : info.domain,
    publicSuffix: info.isIp ? null : info.publicSuffix,
    subdomain: info.isIp ? null : info.subdomain || null,
    domainWithoutSuffix: info.isIp ? null : info.domainWithoutSuffix,
    isIp: Boolean(info.isIp) || hostname.startsWith('['),
    isPrivateSuffix: Boolean(info.isPrivate),
    path: redacted.path || '/',
    hasCredentials: Boolean(url.username || url.password),
    credentialText: url.username ? decodeSafe(redactUsername(url.username)).slice(0, 80) : url.password ? '•••' : null,
    redactions: redacted.count,
  }
}

function decodeSafe(s: string): string {
  try {
    return decodeURIComponent(s)
  } catch {
    return s
  }
}

export function isPrivateAddress(host: string): boolean {
  const h = host.replace(/^\[|\]$/g, '')
  if (h === 'localhost' || h.endsWith('.localhost') || h.endsWith('.local') || h.endsWith('.internal')) return true
  const v4 = h.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/)
  if (v4) {
    const [a, b] = [Number(v4[1]), Number(v4[2])]
    return (
      a === 10 || a === 127 || a === 0 || (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31) ||
      (a === 192 && b === 168) || (a === 100 && b >= 64 && b <= 127)
    )
  }
  if (h.includes(':')) return h === '::1' || /^f[cd]/i.test(h) || /^fe[89ab]/i.test(h) || h === '::'
  return false
}

/* ------------------------------------------------------------------ */
/* Brand identity and impersonation                                    */
/* ------------------------------------------------------------------ */

export interface Impersonation {
  brand: Brand
  how: 'subdomain-trick' | 'homoglyph' | 'name' | 'lookalike' | 'tld-swap'
  detail: string
  strength?: 'strong' | 'similarity'
}

export interface BrandResult {
  official: Brand | null
  impersonation: Impersonation | null
  checked: number
}

function isOfficialFor(brand: Brand, host: string): boolean {
  if (host.endsWith('.myshopify.com')) return false
  return brand.official.some((d) => host === d || host.endsWith(`.${d}`))
}

function labelHits(brand: Brand, labels: string[], folded: boolean): string | null {
  for (const label of labels) {
    const words = label.split('-').filter(Boolean)
    const joined = words.join('')
    for (const token of brand.tokens) {
      if (words.includes(token) && (brand.distinctive || words.some((w) => CONTEXT_WORDS.includes(w)))) return label
      if (brand.distinctive && joined.includes(token)) return label
      if (joined !== token && joined.startsWith(token)) {
        const rest = joined.slice(token.length)
        if (CONTEXT_WORDS.includes(rest) || /^\d+$/.test(rest)) return label
      }
      if (joined !== token && joined.endsWith(token)) {
        const rest = joined.slice(0, -token.length)
        if (CONTEXT_WORDS.includes(rest)) return label
      }
      // Lookalike spelling only counts against distinctive names (paypa1, rnonzo).
      if (folded && brand.distinctive && token.length >= 5 && joined.length >= token.length) {
        for (const w of words) if (w.length >= 5 && editDistance(w, token) === 1 && w !== token) return label
      }
    }
  }
  return null
}

export function checkBrands(parsed: ParsedUrl, extraBrands: Brand[] = []): BrandResult {
  const brands = [...extraBrands, ...BRANDS]
  const host = parsed.hostname
  const official = brands.find((b) => isOfficialFor(b, host)) ?? null
  if (official || parsed.isIp || parsed.publicSuffix === 'myshopify.com') return { official, impersonation: null, checked: brands.length }

  const asciiLabels = host.split('.')
  const unicodeLabels = parsed.displayHost.split('.')
  const foldedLabels = unicodeLabels.map((l) => foldTyposquat(l))
  const hasIdn = host.includes('xn--')
  const sub = parsed.subdomain ? `.${parsed.subdomain}.` : ''
  const sld = parsed.domainWithoutSuffix?.split('.').pop() ?? ''
  const sldUnicode = sld.includes('xn--') ? safeUnicode(sld) : sld
  const sldFolded = foldTyposquat(sldUnicode)

  for (const brand of brands) {
    // 1. "paypal.com.secure-checkout.io": the real brand domain used as a subdomain prefix.
    const trick = brand.official.find((d) => sub.includes(`.${d}.`))
    if (trick) {
      return {
        official: null,
        checked: brands.length,
        impersonation: {
          brand,
          how: 'subdomain-trick',
          detail: `The address starts with "${trick}", but the site actually belongs to ${parsed.registrableDomain}.`,
        },
      }
    }
  }
  for (const brand of brands) {
    // 2. International characters that imitate a brand (pаypal with a Cyrillic "а").
    if (hasIdn && unicodeLabels.some((l, i) => foldConfusables(l) !== l && foldConfusables(l) !== asciiLabels[i])) {
      const hit = labelHits(brand, unicodeLabels.filter(l => foldConfusables(l) !== l).map(l => foldConfusables(l)), false)
      if (hit) {
        return {
          official: null,
          checked: brands.length,
          impersonation: {
            brand,
            how: 'homoglyph',
            detail: `"${parsed.displayHost}" uses look-alike international characters to resemble ${brand.name}.`,
          },
        }
      }
    }
  }
  for (const brand of brands) {
    // 3a. Exactly the brand's name on another ending ("paypal.co").
    const swap = brand.official.find((d) => d.split('.')[0] === sld && d.split('.')[0].length >= 4)
    if (swap && brand.tokens.includes(sld)) {
      return {
        official: null,
        checked: brands.length,
        impersonation: {
          brand,
          how: 'tld-swap',
          detail: `Same name as ${brand.name}, but on a different ending (${parsed.registrableDomain}) that ${brand.name} doesn't use.`,
        },
      }
    }
  }
  for (const brand of brands) {
    // 3b. Brand name inside someone else's domain ("royalmail-fees.com").
    const hit = labelHits(brand, asciiLabels, false)
    if (hit) {
      return {
        official: null,
        checked: brands.length,
        impersonation: {
          brand,
          how: 'name',
          strength: asciiLabels.some((l) => l.split('-').some((w) => CONTEXT_WORDS.includes(w))) || CONTEXT_WORDS.some((w) => brand.tokens.some(token => hit.replaceAll(token, '').replaceAll('-', '').startsWith(w))) ? 'strong' : 'similarity',
          detail: `Uses the name "${brand.name}" in "${hit}", but ${parsed.registrableDomain ?? parsed.hostname} is not on our ${brand.name} reference list.`,
        },
      }
    }
  }
  for (const brand of brands) {
    // 4. Same name on another ending, or a near-miss spelling ("paypa1.com", "paypal.co").
    for (const d of brand.official) {
      const officialSld = d.split('.')[0]
      if (officialSld.length < 4) continue
      if (sldFolded === officialSld) {
        return {
          official: null,
          checked: brands.length,
          impersonation: {
            brand,
            how: sld === officialSld ? 'tld-swap' : 'lookalike',
            detail:
              sld === officialSld
                ? `Same name as ${brand.name}, but on a different ending (${parsed.registrableDomain}) that ${brand.name} doesn't use.`
                : `"${parsed.registrableDomain}" is spelled to look like ${d}.`,
          },
        }
      }
      const limit = officialSld.length >= 9 ? 2 : officialSld.length >= 5 ? 1 : 0
      if (limit && Math.abs(sldFolded.length - officialSld.length) <= limit && editDistance(sldFolded, officialSld) <= limit) {
        return {
          official: null,
          checked: brands.length,
          impersonation: { brand, how: 'lookalike', strength: 'similarity', detail: `"${parsed.registrableDomain}" is one or two letters away from ${d}. Similar spelling alone does not prove impersonation.` },
        }
      }
    }
    const folded = labelHits(brand, foldedLabels, true)
    if (folded) {
      return {
        official: null,
        checked: brands.length,
        impersonation: { brand, how: 'lookalike', detail: `"${folded}" is spelled to look like ${brand.name}.` },
      }
    }
  }
  return { official: null, impersonation: null, checked: brands.length }
}

function safeUnicode(s: string): string {
  try {
    return toUnicode(s)
  } catch {
    return s
  }
}

/* ------------------------------------------------------------------ */
/* Expected merchant                                                   */
/* ------------------------------------------------------------------ */

const GENERIC_WORDS = new Set([
  'the', 'and', 'ltd', 'limited', 'plc', 'inc', 'llc', 'llp', 'gmbh', 'company', 'group', 'shop', 'store', 'stores',
  'online', 'official', 'parking', 'park', 'pay', 'payment', 'payments', 'services', 'service', 'market', 'marketplace',
  'uk', 'london', 'cafe', 'coffee', 'bank', 'mail', 'post', 'delivery', 'council', 'city', 'app', 'www', 'com',
])

export function distinctiveWords(name: string): string[] {
  return foldConfusables(name)
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .split(/\s+/)
    .filter((w) => w.length >= 3 && !GENERIC_WORDS.has(w))
}

function hostMentions(host: string, word: string): boolean {
  return host.split(/[.-]/).some((label) => label === word || label.replace(/-/g, '') === word)
}

function findBrandByName(name: string, brands: Brand[]): Brand | null {
  const n = foldConfusables(name).replace(/[^a-z0-9]+/g, '')
  return (
    brands.find((b) => b.name.toLowerCase().replace(/[^a-z0-9]+/g, '') === n) ??
    brands.find((b) => b.tokens.some((t) => n === t)) ??
    null
  )
}

/* ------------------------------------------------------------------ */
/* Main analysis                                                       */
/* ------------------------------------------------------------------ */

export interface AnalyzeOptions {
  source: InputSource
  expected?: string
  context?: PaymentContext
  screenshot?: ScreenshotFindings
  extraBrands?: Brand[]
  simulation?: Simulation
  now?: Date
}

const DAY = 86_400_000

function daysBetween(fromIso: string, now: Date): number {
  return Math.floor((now.getTime() - new Date(fromIso).getTime()) / DAY)
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' })
}

function ageInWords(days: number): string {
  if (days < 1) return 'today'
  if (days < 2) return 'yesterday'
  if (days < 60) return `${days} days ago`
  const months = Math.round(days / 30.4)
  if (months < 24) return `${months} months ago`
  return `${Math.floor(days / 365.25)} years ago`
}

export function analyze(url: URL, externals: Externals, opts: AnalyzeOptions): Report {
  const now = opts.now ?? new Date()
  const p = parseTarget(url)
  const brands = [...(opts.extraBrands ?? []), ...BRANDS]
  const brand = checkBrands(p, opts.extraBrands)
  const processor = p.isIp ? null : matchProcessor(p.hostname, p.registrableDomain, url.pathname)
  const site = p.registrableDomain ?? p.hostname
  const shot = opts.screenshot
  const signals: Signal[] = []
  const add = (id: string, severity: Signal['severity'], text: string) => signals.push({ id, severity, text })

  /* ---- Layer A: the address itself ---- */
  if (p.protocol === 'http:') add('http', 'caution', 'The page is not encrypted (http, not https). Never enter card details on it.')
  else add('https', 'info', 'Encrypted connection (https). This protects data in transit but says nothing about who runs the site.')

  if (p.hasCredentials) {
    add('credentials', 'warning', `The link hides its real destination: browsers ignore "${p.credentialText}@" and go to ${p.hostname}.`)
  }
  if (!p.isIp && isPrivateAddress(p.hostname)) add('private-host', 'warning', 'This is a local or internal network name, not a public payment destination.')
  if (/\.(example|invalid|test|localhost)$/.test(p.hostname) || /^(example\.(com|net|org))$/.test(p.hostname)) add('reserved-domain', 'caution', 'This is a reserved example or test address, not a real public merchant.')
  if (p.isIp) {
    if (isPrivateAddress(p.hostname)) add('private-ip', 'warning', 'The link points to a private network address, not a public business website.')
    else add('ip', 'warning', 'The link goes to a bare server number instead of a named website. Real checkouts don\'t do this.')
  }
  if (p.port && p.port !== '443' && p.port !== '80') add('port', 'caution', `The link uses an unusual port (:${p.port}), which public checkouts almost never need.`)

  const shortener = p.registrableDomain && SHORTENERS.includes(p.registrableDomain)
  if (shortener) add('shortener', 'caution', `${p.registrableDomain} is a link shortener — it hides where the payment really goes.`)

  const commerce = p.publicSuffix ? COMMERCE_PLATFORMS[p.publicSuffix] : undefined
  if (p.isPrivateSuffix && !commerce && !processor) {
    add('shared-hosting', 'caution', `Hosted on ${p.publicSuffix}, a shared platform where anyone can publish a site in minutes.`)
  }
  if (p.hostname.includes('xn--') && !brand.impersonation) {
    add('idn', 'caution', `The address uses international characters (${p.displayHost}). Check every letter carefully.`)
  }

  if (brand.official) {
    add('official', 'positive', `${site} is an official ${brand.official.name} domain (BeforePay reference list).`)
  }
  if (brand.impersonation) add(brand.impersonation.strength === 'similarity' ? 'brand-similarity' : 'impersonation', brand.impersonation.strength === 'similarity' ? 'caution' : 'warning', brand.impersonation.detail)

  if (processor) {
    if (processor.kind === 'crypto') add('crypto', 'caution', processor.note)
    else if (processor.kind === 'platform') add('platform', 'caution', 'This is a shared commerce platform. The independent shop and recipient are not verified.')
    else if (processor.kind === 'p2p') add('p2p', 'caution', processor.note)
    else add('processor', 'positive', `This is ${processor.name}'s official payment domain.`)
  }

  const hostWords = p.hostname.split(/[.-]/)
  const pressureWords = hostWords.filter((w) => SUSPICIOUS_HOST_WORDS.includes(w))
  if (pressureWords.length && !brand.official && !processor) {
    add('host-words', 'info', `The address uses words often seen in scam links ("${pressureWords.join('", "')}"). On their own these prove nothing.`)
  }

  /* ---- Domain registration (RDAP) ---- */
  const rawRdap = externals.rdap
  const registeredTime = Date.parse(rawRdap.registered ?? '')
  const rdap = rawRdap.status === 'ok' && (!Number.isFinite(registeredTime) || registeredTime > now.getTime())
    ? { status: 'unavailable' as const, reason: 'registry returned an invalid registration date' } : rawRdap
  let ageDays: number | null = null
  if (rdap.status === 'ok' && rdap.registered) {
    ageDays = daysBetween(rdap.registered, now)
    if (ageDays < 30) add('new-domain', 'caution', `${site} was registered ${ageInWords(ageDays)}. Brand-new sites are a common sign of payment scams.`)
    else if (ageDays < 180) add('young-domain', 'caution', `${site} was registered ${ageInWords(ageDays)} — a fairly new website.`)
    else if (ageDays >= 365) add('established', 'positive', `${site} has been registered since ${new Date(rdap.registered).getUTCFullYear()}.`)
  }

  if (externals.dns?.status === 'not_found') add('dns-missing', 'caution', 'The hostname did not resolve in public DNS at the time of this check. It may be inactive or mistyped; this alone does not prove fraud.')
  if (externals.dns?.addresses?.some((a) => isPrivateAddress(a))) add('private-dns', 'warning', 'Public DNS points this hostname to a private network address. It is not a normal public payment destination.')

  /* ---- Threat intelligence ---- */
  const threat = externals.threat
  if (threat.status === 'flagged') {
    add('threat', 'warning', `${threat.source?.label ?? 'A threat database'} lists this link as dangerous (${(threat.threats ?? []).join(', ').toLowerCase().replaceAll('_', ' ')}).`)
  } else if (threat.status === 'clean') {
    add('threat-clean', 'positive', `Not on ${threat.source?.label ?? 'the threat list'} we checked.`)
  }

  /* ---- Screenshot / page content ---- */
  if (shot?.offPlatformRequest) {
    add('off-platform', 'warning', 'The message asks you to pay outside the platform you were using — where buyer protection no longer applies.')
  } else if (shot && shot.suspicious.length) {
    add('wording', 'caution', `The ${shot.simulated ? 'scenario' : 'screenshot'} contains pressure or unusual payment wording.`)
  }

  /* ---- Expected merchant ---- */
  const expected = opts.expected?.trim() || undefined
  let expectedRow: EvidenceRow
  if (!expected) {
    expectedRow = {
      id: 'expected',
      title: 'Match with who you expected to pay',
      status: 'not_checked',
      summary: 'Tell us who you were expecting to pay and we will compare it with this destination.',
      details: [],
      sources: [],
    }
  } else {
    const expectedBrand = findBrandByName(expected, brands)
    const words = distinctiveWords(expected)
    const mentioned = words.filter((w) => hostMentions(p.hostname, w))
    const shotMatches = shot?.visibleMerchant
      ? distinctiveWords(shot.visibleMerchant).some((w) => words.includes(w))
      : false
    if (expectedBrand) {
      if (isOfficialFor(expectedBrand, p.hostname)) {
        expectedRow = row('expected', 'Match with who you expected to pay', 'pass', `This is an official ${expectedBrand.name} address, consistent with who you expected.`, [`${p.hostname} is listed for ${expectedBrand.name}: ${expectedBrand.official.join(', ')}`])
      } else if (processor && processor.kind === 'hosted' && expectedBrand.name === processor.name) {
        expectedRow = row('expected', 'Match with who you expected to pay', 'pass', `This is ${processor.name}'s own checkout.`, [])
      } else if (processor && (processor.kind === 'hosted' || processor.kind === 'platform')) {
        add('expected-unlinked', 'caution', `The address identifies ${processor.name}, but cannot establish whether the merchant is ${expectedBrand.name}.`)
        expectedRow = row('expected', 'Match with who you expected to pay', 'caution', `A ${processor.name} payment page can serve many businesses. We cannot link this account to ${expectedBrand.name} from the URL.`, [`Provider: ${processor.name}`, `Expected merchant: ${expectedBrand.name}`, 'Ask the merchant through a channel you already trust.'])
      } else {
        add('expected-mismatch', 'warning', `You expected to pay ${expectedBrand.name}, but this link goes to ${site}, which is not a ${expectedBrand.name} address.`)
        expectedRow = row('expected', 'Match with who you expected to pay', 'fail', `You expected ${expectedBrand.name}. This link goes to ${site}, which ${expectedBrand.name} doesn't use.`, [`${expectedBrand.name}'s domains on our reference list: ${expectedBrand.official.join(', ')}`, `Destination: ${p.hostname}`])
      }
    } else if (mentioned.length) {
      expectedRow = row('expected', 'Match with who you expected to pay', 'info', `The address mentions "${mentioned[0]}", which fits ${expected}. Anyone can register a name, so this is consistent — not proof.`, [`Matched word: ${mentioned.join(', ')}`, `Destination: ${p.hostname}`])
      add('expected-name-only', 'caution', 'A matching word in the address does not verify the merchant.')
    } else if (processor && processor.kind === 'hosted') {
      expectedRow = row(
        'expected',
        'Match with who you expected to pay',
        shotMatches ? 'info' : 'caution',
        shotMatches
          ? `The payment runs through ${processor.name}, and the page shows "${shot?.visibleMerchant}", which fits ${expected}.`
          : `The payment runs through ${processor.name}, so ${expected}'s name won't appear in the address. Check the business name shown on the payment page.`,
        [`Processor domain: ${p.hostname}`],
      )
    } else {
      add('expected-unlinked', 'caution', `Nothing links ${site} to ${expected}.`)
      expectedRow = row('expected', 'Match with who you expected to pay', 'caution', `Nothing in ${site} links it to ${expected}. Some businesses use third-party payment sites, but this one isn't one we can tie to them.`, [`Searched the address for: ${words.join(', ') || expected}`, `Destination: ${p.hostname}`])
    }
  }

  /* ---- Verdict ---- */
  const contextEvidence = contextChecks(opts.context)
  signals.push(...contextEvidence.signals)
  const warnings = signals.filter((s) => s.severity === 'warning')
  const cautions = signals.filter((s) => s.severity === 'caution')
  const corroborated =
    Boolean(brand.official) ||
    Boolean(processor && processor.kind === 'hosted')
  const verdict: Verdict = warnings.length ? 'warning' : corroborated && cautions.length === 0 ? 'clear' : 'unverified'

  /* ---- Evidence rows ---- */
  const evidence: EvidenceRow[] = [
    domainRow(p, rdap, ageDays, signals, brand.official, processor, externals.simulated),
    reputationRow(threat, externals.simulated),
    impersonationRow(brand, p),
    expectedRow,
  ]
  if (shot) evidence.push(contentRow(shot))

  /* ---- Identity card ---- */
  const { fields, chain } = identity(p, rdap, brand, processor, shot, expected, now)

  /* ---- Words ---- */
  const criteria = buildCriteria({ p, rdap, ageDays, brand, processor, expectedRow, signals, threat, dns: externals.dns, shot, simulated: externals.simulated })
  criteria.push(...contextEvidence.criteria)
  const copy = compose(verdict, signals, { p, site, processor, brand, expected, source: opts.source, shot })
  if (verdict !== 'warning' && contextEvidence.signals.length) {
    copy.explanation = contextEvidence.signals[0].text + ' The destination does not establish who receives the money.'
    copy.nextStep = { title: opts.context?.channel === 'marketplace' ? 'Keep the payment in the marketplace' : 'Confirm the request through a trusted channel', body: 'Open the original app or contact the person using details you already trust. Confirm the recipient, amount and available buyer protection before paying.' }
  }

  const notChecked: string[] = []
  if (threat.status !== 'clean' && threat.status !== 'flagged') notChecked.push(threat.status === 'not_configured' ? 'Phishing and malware databases (no threat-intelligence service configured on this deployment)' : 'Phishing and malware databases (lookup unavailable right now)')
  if (!externals.dns || externals.dns.status === 'unavailable' || externals.dns.status === 'skipped') notChecked.push('Public DNS availability (no usable lookup for this destination)')
  if (rdap.status !== 'ok') notChecked.push('Domain registration date (registry lookup unavailable)')
  notChecked.push("The payment page's content — BeforePay never opens the page")
  notChecked.push('Who ultimately receives the money')
  notChecked.push('TLS certificate validity, redirects and website content (the address is not visited)')
  if (!opts.expected) notChecked.push('Whether this matches who you meant to pay')

  return {
    id: Math.random().toString(36).slice(2, 10),
    source: opts.source,
    url: p,
    verdict,
    headline: copy.headline,
    explanation: copy.explanation,
    nextStep: copy.nextStep,
    fields,
    chain,
    evidence,
    signals,
    criteria,
    engineVersion: ENGINE_VERSION,
    dns: externals.dns,
    notChecked,
    checkedAt: now.toISOString(),
    expected,
    context: opts.context ? { channel: opts.context.channel, method: opts.context.method, amount: opts.context.amount?.slice(0, 40) } : undefined,
    screenshot: shot,
    registry: externals.registry,
    simulation: opts.simulation,
    expandedFrom: externals.expandedFrom,
  }
}

function row(id: EvidenceRow['id'], title: string, status: Status, summary: string, details: string[]): EvidenceRow {
  return { id, title, status, summary, details, sources: [] }
}

function domainRow(
  p: ParsedUrl,
  rdap: Externals['rdap'],
  ageDays: number | null,
  signals: Signal[],
  official: Brand | null,
  processor: ProcessorMatch | null,
  simulated?: boolean,
): EvidenceRow {
  const site = p.registrableDomain ?? p.hostname
  const has = (id: string) => signals.find((s) => s.id === id)
  const details: string[] = [
    `Full host: ${p.displayHost}${p.displayHost !== p.hostname ? ` (encoded as ${p.hostname})` : ''}`,
    `Registrable domain: ${p.registrableDomain ?? 'n/a (IP address)'}`,
  ]
  if (p.subdomain) details.push(`Subdomain: ${p.subdomain}`)
  if (p.publicSuffix) details.push(`Public suffix: .${p.publicSuffix}${p.isPrivateSuffix ? ' (shared hosting platform)' : ''}`)
  details.push(`Connection: ${p.protocol === 'https:' ? 'HTTPS (encrypted)' : 'HTTP (not encrypted)'}`)
  if (rdap.status === 'ok') {
    if (rdap.registered) details.push(`Registered: ${formatDate(rdap.registered)} (${ageInWords(ageDays ?? 0)})`)
    if (rdap.expires) details.push(`Registration expires: ${formatDate(rdap.expires)}`)
    if (rdap.registrar) details.push(`Registrar: ${rdap.registrar}`)
    if (rdap.registrantHidden) details.push('Registrant: hidden (privacy redaction)')
  } else {
    details.push(`Registration lookup: not available${rdap.reason ? ` (${rdap.reason})` : ''}`)
  }
  const sources: Source[] = [{ label: 'Public Suffix List', url: 'https://publicsuffix.org/' }]
  if (rdap.source) sources.unshift(rdap.source)

  let status: Status = 'info'
  let summary = `This link belongs to ${site}.`
  const bad = ['credentials', 'ip', 'private-ip', 'private-host', 'private-dns'].map(has).find(Boolean)
  const meh = ['new-domain', 'dns-missing', 'reserved-domain', 'young-domain', 'shared-hosting', 'shortener', 'http', 'port', 'idn'].map(has).find(Boolean)
  if (bad) {
    status = 'fail'
    summary = bad.text
  } else if (official) {
    status = 'pass'
    summary = `${site} is a known ${official.name} domain${ageDays && ageDays >= 365 ? `, registered ${ageInWords(ageDays)}` : ''}.`
  } else if (processor && processor.kind !== 'crypto') {
    status = processor.kind === 'hosted' ? 'pass' : 'caution'
    summary = `${p.hostname} is operated by ${processor.name}, a payment provider — not by the merchant.`
  } else if (meh) {
    status = 'caution'
    summary = meh.text
  } else if (ageDays !== null && ageDays >= 365) {
    status = 'pass'
    summary = `${site} was registered ${ageInWords(ageDays)}. An established domain, though age alone doesn't prove who runs it.`
  } else if (ageDays !== null) {
    summary = `${site} was registered ${ageInWords(ageDays)}.`
  } else {
    status = 'not_checked'
    summary = `This link belongs to ${site}. We couldn't look up when it was registered.`
  }
  return { id: 'domain', title: 'Domain identity', status, summary, details, sources, simulated }
}

function reputationRow(threat: Externals['threat'], simulated?: boolean): EvidenceRow {
  const base = { id: 'reputation' as const, title: 'Known phishing & malware', sources: threat.source ? [threat.source] : [], simulated }
  switch (threat.status) {
    case 'flagged':
      return { ...base, status: 'fail', summary: `Listed as dangerous by ${threat.source?.label ?? 'a threat database'}.`, details: (threat.threats ?? []).map((t) => `Threat type: ${t}`) }
    case 'clean':
      return { ...base, status: 'pass', summary: `Not listed by ${threat.source?.label ?? 'the threat database'}. New scam sites often aren't listed yet.`, details: ['Checked: malware, social engineering (phishing), unwanted software', 'A clean result only means the link is not on a known list.'] }
    case 'not_configured':
      return { ...base, status: 'not_checked', summary: 'Not checked — no threat-intelligence service is configured on this deployment.', details: ['No external threat-feed result contributed to this report. Local address checks still run.'] }
    case 'offline':
      return { ...base, status: 'not_checked', summary: "Not checked — you're offline.", details: [] }
    default:
      return { ...base, status: 'not_checked', summary: "Not checked — the threat database didn't respond.", details: [] }
  }
}

function impersonationRow(brand: BrandResult, p: ParsedUrl): EvidenceRow {
  const sources = [{ label: `BeforePay brand reference list (${brand.checked} brands)` }]
  if (brand.impersonation) {
    const b = brand.impersonation.brand
    return {
      id: 'impersonation',
      title: 'Brand impersonation',
      status: brand.impersonation.strength === 'similarity' ? 'caution' : 'fail',
      summary: brand.impersonation.detail,
      details: [
        `Technique: ${{ 'subdomain-trick': 'real brand domain used as a subdomain', homoglyph: 'look-alike international characters', name: 'brand name inside an unrelated domain', lookalike: 'look-alike spelling', 'tld-swap': 'same name, different domain ending' }[brand.impersonation.how]}`,
        `${b.name}${b.fictional ? ' (fictional)' : ''} uses: ${b.official.join(', ')}`,
        `This link's real domain: ${p.registrableDomain ?? p.hostname}`,
      ],
      sources,
    }
  }
  if (brand.official) {
    return { id: 'impersonation', title: 'Brand impersonation', status: 'pass', summary: `This is ${brand.official.name}'s own domain, not an imitation.`, details: [`${brand.official.name} domains: ${brand.official.official.join(', ')}`], sources }
  }
  return {
    id: 'impersonation',
    title: 'Brand impersonation',
    status: 'pass',
    summary: `Doesn't imitate any of the ${brand.checked} payment, delivery, marketplace and banking brands we check.`,
    details: ['Checks: brand names inside the address, look-alike spellings, swapped endings, hidden international characters, real domains used as subdomains.', 'Brands outside our list are not covered.'],
    sources,
  }
}

function contentRow(shot: ScreenshotFindings): EvidenceRow {
  const details: string[] = []
  if (shot.visibleMerchant) details.push(`Name shown: ${shot.visibleMerchant}`)
  if (shot.amount) details.push(`Amount shown: ${shot.amount}`)
  if (shot.provider) details.push(`Payment provider shown: ${shot.provider}`)
  for (const s of shot.suspicious) details.push(`Flagged wording: ${s}`)
  if (shot.summary) details.push(shot.summary)
  const status: Status = shot.offPlatformRequest ? 'fail' : shot.suspicious.length ? 'caution' : 'info'
  const summary = shot.readingMethod === 'local_ocr' ? 'A link was read locally. The rest of the screenshot has not been analysed.' : shot.offPlatformRequest
    ? 'Asks you to pay outside the platform — a classic way to remove buyer protection.'
    : shot.suspicious.length
      ? shot.suspicious[0]
      : 'Nothing unusual in the visible wording.'
  return {
    id: 'content',
    title: shot.simulated ? 'What the message says' : 'What the screenshot shows',
    status,
    summary,
    details,
    sources: [{ label: shot.simulated ? 'Scenario fixture (simulated)' : shot.readingMethod === 'local_ocr' ? 'Read on your device — may contain reading errors' : 'Read from your screenshot by AI — may contain mistakes' }],
    simulated: shot.simulated,
    aiAssisted: !shot.simulated && shot.readingMethod !== 'local_ocr',
  }
}

/* ------------------------------------------------------------------ */
/* Merchant Identity Card                                              */
/* ------------------------------------------------------------------ */

function identity(
  p: ParsedUrl,
  rdap: Externals['rdap'],
  brand: BrandResult,
  processor: ProcessorMatch | null,
  shot: ScreenshotFindings | undefined,
  expected: string | undefined,
  now: Date,
): { fields: Field[]; chain: ChainNode[] } {
  const site = p.registrableDomain ?? p.hostname
  const country = countryForSuffix(p.publicSuffix)
  const fields: Field[] = [
    { key: 'website', label: 'Detected website', value: p.displayHost, assurance: 'verified', note: 'Read directly from the link', mono: true },
  ]
  if (processor?.handle) {
    fields.push({ key: 'merchant', label: 'Apparent merchant', value: `@${processor.handle}`, assurance: 'inferred', note: `${processor.name} account handle from the link; the person or business behind it is unknown`, mono: true })
  } else if (brand.official && !processor) {
    fields.push({ key: 'merchant', label: 'Apparent merchant', value: brand.official.name, assurance: 'verified', note: 'Official domain on our reference list', source: { label: 'BeforePay brand reference list' } })
  } else if (shot?.visibleMerchant) {
    fields.push({ key: 'merchant', label: 'Apparent merchant', value: shot.visibleMerchant, assurance: 'inferred', note: shot.simulated ? 'Name shown in the scenario — anyone can type any name' : 'Name visible on your screenshot — anyone can type any name' })
  } else if (processor?.handle) {
    fields.push({ key: 'merchant', label: 'Apparent merchant', value: `@${processor.handle}`, assurance: 'inferred', note: `${processor.name} account handle from the link; the person or business behind it is unknown`, mono: true })
  } else {
    fields.push({ key: 'merchant', label: 'Apparent merchant', value: null, assurance: 'not_verified', note: 'Only the web address is known' })
  }
  fields.push({ key: 'legal', label: 'Legal company name', value: null, assurance: 'not_verified', note: 'No official register links this website to a company' })
  fields.push({
    key: 'country',
    label: 'Country / jurisdiction',
    value: null,
    assurance: 'not_verified',
    note: country ? `The .${p.publicSuffix} ending is ${country}'s, which doesn't prove where the business is` : 'Not determinable from a generic domain ending',
  })
  fields.push({ key: 'regnum', label: 'Registration number', value: null, assurance: 'not_verified', note: 'Not available' })
  if (rdap.status === 'ok' && rdap.registered) {
    fields.push({
      key: 'registered',
      label: 'Domain registered',
      value: formatDate(rdap.registered),
      assurance: 'verified',
      note: `${ageInWords(daysBetween(rdap.registered, now))}${rdap.registrar ? ` · via ${rdap.registrar}` : ''}`,
      source: rdap.source,
    })
  }
  fields.push(
    brand.official
      ? { key: 'official', label: 'Official website', value: site, assurance: 'verified', note: `Listed for ${brand.official.name}`, mono: true, source: { label: 'BeforePay brand reference list' } }
      : { key: 'official', label: 'Official website', value: null, assurance: 'not_verified', note: expected ? `We couldn't confirm ${expected}'s official website` : 'No independent source confirms this is an official site' },
  )
  if (processor) {
    fields.push({ key: 'processor', label: 'Payment processor', value: processor.name, assurance: 'verified', note: `Identified from its official domain ${p.hostname}`, source: { label: `${processor.name} official domain` } })
  } else if (shot?.provider) {
    fields.push({ key: 'processor', label: 'Payment processor', value: shot.provider, assurance: 'inferred', note: shot.simulated ? 'Shown in the scenario' : 'Logo or name visible on the screenshot' })
  } else {
    fields.push({ key: 'processor', label: 'Payment processor', value: null, assurance: 'not_verified', note: "Can't be seen from the address, and we never open the page" })
  }

  const recipientNote = processor?.handle
    ? `Money goes to whoever owns the ${processor.name} handle @${processor.handle}. Their identity isn't public.`
    : processor && processor.kind === 'hosted'
      ? `Funds go to the ${processor.name} account holder behind this page. ${processor.name} knows who that is; we can't see it.`
      : 'Nothing public shows whose account receives the money.'

  const chain: ChainNode[] = [
    {
      role: 'website',
      label: 'Website owner',
      value: brand.official ? brand.official.name : processor ? processor.name : null,
      assurance: brand.official || processor ? 'verified' : 'not_verified',
      note: brand.official
        ? `${site} is ${brand.official.name}'s domain`
        : processor
          ? `${p.hostname} is run by ${processor.name}`
          : rdap.status === 'ok' && rdap.registrantHidden
            ? 'Registrant hidden by privacy redaction'
            : `Whoever registered ${site}`,
    },
    {
      role: 'merchant',
      label: 'Merchant',
      value: fields.find((f) => f.key === 'merchant')?.value ?? null,
      assurance: fields.find((f) => f.key === 'merchant')?.assurance ?? 'not_verified',
      note: processor?.handle ? 'Account handle only' : brand.official ? 'Official brand domain' : shot?.visibleMerchant ? 'Name as displayed, not confirmed' : processor?.handle ? 'Account handle only' : 'No name we can confirm',
    },
    {
      role: 'processor',
      label: 'Payment processor',
      value: processor?.name ?? shot?.provider ?? null,
      assurance: processor ? 'verified' : shot?.provider ? 'inferred' : 'not_verified',
      note: processor ? 'From its official domain' : shot?.provider ? 'Seen on page, not confirmed' : 'Not identifiable',
    },
    { role: 'recipient', label: 'Actual recipient', value: null, assurance: 'not_verified', note: recipientNote },
  ]
  if (brand.official && !processor) chain[1].assurance = 'verified'
  return { fields, chain }
}

/* ------------------------------------------------------------------ */
/* Plain-English verdict copy                                          */
/* ------------------------------------------------------------------ */

const HEADLINES: Record<Verdict, string> = {
  clear: 'No known threats detected',
  unverified: 'Identity not verified',
  warning: 'Warning signs detected',
}

interface ComposeCtx {
  p: ParsedUrl
  site: string
  processor: ProcessorMatch | null
  brand: BrandResult
  expected?: string
  source: InputSource
  shot?: ScreenshotFindings
}

function compose(verdict: Verdict, signals: Signal[], c: ComposeCtx): Pick<Report, 'headline' | 'explanation' | 'nextStep'> {
  const has = (id: string) => signals.some((s) => s.id === id)
  const text = (id: string) => signals.find((s) => s.id === id)?.text ?? ''
  const headline = HEADLINES[verdict]

  if (verdict === 'warning') {
    const order = ['threat', 'credentials', 'impersonation', 'expected-mismatch', 'off-platform', 'new-domain', 'private-ip', 'ip', 'crypto']
    const primary = order.find(has) ?? signals.find((s) => s.severity === 'warning')?.id ?? ''
    const others = signals.filter((s) => s.severity === 'warning' && s.id !== primary).length
    const explanation = text(primary) + (others ? ` We found ${others} more warning sign${others > 1 ? 's' : ''} below.` : '')
    const realBrand = c.brand.impersonation?.brand
    const steps: Record<string, { title: string; body: string }> = {
      threat: { title: "Don't open this link", body: 'Close it and delete the message. If you already entered card details, call your bank using the number on the back of your card.' },
      credentials: { title: "Don't pay on this page", body: `It is really ${c.site}, dressed up to look like somewhere else. Go to the business by typing its address yourself.` },
      impersonation: { title: `Pay ${realBrand?.name ?? 'the brand'} directly instead`, body: `Don't pay through this link. Open ${realBrand?.name ?? 'the real'}'s app, or type ${realBrand?.official[0] ?? 'its address'} into your browser yourself, and pay there.` },
      'expected-mismatch': { title: `Pay through ${c.expected}'s own app or site`, body: `This link doesn't lead to ${c.expected}. Close it and pay using the official app or by typing their address yourself.` },
      'off-platform': { title: 'Keep the payment inside the platform', body: "Reply that you'll only pay through the marketplace's own checkout. A genuine seller will agree; a scammer will push back." },
      'new-domain': { title: 'Hold off for now', body: `Look up the business yourself (not through this link) and check reviews older than ${c.site}. If you go ahead, pay by credit card so you can claim a refund.` },
      crypto: { title: "Don't pay in crypto to someone you can't verify", body: 'Crypto payments are final. Ask for a card or bank payment through a recognised checkout instead.' },
    }
    return { headline, explanation, nextStep: steps[primary] ?? { title: "Don't pay through this link", body: 'Contact the business through a channel you already trust, and pay there instead.' } }
  }

  if (verdict === 'clear') {
    let explanation = `None of our checks found warning signs for ${c.site}. That's not a guarantee, and we couldn't confirm who receives the money.`
    if (c.processor?.kind === 'hosted') explanation = `The address matches ${c.processor.name}'s hosted checkout domains and none of our checks found warning signs. ${c.processor.name} doesn't show us who the merchant is.`
    else if (c.brand.official) explanation = `The address matches ${c.brand.official.name}'s reference domain and none of our checks found warning signs. That's not a guarantee.`
    return {
      headline,
      explanation,
      nextStep: c.processor?.kind === 'hosted'
        ? { title: 'Check the name on the payment page', body: `If the business name on the ${c.processor.name} page is the one you expect, paying by card keeps your right to a chargeback.` }
        : { title: 'Pay by card if you go ahead', body: 'Card payments let you ask your bank for a chargeback if goods never arrive. Avoid bank transfers to businesses you can\'t verify.' },
    }
  }

  // unverified
  if (has('new-domain') || has('young-domain')) return { headline, explanation: `${text(has('new-domain') ? 'new-domain' : 'young-domain')} A new registration is a reason to check further, not proof of fraud.`, nextStep: { title: 'Verify the business independently', body: 'Use contact details from a source you already trust. Check the business and buyer protection before paying.' } }
  if (has('brand-similarity')) return { headline, explanation: text('brand-similarity'), nextStep: { title: 'Check the spelling with the sender', body: 'Similar names can belong to unrelated businesses. Find the business independently and compare the exact domain.' } }
  if (has('crypto')) return { headline, explanation: 'This is a recognised cryptocurrency payment provider, but the merchant and final recipient are not verified. Crypto payments are difficult to reverse.', nextStep: { title: 'Confirm the recipient before paying', body: 'Ask for a payment method with buyer protection if you are buying from someone you do not know.' } }
  if (has('expected-unlinked')) {
    return {
      headline,
      explanation: `This ${c.source === 'qr' || c.source === 'demo' && c.shot === undefined ? 'QR code' : 'link'} goes to ${c.site}, and nothing links it to ${c.expected}. Some operators use third-party payment sites, so this isn't proof of fraud — but we can't confirm it either.`,
      nextStep: c.source === 'qr' || c.source === 'demo'
        ? { title: `Pay ${c.expected} another way`, body: `Use ${c.expected}'s official app or the phone number printed on the sign, and check whether the QR code is a sticker stuck over the original.` }
        : { title: `Find ${c.expected} yourself`, body: `Search for ${c.expected}'s official website or app independently and pay there, not through this link.` },
    }
  }
  if (has('p2p')) {
    return {
      headline,
      explanation: `This link pays a personal ${c.processor?.name} account${c.processor?.handle ? ` (@${c.processor.handle})` : ''}. We can't tell who owns it, and these payments are hard to get back.`,
      nextStep: { title: 'Only pay people you know', body: "For anything you're buying, use a checkout with buyer protection instead, such as a marketplace's own payment or a card payment." },
    }
  }
  if (has('shortener')) {
    return {
      headline,
      explanation: `This is a shortened link, so the real destination is hidden. We didn't open it to find out.`,
      nextStep: { title: 'Ask for the full link', body: 'Ask the sender for the full web address of the business, or find the business yourself and pay there.' },
    }
  }
  return {
    headline,
    explanation: `We found no warning signs, but we couldn't confirm who runs ${c.site} or who receives the money.`,
    nextStep: { title: 'Confirm the business before paying', body: `Look the business up yourself (not through this link). If you go ahead, pay by card so you can request a chargeback.` },
  }
}
