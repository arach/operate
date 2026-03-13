import type { CommandTransport, SSHExecutor, SSHResult } from "./types";

export class SshCommandTransport implements CommandTransport {
  constructor(private readonly ssh: SSHExecutor) {}

  async run(host: string, command: string, timeoutMs?: number): Promise<SSHResult> {
    return this.ssh.run(host, command, timeoutMs);
  }
}
