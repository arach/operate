import type {
  HostInventory,
  InventorySnapshot,
  RouteCandidate,
  RoutePlanRequest,
  RoutePlanResult,
  RuntimeName
} from "./types";

const RUNTIME_ORDER: RuntimeName[] = ["hermes", "opencode", "claude"];

function isRuntimeAvailable(host: HostInventory, runtime: RuntimeName): boolean {
  return host.runtimes.some((candidate) => candidate.name === runtime && candidate.status === "available");
}

function availableRuntimes(host: HostInventory): RuntimeName[] {
  return RUNTIME_ORDER.filter((runtime) => isRuntimeAvailable(host, runtime));
}

function scoreCandidate(host: HostInventory, runtime: RuntimeName, request: RoutePlanRequest): RouteCandidate {
  let score = 0;
  const reasons: string[] = [];

  if (request.preferredHost && request.preferredHost === host.machine.host) {
    score += 100;
    reasons.push("preferred host match");
  }

  if (request.requiredRuntime && runtime === request.requiredRuntime) {
    score += 100;
    reasons.push("required runtime match");
  }

  if (request.preferredRuntime && runtime === request.preferredRuntime) {
    score += 80;
    reasons.push("preferred runtime match");
  }

  if (runtime === "hermes") {
    score += 20;
    reasons.push("default runtime preference");
  }

  if (host.errors.length === 0) {
    score += 10;
    reasons.push("healthy host probe");
  }

  return {
    host: host.machine.host,
    runtime,
    score,
    reasons
  };
}

export class RoutePlannerService {
  plan(snapshot: InventorySnapshot, request: RoutePlanRequest): RoutePlanResult {
    const candidates: RouteCandidate[] = [];

    for (const host of snapshot.hosts) {
      if (request.requiredRuntime) {
        if (isRuntimeAvailable(host, request.requiredRuntime)) {
          candidates.push(scoreCandidate(host, request.requiredRuntime, request));
        }
        continue;
      }

      const runtimes = availableRuntimes(host);
      for (const runtime of runtimes) {
        candidates.push(scoreCandidate(host, runtime, request));
      }
    }

    candidates.sort((a, b) => {
      if (b.score !== a.score) {
        return b.score - a.score;
      }
      if (a.host !== b.host) {
        return a.host.localeCompare(b.host);
      }
      return a.runtime.localeCompare(b.runtime);
    });

    if (candidates.length === 0) {
      return {
        selected: null,
        candidates: [],
        reason: "No hosts satisfy requested runtime constraints",
        plannedAt: new Date().toISOString()
      };
    }

    return {
      selected: candidates[0] ?? null,
      candidates,
      plannedAt: new Date().toISOString()
    };
  }
}
