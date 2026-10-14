import { AnalysisPanel } from './AnalysisPanel'
import { useEffect, useState } from 'react'
import { ArrowLeft, ArrowRight, Check, CircleDashed, Copy, ExternalLink, FlaskConical, OctagonAlert, RotateCcw, SearchCheck, CircleHelp } from 'lucide-react'
import type { ParsedUrl, Report } from './engine/types'
import { AssuranceChip, UrlAnatomy, Wordmark } from './ui'

export const STEPS = [
  'Reading the address',
  'Checking who registered the domain',
  'Looking for brand impersonation',
  'Checking threat databases',
  'Building the merchant card',
]

export function Analyzing({ url, step, threatConfigured, onCancel }: { url: ParsedUrl; step: number; threatConfigured: boolean; onCancel: () => void }) {
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
      <button onClick={onCancel} className="mt-5 min-h-12 self-start rounded-xl px-4 text-[15px] font-semibold underline underline-offset-4">Cancel check</button>
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
    <main className="report-page pb-12">
      <header className="safe-x flex w-full items-center justify-between py-5">
        <button onClick={onBack} className="-ml-2 inline-flex min-h-11 items-center gap-2 rounded-full px-3 text-[15px] font-semibold hover:bg-paper-2"><ArrowLeft size={18} /> New check</button>
        <Wordmark />
      </header>
      <div className="safe-x w-full">
        {report.simulation && <div className="mb-5 flex items-start gap-3 rounded-xl border border-dashed border-ink/30 p-4 text-[14px] leading-relaxed"><FlaskConical size={18} className="mt-0.5 shrink-0" /><p><strong>Simulation · {report.simulation.title}.</strong> {report.simulation.premise} <span className="text-mute">{report.simulation.note}</span></p></div>}
        {report.simulation?.id.startsWith('paypal') ? <PayPalDemoAddress report={report} /> : <section className="mb-5 rounded-2xl border border-line bg-card p-5" aria-label="Payment link checked"><p className="text-[14px] font-semibold text-mute">Payment link checked</p><p className="mt-2 break-all font-mono text-[clamp(1rem,2vw,1.6rem)] leading-relaxed font-semibold">{report.url.href}</p></section>}
        <section className={`grid overflow-hidden rounded-2xl md:grid-cols-2 ${v.band}`} aria-labelledby="verdict">
          <div className="p-5 sm:p-7">
            <div className="flex items-center gap-3"><Icon size={26} aria-hidden /><span className="text-[15px] font-semibold">Result</span></div>
            <h1 id="verdict" className="mt-3 text-[clamp(2rem,3.5vw,3.25rem)] leading-tight font-extrabold tracking-[-0.03em] text-balance">{report.headline}</h1>
            <p className={`mt-3 max-w-[70ch] text-[17px] leading-relaxed ${v.sub}`}>{report.explanation}</p>
          </div>
          <div className={`flex flex-col justify-center border-t p-5 sm:p-7 md:border-t-0 md:border-l ${report.verdict === 'warning' ? 'border-white/20' : 'border-ink/15'}`}>
            <p className="flex items-center gap-2 text-[15px] font-semibold"><ArrowRight size={20} /> What to do next</p>
            <h2 className="mt-3 text-[24px] leading-snug font-bold tracking-[-0.02em]">{report.nextStep.title}</h2>
            <p className={`mt-2 max-w-[70ch] text-[16px] leading-relaxed ${v.sub}`}>{report.nextStep.body}</p>
          </div>
        </section>
        <QuickSummary report={report} expected={expected} onExpectedChange={setExpected} onExpected={onExpected} rechecking={rechecking} />
        <AnalysisPanel report={report} />
        <div className="mt-6"><IdentityCard report={report} checked={checked} /></div>
        <section className="mt-5 rounded-2xl border border-line bg-card p-5 sm:p-7" aria-labelledby="limits-title">
          <h2 id="limits-title" className="text-[22px] font-bold tracking-[-0.02em]">What we couldn't verify</h2>
          <ul className="mt-4 grid min-w-0 gap-4 md:grid-cols-2 xl:grid-cols-3">{report.notChecked.map(n => <li key={n} className="flex min-w-0 items-start gap-3 text-[15px] leading-relaxed text-mute"><CircleDashed size={18} className="mt-0.5 shrink-0" /><span>{n}</span></li>)}</ul>
        </section>
        <footer className="mt-5 flex flex-wrap items-center justify-between gap-4 border-t border-line pt-5">
          <div className="flex flex-wrap gap-2"><button onClick={onShare} className="inline-flex min-h-12 items-center gap-2 rounded-full border border-line bg-card px-4 text-[15px] font-semibold hover:border-ink"><Copy size={17} /> Share an address check</button><button onClick={onBack} className="inline-flex min-h-12 items-center gap-2 rounded-full px-4 text-[15px] font-semibold hover:bg-paper-2"><RotateCcw size={17} /> Check another</button></div>
          <p className="max-w-[65ch] text-[13px] leading-relaxed text-mute">No result guarantees a payment is safe. Shared links run a new check using a redacted address; payment context is excluded.</p>
        </footer>
      </div>
    </main>
  )
}

function QuickSummary({ report, expected, onExpectedChange, onExpected, rechecking }: { report: Report; expected: string; onExpectedChange: (value: string) => void; onExpected: (value: string) => void; rechecking: boolean }) {
  const processor = report.chain.find(c => c.role === 'processor')
  const recipient = report.chain.find(c => c.role === 'recipient')
  const items = [
    { title: 'Actual destination', value: report.url.hostname, note: processor?.value ? `Payment provider: ${processor.value}` : 'Payment provider not identified', mono: true },
    { title: 'Who receives the money?', value: recipient?.assurance === 'verified' ? recipient.value : 'Not verified', note: report.expected ? `Name to compare: ${report.expected}. Account ownership has not been verified.` : 'A recognised provider does not verify the person or shop being paid.' },
    { title: 'Amount to confirm', value: report.context?.amount || report.screenshot?.amount || 'Check in the official checkout', note: 'Final amount and currency have not been independently verified.' },
  ]
  return <section className="mt-5 grid min-w-0 items-stretch gap-5 md:grid-cols-2 xl:grid-cols-4" aria-label="Your payment at a glance">
    {items.map(item => <dl key={item.title} className="h-full min-w-0 rounded-2xl border border-line bg-card p-5"><dt className="text-[14px] font-semibold text-mute">{item.title}</dt><dd className={`mt-2 break-words text-[19px] leading-snug font-bold ${item.mono ? 'break-all font-mono text-[17px]' : ''}`}>{item.value}</dd><dd className="mt-2 text-[14px] leading-relaxed text-mute">{item.note}</dd></dl>)}
    <form className="flex h-full min-w-0 flex-col rounded-2xl border border-line bg-card p-5" onSubmit={e => { e.preventDefault(); onExpected(expected.trim()) }}><label htmlFor="expected" className="text-[14px] font-semibold text-mute">Who did you expect to pay?</label><p className="mt-2 text-[14px] leading-relaxed">Compare the name with this address. A match cannot verify account ownership.</p><div className="mt-auto flex gap-2 pt-3"><input id="expected" value={expected} onChange={e => onExpectedChange(e.target.value)} placeholder="Shop or person's name" maxLength={80} autoComplete="off" className="min-h-11 w-0 min-w-0 flex-1 rounded-xl border border-line bg-paper px-3 text-[15px] outline-none focus:border-ink" /><button disabled={rechecking || !expected.trim()} className="min-h-11 shrink-0 rounded-xl bg-ink px-3 text-[14px] font-semibold text-paper disabled:opacity-40">{rechecking ? 'Checking…' : 'Compare'}</button></div></form>
  </section>
}

function IdentityCard({ report, checked }: { report: Report; checked: Date }) {
  return <section className="on-dark overflow-hidden rounded-2xl bg-ink text-paper" aria-labelledby="mic">
    <header className="flex flex-wrap items-center justify-between gap-3 px-5 pt-6 sm:px-7"><h2 id="mic" className="text-[22px] font-bold">Who is behind the payment?</h2><p className="text-[13px] text-mute-dark">{checked.toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}</p></header>
    <div className="grid min-w-0 gap-4 px-5 py-5 sm:grid-cols-2 sm:px-7 lg:grid-cols-4">{report.chain.map(node => <div key={node.role} className="min-w-0"><p className="text-[13px] font-semibold text-mute-dark">{node.label}</p><p className="mt-1 break-words text-[18px] font-bold">{node.value ?? 'Not verified'}</p><div className="mt-2"><AssuranceChip value={node.assurance} dark /></div><p className="mt-2 text-[13px] leading-relaxed text-mute-dark">{node.note}</p></div>)}</div>
    <dl className="grid min-w-0 border-t border-line-dark sm:grid-cols-2 lg:grid-cols-4">{report.fields.map(f => <div key={f.key} className="min-w-0 border-b border-line-dark p-5 sm:p-6"><div className="flex flex-wrap items-center justify-between gap-2"><dt className="text-[13px] font-semibold text-mute-dark">{f.label}</dt><AssuranceChip value={f.assurance} dark /></div><dd className={`mt-2 break-words text-[16px] leading-relaxed font-semibold ${f.value ? 'text-paper' : 'text-mute-dark'} ${f.mono && f.value ? 'break-all font-mono text-[14px]' : ''}`}>{f.value ?? 'Not verified'}</dd>{f.note && <dd className="mt-1 text-[13px] leading-relaxed text-mute-dark">{f.note}</dd>}{f.source?.url && <dd className="mt-2"><a href={f.source.url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-[13px] text-lime underline underline-offset-3">{f.source.label}<ExternalLink size={12} /></a></dd>}</div>)}</dl>
    {report.registry?.status === 'ok' && <div className="px-5 py-5 sm:px-7"><h3 className="text-[15px] font-bold">Company register — possible name matches</h3><p className="mt-1 text-[13px] leading-relaxed text-mute-dark">A registered company with a similar name does not prove it controls this website or receives the payment.</p><ul className="mt-3 grid gap-2 sm:grid-cols-2">{report.registry.matches?.map(m => <li key={m.number} className="text-[14px]"><a href={m.url} target="_blank" rel="noopener noreferrer" className="underline underline-offset-3">{m.name}</a> · {m.number} · {m.status}</li>)}</ul>{!report.registry.matches?.length && <p className="mt-2 text-[14px] text-mute-dark">No name matches returned.</p>}</div>}
    <p className="px-5 py-4 text-[13px] leading-relaxed text-mute-dark sm:px-7">Website owner, merchant, processor and recipient can be different parties. A provider domain does not verify the merchant or the receiving account.</p>
  </section>
}

function PayPalDemoAddress({ report }: { report: Report }) {
  const disguised = report.simulation?.id === 'paypal'
  const personal = report.simulation?.id === 'paypal-personal'
  const reason = disguised
    ? 'The browser ignores the text before @. The actual destination is payments.example, not PayPal.'
    : personal
      ? 'paypal.me identifies the payment provider. sofaseller is only an account handle: the person receiving the money is not verified.'
      : 'www.paypal.com matches the official PayPal domain. The merchant and the account receiving the money are still not verified.'
  return (
    <section className="mb-5 rounded-2xl border border-line bg-card p-5 sm:p-8" aria-labelledby="demo-address-title">
      <h2 id="demo-address-title" className="text-[18px] font-bold">Payment link checked</h2>
      <p className="mt-4 break-all font-mono text-[clamp(1.4rem,3.3vw,2.5rem)] leading-relaxed font-semibold" aria-label={report.url.href}>
        <span className="text-mute">https://</span>
        {disguised && <mark className="rounded bg-red-soft px-1 text-red">paypal.com@</mark>}
        <mark className="rounded bg-lime px-1 text-ink">{report.url.hostname}</mark>
        {personal ? <><span>/</span><mark className="rounded bg-amber-soft px-1 text-amber">sofaseller</mark><span>/340</span></> : <span>{report.url.path}</span>}
      </p>
      <p className="mt-4 max-w-[75ch] text-[17px] leading-relaxed">{reason}</p>
    </section>
  )
}
