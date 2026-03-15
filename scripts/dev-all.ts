#!/usr/bin/env bun
/**
 * Start landing + docs + proxy. All dev servers under one port (4320).
 */
const LANDING_PORT = 41791
const DOCS_PORT = 41792

const landing = Bun.spawn({
  cmd: ["bun", "run", "dev"],
  cwd: import.meta.dir + "/../landing",
  stdout: "inherit",
  stderr: "inherit",
  env: { ...process.env },
})

const docs = Bun.spawn({
  cmd: ["bun", "run", "dev"],
  cwd: import.meta.dir + "/../docs-site",
  stdout: "inherit",
  stderr: "inherit",
  env: { ...process.env },
})

// Brief wait for servers to start
await new Promise((r) => setTimeout(r, 3000))

// Start proxy
const proxy = Bun.spawn({
  cmd: ["bun", "run", "scripts/dev-proxy.ts"],
  cwd: import.meta.dir + "/..",
  stdout: "inherit",
  stderr: "inherit",
})

console.log("\nDev: http://localhost:41790")
console.log("  /       -> landing :41791")
console.log("  /docs/* -> docs :41792\n")

process.on("SIGINT", () => {
  landing.kill()
  docs.kill()
  proxy.kill()
  process.exit(0)
})

await Promise.all([landing.exited, docs.exited, proxy.exited])
