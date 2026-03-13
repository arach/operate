export type RuntimeName = "hermes" | "opencode" | "claude";

export interface RuntimeCapability {
  name: RuntimeName;
  binaryPath: string;
  version: string;
  status: "available" | "unavailable";
}

export interface MachineIdentity {
  host: string;
  hostname: string;
  os: string;
  arch: string;
}

export interface HostInventory {
  machine: MachineIdentity;
  runtimes: RuntimeCapability[];
  probedAt: string;
  errors: string[];
}

export interface InventorySnapshot {
  createdAt: string;
  hosts: HostInventory[];
}

export interface DiscoverRequest {
  hosts: string[];
}

export interface SSHResult {
  stdout: string;
  stderr: string;
  exitCode: number;
}

export interface SSHExecutor {
  run(host: string, remoteCommand: string, timeoutMs?: number): Promise<SSHResult>;
}

export interface InventoryStore {
  load(): Promise<InventorySnapshot | null>;
  save(snapshot: InventorySnapshot): Promise<void>;
}

export interface RuntimeExecuteRequest {
  host: string;
  args: string[];
  timeoutMs?: number;
}

export interface RuntimeExecuteResult {
  runtime: RuntimeName;
  host: string;
  command: string;
  stdout: string;
  stderr: string;
  exitCode: number;
  executedAt: string;
}

export interface RuntimeAdapter {
  readonly runtime: RuntimeName;
  execute(ssh: SSHExecutor, request: RuntimeExecuteRequest): Promise<RuntimeExecuteResult>;
  listTools(ssh: SSHExecutor, host: string, timeoutMs?: number): Promise<RuntimeExecuteResult>;
}

export interface RuntimeActionRequest {
  host: string;
  timeoutMs?: number;
  args?: string[];
}
