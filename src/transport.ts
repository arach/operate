import type { CommandTransport, SSHExecutor, SSHResult, TransportConfig, TransportKind } from "./types";

const LOCAL_HOSTS = new Set(["localhost", "local", "127.0.0.1", ""]);

function isLocalHost(host: string): boolean {
  return LOCAL_HOSTS.has(host.toLowerCase().trim());
}

/** Runs commands directly on localhost; delegates to remote transport otherwise. */
export class LocalBypassTransport implements CommandTransport {
  constructor(private readonly remote: CommandTransport) {}

  /** Exposed for tests; returns the underlying remote transport. */
  getRemote(): CommandTransport {
    return this.remote;
  }

  async run(host: string, command: string, timeoutMs?: number): Promise<SSHResult> {
    if (!isLocalHost(host)) {
      return this.remote.run(host, command, timeoutMs);
    }

    const timeout = timeoutMs ?? 30_000;
    const proc = Bun.spawn(["sh", "-c", command], {
      stdout: "pipe",
      stderr: "pipe",
      cwd: process.cwd()
    });

    const timeoutId = setTimeout(() => {
      proc.kill();
    }, timeout);

    try {
      const [stdout, stderr] = await Promise.all([proc.stdout.text(), proc.stderr.text()]);
      const exitCode = await proc.exited;
      return { stdout, stderr, exitCode };
    } catch (e) {
      return {
        stdout: "",
        stderr: e instanceof Error ? e.message : String(e),
        exitCode: 255
      };
    } finally {
      clearTimeout(timeoutId);
    }
  }
}

export class SshCommandTransport implements CommandTransport {
  constructor(private readonly ssh: SSHExecutor) {}

  async run(host: string, command: string, timeoutMs?: number): Promise<SSHResult> {
    return this.ssh.run(host, command, timeoutMs);
  }
}

interface WebSocketRpcRequest {
  id: string;
  type: "run";
  host: string;
  command: string;
  timeoutMs?: number;
}

interface WebSocketRpcResponse {
  id: string;
  stdout: string;
  stderr: string;
  exitCode: number;
}

export class WebSocketCommandTransport implements CommandTransport {
  constructor(
    private readonly url: string,
    private readonly authToken?: string,
    private readonly connectTimeoutMs = 5_000
  ) {}

  async run(host: string, command: string, timeoutMs?: number): Promise<SSHResult> {
    const id = crypto.randomUUID();

    const socket = new WebSocket(this.url);
    const timeout = typeof timeoutMs === "number" ? timeoutMs : 8_000;

    return await new Promise<SSHResult>((resolve) => {
      let settled = false;

      const finish = (result: SSHResult): void => {
        if (settled) {
          return;
        }
        settled = true;
        try {
          socket.close();
        } catch {}
        resolve(result);
      };

      const connectTimer = setTimeout(() => {
        finish({
          stdout: "",
          stderr: `WebSocket connect timeout after ${this.connectTimeoutMs}ms`,
          exitCode: 255
        });
      }, this.connectTimeoutMs);

      const commandTimer = setTimeout(() => {
        finish({
          stdout: "",
          stderr: `WebSocket command timeout after ${timeout}ms`,
          exitCode: 255
        });
      }, timeout);

      socket.onopen = () => {
        clearTimeout(connectTimer);

        const request: WebSocketRpcRequest = {
          id,
          type: "run",
          host,
          command
        };
        if (typeof timeoutMs === "number") {
          request.timeoutMs = timeoutMs;
        }

        if (this.authToken) {
          socket.send(JSON.stringify({ type: "auth", token: this.authToken }));
        }
        socket.send(JSON.stringify(request));
      };

      socket.onmessage = (event) => {
        try {
          const payload = JSON.parse(String(event.data)) as Partial<WebSocketRpcResponse>;
          if (payload.id !== id) {
            return;
          }

          clearTimeout(commandTimer);
          finish({
            stdout: typeof payload.stdout === "string" ? payload.stdout : "",
            stderr: typeof payload.stderr === "string" ? payload.stderr : "",
            exitCode: typeof payload.exitCode === "number" ? payload.exitCode : 255
          });
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error);
          clearTimeout(commandTimer);
          finish({
            stdout: "",
            stderr: `Invalid WebSocket response: ${message}`,
            exitCode: 255
          });
        }
      };

      socket.onerror = () => {
        clearTimeout(connectTimer);
        clearTimeout(commandTimer);
        finish({
          stdout: "",
          stderr: "WebSocket transport error",
          exitCode: 255
        });
      };

      socket.onclose = () => {
        clearTimeout(connectTimer);
        clearTimeout(commandTimer);
        if (!settled) {
          finish({
            stdout: "",
            stderr: "WebSocket closed before response",
            exitCode: 255
          });
        }
      };
    });
  }
}

export function readTransportConfig(env: NodeJS.ProcessEnv = process.env): TransportConfig {
  const rawKind = env.OPERATE_TRANSPORT?.trim().toLowerCase();
  const kind: TransportKind = rawKind === "websocket" ? "websocket" : "ssh";

  const rawTimeout = env.OPERATE_WS_CONNECT_TIMEOUT_MS;
  const parsedTimeout = rawTimeout ? Number(rawTimeout) : NaN;
  const websocketConnectTimeoutMs = Number.isFinite(parsedTimeout) && parsedTimeout > 0 ? parsedTimeout : 5_000;

  const config: TransportConfig = {
    kind,
    websocketConnectTimeoutMs
  };

  const url = env.OPERATE_WS_URL?.trim();
  if (url) {
    config.websocketUrl = url;
  }

  const token = env.OPERATE_WS_AUTH_TOKEN?.trim();
  if (token) {
    config.websocketAuthToken = token;
  }

  return config;
}

export function createCommandTransport(config: TransportConfig, ssh: SSHExecutor): CommandTransport {
  let base: CommandTransport;
  if (config.kind === "ssh") {
    base = new SshCommandTransport(ssh);
  } else {
    if (!config.websocketUrl) {
      throw new Error("OPERATE_WS_URL is required when OPERATE_TRANSPORT=websocket");
    }
    base = new WebSocketCommandTransport(
      config.websocketUrl,
      config.websocketAuthToken,
      config.websocketConnectTimeoutMs
    );
  }
  return new LocalBypassTransport(base);
}
