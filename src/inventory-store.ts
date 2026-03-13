import { mkdir } from "node:fs/promises";
import { dirname } from "node:path";
import type { InventorySnapshot, InventoryStore } from "./types";

export class JsonFileInventoryStore implements InventoryStore {
  constructor(private readonly filePath: string) {}

  async load(): Promise<InventorySnapshot | null> {
    const file = Bun.file(this.filePath);
    if (!(await file.exists())) {
      return null;
    }

    const parsed = await file.json();
    if (!isInventorySnapshot(parsed)) {
      throw new Error(`Invalid inventory snapshot in ${this.filePath}`);
    }

    return parsed;
  }

  async save(snapshot: InventorySnapshot): Promise<void> {
    await mkdir(dirname(this.filePath), { recursive: true });
    await Bun.write(this.filePath, JSON.stringify(snapshot, null, 2));
  }
}

function isInventorySnapshot(value: unknown): value is InventorySnapshot {
  if (!value || typeof value !== "object") {
    return false;
  }

  const asRecord = value as Record<string, unknown>;
  if (typeof asRecord.createdAt !== "string") {
    return false;
  }

  if (!Array.isArray(asRecord.hosts)) {
    return false;
  }

  return true;
}
