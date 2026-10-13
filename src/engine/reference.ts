import type { Brand, ProcessorMatch } from './types'

/**
 * BeforePay reference list: brands that are frequently impersonated in payment
 * scams, with the domains they officially use. Deliberately small and curated —
 * the UI says how many brands are covered rather than implying completeness.
 * `distinctive` names can be matched inside other words; ordinary words
 * (Apple, Wise, Chase...) only count as an exact word or with scam-context words.
 */
export const BRANDS: Brand[] = [
  { name: 'GOV.UK', tokens: ['govuk'], official: ['gov.uk'], distinctive: true },
  { name: 'PayPal', tokens: ['paypal'], official: ['paypal.com', 'paypal.me', 'paypalobjects.com'], distinctive: true },
  { name: 'Stripe', tokens: ['stripe'], official: ['stripe.com'], distinctive: false },
  { name: 'Amazon', tokens: ['amazon', 'amzn'], official: ['amazon.com', 'amazon.co.uk', 'amazon.de', 'amazon.fr', 'amazon.es', 'amazon.it', 'amazon.nl', 'amazon.ca', 'amazon.in', 'amazon.com.au', 'amazon.co.jp', 'amazon.ie', 'amzn.to', 'amzn.eu'], distinctive: false },
  { name: 'eBay', tokens: ['ebay'], official: ['ebay.com', 'ebay.co.uk', 'ebay.de', 'ebay.fr', 'ebay.it', 'ebay.es', 'ebay.com.au', 'ebay.ca', 'ebay.ie'], distinctive: false },
  { name: 'Apple', tokens: ['apple', 'icloud', 'appleid'], official: ['apple.com', 'icloud.com'], distinctive: false },
  { name: 'Revolut', tokens: ['revolut'], official: ['revolut.com', 'revolut.me'], distinctive: true },
  { name: 'Monzo', tokens: ['monzo'], official: ['monzo.com', 'monzo.me'], distinctive: true },
  { name: 'Wise', tokens: ['wise', 'transferwise'], official: ['wise.com', 'transferwise.com'], distinctive: false },
  { name: 'Klarna', tokens: ['klarna'], official: ['klarna.com'], distinctive: true },
  { name: 'Royal Mail', tokens: ['royalmail'], official: ['royalmail.com', 'royalmail.co.uk'], distinctive: true },
  { name: 'HMRC', tokens: ['hmrc'], official: ['gov.uk'], distinctive: true },
  { name: 'DVLA', tokens: ['dvla'], official: ['gov.uk'], distinctive: true },
  { name: 'TV Licensing', tokens: ['tvlicensing', 'tvlicence'], official: ['tvlicensing.co.uk'], distinctive: true },
  { name: 'Evri', tokens: ['evri', 'hermes'], official: ['evri.com'], distinctive: false },
  { name: 'DPD', tokens: ['dpd'], official: ['dpd.co.uk', 'dpd.com', 'dpdlocal.co.uk'], distinctive: false },
  { name: 'Netflix', tokens: ['netflix'], official: ['netflix.com'], distinctive: true },
  { name: 'Vinted', tokens: ['vinted'], official: ['vinted.com', 'vinted.co.uk', 'vinted.fr', 'vinted.de', 'vinted.es', 'vinted.it', 'vinted.nl', 'vinted.ie'], distinctive: true },
  { name: 'Depop', tokens: ['depop'], official: ['depop.com'], distinctive: true },
  { name: 'Etsy', tokens: ['etsy'], official: ['etsy.com'], distinctive: false },
  { name: 'Facebook Marketplace', tokens: ['facebook', 'fbmarketplace'], official: ['facebook.com', 'fb.com', 'messenger.com', 'meta.com'], distinctive: true },
  { name: 'Gumtree', tokens: ['gumtree'], official: ['gumtree.com'], distinctive: true },
  { name: 'Booking.com', tokens: ['booking'], official: ['booking.com'], distinctive: false },
  { name: 'Airbnb', tokens: ['airbnb'], official: ['airbnb.com', 'airbnb.co.uk', 'airbnb.ie', 'airbnb.fr', 'airbnb.de', 'airbnb.es'], distinctive: true },
  { name: 'Coinbase', tokens: ['coinbase'], official: ['coinbase.com'], distinctive: true },
  { name: 'Barclays', tokens: ['barclays'], official: ['barclays.co.uk', 'barclays.com'], distinctive: true },
  { name: 'HSBC', tokens: ['hsbc'], official: ['hsbc.co.uk', 'hsbc.com'], distinctive: true },
  { name: 'NatWest', tokens: ['natwest'], official: ['natwest.com'], distinctive: true },
  { name: 'Lloyds Bank', tokens: ['lloydsbank', 'lloyds'], official: ['lloydsbank.com', 'lloydsbank.co.uk'], distinctive: false },
  { name: 'Santander', tokens: ['santander'], official: ['santander.co.uk', 'santander.com'], distinctive: false },
  { name: 'Venmo', tokens: ['venmo'], official: ['venmo.com'], distinctive: true },
  { name: 'Cash App', tokens: ['cashapp'], official: ['cash.app', 'cash.me', 'squareup.com'], distinctive: true },
  { name: 'Shopify', tokens: ['shopify'], official: ['shopify.com', 'myshopify.com', 'shop.app'], distinctive: true },
  { name: 'RingGo', tokens: ['ringgo'], official: ['myringgo.co.uk', 'ringgo.co.uk'], distinctive: true },
  { name: 'PayByPhone', tokens: ['paybyphone'], official: ['paybyphone.co.uk', 'paybyphone.com'], distinctive: true },
]

/** Words scammers bolt onto brand names ("paypal-secure", "royalmailfees"). */
export const CONTEXT_WORDS = [
  'secure', 'security', 'login', 'signin', 'verify', 'verification', 'pay', 'payment', 'payments', 'support', 'help',
  'account', 'accounts', 'update', 'billing', 'refund', 'refunds', 'service', 'services', 'online', 'checkout',
  'wallet', 'app', 'center', 'centre', 'team', 'auth', 'protect', 'protection', 'buyer', 'buyers', 'delivery',
  'parcel', 'track', 'tracking', 'customs', 'fee', 'fees', 'fine', 'fines', 'tax', 'claim', 'unlock', 'confirm',
  'official', 'safe', 'uk', 'us', 'gb', 'eu', 'web', 'portal', 'id', 'invoice', 'order', 'orders', 'redelivery',
]

export const SUSPICIOUS_HOST_WORDS = ['login', 'signin', 'verify', 'verification', 'unlock', 'suspended', 'confirm', 'refund', 'claim', 'redelivery', 'secure', 'update', 'wallet']

export const SHORTENERS = [
  'bit.ly', 'tinyurl.com', 't.co', 'goo.gl', 'ow.ly', 'is.gd', 'buff.ly', 'cutt.ly', 'rebrand.ly', 'shorturl.at',
  'rb.gy', 'tiny.cc', 't.ly', 'qrco.de', 's.id', 'bl.ink', 'lnkd.in', 'shorturl.gg', 'v.gd', 'tiny.one', 'qr.net',
]

/** Commerce platforms on the Public Suffix List's private section: shared, but merchant-oriented. */
export const COMMERCE_PLATFORMS: Record<string, string> = {
  'myshopify.com': 'Shopify',
  'square.site': 'Square Online',
  'company.site': 'Ecwid',
}

interface ProcessorRule {
  name: string
  kind: ProcessorMatch['kind']
  hosts?: string[] // exact hostnames
  domains?: string[] // registrable domains (any subdomain)
  paths?: RegExp // optional path requirement
  handleFromPath?: boolean
  note: string
}

const PROCESSORS: ProcessorRule[] = [
  { name: 'Stripe', kind: 'hosted', hosts: ['checkout.stripe.com', 'buy.stripe.com', 'invoice.stripe.com', 'pay.stripe.com', 'billing.stripe.com', 'donate.stripe.com'], note: "A Stripe-hosted page. Stripe verifies the business behind each account, but it doesn't publish who that is — the name on the page is set by the merchant." },
  { name: 'PayPal', kind: 'p2p', domains: ['paypal.me'], handleFromPath: true, note: 'A PayPal.Me link pays whoever owns this handle. Payments sent as "friends and family" generally have no buyer protection.' },
  { name: 'PayPal', kind: 'hosted', hosts: ['www.paypal.com', 'paypal.com'], paths: /^\/(checkoutnow|webapps|invoice|ncp|donate|paypalme|pay|cgi-bin)/i, note: "A PayPal-hosted payment page. PayPal knows the account holder; we can't see who it is." },
  { name: 'Adyen', kind: 'hosted', domains: ['adyen.link'], note: 'An Adyen Pay by Link page. Adyen onboards and verifies its merchants; the merchant name shown is set by the business.' },
  { name: 'Square', kind: 'hosted', domains: ['square.link'], hosts: ['checkout.square.site'], note: 'A Square checkout link. Square verifies sellers, but the seller name is not visible from the address.' },
  { name: 'SumUp', kind: 'hosted', hosts: ['pay.sumup.com', 'pay.sumup.io'], note: 'A SumUp payment link. SumUp verifies its merchants; the merchant is not visible from the address.' },
  { name: 'Shopify', kind: 'platform', hosts: ['checkout.shopify.com', 'shop.app'], domains: ['myshopify.com'], note: "A store running on Shopify. Shopify hosts many independent shops — the store owner is not verified by us." },
  { name: 'Revolut', kind: 'p2p', domains: ['revolut.me'], handleFromPath: true, note: 'A Revolut.me link pays whoever owns this handle. Treat it like a bank transfer to a person.' },
  { name: 'Revolut', kind: 'hosted', hosts: ['checkout.revolut.com', 'pay.revolut.com', 'business.revolut.com'], note: 'A Revolut Business checkout. Revolut verifies business accounts; the business is not visible from the address.' },
  { name: 'Monzo', kind: 'p2p', domains: ['monzo.me'], handleFromPath: true, note: 'A monzo.me link pays whoever owns this handle. Treat it like a bank transfer to a person.' },
  { name: 'Wise', kind: 'p2p', hosts: ['wise.com'], paths: /^\/pay\//i, handleFromPath: true, note: 'A Wise payment link to an account holder. Treat it like a bank transfer.' },
  { name: 'GoCardless', kind: 'hosted', hosts: ['pay.gocardless.com'], note: 'A GoCardless Direct Debit page. It sets up payments from your bank account to the merchant.' },
  { name: 'Mollie', kind: 'hosted', hosts: ['www.mollie.com', 'mollie.com', 'paymentlink.mollie.com'], paths: /^\/(checkout|paymentscreen|p\/)/i, note: 'A Mollie-hosted payment page. The merchant is not visible from the address.' },
  { name: 'Klarna', kind: 'hosted', hosts: ['pay.klarna.com', 'js.klarna.com'], note: 'A Klarna payment page. Klarna is a lender: you may owe Klarna, not the shop.' },
  { name: 'Cash App', kind: 'p2p', domains: ['cash.app'], handleFromPath: true, note: 'A Cash App link pays whoever owns this $cashtag. Payments are usually instant and hard to reverse.' },
  { name: 'Venmo', kind: 'p2p', domains: ['venmo.com'], paths: /^\/(u\/|code)/i, handleFromPath: true, note: 'A Venmo link pays a personal account. Purchase protection only applies to payments marked as goods and services.' },
  { name: 'Razorpay', kind: 'hosted', domains: ['rzp.io', 'razorpay.me'], hosts: ['pages.razorpay.com'], note: 'A Razorpay payment page. The merchant is not visible from the address.' },
  { name: 'Paddle', kind: 'hosted', hosts: ['checkout.paddle.com', 'buy.paddle.com', 'pay.paddle.io'], note: 'A Paddle checkout. Paddle acts as reseller (merchant of record) for the software vendor.' },
  { name: 'Coinbase Commerce', kind: 'crypto', hosts: ['commerce.coinbase.com'], note: 'A cryptocurrency payment page. Crypto payments cannot be reversed and have no buyer protection.' },
]

export function matchProcessor(hostname: string, registrable: string | null, pathname: string): ProcessorMatch | null {
  for (const rule of PROCESSORS) {
    const hostHit = rule.hosts?.includes(hostname) ?? false
    const domainHit = registrable ? rule.domains?.includes(registrable) ?? false : false
    if (!hostHit && !domainHit) continue
    if (rule.paths && !rule.paths.test(pathname)) continue
    let handle: string | undefined
    if (rule.handleFromPath) {
      const segs = pathname.split('/').filter(Boolean)
      const raw = rule.name === 'Venmo' || rule.name === 'Wise' ? segs[1] : segs[0]
      if (raw) {
        try {
          handle = decodeURIComponent(raw).replace(/^[$@]/, '').slice(0, 40)
        } catch {
          handle = raw.slice(0, 40)
        }
      }
    }
    return { name: rule.name, kind: rule.kind, handle, note: rule.note }
  }
  return null
}

/** Visual and Unicode confusables folded to their ASCII lookalikes. */
const CONFUSABLES: Record<string, string> = {
  а: 'a', е: 'e', о: 'o', р: 'p', с: 'c', у: 'y', х: 'x', і: 'i', ј: 'j', ѕ: 's', ԁ: 'd', һ: 'h', ӏ: 'l', ԛ: 'q', ԝ: 'w',
  ο: 'o', α: 'a', ν: 'v', ρ: 'p', τ: 't', κ: 'k', ι: 'i', ɡ: 'g', ı: 'i', ł: 'l', ø: 'o', ö: 'o', ó: 'o', ò: 'o',
  á: 'a', à: 'a', ä: 'a', â: 'a', é: 'e', è: 'e', ë: 'e', ê: 'e', í: 'i', ì: 'i', ï: 'i', ú: 'u', ù: 'u', ü: 'u',
  ç: 'c', ñ: 'n', ß: 'ss',
}

export function foldConfusables(s: string): string {
  return [...s.toLowerCase()].map((ch) => CONFUSABLES[ch] ?? ch).join('')
}

/** Digit/letter swaps used in typosquats: paypa1, amaz0n, rnonzo. */
export function foldTyposquat(s: string): string {
  return foldConfusables(s)
    .replace(/0/g, 'o')
    .replace(/1/g, 'l')
    .replace(/3/g, 'e')
    .replace(/5/g, 's')
    .replace(/rn/g, 'm')
    .replace(/vv/g, 'w')
}

/** Optimal string alignment distance (Damerau–Levenshtein with adjacent swaps). */
export function editDistance(a: string, b: string): number {
  const d: number[][] = Array.from({ length: a.length + 1 }, (_, i) => [i, ...Array(b.length).fill(0)])
  for (let j = 1; j <= b.length; j++) d[0][j] = j
  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1
      d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + cost)
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) {
        d[i][j] = Math.min(d[i][j], d[i - 2][j - 2] + 1)
      }
    }
  }
  return d[a.length][b.length]
}

const CC_TLDS: Record<string, string> = {
  uk: 'the United Kingdom', ie: 'Ireland', fr: 'France', de: 'Germany', es: 'Spain', it: 'Italy', nl: 'the Netherlands',
  be: 'Belgium', pt: 'Portugal', se: 'Sweden', dk: 'Denmark', no: 'Norway', fi: 'Finland', pl: 'Poland', ch: 'Switzerland',
  at: 'Austria', us: 'the United States', ca: 'Canada', au: 'Australia', nz: 'New Zealand', in: 'India', jp: 'Japan',
  cn: 'China', ru: 'Russia', br: 'Brazil', mx: 'Mexico', za: 'South Africa', sg: 'Singapore', hk: 'Hong Kong',
}

export function countryForSuffix(suffix: string | null): string | null {
  if (!suffix) return null
  const last = suffix.split('.').pop() ?? ''
  return CC_TLDS[last] ?? null
}
