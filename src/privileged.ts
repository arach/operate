import type { PrivilegedRequest, SSHExecutor, SSHResult } from "./types";

const DEFAULT_TIMEOUT_MS = 30_000;

export class PrivilegedService {
  constructor(private readonly ssh: SSHExecutor) {}

  async runSudo(request: PrivilegedRequest): Promise<SSHResult> {
    if (process.env.OPERATE_ENABLE_PRIVILEGED !== "1") {
      throw new Error("Privileged execution disabled. Set OPERATE_ENABLE_PRIVILEGED=1 to enable.");
    }

    if (!request.password || request.password.length === 0) {
      throw new Error("password is required for privileged execution");
    }

    const timeoutMs = typeof request.timeoutMs === "number" ? request.timeoutMs : DEFAULT_TIMEOUT_MS;
    return this.ssh.runSudo(request.host, request.command, request.password, timeoutMs);
  }
}
