import type {
  CommandTransport,
  CreateSessionRequest,
  SessionCaptureRequest,
  SessionSendRequest,
  TmuxSessionInfo
} from "./types";

function quote(arg: string): string {
  if (/^[a-zA-Z0-9_./:@=-]+$/.test(arg)) {
    return arg;
  }
  return `'${arg.replace(/'/g, "'\\''")}'`;
}

function formatCreateCommand(request: CreateSessionRequest): string {
  const parts: string[] = ["tmux", "new-session", "-d", "-s", request.name];
  if (request.cwd) {
    parts.push("-c", request.cwd);
  }
  if (request.command) {
    if (request.keepAlive) {
      parts.push(`${request.command}; exec zsh`);
    } else {
      parts.push(request.command);
    }
  }
  return parts.map(quote).join(" ");
}

function formatListCommand(): string {
  return [
    "tmux",
    "list-sessions",
    "-F",
    "#{session_name}|#{session_attached}|#{session_windows}|#{session_created}"
  ]
    .map(quote)
    .join(" ");
}

function formatSendCommand(name: string, request: SessionSendRequest): string {
  const command = ["tmux", "send-keys", "-t", name, request.text];
  if (request.enter !== false) {
    command.push("Enter");
  }
  return command.map(quote).join(" ");
}

function formatCaptureCommand(name: string, request: SessionCaptureRequest): string {
  const lines = typeof request.lines === "number" && request.lines > 0 ? request.lines : 200;
  return ["tmux", "capture-pane", "-p", "-t", name, "-S", `-${lines}`].map(quote).join(" ");
}

function formatKillCommand(name: string): string {
  return ["tmux", "kill-session", "-t", name].map(quote).join(" ");
}

export function parseTmuxListOutput(stdout: string): TmuxSessionInfo[] {
  return stdout
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.length > 0)
    .map((line) => {
      const [name, attachedRaw, windowsRaw, createdRaw] = line.split("|");
      return {
        name: name ?? "",
        attached: attachedRaw === "1",
        windows: Number(windowsRaw ?? "0"),
        createdUnix: Number(createdRaw ?? "0")
      };
    })
    .filter((session) => session.name.length > 0);
}

export class TmuxSessionService {
  constructor(private readonly transport: CommandTransport) {}

  async check(host: string): Promise<{ available: boolean; detail: string }> {
    const result = await this.transport.run(host, "command -v tmux");
    if (result.exitCode === 0) {
      return {
        available: true,
        detail: result.stdout.trim()
      };
    }

    const error = result.stderr.trim();
    if (error.includes("command not found") || result.exitCode === 127) {
      return {
        available: false,
        detail: "tmux not installed"
      };
    }

    return {
      available: false,
      detail: error || "tmux unavailable"
    };
  }

  async create(request: CreateSessionRequest): Promise<void> {
    const command = formatCreateCommand(request);
    const result = await this.transport.run(request.host, command);
    if (result.exitCode !== 0) {
      throw new Error(result.stderr.trim() || `tmux create failed on ${request.host}`);
    }
  }

  async list(host: string): Promise<TmuxSessionInfo[]> {
    const result = await this.transport.run(host, formatListCommand());
    if (result.exitCode !== 0) {
      const error = result.stderr.trim();
      if (error.includes("no server running") || error.includes("failed to connect to server")) {
        return [];
      }
      throw new Error(error || `tmux list failed on ${host}`);
    }
    return parseTmuxListOutput(result.stdout);
  }

  async send(name: string, request: SessionSendRequest): Promise<void> {
    const result = await this.transport.run(request.host, formatSendCommand(name, request));
    if (result.exitCode !== 0) {
      throw new Error(result.stderr.trim() || `tmux send failed for ${name}`);
    }
  }

  async capture(name: string, request: SessionCaptureRequest): Promise<string> {
    const result = await this.transport.run(request.host, formatCaptureCommand(name, request));
    if (result.exitCode !== 0) {
      throw new Error(result.stderr.trim() || `tmux capture failed for ${name}`);
    }
    return result.stdout;
  }

  async kill(name: string, host: string): Promise<void> {
    const result = await this.transport.run(host, formatKillCommand(name));
    if (result.exitCode !== 0) {
      throw new Error(result.stderr.trim() || `tmux kill failed for ${name}`);
    }
  }
}
