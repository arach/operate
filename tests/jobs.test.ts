import { describe, expect, test } from "bun:test";
import { JobService } from "../src/jobs";
import { createDefaultRuntimeRegistry, RuntimeService } from "../src/runtime-adapters";
import type { SSHExecutor, SSHResult } from "../src/types";

class FakeSSHExecutor implements SSHExecutor {
  constructor(
    private readonly response: SSHResult = {
      stdout: "done",
      stderr: "",
      exitCode: 0
    }
  ) {}

  async run(): Promise<SSHResult> {
    return this.response;
  }
}

describe("JobService", () => {
  test("creates and runs successful job", async () => {
    const runtimeService = new RuntimeService(new FakeSSHExecutor(), createDefaultRuntimeRegistry());
    const jobs = new JobService(runtimeService);

    const job = jobs.create({
      host: "macmini.local",
      runtime: "hermes",
      args: ["chat", "-q", "hello"]
    });

    expect(job.status).toBe("queued");

    const completed = await jobs.run(job.id);
    expect(completed.status).toBe("completed");
    expect(completed.result?.exitCode).toBe(0);
    expect(completed.finishedAt).toBeDefined();
  });

  test("marks failed job when runtime exits non-zero", async () => {
    const runtimeService = new RuntimeService(
      new FakeSSHExecutor({
        stdout: "",
        stderr: "bad run",
        exitCode: 2
      }),
      createDefaultRuntimeRegistry()
    );

    const jobs = new JobService(runtimeService);
    const job = jobs.create({
      host: "macmini.local",
      runtime: "hermes",
      args: ["chat", "-q", "hello"]
    });

    const failed = await jobs.run(job.id);
    expect(failed.status).toBe("failed");
    expect(failed.error).toContain("bad run");
  });
});
