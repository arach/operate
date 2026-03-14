# API Reference

Operate exposes a JSON-over-HTTP API on `http://127.0.0.1:8787` by default.

## Conventions

- Request/response: JSON
- Success status codes:
  - `200` for reads
  - `201` for created/executed operations
  - `202` for accepted async operations
- Error body shape:

```json
{ "error": "message" }
```

---

## Health

### `GET /health`

Returns service health and active transport.

Example response:

```json
{
  "ok": true,
  "service": "operate",
  "transport": "ssh"
}
```

---

## Inventory

### `GET /inventory`

Returns latest inventory snapshot.

### `POST /inventory/discover`

Probe explicit hosts.

Request:

```json
{ "hosts": ["arts", "art@100.115.12.115"] }
```

### `POST /inventory/discover/tailscale`

Discover from Tailscale and probe discovered hosts.

Request (all optional):

```json
{
  "includeOffline": false,
  "sourcePreference": "both"
}
```

`sourcePreference` values: `ip | dns | both`

---

## Runtime Catalog + Execution

### `GET /runtimes`

Returns known runtimes and currently supported adapters.

### `POST /runtimes/:runtime/tools`

Run runtime-specific tool listing/help.

Request:

```json
{ "host": "arts", "timeoutMs": 5000 }
```

### `POST /runtimes/:runtime/execute`

Run runtime command args on target host.

Request:

```json
{
  "host": "arts",
  "args": ["--version"],
  "timeoutMs": 5000
}
```

Supported runtime path segment values:

- `hermes`
- `opencode`
- `claude`

---

## Routing

### `POST /route/plan`

Score and select best host/runtime candidate.

Request (all optional):

```json
{
  "requiredRuntime": "opencode",
  "preferredRuntime": "opencode",
  "preferredHost": "arts"
}
```

---

## OpenCode Dispatch (Mode-based)

### `POST /opencode/dispatch`

First-class OpenCode modes:

- `command`: one-shot job-style run
- `agent`: persistent session-oriented run

Command mode request:

```json
{
  "host": "arts",
  "mode": "command",
  "message": "echo hello",
  "jobMode": "sync"
}
```

Agent mode request:

```json
{
  "host": "arts",
  "mode": "agent",
  "sessionName": "op-agent",
  "message": "continue where we left off"
}
```

---

## Jobs

### `GET /jobs`

List job records.

### `POST /jobs`

Create and run job.

Request:

```json
{
  "host": "arts",
  "runtime": "opencode",
  "args": ["run", "--help"],
  "mode": "async",
  "timeoutMs": 10000
}
```

`mode` values:

- `sync`: endpoint waits for completion
- `async`: endpoint returns `202` and queue processes in background

### `GET /jobs/:id`

Get a single job.

### `POST /jobs/:id/retry`

Reset failed/completed job to queued and re-run.

---

## Sessions (tmux-backed)

### `POST /sessions`

Create named remote tmux session.

Request:

```json
{
  "host": "arts",
  "name": "op-agent",
  "command": "opencode run",
  "cwd": "/Users/art/dev/operate",
  "keepAlive": true
}
```

### `POST /sessions/check`

Check tmux readiness.

Request:

```json
{ "host": "arts" }
```

### `POST /sessions/list`

List sessions on host.

### `POST /sessions/:name/send`

Send text to session.

Request:

```json
{ "host": "arts", "text": "echo HELLO", "enter": true }
```

### `POST /sessions/:name/capture`

Capture pane output.

Request:

```json
{ "host": "arts", "lines": 200 }
```

### `POST /sessions/:name/kill`

Kill named session.

Request:

```json
{ "host": "arts" }
```

---

## Privileged (Explicitly Gated)

### `POST /privileged/sudo`

Runs sudo command with provided password when feature gate is enabled.

Requirements:

- `OPERATE_ENABLE_PRIVILEGED=1` on server

Request:

```json
{
  "host": "arts",
  "command": "whoami",
  "password": "...",
  "timeoutMs": 30000
}
```

Security note: prefer `sudo -n` allowlists or helper services for production.
