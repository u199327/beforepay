import { useEffect, useState } from 'react'
import { ArrowLeft, ArrowRight, Check, CircleDashed, Copy, ExternalLink, FlaskConical, OctagonAlert, RotateCcw, SearchCheck, CircleHelp, Sparkles } from 'lucide-react'
import type { EvidenceRow, ParsedUrl, Report } from './engine/types'
import { AssuranceChip, StatusDot, UrlAnatomy, Wordmark, statusLabel } from './ui'

export const STEPS = [
  'Reading the address',
  'Checking who registered the domain',
  'Looking for brand impersonation',
  'Checking threat databases',
  'Building the merchant card',
]

export function Analyzing({ url, step, threatConfigured }: { url: ParsedUrl; step: number; threatConfigured: boolean }) {
  return (
    <section className="safe-x mx-auto flex min-h-[78dvh] max-w-[880px] flex-col justify-center py-12" aria-live="polite" aria-busy="true">
      <p className="mb-6 text-[15px] font-medium text-mute">Checking — we never open the page itself</p>
      <div className="relative overflow-hidden rounded-[24px] border border-line bg-card px-5 py-6 sm:px-8 sm:py-8">
        <div className="scan-sweep pointer-events-none absolute inset-0" aria-hidden />
        <UrlAnatomy url={url} lit={Math.min(5, step + 1)} compact />
      </div>
      <ol className="mt-8 grid gap-1">
        {STEPS.map((s, i) => {
          const done = i < step
          const active = i === step
          const label = i === 3 && !threatConfigured ? 'Threat databases — not configured, skipping' : s
          return (
            <li key={s} className={`flex items-center gap-4 rounded-2xl px-2 py-2.5 text-[17px] transition-colors duration-500 ${done || active ? 'text-ink' : 'text-mute/70'}`}>
              <span className={`grid size-7 place-items-center rounded-full transition-colors duration-500 ${done ? 'bg-ink text-lime' : active ? 'bg-lime text-ink' : 'border border-line'}`}>
                {done ? <Check size={15} strokeWidth={3} /> : active ? <span className="pulse-dot size-2 rounded-full bg-ink" /> : null}
              </span>
              <span className={active ? 'font-semibold' : ''}>{label}</span>
            </li>
          )
        })}
      </ol>
    </section>
  )
}

const VERDICT = {
  clear: { band: 'bg-lime text-ink', icon: SearchCheck, sub: 'text-ink/75' },
  unverified: { band: 'bg-amber-soft text-ink', icon: CircleHelp, sub: 'text-ink/75' },
  warning: { band: 'bg-red text-white on-dark', icon: OctagonAlert, sub: 'text-white/85' },
} as const

interface ReportProps {
  report: Report
  onBack: () => void
  onExpected: (name: string) => void
  onShare: () => void
  rechecking: boolean
}

export function ReportView({ report, onBack, onExpected, onShare, rechecking }: ReportProps) {
  const v = VERDICT[report.verdict]
  const Icon = v.icon
  const [expected, setExpected] = useState(report.expected ?? '')
  useEffect(() => setExpected(report.expected ?? ''), [report.expected])
  const checked = new Date(report.checkedAt)

  return (
    <div className="pb-24">
      <div className="safe-x mx-auto flex max-w-[1240px] items-center justify-between py-5">
        <button onClick={onBack} className="-ml-2 inline-flex h-11 items-center gap-2 rounded-full px-3 text-[15px] font-semibold hover:bg-paper-2">
          <ArrowLeft size={18} /> New check
        </button>
        <Wordmark />
      </div>

      {report.simulation && (
        <div className="safe-x mx-auto mb-4 max-w-[1240px]">
          <div className="flex items-start gap-3 rounded-2xl border border-dashed border-ink/30 px-4 py-3 text-[14px] leading-snug">
            <FlaskConical size={18} className="mt-0.5 shrink-0" />
            <p>
              <strong className="font-semibold">Simulation · {report.simulation.title}.</strong> {report.simulation.premise}{' '}
              <span className="text-mute">{report.simulation.note}</span>
            </p>
          </div>
        </div>
      )}

      <div className="safe-x mx-auto max-w-[1240px]">
        <section className={`rise overflow-hidden rounded-[28px] ${v.band}`} aria-labelledby="verdict">
          <div className="px-5 pt-6 pb-7 sm:px-10 sm:pt-9 sm:pb-10">
            <div className="flex items-center gap-3">
              <Icon size={30} strokeWidth={2.25} aria-hidden />
              <span className="text-[15px] font-semibold opacity-80">Result</span>
            </div>
            <h1 id="verdict" className="mt-3 text-[clamp(2.25rem,6vw,4.5rem)] leading-[0.98] font-extrabold tracking-[-0.045em] text-balance">
              {report.headline}
            </h1>
            <p className={`mt-4 max-w-[62ch] text-[18px] leading-snug sm:text-[20px] ${v.sub}`}>{report.explanation}</p>
          </div>
          <div className={`border-t px-5 py-5 sm:px-10 ${report.verdict === 'warning' ? 'border-white/20' : 'border-ink/12'}`}>
            <div className="flex items-start gap-3">
              <ArrowRight size={22} className="mt-1 shrink-0" />
              <div>
                <p className="text-[19px] font-bold tracking-[-0.02em]">{report.nextStep.title}</p>
                <p className={`mt-1 max-w-[64ch] text-[16px] leading-snug ${v.sub}`}>{report.nextStep.body}</p>
              </div>
            </div>
          </div>
        </section>

        <div className="mt-6 grid gap-6 lg:grid-cols-12">
          <div className="grid min-w-0 gap-6 lg:col-span-7">
            <IdentityCard report={report} checked={checked} />
            <WhyCard rows={report.evidence} />
          </div>
          <aside className="grid min-w-0 content-start gap-6 lg:col-span-5">
            <form
              className="rounded-[24px] border border-line bg-card p-5 sm:p-7"
              onSubmit={(e) => {
                e.preventDefault()
                onExpected(expected.trim())
              }}
            >
              <label htmlFor="expected" className="text-[20px] font-bold tracking-[-0.03em]">
                Who were you expecting to pay?
              </label>
              <p className="mt-1 text-[15px] text-mute">We'll check whether this destination is consistent with them.</p>
              <div className="mt-4 flex gap-2">
                <input
                  id="expected"
                  value={expected}
                  onChange={(e) => setExpected(e.target.value)}
                  placeholder="e.g. Royal Mail, Vinted, a shop name"
                  maxLength={80}
                  autoComplete="off"
                  className="h-12 min-w-0 flex-1 rounded-xl border border-line bg-paper px-3.5 text-[16px] outline-none placeholder:text-mute/80 focus:border-ink"
                />
                <button disabled={rechecking || !expected.trim()} className="h-12 shrink-0 rounded-xl bg-ink px-4 text-[15px] font-semibold text-paper disabled:opacity-40">
                  {rechecking ? 'Checking…' : 'Compare'}
                </button>
              </div>
            </form>

            <section className="rounded-[24px] border border-line bg-card p-5 sm:p-7">
              <h2 className="text-[20px] font-bold tracking-[-0.03em]">What we didn't check</h2>
              <ul className="mt-3 grid gap-2.5">
                {report.notChecked.map((n) => (
                  <li key={n} className="flex gap-3 text-[15px] leading-snug text-mute">
                    <CircleDashed size={18} className="mt-0.5 shrink-0" /> {n}
                  </li>
                ))}
              </ul>
            </section>

            <div className="flex flex-wrap gap-2">
              <button onClick={onShare} className="inline-flex h-12 items-center gap-2 rounded-full border border-line bg-card px-5 text-[15px] font-semibold hover:border-ink">
                <Copy size={17} /> Copy link to this check
              </button>
              <button onClick={onBack} className="inline-flex h-12 items-center gap-2 rounded-full px-5 text-[15px] font-semibold hover:bg-paper-2">
                <RotateCcw size={17} /> Check another
              </button>
            </div>
            <p className="text-[13px] leading-snug text-mute">
              BeforePay is an information tool, not financial advice. No result can guarantee a payment is safe. Nothing about this check is stored.
            </p>
          </aside>
        </div>
      </div>
    </div>
  )
}

function IdentityCard({ report, checked }: { report: Report; checked: Date }) {
  const site = report.url.registrableDomain ?? report.url.hostname
  const recipient = report.chain.find((c) => c.role === 'recipient')!
  return (
    <section className="on-dark rise overflow-hidden rounded-[28px] bg-ink text-paper" aria-labelledby="mic" style={{ animationDelay: '120ms' }}>
      <div className="px-5 pt-6 sm:px-9 sm:pt-8">
        <div className="flex items-center justify-between gap-3">
          <h2 id="mic" className="text-[15px] font-semibold text-mute-dark">Merchant Identity Card</h2>
          <span className="tnum text-[13px] text-mute-dark">
            {checked.toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
          </span>
        </div>
        <div className="mt-4 flex items-center gap-4">
          <span className="grid size-14 shrink-0 place-items-center rounded-2xl bg-lime text-[28px] font-extrabold text-ink uppercase">{site.replace(/^www\./, '')[0]}</span>
          <div className="min-w-0">
            <p className="truncate font-mono text-[22px] font-semibold tracking-[-0.02em] sm:text-[28px]">{site}</p>
            {report.expandedFrom && <p className="truncate text-[13px] text-mute-dark">Revealed from short link {report.expandedFrom}</p>}
          </div>
        </div>
        <div className="mt-6 rounded-2xl bg-ink-2 px-4 py-4">
          <UrlAnatomy url={report.url} dark compact />
        </div>
      </div>

      <div className="mt-7 px-5 sm:px-9">
        <h3 className="text-[15px] font-semibold text-mute-dark">Four different parties — don't assume they're the same</h3>
        <ol className="mt-3 grid gap-2 sm:grid-cols-4 sm:gap-0">
          {report.chain.map((n, i) => (
            <li key={n.role} className="relative flex sm:block">
              <div className={`flex-1 rounded-2xl border p-3.5 sm:mr-5 ${n.role === 'recipient' ? 'border-amber-bright/50 bg-amber-bright/8' : 'border-line-dark'}`}>
                <p className="text-[12px] font-semibold tracking-[0.01em] text-mute-dark">{n.label}</p>
                <p className={`mt-1 min-h-[1.4em] text-[16px] leading-tight font-semibold break-words ${n.value ? 'text-paper' : 'text-mute-dark'}`}>{n.value ?? 'Not verified'}</p>
                <div className="mt-2">
                  <AssuranceChip value={n.assurance} dark />
                </div>
              </div>
              {i < 3 && (
                <span aria-label="is not necessarily the same as" className="absolute top-1/2 -right-0.5 hidden -translate-y-1/2 text-[20px] font-bold text-lime sm:block">
                  ≠
                </span>
              )}
            </li>
          ))}
        </ol>
        <p className="mt-4 rounded-2xl bg-amber-bright/12 px-4 py-3 text-[16px] leading-snug">
          <strong className="font-bold text-amber-bright">Actual recipient: Not verified.</strong> <span className="text-paper/85">{recipient.note}</span>
        </p>
      </div>

      <dl className="mt-6 grid border-t border-line-dark sm:grid-cols-2">
        {report.fields.map((f) => (
          <div key={f.key} className="border-b border-line-dark px-5 py-4 sm:px-9 sm:odd:border-r">
            <div className="flex items-center justify-between gap-3">
              <dt className="text-[13px] font-semibold text-mute-dark">{f.label}</dt>
              <AssuranceChip value={f.assurance} dark />
            </div>
            <dd className={`mt-1.5 text-[17px] leading-tight font-semibold break-words ${f.value ? 'text-paper' : 'text-mute-dark'} ${f.mono && f.value ? 'font-mono text-[15px]' : ''}`}>
              {f.value ?? 'Not verified'}
            </dd>
            {f.note && <dd className="mt-1 text-[13px] leading-snug text-mute-dark">{f.note}</dd>}
            {f.source?.url && (
              <dd className="mt-1">
                <a href={f.source.url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-[13px] text-lime underline underline-offset-3">
                  {f.source.label} <ExternalLink size={12} />
                </a>
              </dd>
            )}
          </div>
        ))}
      </dl>
      {report.registry?.status === 'ok' && report.registry.matches && report.registry.matches.length > 0 && (
        <div className="border-b border-line-dark px-5 py-5 sm:px-9">
          <p className="text-[14px] font-semibold">Companies House — possible matches by name only</p>
          <p className="text-[13px] text-mute-dark">A company with a similar name existing does not prove it runs this website.</p>
          <ul className="mt-2 grid gap-1 text-[14px]">
            {report.registry.matches.map((m) => (
              <li key={m.number}>
                <a href={m.url} target="_blank" rel="noopener noreferrer" className="underline underline-offset-3">{m.name}</a> <span className="text-mute-dark">· {m.number} · {m.status}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
      <p className="px-5 py-5 text-[13px] leading-snug text-mute-dark sm:px-9">
        Fields appear only when evidence supports them. Website owner, merchant, payment processor and final recipient can be different parties.
      </p>
    </section>
  )
}

function WhyCard({ rows }: { rows: EvidenceRow[] }) {
  return (
    <section className="rounded-[28px] border border-line bg-card" aria-labelledby="why">
      <h2 id="why" className="px-5 pt-6 text-[24px] font-bold tracking-[-0.035em] sm:px-8 sm:pt-7">Why this result?</h2>
      <ul className="mt-3">
        {rows.map((r) => (
          <li key={r.id} className="border-t border-line first:border-t-0">
            <details className="group">
              <summary className="flex cursor-pointer items-start gap-4 px-5 py-4 hover:bg-paper/70 sm:px-8">
                <StatusDot status={r.status} />
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                    <span className="text-[17px] font-bold tracking-[-0.02em]">{r.title}</span>
                    <span className="text-[13px] font-medium text-mute">{statusLabel(r.status)}</span>
                    {r.simulated && <span className="rounded-full border border-dashed border-ink/40 px-2 py-0.5 text-[11px] font-semibold">Simulated</span>}
                    {r.aiAssisted && (
                      <span className="inline-flex items-center gap-1 rounded-full bg-paper-2 px-2 py-0.5 text-[11px] font-semibold">
                        <Sparkles size={11} /> AI-read
                      </span>
                    )}
                  </div>
                  <p className="mt-1 text-[15px] leading-snug text-ink/80">{r.summary}</p>
                </div>
                <span className="mt-1 shrink-0 text-[13px] font-semibold text-mute underline underline-offset-3 group-open:hidden">Details</span>
                <span className="mt-1 hidden shrink-0 text-[13px] font-semibold text-mute underline underline-offset-3 group-open:inline">Hide</span>
              </summary>
              <div className="px-5 pb-5 pl-16 sm:px-8 sm:pl-[76px]">
                {r.details.length > 0 && (
                  <ul className="grid gap-1 font-mono text-[13px] leading-relaxed text-ink/80">
                    {r.details.map((d) => (
                      <li key={d} className="break-words">{d}</li>
                    ))}
                  </ul>
                )}
                {r.sources.length > 0 && (
                  <p className="mt-3 text-[13px] text-mute">
                    Source:{' '}
                    {r.sources.map((s, i) => (
                      <span key={s.label}>
                        {i > 0 && ' · '}
                        {s.url ? (
                          <a href={s.url} target="_blank" rel="noopener noreferrer" className="underline underline-offset-3">{s.label}</a>
                        ) : (
                          s.label
                        )}
                      </span>
                    ))}
                  </p>
                )}
              </div>
            </details>
          </li>
        ))}
      </ul>
    </section>
  )
}
