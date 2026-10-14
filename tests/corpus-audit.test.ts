import { describe, it, expect } from 'vitest'
import { analyze, checkBrands, parseTarget } from '../src/engine/analyze'
import { ingest } from '../src/lib/ingest'
import { OFFICIAL_URLS, DECEPTIVE_URLS, ORDINARY_URLS, AMBIGUOUS_URLS, NETWORK_URLS } from './audit-corpus'
import type { Externals } from '../src/engine/types'
const none: Externals = {rdap:{status:'unavailable'},threat:{status:'not_configured'}}
const run=(url:string, ext:Externals=none, expected?:string)=>{
 const r=ingest(url);if(!r.ok)throw new Error(r.error)
 return analyze(r.url,ext,{source:'paste',expected,now:new Date('2026-10-13T12:00:00Z')})
}
describe('broad address corpus: 114 distinct URLs',()=>{
 it.each(OFFICIAL_URLS)('reference domain is not treated as fraud: %s',url=>expect(run(url).verdict).not.toBe('warning'))
 it.each(DECEPTIVE_URLS)('strong deception remains visible: %s',url=>expect(run(url).verdict).toBe('warning'))
 it.each(ORDINARY_URLS)('ordinary words and resemblance are not proof of fraud: %s',url=>expect(run(url).verdict).not.toBe('warning'))
 it.each(AMBIGUOUS_URLS)('personal, platform, hidden and unverified destinations: %s',url=>expect(run(url).verdict).toBe('unverified'))
 it.each(NETWORK_URLS)('private and numeric destinations warn: %s',url=>expect(run(url).verdict).toBe('warning'))
})
describe('interpretation and identity boundaries',()=>{
 it('newness alone calls for caution',()=>{
  const r=run('https://independent-coffee-shop.com',{...none,rdap:{status:'ok',registered:'2026-10-10T00:00:00Z'}})
  expect(r.verdict).toBe('unverified')
  expect(r.criteria.find(c=>c.id==='registration')?.status).toBe('caution')
 })
 it('oldness and a clean feed do not establish merchant identity',()=>{
  for(const ext of [{...none,rdap:{status:'ok' as const,registered:'2000-01-01T00:00:00Z'}},{...none,threat:{status:'clean' as const}}])expect(run('https://unknown-merchant.com',ext).verdict).toBe('unverified')
 })
 it('unknown sellers on known platforms are not the platform',()=>{
  const r=run('https://my-shop.myshopify.com/checkouts/test')
  expect(r.chain.find(c=>c.role==='merchant')?.assurance).toBe('not_verified')
  expect(r.chain.find(c=>c.role==='website')?.value).toBe('Shopify')
  expect(r.verdict).toBe('unverified')
 })
 it('recognised provider does not prove or disprove the expected merchant',()=>{
  const r=run('https://buy.stripe.com/test_demo',none,'Vinted')
  expect(r.verdict).toBe('unverified')
  expect(r.criteria.find(c=>c.id==='merchant-match')?.status).toBe('caution')
  expect(r.chain.find(c=>c.role==='merchant')?.value).toBeNull()
 })
 it('exact expected brand mismatch still warns',()=>expect(run('https://parcel-help.net/pay',none,'Royal Mail').verdict).toBe('warning'))
 it('ordinary brand words can be independent merchant names',()=>expect(run('https://apple-pie-bakery.com',none,'Apple Pie Bakery').verdict).not.toBe('warning'))
 it('a raw name match is context rather than verification',()=>expect(run('https://northfield.co.uk',none,'Northfield').criteria.find(c=>c.id==='merchant-match')?.status).toBe('info'))
 it('generic expected words cannot match substrings',()=>expect(run('https://notacoffee-shop.com',none,'Coffee Shop').criteria.find(c=>c.id==='merchant-match')?.status).toBe('caution'))
 it('a privacy-hidden registrant does not imply fraud',()=>expect(run('https://unknown-merchant.com',{...none,rdap:{status:'ok',registered:'2000-01-01T00:00:00Z',registrantHidden:true}}).signals.some(s=>s.severity==='warning')).toBe(false))
 it.each(['not-a-date','2100-01-01T00:00:00Z'])('invalid registry dates are not evidence: %s',registered=>{
  const r=run('https://unknown-merchant.com',{...none,rdap:{status:'ok',registered}})
  expect(r.criteria.find(c=>c.id==='registration')?.status).toBe('not_checked')
  expect(r.fields.some(f=>f.value?.includes('Invalid Date'))).toBe(false)
 })
 it('DNS does not invent a threat listing',()=>{
  const r=run('https://unknown-merchant.com',{...none,dns:{status:'not_found'}})
  expect(r.verdict).toBe('unverified')
  expect(r.criteria.find(c=>c.id==='dns')?.status).toBe('caution')
  expect(r.criteria.find(c=>c.id==='threat-feed')?.status).toBe('not_checked')
 })
 it('DNS private addresses warn without visiting them',()=>expect(run('https://unknown-merchant.com',{...none,dns:{status:'resolved',addresses:['127.0.0.1']}}).verdict).toBe('warning'))
 it('a real threat listing overrides recognised domains',()=>expect(run('https://www.paypal.com/checkoutnow',{...none,threat:{status:'flagged',threats:['SOCIAL_ENGINEERING']}}).verdict).toBe('warning'))
 it('criteria are unique and unavailable feeds never pass',()=>{
  const r=run('https://unknown-merchant.com')
  expect(r.criteria).toHaveLength(12)
  expect(new Set(r.criteria.map(c=>c.id)).size).toBe(12)
  expect(r.criteria.filter(c=>c.status==='not_checked').map(c=>c.id)).toContain('recipient')
  expect(r.criteria.find(c=>c.id==='threat-feed')?.status).toBe('not_checked')
 })
 it('international names are not automatically fraud',()=>expect(checkBrands(parseTarget(new URL('https://bücher.de'))).impersonation).toBeNull())
})
describe('messy real input',()=>{
 it('does not silently pick one of multiple payment links',()=>expect(ingest('Pay https://paypal.com/pay or https://evil.example/pay')).toMatchObject({ok:false,error:'multiple_links'}))
 it('allows the same URL repeated in a message',()=>expect(ingest('https://paypal.com/pay https://paypal.com/pay').ok).toBe(true))
 it('preserves a bare-domain query',()=>{const r=ingest('shop.example.com?amount=20');expect(r.ok && r.url.search).toBe('?amount=20')})
 it('preserves international domain spellings',()=>{const r=ingest('pаypal.com/pay');expect(r.ok && r.url.hostname).toBe(new URL('https://pаypal.com').hostname)})
})
