# BeforePay contributor guidance

BeforePay explains payment-link evidence. Preserve these boundaries:

- Never present a result as a safety guarantee or a probability of fraud.
- Separate website provider, merchant, payment processor and recipient.
- Domain age, HTTPS and DNS availability cannot verify merchant identity.
- Missing services and failed lookups must remain explicitly unchecked.
- The public Pages build makes no requests to the submitted payment page.
- Redact session tokens and personal URL credentials in display, exports and shared links.
- Preserve original archived documents; put corrections in current documentation.
- Never commit API keys, local runtime metadata, caches or generated builds.

Commands: `npm ci`, `npm run dev`, `npm test`, `npm run build:pages`.
The production site uses `/beforepay/` and query-based demo links. Keep Pages route sharing, mobile loading and the three PayPal examples working.
