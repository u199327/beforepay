/**
 * Turning whatever the user gives us (pasted text, a shared WhatsApp message,
 * a decoded QR payload) into one validated http(s) URL — or a clear reason why not.
 */

export const MAX_URL_LENGTH = 2048

export type IngestError =
  | 'empty'
  | 'not_a_link'
  | 'unsupported_scheme'
  | 'too_long'
  | 'payment_uri'

export interface PaymentUri {
  scheme: string
  label: string
  recipient: string | null
  name: string | null
  crypto: boolean
}

export type IngestResult =
  | { ok: true; url: URL }
  | { ok: false; error: IngestError; paymentUri?: PaymentUri }

const URL_IN_TEXT = /\bhttps?:\/\/[^\s<>"'`]+/i
const WWW_IN_TEXT = /\bwww\.[^\s<>"'`]+/i
const BARE_DOMAIN = /\b(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,24}(?::\d{2,5})?(?:\/[^\s<>"'`]*)?/i
const PAYMENT_SCHEME = /^(upi|bitcoin|ethereum|litecoin|lightning|solana|tron|bitcoincash):/i
const UNSAFE_SCHEME = /^(javascript|data|file|vbscript|blob|about|chrome|intent|content):/i

function trimTrailing(candidate: string): string {
  let s = candidate
  // Messages often wrap links in punctuation: (https://x.com/a), "https://..."!
  while (/[)\]}.,;:!?'"»”’>]$/.test(s)) {
    if (s.endsWith(')') && (s.match(/\(/g)?.length ?? 0) >= (s.match(/\)/g)?.length ?? 0)) break
    s = s.slice(0, -1)
  }
  return s
}

function parsePaymentUri(raw: string): PaymentUri {
  const scheme = raw.split(':')[0].toLowerCase()
  const crypto = scheme !== 'upi'
  let recipient: string | null = null
  let name: string | null = null
  try {
    if (scheme === 'upi') {
      const q = new URLSearchParams(raw.slice(raw.indexOf('?') + 1))
      recipient = q.get('pa')
      name = q.get('pn')
    } else {
      recipient = raw.slice(scheme.length + 1).split(/[?/]/)[0].replace(/^\/\//, '') || null
    }
  } catch {
    /* fall through with nulls */
  }
  const labels: Record<string, string> = {
    upi: 'UPI payment request',
    bitcoin: 'Bitcoin payment request',
    ethereum: 'Ethereum payment request',
    lightning: 'Lightning payment request',
  }
  return {
    scheme,
    label: labels[scheme] ?? `${scheme} payment request`,
    recipient: recipient ? recipient.slice(0, 120) : null,
    name: name ? name.slice(0, 80) : null,
    crypto,
  }
}

/** Find the most plausible link inside free text and validate it. */
export function ingest(input: string | null | undefined): IngestResult {
  const text = (input ?? '').trim()
  if (!text) return { ok: false, error: 'empty' }
  if (text.length > MAX_URL_LENGTH * 2) return { ok: false, error: 'too_long' }

  if (PAYMENT_SCHEME.test(text)) {
    return { ok: false, error: 'payment_uri', paymentUri: parsePaymentUri(text) }
  }
  if (UNSAFE_SCHEME.test(text)) return { ok: false, error: 'unsupported_scheme' }

  let candidate: string | null = null
  const explicit = text.match(URL_IN_TEXT)
  if (explicit) candidate = explicit[0]
  else {
    const www = text.match(WWW_IN_TEXT)
    const bare = www ?? text.match(BARE_DOMAIN)
    if (bare) candidate = `https://${bare[0]}`
  }
  if (!candidate) {
    // A non-http scheme on its own (ftp:, mailto:, etc.)
    if (/^[a-z][a-z0-9+.-]{1,20}:/i.test(text) && !/^[a-z0-9-]+\.[a-z]/i.test(text)) {
      return { ok: false, error: 'unsupported_scheme' }
    }
    return { ok: false, error: 'not_a_link' }
  }

  candidate = trimTrailing(candidate)
  if (candidate.length > MAX_URL_LENGTH) return { ok: false, error: 'too_long' }

  let url: URL
  try {
    url = new URL(candidate)
  } catch {
    return { ok: false, error: 'not_a_link' }
  }
  if (url.protocol !== 'https:' && url.protocol !== 'http:') {
    return { ok: false, error: 'unsupported_scheme' }
  }
  if (!url.hostname || !url.hostname.includes('.') && !url.hostname.startsWith('[')) {
    // "localhost", single-label intranet names: not a public payment page
    if (url.hostname !== 'localhost') return { ok: false, error: 'not_a_link' }
  }
  return { ok: true, url }
}

export const INGEST_MESSAGES: Record<IngestError, string> = {
  empty: 'Paste a payment link to check it.',
  not_a_link: "That doesn't look like a web address. Paste the full link, starting with https://",
  unsupported_scheme: 'Only web links (http or https) can be checked. Other link types are blocked for your safety.',
  too_long: 'That link is unusually long. Copy just the web address and try again.',
  payment_uri: 'This is a direct payment instruction, not a web page.',
}

/* ------------------------------------------------------------------ */
/* Redaction of payment-session tokens and personal data               */
/* ------------------------------------------------------------------ */

const SENSITIVE_KEY =
  /(token|session|sess|sid|secret|auth|key|pass|pwd|otp|code|card|pan|cvv|cvc|iban|account|acct|sort|email|e-mail|phone|mobile|tel|client_secret|signature|sig|nonce|payment_intent|setup_intent|checkout|jwt|bearer|ssn|dob)/i
const TOKENISH = /^[A-Za-z0-9_\-+/=.%]{24,}$/
const EMAILISH = /[^\s@]+@[^\s@]+\.[^\s@]+/
const DIGITS_LONG = /\d{9,}/
const PATH_TOKEN = /^(cs|pi|seti|ch|pm|in|sub|plink|bps|test|live)_[A-Za-z0-9_]{10,}$/

export const HIDDEN = '•••'

export interface Redacted {
  href: string
  path: string
  count: number
}

/** Hide session tokens, emails and long identifiers from anything we display or share. */
export function redactUrl(url: URL): Redacted {
  let count = 0
  const segments = url.pathname.split('/').map((seg) => {
    let decoded = seg
    try {
      decoded = decodeURIComponent(seg)
    } catch {
      /* keep raw */
    }
    if (PATH_TOKEN.test(decoded) || TOKENISH.test(decoded) || EMAILISH.test(decoded) || DIGITS_LONG.test(decoded)) {
      count++
      return HIDDEN
    }
    return seg
  })
  const params: string[] = []
  url.searchParams.forEach((value, key) => {
    if (SENSITIVE_KEY.test(key) || TOKENISH.test(value) || EMAILISH.test(value) || DIGITS_LONG.test(value)) {
      count++
      params.push(`${encodeURIComponent(key)}=${HIDDEN}`)
    } else {
      params.push(`${encodeURIComponent(key)}=${encodeURIComponent(value)}`)
    }
  })
  if (url.hash && url.hash.length > 1) count++
  const path = segments.join('/') + (params.length ? `?${params.join('&')}` : '')
  const auth = url.username ? `${url.username}${url.password ? ':' + HIDDEN : ''}@` : ''
  const port = url.port ? `:${url.port}` : ''
  return { href: `${url.protocol}//${auth}${url.hostname}${port}${path}`, path, count }
}

/** A URL safe to put into a shareable BeforePay link: origin + path, tokens removed. */
export function shareableTarget(url: URL): string {
  const { path } = redactUrl(url)
  // Keep a deceptive "user@" prefix (it is evidence), never a password.
  const auth = url.username ? `${url.username}@` : ''
  return `${url.protocol}//${auth}${url.host}${path}`.replaceAll(HIDDEN, 'x')
}
