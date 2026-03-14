# operate

> Machine-aware control plane for remote agent execution

## Critical Context

**IMPORTANT:** Read these rules before making any changes:

- Prefer session-backed workflows for long-running remote agent context
- Use host aliases from .operate.json (for example: arts)
- Treat privileged sudo execution as explicit and gated

## Project Structure

| Component | Path | Purpose |
|-----------|------|---------|
| Server | `src/index.ts` | |
| Cli | `src/cli.ts` | |
| Sessions | `src/tmux-sessions.ts` | |
| Jobs | `src/jobs.ts` | |

## Quick Navigation

- Working with **session**? → Use tmux session APIs for persistent context
- Working with **privileged**? → Check docs/privileged-actions.md before enabling sudo paths
- Working with **tailscale**? → Use inventory/discover/tailscale for dynamic host discovery

## Overview

# Operate Overview

Operate is a machine-aware control plane for running agent workloads across remote hosts.

In practical terms, Operate lets you:

- discover reachable hosts and runtime capabilities,
- route work to the best host/runtime pair,
- run one-shot jobs,
- and maintain long-running named sessions for iterative workflows.

## Why Operate exists

Real agent workflows usually sprawl across multiple machines and runtimes. Operate provides one consistent API and CLI so execution is predictable, observable, and reusable.

## Core concepts

### Host Inventory

Operate discovers hosts (manually or via Tailscale), probes runtime availability (`hermes`, `opencode`, `claude`), and stores snapshots.

### Routing

`POST /route/plan` ranks candidates and returns a selected host/runtime based on constraints and preferences.

### Jobs (One-shot execution)

Jobs are persisted records with lifecycle states:

- `queued`
- `running`
- `completed`
- `failed`

Use jobs for command-style execution and background work.

### Sessions (Long-running execution)

Operate uses tmux-backed named sessions on remote hosts for persistent context.

Use sessions when you want iterative conversation or long-lived process state.

### Command mode vs Agent mode

For OpenCode workflows, Operate exposes two explicit modes:

- **command mode**: one-shot execution (job-oriented)
- **agent mode**: named persistent session (context-preserving)

## Current status

Operate currently supports:

- SSH transport (default)
- optional WebSocket transport (configurable)
- Tailscale-based host discovery
- tmux session lifecycle APIs
- privileged sudo path behind explicit gate (`OPERATE_ENABLE_PRIVILEGED=1`)

## Start here

- `docs/quickstart.md` for first run
- `docs/architecture.md` for system internals
- `docs/runbooks/art-mini.md` for the concrete Arts workflow

## Quickstart

# Quickstart

This quickstart gets Operate running locally, then dispatches work to a remote host alias (`arts`).

## 1) Start Operate

```bash
bun install
bun run start
```

Default API URL: `http://127.0.0.1:8787`

## 2) Configure CLI defaults

Operate supports clean, persistent config via repo/global config.

```bash
bun run operate config set-url http://127.0.0.1:8787
bun run operate config alias set arts art@100.115.12.115
```

Project-local settings are stored in `.operate.json`.

## 3) Validate control plane

```bash
bun run operate health
bun run operate config alias list
```

## 4) Discover host capabilities

```bash
bun run operate discover --hosts arts
bun run operate inventory
```

Optional Tailscale discovery:

```bash
bun run operate discover tailscale --source ip
```

## 5) Run a one-shot OpenCode command

```bash
bun run operate opencode command --host arts --message "echo hello" --job-mode sync
```

## 6) Start a persistent OpenCode agent session

```bash
bun run operate session create-agent --host arts --name op-agent
bun run operate agent arts -s op-agent -- "echo first marker"
bun run operate agent arts -s op-agent -- "echo second marker"
bun run operate session capture --host arts --name op-agent --lines 120
```

## 7) Clean up sessions

```bash
bun run operate session kill --host arts --name op-agent
```

## 8) Optional docs-site workflow (Astro + Hudson)

If Dewey docs-site exists on Arts:

```bash
bun run operate session check --host arts
bun run operate session create-agent --host arts --name docs-site-dev --cwd /Users/art/dev/operate/docs-site --command "zsh"
bun run operate session send --host arts --name docs-site-dev --text "npm run dev -- --host 0.0.0.0 --port 4321"
```

Then open:

`http://100.115.12.115:4321/docs/overview`

## Api

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

---
Generated by [Dewey 0.3.4](https://github.com/arach/dewey) | Last updated: 2026-03-14