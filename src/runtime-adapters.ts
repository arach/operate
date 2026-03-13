import type {
  RuntimeActionRequest,
  RuntimeAdapter,
  RuntimeExecuteRequest,
  RuntimeExecuteResult,
  RuntimeName,
  SSHExecutor
} from "./types";

function quoteArg(arg: string): string {
  if (/^[a-zA-Z0-9_./:@=-]+$/.test(arg)) {
    return arg;
  }
  return `'${arg.replace(/'/g, "'\\''")}'`;
}

function joinCommand(parts: string[]): string {
  return parts.map(quoteArg).join(" ");
}

class HermesRuntimeAdapter implements RuntimeAdapter {
  readonly runtime: RuntimeName = "hermes";

  async execute(ssh: SSHExecutor, request: RuntimeExecuteRequest): Promise<RuntimeExecuteResult> {
    const command = joinCommand(["hermes", ...request.args]);
    const result = await ssh.run(request.host, command, request.timeoutMs);

    return {
      runtime: this.runtime,
      host: request.host,
      command,
      stdout: result.stdout,
      stderr: result.stderr,
      exitCode: result.exitCode,
      executedAt: new Date().toISOString()
    };
  }

  async listTools(ssh: SSHExecutor, host: string, timeoutMs?: number): Promise<RuntimeExecuteResult> {
    const request: RuntimeExecuteRequest = {
      host,
      args: ["tools"]
    };

    if (typeof timeoutMs === "number") {
      request.timeoutMs = timeoutMs;
    }

    return this.execute(ssh, request);
  }
}

export class RuntimeAdapterRegistry {
  private readonly adapters = new Map<RuntimeName, RuntimeAdapter>();

  constructor(adapters: RuntimeAdapter[]) {
    for (const adapter of adapters) {
      this.adapters.set(adapter.runtime, adapter);
    }
  }

  get(runtime: RuntimeName): RuntimeAdapter | null {
    return this.adapters.get(runtime) ?? null;
  }

  list(): RuntimeName[] {
    return Array.from(this.adapters.keys()).sort((a, b) => a.localeCompare(b));
  }
}

export class RuntimeService {
  constructor(
    private readonly ssh: SSHExecutor,
    private readonly adapters: RuntimeAdapterRegistry
  ) {}

  listSupportedRuntimes(): RuntimeName[] {
    return this.adapters.list();
  }

  async execute(runtime: RuntimeName, request: RuntimeActionRequest): Promise<RuntimeExecuteResult> {
    const adapter = this.adapters.get(runtime);
    if (!adapter) {
      throw new Error(`Runtime adapter not found: ${runtime}`);
    }

    const executeRequest: RuntimeExecuteRequest = {
      host: request.host,
      args: request.args ?? []
    };

    if (typeof request.timeoutMs === "number") {
      executeRequest.timeoutMs = request.timeoutMs;
    }

    return adapter.execute(this.ssh, executeRequest);
  }

  async listTools(runtime: RuntimeName, request: RuntimeActionRequest): Promise<RuntimeExecuteResult> {
    const adapter = this.adapters.get(runtime);
    if (!adapter) {
      throw new Error(`Runtime adapter not found: ${runtime}`);
    }

    return adapter.listTools(this.ssh, request.host, request.timeoutMs);
  }
}

export function createDefaultRuntimeRegistry(): RuntimeAdapterRegistry {
  return new RuntimeAdapterRegistry([new HermesRuntimeAdapter()]);
}
