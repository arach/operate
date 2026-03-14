import { describe, expect, test } from "bun:test";
import { InventoryService } from "../src/inventory";
import type { InventoryStore } from "../src/types";
import type { SSHExecutor } from "../src/types";

class FakeSSHExecutor implements SSHExecutor {
  constructor(private readonly responses: Record<string, { stdout: string; stderr: string; exitCode: number }>) {}

  async run(host: string): Promise<{ stdout: string; stderr: string; exitCode: number }> {
    const response = this.responses[host];
    if (response) {
      return response;
    }

    return {
      stdout: "",
      stderr: "host not found",
      exitCode: 255
    };
  }

  async runSudo(host: string): Promise<{ stdout: string; stderr: string; exitCode: number }> {
    return this.run(host);
  }
}

describe("InventoryService", () => {
  test("builds snapshot from discovered hosts and de-duplicates input", async () => {
    const ssh = new FakeSSHExecutor({
      "macmini.local": {
        stdout: [
          "HOSTNAME=macmini",
          "OS=Darwin",
          "ARCH=arm64",
          "RUNTIME=hermes|/usr/local/bin/hermes|hermes 1.2.3"
        ].join("\n"),
        stderr: "",
        exitCode: 0
      }
    });

    const service = new InventoryService(ssh);
    const snapshot = await service.discover(["macmini.local", "macmini.local", "   "]);

    expect(snapshot.hosts).toHaveLength(1);
    expect(snapshot.hosts[0]?.machine.hostname).toBe("macmini");
    expect(snapshot.hosts[0]?.runtimes.find((runtime) => runtime.name === "hermes")?.status).toBe("available");
  });

  test("reports probe errors for unreachable hosts", async () => {
    const ssh = new FakeSSHExecutor({});
    const service = new InventoryService(ssh);

    const snapshot = await service.discover(["offline-host"]);
    expect(snapshot.hosts).toHaveLength(1);
    expect(snapshot.hosts[0]?.errors[0]).toContain("ssh exit 255");
    expect(snapshot.hosts[0]?.machine.host).toBe("offline-host");
  });

  test("loads persisted snapshot on init and saves on discover", async () => {
    const persisted = {
      createdAt: "2026-03-13T00:00:00.000Z",
      hosts: []
    };

    let savedCreatedAt = "";
    const store: InventoryStore = {
      async load() {
        return persisted;
      },
      async save(snapshot) {
        savedCreatedAt = snapshot.createdAt;
      }
    };

    const ssh = new FakeSSHExecutor({
      "macmini.local": {
        stdout: ["HOSTNAME=macmini", "OS=Darwin", "ARCH=arm64"].join("\n"),
        stderr: "",
        exitCode: 0
      }
    });

    const service = new InventoryService(ssh, store);
    await service.init();
    expect(service.getLatestSnapshot().createdAt).toBe(persisted.createdAt);

    await service.discover(["macmini.local"]);
    expect(savedCreatedAt.length).toBeGreaterThan(0);
  });
});
