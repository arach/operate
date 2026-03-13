import { InventoryService } from "./inventory";
import { JsonFileInventoryStore } from "./inventory-store";
import { createDefaultRuntimeRegistry, RuntimeService } from "./runtime-adapters";
import { OpenSSHExecutor } from "./ssh";
import type { DiscoverRequest, RuntimeActionRequest, RuntimeName } from "./types";

const ssh = new OpenSSHExecutor();
const inventoryStore = new JsonFileInventoryStore(".operate/inventory-snapshot.json");
const inventory = new InventoryService(ssh, inventoryStore);
await inventory.init();
const runtimeService = new RuntimeService(ssh, createDefaultRuntimeRegistry());

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
      return json({ ok: true, service: "operate" });
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

    if (req.method === "GET" && pathname === "/runtimes") {
      return json({
        supported: runtimeService.listSupportedRuntimes(),
        known: RUNTIME_NAMES
      });
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

    return json({ error: "Not found" }, 404);
  }
});

console.log(`operate listening on http://localhost:${server.port}`);
