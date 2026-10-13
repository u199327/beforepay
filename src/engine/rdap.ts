import type { RdapInfo } from './types'

interface RdapEntity { roles?: string[]; vcardArray?: [string, unknown[][]]; remarks?: { title?: string }[]; entities?: RdapEntity[] }
interface RdapDoc { events?: { eventAction: string; eventDate: string }[]; entities?: RdapEntity[] }

function vcardName(e: RdapEntity): string | undefined {
  const fn = e.vcardArray?.[1]?.find((p) => p[0] === 'fn')
  return typeof fn?.[3] === 'string' ? fn[3] : undefined
}

/** Reduce an RDAP domain response to the few facts BeforePay shows. Shared by browser and server. */
export function summariseRdap(raw: unknown): RdapInfo {
  const doc = raw as RdapDoc
  const ev = (a: string) => doc.events?.find((e) => e.eventAction === a)?.eventDate
  const registrar = doc.entities?.find((e) => e.roles?.includes('registrar'))
  const registrant = doc.entities?.find((e) => e.roles?.includes('registrant'))
  const registrantName = registrant ? vcardName(registrant) : undefined
  const hidden =
    !registrantName ||
    /redact|privacy|withheld|proxy|not disclosed|data protected/i.test(registrantName) ||
    Boolean(registrant?.remarks?.some((r) => /redact/i.test(r.title ?? '')))
  const registered = ev('registration')
  return {
    status: registered ? 'ok' : 'unavailable',
    registered,
    expires: ev('expiration'),
    registrar: registrar ? vcardName(registrar)?.slice(0, 80) : undefined,
    registrantHidden: hidden,
    reason: registered ? undefined : 'registry did not publish a registration date',
  }
}
