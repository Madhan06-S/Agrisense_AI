"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { 
  Shield, 
  Loader2, 
  Search,
  Eye,
  LogOut,
  RefreshCw
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
  area_hectares?: number;
  vci_score: number;
  ndvi_current?: number;
  survival_baseline_vci?: number;
  dm_available_kg_ha?: number;
  dm_required_kg_ha?: number;
  vci_breach?: boolean;
  dm_shortfall_breach?: boolean;
  days_to_breach?: number | null;
  vci_status: "normal" | "watch" | "triggered" | string;
  status_reason?: string;
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

  const [afiiZones, setAfiiZones] = useState<AFIIZone[]>([]);
  const [afiiPayouts, setAfiiPayouts] = useState<AFIIPayout[]>([]);
  const [approvingPayoutId, setApprovingPayoutId] = useState<number | null>(null);
  const [disbursingPayoutId, setDisbursingPayoutId] = useState<number | null>(null);

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
  }, []);

  async function fetchAFIIData() {
    try {
      const [zRes, pRes] = await Promise.all([
        apiFetch("/afii/zones"),
        apiFetch("/afii/payouts")
      ]);
      const zonesData: AFIIZone[] = await zRes.json();
      // Sort AFII zones by urgency: "triggered" (VCI < 35% or DM shortfall) first, then Watch state, then Normal
      zonesData.sort((a, b) => {
        const aTriggered = a.vci_status === "triggered" || a.vci_score < 35 || (a.dm_shortfall_breach ?? false);
        const bTriggered = b.vci_status === "triggered" || b.vci_score < 35 || (b.dm_shortfall_breach ?? false);
        if (aTriggered && !bTriggered) return -1;
        if (!aTriggered && bTriggered) return 1;

        const aWatch = a.vci_status === "watch";
        const bWatch = b.vci_status === "watch";
        if (aWatch && !bWatch) return -1;
        if (!aWatch && bWatch) return 1;

        return a.vci_score - b.vci_score;
      });
      setAfiiZones(zonesData);
      setAfiiPayouts(await pRes.json());
    } catch (e) {
      console.warn("Error fetching AFII data for officer:", e);
    }
  }

  async function handleApproveAFIIPayout(payoutId: number) {
    setApprovingPayoutId(payoutId);
    try {
      const res = await apiFetch(`/afii/payouts/${payoutId}/approve`, { method: "POST" });
      if (res.ok) {
        await fetchAFIIData();
      }
    } catch (e) {
      console.error("Approve payout error:", e);
    } finally {
      setApprovingPayoutId(null);
    }
  }

  async function handleDisburseAFIIPayout(payoutId: number) {
    setDisbursingPayoutId(payoutId);
    try {
      const res = await apiFetch(`/afii/payouts/${payoutId}/disburse`, { method: "POST" });
      if (res.ok) {
        await fetchAFIIData();
      }
    } catch (e) {
      console.error("Disburse payout error:", e);
    } finally {
      setDisbursingPayoutId(null);
    }
  }

  useEffect(() => {
    let result = [...claims];
    
    // Sort claims by urgency: field_visit_required and submitted first
    result.sort((a, b) => {
      const urgencyScore = (status: string) => {
        if (status === "field_visit_required" || status === "under_review") return 1;
        if (status === "submitted") return 2;
        return 3;
      };
      return urgencyScore(a.status) - urgencyScore(b.status);
    });

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
      let fetchedData: Claim[] = [];
      try {
        const res = await apiFetch("/officer/claims");
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
    triggeredAfii: afiiZones.filter(z => z.vci_score < 35 || z.vci_status === "triggered").length
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#F7F9F5] flex items-center justify-center">
        <Loader2 className="w-6 h-6 animate-spin text-slate-600" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F7F9F5] text-slate-900 font-sans flex flex-col justify-between">
      
      {/* Header */}
      <header className="bg-white border-b border-slate-200 py-3.5 px-4 sm:px-6 md:px-12">
        <div className="max-w-6xl mx-auto flex justify-between items-center">
          <div className="flex items-center gap-3">
            <Link href="/" className="flex items-center gap-2">
              <Shield className="w-5 h-5 text-[#15803d]" />
              <span className="font-extrabold text-slate-900 text-lg tracking-tight">
                AgriSense <span className="text-slate-900">Officer Portal</span>
              </span>
            </Link>
            <span className="text-slate-300">|</span>
            <span className="type-xs font-medium text-slate-600">Verification console</span>
          </div>

          <div className="flex items-center gap-4 type-sm">
            <span className="text-slate-700">Officer: <span className="font-semibold">Priya Sharma</span></span>
            <button onClick={handleLogout} className="p-1 text-slate-400 hover:text-slate-700" title="Logout">
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </header>

      {/* Main Workspace */}
      <main className="max-w-6xl mx-auto px-4 sm:px-6 md:px-12 py-8 flex-1 w-full space-y-6">
        
        {/* Title & View Switcher */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="type-3xl text-slate-900">
              Claims review & parametric verification
            </h1>
            <p className="type-xs text-slate-500 mt-0.5">
              Prioritized by field visit urgency and drought breach threshold.
            </p>
          </div>

          {/* Navigation Tabs */}
          <div className="flex items-center gap-1 bg-slate-200/60 p-1 rounded type-xs font-semibold">
            <button
              onClick={() => setActiveTab("claims")}
              className={`px-3 py-1.5 rounded transition-all ${activeTab === "claims" ? "bg-white text-slate-900 shadow-2xs font-bold" : "text-slate-600"}`}
            >
              Individual claims queue ({claims.length})
            </button>
            <button
              onClick={() => setActiveTab("afii")}
              className={`px-3 py-1.5 rounded transition-all ${activeTab === "afii" ? "bg-white text-slate-900 shadow-2xs font-bold" : "text-slate-600"}`}
            >
              AFII pastoral index ({afiiZones.length} zones)
            </button>
          </div>
        </div>

        {/* 2. ONE LINE SUMMARY STATS ABOVE THE TABLE */}
        <div className="bg-white border border-slate-200 rounded-lg p-3 text-xs font-mono text-slate-600 flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-6">
            <span>Total claims: <strong className="text-slate-900 font-num">{stats.total}</strong></span>
            <span>Pending action: <strong className="text-amber-800 font-num">{stats.pending}</strong></span>
            <span>Approved: <strong className="text-emerald-800 font-num">{stats.approved}</strong></span>
            <span>Triggered AFII zones: <strong className="text-red-800 font-num">{stats.triggeredAfii}</strong></span>
          </div>
          <span className="type-xs text-slate-400">Sorted by urgency</span>
        </div>

        {/* Tab 1: Individual Claims Queue */}
        {activeTab === "claims" && (
          <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-4">
            
            {/* Filter Bar & Search */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-200 pb-3">
              <div className="flex items-center gap-1.5 type-xs">
                {["all", "pending", "approved", "rejected"].map((key) => (
                  <button
                    key={key}
                    onClick={() => setFilter(key)}
                    className={`px-2.5 py-1 rounded transition-all ${filter === key ? "bg-slate-900 text-white font-bold" : "bg-slate-100 text-slate-600 hover:bg-slate-200"}`}
                  >
                    {key === "all" ? "All claims" : key === "pending" ? "Pending action" : key.charAt(0).toUpperCase() + key.slice(1)}
                  </button>
                ))}
              </div>

              <div className="relative w-full sm:w-60">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Search farmer or claim..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="w-full pl-8 pr-2.5 py-1 bg-slate-50 border border-slate-300 rounded type-xs text-slate-800 focus:outline-none"
                />
              </div>
            </div>

            {/* Claims Table */}
            {filtered.length === 0 ? (
              <div className="py-8 text-center type-xs text-slate-500">
                No claim applications found matching the selected filter.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full type-sm text-left">
                  <thead>
                    <tr className="border-b border-slate-200 text-slate-400 type-xs font-mono uppercase">
                      <th className="py-2.5 px-3">Claim ID</th>
                      <th className="py-2.5 px-3">Farmer name</th>
                      <th className="py-2.5 px-3">Crop / Farm</th>
                      <th className="py-2.5 px-3">Multi-Signal Evidence</th>
                      <th className="py-2.5 px-3">Status</th>
                      <th className="py-2.5 px-3 text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-slate-700">
                    {filtered.map((claim) => {
                      const isYellow = claim.status === "under_review" || claim.status === "field_visit_required" || claim.status === "submitted";
                      return (
                        <tr key={claim.id} className={isYellow ? "bg-amber-50/40 hover:bg-amber-50/70" : "hover:bg-slate-50"}>
                          <td className="py-3 px-3 font-num font-bold text-slate-900">#CLM-{claim.id}</td>
                          <td className="py-3 px-3 font-semibold text-slate-900">{claim.farmer_name || "Ramesh Patel"}</td>
                          <td className="py-3 px-3 text-slate-600">{claim.farm_name || "Patel Rice Farm #1"}</td>
                          <td className="py-3 px-3">
                            <div className="flex flex-wrap items-center gap-1 text-[10px]">
                              <span className="bg-emerald-100 text-emerald-800 border border-emerald-200 px-1.5 py-0.5 rounded font-mono">OPT: LIVE</span>
                              <span className="bg-emerald-100 text-emerald-800 border border-emerald-200 px-1.5 py-0.5 rounded font-mono">SAR: LIVE</span>
                              <span className="bg-emerald-100 text-emerald-800 border border-emerald-200 px-1.5 py-0.5 rounded font-mono">LST: LIVE</span>
                              <span className="bg-emerald-100 text-emerald-800 border border-emerald-200 px-1.5 py-0.5 rounded font-mono">SMAP: LIVE</span>
                            </div>
                          </td>
                          <td className="py-3 px-3">
                            <span className={claim.status === "approved" ? "chip-status-live" : isYellow ? "chip-status-watch" : "chip-status-archive"}>
                              {isYellow ? "FIELD VISIT REQUIRED" : claim.status.toUpperCase()}
                            </span>
                          </td>
                          <td className="py-3 px-3 text-right">
                            {/* Single row-level action */}
                            <Link
                              href={`/dashboard/officer/claims/${claim.id}`}
                              className="bg-slate-900 hover:bg-slate-800 text-white type-xs font-bold px-3 py-1.5 rounded transition-colors inline-block"
                            >
                              Review evidence
                            </Link>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}

          </div>
        )}

        {/* Tab 2: AFII Pastoral Forage Insurance Queue */}
        {activeTab === "afii" && (
          <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-4">
            <div className="flex justify-between items-center border-b border-slate-200 pb-3">
              <div>
                <h3 className="type-xl text-slate-900">AFII pastoral index zones</h3>
                <p className="type-xs text-slate-500">Pay before livestock starve — VCI & DM/ha shortfall dual-trigger monitoring.</p>
              </div>
              <button onClick={fetchAFIIData} className="p-1.5 text-slate-400 hover:text-slate-700" title="Refresh">
                <RefreshCw className="w-3.5 h-3.5" />
              </button>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full type-sm text-left">
                <thead>
                  <tr className="border-b border-slate-200 text-slate-400 type-xs font-mono uppercase">
                    <th className="py-2.5 px-3">Grazing zone</th>
                    <th className="py-2.5 px-3">District / State</th>
                    <th className="py-2.5 px-3">VCI score</th>
                    <th className="py-2.5 px-3">DM/ha vs baseline</th>
                    <th className="py-2.5 px-3">Days to breach</th>
                    <th className="py-2.5 px-3">Status</th>
                    <th className="py-2.5 px-3 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-slate-700">
                  {afiiZones.map((zone) => {
                    const isVciBreached = zone.vci_score < 35.0 || (zone.vci_breach ?? false);
                    const isDmBreached = (zone.dm_shortfall_breach ?? false) || ((zone.dm_available_kg_ha ?? 9999) < (zone.dm_required_kg_ha ?? 0));
                    const isTriggered = isVciBreached || isDmBreached || zone.vci_status === "triggered";
                    const isWatch = zone.vci_status === "watch";
                    
                    const payout = zone.active_payout;
                    const payoutStatus = payout ? payout.status : isTriggered ? "triggered" : isWatch ? "watch" : "normal";

                    return (
                      <tr key={zone.id} className={isTriggered ? "bg-red-50/40 hover:bg-red-50/70" : isWatch ? "bg-amber-50/40 hover:bg-amber-50/70" : "hover:bg-slate-50"}>
                        <td className="py-3 px-3">
                          <div className="font-semibold text-slate-900">{zone.name}</div>
                          <div className="type-xs text-slate-500 font-num">{zone.num_households} households · {zone.livestock_count} animals · {zone.area_hectares ?? 100} ha</div>
                        </td>
                        <td className="py-3 px-3 text-slate-600">{zone.district}, {zone.state}</td>
                        
                        {/* 1. VCI score column with threshold highlight */}
                        <td className="py-3 px-3 font-num">
                          {isVciBreached ? (
                            <span className="font-bold text-red-700 bg-red-100 px-1.5 py-0.5 rounded border border-red-200">
                              {zone.vci_score.toFixed(1)}% <span className="type-xs font-normal text-red-800">(Thresh: 35.0%)</span>
                            </span>
                          ) : (
                            <span className="font-semibold text-slate-800">
                              {zone.vci_score.toFixed(1)}% <span className="type-xs font-normal text-slate-400">(Thresh: 35.0%)</span>
                            </span>
                          )}
                        </td>

                        {/* 2. DM/ha vs baseline column with threshold highlight */}
                        <td className="py-3 px-3 font-num">
                          {isDmBreached ? (
                            <span className="font-bold text-red-700 bg-red-100 px-1.5 py-0.5 rounded border border-red-200 block">
                              {(zone.dm_available_kg_ha ?? 0).toFixed(0)} kg DM/ha <span className="type-xs font-normal text-red-800">(Req: {(zone.dm_required_kg_ha ?? 0).toFixed(0)})</span>
                            </span>
                          ) : (
                            <span className="font-semibold text-slate-800 block">
                              {(zone.dm_available_kg_ha ?? 0).toFixed(0)} kg DM/ha <span className="type-xs font-normal text-slate-400">(Req: {(zone.dm_required_kg_ha ?? 0).toFixed(0)})</span>
                            </span>
                          )}
                        </td>

                        {/* 3. Days to breach column */}
                        <td className="py-3 px-3 font-num">
                          {isTriggered ? (
                            <span className="type-xs font-bold text-red-700 bg-red-50 px-2 py-0.5 rounded border border-red-200">
                              Breached (0d)
                            </span>
                          ) : zone.days_to_breach !== null && zone.days_to_breach !== undefined ? (
                            <span className={`type-xs font-semibold ${zone.days_to_breach <= 30 ? "text-amber-800 bg-amber-100 px-1.5 py-0.5 rounded border border-amber-200 font-bold" : "text-slate-700"}`}>
                              {zone.days_to_breach.toFixed(0)} days
                            </span>
                          ) : (
                            <span className="type-xs text-slate-400">Stable (&gt;60d)</span>
                          )}
                        </td>

                        {/* 4. Status column */}
                        <td className="py-3 px-3">
                          {payoutStatus === "paid" ? (
                            <span className="bg-emerald-100 text-emerald-800 border border-emerald-300 type-xs px-2 py-0.5 rounded font-mono uppercase font-bold">
                              PAID & DISBURSED
                            </span>
                          ) : payoutStatus === "approved" ? (
                            <span className="bg-blue-100 text-blue-800 border border-blue-300 type-xs px-2 py-0.5 rounded font-mono uppercase font-bold">
                              APPROVED (PENDING PAY)
                            </span>
                          ) : payoutStatus === "triggered" ? (
                            <span className="bg-red-100 text-red-800 border border-red-300 type-xs px-2 py-0.5 rounded font-mono uppercase font-bold animate-pulse">
                              TRIGGERED (UNAPPROVED)
                            </span>
                          ) : isWatch ? (
                            <span className="bg-amber-100 text-amber-900 border border-amber-300 type-xs px-2 py-0.5 rounded font-mono uppercase font-bold">
                              WATCH (PRE-ALERT)
                            </span>
                          ) : (
                            <span className="bg-slate-100 text-slate-700 border border-slate-200 type-xs px-2 py-0.5 rounded font-mono uppercase font-medium">
                              NORMAL
                            </span>
                          )}
                        </td>

                        {/* 5. Action column: strict status flow triggered -> approved -> paid */}
                        <td className="py-3 px-3 text-right">
                          {payout && payout.status === "triggered" ? (
                            <button
                              onClick={() => handleApproveAFIIPayout(payout.id)}
                              disabled={approvingPayoutId === payout.id}
                              className="bg-[#15803d] hover:bg-[#166534] text-white type-xs font-bold px-3 py-1.5 rounded transition-colors disabled:opacity-50"
                            >
                              {approvingPayoutId === payout.id ? "Approving..." : "Approve payout"}
                            </button>
                          ) : payout && payout.status === "approved" ? (
                            <button
                              onClick={() => handleDisburseAFIIPayout(payout.id)}
                              disabled={disbursingPayoutId === payout.id}
                              className="bg-blue-600 hover:bg-blue-700 text-white type-xs font-bold px-3 py-1.5 rounded transition-colors disabled:opacity-50"
                            >
                              {disbursingPayoutId === payout.id ? "Disbursing..." : "Disburse payout"}
                            </button>
                          ) : payout && payout.status === "paid" ? (
                            <span className="type-xs font-mono text-emerald-700 font-semibold">
                              Paid (#{payout.reference_id})
                            </span>
                          ) : isWatch ? (
                            <span className="type-xs font-mono text-amber-800">
                              SMS Advisory Sent
                            </span>
                          ) : (
                            <span className="type-xs text-slate-400">No action required</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

      </main>

      {/* Footer */}
      <footer className="py-4 text-center type-xs text-slate-400 border-t border-slate-200 bg-white">
        AgriSense AI — Agriculture Officer Verification Console
      </footer>
    </div>
  );
}
