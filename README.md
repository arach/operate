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

## CLI usage (clean alternative to raw curl)

```bash
# health and inventory
bun run operate health
bun run operate inventory

# explicit host discovery
bun run operate discover --hosts arts

# tailscale discovery
bun run operate discover tailscale --source ip

# route planning
bun run operate route plan --preferred-host arts --preferred-runtime opencode

# run job
bun run operate job run --host arts --runtime opencode --mode sync -- run --help

# list/get/retry jobs
bun run operate jobs
bun run operate job get --id <job-id>
bun run operate job retry --id <job-id>

# tmux sessions (long-running remote processes)
bun run operate session check --host arts
bun run operate session create --host arts --name op-test --command "opencode run --help"
bun run operate session create-agent --host arts --name op-agent
bun run operate session list --host arts
bun run operate session send --host arts --name op-test --text "echo HELLO"
bun run operate session capture --host arts --name op-test --lines 120
bun run operate session kill --host arts --name op-test

# shorthand agent UX (host alias + session)
bun run operate agent arts -s op-agent -- "echo hello from session"

# one-off local run (haiku by default, no remote, no sessions)
bun run operate local "write a commit message for my last change"
bun run operate local "summarize this" --model sonnet
```

Configure defaults (clean, no env prefix needed):

```bash
bun run operate config set-url http://127.0.0.1:8787
bun run operate config alias set arts art@100.115.12.115
bun run operate config alias list
```

Project-local alias/url config lives in `.operate.json`.
You can still override per command with `--url` or `-u`.

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
- `POST /sessions`
  - body: `{ "host": "art@100.115.12.115", "name": "op-test", "command": "opencode run --help" }`
- `POST /sessions/check`
  - body: `{ "host": "art@100.115.12.115" }`
- `POST /sessions/list`
  - body: `{ "host": "art@100.115.12.115" }`
- `POST /sessions/:name/send`
  - body: `{ "host": "art@100.115.12.115", "text": "echo hi", "enter": true }`
- `POST /sessions/:name/capture`
  - body: `{ "host": "art@100.115.12.115", "lines": 200 }`
- `POST /sessions/:name/kill`
  - body: `{ "host": "art@100.115.12.115" }`

### Async jobs behavior

When `mode: "async"`, `POST /jobs` returns `202` immediately after enqueueing.
The returned job may be `queued` or `running`; poll `GET /jobs/:id` until terminal `completed|failed`.

## Privileged operations (password-required tasks)

Operate is designed for non-interactive execution.

- Prefer user-level installs/commands first (e.g., Nix profile).
- Avoid interactive `sudo` prompts in API/CLI paths.
- For privileged workflows, use an explicit allowlisted mechanism (future phase).

Current explicit path (disabled by default):

- Set `OPERATE_ENABLE_PRIVILEGED=1`
- Run:
  - `bun run cli privileged sudo --host <host> --command '<cmd>' --password '<pw>'`

Security caveat:

- Password values passed on CLI can be exposed via shell history/process inspection.
- Prefer host-level `NOPASSWD` allowlists or dedicated privileged helpers for production.

See: `docs/privileged-actions.md`

## Documentation index

- `docs/overview.md` — product goals and core concepts
- `docs/quickstart.md` — first-run setup and command flows
- `docs/architecture.md` — internals and phase progression
- `docs/runbooks/art-mini.md` — concrete operations on Arts Mini
