import { describe, expect, test } from "bun:test";
import { parseTmuxListOutput, TmuxSessionService } from "../src/tmux-sessions";
import type { CommandTransport, SSHResult } from "../src/types";

class FakeTransport implements CommandTransport {
  constructor(private readonly result: SSHResult) {}

  async run(): Promise<SSHResult> {
    return this.result;
  }
}

describe("parseTmuxListOutput", () => {
  test("parses tmux list-sessions output", () => {
    const output = ["dev|1|2|1710000000", "ops|0|1|1710001111"].join("\n");
    const sessions = parseTmuxListOutput(output);

    expect(sessions).toHaveLength(2);
    expect(sessions[0]?.name).toBe("dev");
    expect(sessions[0]?.attached).toBe(true);
    expect(sessions[1]?.name).toBe("ops");
    expect(sessions[1]?.windows).toBe(1);
  });

  test("ignores blank lines", () => {
    const sessions = parseTmuxListOutput("\n\n");
    expect(sessions).toHaveLength(0);
  });

  test("check reports tmux not installed", async () => {
    const service = new TmuxSessionService(
      new FakeTransport({ stdout: "", stderr: "zsh: command not found: tmux", exitCode: 127 })
    );

    const status = await service.check("host");
    expect(status.available).toBe(false);
    expect(status.detail).toBe("tmux not installed");
  });
});
