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
