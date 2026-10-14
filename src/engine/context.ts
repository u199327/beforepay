import type { Criterion, PaymentContext, Signal } from './types'

/** Observations about user-supplied context, never proof of fraud or identity. */
export function contextChecks(context?: PaymentContext): { criteria: Criterion[]; signals: Signal[] } {
  const criteria: Criterion[] = []
  const signals: Signal[] = []
  const add = (id: string, title: string, summary: string, detail: string, caution = false) => {
    criteria.push({ id, title, summary, detail, status: caution ? 'caution' : 'info', basis: 'User input' })
    if (caution) signals.push({ id, severity: 'caution', text: summary })
  }
  if (!context) return { criteria, signals }
  if (context.method === 'personal') add('context-method', 'Payment method', 'You selected a personal payment.', 'A personal transfer may have different buyer protection from a purchase checkout. Confirm the recipient and the protection for this specific transaction.', true)
  if (context.method === 'bank') add('context-method', 'Payment method', 'You selected a bank transfer.', 'BeforePay cannot verify bank-account ownership. Confirm the recipient through your bank and a separate trusted channel before transferring.', true)
  if (context.method === 'crypto') add('context-method', 'Payment method', 'You selected a cryptocurrency payment.', 'Recipient ownership and recovery options have not been verified. Confirm these independently before paying.', true)
  if (context.method === 'card') add('context-method', 'Payment method', 'You selected a card purchase.', 'Payment method is supplied by you. Card use does not verify the merchant or guarantee recovery.')
  if (context.amount?.trim()) add('context-amount', 'Expected amount', `You expect to pay ${context.amount.trim().slice(0, 40)}.`, 'The final checkout amount and currency have not been independently read or verified. Compare both in the official checkout before paying.')
  const message = (context.message ?? '').slice(0, 2000)
  const sentences = message.split(/[.!?\n]+/)
  const pressure = sentences.find(s => !/\b(no rush|not urgent|take your time|sin prisa|no es urgente)\b/i.test(s) && /\b(urgent|urgently|immediately|last chance|pay now|within \d+ minutes|urgente|inmediatamente|última oportunidad|paga ahora)\b/i.test(s))
  if (pressure) add('context-pressure', 'Message wording', 'The message includes time pressure.', 'Matched urgency wording in the text you supplied. Legitimate messages can also be urgent; this is a reason to pause and confirm, not evidence of fraud.', true)
  const departure = sentences.find(s => !/\b(do not|don['’]t|never|no pagues|no pagar|nunca)\b/i.test(s) && /\b(outside|off[- ]platform|fuera de)\b.{0,40}\b(platform|app|marketplace|vinted|ebay|wallapop|plataforma)\b/i.test(s))
  if (departure) add('context-off-platform', 'Payment channel', 'The message asks about paying outside a platform.', 'Matched wording in the supplied message. Keep the payment in the original marketplace and check its buyer-protection terms.', true)
  else if (context.channel === 'marketplace') add('context-channel', 'Payment channel', 'This payment started in a marketplace.', 'Confirm that the order and payment appear inside the original marketplace. A recognised payment provider does not establish that connection.')
  return { criteria, signals }
}
