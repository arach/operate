import type { HostInventory, RuntimeCapability, RuntimeName, SSHExecutor } from "./types";

const RUNTIME_NAMES: RuntimeName[] = ["hermes", "opencode", "claude"];

const PROBE_SCRIPT = [
  "set -eu",
  "echo \"HOSTNAME=$(hostname 2>/dev/null || uname -n)\"",
  "echo \"OS=$(uname -s 2>/dev/null || echo unknown)\"",
  "echo \"ARCH=$(uname -m 2>/dev/null || echo unknown)\"",
  "for runtime in hermes opencode claude; do",
  "  if command -v \"$runtime\" >/dev/null 2>&1; then",
  "    path=$(command -v \"$runtime\")",
  "    version=$($runtime --version 2>/dev/null || true)",
  "    echo \"RUNTIME=$runtime|$path|$version\"",
  "  fi",
  "done"
].join("; ");

interface ParsedProbeOutput {
  hostname: string;
  os: string;
  arch: string;
  runtimes: RuntimeCapability[];
}

export function parseProbeOutput(host: string, stdout: string): ParsedProbeOutput {
  const lines = stdout
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.length > 0);

  let hostname = host;
  let os = "unknown";
  let arch = "unknown";
  const discovered: RuntimeCapability[] = [];

  for (const line of lines) {
    if (line.startsWith("HOSTNAME=")) {
      hostname = line.slice("HOSTNAME=".length) || host;
      continue;
    }

    if (line.startsWith("OS=")) {
      os = line.slice("OS=".length) || "unknown";
      continue;
    }

    if (line.startsWith("ARCH=")) {
      arch = line.slice("ARCH=".length) || "unknown";
      continue;
    }

    if (line.startsWith("RUNTIME=")) {
      const payload = line.slice("RUNTIME=".length);
      const [nameValue, path, version] = payload.split("|");
      if (!nameValue || !path) {
        continue;
      }

      if (!RUNTIME_NAMES.includes(nameValue as RuntimeName)) {
        continue;
      }

      discovered.push({
        name: nameValue as RuntimeName,
        binaryPath: path,
        version: version ?? "unknown",
        status: "available"
      });
    }
  }

  const existing = new Set(discovered.map((runtime) => runtime.name));
  for (const runtimeName of RUNTIME_NAMES) {
    if (existing.has(runtimeName)) {
      continue;
    }
    discovered.push({
      name: runtimeName,
      binaryPath: "",
      version: "",
      status: "unavailable"
    });
  }

  return {
    hostname,
    os,
    arch,
    runtimes: discovered.sort((a, b) => a.name.localeCompare(b.name))
  };
}

export class HostProbeService {
  constructor(private readonly ssh: SSHExecutor) {}

  async probe(host: string): Promise<HostInventory> {
    const result = await this.ssh.run(host, PROBE_SCRIPT);
    const errors: string[] = [];

    if (result.exitCode !== 0) {
      errors.push(`ssh exit ${result.exitCode}: ${result.stderr.trim() || "unknown error"}`);
      return {
        machine: {
          host,
          hostname: host,
          os: "unknown",
          arch: "unknown"
        },
        runtimes: RUNTIME_NAMES.map((runtimeName) => ({
          name: runtimeName,
          binaryPath: "",
          version: "",
          status: "unavailable"
        })),
        probedAt: new Date().toISOString(),
        errors
      };
    }

    const parsed = parseProbeOutput(host, result.stdout);
    return {
      machine: {
        host,
        hostname: parsed.hostname,
        os: parsed.os,
        arch: parsed.arch
      },
      runtimes: parsed.runtimes,
      probedAt: new Date().toISOString(),
      errors
    };
  }
}
