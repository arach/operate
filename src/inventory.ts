import { HostProbeService } from "./probe";
import type { InventorySnapshot, InventoryStore, SSHExecutor } from "./types";

export class InventoryService {
  private latestSnapshot: InventorySnapshot = {
    createdAt: new Date(0).toISOString(),
    hosts: []
  };

  private readonly hostProbe: HostProbeService;

  constructor(
    ssh: SSHExecutor,
    private readonly store?: InventoryStore
  ) {
    this.hostProbe = new HostProbeService(ssh);
  }

  async init(): Promise<void> {
    if (!this.store) {
      return;
    }

    const persisted = await this.store.load();
    if (persisted) {
      this.latestSnapshot = persisted;
    }
  }

  getLatestSnapshot(): InventorySnapshot {
    return this.latestSnapshot;
  }

  async discover(hosts: string[]): Promise<InventorySnapshot> {
    const normalized = Array.from(
      new Set(
        hosts
          .map((host) => host.trim())
          .filter((host) => host.length > 0)
      )
    );

    const discoveredHosts = await Promise.all(normalized.map((host) => this.hostProbe.probe(host)));

    this.latestSnapshot = {
      createdAt: new Date().toISOString(),
      hosts: discoveredHosts.sort((a, b) => a.machine.host.localeCompare(b.machine.host))
    };

    if (this.store) {
      await this.store.save(this.latestSnapshot);
    }

    return this.latestSnapshot;
  }
}
