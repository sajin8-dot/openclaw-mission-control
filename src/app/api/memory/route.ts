import { NextResponse } from "next/server";

interface GatewayInfo {
  url: string;
  connected: boolean;
  tokenConfigured: boolean;
  lastPing: string | null;
}

interface ToolInvokeResult {
  ok: boolean;
  tool: string;
  data: unknown;
  error?: string;
}

interface WorkspaceFile {
  name: string;
  content: string;
  exists: boolean;
}

interface SessionInfo {
  sessionKey?: string;
  agentId?: string;
  label?: string;
  status?: string;
  [key: string]: unknown;
}

interface MemorySearchResult {
  path: string;
  startLine: number;
  endLine: number;
  score: number;
  snippet: string;
  source: "memory" | "sessions";
}

export interface MemoryDashboardData {
  gateway: GatewayInfo;
  workspaceFiles: WorkspaceFile[];
  sessions: SessionInfo[];
  memorySearchResults: MemorySearchResult[];
  toolResults: ToolInvokeResult[];
  error?: string;
}

async function invokeToolRaw(
  gatewayUrl: string,
  token: string,
  tool: string,
  args: Record<string, unknown>,
  action?: string
): Promise<ToolInvokeResult> {
  try {
    const body: Record<string, unknown> = { tool, args };
    if (action) body.action = action;

    const res = await fetch(`${gatewayUrl}/tools/invoke`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
      cache: "no-store",
    });

    const text = await res.text();
    let data: unknown;
    try {
      data = JSON.parse(text);
    } catch {
      data = text;
    }

    if (!res.ok) {
      return {
        ok: false,
        tool,
        data: null,
        error: `${res.status} ${res.statusText}: ${typeof data === "string" ? data : JSON.stringify(data)}`,
      };
    }

    return { ok: true, tool, data };
  } catch (err) {
    return {
      ok: false,
      tool,
      data: null,
      error: err instanceof Error ? err.message : "Network error",
    };
  }
}

// Standard OpenClaw workspace files
const WORKSPACE_FILES = [
  "AGENTS.md",
  "SOUL.md",
  "USER.md",
  "TOOLS.md",
  "MEMORY.md",
  "HEARTBEAT.md",
  "IDENTITY.md",
  "BOOTSTRAP.md",
];

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
      workspaceFiles: [],
      sessions: [],
      memorySearchResults: [],
      toolResults: [],
      error:
        "Gateway not configured. Set OPENCLAW_GATEWAY_URL and OPENCLAW_GATEWAY_TOKEN in your Vercel environment variables.",
    } satisfies MemoryDashboardData);
  }

  // Fetch workspace files via memory_get, sessions via sessions_list,
  // and recent memory via memory_search — all in parallel
  const filePromises = WORKSPACE_FILES.map((filename) =>
    invokeToolRaw(gatewayUrl, gatewayToken, "memory_get", { path: filename })
  );

  const [sessionsResult, memorySearchResult, ...fileResults] =
    await Promise.all([
      invokeToolRaw(gatewayUrl, gatewayToken, "sessions_list", {}, "json"),
      invokeToolRaw(gatewayUrl, gatewayToken, "memory_search", {
        query: "important recent activity",
      }),
      ...filePromises,
    ]);

  const allResults = [sessionsResult, memorySearchResult, ...fileResults];
  const anyReachable = allResults.some(
    (r) => r.ok || (r.error && !r.error.includes("Network error") && !r.error.includes("fetch failed"))
  );

  gatewayInfo.connected = anyReachable;
  gatewayInfo.lastPing = anyReachable ? new Date().toISOString() : null;

  // Parse workspace files
  const workspaceFiles: WorkspaceFile[] = fileResults.map((result, i) => {
    const filename = WORKSPACE_FILES[i];
    if (!result.ok) {
      return { name: filename, content: "", exists: false };
    }
    const data = result.data as Record<string, unknown> | string;
    let content = "";
    if (typeof data === "string") {
      content = data;
    } else if (data && typeof data === "object") {
      content = String((data as Record<string, unknown>).text || (data as Record<string, unknown>).content || "");
    }
    return {
      name: filename,
      content,
      exists: content.length > 0,
    };
  });

  // Parse sessions
  let sessions: SessionInfo[] = [];
  if (sessionsResult.ok && sessionsResult.data) {
    const sData = sessionsResult.data;
    if (Array.isArray(sData)) {
      sessions = sData;
    } else if (typeof sData === "object" && sData !== null) {
      const obj = sData as Record<string, unknown>;
      if (Array.isArray(obj.sessions)) sessions = obj.sessions;
      else if (Array.isArray(obj.items)) sessions = obj.items;
      else if (Array.isArray(obj.data)) sessions = obj.data;
    }
  }

  // Parse memory search results
  let memorySearchResults: MemorySearchResult[] = [];
  if (memorySearchResult.ok && memorySearchResult.data) {
    const mData = memorySearchResult.data;
    if (Array.isArray(mData)) {
      memorySearchResults = mData;
    } else if (typeof mData === "object" && mData !== null) {
      const obj = mData as Record<string, unknown>;
      if (Array.isArray(obj.results)) memorySearchResults = obj.results;
      else if (Array.isArray(obj.items)) memorySearchResults = obj.items;
      // Handle disabled memory search
      if (obj.disabled) {
        memorySearchResults = [];
      }
    }
  }

  const hasAnyData =
    workspaceFiles.some((f) => f.exists) ||
    sessions.length > 0 ||
    memorySearchResults.length > 0;

  return NextResponse.json({
    gateway: gatewayInfo,
    workspaceFiles,
    sessions,
    memorySearchResults,
    toolResults: allResults,
    ...(!anyReachable
      ? {
          error:
            "Cannot reach gateway. Verify OPENCLAW_GATEWAY_URL is correct and the gateway is running.",
        }
      : !hasAnyData
        ? {
            error:
              "Gateway reachable but no data returned. Check tool results below for details. Ensure the gateway has memory and sessions configured.",
          }
        : {}),
  } satisfies MemoryDashboardData);
}
