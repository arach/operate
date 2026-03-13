import { mkdtemp } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { describe, expect, test } from "bun:test";
import { JsonFileJobStore } from "../src/job-store";
import type { JobRecord } from "../src/types";

describe("JsonFileJobStore", () => {
  test("saves and loads job records", async () => {
    const dir = await mkdtemp(join(tmpdir(), "operate-job-store-"));
    const path = join(dir, "jobs.json");
    const store = new JsonFileJobStore(path);

    const records: JobRecord[] = [
      {
        id: "job-1",
        host: "macmini.local",
        runtime: "hermes",
        args: ["chat", "-q", "hello"],
        status: "completed",
        createdAt: new Date().toISOString(),
        startedAt: new Date().toISOString(),
        finishedAt: new Date().toISOString(),
        attempts: 1,
        result: {
          runtime: "hermes",
          host: "macmini.local",
          command: "hermes chat -q hello",
          stdout: "ok",
          stderr: "",
          exitCode: 0,
          executedAt: new Date().toISOString()
        }
      }
    ];

    await store.save(records);
    const loaded = await store.load();

    expect(loaded).toHaveLength(1);
    expect(loaded[0]?.id).toBe("job-1");
    expect(loaded[0]?.attempts).toBe(1);
  });
});
