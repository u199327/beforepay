import { describe, expect, it } from 'vitest'
import { analyze, checkBrands, parseTarget } from '../src/engine/analyze'
import { DEMOS } from '../src/engine/demos'
import { ingest, redactUrl } from '../src/lib/ingest'
import type { Externals } from '../src/engine/types'

const none: Externals = { rdap: { status: 'unavailable' }, threat: { status: 'not_configured' } }
const run = (u: string, ext: Externals = none, expected?: string) => {
  const r = ingest(u)
  if (!r.ok) throw new Error(`ingest failed: ${r.error}`)
  return analyze(r.url, ext, { source: 'paste', expected })
}
const brandOf = (u: string) => {
  const r = ingest(u)
  if (!r.ok) throw new Error('bad')
  return checkBrands(parseTarget(r.url))
}

describe('ingest', () => {
  it('extracts a link from a WhatsApp-style message', () => {
    const r = ingest('Hi! pay here pls (https://shop.example.co.uk/pay?id=4).')
    expect(r.ok && r.url.href).toBe('https://shop.example.co.uk/pay?id=4')
  })
  it('adds https to bare domains', () => {
    const r = ingest('www.northfield.co.uk/checkout')
    expect(r.ok && r.url.hostname).toBe('www.northfield.co.uk')
  })
  it('rejects unsafe schemes and junk', () => {
    expect(ingest('javascript:alert(1)')).toMatchObject({ ok: false, error: 'unsupported_scheme' })
    expect(ingest('hello there')).toMatchObject({ ok: false, error: 'not_a_link' })
    expect(ingest('')).toMatchObject({ ok: false, error: 'empty' })
  })
  it('recognises crypto and UPI payment URIs', () => {
    const r = ingest('upi://pay?pa=shop@okbank&pn=Corner%20Shop')
    expect(r).toMatchObject({ ok: false, error: 'payment_uri', paymentUri: { recipient: 'shop@okbank', crypto: false } })
  })
  it('redacts session tokens and emails', () => {
    const red = redactUrl(new URL('https://checkout.stripe.com/c/pay/cs_live_a1b2c3d4e5f6g7h8i9#frag?x=1'))
    expect(red.href).not.toContain('cs_live')
    expect(red.count).toBe(2)
    const q = redactUrl(new URL('https://x.com/p?session_id=abc&email=a@b.com&item=sofa'))
    expect(q.href).toContain('item=sofa')
    expect(q.href).not.toContain('a@b.com')
  })
})

describe('brand impersonation', () => {
  it('does not flag official domains', () => {
    expect(brandOf('https://www.paypal.com/checkoutnow').official?.name).toBe('PayPal')
    expect(brandOf('https://www.gov.uk/vehicle-tax').impersonation).toBeNull()
  })
  it('flags brand names in unrelated domains', () => {
    expect(brandOf('https://paypal-secure-login.com').impersonation?.brand.name).toBe('PayPal')
    expect(brandOf('https://royalmail-redelivery.info/fee').impersonation?.brand.name).toBe('Royal Mail')
  })
  it('flags lookalikes, ending swaps and subdomain tricks', () => {
    expect(brandOf('https://paypa1.com').impersonation?.how).toBe('lookalike')
    expect(brandOf('https://paypal.co').impersonation?.how).toBe('tld-swap')
    expect(brandOf('https://paypal.com.account-check.net').impersonation?.how).toBe('subdomain-trick')
  })
  it('does not flag ordinary words that contain brand names', () => {
    expect(brandOf('https://pineapple-bakery.co.uk').impersonation).toBeNull()
    expect(brandOf('https://amazonia-tours.com').impersonation).toBeNull()
    expect(brandOf('https://otherwise-shop.com').impersonation).toBeNull()
    expect(brandOf('https://stripes-fashion.com').impersonation).toBeNull()
  })
})

describe('verdicts', () => {
  it('never says clear without corroborating evidence', () => {
    expect(run('https://some-small-shop.com/checkout').verdict).toBe('unverified')
  })
  it('warns on credential tricks and IPs', () => {
    expect(run('https://paypal.com@203.0.113.9/pay').verdict).toBe('warning')
    expect(run('http://192.168.1.4/pay').verdict).toBe('warning')
  })
  it('recognises a hosted Stripe checkout without inventing the recipient', () => {
    const r = run('https://buy.stripe.com/test_abc123')
    expect(r.fields.find((f) => f.key === 'processor')?.value).toBe('Stripe')
    expect(r.chain.find((n) => n.role === 'recipient')?.value).toBeNull()
    expect(r.fields.find((f) => f.key === 'legal')?.value).toBeNull()
  })
  it('flags paypal.me as a personal payment', () => {
    const r = run('https://paypal.me/sofaseller99/340')
    expect(r.verdict).toBe('unverified')
    expect(r.fields.find((f) => f.key === 'merchant')?.value).toBe('@sofaseller99')
  })
  it('reports missing threat intelligence as not checked', () => {
    expect(run('https://example-shop.com').evidence.find((e) => e.id === 'reputation')?.status).toBe('not_checked')
  })
  it('warns when the expected brand does not match', () => {
    expect(run('https://parcel-help.net/pay', none, 'Royal Mail').verdict).toBe('warning')
  })
})

describe('demo scenarios', () => {
  const now = new Date('2026-10-13T12:00:00Z')
  const runDemo = (id: string) => {
    const d = DEMOS.find((x) => x.id === id)!
    return analyze(new URL(d.url), d.externals(now), { source: 'demo', expected: d.expected, screenshot: d.screenshot, extraBrands: d.extraBrands, simulation: d.simulation, now })
  }
  it('A: ordinary checkout → no known threats', () => expect(runDemo('ordinary').verdict).toBe('clear'))
  it('B: fake marketplace → warning', () => {
    const r = runDemo('marketplace')
    expect(r.verdict).toBe('warning')
    expect(r.evidence.find((e) => e.id === 'impersonation')?.status).toBe('fail')
  })
  it('C: parking QR → identity not verified', () => {
    const r = runDemo('parking')
    expect(r.verdict).toBe('unverified')
    expect(r.evidence.find((e) => e.id === 'expected')?.status).toBe('caution')
  })
  it('never fills the recipient in any demo', () => {
    for (const d of DEMOS) expect(runDemo(d.id).chain.find((n) => n.role === 'recipient')?.value).toBeNull()
  })
})
