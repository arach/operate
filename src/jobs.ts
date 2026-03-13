import { randomUUID } from "node:crypto";
import { RuntimeService } from "./runtime-adapters";
import type { CreateJobRequest, JobRecord, JobStore, RuntimeActionRequest } from "./types";

export class JobService {
  private readonly jobs = new Map<string, JobRecord>();
  private queueRunning = false;

  constructor(
    private readonly runtimeService: RuntimeService,
    private readonly store?: JobStore
  ) {}

  async init(): Promise<void> {
    if (!this.store) {
      return;
    }

    const persisted = await this.store.load();
    for (const job of persisted) {
      this.jobs.set(job.id, job);
    }
  }

  private async save(): Promise<void> {
    if (!this.store) {
      return;
    }
    await this.store.save(this.list());
  }

  list(): JobRecord[] {
    return Array.from(this.jobs.values()).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }

  get(id: string): JobRecord | null {
    return this.jobs.get(id) ?? null;
  }

  create(request: CreateJobRequest): JobRecord {
    const job: JobRecord = {
      id: randomUUID(),
      host: request.host,
      runtime: request.runtime,
      args: request.args,
      status: "queued",
      createdAt: new Date().toISOString(),
      attempts: 0
    };

    this.jobs.set(job.id, job);
    void this.save();

    if (request.mode === "async") {
      this.kickQueue();
    }

    return job;
  }

  async run(id: string, timeoutMs?: number): Promise<JobRecord> {
    const job = this.jobs.get(id);
    if (!job) {
      throw new Error(`Job not found: ${id}`);
    }

    if (job.status !== "queued") {
      return job;
    }

    job.status = "running";
    job.startedAt = new Date().toISOString();
    job.attempts += 1;
    await this.save();

    try {
      const runtimeRequest: CreateJobRequest = {
        host: job.host,
        args: job.args,
        runtime: job.runtime
      };

      if (typeof timeoutMs === "number") {
        runtimeRequest.timeoutMs = timeoutMs;
      }

      const actionRequest: RuntimeActionRequest = {
        host: runtimeRequest.host,
        args: runtimeRequest.args
      };

      if (typeof runtimeRequest.timeoutMs === "number") {
        actionRequest.timeoutMs = runtimeRequest.timeoutMs;
      }

      const result = await this.runtimeService.execute(job.runtime, actionRequest);

      job.result = result;
      job.finishedAt = new Date().toISOString();
      job.status = result.exitCode === 0 ? "completed" : "failed";
      if (result.exitCode !== 0) {
        job.error = result.stderr || `Process exited with code ${result.exitCode}`;
      }

      await this.save();

      return job;
    } catch (error) {
      job.finishedAt = new Date().toISOString();
      job.status = "failed";
      job.error = error instanceof Error ? error.message : String(error);
      await this.save();
      return job;
    }
  }

  async retry(id: string): Promise<JobRecord> {
    const job = this.jobs.get(id);
    if (!job) {
      throw new Error(`Job not found: ${id}`);
    }

    if (job.status === "running") {
      return job;
    }

    job.status = "queued";
    delete job.error;
    delete job.result;
    delete job.startedAt;
    delete job.finishedAt;
    await this.save();
    this.kickQueue();
    return job;
  }

  private kickQueue(): void {
    if (this.queueRunning) {
      return;
    }

    this.queueRunning = true;
    void this.consumeQueue();
  }

  private async consumeQueue(): Promise<void> {
    try {
      while (true) {
        const queued = this.list().find((job) => job.status === "queued");
        if (!queued) {
          return;
        }

        await this.run(queued.id);
      }
    } finally {
      this.queueRunning = false;
    }
  }
}
