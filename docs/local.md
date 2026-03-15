# Operate Local

One-off AI runs on your machine, small model by default. No remote hosts, no sessions, no interference with other agents.

## When to use

- Quick commit message
- One-off question
- Small task you don't want to route to a bigger model or remote host

## Usage

```bash
# Default: haiku (small, fast)
bun run operate local "write a commit message"

# Explicit model
bun run operate local "summarize this diff" --model sonnet
bun run operate local "explain this code" --model opus

# Full provider/model format
bun run operate local "hello" --model anthropic/claude-3-5-haiku-latest
```

## Requirements

- Operate server running (`bun run start`)
- OpenCode installed locally
- SSH to localhost working (for the default transport)

Model aliases: `haiku`, `sonnet`, `opus` map to current Anthropic models.
