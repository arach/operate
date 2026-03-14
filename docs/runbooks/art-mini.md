# Runbook: Arts Mini

This runbook captures the working remote setup and routine operations for `arts`.

## Host alias

- Alias: `arts`
- Target: `art@100.115.12.115`

Configured in `.operate.json`.

## Baseline checks

```bash
bun run operate health
bun run operate config alias list
bun run operate session check --host arts
```

## Repo checkout/update on Arts

Use a persistent bootstrap session:

```bash
bun run operate session create-agent --host arts --name op-bootstrap --cwd /Users/art/dev
bun run operate session send --host arts --name op-bootstrap --text "if [ -d /Users/art/dev/operate/.git ]; then cd /Users/art/dev/operate && git fetch --all --prune && git checkout master && git pull --ff-only; else cd /Users/art/dev && git clone git@github.com:arach/operate.git; fi"
bun run operate session capture --host arts --name op-bootstrap --lines 200
```

## tmux provisioning on Arts (user-level Nix)

```bash
ssh art@100.115.12.115 "nix --extra-experimental-features 'nix-command flakes' profile add nixpkgs#tmux"
```

Then verify:

```bash
bun run operate session check --host arts
```

## OpenCode long-running session

```bash
bun run operate session create-agent --host arts --name op-agent
bun run operate agent arts -s op-agent -- "echo hello from persistent session"
bun run operate session capture --host arts --name op-agent --lines 120
```

## Dewey docs-site (Astro + Hudson)

Regenerate on Arts:

```bash
ssh art@100.115.12.115 "cd /Users/art/dev/operate && npm i -D @arach/dewey@latest && rm -rf docs-site && npx dewey create docs-site --source ./docs --template astro --theme hudson"
ssh art@100.115.12.115 "cd /Users/art/dev/operate/docs-site && npm install"
```

Run in tmux:

```bash
ssh art@100.115.12.115 "tmux kill-session -t docs-site-dev 2>/dev/null || true"
ssh art@100.115.12.115 "tmux new-session -d -s docs-site-dev -c /Users/art/dev/operate/docs-site 'npm run dev -- --host 0.0.0.0 --port 4321; exec zsh'"
```

Open docs site:

`http://100.115.12.115:4321/docs/overview`

## Shutdown / cleanup

```bash
bun run operate session kill --host arts --name op-agent
ssh art@100.115.12.115 "tmux kill-session -t docs-site-dev 2>/dev/null || true"
```
