"use client";

import { useEffect, useState } from "react";
import {
  Activity,
  AlertCircle,
  Bot,
  CheckCircle,
  Database,
  FileText,
  Globe,
  Key,
  Loader2,
  Package,
  RefreshCw,
  XCircle,
} from "lucide-react";

interface GatewayInfo {
  url: string;
  connected: boolean;
  tokenConfigured: boolean;
  lastPing: string | null;
}

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

interface DashboardData {
  gateway: GatewayInfo;
  memoryFiles: MemoryFile[];
  agents: Agent[];
  modules: Module[];
  keyFiles: string[];
  error?: string;
}

function StatusBadge({ status }: { status: string }) {
  const colors: Record<string, string> = {
    active: "bg-green-500/20 text-green-400 border-green-500/30",
    idle: "bg-yellow-500/20 text-yellow-400 border-yellow-500/30",
    error: "bg-red-500/20 text-red-400 border-red-500/30",
    loaded: "bg-green-500/20 text-green-400 border-green-500/30",
    unloaded: "bg-gray-500/20 text-gray-400 border-gray-500/30",
  };
  return (
    <span
      className={`px-2 py-0.5 rounded-full text-xs border ${colors[status] || colors.idle}`}
    >
      {status}
    </span>
  );
}

function Card({
  title,
  icon: Icon,
  children,
  count,
}: {
  title: string;
  icon: React.ComponentType<{ className?: string }>;
  children: React.ReactNode;
  count?: number;
}) {
  return (
    <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Icon className="w-5 h-5 text-blue-400" />
          <h2 className="text-lg font-semibold text-gray-100">{title}</h2>
        </div>
        {count !== undefined && (
          <span className="bg-blue-500/20 text-blue-400 px-2 py-0.5 rounded-full text-xs">
            {count}
          </span>
        )}
      </div>
      {children}
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
        memoryFiles: [],
        agents: [],
        modules: [],
        keyFiles: [],
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
            <p className="text-red-400 font-medium">Configuration Issue</p>
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
      </div>

      {/* Main Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Active Agents */}
        <Card title="Active Agents" icon={Bot} count={data?.agents.length}>
          {data?.agents.length === 0 ? (
            <p className="text-gray-500 text-sm">
              No agents found. Configure your gateway to see active agents.
            </p>
          ) : (
            <div className="space-y-3">
              {data?.agents.map((agent) => (
                <div
                  key={agent.id}
                  className="flex items-center justify-between bg-gray-800/50 rounded-lg p-3"
                >
                  <div>
                    <p className="text-sm font-medium text-gray-200">
                      {agent.name}
                    </p>
                    <p className="text-xs text-gray-500">
                      Module: {agent.module}
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-xs text-gray-500">
                      {new Date(agent.lastActivity).toLocaleTimeString()}
                    </span>
                    <StatusBadge status={agent.status} />
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>

        {/* Modules */}
        <Card title="Modules" icon={Package} count={data?.modules.length}>
          {data?.modules.length === 0 ? (
            <p className="text-gray-500 text-sm">
              No modules loaded. Connect to the gateway to view modules.
            </p>
          ) : (
            <div className="space-y-3">
              {data?.modules.map((mod) => (
                <div
                  key={mod.name}
                  className="flex items-center justify-between bg-gray-800/50 rounded-lg p-3"
                >
                  <div>
                    <p className="text-sm font-medium text-gray-200">
                      {mod.name}
                    </p>
                    <p className="text-xs text-gray-500">v{mod.version}</p>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-xs text-gray-500">
                      {mod.agentCount} agent{mod.agentCount !== 1 ? "s" : ""}
                    </span>
                    <StatusBadge status={mod.status} />
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>

        {/* Memory Files */}
        <Card
          title="Memory Files"
          icon={Database}
          count={data?.memoryFiles.length}
        >
          {data?.memoryFiles.length === 0 ? (
            <p className="text-gray-500 text-sm">
              No memory files found. Connect to the gateway to browse agent
              memory.
            </p>
          ) : (
            <div className="space-y-2 max-h-80 overflow-y-auto">
              {data?.memoryFiles.map((file) => (
                <div
                  key={file.path}
                  className="flex items-center justify-between bg-gray-800/50 rounded-lg p-3"
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <FileText className="w-4 h-4 text-gray-400 shrink-0" />
                    <div className="min-w-0">
                      <p className="text-sm text-gray-200 truncate">
                        {file.name}
                      </p>
                      <p className="text-xs text-gray-500 truncate">
                        {file.path}
                      </p>
                    </div>
                  </div>
                  <span className="text-xs text-gray-500 shrink-0 ml-2">
                    {(file.size / 1024).toFixed(1)}KB
                  </span>
                </div>
              ))}
            </div>
          )}
        </Card>

        {/* Key Files */}
        <Card
          title="Key Active Files"
          icon={Activity}
          count={data?.keyFiles.length}
        >
          {data?.keyFiles.length === 0 ? (
            <p className="text-gray-500 text-sm">
              No key files tracked. The gateway will report actively used files
              here.
            </p>
          ) : (
            <div className="space-y-2 max-h-80 overflow-y-auto">
              {data?.keyFiles.map((file) => (
                <div
                  key={file}
                  className="flex items-center gap-2 bg-gray-800/50 rounded-lg p-3"
                >
                  <FileText className="w-4 h-4 text-blue-400 shrink-0" />
                  <p className="text-sm text-gray-200 font-mono truncate">
                    {file}
                  </p>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>

      {/* Footer */}
      <div className="mt-8 text-center text-xs text-gray-600">
        OpenCLAW Mission Control &middot; Set{" "}
        <code className="text-gray-500">OPENCLAW_GATEWAY_URL</code> and{" "}
        <code className="text-gray-500">OPENCLAW_GATEWAY_TOKEN</code> in Vercel
        env to connect
      </div>
    </div>
  );
}
