import type {
  CommandTransport,
  RuntimeActionRequest,
  RuntimeAdapter,
  RuntimeExecuteRequest,
  RuntimeExecuteResult,
  RuntimeName
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

  async execute(transport: CommandTransport, request: RuntimeExecuteRequest): Promise<RuntimeExecuteResult> {
    const command = joinCommand(["hermes", ...request.args]);
    const result = await transport.run(request.host, command, request.timeoutMs);

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

  async listTools(transport: CommandTransport, host: string, timeoutMs?: number): Promise<RuntimeExecuteResult> {
    const request: RuntimeExecuteRequest = {
      host,
      args: ["tools"]
    };

    if (typeof timeoutMs === "number") {
      request.timeoutMs = timeoutMs;
    }

    return this.execute(transport, request);
  }
}

class OpenCodeRuntimeAdapter implements RuntimeAdapter {
  readonly runtime: RuntimeName = "opencode";

  async execute(transport: CommandTransport, request: RuntimeExecuteRequest): Promise<RuntimeExecuteResult> {
    const command = joinCommand(["opencode", ...request.args]);
    const result = await transport.run(request.host, command, request.timeoutMs);

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

  async listTools(transport: CommandTransport, host: string, timeoutMs?: number): Promise<RuntimeExecuteResult> {
    const command = "opencode --help";
    const result = await transport.run(host, command, timeoutMs);

    return {
      runtime: this.runtime,
      host,
      command,
      stdout: result.stdout,
      stderr: result.stderr,
      exitCode: result.exitCode,
      executedAt: new Date().toISOString()
    };
  }
}

class ClaudeRuntimeAdapter implements RuntimeAdapter {
  readonly runtime: RuntimeName = "claude";

  async execute(transport: CommandTransport, request: RuntimeExecuteRequest): Promise<RuntimeExecuteResult> {
    const command = joinCommand(["claude", ...request.args]);
    const result = await transport.run(request.host, command, request.timeoutMs);

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

  async listTools(transport: CommandTransport, host: string, timeoutMs?: number): Promise<RuntimeExecuteResult> {
    const command = "claude --help";
    const result = await transport.run(host, command, timeoutMs);

    return {
      runtime: this.runtime,
      host,
      command,
      stdout: result.stdout,
      stderr: result.stderr,
      exitCode: result.exitCode,
      executedAt: new Date().toISOString()
    };
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
    private readonly transport: CommandTransport,
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

    return adapter.execute(this.transport, executeRequest);
  }

  async listTools(runtime: RuntimeName, request: RuntimeActionRequest): Promise<RuntimeExecuteResult> {
    const adapter = this.adapters.get(runtime);
    if (!adapter) {
      throw new Error(`Runtime adapter not found: ${runtime}`);
    }

    return adapter.listTools(this.transport, request.host, request.timeoutMs);
  }
}

export function createDefaultRuntimeRegistry(): RuntimeAdapterRegistry {
  return new RuntimeAdapterRegistry([
    new HermesRuntimeAdapter(),
    new OpenCodeRuntimeAdapter(),
    new ClaudeRuntimeAdapter()
  ]);
}
