import { describe, expect, test } from "bun:test";
import { createDefaultRuntimeRegistry, RuntimeService } from "../src/runtime-adapters";
import { SshCommandTransport } from "../src/transport";
import type { SSHExecutor, SSHResult } from "../src/types";

class FakeSSHExecutor implements SSHExecutor {
  calls: Array<{ host: string; command: string; timeoutMs?: number }> = [];

  async run(host: string, remoteCommand: string, timeoutMs?: number): Promise<SSHResult> {
    const call: { host: string; command: string; timeoutMs?: number } = {
      host,
      command: remoteCommand
    };

    if (typeof timeoutMs === "number") {
      call.timeoutMs = timeoutMs;
    }

    this.calls.push(call);
    return {
      stdout: "ok",
      stderr: "",
      exitCode: 0
    };
  }
}

describe("RuntimeService", () => {
  test("lists supported runtime adapters", () => {
    const ssh = new FakeSSHExecutor();
    const service = new RuntimeService(new SshCommandTransport(ssh), createDefaultRuntimeRegistry());
    expect(service.listSupportedRuntimes()).toEqual(["claude", "hermes", "opencode"]);
  });

  test("executes hermes command through SSH", async () => {
    const ssh = new FakeSSHExecutor();
    const service = new RuntimeService(new SshCommandTransport(ssh), createDefaultRuntimeRegistry());

    const result = await service.execute("hermes", {
      host: "macmini.local",
      args: ["chat", "-q", "status check"]
    });

    expect(result.runtime).toBe("hermes");
    expect(ssh.calls).toHaveLength(1);
    expect(ssh.calls[0]?.host).toBe("macmini.local");
    expect(ssh.calls[0]?.command.startsWith("hermes chat -q")).toBe(true);
  });

  test("lists hermes tools via adapter", async () => {
    const ssh = new FakeSSHExecutor();
    const service = new RuntimeService(new SshCommandTransport(ssh), createDefaultRuntimeRegistry());

    await service.listTools("hermes", { host: "macmini.local" });
    expect(ssh.calls[0]?.command).toBe("hermes tools");
  });

  test("executes opencode command through SSH", async () => {
    const ssh = new FakeSSHExecutor();
    const service = new RuntimeService(new SshCommandTransport(ssh), createDefaultRuntimeRegistry());

    await service.execute("opencode", {
      host: "macmini.local",
      args: ["run", "--help"]
    });

    expect(ssh.calls[0]?.command).toBe("opencode run --help");
  });

  test("executes claude command through SSH", async () => {
    const ssh = new FakeSSHExecutor();
    const service = new RuntimeService(new SshCommandTransport(ssh), createDefaultRuntimeRegistry());

    await service.execute("claude", {
      host: "macmini.local",
      args: ["--version"]
    });

    expect(ssh.calls[0]?.command).toBe("claude --version");
  });
});
