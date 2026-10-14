# BeforePay: boceto de pitch

**Duración:** 1:30 (estructura oficial del hackathon) · **Track:** Fraud and security
**Web para la demo:** https://u199327.github.io/beforepay/

> El guion en inglés es lo que se dice en voz alta. Las notas en español son para quien presenta.
> El jurado puntúa: impacto real (30 %), originalidad (25 %), ejecución (25 %), confianza y responsabilidad (20 %).

---

## Reparto sugerido

| Quién | Parte | Tiempo |
| --- | --- | --- |
| Persona 1 | The person + Why now | 0:00 – 0:25 |
| Persona 2 | Demo en directo (maneja el portátil) | 0:25 – 1:05 |
| Persona 1 | Trust + Close | 1:05 – 1:30 |

Si presenta una sola persona, otra maneja el portátil y la que habla nunca toca el teclado.

---

## 0:00 – The person (15 s)

**Pantalla:** la home de BeforePay, con el titular "Know before you pay."

**Say:**
> "Meet Sam. Sam found a sofa on Vinted for £340. The seller sends a link: *pay here to keep your buyer protection*. It looks right. It has a padlock. Sam has no way to know who's actually behind it, and once the money's gone, it's gone."

**Notas:** di "£340" con calma; es el número que el jurado recuerda. Mira al jurado, no a la pantalla.

---

## 0:15 – Why now (10 s)

**Say:**
> "Until now, the only check was a padlock, and every scam site has one. Now payments arrive as links in chats, texts and QR stickers, and the evidence to check them is public: domain registries, brand records, payment providers. Nobody puts it in front of the person paying."

**Notas:** si sobra tiempo, añade "in the UK, banks now have to refund these scams", que prepara el cierre.

---

## 0:25 – Demo en directo (40 s) · el momento "wow" antes de 1:00

**Antes de empezar:** la pestaña ya abierta en la home, con zoom al 125 % para que se lea. Ten el mensaje copiado en el portapapeles:

```
Hi! Pay here to keep Vinted buyer protection: https://vinted-buyerprotection-uk.com/pay/88412 (2 other buyers waiting)
```

| Tiempo | Acción | Say |
| --- | --- | --- |
| 0:25 | Pega el mensaje entero y pulsa **Check payment** | "Sam pastes the seller's whole message. BeforePay never opens the link; it reads the address the way a fraud analyst would." |
| 0:33 | Aparece el resultado rojo | "**Warning signs detected.** It uses Vinted's name on someone else's domain. And one clear next step: pay inside the Vinted app." |
| 0:42 | Baja a la **Merchant Identity Card** | "This is the part nobody else shows. Website owner, merchant, payment processor, and who actually receives the money. Four different parties. Here, none of them is verified, and we say so: **Actual recipient: Not verified.**" |
| 0:55 | Escribe "Vinted" en *Who were you expecting to pay?* → **Compare** | "Sam tells us who they meant to pay. Mismatch confirmed, with the evidence one tap away." |

**Plan B si falla la red o el directo:** pulsa **Example B — Fake marketplace payment**. Funciona sin conexión y cuenta la misma historia.

**Plan C:** reproduce el vídeo `BeforePay-pitch-1m30.mp4` desde 0:25.

---

## 1:05 – Trust (15 s)

**Pantalla:** "New check" → baja a **What BeforePay checks** (la lista en vivo de Live / Not configured).

**Say:**
> "What's real: the address analysis, impersonation checks on 36 brands, payment-provider detection, and live registry lookups. What's mocked: our three demo merchants. Threat feeds and AI screenshot reading need API keys, and until then we say *Not checked*, never a fake pass. We never open the link, never store anything, and we strip session tokens before anything is shown."

**Notas:** esta es la parte de "Trust & responsibility" (20 %). Señala la lista en pantalla; prueba en lugar de prometer.

---

## 1:20 – Close (10 s)

**Say:**
> "Sam uses it free. Banks and payment apps pay to embed it, because they now refund scam victims, so every scam stopped saves them money. BeforePay. **Know before you pay.**"

**Notas:** para en "Know before you pay." y no añadas nada más. Los jueces cortan a la 1:30.

---

## Por qué gana en cada criterio

| Criterio | Peso | Qué decimos o enseñamos |
| --- | --- | --- |
| Impacto real | 30 % | Cualquiera que paga por enlace o QR; Sam y los 340 £; el ahorro para los bancos |
| Originalidad | 25 % | No es otra puntuación de riesgo: la Merchant Identity Card separa dueño ≠ comercio ≠ procesador ≠ receptor |
| Ejecución | 25 % | Demo en directo con un enlace real, web pública, PWA instalable, 19 tests |
| Confianza | 20 % | Nunca dice "seguro", "Not checked" honesto, no abre enlaces, no guarda nada, oculta tokens |

---

## Preguntas probables del jurado (y respuesta corta)

**"How is this different from Google Safe Browsing or a URL scanner?"**
> "Those only tell you if a link is already on a blocklist. New scam sites aren't listed for days. We check identity: whose domain it is, whether it impersonates a brand, how old it is, and who can actually be verified behind the payment."

**"What if a legitimate shop gets flagged?"**
> "We only show *Warning* for concrete evidence, like impersonation or a days-old domain. An unknown small shop gets *Identity not verified*, not *Warning*. We test against false positives: *pineapple-bakery* doesn't trigger Apple."

**"Can you really know who receives the money?"**
> "Usually not, and that's the point. We never guess. When it can't be proven, we say *Actual recipient: Not verified*. With bank-side data, such as Confirmation of Payee, that field could become verified."

**"Who pays, concretely?"**
> "Free for consumers. Banks, payment apps and marketplaces license it as an API or SDK at the moment before payment, where reimbursement costs are decided."

**"What's the AI doing?"**
> "It only reads a screenshot: the name shown, the amount, the visible link. It never decides. The verdict comes from transparent rules."

**"What's next?"**
> "Turn on threat feeds and AI on a server deployment, connect UK Companies House, and pilot it as a pre-payment check inside a banking app."

---

## Checklist antes de salir

- [ ] Web abierta en https://u199327.github.io/beforepay/ con zoom al 125 %
- [ ] El mensaje de Vinted copiado en el portapapeles
- [ ] Wi-Fi comprobada; Example B preparado como plan B
- [ ] Vídeo `BeforePay-pitch-1m30.mp4` a mano como plan C
- [ ] Cronómetro a la vista: Trust empieza a la 1:05 como tarde
- [ ] Última frase ensayada: "Know before you pay."
