# Activar las comprobaciones externas

La app funciona sin claves. El lector de capturas y QR trabaja en el dispositivo. La versión pública se publica exclusivamente en GitHub Pages, sin conectar ningún servidor externo. Pages no ejecuta los handlers de `api/`; las claves solo se pueden utilizar en desarrollo local o en un backend que se configure por separado. Nunca van en el navegador ni en variables `VITE_*`.

## 1. Companies House: gratis

1. Abre [las instrucciones oficiales](https://developer.company-information.service.gov.uk/how-to-create-an-application).
2. Pulsa **Sign in to create an application** y regístrate o inicia sesión.
3. Crea una aplicación llamada **BeforePay**, de tipo **Live**.
4. Selecciona **Create new key**, tipo **API key**.
5. Guarda el valor en `COMPANIES_HOUSE_API_KEY`, en el archivo local privado `.env.local` que se ha abierto en Codex.

La búsqueda proporciona empresas con nombres parecidos; no demuestra quién controla un dominio o recibe dinero. [Datos gratuitos](https://www.api.gov.uk/ch/companies-house/) y [límites oficiales](https://developer.company-information.service.gov.uk/developer-guidelines/).

## 2. Google: elige una alternativa

### Demo sin uso comercial: Safe Browsing v5

1. Abre [Safe Browsing en Google Cloud](https://console.cloud.google.com/apis/library/safebrowsing.googleapis.com).
2. Crea o selecciona un proyecto **BeforePay** y activa la API.
3. En **APIs & Services → Credentials → Create credentials → API key**, crea la clave.
4. Restringe la clave a **Safe Browsing API**. No uses una restricción por referente del navegador para una clave que se emplea desde el servidor.
5. Guarda el valor en `GOOGLE_SAFE_BROWSING_KEY`, en el archivo local privado.

El código usa v5. El servicio gratuito es [exclusivamente no comercial](https://developers.google.com/safe-browsing/reference).

### Producto comercial: Web Risk Lookup

1. Abre [Web Risk en Google Cloud](https://console.cloud.google.com/apis/library/webrisk.googleapis.com).
2. Activa la API y completa los requisitos de facturación que indique Google.
3. Crea una clave y restríngela a **Web Risk API**.
4. Guárdala en `GOOGLE_WEB_RISK_KEY`. Esta alternativa tiene prioridad sobre Safe Browsing si se configuran ambas.

Las primeras 100.000 consultas Lookup al mes son gratuitas; por encima puede haber cargos. Los presupuestos de Google son avisos, no un corte automático. Ajusta las cuotas para tu uso previsto. [Precios oficiales](https://cloud.google.com/web-risk/pricing).

## 3. Utilizar las claves

El archivo `.env.local` está excluido de Git y no se publica. Después de completarlo, indica en este chat que las claves están listas, sin pegar los valores. No se activarán en la web pública con el despliegue actual: GitHub Pages no ejecuta código de servidor. Sí puedes usarlas localmente con `npm run dev`. Si más adelante autorizas un backend independiente, podrán conectarse y comprobarse con `/api/status`. Subir secretos a GitHub Actions no crea ese servidor.

Para desarrollo local, Vite carga `.env.local` únicamente en los handlers del servidor; reinicia `npm run dev` después de cambiarlo.

`OPENAI_API_KEY` no es necesaria para el flujo de capturas actual. Las rutas públicas no aceptan imágenes para servicios externos. El handler experimental original se conserva como código, pero no se conecta al backend publicado.

## Privacidad y límites de coste

- Google recibe el enlace completo que debe comprobar (sin usuario, contraseña o fragmento). Los parámetros de sesión pueden formar parte del enlace; no se promete una comprobación por hash ni anonimato frente a Google.
- Companies House recibe el nombre de empresa introducido. El mensaje y el importe se analizan en el dispositivo.
- El backend usa límites de ráfaga por instancia y una caché temporal por identificadores hash. Esos límites no garantizan un presupuesto global entre instancias. Para tráfico comercial elevado, añade un límite de cuota del proveedor y un control global antes de escalar.
- El OCR descarga sus archivos públicos del lector, pero nunca envía la imagen. Su caché guarda el modelo, no tus capturas.
- Una consulta fallida sigue siendo **Not checked**; nunca se convierte en un resultado limpio.

## Otros despliegues

`npm run build:pages` construye una app independiente sin backend externo. Para conectar un servidor en el futuro, configura explícitamente `VITE_API_BASE` y despliega los handlers Web estándar de `api/router.ts` en un runtime compatible. Mantén las claves exclusivamente en sus secretos de ejecución y permite el origen de Pages. No se ha configurado ni publicado ese servidor como parte del despliegue exclusivo en GitHub.
