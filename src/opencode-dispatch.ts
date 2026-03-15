import type { CreateJobRequest, OpencodeDispatchRequest } from "./types";

interface OpencodeDispatchDependencies {
  createJob(request: CreateJobRequest): Promise<{ id: string }>;
  createSession(request: {
    host: string;
    name: string;
    command?: string;
    cwd?: string;
    keepAlive?: boolean;
  }): Promise<void>;
  sendSession(name: string, request: { host: string; text: string; enter?: boolean }): Promise<void>;
}

export class OpencodeDispatchService {
  constructor(private readonly deps: OpencodeDispatchDependencies) {}

  async dispatch(request: OpencodeDispatchRequest): Promise<Record<string, unknown>> {
    if (request.mode === "command") {
      const args = request.model
        ? ["run", "-m", request.model, request.message]
        : ["run", request.message];
      const jobRequest: CreateJobRequest = {
        host: request.host,
        runtime: "opencode",
        args,
        mode: request.jobMode ?? "sync"
      };

      if (typeof request.timeoutMs === "number") {
        jobRequest.timeoutMs = request.timeoutMs;
      }

      const job = await this.deps.createJob(jobRequest);

      return {
        mode: "command",
        host: request.host,
        jobId: job.id
      };
    }

    const sessionName = request.sessionName?.trim();
    if (!sessionName) {
      throw new Error("sessionName is required in agent mode");
    }

    const sessionRequest: {
      host: string;
      name: string;
      command?: string;
      cwd?: string;
      keepAlive?: boolean;
    } = {
      host: request.host,
      name: sessionName,
      command: "opencode run",
      keepAlive: true
    };
    if (request.cwd) {
      sessionRequest.cwd = request.cwd;
    }

    await this.deps.createSession(sessionRequest);

    await this.deps.sendSession(sessionName, {
      host: request.host,
      text: request.message,
      enter: true
    });

    return {
      mode: "agent",
      host: request.host,
      sessionName
    };
  }
}
