import { Download, ExternalLink } from 'lucide-react'
import type { Report, Status } from './engine/types'
import { StatusDot } from './ui'

const LABELS: Record<Status, string> = { fail: 'Warning', caution: 'Caution', pass: 'No issue found', info: 'Context', not_checked: 'Not checked' }
const STYLES: Record<Status, string> = { fail: 'bg-red-soft text-red', caution: 'bg-amber-soft text-amber', pass: 'bg-paper-2 text-ink', info: 'bg-paper-2 text-mute', not_checked: 'bg-paper-2 text-mute' }

function downloadReport(report: Report) {
  const { screenshot: _screenshot, ...safe } = report
  const blob = new Blob([JSON.stringify(safe, null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = `beforepay-${report.id}.json`
  link.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

export function AnalysisPanel({ report }: { report: Report }) {
  const warnings = report.criteria.filter(c => c.status === 'fail').length
  const cautions = report.criteria.filter(c => c.status === 'caution').length
  const unavailable = report.criteria.filter(c => c.status === 'not_checked').length
  const host = report.url.hostname
  const domain = report.url.isIp || /\.(local|internal|example|invalid|test)$/.test(host) || host === 'localhost' ? null : report.url.registrableDomain ?? host
  return <section className="mt-7" aria-labelledby="analysis-title">
    <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
      <div><h2 id="analysis-title" className="text-[25px] font-bold tracking-[-0.03em]">Checks and evidence</h2><p className="mt-1 text-[14px] leading-relaxed text-mute">{warnings} warning{warnings === 1 ? '' : 's'} · {cautions} caution{cautions === 1 ? '' : 's'} · {unavailable} not checked. These are findings, not a safety score.</p></div>
      <button onClick={() => downloadReport(report)} className="inline-flex min-h-11 items-center gap-2 rounded-full border border-line bg-card px-4 text-[14px] font-semibold hover:border-ink"><Download size={16} /> Export report</button>
    </div>
    <ul className="evidence-grid grid min-w-0 items-stretch gap-5 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4" aria-label="Interpretable criteria">
      {report.criteria.map(c => <li key={c.id} className="flex h-full min-w-0 flex-col rounded-2xl border border-line bg-card p-5">
        <div className="flex items-start justify-between gap-3"><h3 className="min-w-0 text-[17px] leading-snug font-bold">{c.title}</h3><StatusDot status={c.status} /></div>
        <p className={`mt-3 self-start rounded-lg px-2.5 py-1 text-[13px] font-semibold ${STYLES[c.status]}`}>{LABELS[c.status]}</p>
        <p className="mt-3 break-words text-[15px] leading-relaxed">{c.summary}</p>
        <p className="mt-3 break-words text-[13px] leading-relaxed text-mute">{c.detail}</p>
        <p className="mt-auto break-words border-t border-line pt-3 text-[12px] leading-relaxed text-mute"><span className="font-semibold">{c.basis}</span>{c.source && <> · {c.source.url ? <a href={c.source.url} target="_blank" rel="noopener noreferrer" className="underline underline-offset-3">{c.source.label}</a> : c.source.label}</>}</p>
      </li>)}
    </ul>
    <div className="mt-5 grid min-w-0 gap-5 md:grid-cols-2">
      <section className="rounded-2xl border border-line bg-paper-2 p-5" aria-labelledby="method-title"><h3 id="method-title" className="text-[17px] font-bold">How to read this result</h3><p className="mt-2 text-[14px] leading-relaxed">Address deception and known threat listings trigger warnings. Similar names, personal payments and missing identity evidence call for further checks. HTTPS, domain age and a name match cannot verify who receives the money.</p><p className="mt-2 text-[13px] leading-relaxed text-mute">The payment page is never opened. These checks come from one rule engine; they are not independent scanner votes.</p></section>
      <section className="flex flex-col rounded-2xl border border-line bg-paper-2 p-5" aria-labelledby="record-title"><h3 id="record-title" className="text-[17px] font-bold">Check record</h3><p className="mt-2 break-words text-[14px] leading-relaxed">{new Date(report.checkedAt).toLocaleString('en-GB')} · Rules v{report.engineVersion}</p><p className="mt-2 text-[13px] leading-relaxed text-mute">{report.url.redactions} sensitive field{report.url.redactions === 1 ? '' : 's'} hidden. Unavailable checks remain unchecked.</p>{domain && <a href={`https://www.virustotal.com/gui/domain/${encodeURIComponent(domain)}`} target="_blank" rel="noopener noreferrer" className="mt-3 inline-flex min-h-11 items-center gap-2 self-start text-[14px] font-semibold underline underline-offset-4">Open domain report in VirusTotal <ExternalLink size={15} /></a>}{domain && <p className="text-[12px] leading-relaxed text-mute">External report; no payment path or token is sent. Its results are not included here.</p>}</section>
    </div>
  </section>
}
