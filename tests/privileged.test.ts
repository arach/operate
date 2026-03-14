import { describe, expect, test } from "bun:test";
import { PrivilegedService } from "../src/privileged";
import type { SSHExecutor, SSHResult } from "../src/types";

class FakeSSHExecutor implements SSHExecutor {
  async run(): Promise<SSHResult> {
    return { stdout: "", stderr: "", exitCode: 0 };
  }

  async runSudo(host: string, remoteCommand: string): Promise<SSHResult> {
    return {
      stdout: `sudo:${host}:${remoteCommand}`,
      stderr: "",
      exitCode: 0
    };
  }
}

describe("PrivilegedService", () => {
  test("fails when privileged mode is disabled", async () => {
    const previous = process.env.OPERATE_ENABLE_PRIVILEGED;
    delete process.env.OPERATE_ENABLE_PRIVILEGED;

    const service = new PrivilegedService(new FakeSSHExecutor());
    await expect(
      service.runSudo({
        host: "art@100.115.12.115",
        command: "whoami",
        password: "secret"
      })
    ).rejects.toThrow("Privileged execution disabled");

    if (previous) {
      process.env.OPERATE_ENABLE_PRIVILEGED = previous;
    }
  });

  test("executes sudo when feature gate enabled", async () => {
    const previous = process.env.OPERATE_ENABLE_PRIVILEGED;
    process.env.OPERATE_ENABLE_PRIVILEGED = "1";

    const service = new PrivilegedService(new FakeSSHExecutor());
    const result = await service.runSudo({
      host: "art@100.115.12.115",
      command: "whoami",
      password: "secret"
    });

    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain("sudo:art@100.115.12.115:whoami");

    if (previous) {
      process.env.OPERATE_ENABLE_PRIVILEGED = previous;
    } else {
      delete process.env.OPERATE_ENABLE_PRIVILEGED;
    }
  });
});
