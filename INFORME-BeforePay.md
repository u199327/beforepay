# BeforePay — cómo funciona

**Know before you pay.** BeforePay te dice quién parece estar detrás de un pago *antes* de que salga tu dinero: qué se puede verificar, qué no, qué señales de alarma hay y qué deberías hacer.

- **Web pública:** https://u199327.github.io/beforepay/
- **Código:** https://github.com/u199327/beforepay
- **Hackathon:** Fintech Hackathon, Londres, 13 de octubre de 2026 · Track: *Fraud and security*

---

## 1. La idea en una frase

Es "Shazam para pagos online": pegas, compartes o escaneas un enlace de pago y en segundos ves si hay señales de fraude y **quién está (y quién no está) verificado** detrás del pago.

**Ejemplo (el de nuestro vídeo):** Sam encuentra un sofá en Vinted por 340 £. El vendedor le manda un enlace: *"paga aquí para mantener la protección al comprador"*. Sam pega el mensaje en BeforePay y la app le avisa de que el enlace usa el nombre de Vinted en un dominio que no es de Vinted.

---

## 2. Las dos pantallas

### Pantalla A — Comprobar un pago
- Campo grande para pegar un enlace (o un mensaje entero: la app saca el enlace del texto).
- **Scan QR** (cámara) y **Upload screenshot** (imagen con un QR).
- Tres **simulaciones** con comercios ficticios para la demo.
- Sección "What BeforePay checks": muestra en vivo qué comprobaciones están activas en este despliegue.

### Pantalla B — Informe del pago
1. **Resultado** (siempre uno de tres, nunca "es seguro"):
   - 🟩 **No known threats detected**: no encontramos señales de alarma (no es una garantía).
   - 🟨 **Identity not verified**: no hay alarmas claras, pero no podemos confirmar quién cobra.
   - 🟥 **Warning signs detected**: hay señales concretas de fraude.
2. **Una explicación** en lenguaje normal y **un siguiente paso** concreto.
3. **Merchant Identity Card** (la tarjeta oscura): separa cuatro partes que la gente confunde:

   > **Dueño de la web ≠ Comercio ≠ Procesador de pago ≠ Quien recibe el dinero**

   Cada dato lleva una etiqueta: **Verified** (con fuente), **Inferred** (indicio) o **Not verified**. Si no podemos probar quién recibe el dinero, lo decimos: **"Actual recipient: Not verified"**.
4. **Why this result?**: 4 filas de evidencia (identidad del dominio, bases de phishing, suplantación de marca, coincidencia con quien esperabas pagar). Cada una se despliega con los detalles técnicos y las fuentes.
5. **Who were you expecting to pay?**: escribes a quién querías pagar y la app comprueba si el destino encaja.
6. **What we didn't check**: lista honesta de lo que no se ha comprobado.

---

## 3. Qué comprueba el motor (todo real)

| Comprobación | Qué detecta | Ejemplo |
| --- | --- | --- |
| Lectura de la dirección | Separa protocolo, subdominio, **dominio real** y ruta (Public Suffix List) | `paypal.com.pago-seguro.net` → el dueño real es `pago-seguro.net` |
| Truco de la `@` | Texto decorativo antes de `@` que el navegador ignora | `https://paypal.com@203.0.113.9/` |
| Suplantación de marca | Nombre de una marca en un dominio ajeno (36 marcas: PayPal, Amazon, Royal Mail, HMRC, Vinted, bancos…) | `royalmail-redelivery-fee.com` |
| Dominios parecidos | Letras cambiadas, otra terminación, caracteres internacionales falsos | `paypa1.com`, `paypal.co`, `pаypal.com` (con "а" cirílica) |
| Procesadores de pago | Reconoce páginas oficiales de Stripe, PayPal, Adyen, Square, Revolut, Klarna… | `checkout.stripe.com` → procesador verificado |
| Pagos a personas | Enlaces tipo PayPal.me, monzo.me, revolut.me, Cash App | Avisa: poca o ninguna protección al comprador |
| Acortadores | bit.ly, tinyurl… ocultan el destino | Avisa de que el destino real está oculto |
| Fecha de registro del dominio | Consulta en vivo al registro oficial (RDAP) | Dominio creado hace 4 días → alarma |
| IPs y direcciones privadas | Pagos que van a un número de servidor | `http://192.168.1.4/pay` |
| Coincidencia con lo esperado | Compara el destino con a quién querías pagar | Esperabas "Vinted" y el dominio no es de Vinted |

**Importante:** la app **evita falsos positivos**. Por ejemplo, `pineapple-bakery.co.uk` no se marca como "Apple" y `amazonia-tours.com` no se marca como "Amazon". Hay 19 tests automáticos que lo comprueban.

---

## 4. Real vs. simulado (para el jurado)

| | Estado |
| --- | --- |
| Análisis de la dirección, suplantación, procesadores, pagos a personas | ✅ Real |
| Fecha de registro del dominio (RDAP) | ✅ Real, en vivo |
| Lectura de QR desde cámara o imagen | ✅ Real, en tu dispositivo |
| Enlaces directos `/check?url=…` y compartir desde el móvil (Android instalado) | ✅ Real |
| Base de datos de phishing (Google Safe Browsing) | 🔧 Programado; necesita clave de API. Sin ella sale **"Not checked"** |
| Lectura de capturas con IA (OpenAI) | 🔧 Programado; necesita clave de API y servidor |
| Búsqueda en Companies House (registro de empresas UK) | 🔧 Programado; necesita clave de API |
| Las 3 simulaciones (Northfield, Marketfold, Kerbway) | 🎭 Comercios **ficticios**, datos de registro simulados y marcados como tal |

**Regla de oro:** si algo no está configurado, la app dice **"Not checked"**, nunca "todo bien".

---

## 5. Cómo protegemos al usuario

- **Nunca abrimos el enlace** ni iniciamos ningún pago: solo leemos la dirección.
- **No guardamos nada:** sin cuentas, sin historial.
- **Ocultamos datos sensibles:** tokens de sesión, emails y números tipo tarjeta se borran del informe y de los enlaces compartidos.
- **El servidor nunca visita URLs del usuario** (protección contra SSRF); solo consulta servicios fijos y conocidos.
- **Los QR se leen en tu móvil.** Una captura solo sale del dispositivo si eliges leerla con IA.
- **La IA no decide:** solo extrae lo que se ve en la imagen; la decisión la toman las reglas.

---

## 6. Cómo hacer la demo (30 segundos)

1. Abre https://u199327.github.io/beforepay/
2. Pulsa **Example B — Fake marketplace payment** → sale **Warning signs detected**.
3. Baja a la **Merchant Identity Card** → enseña "Actual recipient: Not verified".
4. Vuelve y pega este mensaje en el campo:
   `Your parcel is on hold. Pay £1.99: https://royalmail-redelivery-fee.com/pay`
   → detecta la suplantación de Royal Mail en directo.
5. Prueba también un enlace real, por ejemplo `https://www.paypal.com/checkoutnow` → **No known threats detected**, con la fecha de registro real del dominio.

**Enlaces directos a las simulaciones:**
- A (checkout normal): https://u199327.github.io/beforepay/check?demo=ordinary
- B (marketplace falso): https://u199327.github.io/beforepay/check?demo=marketplace
- C (QR de parking): https://u199327.github.io/beforepay/check?demo=parking

---

## 7. Modelo de negocio (quién paga)

- **Gratis para usuarios** como Sam.
- **Bancos y apps de pago** pagan por integrarlo: en Reino Unido ahora tienen que reembolsar a las víctimas de estafas de pago autorizado (APP fraud), así que cada estafa evitada les ahorra dinero.

---

## 8. Tecnología

- **Frontend:** React 19 + TypeScript + Tailwind CSS v4, iconos Lucide, tipografías Schibsted Grotesk y Geist Mono.
- **Motor:** TypeScript puro (`src/engine/`), con `tldts` (Public Suffix List), `punycode` y `jsQR`.
- **Servidor opcional:** funciones en `api/` (estilo Vercel) para RDAP, Safe Browsing, OpenAI y Companies House.
- **PWA:** instalable, funciona sin conexión y aparece en el menú de compartir de Android.
- **Despliegue:** GitHub Pages (estático). Con Vercel se activarían las funciones de servidor.

### Ejecutar en local
```bash
git clone https://github.com/u199327/beforepay.git
cd beforepay
npm install
npm run dev     # app + funciones de servidor en localhost
npm test        # 19 tests del motor
```

---

## 9. Limitaciones conocidas

- Sin claves de API, las bases de phishing, la IA y Companies House salen como "Not checked".
- La lista de marcas cubre 36 marcas; las que no están en la lista no se detectan como suplantación.
- En iPhone no se puede compartir directamente a la app (limitación de iOS): hay que copiar y pegar.
- Ninguna comprobación garantiza que un pago sea seguro; BeforePay es una herramienta informativa, no asesoramiento financiero.
