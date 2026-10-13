# Product

<!-- impeccable:product-schema 1 -->

> All facts below are inferred from the user's written brief (the build was requested without an interview round). Nothing here was confirmed in a Q&A session.

## Platform

web

## Stack

delegated: Vite + React 19 + TypeScript + Tailwind CSS v4, Lucide icons, Vercel-style serverless functions in `api/` for keyed integrations. Chosen because the brief prefers React/TS/Tailwind and needs server-side secrets plus a static, installable PWA shell.

## Users

Ordinary consumers (not fraud analysts) who are about to pay online: a checkout link, a link sent by a marketplace seller over chat/SMS/email, or a QR code in a public place. Often on a phone, often mid-task, often under mild time pressure.

## Product Purpose

BeforePay shows who appears to be behind a payment before money leaves: what can be verified, what cannot, any warning signs, and one concrete next step. Success is a person understanding the result within three seconds and choosing a safer way to pay when needed.

## Positioning

"Shazam for online payments." The differentiator is merchant transparency: an honest Merchant Identity Card that separates website owner, merchant, payment processor and final recipient of funds, and labels every field as verified from a cited source, inferred, or not verified.

## Operating Context

Inputs: pasted URL, `/check?url=` deep links, PWA share target, QR camera scan, QR/screenshot upload. Three fictional, deterministic demo scenarios exist for judges. No accounts, no storage of scanned URLs.

## Capabilities and Constraints

- Never claims a payment is safe. Three states only: No known threats detected / Identity not verified / Warning signs detected.
- Never fabricates legal identities, registration numbers, trust scores or beneficiaries. Unknown fields say "Not verified".
- Integrations that are not configured are shown as "Not checked", never as passing.
- Never fetches arbitrary user-submitted URLs server-side; never opens the payment page.
- Sensitive URL parameters and session tokens are redacted from display and shared links.
- AI (OpenAI multimodal) only extracts visible facts and explains; it is not the security decision-maker.

## Brand Commitments

- Name and wordmark: **beforepay.** — tagline "Know before you pay."
- Palette pinned by the brief: deep ink #101820, warm off-white #F8F9F6, electric lime #CBF36B, subdued greys, accessible amber and red warnings.
- References: clarity of Stripe, friendliness of Monzo, refinement of Linear. Light-first editorial interface with composed dark sections.
- Avoid: generic AI dashboards, heavy gradients, neon glow, emoji UI, stock illustrations, unnecessary charts.

## Evidence on Hand

No real customers, testimonials, partner logos or statistics exist. Demo merchants (Northfield Coffee Roasters, Marketfold, Kerbway Parking) are fictional and must be labelled as simulations.

## Product Principles

1. Evidence before conclusion; say what was not checked.
2. Plain English first, technical detail on request.
3. Calibrated, never reassuring by default.
4. Fewest possible taps from "I'm about to pay" to an answer.
5. Transient by default: nothing about the user's payment is kept.

## Accessibility & Inclusion

WCAG AA contrast, keyboard access, reduced-motion support, touch targets ≥44px, 375px mobile as a first-class layout.
