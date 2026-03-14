import { describe, expect, test } from "bun:test";
import { OpencodeDispatchService } from "../src/opencode-dispatch";

describe("OpencodeDispatchService", () => {
  test("dispatches command mode as opencode job", async () => {
    const calls: Array<{ type: string; payload: unknown }> = [];
    const service = new OpencodeDispatchService({
      async createJob(request) {
        calls.push({ type: "job", payload: request });
        return { id: "job-1" };
      },
      async createSession() {
        calls.push({ type: "session", payload: null });
      },
      async sendSession() {
        calls.push({ type: "send", payload: null });
      }
    });

    const result = await service.dispatch({
      host: "art@100.115.12.115",
      mode: "command",
      message: "hello"
    });

    expect(result).toEqual({ mode: "command", host: "art@100.115.12.115", jobId: "job-1" });
    expect(calls).toHaveLength(1);
  });

  test("dispatches agent mode to session create+send", async () => {
    const calls: string[] = [];
    const service = new OpencodeDispatchService({
      async createJob() {
        calls.push("job");
        return { id: "job-x" };
      },
      async createSession() {
        calls.push("create");
      },
      async sendSession() {
        calls.push("send");
      }
    });

    const result = await service.dispatch({
      host: "art@100.115.12.115",
      mode: "agent",
      sessionName: "op-agent",
      message: "continue"
    });

    expect(result).toEqual({ mode: "agent", host: "art@100.115.12.115", sessionName: "op-agent" });
    expect(calls).toEqual(["create", "send"]);
  });
});
