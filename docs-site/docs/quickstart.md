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

![Operate jobs and sessions flow](/diagrams/operate-jobs-sessions-flow.svg)

_Dispatch behavior: command mode flows through persisted jobs, while agent mode creates/uses tmux-backed named sessions._

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
