import { ChevronDown } from 'lucide-react'
import { useId } from 'react'
import type { PaymentContext } from './engine/types'

export function PaymentDetails({ expected, onExpected, context, onContext }: { expected: string; onExpected: (value: string) => void; context: PaymentContext; onContext: (value: PaymentContext) => void }) {
  const id = useId()
  const field = 'mt-2 min-h-12 w-full min-w-0 rounded-xl border border-line bg-card px-3 text-[16px] outline-none focus:border-ink'
  return <details className="mt-4 rounded-2xl border border-line bg-paper/60">
    <summary className="flex min-h-12 cursor-pointer items-center justify-between gap-3 px-4 py-3 text-[15px] font-semibold">Add payment details <span className="ml-auto font-normal text-mute">Optional</span><ChevronDown size={17} /></summary>
    <div className="grid gap-4 border-t border-line p-4">
      <p className="text-[14px] leading-relaxed text-mute">Your message and amount stay in this tab. Payment details are excluded from shared links. A business name may be used for a company-register search when available.</p>
      <label htmlFor={`${id}-who`} className="text-[15px] font-semibold">Who do you expect to pay?<input id={`${id}-who`} value={expected} onChange={e => onExpected(e.target.value)} maxLength={80} placeholder="Shop, company or person's name" className={field} /></label>
      <div className="grid min-w-0 gap-4 sm:grid-cols-2">
        <label htmlFor={`${id}-channel`} className="text-[15px] font-semibold">Where did you get the link?<select id={`${id}-channel`} value={context.channel ?? ''} onChange={e => onContext({ ...context, channel: e.target.value as PaymentContext['channel'] })} className={field}><option value="">Not specified</option><option value="website">A website</option><option value="message">Chat or SMS</option><option value="email">Email</option><option value="marketplace">A marketplace</option><option value="qr">A QR code or sign</option></select></label>
        <label htmlFor={`${id}-method`} className="text-[15px] font-semibold">How are you being asked to pay?<select id={`${id}-method`} value={context.method ?? ''} onChange={e => onContext({ ...context, method: e.target.value as PaymentContext['method'] })} className={field}><option value="">Not specified</option><option value="card">Card purchase</option><option value="personal">Personal transfer</option><option value="bank">Bank transfer</option><option value="crypto">Cryptocurrency</option></select></label>
      </div>
      <label htmlFor={`${id}-amount`} className="text-[15px] font-semibold">Expected amount<input id={`${id}-amount`} value={context.amount ?? ''} onChange={e => onContext({ ...context, amount: e.target.value })} maxLength={40} placeholder="e.g. £34.00" className={field} /></label>
      <label htmlFor={`${id}-message`} className="text-[15px] font-semibold">Message that came with the link<textarea id={`${id}-message`} value={context.message ?? ''} onChange={e => onContext({ ...context, message: e.target.value })} maxLength={2000} rows={3} placeholder="Paste the wording, leaving out personal details" className={`${field} py-3 font-normal`} /></label>
    </div>
  </details>
}
