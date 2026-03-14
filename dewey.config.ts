export default {
  project: {
    name: "operate",
    tagline: "Machine-aware control plane for remote agent execution",
    type: "generic"
  },

  agent: {
    criticalContext: [
      "Prefer session-backed workflows for long-running remote agent context",
      "Use host aliases from .operate.json (for example: arts)",
      "Treat privileged sudo execution as explicit and gated"
    ],
    entryPoints: {
      server: "src/index.ts",
      cli: "src/cli.ts",
      sessions: "src/tmux-sessions.ts",
      jobs: "src/jobs.ts"
    },
    rules: [
      { pattern: "session", instruction: "Use tmux session APIs for persistent context" },
      { pattern: "privileged", instruction: "Check docs/privileged-actions.md before enabling sudo paths" },
      { pattern: "tailscale", instruction: "Use inventory/discover/tailscale for dynamic host discovery" }
    ],
    sections: ["overview", "quickstart", "api"]
  },

  docs: {
    path: "./docs",
    output: "./",
    required: ["overview", "quickstart", "architecture", "api"]
  },

  install: {
    objective: "Install and run Operate locally for remote host orchestration.",
    doneWhen: {
      command: "bun run operate health",
      expectedOutput: "\"ok\": true"
    },
    prerequisites: ["Bun", "SSH access to target hosts"],
    steps: [
      { description: "Install dependencies", command: "bun install" },
      { description: "Start Operate server", command: "bun run start" },
      {
        description: "Set default CLI URL",
        command: "bun run operate config set-url http://127.0.0.1:8787"
      }
    ]
  }
};
