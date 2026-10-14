import type { BrandResult } from './analyze'
import type { Criterion, DnsInfo, EvidenceRow, ParsedUrl, ProcessorMatch, RdapInfo, ScreenshotFindings, Signal, ThreatInfo } from './types'

export const ENGINE_VERSION = '2.1.0'

interface CriteriaInput {
  p: ParsedUrl
  rdap: RdapInfo
  ageDays: number | null
  brand: BrandResult
  processor: ProcessorMatch | null
  expectedRow: EvidenceRow
  signals: Signal[]
  threat: ThreatInfo
  dns?: DnsInfo
  shot?: ScreenshotFindings
  simulated?: boolean
}

/** Each row is one reproducible criterion, never a pretend independent antivirus engine. */
export function buildCriteria({ p, rdap, ageDays, brand, processor, expectedRow, signals, threat, dns, shot, simulated }: CriteriaInput): Criterion[] {
  const has = (...ids: string[]) => signals.find(s => ids.includes(s.id))
  const address = has('private-ip', 'private-host', 'ip', 'private-dns', 'reserved-domain')
  const resemblance = brand.impersonation
  const providerRisk = has('p2p', 'crypto', 'shared-hosting')
  const out: Criterion[] = [
    {
      id: 'destination', title: 'Public payment destination',
      status: address ? address.severity === 'warning' ? 'fail' : 'caution' : 'pass',
      summary: address?.text ?? 'A named, public web address was extracted.',
      detail: `Actual hostname: ${p.hostname}. Registrable domain: ${p.registrableDomain ?? 'not available'}. A public hostname alone does not verify a business.`,
      basis: 'Address rule', source: { label: 'Public Suffix List', url: 'https://publicsuffix.org/' },
    },
    {
      id: 'https', title: 'HTTPS in the address', status: p.protocol === 'https:' ? 'pass' : 'caution',
      summary: p.protocol === 'https:' ? 'The address requests an encrypted connection.' : 'The address uses HTTP. Do not enter payment details.',
      detail: 'This checks the URL scheme. The certificate, connection and page were not opened or tested. Scam sites also use HTTPS.', basis: 'Address rule',
    },
    {
      id: 'credentials', title: 'Hidden destination with @', status: p.hasCredentials ? 'fail' : 'pass',
      summary: p.hasCredentials ? `Text before @ is not the destination. Your browser goes to ${p.hostname}.` : 'No username or password prefix disguises the destination.',
      detail: 'Browsers treat text before @ as credentials. Brand-like text there does not identify the website owner. Personal credentials are redacted.', basis: 'Address rule',
    },
    {
      id: 'brand', title: 'Brand resemblance', status: resemblance ? resemblance.strength === 'similarity' ? 'caution' : 'fail' : 'pass',
      summary: resemblance?.detail ?? `No imitation pattern found against ${brand.checked} reference brands.`,
      detail: resemblance ? `Technique: ${ressemblanceLabel(resemblance.how)}. Reference domains for ${resemblance.brand.name}: ${resemblance.brand.official.join(', ')}. The list is curated and incomplete; a resemblance is not a finding of fraud.` : 'Checks exact brand-plus-payment patterns, deceptive subdomains, look-alike digits and international characters. Brands outside the list are not covered.',
      basis: 'Reference list', source: resemblance && !resemblance.brand.fictional ? { label: `${resemblance.brand.name} reference website`, url: `https://${resemblance.brand.official[0]}` } : undefined,
    },
    {
      id: 'official-domain', title: 'Known domain or provider', status: brand.official || processor ? 'pass' : 'info',
      summary: brand.official ? `The hostname matches the ${brand.official.name} reference list.` : processor ? `The hostname matches ${processor.name}'s payment infrastructure.` : 'No known brand or provider match. Independent businesses may use other domains.',
      detail: 'This identifies the domain or platform only. It does not authenticate the current page, seller, account holder or beneficiary. Shops on shared platforms remain independent merchants.', basis: 'Reference list',
      source: brand.official ? { label: `${brand.official.name} reference website`, url: `https://${brand.official.official[0]}` } : undefined,
    },
    {
      id: 'shortener', title: 'Destination visibility', status: has('shortener') ? 'caution' : 'pass',
      summary: has('shortener')?.text ?? 'The hostname is visible in the submitted address.',
      detail: 'Known shorteners hide the final destination. We do not visit the payment page or follow arbitrary redirects. Unknown redirect services may not be recognised.', basis: 'Address rule',
    },
    {
      id: 'registration', title: 'Domain registration age', status: ageDays === null ? 'not_checked' : ageDays < 180 ? 'caution' : 'info',
      summary: ageDays === null ? `No usable registration date${rdap.reason ? `: ${rdap.reason}` : '.'}` : `Registered ${ageDays} days ago${ageDays < 30 ? '; less than 30 days old' : ageDays < 180 ? '; less than six months old' : ''}.`,
      detail: ageDays === null ? 'Missing registry data does not prove that a domain is unregistered. Browser access, privacy policies or registry outages may limit this lookup.' : `Registry date: ${rdap.registered}. ${rdap.registrar ? `Registrar: ${rdap.registrar}. ` : ''}Domain age neither proves nor disproves fraud. Privacy redaction of the registrant is normal.`,
      basis: simulated ? 'Simulation' : 'Live lookup', source: rdap.source,
    },
    {
      id: 'dns', title: 'Public DNS availability', status: dns?.status === 'resolved' ? has('private-dns') ? 'fail' : 'pass' : dns?.status === 'not_found' ? 'caution' : 'not_checked',
      summary: dns?.status === 'resolved' ? has('private-dns')?.text ?? 'A public resolver returned an address for this hostname.' : dns?.status === 'not_found' ? 'No public IP address was returned at this time.' : `DNS lookup unavailable${dns?.reason ? `: ${dns.reason}` : '.'}`,
      detail: dns?.status === 'resolved' ? `Addresses: ${dns.addresses?.join(', ') || 'not published'}. ${dns.checkedAt ? `Checked: ${dns.checkedAt}. ` : ''}DNS resolution confirms availability, not ownership, reputation or page content.` : 'An inactive address, temporary DNS failure or a typo can explain a missing answer. This is not a blacklist result.', basis: 'Live lookup', source: dns?.source,
    },
    {
      id: 'payment-route', title: 'Payment route & protection', status: providerRisk || processor?.kind === 'platform' ? 'caution' : processor ? 'pass' : 'not_checked',
      summary: processor ? processor.kind === 'platform' ? `Hosted by ${processor.name}; the independent merchant is not verified.` : processor.note : providerRisk?.text ?? 'The payment provider cannot be identified from this URL.',
      detail: 'Personal and cryptocurrency payments need separate recipient checks. A recognised checkout provider does not prove that the merchant is legitimate or that buyer protection applies.', basis: 'Reference list',
    },
    {
      id: 'merchant-match', title: 'Expected merchant', status: expectedRow.status, summary: expectedRow.summary,
      detail: expectedRow.details.join(' · ') || 'Enter the merchant you intended to pay. A matching name is a consistency check, not legal-identity verification.', basis: 'User input',
    },
    {
      id: 'threat-feed', title: 'External phishing & malware feeds', status: threat.status === 'flagged' ? 'fail' : threat.status === 'clean' ? 'pass' : 'not_checked',
      summary: threat.status === 'flagged' ? `Listed by ${threat.source?.label ?? 'the configured feed'}: ${(threat.threats ?? []).join(', ')}.` : threat.status === 'clean' ? `No listing returned by ${threat.source?.label ?? 'the configured feed'}.` : threat.status === 'offline' ? 'No external reputation lookup while offline.' : threat.status === 'not_configured' ? 'No external reputation service is connected.' : 'The external reputation service did not respond.',
      detail: 'No listing is not a safety guarantee. New threats may not yet be listed. No VirusTotal scanner votes are used in this report.', basis: simulated ? 'Simulation' : 'Optional service', source: threat.source,
    },
    {
      id: 'recipient', title: 'Actual recipient identity', status: 'not_checked', summary: 'The person or business receiving the funds is not verified.',
      detail: 'A URL, company-name match or payment-provider domain cannot prove who owns the receiving account. Confirmation requires trusted payment or bank-side evidence.', basis: 'Optional service',
    },
  ]
  if (shot) out.push({ id: 'message', title: shot.readingMethod === 'local_ocr' ? 'Screenshot text recognition' : 'Message or screenshot wording', status: shot.offPlatformRequest ? 'fail' : shot.suspicious.length ? 'caution' : 'info', summary: shot.readingMethod === 'local_ocr' ? 'The link was read on your device and reviewed by you.' : shot.offPlatformRequest ? 'A request to pay outside the original platform was found.' : shot.suspicious[0] ?? 'No unusual wording in the supplied image.', detail: shot.readingMethod === 'local_ocr' ? 'Text recognition only extracts the address. It does not check the rest of the image or verify names, amounts or the recipient.' : 'Visible names, logos and amounts can be forged. AI extraction can make mistakes and does not verify the recipient.', basis: shot.simulated ? 'Simulation' : 'User input' })
  return out
}

function ressemblanceLabel(how: string): string {
  return ({'subdomain-trick':'brand domain used as a subdomain',homoglyph:'look-alike international characters',name:'brand name on a different domain',lookalike:'similar spelling','tld-swap':'same name on another domain ending'} as Record<string,string>)[how] ?? how
}
