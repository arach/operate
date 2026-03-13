import { describe, expect, test } from "bun:test";
import { JobService } from "../src/jobs";
import { createDefaultRuntimeRegistry, RuntimeService } from "../src/runtime-adapters";
import { SshCommandTransport } from "../src/transport";
import type { JobRecord, JobStore, SSHExecutor, SSHResult } from "../src/types";

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

class MemoryJobStore implements JobStore {
  private records: JobRecord[];

  constructor(initial: JobRecord[] = []) {
    this.records = initial;
  }

  async load(): Promise<JobRecord[]> {
    return this.records;
  }

  async save(jobs: JobRecord[]): Promise<void> {
    this.records = jobs;
  }
}

describe("JobService", () => {
  test("creates and runs successful job", async () => {
    const runtimeService = new RuntimeService(
      new SshCommandTransport(new FakeSSHExecutor()),
      createDefaultRuntimeRegistry()
    );
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
      new SshCommandTransport(
        new FakeSSHExecutor({
          stdout: "",
          stderr: "bad run",
          exitCode: 2
        })
      ),
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

  test("loads persisted jobs from store", async () => {
    const createdAt = new Date().toISOString();
    const store = new MemoryJobStore([
      {
        id: "job-1",
        host: "macmini.local",
        runtime: "hermes",
        args: ["chat"],
        status: "queued",
        createdAt,
        attempts: 0
      }
    ]);

    const runtimeService = new RuntimeService(
      new SshCommandTransport(new FakeSSHExecutor()),
      createDefaultRuntimeRegistry()
    );
    const jobs = new JobService(runtimeService, store);
    await jobs.init();

    expect(jobs.get("job-1")?.createdAt).toBe(createdAt);
  });

  test("requeues persisted running jobs on init", async () => {
    const store = new MemoryJobStore([
      {
        id: "job-running",
        host: "macmini.local",
        runtime: "hermes",
        args: ["chat"],
        status: "running",
        createdAt: new Date().toISOString(),
        startedAt: new Date().toISOString(),
        attempts: 0
      }
    ]);

    const runtimeService = new RuntimeService(
      new SshCommandTransport(new FakeSSHExecutor()),
      createDefaultRuntimeRegistry()
    );
    const jobs = new JobService(runtimeService, store);

    await jobs.init();
    await Bun.sleep(5);

    expect(jobs.get("job-running")?.status).toBe("completed");
    expect(jobs.get("job-running")?.attempts).toBe(1);
  });

  test("queues async job and processes queue", async () => {
    const runtimeService = new RuntimeService(
      new SshCommandTransport(new FakeSSHExecutor()),
      createDefaultRuntimeRegistry()
    );
    const jobs = new JobService(runtimeService, new MemoryJobStore());

    const job = jobs.create({
      host: "macmini.local",
      runtime: "hermes",
      args: ["chat", "-q", "hello"],
      mode: "async"
    });

    await Bun.sleep(5);
    const current = jobs.get(job.id);
    expect(current).not.toBeNull();
    expect(current?.status).toBe("completed");
    expect(current?.attempts).toBe(1);
  });

  test("retry resets and re-runs failed job", async () => {
    const failingRuntime = new RuntimeService(
      new SshCommandTransport(
        new FakeSSHExecutor({
          stdout: "",
          stderr: "first failure",
          exitCode: 1
        })
      ),
      createDefaultRuntimeRegistry()
    );

    const jobs = new JobService(failingRuntime, new MemoryJobStore());
    const job = jobs.create({
      host: "macmini.local",
      runtime: "hermes",
      args: ["chat"]
    });

    await jobs.run(job.id);
    expect(jobs.get(job.id)?.status).toBe("failed");

    const succeedingRuntime = new RuntimeService(
      new SshCommandTransport(new FakeSSHExecutor()),
      createDefaultRuntimeRegistry()
    );
    const retryable = new JobService(succeedingRuntime, new MemoryJobStore(jobs.list()));
    await retryable.init();
    await retryable.retry(job.id);
    await Bun.sleep(5);

    expect(retryable.get(job.id)?.status).toBe("completed");
    expect(retryable.get(job.id)?.attempts).toBeGreaterThan(1);
  });
});
