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

## Phase 4 (in progress)

- Persistent jobs store (`.operate/jobs.json`)
- Async queue mode for jobs (`mode: "async"`)
- Job retry endpoint

## Phase 5 (in progress)

- Transport factory with env selection (`ssh` or `websocket`)
- WebSocket command transport for RPC-style execution

## Quickstart

```bash
bun install
bun run dev
```

Default server: `http://localhost:8787`

## Transport configuration

Defaults to SSH transport.

```bash
# default
OPERATE_TRANSPORT=ssh

# websocket mode
OPERATE_TRANSPORT=websocket
OPERATE_WS_URL=ws://127.0.0.1:9090
OPERATE_WS_AUTH_TOKEN=your-token
OPERATE_WS_CONNECT_TIMEOUT_MS=5000
```

WebSocket transport expects request/response messages correlated by `id`:

- Request: `{ "id": "...", "type": "run", "host": "...", "command": "...", "timeoutMs": 5000 }`
- Response: `{ "id": "...", "stdout": "...", "stderr": "...", "exitCode": 0 }`

## Tailscale discovery configuration

For built-in endpoint `POST /inventory/discover/tailscale`:

- `OPERATE_TAILSCALE_BIN` (optional): explicit path to tailscale binary
  - Example macOS App Store path: `/Applications/Tailscale.app/Contents/MacOS/Tailscale`
- `OPERATE_TAILSCALE_SSH_USER` (optional): default SSH user for IP-based targets

If using the macOS app binary path, Operate forces `TAILSCALE_BE_CLI=1` for CLI-safe scripting.

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
  - body: `{ "host": "macmini.local", "runtime": "hermes", "args": ["chat", "-q", "hello"], "mode": "sync|async" }`
- `GET /jobs/:id`
- `POST /jobs/:id/retry`

### Async jobs behavior

When `mode: "async"`, `POST /jobs` returns `202` immediately after enqueueing.
The returned job may be `queued` or `running`; poll `GET /jobs/:id` until terminal `completed|failed`.
