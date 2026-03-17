import { NextResponse } from "next/server";

interface GatewayInfo {
  url: string;
  connected: boolean;
  tokenConfigured: boolean;
  lastPing: string | null;
}

export interface MemoryDashboardData {
  gateway: GatewayInfo;
  memoryFiles: Record<string, unknown>[];
  agents: Record<string, unknown>[];
  modules: Record<string, unknown>[];
  keyFiles: string[];
  endpoints: EndpointStatus[];
  rawDiscovery?: Record<string, unknown>;
}

interface EndpointStatus {
  path: string;
  status: number | null;
  ok: boolean;
  error?: string;
}

async function probeEndpoint(
  gatewayUrl: string,
  token: string,
  path: string
): Promise<{ status: EndpointStatus; data: unknown }> {
  try {
    const res = await fetch(`${gatewayUrl}${path}`, {
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      cache: "no-store",
    });
    const text = await res.text();
    let data: unknown = null;
    try {
      data = JSON.parse(text);
    } catch {
      data = text;
    }
    return {
      status: {
        path,
        status: res.status,
        ok: res.ok,
        error: res.ok ? undefined : `${res.status} ${res.statusText}`,
      },
      data: res.ok ? data : null,
    };
  } catch (err) {
    return {
      status: {
        path,
        status: null,
        ok: false,
        error: err instanceof Error ? err.message : "Network error",
      },
      data: null,
    };
  }
}

export async function GET() {
  const gatewayUrl = process.env.OPENCLAW_GATEWAY_URL;
  const gatewayToken = process.env.OPENCLAW_GATEWAY_TOKEN;

  const gatewayInfo: GatewayInfo = {
    url: gatewayUrl || "Not configured",
    connected: false,
    tokenConfigured: !!gatewayToken,
    lastPing: null,
  };

  if (!gatewayUrl || !gatewayToken) {
    return NextResponse.json({
      gateway: gatewayInfo,
      memoryFiles: [],
      agents: [],
      modules: [],
      keyFiles: [],
      endpoints: [],
      error:
        "Gateway not configured. Set OPENCLAW_GATEWAY_URL and OPENCLAW_GATEWAY_TOKEN in your Vercel environment variables.",
    });
  }

  // Probe a wide set of likely endpoints to discover the actual API
  const candidatePaths = [
    // Root / discovery
    "/",
    "/api",
    "/api/v1",
    "/health",
    "/status",
    // Memory endpoints
    "/api/memory",
    "/api/memory/files",
    "/api/memory/key-files",
    "/api/v1/memory",
    "/api/v1/memory/files",
    "/memory",
    "/memory/files",
    "/files",
    // Agent endpoints
    "/api/agents",
    "/api/v1/agents",
    "/agents",
    // Module endpoints
    "/api/modules",
    "/api/v1/modules",
    "/modules",
  ];

  const results = await Promise.all(
    candidatePaths.map((path) => probeEndpoint(gatewayUrl, gatewayToken, path))
  );

  const endpoints = results.map((r) => r.status);
  const anyReachable = results.some(
    (r) => r.status.status !== null
  );
  const successfulEndpoints = results.filter((r) => r.status.ok);

  gatewayInfo.connected = anyReachable;
  gatewayInfo.lastPing = anyReachable ? new Date().toISOString() : null;

  // Collect raw discovery data from successful endpoints
  const rawDiscovery: Record<string, unknown> = {};
  for (const r of successfulEndpoints) {
    rawDiscovery[r.status.path] = r.data;
  }

  // Try to extract data from whatever endpoints responded
  let memoryFiles: Record<string, unknown>[] = [];
  let agents: Record<string, unknown>[] = [];
  let modules: Record<string, unknown>[] = [];
  let keyFiles: string[] = [];

  for (const r of successfulEndpoints) {
    const data = r.data;
    const path = r.status.path;

    if (!data) continue;

    // If the response is an array, categorize by endpoint path
    if (Array.isArray(data)) {
      if (path.includes("agent")) agents = data;
      else if (path.includes("module")) modules = data;
      else if (path.includes("key")) keyFiles = data;
      else if (path.includes("memory") || path.includes("file"))
        memoryFiles = data;
    }

    // If the response is an object, look for known keys
    if (typeof data === "object" && !Array.isArray(data)) {
      const obj = data as Record<string, unknown>;
      if (Array.isArray(obj.files)) memoryFiles = obj.files;
      if (Array.isArray(obj.memoryFiles)) memoryFiles = obj.memoryFiles;
      if (Array.isArray(obj.memory_files)) memoryFiles = obj.memory_files;
      if (Array.isArray(obj.agents)) agents = obj.agents;
      if (Array.isArray(obj.modules)) modules = obj.modules;
      if (Array.isArray(obj.keyFiles)) keyFiles = obj.keyFiles;
      if (Array.isArray(obj.key_files)) keyFiles = obj.key_files;
    }
  }

  const hasData =
    memoryFiles.length > 0 ||
    agents.length > 0 ||
    modules.length > 0 ||
    keyFiles.length > 0;

  return NextResponse.json({
    gateway: gatewayInfo,
    memoryFiles,
    agents,
    modules,
    keyFiles,
    endpoints,
    rawDiscovery,
    ...(successfulEndpoints.length === 0
      ? {
          error: `Gateway reachable but all ${candidatePaths.length} API endpoints returned errors. Check the gateway API documentation for correct paths.`,
        }
      : !hasData
        ? {
            error: `Gateway responded on ${successfulEndpoints.length} endpoint(s) but returned no memory data. Check the raw discovery data below for the actual API structure.`,
          }
        : {}),
  });
}
