import { randomUUID } from "node:crypto";
import { RuntimeService } from "./runtime-adapters";
import type { CreateJobRequest, JobRecord, RuntimeActionRequest } from "./types";

export class JobService {
  private readonly jobs = new Map<string, JobRecord>();

  constructor(private readonly runtimeService: RuntimeService) {}

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
      createdAt: new Date().toISOString()
    };

    this.jobs.set(job.id, job);
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

      return job;
    } catch (error) {
      job.finishedAt = new Date().toISOString();
      job.status = "failed";
      job.error = error instanceof Error ? error.message : String(error);
      return job;
    }
  }
}
