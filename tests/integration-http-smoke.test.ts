import { afterAll, beforeAll, describe, expect, test } from "bun:test";

let serverProcess: Bun.Subprocess | null = null;

const baseUrl = "http://127.0.0.1:8787";

async function waitForHealth(timeoutMs = 5_000): Promise<void> {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      const response = await fetch(`${baseUrl}/health`);
      if (response.ok) {
        return;
      }
    } catch {}
    await Bun.sleep(100);
  }
  throw new Error("Timed out waiting for /health");
}

beforeAll(async () => {
  serverProcess = Bun.spawn(["bun", "src/index.ts"], {
    cwd: "/Users/arach/dev/operate",
    stdout: "pipe",
    stderr: "pipe"
  });

  await waitForHealth();
});

afterAll(async () => {
  if (serverProcess) {
    serverProcess.kill();
    await serverProcess.exited;
  }
});

describe("HTTP smoke flow", () => {
  test("health and runtimes endpoints return expected shape", async () => {
    const health = await fetch(`${baseUrl}/health`);
    const healthJson = (await health.json()) as { ok: boolean; transport: string };
    expect(health.ok).toBe(true);
    expect(healthJson.ok).toBe(true);
    expect(typeof healthJson.transport).toBe("string");

    const runtimes = await fetch(`${baseUrl}/runtimes`);
    const runtimesJson = (await runtimes.json()) as { supported: string[]; known: string[] };
    expect(runtimes.ok).toBe(true);
    expect(runtimesJson.known).toEqual(["hermes", "opencode", "claude"]);
  });

  test("async job can be created and reaches terminal state", async () => {
    const createResponse = await fetch(`${baseUrl}/jobs`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        host: "localhost",
        runtime: "hermes",
        args: ["--version"],
        mode: "async"
      })
    });

    expect(createResponse.status).toBe(202);
    const created = (await createResponse.json()) as { id: string };
    expect(typeof created.id).toBe("string");

    const start = Date.now();
    while (Date.now() - start < 10_000) {
      const jobResponse = await fetch(`${baseUrl}/jobs/${created.id}`);
      expect(jobResponse.ok).toBe(true);
      const job = (await jobResponse.json()) as { status: string };
      if (job.status === "completed" || job.status === "failed") {
        return;
      }
      await Bun.sleep(150);
    }

    throw new Error("Async job did not reach terminal state in time");
  });
});
