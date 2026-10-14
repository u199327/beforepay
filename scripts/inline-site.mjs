import { readFileSync, writeFileSync, readdirSync } from 'node:fs'
let html = readFileSync('dist/index.html', 'utf8')
for (const file of readdirSync('dist/assets')) {
  if (file.endsWith('.js')) {
    const code = readFileSync('dist/assets/' + file, 'utf8').replace(/<\/script/gi, '<\\/script')
    html = html.replace(/<script[^>]*src="[^"]*\/assets\/[^"]+\.js"[^>]*><\/script>/, () => '<script type="module">' + code + '</script>')
  }
  if (file.endsWith('.css')) {
    const css = readFileSync('dist/assets/' + file, 'utf8')
    html = html.replace(/<link[^>]*href="[^"]*\/assets\/[^"]+\.css"[^>]*>/, () => '<style>' + css + '</style>')
  }
}
writeFileSync('dist/index.html', html)
console.log('Published entry point includes application code and styles in one response.')
