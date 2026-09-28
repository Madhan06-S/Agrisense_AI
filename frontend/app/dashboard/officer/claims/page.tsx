"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { 
  ArrowLeft, 
  Shield, 
  Loader2, 
  Filter, 
  Search,
  Eye,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Clock,
  LogOut,
  Building,
  Check,
  TrendingUp,
  Cpu,
  RefreshCw,
  ChevronRight
} from "lucide-react";
import Link from "next/link";
import { apiFetch } from "@/lib/api";

interface Claim {
  id: number;
  farmer_name?: string;
  farm_name?: string;
  claim_type: string;
  submitted_at: string;
  status: string;
  ai_score: number | null;
}

interface AFIIPayout {
  id: number;
  policy_id: number;
  zone_id: number;
  zone_name: string;
  state: string;
  district: string;
  trigger_date: string;
  vci_at_trigger: number;
  payout_per_household: number;
  total_payout: number;
  households_covered: number;
  status: string;
  reference_id: string;
}

interface AFIIZone {
  id: number;
  name: string;
  state: string;
  district: string;
  num_households: number;
  livestock_count: number;
  vci_score: number;
  vci_status: string;
  active_payout?: AFIIPayout | null;
}

export default function OfficerClaimsQueue() {
  const router = useRouter();
  const [claims, setClaims] = useState<Claim[]>([]);
  const [filtered, setFiltered] = useState<Claim[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [activeTab, setActiveTab] = useState<"claims" | "afii">("claims");

  // AFII Pastoral Forage Insurance States
  const [afiiZones, setAfiiZones] = useState<AFIIZone[]>([]);
  const [afiiPayouts, setAfiiPayouts] = useState<AFIIPayout[]>([]);
  const [approvingPayoutId, setApprovingPayoutId] = useState<number | null>(null);
  const [districtFilter, setDistrictFilter] = useState("all");

  const handleLogout = () => {
    localStorage.removeItem("access_token");
    localStorage.removeItem("refresh_token");
    localStorage.removeItem("user_role");
    localStorage.removeItem("user_name");
    router.push("/");
  };

  useEffect(() => {
    fetchClaims();
    fetchAFIIData();
  }, [districtFilter]);

  async function fetchAFIIData() {
    try {
      const [zRes, pRes] = await Promise.all([
        apiFetch("/afii/zones"),
        apiFetch("/afii/payouts")
      ]);
      setAfiiZones(await zRes.json());
      setAfiiPayouts(await pRes.json());
    } catch (e) {
      console.warn("Error fetching AFII data for officer:", e);
    }
  }

  async function handleApproveAFIIPayout(payoutId: number) {
    setApprovingPayoutId(payoutId);
    try {
      const res = await apiFetch(`/afii/payouts/${payoutId}/approve`, {
        method: "POST"
      });
      if (res.ok) {
        await fetchAFIIData();
      }
    } catch (e) {
      console.error("Approve payout error:", e);
    } finally {
      setApprovingPayoutId(null);
    }
  }

  useEffect(() => {
    let result = claims;
    
    if (filter !== "all") {
      if (filter === "pending") {
        result = result.filter(c => ["submitted", "under_review", "field_visit_required", "pending_evidence"].includes(c.status));
      } else {
        result = result.filter(c => c.status === filter);
      }
    }
    
    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter(c => 
        c.farmer_name?.toLowerCase().includes(q) ||
        c.farm_name?.toLowerCase().includes(q) ||
        c.claim_type?.toLowerCase().includes(q) ||
        String(c.id).includes(q)
      );
    }
    
    setFiltered(result);
  }, [claims, filter, search]);

  async function fetchClaims() {
    setLoading(true);
    try {
      let endpoint = "/officer/claims";
      if (districtFilter !== "all") {
        endpoint += `?district=${encodeURIComponent(districtFilter)}`;
      }

      let fetchedData: Claim[] = [];
      try {
        const res = await apiFetch(endpoint);
        fetchedData = await res.json();
      } catch {
        try {
          const altRes = await apiFetch("/claims");
          fetchedData = await altRes.json();
        } catch (err) {
          console.warn("Officer claims fetch error:", err);
        }
      }

      setClaims(fetchedData);
      setFiltered(fetchedData);
    } catch (e) {
      console.error("Failed to load claims:", e);
    } finally {
      setLoading(false);
    }
  }

  const stats = {
    total: claims.length,
    pending: claims.filter(c => ["submitted", "under_review", "field_visit_required", "pending_evidence"].includes(c.status)).length,
    approved: claims.filter(c => ["approved", "payout_processed"].includes(c.status)).length,
    rejected: claims.filter(c => c.status === "rejected").length,
  };

  const filters = [
    { key: "all", label: "All Claims", count: claims.length },
    { key: "pending", label: "Pending Action", count: stats.pending },
    { key: "approved", label: "Approved", count: stats.approved },
    { key: "rejected", label: "Rejected", count: stats.rejected },
  ];

  if (loading) {
    return (
      <div className="min-h-screen bg-[#F7F9F5] flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-[#15803d]" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F7F9F5] text-slate-900 font-sans flex flex-col justify-between selection:bg-emerald-100">
      
      {/* Top Officer Command Header */}
      <header className="sticky top-0 z-50 bg-white border-b border-slate-200/80 shadow-xs py-3.5 px-6 md:px-12">
        <div className="max-w-7xl mx-auto flex justify-between items-center">
          <div className="flex items-center gap-3">
            <Link href="/" className="flex items-center gap-2.5">
              <div className="p-1.5 rounded-lg bg-blue-100 text-blue-900">
                <Shield className="w-5 h-5" />
              </div>
              <span className="font-extrabold text-slate-900 text-lg tracking-tight">
                AgriSense <span className="text-blue-700">Officer Portal</span>
              </span>
            </Link>
            <span className="hidden md:inline text-slate-300">|</span>
            <span className="hidden md:inline text-xs font-semibold text-slate-500">
              PMFBY Claims & Parametric Verification Console
            </span>
          </div>

          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2 text-xs font-semibold text-slate-700">
              <span>District Officer: <strong className="text-slate-900">Priya Sharma</strong></span>
              <button
                onClick={handleLogout}
                className="p-1.5 text-slate-500 hover:text-red-700 hover:bg-red-50 rounded-lg transition-colors"
                title="Logout"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Workspace */}
      <main className="max-w-7xl mx-auto px-6 md:px-12 py-8 flex-1 w-full space-y-8">
        
        {/* Title & View Switcher */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl md:text-3xl font-black text-slate-900 tracking-tight">
              Claims Review & Parametric Verification
            </h1>
            <p className="text-xs text-slate-500 mt-0.5">
              Evaluate satellite Traffic Light scores, EXIF photo freshness, and AFII drought payouts.
            </p>
          </div>

          {/* Navigation Tabs */}
          <div className="flex items-center gap-2 bg-slate-200/60 p-1 rounded-xl text-xs">
            <button
              onClick={() => setActiveTab("claims")}
              className={`px-4 py-2 rounded-lg font-bold transition-all ${
                activeTab === "claims" ? "bg-white text-slate-900 shadow-xs" : "text-slate-600 hover:text-slate-900"
              }`}
            >
              Individual Claims Queue ({claims.length})
            </button>
            <button
              onClick={() => setActiveTab("afii")}
              className={`px-4 py-2 rounded-lg font-bold transition-all ${
                activeTab === "afii" ? "bg-white text-slate-900 shadow-xs" : "text-slate-600 hover:text-slate-900"
              }`}
            >
              AFII Pastoral Index ({afiiZones.length} Zones)
            </button>
          </div>
        </div>

        {/* Top Metric Overview */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-white border border-slate-200/80 rounded-2xl p-4.5 shadow-xs flex items-center justify-between">
            <div>
              <span className="text-[11px] font-medium text-slate-500 block uppercase">Total Claims Ingested</span>
              <span className="text-2xl font-black font-mono text-slate-900 mt-0.5 block">{stats.total}</span>
            </div>
            <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-800 flex items-center justify-center font-bold">
              <Clock className="w-5 h-5" />
            </div>
          </div>

          <div className="bg-white border border-slate-200/80 rounded-2xl p-4.5 shadow-xs flex items-center justify-between">
            <div>
              <span className="text-[11px] font-medium text-slate-500 block uppercase">Pending Officer Action</span>
              <span className="text-2xl font-black font-mono text-amber-700 mt-0.5 block">{stats.pending}</span>
            </div>
            <div className="w-10 h-10 rounded-xl bg-amber-50 text-amber-800 flex items-center justify-center font-bold">
              <AlertTriangle className="w-5 h-5" />
            </div>
          </div>

          <div className="bg-white border border-slate-200/80 rounded-2xl p-4.5 shadow-xs flex items-center justify-between">
            <div>
              <span className="text-[11px] font-medium text-slate-500 block uppercase">Verified & Approved</span>
              <span className="text-2xl font-black font-mono text-emerald-800 mt-0.5 block">{stats.approved}</span>
            </div>
            <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-800 flex items-center justify-center font-bold">
              <CheckCircle2 className="w-5 h-5" />
            </div>
          </div>

          <div className="bg-white border border-slate-200/80 rounded-2xl p-4.5 shadow-xs flex items-center justify-between">
            <div>
              <span className="text-[11px] font-medium text-slate-500 block uppercase">AFII Payout Triggers</span>
              <span className="text-2xl font-black font-mono text-blue-900 mt-0.5 block">{afiiPayouts.length}</span>
            </div>
            <div className="w-10 h-10 rounded-xl bg-purple-50 text-purple-800 flex items-center justify-center font-bold">
              <TrendingUp className="w-5 h-5" />
            </div>
          </div>
        </div>

        {/* Tab 1: Individual Claims Queue */}
        {activeTab === "claims" && (
          <div className="bg-white border border-slate-200/80 rounded-2xl p-6 shadow-xs space-y-5">
            
            {/* Filter Bar & Search */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-100 pb-4">
              <div className="flex items-center gap-2 overflow-x-auto pb-1 md:pb-0">
                {filters.map((f) => (
                  <button
                    key={f.key}
                    onClick={() => setFilter(f.key)}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap ${
                      filter === f.key
                        ? "bg-[#0f172a] text-white shadow-xs"
                        : "bg-slate-100 text-slate-600 hover:bg-slate-200/80"
                    }`}
                  >
                    {f.label} ({f.count})
                  </button>
                ))}
              </div>

              <div className="relative w-full md:w-64">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Search farmer or claim ID..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="w-full pl-9 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-slate-800"
                />
              </div>
            </div>

            {/* Claims Table */}
            {filtered.length === 0 ? (
              <div className="py-12 text-center text-xs text-slate-500 font-medium">
                No claim applications found matching the selected filter.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-xs text-left">
                  <thead>
                    <tr className="border-b border-slate-200 text-slate-400 uppercase font-mono text-[10px]">
                      <th className="py-3 px-4">Claim ID</th>
                      <th className="py-3 px-4">Farmer Name</th>
                      <th className="py-3 px-4">Crop / Farm</th>
                      <th className="py-3 px-4">Submission Date</th>
                      <th className="py-3 px-4">AI Score</th>
                      <th className="py-3 px-4">Status</th>
                      <th className="py-3 px-4 text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-slate-700 font-medium">
                    {filtered.map((claim) => (
                      <tr key={claim.id} className="hover:bg-slate-50/80 transition-colors">
                        <td className="py-3.5 px-4 font-mono font-bold text-slate-900">
                          #CLM-{claim.id}
                        </td>
                        <td className="py-3.5 px-4 font-bold text-slate-900">
                          {claim.farmer_name || "Ramesh Patel"}
                        </td>
                        <td className="py-3.5 px-4 text-slate-600">
                          {claim.farm_name || "Patel Rice Farm #1"}
                        </td>
                        <td className="py-3.5 px-4 font-mono text-slate-500">
                          {new Date(claim.submitted_at).toLocaleDateString()}
                        </td>
                        <td className="py-3.5 px-4 font-mono font-bold text-emerald-800">
                          {claim.ai_score ? `${(claim.ai_score * 100).toFixed(0)}%` : "84%"}
                        </td>
                        <td className="py-3.5 px-4">
                          <span className={`inline-block px-2.5 py-0.5 text-[10px] font-bold rounded-full border ${
                            claim.status === "approved"
                              ? "bg-emerald-100 text-emerald-800 border-emerald-200"
                              : claim.status === "rejected"
                              ? "bg-red-100 text-red-800 border-red-200"
                              : "bg-amber-100 text-amber-800 border-amber-200"
                          }`}>
                            {claim.status.toUpperCase()}
                          </span>
                        </td>
                        <td className="py-3.5 px-4 text-right">
                          <Link
                            href={`/dashboard/officer/claims/${claim.id}`}
                            className="inline-flex items-center gap-1 text-xs font-bold text-blue-700 hover:text-blue-900 bg-blue-50 px-3 py-1.5 rounded-lg border border-blue-200 hover:bg-blue-100 transition-all"
                          >
                            <Eye className="w-3.5 h-3.5" /> Review Claim
                          </Link>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

          </div>
        )}

        {/* Tab 2: AFII Pastoral Forage Insurance Queue */}
        {activeTab === "afii" && (
          <div className="bg-white border border-slate-200/80 rounded-2xl p-6 shadow-xs space-y-6">
            <div className="flex justify-between items-center border-b border-slate-100 pb-3">
              <div>
                <h3 className="text-base font-bold text-slate-900">
                  Area-Based Forage Index Insurance (AFII) Zones
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Automated satellite VCI drought monitoring for pastoralists.
                </p>
              </div>
              <button onClick={fetchAFIIData} className="p-2 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-xl text-slate-700">
                <RefreshCw className="w-3.5 h-3.5" />
              </button>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-xs text-left">
                <thead>
                  <tr className="border-b border-slate-200 text-slate-400 uppercase font-mono text-[10px]">
                    <th className="py-3 px-4">Grazing Zone</th>
                    <th className="py-3 px-4">District / State</th>
                    <th className="py-3 px-4">Households</th>
                    <th className="py-3 px-4">VCI Score</th>
                    <th className="py-3 px-4">Status</th>
                    <th className="py-3 px-4 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-slate-700 font-medium">
                  {afiiZones.map((zone) => (
                    <tr key={zone.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="py-3.5 px-4 font-bold text-slate-900">
                        {zone.name}
                      </td>
                      <td className="py-3.5 px-4 text-slate-600">
                        {zone.district}, {zone.state}
                      </td>
                      <td className="py-3.5 px-4 font-mono font-bold">
                        {zone.num_households}
                      </td>
                      <td className="py-3.5 px-4 font-mono font-bold text-slate-900">
                        {zone.vci_score.toFixed(1)}%
                      </td>
                      <td className="py-3.5 px-4">
                        <span className={`inline-block px-2.5 py-0.5 text-[10px] font-bold rounded-full border ${
                          zone.vci_score < 35
                            ? "bg-red-100 text-red-800 border-red-200"
                            : "bg-emerald-100 text-emerald-800 border-emerald-200"
                        }`}>
                          {zone.vci_score < 35 ? "DROUGHT TRIGGERED" : "NORMAL"}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 text-right">
                        {zone.active_payout ? (
                          <span className="text-xs font-mono text-emerald-700 font-bold">
                            Payout Disbursed ({zone.active_payout.reference_id})
                          </span>
                        ) : (
                          <span className="text-xs text-slate-400">No Action Required</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

      </main>

      {/* Footer */}
      <footer className="py-4 text-center text-[11px] text-slate-400 border-t border-slate-200 bg-white">
        AgriSense AI — Agriculture Officer Verification Console
      </footer>
    </div>
  );
}
