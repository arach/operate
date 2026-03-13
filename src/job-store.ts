import { mkdir } from "node:fs/promises";
import { dirname } from "node:path";
import type { JobRecord, JobStore } from "./types";

export class JsonFileJobStore implements JobStore {
  constructor(private readonly filePath: string) {}

  async load(): Promise<JobRecord[]> {
    const file = Bun.file(this.filePath);
    if (!(await file.exists())) {
      return [];
    }

    const parsed = await file.json();
    if (!Array.isArray(parsed)) {
      throw new Error(`Invalid jobs store payload in ${this.filePath}`);
    }

    return parsed as JobRecord[];
  }

  async save(jobs: JobRecord[]): Promise<void> {
    await mkdir(dirname(this.filePath), { recursive: true });
    await Bun.write(this.filePath, JSON.stringify(jobs, null, 2));
  }
}
