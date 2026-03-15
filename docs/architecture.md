# Operate Architecture

## Goal

Operate is a machine-aware control plane for orchestrating agent runtimes across remote hosts.

It standardizes:

- host discovery,
- runtime capability tracking,
- routing decisions,
- one-shot jobs,
- and long-running named sessions.

## Planes

### 1. Control Plane (`operate`)

- Maintains inventory snapshots and runtime capability state
- Exposes API/CLI for discovery, routing, jobs, and sessions
- Applies consistent execution semantics regardless of remote host differences

### 2. Execution Plane (remote hosts)

- Accessed primarily via SSH transport
- Optional WebSocket transport path is available via config
- Hosts are probed for runtime binaries and platform identity

Supported runtime targets:

- Hermes (`hermes`)
- OpenCode (`opencode`)
- Claude (`claude`)

## Capability Model

Each host inventory record contains:

- `machine` (host, hostname, os, arch)
- `runtimes[]` (name, binaryPath, version, status)
- `probedAt`
- `errors[]`

Inventory is persisted at:

- `.operate/inventory-snapshot.json`

## Execution Semantics

### Jobs (one-shot)

Jobs represent command-style execution and persist lifecycle state:

- `queued`
- `running`
- `completed`
- `failed`

Jobs persist at:

- `.operate/jobs.json`

Modes:

- `sync` (waits for completion)
- `async` (returns immediately and runs in queue worker)

### Sessions (long-running)

Operate uses remote tmux-backed named sessions for persistent context:

- create/list/check/send/capture/kill
- optional keep-alive behavior for agent workflows

This enables iterative multi-message interactions (for example OpenCode agent sessions).

### OpenCode Dispatch Modes

Operate exposes first-class OpenCode dispatch behavior:

- `command` mode: one-shot, job-oriented
- `agent` mode: session-oriented, context-preserving

## Routing

When callers do not pin an exact host/runtime pair, Operate routes by intent:

- **requiredRuntime** is a hard filter (ineligible hosts are removed)
- **preferredRuntime** and **preferredHost** are soft ranking signals
- healthy hosts receive a small bias

The result is intentionally simple for operators:

- **selected**: the best-fit host/runtime target used for dispatch
- **candidates**: ordered alternatives with reasons for fallback/debug visibility

This keeps routing user-facing (intent → target) while preserving inspectable ranking output.

## Discovery

Two discovery flows are supported:

- explicit host discovery (`/inventory/discover`)
- Tailscale-based discovery (`/inventory/discover/tailscale`)

Tailscale discovery supports source preference (`ip|dns|both`) and optional offline inclusion.

## Transport Layer

Runtime execution uses a transport abstraction:

- default: SSH (`OpenSSHExecutor`)
- optional: WebSocket command transport

This keeps runtime adapters stable while allowing future transport additions.

## Security Model

Default model is non-interactive, user-level execution.

Privileged operations are explicitly gated:

- endpoint: `POST /privileged/sudo`
- gate: `OPERATE_ENABLE_PRIVILEGED=1`

For production, prefer constrained non-interactive sudo allowlists or dedicated privileged helper services.

## API Surface

See `docs/api.md` for full endpoint reference and request/response formats.
