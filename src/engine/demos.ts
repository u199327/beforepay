import type { Brand, Externals, ScreenshotFindings, Simulation } from './types'

/**
 * Fictional, deterministic demonstration scenarios. The address checks run for
 * real through the same engine; registry, threat and message content are
 * fixtures, labelled as simulated everywhere they surface.
 */
export interface DemoScenario {
  id: 'ordinary' | 'marketplace' | 'parking' | 'paypal' | 'paypal-official' | 'paypal-personal'
  label: string
  title: string
  blurb: string
  url: string
  expected: string
  source: 'demo'
  extraBrands?: Brand[]
  screenshot?: ScreenshotFindings
  externals: (now: Date) => Externals
  simulation: Simulation
}

const daysAgo = (now: Date, d: number) => new Date(now.getTime() - d * 86_400_000).toISOString()
const simulatedRdap = (registered: string, registrar: string) => ({
  status: 'ok' as const,
  registered,
  registrar,
  registrantHidden: true,
  source: { label: 'Domain registry (RDAP) — simulated' },
})

export const DEMOS: DemoScenario[] = [
  {
    id: 'paypal-official', label: 'Official address', title: 'PayPal checkout',
    blurb: 'A recognised PayPal domain. The receiving merchant is still unknown.',
    url: 'https://www.paypal.com/checkoutnow', expected: 'PayPal', source: 'demo',
    externals: () => ({ rdap: { status: 'unavailable', reason: 'external lookups are not run in this offline example' }, threat: { status: 'not_configured' } }),
    simulation: { id: 'paypal-official', title: 'PayPal checkout', premise: 'This address matches the PayPal reference domain. It does not verify a specific merchant or receiving account.', note: 'Address rules run for real. No payment is opened; external lookup results are not fabricated.' },
  },
  {
    id: 'paypal-personal', label: 'Personal payment', title: 'PayPal.Me recipient unknown',
    blurb: 'A personal payment handle does not prove who receives your money.',
    url: 'https://paypal.me/sofaseller/340', expected: 'PayPal', source: 'demo',
    externals: () => ({ rdap: { status: 'unavailable', reason: 'external lookups are not run in this offline example' }, threat: { status: 'not_configured' } }),
    simulation: { id: 'paypal-personal', title: 'Personal PayPal payment', premise: 'An illustrative handle on PayPal.Me. The account holder and buyer protection are not verified.', note: 'Address rules run for real. No payment is opened; external lookup results are not fabricated.' },
  },
  {
    id: 'paypal',
    label: 'PayPal example',
    title: 'PayPal hidden-destination trick',
    blurb: 'It looks like PayPal, but the text before @ is not the destination.',
    url: 'https://paypal.com@payments.example/pay',
    expected: 'PayPal',
    source: 'demo',
    externals: () => ({
      rdap: { status: 'unavailable', reason: 'reserved example domain; no live registry lookup in this simulation' },
      threat: { status: 'not_configured' },
    }),
    simulation: {
      id: 'paypal',
      title: 'PayPal hidden-destination trick',
      premise: 'A sender gives you a link that starts with paypal.com. The browser actually goes to payments.example, after the @ sign.',
      note: 'Illustrative address on a reserved example domain. Address checks run for real; no registry or threat results are fabricated.',
    },
  },
  {
    id: 'ordinary',
    label: 'Example A',
    title: 'Ordinary checkout',
    blurb: 'A coffee subscription paid through a hosted card checkout.',
    url: 'https://checkout.stripe.com/c/pay/cs_live_b1NorthfieldRoastersDemo0x9QwErTy#fidkdWxOYHwnPyd1blpxYHZxWjA0',
    expected: 'Northfield Coffee Roasters',
    source: 'demo',
    screenshot: {
      visibleMerchant: 'Northfield Coffee Roasters',
      amount: '£24.50 per month',
      paymentUrl: null,
      provider: 'Stripe',
      suspicious: [],
      offPlatformRequest: false,
      summary: 'A standard subscription checkout page with the merchant name and price at the top.',
      simulated: true,
    },
    externals: (now) => ({
      rdap: simulatedRdap(daysAgo(now, 365 * 30 + 40), 'Simulated Registrar Inc.'),
      threat: { status: 'clean', source: { label: 'Threat database — simulated' } },
      simulated: true,
    }),
    simulation: {
      id: 'ordinary',
      title: 'Ordinary checkout',
      premise: 'You are subscribing to beans from Northfield Coffee Roasters, a fictional shop. Its checkout button sent you to this card payment page.',
      note: 'Fictional merchant. Registry and threat results are simulated; the address checks ran for real on this device.',
    },
  },
  {
    id: 'marketplace',
    label: 'Example B',
    title: 'Fake marketplace payment',
    blurb: 'A seller sends a "buyer protection" link for a sofa.',
    url: 'https://marketfold-buyerprotection.com/secure/pay?listing=88412&amount=340',
    expected: 'Marketfold',
    source: 'demo',
    extraBrands: [{ name: 'Marketfold', tokens: ['marketfold'], official: ['marketfold.com'], distinctive: true, fictional: true }],
    screenshot: {
      visibleMerchant: 'Marketfold Buyer Protection',
      amount: '£340.00',
      paymentUrl: null,
      provider: null,
      suspicious: [
        'Seller says: "Pay through this link to keep Marketfold buyer protection" — Marketfold payments happen inside the app.',
        'Urgency: "Two other buyers are waiting, pay in the next 15 minutes."',
      ],
      offPlatformRequest: true,
      summary: 'A chat message from a seller asking the buyer to leave the marketplace chat and pay through an external link.',
      simulated: true,
    },
    externals: (now) => ({
      rdap: simulatedRdap(daysAgo(now, 4), 'Simulated Registrar Inc.'),
      threat: { status: 'clean', source: { label: 'Threat database — simulated' } },
      simulated: true,
    }),
    simulation: {
      id: 'marketplace',
      title: 'Fake marketplace payment',
      premise: 'You found a sofa on Marketfold, a fictional marketplace. The seller messaged you this link and said paying here keeps you protected.',
      note: 'Fictional marketplace (official domain marketfold.com). Registry, threat and message content are simulated.',
    },
  },
  {
    id: 'parking',
    label: 'Example C',
    title: 'QR payment substitution',
    blurb: 'A QR sticker on a parking meter points somewhere unexpected.',
    url: 'https://pay-parkzone.online/m/4471',
    expected: 'Kerbway Parking',
    source: 'demo',
    externals: (now) => ({
      rdap: simulatedRdap(daysAgo(now, 214), 'Simulated Registrar Inc.'),
      threat: { status: 'clean', source: { label: 'Threat database — simulated' } },
      simulated: true,
    }),
    simulation: {
      id: 'parking',
      title: 'QR payment substitution',
      premise: 'The sign on a fictional Kerbway Parking meter says "Scan to pay". You scanned the QR code on it.',
      note: 'Fictional parking operator. Registry and threat results are simulated; the address checks ran for real.',
    },
  },
]
