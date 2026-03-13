import { describe, expect, test } from "bun:test";
import { TailscaleDiscoveryService } from "../src/tailscale-discovery";

describe("TailscaleDiscoveryService", () => {
  test("parses tailscale peers into ssh targets", async () => {
    const service = new TailscaleDiscoveryService(async () => ({
      stdout: JSON.stringify({
        Self: { User: "art" },
        Peer: {
          node1: {
            HostName: "arts-mac-mini",
            DNSName: "arts-mac-mini.tail6bf405.ts.net.",
            TailscaleIPs: ["100.115.12.115"],
            Online: true
          }
        }
      }),
      stderr: "",
      exitCode: 0
    }));

    const targets = await service.discover(false, "both");
    expect(targets.some((target) => target.host === "art@100.115.12.115")).toBe(true);
    expect(targets.some((target) => target.host === "arts-mac-mini.tail6bf405.ts.net")).toBe(true);
  });

  test("filters offline peers by default", async () => {
    const service = new TailscaleDiscoveryService(async () => ({
      stdout: JSON.stringify({
        Self: { User: "art" },
        Peer: {
          node1: {
            DNSName: "offline.tailnet.ts.net.",
            TailscaleIPs: ["100.64.0.3"],
            Online: false
          }
        }
      }),
      stderr: "",
      exitCode: 0
    }));

    const targets = await service.discover();
    expect(targets).toHaveLength(0);
  });

  test("throws when tailscale command fails", async () => {
    const service = new TailscaleDiscoveryService(async () => ({
      stdout: "",
      stderr: "tailscale not installed",
      exitCode: 127
    }));

    expect(service.discover()).rejects.toThrow("tailscale not installed");
  });
});
