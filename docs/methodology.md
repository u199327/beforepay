# Interpretable payment-link checks

BeforePay uses one deterministic rules engine, supplemented by live domain-registration and DNS responses. Its criteria are not independent antivirus votes. Coverage counts completed checks, not trust or fraud probability.

## Decision rules

1. Strong address deception, private/numeric payment destinations, a configured threat-feed listing, off-platform requests in supplied evidence, or an exact expected-brand mismatch can produce **Warning signs detected**.
2. Similar spelling, a recent registration, personal/crypto payments, shared platforms, hidden destinations and missing merchant linkage call for caution and normally produce **Identity not verified**.
3. A recognised brand/provider address with no warning or caution can produce **No known threats detected**. The receiving merchant or beneficiary can still be unknown.

An old domain or a clean threat-feed response cannot, by itself, establish merchant identity. HTTPS in a URL is not a checked certificate. DNS resolution establishes only that a resolver returned an address.

## The 12 base criteria

| Criterion | Evidence | Limit |
| --- | --- | --- |
| Public payment destination | Parsed hostname, IP/private/reserved classification | Public does not imply trustworthy |
| HTTPS in the address | URL protocol | Certificate and page not visited |
| Hidden destination with `@` | URL username/password prefix | Text before `@` is not the hostname |
| Brand resemblance | Curated names, domain patterns, confusable characters | 35 brands; similarities are not proof of impersonation |
| Known domain or provider | Curated hostname/domain references | Identifies infrastructure, not the receiving merchant |
| Destination visibility | Known shortener reference list | Arbitrary redirects are not followed |
| Domain registration age | Public RDAP registration event | Unavailable data, privacy redaction and old domains do not prove fraud or trust |
| Public DNS availability | Cloudflare A/AAAA answers | No proof of ownership or reputation |
| Payment route and protection | Hosted/personal/platform/crypto URL rules | Protection depends on the actual payment method and conditions |
| Expected merchant | User-provided name and reference domain match | Names can be copied; providers serve many merchants |
| External phishing and malware feeds | Optional configured service | Unconfigured and failed responses remain unchecked |
| Actual recipient identity | No trusted receiving-account evidence available | Always explicitly not verified |

Screenshot findings and optional payment context add individually explained criteria. Context wording is a conservative rule match, not a model judgement or proof of fraud. Local OCR extracts a link only; it does not inspect the remaining screenshot content. The three current PayPal examples contain no fabricated external lookups. Archived fictional scenarios remain reachable for compatibility and label their fixture data explicitly.

## Sources and freshness

- Domain boundaries: [Public Suffix List](https://publicsuffix.org/) through `tldts`.
- Registration: public RDAP endpoints resolved via `rdap.org`; no registration date is invented when lookup fails. Shared-platform age is not presented as merchant age.
- DNS: [Cloudflare DNS-over-HTTPS JSON endpoint](https://developers.cloudflare.com/1.1.1.1/encryption/dns-over-https/make-api-requests/dns-json/). Hostname-only A and AAAA queries have a four-second timeout.
- Brand/provider references: `src/engine/reference.ts`, curated and incomplete. This is a reference match, not a live certificate or legal-ownership check.
- VirusTotal influenced the separation of findings, evidence and missing results. [VirusTotal URL-object documentation](https://docs.virustotal.com/reference/url-object) describes per-engine categories and analysis dates. BeforePay does not import those scanner results or submit user URLs to VirusTotal.

Each report records its analysis time and engine version. A report cannot predict future changes to a domain or payment account.

## Interpretation limits

The project does not measure real-world fraud prevalence, sensitivity or specificity. The 114-address regression corpus consists of known/reference addresses and illustrative edge cases. It verifies intended rule behaviour rather than giving a security certification.

The public Pages app runs independently without a backend. Optional Google Safe Browsing v5 or Web Risk and Companies House remain unchecked; the prepared API handlers require a separate server and secrets. The published router does not expose the experimental shortener-expansion or remote-vision handlers. Submitted payment pages and shortener links are never fetched. Google receives the destination URL for an enabled reputation lookup.
