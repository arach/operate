import type {
  CreateJobRequest,
  RuntimeName,
  TailscaleDiscoverRequest
} from "./types";
import type { TailscaleSourcePreference } from "./tailscale-discovery";

const BASE_URL = process.env.OPERATE_URL?.trim() || "http://127.0.0.1:8787";

function usage(): string {
  return [
    "operate CLI",
    "",
    "Usage:",
    "  bun run cli health",
    "  bun run cli inventory",
    "  bun run cli discover --hosts host1,host2",
    "  bun run cli discover tailscale [--include-offline] [--source ip|dns|both]",
    "  bun run cli route plan [--required hermes|opencode|claude] [--preferred-runtime hermes|opencode|claude] [--preferred-host host]",
    "  bun run cli jobs",
    "  bun run cli job get --id <job-id>",
    "  bun run cli job retry --id <job-id>",
    "  bun run cli job run --host <host> --runtime hermes|opencode|claude [--mode sync|async] [--timeout 5000] -- <args...>",
    "",
    `Default server: ${BASE_URL}`
  ].join("\n");
}

function readFlag(args: string[], flag: string): string | undefined {
  const index = args.indexOf(flag);
  if (index === -1) {
    return undefined;
  }
  return args[index + 1];
}

function hasFlag(args: string[], flag: string): boolean {
  return args.includes(flag);
}

function splitAfterSentinel(args: string[]): { before: string[]; after: string[] } {
  const index = args.indexOf("--");
  if (index === -1) {
    return { before: args, after: [] };
  }
  return {
    before: args.slice(0, index),
    after: args.slice(index + 1)
  };
}

function parseRuntime(value: string | undefined): RuntimeName {
  if (value === "hermes" || value === "opencode" || value === "claude") {
    return value;
  }
  throw new Error("runtime must be one of: hermes|opencode|claude");
}

export function parseDiscoverHostsArgs(args: string[]): string[] {
  const raw = readFlag(args, "--hosts");
  if (!raw) {
    throw new Error("--hosts is required");
  }
  const hosts = raw
    .split(",")
    .map((host) => host.trim())
    .filter((host) => host.length > 0);
  if (hosts.length === 0) {
    throw new Error("--hosts must include at least one host");
  }
  return hosts;
}

export function parseDiscoverTailscaleArgs(args: string[]): TailscaleDiscoverRequest {
  const source = readFlag(args, "--source");
  if (source && source !== "ip" && source !== "dns" && source !== "both") {
    throw new Error("--source must be one of: ip|dns|both");
  }

  const payload: TailscaleDiscoverRequest = {
    includeOffline: hasFlag(args, "--include-offline")
  };

  if (source) {
    payload.sourcePreference = source as TailscaleSourcePreference;
  }

  return payload;
}

export function parseJobRunArgs(args: string[]): CreateJobRequest {
  const { before, after } = splitAfterSentinel(args);
  const host = readFlag(before, "--host");
  const runtime = parseRuntime(readFlag(before, "--runtime"));
  const mode = readFlag(before, "--mode");
  const timeoutRaw = readFlag(before, "--timeout");

  if (!host) {
    throw new Error("--host is required");
  }

  const payload: CreateJobRequest = {
    host,
    runtime,
    args: after
  };

  if (mode) {
    if (mode !== "sync" && mode !== "async") {
      throw new Error("--mode must be sync or async");
    }
    payload.mode = mode;
  }

  if (timeoutRaw) {
    const timeoutMs = Number(timeoutRaw);
    if (!Number.isFinite(timeoutMs) || timeoutMs <= 0) {
      throw new Error("--timeout must be a positive number");
    }
    payload.timeoutMs = timeoutMs;
  }

  return payload;
}

async function request(method: string, path: string, body?: unknown): Promise<void> {
  const init: RequestInit = {
    method,
    headers: {
      "content-type": "application/json"
    }
  };

  if (body) {
    init.body = JSON.stringify(body);
  }

  const response = await fetch(`${BASE_URL}${path}`, init);

  const text = await response.text();
  let parsed: unknown = text;
  try {
    parsed = JSON.parse(text);
  } catch {}

  if (!response.ok) {
    const message = typeof parsed === "string" ? parsed : JSON.stringify(parsed, null, 2);
    throw new Error(`HTTP ${response.status}: ${message}`);
  }

  const output = typeof parsed === "string" ? parsed : JSON.stringify(parsed, null, 2);
  console.log(output);
}

async function main(argv: string[]): Promise<void> {
  const [command, ...rest] = argv;
  if (!command || command === "help" || command === "--help" || command === "-h") {
    console.log(usage());
    return;
  }

  if (command === "health") {
    await request("GET", "/health");
    return;
  }

  if (command === "inventory") {
    await request("GET", "/inventory");
    return;
  }

  if (command === "discover") {
    if (rest[0] === "tailscale") {
      await request("POST", "/inventory/discover/tailscale", parseDiscoverTailscaleArgs(rest.slice(1)));
      return;
    }
    await request("POST", "/inventory/discover", { hosts: parseDiscoverHostsArgs(rest) });
    return;
  }

  if (command === "runtimes") {
    await request("GET", "/runtimes");
    return;
  }

  if (command === "route" && rest[0] === "plan") {
    const required = readFlag(rest, "--required");
    const preferredRuntime = readFlag(rest, "--preferred-runtime");
    const preferredHost = readFlag(rest, "--preferred-host");
    const payload: Record<string, string> = {};

    if (required) {
      payload.requiredRuntime = parseRuntime(required);
    }
    if (preferredRuntime) {
      payload.preferredRuntime = parseRuntime(preferredRuntime);
    }
    if (preferredHost) {
      payload.preferredHost = preferredHost;
    }

    await request("POST", "/route/plan", payload);
    return;
  }

  if (command === "jobs") {
    await request("GET", "/jobs");
    return;
  }

  if (command === "job") {
    const subcommand = rest[0];
    if (subcommand === "get") {
      const id = readFlag(rest, "--id");
      if (!id) {
        throw new Error("--id is required");
      }
      await request("GET", `/jobs/${id}`);
      return;
    }

    if (subcommand === "retry") {
      const id = readFlag(rest, "--id");
      if (!id) {
        throw new Error("--id is required");
      }
      await request("POST", `/jobs/${id}/retry`);
      return;
    }

    if (subcommand === "run") {
      await request("POST", "/jobs", parseJobRunArgs(rest.slice(1)));
      return;
    }
  }

  throw new Error(`Unknown command: ${command}`);
}

if (import.meta.main) {
  main(process.argv.slice(2)).catch((error) => {
    const message = error instanceof Error ? error.message : String(error);
    console.error(message);
    process.exit(1);
  });
}
