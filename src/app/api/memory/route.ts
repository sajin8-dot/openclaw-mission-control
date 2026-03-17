import { NextResponse } from "next/server";

interface MemoryFile {
  name: string;
  path: string;
  size: number;
  lastModified: string;
  type: "file" | "directory";
}

interface Agent {
  id: string;
  name: string;
  status: "active" | "idle" | "error";
  lastActivity: string;
  module: string;
}

interface Module {
  name: string;
  version: string;
  status: "loaded" | "unloaded" | "error";
  agentCount: number;
}

interface GatewayInfo {
  url: string;
  connected: boolean;
  tokenConfigured: boolean;
  lastPing: string | null;
}

export interface MemoryDashboardData {
  gateway: GatewayInfo;
  memoryFiles: MemoryFile[];
  agents: Agent[];
  modules: Module[];
  keyFiles: string[];
}

async function fetchFromGateway(
  gatewayUrl: string,
  token: string,
  endpoint: string
) {
  const res = await fetch(`${gatewayUrl}${endpoint}`, {
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    cache: "no-store",
  });
  if (!res.ok) {
    throw new Error(`Gateway returned ${res.status}: ${res.statusText}`);
  }
  return res.json();
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

  // If gateway is not configured, return empty state with config status
  if (!gatewayUrl || !gatewayToken) {
    return NextResponse.json({
      gateway: gatewayInfo,
      memoryFiles: [],
      agents: [],
      modules: [],
      keyFiles: [],
      error: "Gateway not configured. Set OPENCLAW_GATEWAY_URL and OPENCLAW_GATEWAY_TOKEN in your Vercel environment variables.",
    });
  }

  try {
    // Attempt to fetch data from the OpenCLAW gateway
    const [memoryFiles, agents, modules, keyFiles] = await Promise.allSettled([
      fetchFromGateway(gatewayUrl, gatewayToken, "/api/memory/files"),
      fetchFromGateway(gatewayUrl, gatewayToken, "/api/agents"),
      fetchFromGateway(gatewayUrl, gatewayToken, "/api/modules"),
      fetchFromGateway(gatewayUrl, gatewayToken, "/api/memory/key-files"),
    ]);

    gatewayInfo.connected = true;
    gatewayInfo.lastPing = new Date().toISOString();

    return NextResponse.json({
      gateway: gatewayInfo,
      memoryFiles:
        memoryFiles.status === "fulfilled" ? memoryFiles.value : [],
      agents: agents.status === "fulfilled" ? agents.value : [],
      modules: modules.status === "fulfilled" ? modules.value : [],
      keyFiles: keyFiles.status === "fulfilled" ? keyFiles.value : [],
    } satisfies MemoryDashboardData);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unknown gateway error";
    return NextResponse.json(
      {
        gateway: gatewayInfo,
        memoryFiles: [],
        agents: [],
        modules: [],
        keyFiles: [],
        error: `Failed to connect to gateway: ${message}`,
      },
      { status: 502 }
    );
  }
}
