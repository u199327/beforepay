import { build } from 'vite'
import { readFileSync, writeFileSync } from 'node:fs'
import { execFileSync } from 'node:child_process'

process.env.SINGLE_FILE = '1'
if (process.argv.includes('--pages')) {
  process.env.VITE_BASE_PATH = '/beforepay/'
  process.env.VITE_STATIC_HOST = 'true'
}
await build()
await import('./inline-site.mjs')
const base = process.env.VITE_BASE_PATH || '/'
let html = readFileSync('dist/index.html', 'utf8')
for (const path of ['manifest.webmanifest', 'icons/icon.svg', 'icons/icon-192.png']) html = html.replaceAll(`href="${path}"`, `href="${base}${path}"`)
writeFileSync('dist/index.html', html)
writeFileSync('dist/404.html', html)
const manifest = JSON.parse(readFileSync('dist/manifest.webmanifest', 'utf8'))
manifest.start_url = base + '?source=pwa'
manifest.scope = base
manifest.share_target.action = base + '?source=share'
writeFileSync('dist/manifest.webmanifest', JSON.stringify(manifest, null, 2) + '\n')
writeFileSync('dist/.nojekyll', '')
let commit = process.env.GITHUB_SHA
if (!commit) { try { commit = execFileSync('git', ['rev-parse', 'HEAD'], {encoding: 'utf8'}).trim() } catch { commit = 'local' } }
writeFileSync('dist/build-info.json', JSON.stringify({ commit, version: '2.1.0', builtAt: new Date().toISOString() }, null, 2) + '\n')
