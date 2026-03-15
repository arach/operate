#!/usr/bin/env bun
/**
 * Dev proxy: serves landing + docs from one port.
 * Port 4320 -> landing (4325) and /docs -> docs (4326)
 */
const PROXY_PORT = 41790
const LANDING_PORT = 41791
const DOCS_PORT = 41792

const server = Bun.serve({
  port: PROXY_PORT,
  async fetch(req) {
    const url = new URL(req.url)
    // /docs/* and shared assets (llms.txt, favicon) -> docs; everything else -> landing
    const toDocs =
      url.pathname === "/docs" ||
      url.pathname.startsWith("/docs/") ||
      url.pathname === "/llms.txt" ||
      url.pathname === "/llms-full.txt" ||
      url.pathname === "/favicon.svg"
    const target = toDocs
      ? `http://127.0.0.1:${DOCS_PORT}`
      : `http://127.0.0.1:${LANDING_PORT}`

    const targetUrl = new URL(url.pathname + url.search, target)
    return fetch(targetUrl.toString(), {
      method: req.method,
      headers: req.headers,
      body: req.body,
    })
  },
})

console.log(`Dev proxy: http://localhost:${PROXY_PORT}`)
console.log(`  /       -> landing :${LANDING_PORT}`)
console.log(`  /docs/* -> docs :${DOCS_PORT}`)
