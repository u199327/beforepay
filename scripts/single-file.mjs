// Inlines the static build into one HTML body for hosts that only serve a single page.
import { readFileSync, writeFileSync, readdirSync } from 'node:fs'
const dir = 'dist-static'
let html = readFileSync(`${dir}/index.html`, 'utf8')
const assets = readdirSync(`${dir}/assets`)
const css = assets.filter((f) => f.endsWith('.css')).map((f) => readFileSync(`${dir}/assets/${f}`, 'utf8')).join('\n')
const js = assets.filter((f) => f.endsWith('.js')).map((f) => readFileSync(`${dir}/assets/${f}`, 'utf8')).join('\n').replaceAll('</script', '<\\/script')
const title = html.match(/<title>.*?<\/title>/)[0]
const out = `${title}
<meta name="description" content="Find out who's behind a payment, before your money leaves." />
<meta name="theme-color" content="#101820" />
<meta name="referrer" content="no-referrer" />
<style>${css}</style>
<div id="root"></div>
<script type="module">${js}</script>
`
writeFileSync(`${dir}/beforepay.html`, out)
console.log('single file', (out.length / 1e6).toFixed(2), 'MB')
