import { mkdtemp } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { describe, expect, test } from "bun:test";
import { JsonFileInventoryStore } from "../src/inventory-store";
import type { InventorySnapshot } from "../src/types";

describe("JsonFileInventoryStore", () => {
  test("saves and loads inventory snapshots", async () => {
    const dir = await mkdtemp(join(tmpdir(), "operate-store-"));
    const path = join(dir, "inventory.json");
    const store = new JsonFileInventoryStore(path);

    const snapshot: InventorySnapshot = {
      createdAt: new Date().toISOString(),
      hosts: [
        {
          machine: {
            host: "macmini.local",
            hostname: "macmini",
            os: "Darwin",
            arch: "arm64"
          },
          runtimes: [
            {
              name: "hermes",
              binaryPath: "/usr/local/bin/hermes",
              version: "1.0.0",
              status: "available"
            },
            {
              name: "opencode",
              binaryPath: "",
              version: "",
              status: "unavailable"
            },
            {
              name: "claude",
              binaryPath: "",
              version: "",
              status: "unavailable"
            }
          ],
          probedAt: new Date().toISOString(),
          errors: []
        }
      ]
    };

    await store.save(snapshot);
    const loaded = await store.load();

    expect(loaded).not.toBeNull();
    expect(loaded?.hosts[0]?.machine.hostname).toBe("macmini");
    expect(loaded?.hosts[0]?.runtimes[0]?.name).toBe("hermes");
  });
});
