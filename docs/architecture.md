# Operate Architecture (Phase 1)

## Goal

Operate acts as a machine-aware service discovery and routing control plane for heterogeneous agent runtimes.

## Planes

### 1. Control Plane (`operate`)

- Keeps machine inventory and runtime capabilities
- Exposes API for discovery and snapshot retrieval
- Provides stable semantics for later scheduling/routing

### 2. Execution Plane (remote hosts)

- Accessed over SSH only (Phase 1)
- Probed for OS/arch/hostname and runtime binaries
- Runtime detection targets:
  - Hermes Agent (`hermes`)
  - OpenCode (`opencode`)
  - Claude Code (`claude`)

## Capability Model

Each host snapshot includes:

- `machine`: identity and platform data
- `runtimes[]`: runtime name, path, version, and current status
- `probedAt`: timestamp
- `errors[]`: transport/probe errors

## Security Defaults (Phase 1)

- SSH with `BatchMode=yes`
- SSH connect timeout enforced
- Probe timeout enforced per host
- No remote file mutation (read-only probe commands)

## Current API Surface

- `POST /inventory/discover`
  - Input host list
  - Runs probes and stores latest snapshot in memory + disk (`.operate/inventory-snapshot.json`)
- `GET /inventory`
  - Returns latest snapshot (restored from disk on boot)
- `GET /runtimes`
  - Returns known runtime names and currently supported adapters
- `POST /runtimes/:runtime/tools`
  - Runs runtime-specific tool listing on target host
- `POST /runtimes/:runtime/execute`
  - Executes runtime command args on target host via adapter

## Phase 2 (in progress)

- ✅ Persistent inventory state store (JSON file)
- ✅ Adapter abstraction introduced
- ✅ Hermes adapter implemented (`execute`, `listTools`)

## Phase 3 (in progress)

- ✅ Additional adapters implemented (OpenCode, Claude)
- ✅ Routing policy endpoint (`POST /route/plan`) with scored candidates
- ✅ Job lifecycle skeleton (`queued/running/completed/failed`)

## Phase 4 (in progress)

- ✅ Persistent jobs store (JSON file)
- ✅ Async worker queue for `mode: "async"` jobs
- ✅ Retry control endpoint (`POST /jobs/:id/retry`)
- ⏭ Streaming lifecycle and cancellation semantics
- ⏭ Durable queue semantics (priorities, backoff, dead-letter)
