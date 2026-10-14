import { describe, expect, it } from 'vitest'
import { analyze } from '../src/engine/analyze'
import { contextChecks } from '../src/engine/context'
import { screenshotLinks } from '../src/lib/ocr'
const none = { rdap: { status: 'unavailable' as const }, threat: { status: 'not_configured' as const } }

describe('Payment context without false assurances', () => {
  it('keeps an ordinary card purchase on a recognised provider clear', () => {
    const r = analyze(new URL('https://www.paypal.com/checkoutnow'), none, { source: 'paste', context: { method: 'card', amount: '£34' } })
    expect(r.verdict).toBe('clear')
    expect(r.criteria.find(c => c.id === 'context-amount')?.detail).toContain('not been independently')
  })
  it('explains pressure without declaring a genuine provider fraudulent', () => {
    const r = analyze(new URL('https://www.paypal.com/checkoutnow'), none, { source: 'paste', context: { channel: 'marketplace', message: 'URGENT! Pay outside Vinted now.' } })
    expect(r.verdict).toBe('unverified')
    expect(r.nextStep.title).toContain('marketplace')
    expect(r.criteria.some(c => c.id === 'context-off-platform')).toBe(true)
    expect(r.context?.message).toBeUndefined()
    expect(JSON.stringify(r)).not.toContain('URGENT!')
  })
  it('does not turn explicit advice against off-platform payments into a concern', () => {
    expect(contextChecks({ message: 'No rush. Do not pay outside Vinted. No pagues fuera de la plataforma.' }).signals).toHaveLength(0)
  })
  it('keeps strong address deception ahead of supplied card context', () => {
    const r = analyze(new URL('https://paypal.com@payments.example/pay'), none, { source: 'paste', context: { method: 'card' } })
    expect(r.verdict).toBe('warning')
  })
  it('does not silently repair OCR spelling and allows multiple candidates', () => {
    expect(screenshotLinks('https://paypa1.com/pay\nhttps://www.paypal.com/checkoutnow')).toEqual(['https://paypa1.com/pay', 'https://www.paypal.com/checkoutnow'])
    expect(screenshotLinks('No address is visible')).toEqual([])
  })
  it('does not claim local OCR inspected image wording or used AI', () => {
    const r = analyze(new URL('https://www.paypal.com/checkoutnow'), none, { source: 'screenshot', screenshot: { readingMethod: 'local_ocr', visibleMerchant: null, amount: null, provider: null, paymentUrl: null, suspicious: [], offPlatformRequest: false, summary: null } })
    expect(r.evidence.find(c => c.id === 'content')?.aiAssisted).toBe(false)
    expect(r.evidence.find(c => c.id === 'content')?.summary).toContain('not been analysed')
  })
})
