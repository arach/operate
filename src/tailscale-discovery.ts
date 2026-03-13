import type { SSHResult } from "./types";

interface TailscalePeer {
  HostName?: string;
  DNSName?: string;
  TailscaleIPs?: string[];
  Online?: boolean;
  User?: string;
}

interface TailscaleSelf {
  User?: string;
}

interface TailscaleStatus {
  Self?: TailscaleSelf;
  Peer?: Record<string, TailscalePeer>;
}

export interface TailscaleTarget {
  host: string;
  source: "ip" | "dns";
  online: boolean;
  user?: string;
}

export type TailscaleSourcePreference = "ip" | "dns" | "both";

type LocalCommandRunner = (args: string[]) => Promise<SSHResult>;

const EXECUTABLE_NOT_FOUND_PATTERN =
  /Executable not found|command not found|No such file|not found in \$PATH/i;

const DEFAULT_TAILSCALE_CANDIDATES = [
  "tailscale",
  "/Applications/Tailscale.app/Contents/MacOS/Tailscale"
] as const;

export class TailscaleDiscoveryService {
  constructor(private readonly runCommand: LocalCommandRunner = runLocalCommand) {}

  async discover(includeOffline = false, sourcePreference: TailscaleSourcePreference = "both"): Promise<TailscaleTarget[]> {
    const result = await this.runCommand(["tailscale", "status", "--json"]);
    if (result.exitCode !== 0) {
      throw new Error(result.stderr.trim() || "tailscale status failed");
    }

    const status = JSON.parse(result.stdout) as TailscaleStatus;
    const peers = status.Peer ? Object.values(status.Peer) : [];
    const configuredSshUser = process.env.OPERATE_TAILSCALE_SSH_USER?.trim();
    const currentUser = status.Self?.User?.trim();

    const targets: TailscaleTarget[] = [];
    for (const peer of peers) {
      const online = peer.Online === true;
      if (!includeOffline && !online) {
        continue;
      }

      const peerUser = peer.User?.trim() || configuredSshUser || currentUser || undefined;
      const firstIp = peer.TailscaleIPs?.find((ip) => typeof ip === "string" && ip.length > 0);
      if (firstIp && (sourcePreference === "ip" || sourcePreference === "both")) {
        const target: TailscaleTarget = {
          host: peerUser ? `${peerUser}@${firstIp}` : firstIp,
          source: "ip",
          online
        };
        if (peerUser) {
          target.user = peerUser;
        }
        targets.push(target);
      }

      const dns = peer.DNSName?.trim();
      if (dns && (sourcePreference === "dns" || sourcePreference === "both")) {
        const normalized = dns.endsWith(".") ? dns.slice(0, -1) : dns;
        const target: TailscaleTarget = {
          host: normalized,
          source: "dns",
          online
        };
        if (peerUser) {
          target.user = peerUser;
        }
        targets.push(target);
      }
    }

    const deduped = new Map<string, TailscaleTarget>();
    for (const target of targets) {
      if (!deduped.has(target.host)) {
        deduped.set(target.host, target);
      }
    }

    return Array.from(deduped.values()).sort((a, b) => a.host.localeCompare(b.host));
  }
}

async function runLocalCommand(args: string[]): Promise<SSHResult> {
  if (args[0] === "tailscale") {
    const candidates = resolveTailscaleCandidates();
    let lastNotFound: SSHResult | null = null;

    for (const candidate of candidates) {
      const env = candidate.includes("/Applications/Tailscale.app/Contents/MacOS/Tailscale")
        ? { TAILSCALE_BE_CLI: "1" }
        : undefined;
      const result = await spawnCommand([candidate, ...args.slice(1)], env);
      if (result.exitCode === 127 && EXECUTABLE_NOT_FOUND_PATTERN.test(result.stderr)) {
        lastNotFound = result;
        continue;
      }
      return result;
    }

    if (lastNotFound) {
      return {
        stdout: "",
        stderr:
          `${lastNotFound.stderr.trim()} (set OPERATE_TAILSCALE_BIN to your tailscale binary path)`.trim(),
        exitCode: 127
      };
    }
  }

  return spawnCommand(args);
}

function resolveTailscaleCandidates(env: NodeJS.ProcessEnv = process.env): string[] {
  const configured = env.OPERATE_TAILSCALE_BIN?.trim();
  if (configured) {
    return [configured, ...DEFAULT_TAILSCALE_CANDIDATES];
  }

  return [...DEFAULT_TAILSCALE_CANDIDATES];
}

async function spawnCommand(args: string[], envOverride?: Record<string, string>): Promise<SSHResult> {
  let proc: ReturnType<typeof Bun.spawn>;
  try {
    proc = Bun.spawn(args, {
      stdout: "pipe",
      stderr: "pipe",
      env: envOverride ? { ...process.env, ...envOverride } : process.env
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return {
      stdout: "",
      stderr: message,
      exitCode: 127
    };
  }

  const [stdout, stderr, exitCode] = await Promise.all([
    proc.stdout instanceof ReadableStream ? new Response(proc.stdout).text() : Promise.resolve(""),
    proc.stderr instanceof ReadableStream ? new Response(proc.stderr).text() : Promise.resolve(""),
    proc.exited
  ]);

  return { stdout, stderr, exitCode };
}
