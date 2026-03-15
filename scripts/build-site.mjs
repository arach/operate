#!/usr/bin/env node
/**
 * Build combined site: docs + landing.
 * 1. Build docs-site to dist/
 * 2. Build landing to landing/dist/
 * 3. Copy landing output over docs dist (landing index overwrites docs index)
 */
import { execSync } from 'child_process'
import { cpSync, existsSync, mkdirSync } from 'fs'
import { join } from 'path'
import { fileURLToPath } from 'url'

const __dirname = fileURLToPath(new URL('.', import.meta.url))
const root = join(__dirname, '..')
const docsDist = join(root, 'docs-site', 'dist')
const landingDist = join(root, 'landing', 'dist')

const env = { ...process.env, GITHUB_ACTIONS: process.env.GITHUB_ACTIONS || '' }

console.log('Building docs-site…')
execSync('bun run build', { cwd: join(root, 'docs-site'), stdio: 'inherit', env })

console.log('Building landing…')
execSync('bun run build', { cwd: join(root, 'landing'), stdio: 'inherit', env })

if (!existsSync(landingDist)) {
  console.error('Landing build failed: dist not found')
  process.exit(1)
}

console.log('Merging landing into docs dist…')
// Copy landing index.html (overwrites docs redirect)
cpSync(join(landingDist, 'index.html'), join(docsDist, 'index.html'), { force: true })
// Copy landing _astro assets (merge)
const landingAstro = join(landingDist, '_astro')
if (existsSync(landingAstro)) {
  const docsAstro = join(docsDist, '_astro')
  if (!existsSync(docsAstro)) mkdirSync(docsAstro, { recursive: true })
  cpSync(landingAstro, docsAstro, { recursive: true, force: true })
}
// Copy landing favicon if different
const landingFavicon = join(landingDist, 'favicon.svg')
if (existsSync(landingFavicon)) {
  cpSync(landingFavicon, join(docsDist, 'favicon.svg'), { force: true })
}

console.log('Done. Output in docs-site/dist/')
