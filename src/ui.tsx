import { useEffect, useRef, type ReactNode } from 'react'
import { Check, CircleDashed, Info, Minus, TriangleAlert, X } from 'lucide-react'
import type { Assurance, ParsedUrl, Status } from './engine/types'
import { HIDDEN } from './lib/ingest'

export function Wordmark({ dark = false, size = 'md' }: { dark?: boolean; size?: 'md' | 'lg' }) {
  return (
    <span
      className={`inline-flex items-baseline font-extrabold tracking-[-0.045em] ${size === 'lg' ? 'text-3xl' : 'text-[22px]'} ${dark ? 'text-paper' : 'text-ink'}`}
      aria-label="beforepay"
    >
      beforepay
      <span
        aria-hidden
        className={`ml-[0.06em] inline-block size-[0.3em] translate-y-[-0.02em] rounded-full bg-lime ${dark ? '' : 'ring-[1.5px] ring-ink'}`}
      />
    </span>
  )
}

const ASSURANCE: Record<Assurance, { label: string; light: string; dark: string }> = {
  verified: { label: 'Verified', light: 'bg-ink text-lime', dark: 'bg-lime text-ink' },
  inferred: { label: 'Inferred', light: 'bg-amber-soft text-amber', dark: 'bg-amber-bright/15 text-amber-bright' },
  not_verified: { label: 'Not verified', light: 'border border-dashed border-mute/60 text-mute', dark: 'border border-dashed border-mute-dark/60 text-mute-dark' },
}

export function AssuranceChip({ value, dark = false }: { value: Assurance; dark?: boolean }) {
  const a = ASSURANCE[value]
  return (
    <span className={`inline-flex h-6 shrink-0 items-center rounded-full px-2.5 text-[12px] font-semibold tracking-[-0.01em] ${dark ? a.dark : a.light}`}>
      {a.label}
    </span>
  )
}

const STATUS: Record<Status, { icon: ReactNode; cls: string; label: string }> = {
  pass: { icon: <Check size={15} strokeWidth={3} />, cls: 'bg-lime text-ink', label: 'No issue found' },
  caution: { icon: <Minus size={15} strokeWidth={3} />, cls: 'bg-amber-soft text-amber', label: 'Worth a look' },
  fail: { icon: <X size={15} strokeWidth={3} />, cls: 'bg-red text-white', label: 'Warning' },
  not_checked: { icon: <CircleDashed size={15} strokeWidth={2.5} />, cls: 'border border-dashed border-mute/70 text-mute', label: 'Not checked' },
  info: { icon: <Info size={15} strokeWidth={2.5} />, cls: 'border border-line bg-paper-2 text-ink', label: 'For information' },
}

export function StatusDot({ status }: { status: Status }) {
  const s = STATUS[status]
  return (
    <span className={`grid size-7 shrink-0 place-items-center rounded-full ${s.cls}`} role="img" aria-label={s.label}>
      {s.icon}
    </span>
  )
}
export const statusLabel = (s: Status) => STATUS[s].label

/** The signature move: an address split into the parts that decide who you're dealing with. */
export function UrlAnatomy({ url, lit = 4, dark = false, compact = false }: { url: ParsedUrl; lit?: number; dark?: boolean; compact?: boolean }) {
  const reg = url.registrableDomain
  const host = url.displayHost
  const sub = reg && url.subdomain ? host.slice(0, host.length - reg.length - 1) : url.isIp ? '' : ''
  const regDisplay = reg ? host.slice(host.length - reg.length) : host
  const path = url.path === '/' ? '' : url.path
  const segs: { text: string; note: string; key: string; strong?: boolean; danger?: boolean }[] = [
    { key: 'scheme', text: url.protocol === 'https:' ? 'https://' : 'http://', note: url.protocol === 'https:' ? 'encrypted' : 'not encrypted', danger: url.protocol === 'http:' },
  ]
  if (url.hasCredentials) segs.push({ key: 'cred', text: `${url.credentialText}@`, note: 'decoy, ignored', danger: true })
  if (sub) segs.push({ key: 'sub', text: `${sub}.`, note: 'set by owner' })
  segs.push({ key: 'reg', text: regDisplay + (url.port ? `:${url.port}` : ''), note: url.isIp ? 'server number' : 'real owner', strong: true })
  if (path) segs.push({ key: 'path', text: path.length > 64 && compact ? path.slice(0, 62) + '…' : path, note: path.includes(HIDDEN) ? 'tokens hidden' : 'page' })

  const base = dark ? 'text-mute-dark' : 'text-mute'
  return (
    <div className="font-mono text-[15px] leading-tight sm:text-[17px]" aria-label={`Address: ${url.href}`}>
      <div className="flex flex-wrap items-start gap-y-3">
        {segs.map((s, i) => {
          const on = i < lit
          const strongCls = dark
            ? on ? 'bg-lime text-ink' : 'text-paper'
            : on ? 'bg-lime text-ink shadow-[inset_0_-2px_0_var(--color-ink)]' : 'text-ink'
          return (
            <span key={s.key} className="flex min-w-0 flex-col">
              <span
                className={`seg-lit rounded-[5px] px-[3px] py-[2px] break-all ${
                  s.strong ? `font-semibold ${strongCls}` : s.danger && on ? 'bg-red text-white' : on ? (dark ? 'text-paper' : 'text-ink') : base
                }`}
              >
                {s.text}
              </span>
              <span className={`mt-1.5 px-[3px] font-sans text-[11px] font-medium tracking-[0.01em] whitespace-nowrap transition-opacity duration-500 ${on ? 'opacity-100' : 'opacity-0'} ${s.danger ? (dark ? 'text-red-bright' : 'text-red') : s.strong ? (dark ? 'text-lime' : 'text-ink') : base}`}>
                {s.note}
              </span>
            </span>
          )
        })}
      </div>
    </div>
  )
}

export function Sheet({ open, onClose, title, children, dark = false }: { open: boolean; onClose: () => void; title: string; children: ReactNode; dark?: boolean }) {
  const dialog = useRef<HTMLDivElement>(null)
  const close = useRef(onClose)
  close.current = onClose
  useEffect(() => {
    if (!open) return
    const previous = document.activeElement as HTMLElement | null
    const overflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const frame = requestAnimationFrame(() => dialog.current?.querySelector<HTMLButtonElement>('button:not([aria-hidden="true"])')?.focus())
    const keys = (event: KeyboardEvent) => {
      if (event.key === 'Escape') { event.preventDefault(); close.current(); return }
      if (event.key !== 'Tab') return
      const items = [...(dialog.current?.querySelectorAll<HTMLElement>('button:not([disabled]):not([aria-hidden="true"]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), a[href], [tabindex="0"]') ?? [])].filter(el => el.getClientRects().length > 0 && !el.closest('details:not([open])'))
      const first = items[0]; const last = items[items.length - 1]
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus() }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus() }
    }
    document.addEventListener('keydown', keys)
    return () => { cancelAnimationFrame(frame); document.removeEventListener('keydown', keys); document.body.style.overflow = overflow; if (previous?.isConnected) previous.focus() }
  }, [open])
  if (!open) return null
  return (
    <div ref={dialog} className="fixed inset-0 z-50 flex items-end justify-center sm:items-center" role="dialog" aria-modal="true" aria-label={title}>
      <button className="absolute inset-0 bg-ink/55 backdrop-blur-[2px]" aria-label="Close" aria-hidden="true" tabIndex={-1} onClick={onClose} />
      <div
        className={`rise relative max-h-[92dvh] w-full overflow-y-auto rounded-t-[28px] sm:max-w-[560px] sm:rounded-[28px] ${dark ? 'on-dark bg-ink text-paper' : 'bg-paper text-ink'} safe-bottom px-5 pt-5 sm:px-8 sm:pt-7`}
      >
        <div className="mb-5 flex items-center justify-between gap-4">
          <h2 className="text-[22px] font-bold tracking-[-0.03em]">{title}</h2>
          <button onClick={onClose} className={`grid size-11 place-items-center rounded-full ${dark ? 'bg-ink-3 hover:bg-line-dark' : 'bg-paper-2 hover:bg-line'}`} aria-label="Close">
            <X size={20} />
          </button>
        </div>
        {children}
      </div>
    </div>
  )
}

export function Notice({ tone = 'neutral', children, icon }: { tone?: 'neutral' | 'warn' | 'error'; children: ReactNode; icon?: ReactNode }) {
  const cls = tone === 'error' ? 'bg-red-soft text-red' : tone === 'warn' ? 'bg-amber-soft text-amber' : 'bg-paper-2 text-ink'
  return (
    <div className={`flex gap-3 rounded-2xl px-4 py-3.5 text-[15px] leading-snug ${cls}`} role={tone === 'error' ? 'alert' : 'status'}>
      <span className="mt-0.5 shrink-0">{icon ?? <TriangleAlert size={18} />}</span>
      <div>{children}</div>
    </div>
  )
}
