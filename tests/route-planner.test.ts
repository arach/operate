import { describe, expect, test } from "bun:test";
import { RoutePlannerService } from "../src/route-planner";
import type { InventorySnapshot } from "../src/types";

function fixtureSnapshot(): InventorySnapshot {
  return {
    createdAt: "2026-03-13T00:00:00.000Z",
    hosts: [
      {
        machine: {
          host: "macmini.local",
          hostname: "macmini",
          os: "Darwin",
          arch: "arm64"
        },
        runtimes: [
          { name: "hermes", binaryPath: "/usr/local/bin/hermes", version: "1.0", status: "available" },
          { name: "opencode", binaryPath: "/opt/homebrew/bin/opencode", version: "0.4", status: "available" },
          { name: "claude", binaryPath: "", version: "", status: "unavailable" }
        ],
        probedAt: "2026-03-13T00:00:00.000Z",
        errors: []
      },
      {
        machine: {
          host: "worker-1",
          hostname: "worker-1",
          os: "Linux",
          arch: "x86_64"
        },
        runtimes: [
          { name: "hermes", binaryPath: "", version: "", status: "unavailable" },
          { name: "opencode", binaryPath: "/usr/bin/opencode", version: "0.4", status: "available" },
          { name: "claude", binaryPath: "/usr/local/bin/claude", version: "2.0", status: "available" }
        ],
        probedAt: "2026-03-13T00:00:00.000Z",
        errors: ["intermittent ssh warning"]
      }
    ]
  };
}

describe("RoutePlannerService", () => {
  test("selects highest-scoring candidate", () => {
    const planner = new RoutePlannerService();
    const plan = planner.plan(fixtureSnapshot(), {});

    expect(plan.selected).not.toBeNull();
    expect(plan.selected?.host).toBe("macmini.local");
    expect(plan.selected?.runtime).toBe("hermes");
  });

  test("honors required runtime constraint", () => {
    const planner = new RoutePlannerService();
    const plan = planner.plan(fixtureSnapshot(), { requiredRuntime: "claude" });

    expect(plan.selected?.runtime).toBe("claude");
    expect(plan.selected?.host).toBe("worker-1");
  });

  test("returns no selection when required runtime unavailable", () => {
    const planner = new RoutePlannerService();
    const snapshot = fixtureSnapshot();
    snapshot.hosts.forEach((host) => {
      host.runtimes = host.runtimes.map((runtime) => ({ ...runtime, status: "unavailable" as const }));
    });

    const plan = planner.plan(snapshot, { requiredRuntime: "hermes" });
    expect(plan.selected).toBeNull();
    expect(plan.reason).toContain("No hosts satisfy requested runtime constraints");
  });
});
