# Operate

Operate is a control-plane service for machine-aware agent routing.

## Phase 2 (in progress)

- SSH-based machine discovery
- Runtime inventory probes (Hermes, OpenCode, Claude Code)
- Disk-backed inventory snapshots
- Runtime adapter contract + Hermes adapter

## Phase 3 (in progress)

- OpenCode + Claude runtime adapters
- Route planning endpoint (`/route/plan`)
- Job lifecycle skeleton (`queued/running/completed/failed`)

## Quickstart

```bash
bun install
bun run dev
```

Default server: `http://localhost:8787`

## API

- `GET /health`
- `POST /inventory/discover`
  - body: `{ "hosts": ["macmini.local", "devbox"] }`
- `GET /inventory`
- `GET /runtimes`
- `POST /runtimes/hermes/tools`
  - body: `{ "host": "macmini.local" }`
- `POST /runtimes/hermes/execute`
  - body: `{ "host": "macmini.local", "args": ["chat", "-q", "status check"] }`
- `POST /route/plan`
  - body: `{ "requiredRuntime": "hermes" }` (all fields optional)
- `GET /jobs`
- `POST /jobs`
  - body: `{ "host": "macmini.local", "runtime": "hermes", "args": ["chat", "-q", "hello"] }`
- `GET /jobs/:id`
