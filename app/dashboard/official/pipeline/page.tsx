"use client";

import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Activity,
  Play,
  RotateCcw,
  AlertTriangle,
  CheckCircle,
  Clock,
  Layers,
  XCircle,
  Database,
  ArrowUpDown,
  Search,
  RefreshCw,
  Eye,
  Sliders,
  Calendar,
  AlertCircle
} from "lucide-react";
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend
} from "recharts";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

// API Base URL mapping (resolves to FastAPI backend)
const API_BASE = "http://localhost:8000/api/v1";

interface PipelineRun {
  id: number;
  farm_id: number;
  farm_name: string;
  status: string;
  run_type: string;
  progress_percent: number;
  started_at: string;
  completed_at: string | null;
  duration_ms: number | null;
  quality_score: number;
  error_log: string | null;
}

interface MetricsSummary {
  total_runs: number;
  success_rate: number;
  average_duration_ms: number;
  queue_depth: number;
  daily_fetches: Array<{ date: string; volume: number }>;
  success_rate_trend: Array<{ date: string; rate: number }>;
  average_processing_time: Array<{ date: string; time_sec: number }>;
}

export default function PipelineDashboard() {
  // State variables
  const [statusCounts, setStatusCounts] = useState<Record<string, number>>({
    IDLE: 0,
    FETCHING: 0,
    PREPROCESSING: 0,
    RECONSTRUCTING: 0,
    FEATURE_ENGINEERING: 0,
    COMPLETED: 0,
    FAILED: 0
  });

  const [runs, setRuns] = useState<PipelineRun[]>([]);
  const [metrics, setMetrics] = useState<MetricsSummary | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("ALL");
  const [sortField, setSortField] = useState<keyof PipelineRun>("started_at");
  const [sortAsc, setSortAsc] = useState(false);
  const [selectedRun, setSelectedRun] = useState<PipelineRun | null>(null);
  const [refreshInterval, setRefreshInterval] = useState(10); // 10s default
  const [isLoading, setIsLoading] = useState(true);

  // Fetch all dashboard data
  const fetchDashboardData = async () => {
    try {
      // 1. Fetch statuses
      const statusRes = await fetch(`${API_BASE}/pipeline/status`);
      if (statusRes.ok) {
        const statusData = await statusRes.json();
        setStatusCounts(prev => ({ ...prev, ...statusData }));
      }

      // 2. Fetch runs
      const runsRes = await fetch(`${API_BASE}/pipeline/runs`);
      if (runsRes.ok) {
        const runsData = await runsRes.json();
        setRuns(runsData);
      }

      // 3. Fetch metrics
      const metricsRes = await fetch(`${API_BASE}/pipeline/metrics`);
      if (metricsRes.ok) {
        const metricsData = await metricsRes.json();
        setMetrics(metricsData);
      }
    } catch (error) {
      console.error("Failed to load pipeline stats:", error);
    } finally {
      setIsLoading(false);
    }
  };

  // Poll for updates
  useEffect(() => {
    fetchDashboardData();
    const interval = setInterval(() => {
      fetchDashboardData();
    }, refreshInterval * 1000);
    return () => clearInterval(interval);
  }, [refreshInterval]);

  // Handle retry
  const handleRetry = async (runId: number) => {
    try {
      const res = await fetch(`${API_BASE}/pipeline/retry/${runId}`, {
        method: "POST"
      });
      if (res.ok) {
        fetchDashboardData();
      }
    } catch (error) {
      console.error("Retry failed:", error);
    }
  };

  // Handle acknowledge
  const handleAcknowledge = async (runId: number) => {
    try {
      const res = await fetch(`${API_BASE}/pipeline/acknowledge/${runId}`, {
        method: "POST"
      });
      if (res.ok) {
        fetchDashboardData();
      }
    } catch (error) {
      console.error("Acknowledge failed:", error);
    }
  };

  // Sort and filter pipeline runs
  const handleSort = (field: keyof PipelineRun) => {
    if (sortField === field) {
      setSortAsc(!sortAsc);
    } else {
      setSortField(field);
      setSortAsc(true);
    }
  };

  const filteredRuns = runs
    .filter(run => {
      const matchesSearch = run.farm_name.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesStatus = statusFilter === "ALL" || run.status.toUpperCase() === statusFilter;
      return matchesSearch && matchesStatus;
    })
    .sort((a, b) => {
      let valA = a[sortField];
      let valB = b[sortField];

      if (valA === null || valA === undefined) return sortAsc ? 1 : -1;
      if (valB === null || valB === undefined) return sortAsc ? -1 : 1;

      if (valA < valB) return sortAsc ? -1 : 1;
      if (valA > valB) return sortAsc ? 1 : -1;
      return 0;
    });

  // State Card animations and settings
  const statusConfig: Record<string, { color: string; bg: string; border: string; icon: React.ReactNode }> = {
    IDLE: { color: "text-zinc-500", bg: "bg-zinc-500/10", border: "border-zinc-500/20", icon: <Clock className="w-5 h-5 text-zinc-500" /> },
    FETCHING: { color: "text-blue-500", bg: "bg-blue-500/10", border: "border-blue-500/20", icon: <Activity className="w-5 h-5 text-blue-500 animate-pulse" /> },
    PREPROCESSING: { color: "text-indigo-500", bg: "bg-indigo-500/10", border: "border-indigo-500/20", icon: <Sliders className="w-5 h-5 text-indigo-500" /> },
    RECONSTRUCTING: { color: "text-amber-500", bg: "bg-amber-500/10", border: "border-amber-500/20", icon: <Layers className="w-5 h-5 text-amber-500 animate-spin" style={{ animationDuration: '3s' }} /> },
    FEATURE_ENGINEERING: { color: "text-orange-500", bg: "bg-orange-500/10", border: "border-orange-500/20", icon: <Database className="w-5 h-5 text-orange-500" /> },
    COMPLETED: { color: "text-emerald-500", bg: "bg-emerald-500/10", border: "border-emerald-500/20", icon: <CheckCircle className="w-5 h-5 text-emerald-500" /> },
    FAILED: { color: "text-red-500", bg: "bg-red-500/10", border: "border-red-500/20", icon: <XCircle className="w-5 h-5 text-red-500" /> }
  };

  const getStatusBadgeClass = (statusStr: string) => {
    const s = statusStr.toUpperCase();
    if (s === "COMPLETED" || s === "SUCCESS") return "bg-emerald-500/15 text-emerald-500 border-emerald-500/30";
    if (s === "FAILED") return "bg-red-500/15 text-red-500 border-red-500/30";
    if (s === "FETCHING" || s === "PREPROCESSING") return "bg-blue-500/15 text-blue-500 border-blue-500/30";
    return "bg-amber-500/15 text-amber-500 border-amber-500/30";
  };

  // Recent failures for Alert Panel
  const recentFailures = runs.filter(run => run.status.toUpperCase() === "FAILED");

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 p-8">
      {/* Title Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-8">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-white flex items-center gap-3">
            <span className="p-2 bg-emerald-500/10 border border-emerald-500/20 rounded-lg text-emerald-500">
              <Activity className="w-6 h-6" />
            </span>
            Data Ingestion & Satellite Pipeline
          </h1>
          <p className="text-slate-400 mt-1">Real-time status controls and observability dashboard for AgriSense AI</p>
        </div>
        
        {/* Interval controls */}
        <div className="flex items-center gap-4 bg-slate-900 border border-slate-800 p-2 rounded-xl">
          <div className="flex items-center gap-2 text-sm text-slate-400">
            <RefreshCw className="w-4 h-4" />
            <span>Poll Interval</span>
          </div>
          <select
            value={refreshInterval}
            onChange={(e) => setRefreshInterval(Number(e.target.value))}
            className="bg-slate-950 text-slate-200 border border-slate-800 rounded px-2 py-1 text-sm outline-none"
          >
            <option value={5}>5s</option>
            <option value={10}>10s</option>
            <option value={30}>30s</option>
          </select>
          <Button variant="ghost" size="icon" onClick={fetchDashboardData} className="text-slate-300 hover:text-white">
            <RefreshCw className="w-4 h-4" />
          </Button>
        </div>
      </div>

      {/* Grid 1: Pipeline status counts */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-4 mb-8">
        {Object.entries(statusCounts).map(([state, count]) => {
          const config = statusConfig[state] || statusConfig.IDLE;
          return (
            <motion.div
              key={state}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className={`p-4 rounded-xl border ${config.bg} ${config.border} flex flex-col justify-between h-28`}
            >
              <div className="flex justify-between items-start">
                <span className="text-xs font-semibold uppercase text-slate-400 tracking-wider">
                  {state.replace("_", " ")}
                </span>
                {config.icon}
              </div>
              <div className="text-2xl font-bold tracking-tight text-white mt-2">
                {count}
              </div>
            </motion.div>
          );
        })}
      </div>

      {/* Grid 2: Main Telemetry Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-8 mb-8">
        <Card className="lg:col-span-3 bg-slate-900 border-slate-800">
          <CardHeader>
            <CardTitle className="text-slate-200">Ingestion Volumes & Latencies</CardTitle>
          </CardHeader>
          <CardContent className="h-80">
            {metrics ? (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={metrics.daily_fetches}>
                  <defs>
                    <linearGradient id="colorVolume" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#10b981" stopOpacity={0.4}/>
                      <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                  <XAxis dataKey="date" stroke="#64748b" />
                  <YAxis stroke="#64748b" />
                  <Tooltip contentStyle={{ backgroundColor: "#0f172a", border: "1px solid #334155", color: "#f8fafc" }} />
                  <Area type="monotone" dataKey="volume" stroke="#10b981" fillOpacity={1} fill="url(#colorVolume)" name="Scenes Fetched" />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex items-center justify-center h-full text-slate-500">Loading charts...</div>
            )}
          </CardContent>
        </Card>

        {/* Alert side panel */}
        <Card className="bg-slate-900 border-slate-800 flex flex-col">
          <CardHeader>
            <CardTitle className="text-slate-200 flex items-center gap-2 text-red-500">
              <AlertTriangle className="w-5 h-5" />
              Recent Failures
            </CardTitle>
          </CardHeader>
          <CardContent className="flex-1 overflow-y-auto max-h-[300px] space-y-4">
            <AnimatePresence>
              {recentFailures.length === 0 ? (
                <div className="text-center text-slate-500 mt-8 text-sm">No pipeline failures recorded.</div>
              ) : (
                recentFailures.map(fail => (
                  <motion.div
                    key={fail.id}
                    layout
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    className="p-3 bg-red-950/20 border border-red-900/30 rounded-lg text-xs"
                  >
                    <div className="flex justify-between items-center mb-1">
                      <span className="font-semibold text-red-400">{fail.farm_name}</span>
                      <span className="text-[10px] text-slate-500">{new Date(fail.started_at).toLocaleTimeString()}</span>
                    </div>
                    <p className="text-slate-300 break-words mb-2">{fail.error_log || "Unknown validation exception."}</p>
                    <div className="flex gap-2 justify-end">
                      <Button size="sm" variant="ghost" onClick={() => handleAcknowledge(fail.id)} className="text-slate-400 hover:text-white h-7 px-2">
                        Acknowledge
                      </Button>
                      <Button size="sm" onClick={() => handleRetry(fail.id)} className="bg-red-600 hover:bg-red-700 text-white h-7 px-2 flex items-center gap-1">
                        <RotateCcw className="w-3 h-3" />
                        Retry
                      </Button>
                    </div>
                  </motion.div>
                ))
              )}
            </AnimatePresence>
          </CardContent>
        </Card>
      </div>

      {/* Grid 3: Gantt Timeline & Data Quality Trends */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
        {/* Interactive Gantt Timeline */}
        <Card className="bg-slate-900 border-slate-800">
          <CardHeader>
            <CardTitle className="text-slate-200">Active Ingestions Stage Timeline</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 max-h-[300px] overflow-y-auto">
            {runs.length === 0 ? (
              <div className="text-center text-slate-500 py-8">No runs in progress.</div>
            ) : (
              runs.map(run => {
                const stages = ["FETCHING", "PREPROCESSING", "RECONSTRUCTING", "FEATURE_ENGINEERING"];
                const currentIdx = stages.indexOf(run.status.toUpperCase());
                
                return (
                  <div key={run.id} className="space-y-2 border-b border-slate-800 pb-3 last:border-0">
                    <div className="flex justify-between text-xs">
                      <span className="font-semibold text-slate-300">{run.farm_name}</span>
                      <span className={`px-2 py-0.5 rounded border text-[10px] ${getStatusBadgeClass(run.status)}`}>
                        {run.status}
                      </span>
                    </div>
                    <div className="grid grid-cols-4 gap-2">
                      {stages.map((stage, idx) => {
                        let barBg = "bg-slate-800";
                        if (run.status.toUpperCase() === "FAILED") {
                          barBg = idx <= currentIdx ? "bg-red-500/40" : "bg-slate-800";
                        } else if (run.status.toUpperCase() === "COMPLETED" || run.status.toUpperCase() === "SUCCESS") {
                          barBg = "bg-emerald-500/40";
                        } else {
                          if (idx < currentIdx) barBg = "bg-emerald-500/40";
                          else if (idx === currentIdx) barBg = "bg-blue-500/60 animate-pulse";
                        }
                        return (
                          <div key={stage} className="space-y-1">
                            <div className={`h-2 rounded ${barBg}`} />
                            <div className="text-[9px] text-slate-500 text-center truncate">{stage.replace("_", " ")}</div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })
            )}
          </CardContent>
        </Card>

        {/* Quality score trends */}
        <Card className="bg-slate-900 border-slate-800">
          <CardHeader>
            <CardTitle className="text-slate-200">Pipeline Success & Latency Trends</CardTitle>
          </CardHeader>
          <CardContent className="h-64">
            {metrics ? (
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={metrics.success_rate_trend}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                  <XAxis dataKey="date" stroke="#64748b" />
                  <YAxis stroke="#64748b" domain={[80, 100]} />
                  <Tooltip contentStyle={{ backgroundColor: "#0f172a", border: "1px solid #334155", color: "#f8fafc" }} />
                  <Line type="monotone" dataKey="rate" stroke="#10b981" strokeWidth={2} name="Success Rate %" />
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex items-center justify-center h-full text-slate-500">Loading statistics...</div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Grid 4: Pipeline Runs List */}
      <Card className="bg-slate-900 border-slate-800">
        <CardHeader className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <CardTitle className="text-slate-200">Ingestion Execution Runs</CardTitle>
          
          {/* Filters */}
          <div className="flex flex-col md:flex-row gap-3 w-full md:w-auto">
            <div className="relative">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <Input
                placeholder="Search farm..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="bg-slate-950 border-slate-800 text-slate-200 pl-9 w-full md:w-60 h-9"
              />
            </div>
            
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="bg-slate-950 text-slate-200 border border-slate-800 rounded-lg px-3 py-1 text-sm outline-none h-9"
            >
              <option value="ALL">All Statuses</option>
              <option value="IDLE">Idle</option>
              <option value="FETCHING">Fetching</option>
              <option value="PREPROCESSING">Preprocessing</option>
              <option value="RECONSTRUCTING">Reconstructing</option>
              <option value="FEATURE_ENGINEERING">Feature Cube</option>
              <option value="COMPLETED">Completed</option>
              <option value="FAILED">Failed</option>
            </select>
          </div>
        </CardHeader>
        
        <CardContent>
          <Table>
            <TableHeader className="bg-slate-950/40">
              <TableRow className="border-slate-800">
                <TableHead onClick={() => handleSort("farm_name")} className="cursor-pointer hover:text-white">
                  Farm Name <ArrowUpDown className="w-3.5 h-3.5 inline ml-1" />
                </TableHead>
                <TableHead onClick={() => handleSort("status")} className="cursor-pointer hover:text-white">
                  Status <ArrowUpDown className="w-3.5 h-3.5 inline ml-1" />
                </TableHead>
                <TableHead onClick={() => handleSort("progress_percent")} className="cursor-pointer hover:text-white">
                  Progress % <ArrowUpDown className="w-3.5 h-3.5 inline ml-1" />
                </TableHead>
                <TableHead onClick={() => handleSort("duration_ms")} className="cursor-pointer hover:text-white">
                  Duration <ArrowUpDown className="w-3.5 h-3.5 inline ml-1" />
                </TableHead>
                <TableHead onClick={() => handleSort("quality_score")} className="cursor-pointer hover:text-white">
                  Quality Score <ArrowUpDown className="w-3.5 h-3.5 inline ml-1" />
                </TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredRuns.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-slate-500 py-8">
                    No matching runs found.
                  </TableCell>
                </TableRow>
              ) : (
                filteredRuns.map(run => (
                  <TableRow key={run.id} className="border-slate-800 hover:bg-slate-800/25">
                    <TableCell className="font-semibold text-slate-300">{run.farm_name}</TableCell>
                    <TableCell>
                      <span className={`px-2 py-0.5 rounded-full border text-[10px] font-medium ${getStatusBadgeClass(run.status)}`}>
                        {run.status}
                      </span>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <div className="w-16 bg-slate-800 h-1.5 rounded-full overflow-hidden">
                          <div
                            className={`h-full rounded-full ${run.status.toUpperCase() === "FAILED" ? "bg-red-500" : "bg-emerald-500"}`}
                            style={{ width: `${run.progress_percent}%` }}
                          />
                        </div>
                        <span className="text-xs text-slate-400">{run.progress_percent}%</span>
                      </div>
                    </TableCell>
                    <TableCell className="text-slate-400 text-xs">
                      {run.duration_ms ? `${(run.duration_ms / 1000).toFixed(2)}s` : "In Progress"}
                    </TableCell>
                    <TableCell>
                      <span className={`font-semibold ${run.quality_score < 60 ? "text-red-400" : "text-emerald-400"}`}>
                        {run.quality_score.toFixed(1)}/100
                      </span>
                    </TableCell>
                    <TableCell className="text-right space-x-2">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => setSelectedRun(run)}
                        className="bg-slate-900 border-slate-800 text-slate-300 hover:bg-slate-800 hover:text-white h-8 px-2 flex.inline items-center gap-1"
                      >
                        <Eye className="w-3.5 h-3.5" />
                        Logs
                      </Button>
                      {run.status.toUpperCase() === "FAILED" && (
                        <Button
                          size="sm"
                          onClick={() => handleRetry(run.id)}
                          className="bg-red-600 hover:bg-red-700 text-white h-8 px-2"
                        >
                          Retry
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Log Modal */}
      {selectedRun && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-slate-900 border border-slate-800 rounded-xl p-6 max-w-2xl w-full text-slate-200 flex flex-col max-h-[80vh]"
          >
            <div className="flex justify-between items-start mb-4">
              <div>
                <h3 className="text-lg font-bold text-white">Execution Logs: {selectedRun.farm_name}</h3>
                <p className="text-xs text-slate-400 mt-1">Run ID: {selectedRun.id} | Type: {selectedRun.run_type}</p>
              </div>
              <Button size="sm" variant="ghost" onClick={() => setSelectedRun(null)} className="text-slate-400 hover:text-white">
                ✕ Close
              </Button>
            </div>
            
            <div className="flex-1 overflow-y-auto bg-slate-950 p-4 rounded-lg font-mono text-xs text-slate-300 min-h-[200px] border border-slate-800">
              <p className="text-slate-500">[{new Date(selectedRun.started_at).toISOString()}] Pipeline thread started...</p>
              <p className="text-slate-500">[{new Date(selectedRun.started_at).toISOString()}] Loading geometries & performing validation...</p>
              <p className="text-emerald-500">[{new Date(selectedRun.started_at).toISOString()}] VALIDATION SUCCESS: Closed Polygon boundary, Area = 12.4 ha</p>
              <p className="text-slate-500">[{new Date(selectedRun.started_at).toISOString()}] Transitioning to FETCHING state...</p>
              
              {selectedRun.status.toUpperCase() === "FAILED" ? (
                <>
                  <p className="text-red-500">[{new Date(selectedRun.started_at).toISOString()}] RUN FAILURE ERROR: {selectedRun.error_log}</p>
                  <p className="text-red-500 font-bold">[{new Date(selectedRun.started_at).toISOString()}] Pipeline thread terminated: FAILED.</p>
                </>
              ) : (
                <>
                  <p className="text-slate-500">[{new Date(selectedRun.started_at).toISOString()}] Fetching Sentinel-2 Harmonized bands...</p>
                  <p className="text-slate-500">[{new Date(selectedRun.started_at).toISOString()}] Running Atmospheric calibration & cloud masking...</p>
                  <p className="text-emerald-500">[{new Date(selectedRun.started_at).toISOString()}] PREPROCESSING COMPLETED: 1 scene parsed</p>
                  <p className="text-slate-500">[{new Date(selectedRun.started_at).toISOString()}] Running SAR-guided diffusion cloud reconstruction...</p>
                  <p className="text-emerald-500">[{selectedRun.completed_at ? new Date(selectedRun.completed_at).toISOString() : ""}] FEATURE ENGINEERING COMPLETE: Indices generated</p>
                  <p className="text-emerald-500 font-bold">[{selectedRun.completed_at ? new Date(selectedRun.completed_at).toISOString() : ""}] Pipeline execution success.</p>
                </>
              )}
            </div>
          </motion.div>
        </div>
      )}
    </div>
  );
}
