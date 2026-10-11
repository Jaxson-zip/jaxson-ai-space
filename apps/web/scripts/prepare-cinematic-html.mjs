export function prepareCinematicHtml(source) {
  let html = source.replace(/\r\n/g, '\n')
  const replacements = [
    [
      `<script>\n  if (['localhost', '127.0.0.1'].includes(location.hostname) && location.port === '4174') {\n    location.replace('http://' + location.hostname + ':3000/portfolio/jaxson_biaoge_restart.html' + location.search + location.hash);\n  }\n</script>`,
      '<script src="./config.js"></script>',
    ],
    [
      `new URL('/ai', location.port === '4174' ? 'http://localhost:3000' : location.origin)`,
      `new URL('/ai', window.JAXSON_BACKEND_ORIGIN)`,
    ],
    [
      `const endpoint = location.port === '4174'\n      ? 'http://localhost:3000/api/showcase-projects'\n      : '/api/showcase-projects';`,
      `const endpoint = new URL('/api/showcase-projects', window.JAXSON_BACKEND_ORIGIN);`,
    ],
  ]
  for (const [before, after] of replacements) {
    if (!html.includes(before) && !html.includes(after)) throw new Error(`Cannot update portfolio link: ${before.slice(0, 80)}`)
    html = html.replace(before, after)
  }
  return html
}
