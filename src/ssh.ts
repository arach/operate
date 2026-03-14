import type { SSHExecutor, SSHResult } from "./types";

const DEFAULT_TIMEOUT_MS = 8_000;

export class OpenSSHExecutor implements SSHExecutor {
  async run(host: string, remoteCommand: string, timeoutMs = DEFAULT_TIMEOUT_MS): Promise<SSHResult> {
    const controller = new AbortController();
    const timeoutHandle = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const proc = Bun.spawn(
        [
          "ssh",
          "-o",
          "BatchMode=yes",
          "-o",
          "ConnectTimeout=5",
          host,
          remoteCommand
        ],
        {
          stdout: "pipe",
          stderr: "pipe",
          signal: controller.signal
        }
      );

      const [stdout, stderr, exitCode] = await Promise.all([
        new Response(proc.stdout).text(),
        new Response(proc.stderr).text(),
        proc.exited
      ]);

      return {
        stdout,
        stderr,
        exitCode
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return {
        stdout: "",
        stderr: message,
        exitCode: 255
      };
    } finally {
      clearTimeout(timeoutHandle);
    }
  }

  async runSudo(host: string, remoteCommand: string, password: string, timeoutMs = DEFAULT_TIMEOUT_MS): Promise<SSHResult> {
    const controller = new AbortController();
    const timeoutHandle = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const proc = Bun.spawn(
        [
          "ssh",
          "-o",
          "BatchMode=yes",
          "-o",
          "ConnectTimeout=5",
          host,
          `sudo -S -p '' ${remoteCommand}`
        ],
        {
          stdin: "pipe",
          stdout: "pipe",
          stderr: "pipe",
          signal: controller.signal
        }
      );

      if (proc.stdin && typeof proc.stdin.write === "function") {
        proc.stdin.write(`${password}\n`);
        if (typeof proc.stdin.end === "function") {
          proc.stdin.end();
        }
      }

      const [stdout, stderr, exitCode] = await Promise.all([
        new Response(proc.stdout).text(),
        new Response(proc.stderr).text(),
        proc.exited
      ]);

      return {
        stdout,
        stderr,
        exitCode
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return {
        stdout: "",
        stderr: message,
        exitCode: 255
      };
    } finally {
      clearTimeout(timeoutHandle);
    }
  }
}
