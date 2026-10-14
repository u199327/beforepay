import { createWorker } from 'tesseract.js'
import { ingest } from './ingest'
import { toUploadDataUrl } from '../qr'
import type { ScreenshotFindings } from '../engine/types'

/** Never repairs a link's spelling: the user reviews the OCR candidate before checking. */
export function screenshotLinks(text: string): string[] {
  const explicit = text.match(/https?:\/\/[^\s<>"'`]+|www\.[^\s<>"'`]+/gi) ?? []
  const candidates = explicit.length ? explicit : text.split(/\n/).filter(line => /\.[a-z]{2,}\b/i.test(line))
  return [...new Set(candidates.flatMap(candidate => { const r = ingest(candidate); return r.ok ? [r.url.href] : [] }))].slice(0, 6)
}

export async function readLocalScreenshot(file: File, progress: (message: string) => void, signal: AbortSignal): Promise<{ links: string[]; findings: ScreenshotFindings }> {
  let worker: Awaited<ReturnType<typeof createWorker>> | undefined
  const stop = () => { void worker?.terminate() }
  signal.addEventListener('abort', stop, { once: true })
  try {
    progress('Preparing the reader on your device…')
    worker = await createWorker('eng', 1, {
      workerPath: 'https://cdn.jsdelivr.net/npm/tesseract.js@6.0.1/dist/worker.min.js',
      corePath: 'https://cdn.jsdelivr.net/npm/tesseract.js-core@6.0.0',
      logger: m => { if (!signal.aborted && m.status === 'recognizing text') progress(`Reading text on your device… ${Math.round(m.progress * 100)}%`) },
    })
    if (signal.aborted) throw new Error('cancelled')
    const { data } = await worker.recognize(await toUploadDataUrl(file, 1800))
    if (signal.aborted) throw new Error('cancelled')
    const links = screenshotLinks(data.text)
    return { links, findings: { readingMethod: 'local_ocr', visibleMerchant: null, amount: null, paymentUrl: links.length === 1 ? links[0] : null, provider: null, suspicious: [], offPlatformRequest: false, summary: 'Text read on your device. Review the link for reading errors.' } }
  } finally {
    signal.removeEventListener('abort', stop)
    await worker?.terminate()
  }
}
