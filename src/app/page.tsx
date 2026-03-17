"use client";

import { useEffect, useState } from "react";
import {
  AlertCircle,
  BookOpen,
  CheckCircle,
  ChevronDown,
  ChevronRight,
  Database,
  FileText,
  Globe,
  Key,
  Loader2,
  MessageSquare,
  RefreshCw,
  Search,
  Terminal,
  XCircle,
} from "lucide-react";

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

interface SystemInfo {
  version?: string;
  uptime?: number;
  pid?: number;
  [key: string]: unknown;
}

interface DashboardData {
  gateway: GatewayInfo;
  systemInfo: SystemInfo | null;
  workspaceFiles: WorkspaceFile[];
  sessions: SessionInfo[];
  memorySearchResults: MemorySearchResult[];
  toolResults: ToolInvokeResult[];
  error?: string;
}

function Card({
  title,
  icon: Icon,
  children,
  count,
  defaultOpen = true,
}: {
  title: string;
  icon: React.ComponentType<{ className?: string }>;
  children: React.ReactNode;
  count?: number;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center justify-between w-full text-left"
      >
        <div className="flex items-center gap-2">
          <Icon className="w-5 h-5 text-blue-400" />
          <h2 className="text-lg font-semibold text-gray-100">{title}</h2>
          {count !== undefined && (
            <span className="bg-blue-500/20 text-blue-400 px-2 py-0.5 rounded-full text-xs">
              {count}
            </span>
          )}
        </div>
        {open ? (
          <ChevronDown className="w-4 h-4 text-gray-500" />
        ) : (
          <ChevronRight className="w-4 h-4 text-gray-500" />
        )}
      </button>
      {open && <div className="mt-4">{children}</div>}
    </div>
  );
}

function WorkspaceFileCard({ file }: { file: WorkspaceFile }) {
  const [expanded, setExpanded] = useState(false);
  const icon = file.exists ? (
    <CheckCircle className="w-4 h-4 text-green-400" />
  ) : (
    <XCircle className="w-4 h-4 text-gray-600" />
  );

  return (
    <div className="bg-gray-800/50 rounded-lg">
      <button
        onClick={() => file.exists && setExpanded(!expanded)}
        className={`flex items-center gap-3 w-full text-left p-3 ${file.exists ? "cursor-pointer hover:bg-gray-800/80" : "cursor-default opacity-50"}`}
      >
        {icon}
        <span className="text-sm font-mono text-gray-200">{file.name}</span>
        {file.exists && (
          <span className="text-xs text-gray-500 ml-auto">
            {file.content.split("\n").length} lines
          </span>
        )}
      </button>
      {expanded && file.exists && (
        <pre className="px-3 pb-3 text-xs text-gray-400 overflow-auto max-h-64 font-mono whitespace-pre-wrap border-t border-gray-700/50 pt-3 mx-3">
          {file.content}
        </pre>
      )}
    </div>
  );
}

export default function MissionControl() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  async function fetchData() {
    try {
      const res = await fetch("/api/memory");
      const json = await res.json();
      setData(json);
    } catch {
      setData({
        gateway: {
          url: "Unknown",
          connected: false,
          tokenConfigured: false,
          lastPing: null,
        },
        systemInfo: null,
        workspaceFiles: [],
        sessions: [],
        memorySearchResults: [],
        toolResults: [],
        error: "Failed to reach the API. Check your deployment.",
      });
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  useEffect(() => {
    fetchData();
  }, []);

  function handleRefresh() {
    setRefreshing(true);
    fetchData();
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-blue-400" />
      </div>
    );
  }

  const existingFiles = data?.workspaceFiles.filter((f) => f.exists) || [];
  const missingFiles = data?.workspaceFiles.filter((f) => !f.exists) || [];

  return (
    <div className="min-h-screen p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold text-gray-100">
            OpenCLAW Mission Control
          </h1>
          <p className="text-gray-400 mt-1">Agent Memory Dashboard</p>
        </div>
        <button
          onClick={handleRefresh}
          disabled={refreshing}
          className="flex items-center gap-2 bg-gray-800 hover:bg-gray-700 text-gray-200 px-4 py-2 rounded-lg border border-gray-700 transition-colors disabled:opacity-50"
        >
          <RefreshCw
            className={`w-4 h-4 ${refreshing ? "animate-spin" : ""}`}
          />
          Refresh
        </button>
      </div>

      {/* Error Banner */}
      {data?.error && (
        <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-4 mb-6 flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-red-400 mt-0.5 shrink-0" />
          <div>
            <p className="text-red-400 font-medium">Issue Detected</p>
            <p className="text-red-300/80 text-sm mt-1">{data.error}</p>
          </div>
        </div>
      )}

      {/* Gateway Status */}
      <div className="bg-gray-900 border border-gray-800 rounded-xl p-5 mb-6">
        <div className="flex items-center gap-2 mb-4">
          <Globe className="w-5 h-5 text-blue-400" />
          <h2 className="text-lg font-semibold text-gray-100">
            Gateway Status
          </h2>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div>
            <p className="text-xs text-gray-500 uppercase tracking-wide mb-1">
              Gateway URL
            </p>
            <p className="text-sm text-gray-300 font-mono truncate">
              {data?.gateway.url || "Not set"}
            </p>
          </div>
          <div>
            <p className="text-xs text-gray-500 uppercase tracking-wide mb-1">
              Connection
            </p>
            <div className="flex items-center gap-1.5">
              {data?.gateway.connected ? (
                <CheckCircle className="w-4 h-4 text-green-400" />
              ) : (
                <XCircle className="w-4 h-4 text-red-400" />
              )}
              <span
                className={`text-sm ${data?.gateway.connected ? "text-green-400" : "text-red-400"}`}
              >
                {data?.gateway.connected ? "Connected" : "Disconnected"}
              </span>
            </div>
          </div>
          <div>
            <p className="text-xs text-gray-500 uppercase tracking-wide mb-1">
              Token
            </p>
            <div className="flex items-center gap-1.5">
              <Key className="w-4 h-4 text-gray-400" />
              <span
                className={`text-sm ${data?.gateway.tokenConfigured ? "text-green-400" : "text-yellow-400"}`}
              >
                {data?.gateway.tokenConfigured
                  ? "Configured"
                  : "Not configured"}
              </span>
            </div>
          </div>
          <div>
            <p className="text-xs text-gray-500 uppercase tracking-wide mb-1">
              Last Ping
            </p>
            <p className="text-sm text-gray-300">
              {data?.gateway.lastPing
                ? new Date(data.gateway.lastPing).toLocaleString()
                : "Never"}
            </p>
          </div>
        </div>
        {data?.systemInfo && (
          <div className="mt-4 pt-4 border-t border-gray-800 grid grid-cols-2 md:grid-cols-4 gap-4">
            {data.systemInfo.version && (
              <div>
                <p className="text-xs text-gray-500 uppercase tracking-wide mb-1">
                  Version
                </p>
                <p className="text-sm text-gray-300 font-mono">
                  {data.systemInfo.version}
                </p>
              </div>
            )}
            {data.systemInfo.uptime != null && (
              <div>
                <p className="text-xs text-gray-500 uppercase tracking-wide mb-1">
                  Uptime
                </p>
                <p className="text-sm text-gray-300">
                  {Math.floor(Number(data.systemInfo.uptime) / 3600)}h{" "}
                  {Math.floor((Number(data.systemInfo.uptime) % 3600) / 60)}m
                </p>
              </div>
            )}
            {data.systemInfo.pid != null && (
              <div>
                <p className="text-xs text-gray-500 uppercase tracking-wide mb-1">
                  PID
                </p>
                <p className="text-sm text-gray-300 font-mono">
                  {data.systemInfo.pid}
                </p>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Main Content */}
      <div className="space-y-6">
        {/* Workspace Files */}
        <Card
          title="Workspace Files"
          icon={BookOpen}
          count={existingFiles.length}
        >
          <p className="text-xs text-gray-500 mb-3">
            Agent workspace at <code>~/.openclaw/workspace/</code> — fetched
            via <code>POST /tools/invoke</code> → <code>memory_get</code>
          </p>
          <div className="space-y-2">
            {existingFiles.map((file) => (
              <WorkspaceFileCard key={file.name} file={file} />
            ))}
            {missingFiles.length > 0 && (
              <div className="pt-2 border-t border-gray-800">
                <p className="text-xs text-gray-600 mb-2">
                  Not found ({missingFiles.length}):
                </p>
                <div className="flex flex-wrap gap-2">
                  {missingFiles.map((file) => (
                    <span
                      key={file.name}
                      className="text-xs text-gray-600 font-mono bg-gray-800/30 px-2 py-1 rounded"
                    >
                      {file.name}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        </Card>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Sessions */}
          <Card
            title="Active Sessions"
            icon={MessageSquare}
            count={data?.sessions.length}
          >
            <p className="text-xs text-gray-500 mb-3">
              Via <code>sessions_list</code>
            </p>
            {data?.sessions.length === 0 ? (
              <p className="text-gray-500 text-sm">
                No sessions returned. The agent may not have active sessions, or
                the tool may require different permissions.
              </p>
            ) : (
              <div className="space-y-2 max-h-80 overflow-y-auto">
                {data?.sessions.map((session, i) => (
                  <div
                    key={session.sessionKey || i}
                    className="bg-gray-800/50 rounded-lg p-3"
                  >
                    <div className="flex items-center justify-between">
                      <p className="text-sm font-mono text-gray-200">
                        {session.label ||
                          session.sessionKey ||
                          session.agentId ||
                          `Session ${i + 1}`}
                      </p>
                      {session.status && (
                        <span
                          className={`px-2 py-0.5 rounded-full text-xs border ${
                            session.status === "active"
                              ? "bg-green-500/20 text-green-400 border-green-500/30"
                              : "bg-gray-500/20 text-gray-400 border-gray-500/30"
                          }`}
                        >
                          {session.status}
                        </span>
                      )}
                    </div>
                    {session.agentId && (
                      <p className="text-xs text-gray-500 mt-1">
                        Agent: {session.agentId}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            )}
          </Card>

          {/* Memory Search Results */}
          <Card
            title="Memory Search"
            icon={Search}
            count={data?.memorySearchResults.length}
          >
            <p className="text-xs text-gray-500 mb-3">
              Via <code>memory_search</code> — recent activity
            </p>
            {data?.memorySearchResults.length === 0 ? (
              <p className="text-gray-500 text-sm">
                No memory search results. Memory indexing may be disabled or not
                yet populated.
              </p>
            ) : (
              <div className="space-y-2 max-h-80 overflow-y-auto">
                {data?.memorySearchResults.map((result, i) => (
                  <div key={i} className="bg-gray-800/50 rounded-lg p-3">
                    <div className="flex items-center justify-between mb-1">
                      <p className="text-xs font-mono text-blue-400">
                        {result.path}
                        {result.startLine
                          ? `:${result.startLine}-${result.endLine}`
                          : ""}
                      </p>
                      {result.score && (
                        <span className="text-xs text-gray-500">
                          score: {result.score.toFixed(2)}
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-gray-400 whitespace-pre-wrap line-clamp-3">
                      {result.snippet}
                    </p>
                    {result.source && (
                      <span className="text-xs text-gray-600 mt-1 inline-block">
                        source: {result.source}
                      </span>
                    )}
                  </div>
                ))}
              </div>
            )}
          </Card>
        </div>

        {/* Tool Invocation Results (debug) */}
        <Card
          title="Tool Invocation Results"
          icon={Terminal}
          count={data?.toolResults.length}
          defaultOpen={false}
        >
          <p className="text-xs text-gray-500 mb-3">
            Raw results from each <code>POST /tools/invoke</code> call to the
            gateway
          </p>
          <div className="space-y-2 max-h-96 overflow-y-auto">
            {data?.toolResults.map((result, i) => (
              <div
                key={i}
                className={`rounded-lg p-3 font-mono text-xs ${
                  result.ok
                    ? "bg-green-500/10 border border-green-500/20"
                    : "bg-red-500/10 border border-red-500/20"
                }`}
              >
                <div className="flex items-center justify-between mb-2">
                  <span
                    className={
                      result.ok ? "text-green-400" : "text-red-400"
                    }
                  >
                    {result.ok ? "OK" : "FAIL"} — {result.tool}
                  </span>
                </div>
                {result.error && (
                  <p className="text-red-300 text-xs mb-1">{result.error}</p>
                )}
                {result.ok && result.data != null && (
                  <pre className="text-gray-400 overflow-auto max-h-32 whitespace-pre-wrap">
                    {typeof result.data === "string"
                      ? result.data.substring(0, 500)
                      : JSON.stringify(result.data, null, 2).substring(0, 500)}
                    {(typeof result.data === "string"
                      ? result.data.length
                      : JSON.stringify(result.data).length) > 500
                      ? "\n..."
                      : ""}
                  </pre>
                )}
              </div>
            ))}
          </div>
        </Card>
      </div>

      {/* Footer */}
      <div className="mt-8 text-center text-xs text-gray-600">
        OpenCLAW Mission Control &middot; Using{" "}
        <code className="text-gray-500">POST /tools/invoke</code> via OpenClaw
        Gateway
      </div>
    </div>
  );
}
