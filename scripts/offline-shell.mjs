import { readFileSync, writeFileSync, readdirSync } from 'node:fs'
import { createHash } from 'node:crypto'
const files = ['index.html', 'manifest.webmanifest', ...readdirSync('dist/assets').map(n => 'assets/' + n), ...readdirSync('dist/icons').map(n => 'icons/' + n)]
const hash = createHash('sha256').update(files.map(n => readFileSync('dist/' + n)).join('')).digest('hex').slice(0, 12)
const sw = readFileSync('public/sw.js', 'utf8').replace(/const CACHE = .*?\n/, `const CACHE = 'beforepay-${hash}'\n`).replace(/const SHELL = .*?\n/, `const SHELL = ${JSON.stringify(['./', ...files.filter(n => n !== 'index.html').map(n => './' + n)])}\n`)
writeFileSync('dist/sw.js', sw)
