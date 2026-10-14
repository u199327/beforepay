# A 60-second demo

1. Open [BeforePay](https://aleetreny.github.io/beforepay/).
2. In **Try a simulation**, choose **PayPal hidden-destination trick**. Point to the large address: `paypal.com@` is a decoy; the browser goes to `payments.example`.
3. Show **Interpretable checks** and filter to **Needs attention**. Every finding has a reason; absent external feeds remain **Not checked**.
4. Choose **New check**, then **PayPal checkout** in the simulation panel. The reference domain is recognised, but the actual receiving merchant remains unknown.
5. Choose **PayPal.Me recipient unknown**. Explain that the provider's domain does not authenticate the account holder.
6. To demonstrate real lookups, paste `https://www.paypal.com/checkoutnow` into the input. Open **Domain registration age** and **Public DNS availability**. Availability depends on the network and registry; the rules still return a report if lookups fail.
7. For QR input, [save this QR](https://aleetreny.github.io/beforepay/demo-qr-warning.png) and use **Upload screenshot**. It contains the illustrative `@` trick.

## Say what is real

The address rules, provider detection, expected-merchant checks and QR decoding run on-device. DNS and RDAP make real network queries for ordinary pasted links. The PayPal simulations run deterministic address rules and leave external lookups unchecked.

Screenshot OCR works on-device without a key. Safe Browsing v5 / Web Risk and Companies House need a separate backend and server secrets; they are not connected on GitHub Pages. See API_SETUP.md. VirusTotal is an optional external domain-report link, not a connected scanner.

**One sentence for the judges:** “Every warning comes with a reason, every missing check stays visible, and a recognised provider never becomes an invented beneficiary.”
