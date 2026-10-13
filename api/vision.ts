import { env, json, rateLimited } from './_lib/http'

/**
 * Reads a payment screenshot with an OpenAI multimodal model.
 * The model only extracts what is visible; it never decides whether a payment is safe.
 * Images are processed in memory and never stored or logged.
 */

const MAX_DATA_URL = 4_500_000 // ~3.3 MB of image after base64
const DATA_URL = /^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/=]+$/

const SCHEMA = {
  name: 'payment_screenshot',
  strict: true,
  schema: {
    type: 'object',
    additionalProperties: false,
    required: ['visibleMerchant', 'amount', 'paymentUrl', 'provider', 'suspicious', 'offPlatformRequest', 'summary'],
    properties: {
      visibleMerchant: { type: ['string', 'null'], description: 'Business or person name shown as the payee, exactly as visible. null if none.' },
      amount: { type: ['string', 'null'], description: 'Payment amount with currency exactly as shown. null if none.' },
      paymentUrl: { type: ['string', 'null'], description: 'A web address visible in the image (address bar, message text or printed link). null if none is fully legible.' },
      provider: { type: ['string', 'null'], description: 'Payment provider name or logo clearly visible (e.g. Stripe, PayPal, Adyen). null if not visible.' },
      suspicious: {
        type: 'array',
        maxItems: 4,
        items: { type: 'string' },
        description: 'Short quotes or paraphrases of visible wording that pressures the payer, asks for unusual payment methods, or moves payment away from a platform. Empty if none.',
      },
      offPlatformRequest: { type: 'boolean', description: 'True only if visible text asks the payer to pay outside the platform/app they are using.' },
      summary: { type: ['string', 'null'], description: 'One plain-English sentence describing what the image shows. No safety verdict.' },
    },
  },
} as const

const INSTRUCTIONS = `You extract facts from a screenshot of a payment page, checkout, chat message or QR code that a consumer is about to pay.
Rules:
- Report ONLY what is clearly visible. Never guess, infer or complete missing details. Use null when unsure.
- Never output card numbers, CVV codes, bank account numbers, passwords, one-time codes, emails, phone numbers or home addresses. If any appear, ignore them.
- Do not say whether the payment is safe or a scam. Do not give advice.
- Keep every string short (under 160 characters).`

const SECRETS = [
  /\b(?:\d[ -]?){13,19}\b/g, // card-like numbers
  /\b\d{2}-\d{2}-\d{2}\b/g, // UK sort codes
  /\b[A-Z]{2}\d{2}[A-Z0-9]{11,30}\b/g, // IBAN
  /[^\s@]+@[^\s@]+\.[^\s@]+/g, // emails
]
function scrub(v: unknown): unknown {
  if (typeof v === 'string') return SECRETS.reduce((s, re) => s.replace(re, '[hidden]'), v).slice(0, 240)
  if (Array.isArray(v)) return v.slice(0, 4).map(scrub)
  return v
}

export async function POST(req: Request) {
  const key = env('OPENAI_API_KEY')
  if (!key) return json({ status: 'not_configured' }, 501)
  if (rateLimited(req, 10)) return json({ error: 'rate_limited' }, 429)
  const len = Number(req.headers.get('content-length') ?? 0)
  if (len > MAX_DATA_URL + 1000) return json({ error: 'image_too_large' }, 413)

  let image: string
  try {
    image = String(((await req.json()) as { image?: string }).image ?? '')
  } catch {
    return json({ error: 'invalid_body' }, 400)
  }
  if (image.length > MAX_DATA_URL) return json({ error: 'image_too_large' }, 413)
  if (!DATA_URL.test(image)) return json({ error: 'unsupported_image' }, 415)

  const ctrl = new AbortController()
  const timer = setTimeout(() => ctrl.abort(), 25_000)
  try {
    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      signal: ctrl.signal,
      headers: { authorization: `Bearer ${key}`, 'content-type': 'application/json' },
      body: JSON.stringify({
        model: env('OPENAI_MODEL') ?? 'gpt-5-mini',
        response_format: { type: 'json_schema', json_schema: SCHEMA },
        store: false,
        messages: [
          { role: 'system', content: INSTRUCTIONS },
          {
            role: 'user',
            content: [
              { type: 'text', text: 'Extract the visible payment facts from this image.' },
              { type: 'image_url', image_url: { url: image, detail: 'high' } },
            ],
          },
        ],
      }),
    })
    if (!res.ok) return json({ status: 'error', reason: `model returned ${res.status}` }, 502)
    const data = (await res.json()) as { choices?: { message?: { content?: string; refusal?: string } }[] }
    const content = data.choices?.[0]?.message?.content
    if (!content) return json({ status: 'error', reason: 'empty model response' }, 502)
    const parsed = JSON.parse(content) as Record<string, unknown>
    const clean = Object.fromEntries(Object.entries(parsed).map(([k, v]) => [k, scrub(v)]))
    return json({ status: 'ok', findings: clean, model: env('OPENAI_MODEL') ?? 'gpt-5-mini' })
  } catch (e) {
    return json({ status: 'error', reason: (e as Error).name === 'AbortError' ? 'timed out' : 'request failed' }, 502)
  } finally {
    clearTimeout(timer)
  }
}
