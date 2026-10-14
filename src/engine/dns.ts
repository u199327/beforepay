import { isPrivateAddress } from './analyze'
import type { DnsInfo } from './types'

interface DnsResponse { Status?: number; Answer?: { type: number; data: string }[] }

/** Only the hostname is sent to a fixed resolver. No payment page is fetched. */
export async function lookupDns(hostname: string): Promise<DnsInfo> {
  if (typeof navigator !== 'undefined' && !navigator.onLine) return { status: 'unavailable', reason: 'offline' }
  if (isPrivateAddress(hostname) || /^[\d.]+$/.test(hostname) || hostname.includes(':') || /\.(example|invalid|test|localhost)$/.test(hostname)) {
    return { status: 'skipped', reason: 'IP, private or reserved destination' }
  }
  const ctrl = new AbortController()
  const timer = setTimeout(() => ctrl.abort(), 4000)
  const source = { label: 'Cloudflare public DNS', url: 'https://developers.cloudflare.com/1.1.1.1/encryption/dns-over-https/make-api-requests/dns-json/' }
  try {
    const query = async (type: string) => {
      const response = await fetch(`https://cloudflare-dns.com/dns-query?name=${encodeURIComponent(hostname)}&type=${type}`, { headers: { accept: 'application/dns-json' }, signal: ctrl.signal, referrerPolicy: 'no-referrer' })
      if (!response.ok) throw new Error('resolver unavailable')
      return await response.json() as DnsResponse
    }
    const results = await Promise.all([query('A'), query('AAAA')])
    const addresses = results.flatMap(r => r.Answer ?? []).filter(a => (a.type === 1 || a.type === 28) && typeof a.data === 'string').map(a => a.data)
    if (addresses.length) return { status: 'resolved', addresses: [...new Set(addresses)].slice(0, 8), checkedAt: new Date().toISOString(), source }
    if (results.every(r => r.Status === 0 || r.Status === 3)) return { status: 'not_found', checkedAt: new Date().toISOString(), source }
    return { status: 'unavailable', reason: 'resolver could not complete the query', source }
  } catch {
    return { status: 'unavailable', reason: ctrl.signal.aborted ? 'timed out' : 'resolver did not respond', source }
  } finally { clearTimeout(timer) }
}
