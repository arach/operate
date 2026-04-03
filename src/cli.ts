import type {
  CreateJobRequest,
  RuntimeName,
  TailscaleDiscoverRequest
} from "./types";
import type { TailscaleSourcePreference } from "./tailscale-discovery";
import { grabAudio, grabCheck } from "./grab";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

const DEFAULT_BASE_URL = "http://127.0.0.1:8787";
const CONFIG_DIR = join(homedir(), ".operate");
const CONFIG_PATH = join(CONFIG_DIR, "config.json");
const REPO_CONFIG_PATH = join(process.cwd(), ".operate.json");

const HOST_ALIASES: Record<string, string> = {
  arts: "art@100.115.12.115",
  local: "localhost"
};

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
    "  bun run cli session create --host <host> --name <session> [--cwd /path] [--command 'opencode run']",
    "  bun run cli session create-agent --host <host> --name <session> [--cwd /path] [--command 'opencode run']",
    "  bun run cli session check --host <host>",
    "  bun run cli session list --host <host>",
    "  bun run cli session send --host <host> --name <session> --text 'opencode run --help' [--no-enter]",
    "  bun run cli session capture --host <host> --name <session> [--lines 200]",
    "  bun run cli session kill --host <host> --name <session>",
    "  bun run cli opencode command --host <host> --message 'hello' [--job-mode sync|async]",
    "  bun run cli opencode agent --host <host> --session <name> --message 'continue from here' [--cwd /path]",
    "  bun run cli agent <host-alias> -s <session> -- <message>",
    "  bun run cli local <message> [--model haiku|sonnet|opus]",
    "  bun run cli privileged sudo --host <host> --command '<cmd>' --password '<pw>' [--timeout 30000]",
    "  bun run cli grab <youtube-url> [--host arts] [--output ~/Music/grabs] [--format opus|mp3] [--bitrate 128k]",
    "  bun run cli grab check [--host arts]",
    "",
    "  grab: download YouTube audio on a remote host. Default: opus 128k (default host: arts).",
    "  local: one-off run on localhost, haiku by default. Does not affect other agents.",
    "",
    "Global options:",
    "  --url, -u <url>            Override operate server URL for this command",
    "",
    "Config:",
    "  bun run operate config set-url <url>",
    `Default server: ${readConfiguredUrl() ?? process.env.OPERATE_URL?.trim() ?? DEFAULT_BASE_URL}`
  ].join("\n");
}

interface CliConfig {
  url?: string;
  aliases?: Record<string, string>;
}

interface RepoConfig {
  url?: string;
  aliases?: Record<string, string>;
}

function readConfig(): CliConfig {
  if (!existsSync(CONFIG_PATH)) {
    return {};
  }

  try {
    const raw = readFileSync(CONFIG_PATH, "utf8");
    const parsed = JSON.parse(raw) as CliConfig;
    return parsed;
  } catch {
    return {};
  }
}

function readRepoConfig(): RepoConfig {
  if (!existsSync(REPO_CONFIG_PATH)) {
    return {};
  }

  try {
    const raw = readFileSync(REPO_CONFIG_PATH, "utf8");
    return JSON.parse(raw) as RepoConfig;
  } catch {
    return {};
  }
}

function writeRepoConfig(config: RepoConfig): void {
  writeFileSync(REPO_CONFIG_PATH, JSON.stringify(config, null, 2));
}

function writeConfig(config: CliConfig): void {
  if (!existsSync(CONFIG_DIR)) {
    mkdirSync(CONFIG_DIR, { recursive: true });
  }

  writeFileSync(CONFIG_PATH, JSON.stringify(config, null, 2));
}

function readConfiguredUrl(): string | undefined {
  const repoConfig = readRepoConfig();
  const repoValue = repoConfig.url?.trim();
  if (repoValue && repoValue.length > 0) {
    return repoValue;
  }

  const config = readConfig();
  const value = config.url?.trim();
  return value && value.length > 0 ? value : undefined;
}

function mergedAliases(): Record<string, string> {
  return {
    ...HOST_ALIASES,
    ...(readConfig().aliases ?? {}),
    ...(readRepoConfig().aliases ?? {})
  };
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

function removeFlag(args: string[], ...flags: string[]): { args: string[]; value: string | undefined } {
  const copied = [...args];
  for (const flag of flags) {
    const index = copied.indexOf(flag);
    if (index !== -1) {
      const value = copied[index + 1];
      copied.splice(index, 2);
      return { args: copied, value };
    }
  }
  return { args: copied, value: undefined };
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

function resolveHostAlias(value: string): string {
  const normalized = value.trim();
  if (normalized.length === 0) {
    throw new Error("host cannot be empty");
  }
  return mergedAliases()[normalized] ?? normalized;
}

/**
 * Prevent local tilde expansion from leaking into remote paths.
 * When the shell expands `~/foo` to `/Users/arach/foo` before the CLI
 * receives it, the absolute local path is wrong for a remote host whose
 * home directory differs (e.g. `/Users/art`).  Converting the local
 * homedir prefix back to `~` lets it expand correctly on the remote.
 */
function remoteSafePath(value: string): string {
  const home = homedir();
  if (value === home) return "~";
  if (value.startsWith(home + "/")) {
    return "~" + value.slice(home.length);
  }
  return value;
}

export function parseDiscoverHostsArgs(args: string[]): string[] {
  const raw = readFlag(args, "--hosts");
  if (!raw) {
    throw new Error("--hosts is required");
  }
  const hosts = raw
    .split(",")
    .map((host) => resolveHostAlias(host))
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
    host: resolveHostAlias(host),
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

function parseSessionBase(args: string[]): { host: string; name: string } {
  const host = readFlag(args, "--host");
  const name = readFlag(args, "--name");
  if (!host) {
    throw new Error("--host is required");
  }
  if (!name) {
    throw new Error("--name is required");
  }
  return { host: resolveHostAlias(host), name };
}

function resolveBaseUrl(overrideUrl?: string): string {
  return (
    overrideUrl?.trim() || readConfiguredUrl() || process.env.OPERATE_URL?.trim() || DEFAULT_BASE_URL
  );
}

async function request(method: string, path: string, body: unknown | undefined, baseUrl: string): Promise<void> {

  const init: RequestInit = {
    method,
    headers: {
      "content-type": "application/json"
    }
  };

  if (typeof body !== "undefined") {
    init.body = JSON.stringify(body);
  }

  const response = await fetch(`${baseUrl}${path}`, init);

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
  const urlParsed = removeFlag(argv, "--url", "-u");
  const baseUrl = resolveBaseUrl(urlParsed.value);

  const [command, ...rest] = urlParsed.args;
  if (!command || command === "help" || command === "--help" || command === "-h") {
    console.log(usage());
    return;
  }

  if (command === "config") {
    const subcommand = rest[0];
    if (subcommand === "set-url") {
      const value = rest[1];
      if (!value) {
        throw new Error("url is required");
      }
      const scope = readFlag(rest, "--scope") ?? "repo";
      if (scope === "global") {
        writeConfig({ ...readConfig(), url: value });
      } else {
        writeRepoConfig({ ...readRepoConfig(), url: value });
      }
      console.log(JSON.stringify({ ok: true, url: value }, null, 2));
      return;
    }

    if (subcommand === "alias") {
      const action = rest[1];

      if (action === "set") {
        const alias = rest[2];
        const target = rest[3];
        if (!alias || !target) {
          throw new Error("usage: config alias set <alias> <target>");
        }
        const scope = readFlag(rest, "--scope") ?? "repo";
        if (scope === "global") {
          writeConfig({
            ...readConfig(),
            aliases: {
              ...(readConfig().aliases ?? {}),
              [alias]: target
            }
          });
        } else {
          writeRepoConfig({
            ...readRepoConfig(),
            aliases: {
              ...(readRepoConfig().aliases ?? {}),
              [alias]: target
            }
          });
        }

        console.log(JSON.stringify({ ok: true, alias, target, scope }, null, 2));
        return;
      }

      if (action === "list") {
        console.log(
          JSON.stringify(
            {
              aliases: mergedAliases(),
              repoConfigPath: REPO_CONFIG_PATH,
              globalConfigPath: CONFIG_PATH
            },
            null,
            2
          )
        );
        return;
      }
    }

    if (subcommand === "get") {
      console.log(
        JSON.stringify(
          {
            url: readConfiguredUrl() ?? null,
            resolvedUrl: baseUrl,
            configPath: CONFIG_PATH
          },
          null,
          2
        )
      );
      return;
    }
  }

  if (command === "local") {
    const { args: localRest, value: modelFlag } = removeFlag(rest, "--model", "-m");
    const message = localRest.join(" ").trim();
    if (!message) {
      throw new Error("usage: operate local <message> [--model haiku|sonnet|opus]");
    }
    const MODEL_ALIASES: Record<string, string> = {
      haiku: "anthropic/claude-3-5-haiku-latest",
      sonnet: "anthropic/claude-sonnet-4-20250514",
      opus: "anthropic/claude-opus-4-20250514"
    };
    const model = modelFlag ? (MODEL_ALIASES[modelFlag.toLowerCase()] ?? modelFlag) : MODEL_ALIASES.haiku;
    const payload = {
      host: resolveHostAlias("local"),
      mode: "command" as const,
      message,
      jobMode: "sync" as const,
      model
    };
    await request("POST", "/opencode/dispatch", payload, baseUrl);
    return;
  }

  if (command === "health") {
    await request("GET", "/health", undefined, baseUrl);
    return;
  }

  if (command === "inventory") {
    await request("GET", "/inventory", undefined, baseUrl);
    return;
  }

  if (command === "discover") {
    if (rest[0] === "tailscale") {
      await request("POST", "/inventory/discover/tailscale", parseDiscoverTailscaleArgs(rest.slice(1)), baseUrl);
      return;
    }
    await request("POST", "/inventory/discover", { hosts: parseDiscoverHostsArgs(rest) }, baseUrl);
    return;
  }

  if (command === "runtimes") {
    await request("GET", "/runtimes", undefined, baseUrl);
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

    await request("POST", "/route/plan", payload, baseUrl);
    return;
  }

  if (command === "jobs") {
    await request("GET", "/jobs", undefined, baseUrl);
    return;
  }

  if (command === "job") {
    const subcommand = rest[0];
    if (subcommand === "get") {
      const id = readFlag(rest, "--id");
      if (!id) {
        throw new Error("--id is required");
      }
      await request("GET", `/jobs/${id}`, undefined, baseUrl);
      return;
    }

    if (subcommand === "retry") {
      const id = readFlag(rest, "--id");
      if (!id) {
        throw new Error("--id is required");
      }
      await request("POST", `/jobs/${id}/retry`, {}, baseUrl);
      return;
    }

    if (subcommand === "run") {
      await request("POST", "/jobs", parseJobRunArgs(rest.slice(1)), baseUrl);
      return;
    }
  }

  if (command === "session") {
    const subcommand = rest[0];

    if (subcommand === "create") {
      const parsed = parseSessionBase(rest.slice(1));
      const cwd = readFlag(rest, "--cwd");
      const commandText = readFlag(rest, "--command");
      const payload: { host: string; name: string; cwd?: string; command?: string } = {
        host: parsed.host,
        name: parsed.name
      };
      if (cwd) {
        payload.cwd = remoteSafePath(cwd);
      }
      if (commandText) {
        payload.command = commandText;
      }
      await request("POST", "/sessions", payload, baseUrl);
      return;
    }

    if (subcommand === "create-agent") {
      const parsed = parseSessionBase(rest.slice(1));
      const cwd = readFlag(rest, "--cwd");
      const commandText = readFlag(rest, "--command") ?? "opencode run";
      const payload: {
        host: string;
        name: string;
        command?: string;
        cwd?: string;
        keepAlive?: boolean;
      } = {
        host: parsed.host,
        name: parsed.name,
        command: commandText,
        keepAlive: true
      };
      if (cwd) {
        payload.cwd = remoteSafePath(cwd);
      }
      await request("POST", "/sessions", payload, baseUrl);
      return;
    }

    if (subcommand === "list") {
      const host = readFlag(rest, "--host");
      if (!host) {
        throw new Error("--host is required");
      }
      await request("POST", "/sessions/list", { host: resolveHostAlias(host) }, baseUrl);
      return;
    }

    if (subcommand === "check") {
      const host = readFlag(rest, "--host");
      if (!host) {
        throw new Error("--host is required");
      }
      await request("POST", "/sessions/check", { host: resolveHostAlias(host) }, baseUrl);
      return;
    }

    if (subcommand === "send") {
      const parsed = parseSessionBase(rest.slice(1));
      const text = readFlag(rest, "--text");
      if (!text) {
        throw new Error("--text is required");
      }
      await request("POST", `/sessions/${parsed.name}/send`, {
        host: parsed.host,
        text,
        enter: !hasFlag(rest, "--no-enter")
      }, baseUrl);
      return;
    }

    if (subcommand === "capture") {
      const parsed = parseSessionBase(rest.slice(1));
      const linesRaw = readFlag(rest, "--lines");
      const payload: { host: string; lines?: number } = { host: parsed.host };
      if (linesRaw) {
        const lines = Number(linesRaw);
        if (!Number.isFinite(lines) || lines <= 0) {
          throw new Error("--lines must be a positive number");
        }
        payload.lines = lines;
      }
      await request("POST", `/sessions/${parsed.name}/capture`, payload, baseUrl);
      return;
    }

    if (subcommand === "kill") {
      const parsed = parseSessionBase(rest.slice(1));
      await request("POST", `/sessions/${parsed.name}/kill`, { host: parsed.host }, baseUrl);
      return;
    }
  }

  if (command === "opencode") {
    const subcommand = rest[0];

    if (subcommand === "command") {
      const host = readFlag(rest, "--host");
      const message = readFlag(rest, "--message");
      const jobMode = readFlag(rest, "--job-mode");
      if (!host) {
        throw new Error("--host is required");
      }
      if (!message) {
        throw new Error("--message is required");
      }
      if (jobMode && jobMode !== "sync" && jobMode !== "async") {
        throw new Error("--job-mode must be sync or async");
      }

      const payload: {
        host: string;
        mode: "command";
        message: string;
        jobMode?: "sync" | "async";
      } = {
        host: resolveHostAlias(host),
        mode: "command",
        message
      };

      if (jobMode === "sync" || jobMode === "async") {
        payload.jobMode = jobMode;
      }

      await request("POST", "/opencode/dispatch", payload, baseUrl);
      return;
    }

    if (subcommand === "agent") {
      const host = readFlag(rest, "--host");
      const sessionName = readFlag(rest, "--session");
      const message = readFlag(rest, "--message");
      const cwd = readFlag(rest, "--cwd");
      if (!host) {
        throw new Error("--host is required");
      }
      if (!sessionName) {
        throw new Error("--session is required");
      }
      if (!message) {
        throw new Error("--message is required");
      }

      const payload: {
        host: string;
        mode: "agent";
        message: string;
        sessionName: string;
        cwd?: string;
      } = {
        host: resolveHostAlias(host),
        mode: "agent",
        message,
        sessionName
      };

      if (cwd) {
        payload.cwd = remoteSafePath(cwd);
      }

      await request("POST", "/opencode/dispatch", payload, baseUrl);
      return;
    }
  }

  if (command === "privileged") {
    const subcommand = rest[0];
    if (subcommand === "sudo") {
      const host = readFlag(rest, "--host");
      const commandText = readFlag(rest, "--command");
      const password = readFlag(rest, "--password");
      const timeoutRaw = readFlag(rest, "--timeout");

      if (!host) {
        throw new Error("--host is required");
      }
      if (!commandText) {
        throw new Error("--command is required");
      }
      if (!password) {
        throw new Error("--password is required");
      }

      const payload: { host: string; command: string; password: string; timeoutMs?: number } = {
        host,
        command: commandText,
        password
      };

      if (timeoutRaw) {
        const timeoutMs = Number(timeoutRaw);
        if (!Number.isFinite(timeoutMs) || timeoutMs <= 0) {
          throw new Error("--timeout must be a positive number");
        }
        payload.timeoutMs = timeoutMs;
      }

      await request("POST", "/privileged/sudo", payload, baseUrl);
      return;
    }
  }

  if (command === "grab") {
    const subcommand = rest[0];

    if (subcommand === "check") {
      const host = readFlag(rest, "--host") ?? "arts";
      const resolved = resolveHostAlias(host);
      console.log(`Checking yt-dlp and ffmpeg on ${resolved}...`);
      const result = await grabCheck(resolved);
      console.log(JSON.stringify(result, null, 2));
      return;
    }

    // grab <url> [--host arts] [--output ~/Music/grabs]
    const url = subcommand;
    if (!url) {
      throw new Error("usage: grab <youtube-url> [--host arts] [--output ~/Music/grabs]");
    }

    const host = readFlag(rest, "--host") ?? "arts";
    const output = readFlag(rest, "--output");
    const format = readFlag(rest, "--format");
    const bitrate = readFlag(rest, "--bitrate");

    if (format && format !== "opus" && format !== "mp3") {
      throw new Error("--format must be opus or mp3");
    }

    const grabOptions: Parameters<typeof grabAudio>[0] = {
      url,
      host: resolveHostAlias(host),
    };
    if (output) grabOptions.outputDir = output;
    if (format) grabOptions.format = format as "opus" | "mp3";
    if (bitrate) grabOptions.bitrate = bitrate;

    const result = await grabAudio(grabOptions);

    if (!result.ok) {
      throw new Error(`grab failed (exit ${result.exitCode})`);
    }

    console.log(`\nDone. Saved to ${result.outputDir} on ${result.host}`);
    return;
  }

  if (command === "agent") {
    const target = rest[0];
    if (!target) {
      throw new Error("agent target is required (example: arts)");
    }

    const parsed = splitAfterSentinel(rest.slice(1));
    const sessionName = readFlag(parsed.before, "-s") ?? readFlag(parsed.before, "--session");
    if (!sessionName) {
      throw new Error("-s/--session is required");
    }

    const message = parsed.after.join(" ").trim();
    if (!message) {
      throw new Error("message is required after --");
    }

    await request("POST", "/opencode/dispatch", {
      host: resolveHostAlias(target),
      mode: "agent",
      sessionName,
      message
    }, baseUrl);
    return;
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
