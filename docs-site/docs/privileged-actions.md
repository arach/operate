# Privileged Actions Strategy (Password-Required Operations)

## Goal

Operate should remain non-interactive and auditable by default, while still allowing privileged operations when absolutely necessary.

## Recommended Policy

1. **Default: user-level operations only**
   - Prefer user-scoped installers and package managers (e.g., Nix profile, user-space tools).
   - Avoid `sudo` in standard automation flows.

2. **No password prompts in automated paths**
   - Operate API/CLI endpoints should not rely on interactive password entry.
   - Any operation requiring a password must fail fast with a structured blocker message.

3. **Escalation via explicit allowlist**
   - Introduce a dedicated privileged action endpoint that only allows pre-approved commands.
   - Require host + command template ID + arguments validation.

4. **Use dedicated privilege channels**
   - Prefer one of:
     - `sudo -n` (non-interactive) with pre-configured NOPASSWD for specific command paths.
     - Root-owned helper service with a narrow RPC surface (most secure for production).

5. **Never pass raw secrets in prompts/messages**
   - No plaintext password forwarding through model prompts or normal job payloads.
   - If secrets are required, use host-local secret stores or pre-provisioned credentials.

6. **Auditability**
   - Every privileged action should log:
     - actor/request source
     - host
     - allowlisted action ID
     - start/end time
     - result (success/failure) + non-sensitive error summary

## Practical Flow

1. Try user-level method first (Nix profile / user install).
2. If blocked by permissions, return a clear error with exact required privileged step.
3. Run privileged step only through approved mechanism (NOPASSWD command or helper service).
4. Re-run readiness checks and proceed with normal automation.

## Current Explicit Sudo Path (Implemented)

- Endpoint: `POST /privileged/sudo`
- CLI: `bun run cli privileged sudo --host <host> --command '<cmd>' --password '<pw>' [--timeout 30000]`
- Hard gate: must set `OPERATE_ENABLE_PRIVILEGED=1`

### Important Risk Note

Passing passwords as CLI flags can leak via shell history or process inspection.
Use this path only for controlled environments and prefer migration to:

- `sudo -n` + NOPASSWD allowlisted commands
- dedicated root helper service with narrow RPC interface

## Current Project Guidance

- For Arts Mini, `tmux` installation is solved using user-level Nix:
  - `nix --extra-experimental-features 'nix-command flakes' profile add nixpkgs#tmux`
- This avoids password prompts and aligns with Operate's non-interactive execution model.
