# Operate Landing

Standalone landing page for Operate. Built separately from docs and merged at deploy time.

## Dev

```bash
bun run dev          # landing only (port 41791)
bun run dev:all      # from repo root: landing + docs + proxy (port 41790)
```

## Build

The combined site (landing + docs) is built from the repo root:

```bash
bun run build:site
```

Output in `docs-site/dist/`.
