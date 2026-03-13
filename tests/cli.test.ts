import { describe, expect, test } from "bun:test";
import { parseDiscoverHostsArgs, parseDiscoverTailscaleArgs, parseJobRunArgs } from "../src/cli";

describe("cli parsers", () => {
  test("parses discover hosts args", () => {
    const hosts = parseDiscoverHostsArgs(["--hosts", "a,b,c"]);
    expect(hosts).toEqual(["a", "b", "c"]);
  });

  test("parses tailscale discover args", () => {
    const payload = parseDiscoverTailscaleArgs(["--include-offline", "--source", "ip"]);
    expect(payload.includeOffline).toBe(true);
    expect(payload.sourcePreference).toBe("ip");
  });

  test("parses job run args with command sentinel", () => {
    const payload = parseJobRunArgs([
      "--host",
      "art@100.115.12.115",
      "--runtime",
      "opencode",
      "--mode",
      "async",
      "--timeout",
      "5000",
      "--",
      "run",
      "--help"
    ]);

    expect(payload.host).toBe("art@100.115.12.115");
    expect(payload.runtime).toBe("opencode");
    expect(payload.mode).toBe("async");
    expect(payload.timeoutMs).toBe(5000);
    expect(payload.args).toEqual(["run", "--help"]);
  });
});
