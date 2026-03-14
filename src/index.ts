import { InventoryService } from "./inventory";
import { JsonFileInventoryStore } from "./inventory-store";
import { JsonFileJobStore } from "./job-store";
import { JobService } from "./jobs";
import { OpencodeDispatchService } from "./opencode-dispatch";
import { PrivilegedService } from "./privileged";
import { RoutePlannerService } from "./route-planner";
import { createDefaultRuntimeRegistry, RuntimeService } from "./runtime-adapters";
import { OpenSSHExecutor } from "./ssh";
import { TailscaleDiscoveryService } from "./tailscale-discovery";
import { TmuxSessionService } from "./tmux-sessions";
import { createCommandTransport, readTransportConfig } from "./transport";
import type {
  CreateSessionRequest,
  CreateJobRequest,
  DiscoverRequest,
  OpencodeDispatchRequest,
  PrivilegedRequest,
  SessionCaptureRequest,
  SessionSendRequest,
  TailscaleDiscoverRequest,
  RoutePlanRequest,
  RuntimeActionRequest,
  RuntimeName
} from "./types";

const ssh = new OpenSSHExecutor();
const transportConfig = readTransportConfig();
const transport = createCommandTransport(transportConfig, ssh);
const privileged = new PrivilegedService(ssh);
const inventoryStore = new JsonFileInventoryStore(".operate/inventory-snapshot.json");
const inventory = new InventoryService(ssh, inventoryStore);
await inventory.init();
const runtimeService = new RuntimeService(transport, createDefaultRuntimeRegistry());
const sessions = new TmuxSessionService(transport);
const routePlanner = new RoutePlannerService();
const jobStore = new JsonFileJobStore(".operate/jobs.json");
const jobs = new JobService(runtimeService, jobStore);
await jobs.init();
const tailscale = new TailscaleDiscoveryService();
const opencodeDispatch = new OpencodeDispatchService({
  async createJob(request: CreateJobRequest) {
    const job = jobs.create(request);
    if (request.mode !== "async") {
      await jobs.run(job.id, request.timeoutMs);
    }
    return { id: job.id };
  },
  async createSession(request: CreateSessionRequest) {
    await sessions.create(request);
  },
  async sendSession(name, request: SessionSendRequest) {
    await sessions.send(name, request);
  }
});

const RUNTIME_NAMES: RuntimeName[] = ["hermes", "opencode", "claude"];

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data, null, 2), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8"
    }
  });
}

const server = Bun.serve({
  port: 8787,
  async fetch(req: Request): Promise<Response> {
    const { pathname } = new URL(req.url);

    if (req.method === "GET" && pathname === "/health") {
      return json({
        ok: true,
        service: "operate",
        transport: transportConfig.kind
      });
    }

    if (req.method === "GET" && pathname === "/inventory") {
      return json(inventory.getLatestSnapshot());
    }

    if (req.method === "POST" && pathname === "/inventory/discover") {
      let body: DiscoverRequest;
      try {
        body = (await req.json()) as DiscoverRequest;
      } catch {
        return json({ error: "Invalid JSON body" }, 400);
      }

      if (!Array.isArray(body.hosts)) {
        return json({ error: "Body must include hosts: string[]" }, 400);
      }

      const snapshot = await inventory.discover(body.hosts);
      return json(snapshot, 201);
    }

    if (req.method === "POST" && pathname === "/inventory/discover/tailscale") {
      let body: TailscaleDiscoverRequest = {};
      try {
        body = (await req.json()) as TailscaleDiscoverRequest;
      } catch {}

      if (
        body.sourcePreference &&
        body.sourcePreference !== "ip" &&
        body.sourcePreference !== "dns" &&
        body.sourcePreference !== "both"
      ) {
        return json({ error: "sourcePreference must be one of: ip, dns, both" }, 400);
      }

      try {
        const targets = await tailscale.discover(body.includeOffline === true, body.sourcePreference ?? "both");
        const hosts = targets.map((target) => target.host);
        const snapshot = await inventory.discover(hosts);
        return json(
          {
            tailscaleTargets: targets,
            snapshot
          },
          201
        );
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        return json({ error: `Tailscale discovery failed: ${message}` }, 500);
      }
    }

    if (req.method === "GET" && pathname === "/runtimes") {
      return json({
        supported: runtimeService.listSupportedRuntimes(),
        known: RUNTIME_NAMES
      });
    }

    if (req.method === "POST" && pathname === "/route/plan") {
      let body: RoutePlanRequest;
      try {
        body = (await req.json()) as RoutePlanRequest;
      } catch {
        return json({ error: "Invalid JSON body" }, 400);
      }

      if (body.requiredRuntime && !RUNTIME_NAMES.includes(body.requiredRuntime)) {
        return json({ error: "requiredRuntime must be one of: hermes, opencode, claude" }, 400);
      }

      if (body.preferredRuntime && !RUNTIME_NAMES.includes(body.preferredRuntime)) {
        return json({ error: "preferredRuntime must be one of: hermes, opencode, claude" }, 400);
      }

      const plan = routePlanner.plan(inventory.getLatestSnapshot(), body);
      return json(plan, 201);
    }

    if (req.method === "POST" && pathname === "/opencode/dispatch") {
      let body: OpencodeDispatchRequest;
      try {
        body = (await req.json()) as OpencodeDispatchRequest;
      } catch {
        return json({ error: "Invalid JSON body" }, 400);
      }

      if (!body.host || typeof body.host !== "string") {
        return json({ error: "Body must include host: string" }, 400);
      }
      if (!body.message || typeof body.message !== "string") {
        return json({ error: "Body must include message: string" }, 400);
      }
      if (body.mode !== "command" && body.mode !== "agent") {
        return json({ error: "Body must include mode: command|agent" }, 400);
      }

      try {
        const result = await opencodeDispatch.dispatch(body);
        return json(result, 201);
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        return json({ error: message }, 400);
      }
    }

    if (req.method === "POST" && pathname === "/privileged/sudo") {
      let body: PrivilegedRequest;
      try {
        body = (await req.json()) as PrivilegedRequest;
      } catch {
        return json({ error: "Invalid JSON body" }, 400);
      }

      if (!body.host || typeof body.host !== "string") {
        return json({ error: "Body must include host: string" }, 400);
      }
      if (!body.command || typeof body.command !== "string") {
        return json({ error: "Body must include command: string" }, 400);
      }
      if (!body.password || typeof body.password !== "string") {
        return json({ error: "Body must include password: string" }, 400);
      }

      try {
        const result = await privileged.runSudo(body);
        return json(result, 201);
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        return json({ error: message }, 400);
      }
    }

    if (req.method === "POST" && pathname.startsWith("/runtimes/") && pathname.endsWith("/tools")) {
      const parts = pathname.split("/").filter((part) => part.length > 0);
      const runtime = parts[1] as RuntimeName | undefined;
      if (!runtime || !RUNTIME_NAMES.includes(runtime)) {
        return json({ error: "Invalid runtime" }, 400);
      }

      let body: RuntimeActionRequest;
      try {
        body = (await req.json()) as RuntimeActionRequest;
      } catch {
        return json({ error: "Invalid JSON body" }, 400);
      }

      if (!body.host || typeof body.host !== "string") {
        return json({ error: "Body must include host: string" }, 400);
      }

      try {
        const runtimeRequest: RuntimeActionRequest = { host: body.host };
        if (typeof body.timeoutMs === "number") {
          runtimeRequest.timeoutMs = body.timeoutMs;
        }

        const result = await runtimeService.listTools(runtime, runtimeRequest);
        return json(result, 201);
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        return json({ error: message }, 400);
      }
    }

    if (req.method === "POST" && pathname.startsWith("/runtimes/") && pathname.endsWith("/execute")) {
      const parts = pathname.split("/").filter((part) => part.length > 0);
      const runtime = parts[1] as RuntimeName | undefined;
      if (!runtime || !RUNTIME_NAMES.includes(runtime)) {
        return json({ error: "Invalid runtime" }, 400);
      }

      let body: RuntimeActionRequest;
      try {
        body = (await req.json()) as RuntimeActionRequest;
      } catch {
        return json({ error: "Invalid JSON body" }, 400);
      }

      if (!body.host || typeof body.host !== "string") {
        return json({ error: "Body must include host: string" }, 400);
      }

      if (!Array.isArray(body.args)) {
        return json({ error: "Body must include args: string[]" }, 400);
      }

      try {
        const runtimeRequest: RuntimeActionRequest = {
          host: body.host,
          args: body.args
        };

        if (typeof body.timeoutMs === "number") {
          runtimeRequest.timeoutMs = body.timeoutMs;
        }

        const result = await runtimeService.execute(runtime, runtimeRequest);
        return json(result, 201);
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        return json({ error: message }, 400);
      }
    }

    if (req.method === "GET" && pathname === "/jobs") {
      return json({ jobs: jobs.list() });
    }

    if (req.method === "POST" && pathname === "/sessions") {
      let body: CreateSessionRequest;
      try {
        body = (await req.json()) as CreateSessionRequest;
      } catch {
        return json({ error: "Invalid JSON body" }, 400);
      }

      if (!body.host || typeof body.host !== "string") {
        return json({ error: "Body must include host: string" }, 400);
      }
      if (!body.name || typeof body.name !== "string") {
        return json({ error: "Body must include name: string" }, 400);
      }

      try {
        await sessions.create(body);
        return json({ ok: true, host: body.host, name: body.name }, 201);
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        return json({ error: message }, 400);
      }
    }

    if (req.method === "POST" && pathname === "/sessions/list") {
      let body: { host?: string };
      try {
        body = (await req.json()) as { host?: string };
      } catch {
        return json({ error: "Invalid JSON body" }, 400);
      }

      if (!body.host || typeof body.host !== "string") {
        return json({ error: "Body must include host: string" }, 400);
      }

      try {
        const list = await sessions.list(body.host);
        return json({ host: body.host, sessions: list }, 201);
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        return json({ error: message }, 400);
      }
    }

    if (req.method === "POST" && pathname === "/sessions/check") {
      let body: { host?: string };
      try {
        body = (await req.json()) as { host?: string };
      } catch {
        return json({ error: "Invalid JSON body" }, 400);
      }

      if (!body.host || typeof body.host !== "string") {
        return json({ error: "Body must include host: string" }, 400);
      }

      try {
        const status = await sessions.check(body.host);
        return json({ host: body.host, tmux: status }, 201);
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        return json({ error: message }, 400);
      }
    }

    if (req.method === "POST" && pathname.startsWith("/sessions/") && pathname.endsWith("/send")) {
      const parts = pathname.split("/").filter((part) => part.length > 0);
      const name = parts[1];
      if (!name) {
        return json({ error: "Missing session name" }, 400);
      }

      let body: SessionSendRequest;
      try {
        body = (await req.json()) as SessionSendRequest;
      } catch {
        return json({ error: "Invalid JSON body" }, 400);
      }

      if (!body.host || typeof body.host !== "string") {
        return json({ error: "Body must include host: string" }, 400);
      }
      if (typeof body.text !== "string") {
        return json({ error: "Body must include text: string" }, 400);
      }

      try {
        await sessions.send(name, body);
        return json({ ok: true, host: body.host, name }, 201);
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        return json({ error: message }, 400);
      }
    }

    if (req.method === "POST" && pathname.startsWith("/sessions/") && pathname.endsWith("/capture")) {
      const parts = pathname.split("/").filter((part) => part.length > 0);
      const name = parts[1];
      if (!name) {
        return json({ error: "Missing session name" }, 400);
      }

      let body: SessionCaptureRequest;
      try {
        body = (await req.json()) as SessionCaptureRequest;
      } catch {
        return json({ error: "Invalid JSON body" }, 400);
      }

      if (!body.host || typeof body.host !== "string") {
        return json({ error: "Body must include host: string" }, 400);
      }

      try {
        const output = await sessions.capture(name, body);
        return json({ host: body.host, name, output }, 201);
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        return json({ error: message }, 400);
      }
    }

    if (req.method === "POST" && pathname.startsWith("/sessions/") && pathname.endsWith("/kill")) {
      const parts = pathname.split("/").filter((part) => part.length > 0);
      const name = parts[1];
      if (!name) {
        return json({ error: "Missing session name" }, 400);
      }

      let body: { host?: string };
      try {
        body = (await req.json()) as { host?: string };
      } catch {
        return json({ error: "Invalid JSON body" }, 400);
      }

      if (!body.host || typeof body.host !== "string") {
        return json({ error: "Body must include host: string" }, 400);
      }

      try {
        await sessions.kill(name, body.host);
        return json({ ok: true, host: body.host, name }, 201);
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        return json({ error: message }, 400);
      }
    }

    if (req.method === "POST" && pathname === "/jobs") {
      let body: CreateJobRequest;
      try {
        body = (await req.json()) as CreateJobRequest;
      } catch {
        return json({ error: "Invalid JSON body" }, 400);
      }

      if (!body.host || typeof body.host !== "string") {
        return json({ error: "Body must include host: string" }, 400);
      }

      if (!body.runtime || !RUNTIME_NAMES.includes(body.runtime)) {
        return json({ error: "Body must include runtime: hermes|opencode|claude" }, 400);
      }

      if (!Array.isArray(body.args)) {
        return json({ error: "Body must include args: string[]" }, 400);
      }

      const job = jobs.create(body);
      if (body.mode === "async") {
        return json(job, 202);
      }

      const executed = await jobs.run(job.id, body.timeoutMs);
      return json(executed, 201);
    }

    if (req.method === "POST" && pathname.startsWith("/jobs/") && pathname.endsWith("/retry")) {
      const parts = pathname.split("/").filter((part) => part.length > 0);
      const id = parts[1];
      if (!id) {
        return json({ error: "Missing job id" }, 400);
      }

      try {
        const job = await jobs.retry(id);
        return json(job, 202);
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        return json({ error: message }, 404);
      }
    }

    if (req.method === "GET" && pathname.startsWith("/jobs/")) {
      const parts = pathname.split("/").filter((part) => part.length > 0);
      const id = parts[1];
      if (!id) {
        return json({ error: "Missing job id" }, 400);
      }

      const job = jobs.get(id);
      if (!job) {
        return json({ error: "Job not found" }, 404);
      }

      return json(job);
    }

    return json({ error: "Not found" }, 404);
  }
});

console.log(`operate listening on http://localhost:${server.port}`);
