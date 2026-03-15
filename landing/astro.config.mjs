import { defineConfig } from 'astro/config'
import tailwind from '@tailwindcss/vite'

const isGitHubPages = process.env.GITHUB_ACTIONS === 'true'

export default defineConfig({
  output: 'static',
  site: 'https://arach.github.io',
  base: isGitHubPages ? '/operate' : '/',
  vite: {
    plugins: [tailwind()],
  },
})
