import { useCallback, useEffect, useRef, useState } from 'react'
import {
  ArrowRight, Bookmark, Camera, ClipboardPaste, Download, EyeOff, ImageUp, Link2, Lock, Play, ScanLine, Share, Smartphone, Sparkles, WifiOff,
} from 'lucide-react'
import { DEMOS, type DemoScenario } from './engine/demos'
import { capabilities, findDemo, readScreenshot, runCheck, runDemo, searchRegistry, type Capabilities } from './engine/client'
import { parseTarget } from './engine/analyze'
import type { InputSource, Report, ScreenshotFindings } from './engine/types'
import { INGEST_MESSAGES, ingest, shareableTarget, type PaymentUri } from './lib/ingest'
import { decodeFrame, decodeQrFromFile, toUploadDataUrl } from './qr'
import { Analyzing, ReportView, STEPS } from './Report'
import { Notice, Sheet, UrlAnatomy, Wordmark } from './ui'

type View =
  | { name: 'home' }
  | { name: 'confirm'; url: URL; source: InputSource; screenshot?: ScreenshotFindings }
  | { name: 'analyzing'; url: URL }
  | { name: 'report'; report: Report; raw: URL | null; demo?: DemoScenario }

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))
const reduced = () => typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches

interface InstallEvent extends Event {
  prompt: () => Promise<void>
}

export default function App() {
  const [view, setView] = useState<View>({ name: 'home' })
  const [step, setStep] = useState(0)
  const [caps, setCaps] = useState<Capabilities | null>(null)
  const [online, setOnline] = useState(typeof navigator === 'undefined' ? true : navigator.onLine)
  const [toast, setToast] = useState<string | null>(null)
  const [rechecking, setRechecking] = useState(false)
  const [installEvt, setInstallEvt] = useState<InstallEvent | null>(null)

  useEffect(() => {
    capabilities().then(setCaps)
    const on = () => setOnline(true)
    const off = () => setOnline(false)
    const inst = (e: Event) => {
      e.preventDefault()
      setInstallEvt(e as InstallEvent)
    }
    addEventListener('online', on)
    addEventListener('offline', off)
    addEventListener('beforeinstallprompt', inst)
    return () => {
      removeEventListener('online', on)
      removeEventListener('offline', off)
      removeEventListener('beforeinstallprompt', inst)
    }
  }, [])

  const flash = useCallback((msg: string) => {
    setToast(msg)
    setTimeout(() => setToast(null), 2600)
  }, [])

  const go = useCallback((path: string) => {
    try {
      history.pushState(null, '', path)
    } catch {
      /* sandboxed previews may block history */
    }
  }, [])

  const animateSteps = useCallback(async (work: Promise<unknown>) => {
    const per = reduced() ? 60 : 520
    for (let i = 0; i < STEPS.length; i++) {
      setStep(i)
      await sleep(per)
    }
    await work
    setStep(STEPS.length)
    await sleep(reduced() ? 0 : 260)
  }, [])

  const startCheck = useCallback(
    async (url: URL, source: InputSource, opts: { expected?: string; screenshot?: ScreenshotFindings } = {}) => {
      setView({ name: 'analyzing', url })
      scrollTo({ top: 0 })
      const work = runCheck(url, { source, expected: opts.expected, screenshot: opts.screenshot })
      await animateSteps(work)
      const report = await work
      const qs = new URLSearchParams({ url: shareableTarget(url) })
      if (opts.expected) qs.set('expect', opts.expected)
      try {
        history.replaceState(null, '', `${location.pathname.includes('/check') ? location.pathname : 'check'}?${qs}`)
      } catch {
        /* ignore */
      }
      setView({ name: 'report', report, raw: url })
      if (opts.expected && caps?.registry) {
        searchRegistry(opts.expected).then((registry) => setView((v) => (v.name === 'report' && v.report.id === report.id ? { ...v, report: { ...v.report, registry } } : v)))
      }
    },
    [animateSteps, caps],
  )

  const startDemo = useCallback(
    async (demo: DemoScenario) => {
      go(`check?demo=${demo.id}`)
      const url = new URL(demo.url)
      setView({ name: 'analyzing', url })
      scrollTo({ top: 0 })
      await animateSteps(Promise.resolve())
      setView({ name: 'report', report: runDemo(demo), raw: null, demo })
    },
    [animateSteps, go],
  )

  // Deep links: /check?url=…, /check?demo=…, /share-target?title&text&url
  useEffect(() => {
    const params = new URLSearchParams(location.search)
    const demo = findDemo(params.get('demo'))
    if (demo) {
      startDemo(demo)
      return
    }
    const shared = [params.get('url'), params.get('text'), params.get('title')].filter(Boolean).join(' ')
    if (!shared) return
    const r = ingest(shared)
    if (r.ok) {
      const source: InputSource = location.pathname.includes('share') ? 'share' : 'link'
      if (params.get('auto') === '1') startCheck(r.url, source, { expected: params.get('expect') ?? undefined })
      else setView({ name: 'confirm', url: r.url, source })
    } else flash(INGEST_MESSAGES[r.error])
    // run once on load
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    const onPop = () => setView({ name: 'home' })
    addEventListener('popstate', onPop)
    return () => removeEventListener('popstate', onPop)
  }, [])

  const home = () => {
    go(location.pathname.includes('/check') || location.pathname.includes('share') ? import.meta.env.BASE_URL : location.pathname)
    setView({ name: 'home' })
  }

  const recheckExpected = async (name: string) => {
    if (view.name !== 'report') return
    setRechecking(true)
    try {
      if (view.demo) {
        setView({ ...view, report: runDemo(view.demo, name || undefined) })
      } else if (view.raw) {
        const report = await runCheck(view.raw, { source: view.report.source, expected: name || undefined, screenshot: view.report.screenshot })
        setView({ ...view, report })
        if (name && caps?.registry) searchRegistry(name).then((registry) => setView((v) => (v.name === 'report' ? { ...v, report: { ...v.report, registry } } : v)))
      }
    } finally {
      setRechecking(false)
    }
  }

  const share = async () => {
    if (view.name !== 'report') return
    const base = `${location.origin}${location.pathname.replace(/(check|share-target)\/?$/, '')}`.replace(/\/?$/, '/')
    const link = view.demo ? `${base}check?demo=${view.demo.id}` : `${base}check?url=${encodeURIComponent(shareableTarget(view.raw!))}`
    try {
      await navigator.clipboard.writeText(link)
      flash('Link copied — session tokens removed')
    } catch {
      flash(link)
    }
  }

  return (
    <div className="min-h-dvh">
      {!online && (
        <div className="on-dark flex items-center justify-center gap-2 bg-ink px-4 py-2.5 text-center text-[14px] text-paper" role="status">
          <WifiOff size={16} className="text-lime" /> You're offline. Address checks still work; registry and threat lookups are paused.
        </div>
      )}
      {view.name === 'home' && <Home caps={caps} installEvt={installEvt} onCheck={startCheck} onDemo={startDemo} onConfirm={(url, source, screenshot) => setView({ name: 'confirm', url, source, screenshot })} flash={flash} />}
      {view.name === 'confirm' && <Confirm url={view.url} source={view.source} onCancel={home} onGo={(expected) => startCheck(view.url, view.source, { expected, screenshot: view.screenshot })} />}
      {view.name === 'analyzing' && <Analyzing url={parseTarget(view.url)} step={step} threatConfigured={Boolean(caps?.threat) || view.url.href.includes('stripe.com/c/pay/cs_live_b1North') || DEMOS.some((d) => d.url === view.url.href)} />}
      {view.name === 'report' && <ReportView report={view.report} onBack={home} onExpected={recheckExpected} onShare={share} rechecking={rechecking} />}
      {toast && (
        <div className="fixed inset-x-0 bottom-0 z-[60] flex justify-center p-4 safe-bottom" role="status">
          <div className="rise max-w-[92vw] rounded-full bg-ink px-5 py-3 text-[15px] font-medium break-all text-paper shadow-[0_10px_30px_-10px_rgb(16_24_32/0.5)]">{toast}</div>
        </div>
      )}
    </div>
  )
}

/* ------------------------------------------------------------------ */

function Confirm({ url, source, onCancel, onGo }: { url: URL; source: InputSource; onCancel: () => void; onGo: (expected?: string) => void }) {
  const p = parseTarget(url)
  const [expected, setExpected] = useState('')
  const from = { share: 'Shared to BeforePay', link: 'Opened from a BeforePay link', qr: 'Read from a QR code', screenshot: 'Found in your screenshot', paste: 'Pasted', demo: 'Simulation' }[source]
  return (
    <div>
      <Header />
      <section className="safe-x mx-auto max-w-[760px] py-10 sm:py-16">
        <p className="text-[15px] font-semibold text-mute">{from}</p>
        <h1 className="mt-2 text-[clamp(2.2rem,6vw,3.8rem)] leading-[1] font-extrabold tracking-[-0.045em]">Check this payment?</h1>
        <div className="mt-7 rounded-[24px] border border-line bg-card px-5 py-6 sm:px-7">
          <p className="mb-4 text-[14px] font-semibold text-mute">Recognised destination</p>
          <UrlAnatomy url={p} compact />
          <p className="mt-5 flex items-center gap-2 text-[14px] text-mute">
            <Lock size={15} /> We won't open this page or start any payment.
          </p>
        </div>
        <form
          className="mt-6"
          onSubmit={(e) => {
            e.preventDefault()
            onGo(expected.trim() || undefined)
          }}
        >
          <label htmlFor="cexp" className="text-[16px] font-semibold">
            Who are you expecting to pay? <span className="font-normal text-mute">Optional</span>
          </label>
          <input id="cexp" value={expected} onChange={(e) => setExpected(e.target.value)} maxLength={80} placeholder="e.g. the parking operator on the sign" className="mt-2 h-14 w-full rounded-2xl border border-line bg-card px-4 text-[17px] outline-none focus:border-ink" />
          <div className="mt-6 flex flex-col gap-3 sm:flex-row">
            <button autoFocus className="inline-flex h-14 items-center justify-center gap-2 rounded-2xl bg-ink px-7 text-[17px] font-semibold text-paper hover:bg-ink-3">
              Check payment <ArrowRight size={19} />
            </button>
            <button type="button" onClick={onCancel} className="h-14 rounded-2xl px-6 text-[16px] font-semibold hover:bg-paper-2">
              Cancel
            </button>
          </div>
        </form>
      </section>
    </div>
  )
}

function Header({ right }: { right?: React.ReactNode }) {
  return (
    <header className="safe-x mx-auto flex max-w-[1240px] items-center justify-between py-5">
      <a href="./" aria-label="BeforePay home" className="rounded-lg">
        <Wordmark />
      </a>
      {right}
    </header>
  )
}

/* ------------------------------------------------------------------ */

interface HomeProps {
  caps: Capabilities | null
  installEvt: InstallEvent | null
  onCheck: (url: URL, source: InputSource) => void
  onDemo: (d: DemoScenario) => void
  onConfirm: (url: URL, source: InputSource, screenshot?: ScreenshotFindings) => void
  flash: (m: string) => void
}

function Home({ caps, installEvt, onCheck, onDemo, onConfirm, flash }: HomeProps) {
  const [value, setValue] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [paymentUri, setPaymentUri] = useState<PaymentUri | null>(null)
  const [scanOpen, setScanOpen] = useState(false)
  const [installOpen, setInstallOpen] = useState(false)
  const [upload, setUpload] = useState<{ file: File; preview: string; state: 'decoding' | 'noqr' | 'reading' | 'error' | 'nourl'; message?: string; findings?: ScreenshotFindings } | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const canPaste = typeof navigator !== 'undefined' && Boolean(navigator.clipboard?.readText)

  const submit = (text: string, source: InputSource = 'paste') => {
    setPaymentUri(null)
    const r = ingest(text)
    if (r.ok) {
      setError(null)
      onCheck(r.url, source)
    } else {
      setError(INGEST_MESSAGES[r.error])
      if (r.paymentUri) setPaymentUri(r.paymentUri)
      inputRef.current?.focus()
    }
  }

  const fromDecoded = (text: string, source: InputSource) => {
    const r = ingest(text)
    if (r.ok) onConfirm(r.url, source)
    else {
      setValue(text.slice(0, 300))
      setError(r.error === 'not_a_link' ? 'That QR code contains text, not a web link.' : INGEST_MESSAGES[r.error])
      if (r.paymentUri) setPaymentUri(r.paymentUri)
    }
  }

  const paste = async () => {
    try {
      const t = await navigator.clipboard.readText()
      setValue(t.trim().slice(0, 2048))
      if (t.trim()) submit(t)
    } catch {
      flash('Clipboard access was blocked. Long-press the field and choose Paste.')
    }
  }

  const onFile = async (file: File | undefined) => {
    if (!file) return
    if (!file.type.startsWith('image/')) return flash('Choose an image (PNG, JPG or WebP).')
    if (file.size > 15_000_000) return flash('That image is over 15 MB. Try a smaller screenshot.')
    const preview = URL.createObjectURL(file)
    setUpload({ file, preview, state: 'decoding' })
    try {
      const qr = await decodeQrFromFile(file)
      if (qr) {
        setUpload(null)
        URL.revokeObjectURL(preview)
        fromDecoded(qr, 'qr')
      } else setUpload({ file, preview, state: 'noqr' })
    } catch {
      setUpload({ file, preview, state: 'error', message: "We couldn't open that image." })
    }
  }

  const readWithAi = async () => {
    if (!upload) return
    setUpload({ ...upload, state: 'reading' })
    const res = await readScreenshot(await toUploadDataUrl(upload.file))
    if (res.status === 'ok' && res.findings) {
      const link = res.findings.paymentUrl ? ingest(res.findings.paymentUrl) : null
      if (link?.ok) {
        URL.revokeObjectURL(upload.preview)
        setUpload(null)
        onConfirm(link.url, 'screenshot', res.findings)
      } else setUpload({ ...upload, state: 'nourl', findings: res.findings })
    } else setUpload({ ...upload, state: 'error', message: res.status === 'not_configured' ? 'AI reading is not configured on this deployment.' : res.reason })
  }

  return (
    <div>
      <Header
        right={
          <nav className="flex items-center gap-1">
            <a href="#how" className="hidden h-11 items-center rounded-full px-4 text-[15px] font-semibold hover:bg-paper-2 sm:inline-flex">How it works</a>
            <button onClick={() => (installEvt ? installEvt.prompt() : setInstallOpen(true))} className="inline-flex h-11 items-center gap-2 rounded-full border border-line px-4 text-[15px] font-semibold hover:border-ink">
              <Download size={16} /> Install app
            </button>
          </nav>
        }
      />

      <main>
        <section className="safe-x mx-auto grid max-w-[1240px] gap-8 pt-6 pb-14 lg:grid-cols-12 lg:gap-10 lg:pt-14 lg:pb-20">
          <div className="min-w-0 lg:col-span-7">
            <h1 className="rise text-[clamp(3.1rem,9.5vw,6rem)] leading-[0.92] font-extrabold tracking-[-0.05em] text-balance">Know before you&nbsp;pay.</h1>
            <p className="rise mt-5 max-w-[30ch] text-[20px] leading-snug text-ink/75 sm:text-[23px]" style={{ animationDelay: '60ms' }}>
              Find out who's behind a payment, before your money leaves.
            </p>

            <form
              className="rise mt-8 sm:mt-10"
              style={{ animationDelay: '120ms' }}
              onSubmit={(e) => {
                e.preventDefault()
                submit(value)
              }}
              noValidate
            >
              <label htmlFor="url" className="sr-only">Payment link</label>
              <div className={`flex items-center gap-2 rounded-[22px] border bg-card p-2 pl-4 shadow-[0_18px_40px_-28px_rgb(16_24_32/0.45)] transition-colors focus-within:border-ink ${error ? 'border-red' : 'border-line'}`}>
                <Link2 size={22} className="shrink-0 text-mute" aria-hidden />
                <input
                  ref={inputRef}
                  id="url"
                  value={value}
                  onChange={(e) => {
                    setValue(e.target.value)
                    if (error) setError(null)
                  }}
                  inputMode="url"
                  autoComplete="off"
                  autoCapitalize="off"
                  spellCheck={false}
                  placeholder="Paste a payment link"
                  aria-invalid={Boolean(error)}
                  aria-describedby={error ? 'url-error' : undefined}
                  className="h-14 min-w-0 flex-1 bg-transparent text-[18px] outline-none placeholder:text-mute/80 sm:text-[20px]"
                />
                {canPaste && !value && (
                  <button type="button" onClick={paste} className="inline-flex h-11 shrink-0 items-center gap-1.5 rounded-xl bg-paper-2 px-3 text-[14px] font-semibold hover:bg-line">
                    <ClipboardPaste size={16} /> Paste
                  </button>
                )}
                <button className="hidden h-14 shrink-0 items-center gap-2 rounded-2xl bg-ink px-6 text-[17px] font-semibold text-paper hover:bg-ink-3 sm:inline-flex">
                  Check payment <ArrowRight size={19} />
                </button>
              </div>
              <button className="mt-3 inline-flex h-14 w-full items-center justify-center gap-2 rounded-2xl bg-ink text-[17px] font-semibold text-paper sm:hidden">
                Check payment <ArrowRight size={19} />
              </button>
              {error && (
                <p id="url-error" className="mt-3 text-[15px] font-medium text-red" role="alert">
                  {error}
                </p>
              )}
              {paymentUri && (
                <div className="mt-3">
                  <Notice tone={paymentUri.crypto ? 'error' : 'warn'}>
                    <strong>{paymentUri.label}.</strong> Recipient {paymentUri.recipient ? <span className="font-mono">{paymentUri.recipient}</span> : 'unknown'}
                    {paymentUri.name ? ` (shown as "${paymentUri.name}" — not verified)` : ''}.{' '}
                    {paymentUri.crypto ? 'Crypto payments cannot be reversed. Only pay if you know and trust the recipient.' : "We can't verify who owns this account. Only pay if you can confirm it independently."}
                  </Notice>
                </div>
              )}
            </form>

            <div className="rise mt-4 flex flex-wrap gap-2" style={{ animationDelay: '180ms' }}>
              <button onClick={() => setScanOpen(true)} className="inline-flex h-12 items-center gap-2 rounded-full border border-line bg-card px-5 text-[15px] font-semibold hover:border-ink">
                <ScanLine size={18} /> Scan QR
              </button>
              <button onClick={() => fileRef.current?.click()} className="inline-flex h-12 items-center gap-2 rounded-full border border-line bg-card px-5 text-[15px] font-semibold hover:border-ink">
                <ImageUp size={18} /> Upload screenshot
              </button>
              <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={(e) => { onFile(e.target.files?.[0]); e.target.value = '' }} />
            </div>
            <p className="rise mt-6 flex items-start gap-2 text-[15px] text-mute" style={{ animationDelay: '220ms' }}>
              <Smartphone size={17} className="mt-0.5 shrink-0" />
              <span>
                On your phone? Share a payment link directly to BeforePay.{' '}
                <button onClick={() => setInstallOpen(true)} className="font-semibold text-ink underline underline-offset-3">Set it up</button>
              </span>
            </p>
          </div>

          <aside className="on-dark rise min-w-0 self-start rounded-[28px] bg-ink p-5 text-paper sm:p-7 lg:col-span-5 lg:mt-3" style={{ animationDelay: '140ms' }} aria-labelledby="sims">
            <h2 id="sims" className="text-[22px] font-bold tracking-[-0.03em]">Try a simulation</h2>
            <p className="mt-1 text-[15px] text-mute-dark">Fictional merchants with simulated registry data. Works offline.</p>
            <ul className="mt-5 grid grid-cols-[minmax(0,1fr)] gap-2">
              {DEMOS.map((d) => (
                <li key={d.id}>
                  <button onClick={() => onDemo(d)} className="group flex w-full items-center gap-4 rounded-2xl border border-line-dark p-4 text-left transition-colors hover:border-lime hover:bg-ink-2">
                    <div className="min-w-0 flex-1">
                      <p className="text-[12px] font-semibold text-lime">{d.label}</p>
                      <p className="mt-0.5 text-[18px] font-bold tracking-[-0.02em]">{d.title}</p>
                      <p className="mt-1 text-[14px] leading-snug text-mute-dark">{d.blurb}</p>
                      <p className="mt-2 truncate font-mono text-[12px] text-paper/60">{new URL(d.url).hostname}{new URL(d.url).pathname.slice(0, 18)}…</p>
                    </div>
                    <span className="grid size-11 shrink-0 place-items-center rounded-full bg-lime text-ink transition-transform group-hover:translate-x-0.5">
                      <Play size={17} fill="currentColor" />
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          </aside>
        </section>

        <Steps />
        <HowItWorks caps={caps} />
      </main>

      <footer className="safe-x mx-auto flex max-w-[1240px] flex-col gap-3 border-t border-line py-8 text-[13px] text-mute sm:flex-row sm:items-center sm:justify-between">
        <Wordmark />
        <p className="max-w-[70ch]">BeforePay is an information tool, not financial advice. No check can guarantee that a payment is safe. Demo merchants are fictional.</p>
      </footer>

      <Scanner open={scanOpen} onClose={() => setScanOpen(false)} onResult={(t) => { setScanOpen(false); fromDecoded(t, 'qr') }} onUpload={() => { setScanOpen(false); fileRef.current?.click() }} />
      <InstallSheet open={installOpen} onClose={() => setInstallOpen(false)} />
      <Sheet open={Boolean(upload)} onClose={() => { if (upload) URL.revokeObjectURL(upload.preview); setUpload(null) }} title="Your screenshot">
        {upload && (
          <div className="grid gap-4 pb-2">
            <img src={upload.preview} alt="Uploaded screenshot preview" className="max-h-56 w-full rounded-2xl border border-line bg-paper-2 object-contain" />
            {upload.state === 'decoding' && <p className="text-[16px]">Looking for a QR code on your device…</p>}
            {upload.state === 'reading' && <p className="text-[16px]">Reading the screenshot with AI…</p>}
            {upload.state === 'error' && <Notice tone="error">{upload.message}</Notice>}
            {(upload.state === 'noqr' || upload.state === 'error') && (
              <>
                <p className="text-[16px] font-semibold">No QR code found in this image.</p>
                {caps?.ai ? (
                  <>
                    <Notice icon={<EyeOff size={18} />}>
                      Crop out or cover card numbers, account details and addresses first. The image is sent once to read the payment details, then discarded.
                    </Notice>
                    <button onClick={readWithAi} className="inline-flex h-13 items-center justify-center gap-2 rounded-2xl bg-ink py-3.5 text-[16px] font-semibold text-paper">
                      <Sparkles size={18} /> Read payment details with AI
                    </button>
                  </>
                ) : (
                  <Notice tone="warn">
                    Reading screenshots with AI isn't configured on this deployment, so the image stays on your device. Copy the payment link from the page and paste it instead.
                  </Notice>
                )}
              </>
            )}
            {upload.state === 'nourl' && upload.findings && (
              <>
                <Notice tone="warn">We couldn't see a full web address in the screenshot. Paste the link to check where the payment goes.</Notice>
                <ul className="grid gap-1 text-[15px]">
                  {upload.findings.visibleMerchant && <li>Name shown: <strong>{upload.findings.visibleMerchant}</strong> (not verified)</li>}
                  {upload.findings.amount && <li>Amount shown: {upload.findings.amount}</li>}
                  {upload.findings.suspicious.map((s) => <li key={s} className="text-red">{s}</li>)}
                </ul>
              </>
            )}
          </div>
        )}
      </Sheet>
    </div>
  )
}

function Steps() {
  const steps = [
    { t: 'Share or paste', d: 'Send a checkout link, a seller\'s message or a QR code to BeforePay.', art: <ArtShare /> },
    { t: 'We investigate', d: 'We read the address, the domain registry and impersonation patterns — without opening the page.', art: <ArtInvestigate /> },
    { t: 'Pay with more confidence', d: 'See who is verified, who isn\'t, and the one thing to do next.', art: <ArtConfidence /> },
  ]
  return (
    <section className="border-y border-line bg-paper-2/60" aria-label="How BeforePay works in three steps">
      <ol className="safe-x mx-auto grid max-w-[1240px] gap-8 py-12 sm:grid-cols-3 sm:gap-10 sm:py-16">
        {steps.map((s, i) => (
          <li key={s.t} className="flex gap-5 sm:block">
            <div className="h-[84px] w-[110px] shrink-0 sm:h-[96px] sm:w-auto">{s.art}</div>
            <div className="sm:mt-5">
              <p className="tnum text-[14px] font-semibold text-mute">Step {i + 1}</p>
              <h3 className="mt-1 text-[22px] font-bold tracking-[-0.03em]">{s.t}</h3>
              <p className="mt-1.5 max-w-[34ch] text-[16px] leading-snug text-ink/75">{s.d}</p>
            </div>
          </li>
        ))}
      </ol>
    </section>
  )
}

const ArtShare = () => (
  <svg viewBox="0 0 120 96" className="h-full w-auto" aria-hidden fill="none" strokeLinecap="round" strokeLinejoin="round">
    <rect x="30" y="4" width="52" height="88" rx="10" fill="#fff" stroke="#101820" strokeWidth="2.5" />
    <rect x="38" y="20" width="36" height="9" rx="4.5" fill="#cbf36b" stroke="#101820" strokeWidth="2" />
    <path d="M40 42h32M40 51h24M40 60h28" stroke="#101820" strokeWidth="2" opacity=".35" />
    <path d="M86 50c14 0 22 8 26 20M106 62l6 8 7-6" stroke="#101820" strokeWidth="2.5" />
  </svg>
)
const ArtInvestigate = () => (
  <svg viewBox="0 0 120 96" className="h-full w-auto" aria-hidden fill="none" strokeLinecap="round" strokeLinejoin="round">
    <rect x="4" y="30" width="96" height="22" rx="11" fill="#fff" stroke="#101820" strokeWidth="2.5" />
    <rect x="34" y="36" width="34" height="10" rx="3" fill="#cbf36b" />
    <path d="M14 41h14M72 41h18" stroke="#101820" strokeWidth="2" opacity=".35" />
    <circle cx="74" cy="62" r="16" fill="#f8f9f6" fillOpacity=".6" stroke="#101820" strokeWidth="2.5" />
    <path d="M86 74l14 14" stroke="#101820" strokeWidth="4" />
  </svg>
)
const ArtConfidence = () => (
  <svg viewBox="0 0 120 96" className="h-full w-auto" aria-hidden fill="none" strokeLinecap="round" strokeLinejoin="round">
    <rect x="6" y="14" width="96" height="66" rx="12" fill="#101820" />
    <rect x="16" y="26" width="16" height="16" rx="5" fill="#cbf36b" />
    <path d="M40 30h40M40 38h26" stroke="#f8f9f6" strokeWidth="2.5" opacity=".7" />
    <path d="M16 56h22M16 66h30" stroke="#f8f9f6" strokeWidth="2" opacity=".35" />
    <circle cx="96" cy="70" r="15" fill="#cbf36b" stroke="#101820" strokeWidth="2.5" />
    <path d="M89 70l5 5 9-10" stroke="#101820" strokeWidth="3" />
  </svg>
)

function HowItWorks({ caps }: { caps: Capabilities | null }) {
  const state = (on: boolean | undefined, label = 'Live') => (caps === null ? 'Checking…' : on ? label : 'Not configured')
  const rows: [string, string, boolean][] = [
    ['Address & domain structure', 'Always on', true],
    ['Brand impersonation (36 brands)', 'Always on', true],
    ['Payment processor recognition', 'Always on', true],
    ['Domain registration date (RDAP)', 'Live', true],
    ['Phishing & malware databases', state(caps?.threat, 'Google Safe Browsing'), Boolean(caps?.threat)],
    ['Screenshot reading (AI)', state(caps?.ai, 'OpenAI'), Boolean(caps?.ai)],
    ['UK company register', state(caps?.registry, 'Companies House'), Boolean(caps?.registry)],
  ]
  return (
    <section id="how" className="safe-x mx-auto grid max-w-[1240px] gap-10 py-14 sm:py-20 lg:grid-cols-2 lg:gap-16">
      <div>
        <h2 className="text-[32px] leading-tight font-extrabold tracking-[-0.04em]">What BeforePay checks</h2>
        <p className="mt-2 max-w-[48ch] text-[16px] text-ink/75">Live status for this deployment. Anything not configured is shown as "Not checked" in reports — never as a pass.</p>
        <ul className="mt-6 border-t border-line">
          {rows.map(([name, s, on]) => (
            <li key={name} className="flex items-center justify-between gap-4 border-b border-line py-3.5 text-[16px]">
              <span>{name}</span>
              <span className={`inline-flex items-center gap-2 text-[14px] font-semibold ${on ? 'text-ink' : 'text-mute'}`}>
                <span className={`size-2 rounded-full ${on ? 'bg-lime ring-1 ring-ink' : 'border border-dashed border-mute'}`} />
                {s}
              </span>
            </li>
          ))}
        </ul>
      </div>
      <div>
        <h2 className="text-[32px] leading-tight font-extrabold tracking-[-0.04em]">Private by design</h2>
        <ul className="mt-6 grid gap-5 text-[16px] leading-snug">
          <li><strong className="font-bold">We never open your link.</strong> No page is visited and no payment is started — we only read the address.</li>
          <li><strong className="font-bold">Nothing is stored.</strong> No accounts, no history. Checks live only in this tab.</li>
          <li><strong className="font-bold">Tokens are stripped.</strong> Session IDs, emails and card-like numbers are hidden from reports and shared links.</li>
          <li><strong className="font-bold">QR codes are read on your device.</strong> A screenshot only leaves your phone if you choose AI reading.</li>
          <li><strong className="font-bold">Lookups we make.</strong> The domain name goes to the public registry (RDAP); the link goes to a threat database only when one is configured.</li>
        </ul>
      </div>
    </section>
  )
}

/* ------------------------------------------------------------------ */

function Scanner({ open, onClose, onResult, onUpload }: { open: boolean; onClose: () => void; onResult: (t: string) => void; onUpload: () => void }) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const [err, setErr] = useState<string | null>(null)
  useEffect(() => {
    if (!open) return
    setErr(null)
    let stream: MediaStream | null = null
    let raf = 0
    let stopped = false
    const canvas = document.createElement('canvas')
    if (!navigator.mediaDevices?.getUserMedia) {
      setErr(window.isSecureContext ? "This browser can't use the camera here." : 'The camera needs a secure (https) connection.')
      return
    }
    navigator.mediaDevices
      .getUserMedia({ video: { facingMode: { ideal: 'environment' } }, audio: false })
      .then(async (s) => {
        if (stopped) return s.getTracks().forEach((t) => t.stop())
        stream = s
        const v = videoRef.current!
        v.srcObject = s
        await v.play().catch(() => {})
        let last = 0
        const tick = (t: number) => {
          if (stopped) return
          if (t - last > 140) {
            last = t
            const found = decodeFrame(v, canvas)
            if (found) {
              navigator.vibrate?.(30)
              return onResult(found)
            }
          }
          raf = requestAnimationFrame(tick)
        }
        raf = requestAnimationFrame(tick)
      })
      .catch((e: DOMException) => {
        setErr(
          e.name === 'NotAllowedError'
            ? 'Camera access was denied. Allow camera access in your browser settings, or upload a photo of the QR code instead.'
            : e.name === 'NotFoundError'
              ? 'No camera was found on this device. Upload a photo of the QR code instead.'
              : "The camera couldn't start. Upload a photo of the QR code instead.",
        )
      })
    return () => {
      stopped = true
      cancelAnimationFrame(raf)
      stream?.getTracks().forEach((t) => t.stop())
    }
  }, [open, onResult])

  return (
    <Sheet open={open} onClose={onClose} title="Scan a QR code" dark>
      <div className="grid gap-4 pb-2">
        {err ? (
          <div className="grid aspect-square place-items-center rounded-3xl bg-ink-2 p-6 text-center">
            <div>
              <Camera size={34} className="mx-auto text-mute-dark" />
              <p className="mt-3 text-[16px] leading-snug text-paper/90" role="alert">{err}</p>
            </div>
          </div>
        ) : (
          <div className="relative aspect-square overflow-hidden rounded-3xl bg-ink-2">
            <video ref={videoRef} playsInline muted className="size-full object-cover" />
            <div className="pointer-events-none absolute inset-[14%] rounded-3xl border-2 border-lime/90 shadow-[0_0_0_2000px_rgb(16_24_32/0.45)]" />
            <div className="pointer-events-none absolute inset-x-[16%] top-[16%] h-0.5 bg-lime" style={{ animation: 'viewfinder 2.4s cubic-bezier(.45,0,.55,1) infinite' }} />
          </div>
        )}
        <p className="text-[15px] text-mute-dark">Point at the QR code. It's decoded on your device — we won't open the link.</p>
        <button onClick={onUpload} className="inline-flex h-12 items-center justify-center gap-2 rounded-2xl bg-ink-3 text-[15px] font-semibold hover:bg-line-dark">
          <ImageUp size={18} /> Upload a photo instead
        </button>
      </div>
    </Sheet>
  )
}

function InstallSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const ua = typeof navigator !== 'undefined' ? navigator.userAgent : ''
  const ios = /iphone|ipad|ipod/i.test(ua)
  const android = /android/i.test(ua)
  const bookmarkRef = useRef<HTMLAnchorElement>(null)
  useEffect(() => {
    if (!open || !bookmarkRef.current) return
    const base = `${location.origin}${location.pathname.replace(/[^/]*$/, '')}`
    // Sends only the page address without query or fragment, so session tokens never leave the page.
    bookmarkRef.current.setAttribute('href', `javascript:(()=>{window.open('${base}check?url='+encodeURIComponent(location.origin+location.pathname),'_blank','noopener')})()`)
  }, [open])
  return (
    <Sheet open={open} onClose={onClose} title="Check links from anywhere">
      <div className="grid gap-5 pb-3 text-[16px] leading-snug">
        <div className={android ? 'order-first' : ''}>
          <h3 className="flex items-center gap-2 font-bold"><Share size={18} /> Android (Chrome, Edge, Samsung Internet)</h3>
          <p className="mt-1 text-ink/80">Install BeforePay from the browser menu. It then appears in your share menu: share any payment link from WhatsApp, SMS, email or a website straight to BeforePay.</p>
        </div>
        <div className={ios ? 'order-first' : ''}>
          <h3 className="flex items-center gap-2 font-bold"><Smartphone size={18} /> iPhone and iPad</h3>
          <p className="mt-1 text-ink/80">In Safari, tap Share, then Add to Home Screen. iOS doesn't let web apps join the share menu, so copy a link and tap <strong>Paste</strong> in BeforePay.</p>
        </div>
        <div>
          <h3 className="flex items-center gap-2 font-bold"><Bookmark size={18} /> Desktop</h3>
          <p className="mt-1 text-ink/80">Drag this button to your bookmarks bar. On any checkout page, click it to check that page. It sends only the page address, never its session tokens.</p>
          <a ref={bookmarkRef} onClick={(e) => e.preventDefault()} className="mt-3 inline-flex h-11 cursor-grab items-center gap-2 rounded-full bg-ink px-5 text-[15px] font-semibold text-paper">
            <Wordmark dark /> check
          </a>
        </div>
        <p className="text-[14px] text-mute">Any device: links in the form <span className="font-mono">/check?url=…</span> open straight into a check.</p>
      </div>
    </Sheet>
  )
}
