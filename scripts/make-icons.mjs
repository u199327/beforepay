import { Resvg } from '@resvg/resvg-js'
import { readFileSync, writeFileSync } from 'node:fs'
const svg = readFileSync('public/icons/icon.svg', 'utf8')
const maskable = svg.replace('rx="112"', 'rx="0"').replace('<rect x="150"', '<g transform="translate(51 51) scale(.8)"><rect x="150"').replace('</svg>', '</g></svg>')
for (const [name, src, size] of [['icon-192.png', svg, 192], ['icon-512.png', svg, 512], ['maskable-512.png', maskable, 512]]) {
  writeFileSync(`public/icons/${name}`, new Resvg(src, { fitTo: { mode: 'width', value: size } }).render().asPng())
}
console.log('icons written')
