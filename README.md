# beforepay.

**Know before you pay.** Paste, share or scan a payment link and see who is — and isn't — verified behind it, before your money leaves.

Built for the Fintech Hackathon, London, 13 October 2026.

## What it does
- Three calibrated results only: *No known threats detected*, *Identity not verified*, *Warning signs detected*. Never "safe".
- **Merchant Identity Card**: separates website owner ≠ merchant ≠ payment processor ≠ actual recipient, each field labelled Verified / Inferred / Not verified.
- Real checks: URL parsing with the Public Suffix List (`tldts`), brand impersonation across 36 commonly impersonated brands (lookalikes, swapped endings, IDN homoglyphs, brand-as-subdomain), official payment-processor domains (Stripe, PayPal, Adyen, Square, Revolut, …), live domain registration via RDAP, on-device QR decoding (`jsQR`), expected-merchant comparison.
- Optional server integrations (`api/`, Vercel-style functions): Google Safe Browsing, OpenAI screenshot reading, Companies House search. Without keys they report "Not checked", never a pass.
- Three clearly labelled fictional demo scenarios with simulated registry data.

## Privacy & safety
Never opens the submitted page or starts a payment. Server never fetches user URLs (SSRF guards, allowlisted lookups only). Session tokens, emails and card-like numbers are redacted from reports and share links. No accounts, nothing stored.

## Run
```bash
npm install
npm run dev     # app + api functions on localhost
npm test        # engine tests
```
Optional keys: see `.env.example`.

Deep link: `/check?url=<encoded-url>` · PWA share target: `/share-target` (Android, installed).
