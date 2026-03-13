import { describe, expect, test } from "bun:test";
import { parseProbeOutput } from "../src/probe";

describe("parseProbeOutput", () => {
  test("parses machine identity and discovered runtimes", () => {
    const stdout = [
      "HOSTNAME=macmini",
      "OS=Darwin",
      "ARCH=arm64",
      "RUNTIME=hermes|/usr/local/bin/hermes|hermes 1.0.0",
      "RUNTIME=opencode|/opt/homebrew/bin/opencode|opencode 0.4.2"
    ].join("\n");

    const parsed = parseProbeOutput("macmini.local", stdout);

    expect(parsed.hostname).toBe("macmini");
    expect(parsed.os).toBe("Darwin");
    expect(parsed.arch).toBe("arm64");
    expect(parsed.runtimes.find((runtime) => runtime.name === "hermes")?.status).toBe("available");
    expect(parsed.runtimes.find((runtime) => runtime.name === "opencode")?.status).toBe("available");
    expect(parsed.runtimes.find((runtime) => runtime.name === "claude")?.status).toBe("unavailable");
  });
});
