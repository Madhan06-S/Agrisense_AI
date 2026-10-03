"use client";

import { useEffect, useState } from "react";
import { 
  AlertTriangle, 
  RefreshCw, 
  Zap, 
  Sparkles,
  Bell
} from "lucide-react";

interface AFIIZone {
  id: number;
  name: string;
  state: string;
  district: string;
  num_households: number;
  livestock_count: number;
  area_hectares?: number;
  vci_score: number;
  ndvi_current: number;
  vci_status: "normal" | "watch" | "triggered" | string;
  survival_baseline_vci: number;
  dm_available_kg_ha?: number;
  dm_required_kg_ha?: number;
  vci_breach?: boolean;
  dm_shortfall_breach?: boolean;
  days_to_breach?: number | null;
  status_reason?: string;
  sum_insured_per_household: number;
  active_payout?: {
    id: number;
    status: string;
    total_payout: number;
    vci_at_trigger: number;
    reference_id: string;
    trigger_date: string;
  } | null;
}

export default function AFIIPastoralInsurance() {
  const [zones, setZones] = useState<AFIIZone[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<Record<number, boolean>>({});
  const [injectingTest, setInjectingTest] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    fetchAFIIZones();
  }, []);

  async function fetchAFIIZones() {
    setLoading(true);
    try {
      const res = await fetch("/api/v1/afii/zones");
      if (res.ok) {
        const data = await res.json();
        setZones(data);
      }
    } catch (e) {
      console.warn("Failed to load AFII zones:", e);
    } finally {
      setLoading(false);
    }
  }

  async function handleScanZone(zoneId: number) {
    setActionLoading(prev => ({ ...prev, [zoneId]: true }));
    try {
      const res = await fetch(`/api/v1/afii/zones/${zoneId}/scan`, { method: "POST" });
      if (res.ok) {
        await fetchAFIIZones();
      }
    } catch (e) {
      console.error("Zone scan failed:", e);
    } finally {
      setActionLoading(prev => ({ ...prev, [zoneId]: false }));
    }
  }

  async function handleInjectLowVCITest(zoneId: number) {
    setInjectingTest(true);
    setMessage("");
    try {
      const res = await fetch("/api/v1/afii/test-inject-vci", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ zone_id: zoneId, vci_score: 28.0 })
      });
      if (res.ok) {
        const data = await res.json();
        setMessage(`🚨 Low VCI (28.0%) injected into Zone #${zoneId}. Parametric forage payout auto-triggered!`);
        await fetchAFIIZones();
      }
    } catch (e) {
      console.error("Test VCI injection failed:", e);
    } finally {
      setInjectingTest(false);
    }
  }

  const getVciBadge = (score: number, status?: string) => {
    if (score < 35 || status === "triggered") {
      return { label: "CRITICAL (Payout Triggered)", color: "bg-red-100 text-red-800 border-red-300", dot: "bg-red-600" };
    }
    if (status === "watch" || (score >= 35 && score <= 45)) {
      return { label: "Watch (Pre-alert Active)", color: "bg-amber-100 text-amber-800 border-amber-300", dot: "bg-amber-600" };
    }
    return { label: "Normal (Healthy Forage)", color: "bg-green-100 text-[#1B5E20] border-green-300", dot: "bg-green-600" };
  };

  if (loading) {
    return (
      <div className="bg-white border border-[#E5EBE3] rounded-xl p-6 space-y-3">
        <div className="h-6 w-48 bg-slate-100 rounded animate-pulse" />
        <div className="h-24 bg-slate-100 rounded animate-pulse" />
      </div>
    );
  }

  return (
    <div className="bg-white border border-[#E5EBE3] rounded-xl p-6 text-[#374151] shadow-[0_2px_8px_rgba(0,0,0,0.04)] space-y-5">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-[#EEF2EE] pb-4 gap-3">
        <div className="flex items-center gap-2.5">
          <span className="text-2xl">🐪</span>
          <div>
            <h2 className="text-lg font-extrabold text-[#1B5E20]">AREA-BASED FORAGE INDEX INSURANCE (AFII)</h2>
            <p className="text-xs text-[#5B6B5B]">Pay Before Livestock Starve — Parametric VCI & Biomass Dual-Trigger Protection</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-[10px] font-mono bg-[#E8F5E9] text-[#1B5E20] px-2.5 py-1 rounded-full border border-[#2E7D32]/20 font-bold flex items-center gap-1">
            <Zap className="w-3 h-3 text-[#1B5E20]" />
            PARAMETRIC DUAL-TRIGGER
          </span>
          <button
            onClick={fetchAFIIZones}
            className="p-1.5 hover:bg-[#F7F9F5] border border-[#E5EBE3] rounded-md text-[#1B5E20]"
            title="Refresh AFII Data"
          >
            <RefreshCw className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {message && (
        <div className="p-3 bg-red-50 border border-red-300 rounded-md text-xs text-red-800 font-medium flex items-center justify-between">
          <span>{message}</span>
          <button onClick={() => setMessage("")} className="text-red-600 font-bold ml-2">✕</button>
        </div>
      )}

      {/* Pastoral Grazing Zones Grid */}
      <div className="space-y-4">
        {zones.map((zone) => {
          const badge = getVciBadge(zone.vci_score, zone.vci_status);
          const hasTriggeredPayout = zone.active_payout !== null && zone.active_payout !== undefined;
          const isWatch = zone.vci_status === "watch";

          return (
            <div 
              key={zone.id} 
              className={`p-4 rounded-xl border transition-all ${
                zone.vci_score < 35 || hasTriggeredPayout ? "bg-red-50/50 border-red-300" : isWatch ? "bg-amber-50/50 border-amber-300" : "bg-[#F7F9F5] border-[#E5EBE3]"
              }`}
            >
              {/* Zone Title & Badge */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-3">
                <div>
                  <h3 className="text-sm font-bold text-[#1B5E20]">{zone.name}</h3>
                  <p className="text-xs text-[#5B6B5B]">
                    {zone.district}, {zone.state} • {zone.num_households} Households • {zone.livestock_count} Livestock ({zone.area_hectares ?? 100} ha)
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold border ${badge.color}`}>
                    <span className={`w-2 h-2 rounded-full ${badge.dot}`} />
                    VCI: {zone.vci_score}% ({badge.label})
                  </span>
                </div>
              </div>

              {/* VCI, Biomass DM & Baseline Metrics Grid */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs mb-3">
                <div className="bg-white p-2.5 rounded-lg border border-[#E5EBE3]">
                  <span className="text-[#6B7280] text-[11px] block">Current VCI Score</span>
                  <span className="font-extrabold text-sm text-[#1B5E20]">{zone.vci_score}%</span>
                  <span className="text-[10px] text-[#6B7280]">Baseline: 35.0%</span>
                </div>
                <div className="bg-white p-2.5 rounded-lg border border-[#E5EBE3]">
                  <span className="text-[#6B7280] text-[11px] block">DM Available vs Req.</span>
                  <span className={`font-extrabold text-sm ${zone.dm_shortfall_breach ? "text-red-700" : "text-[#1B5E20]"}`}>
                    {(zone.dm_available_kg_ha ?? 0).toFixed(0)} <span className="text-xs font-normal text-[#6B7280]">/ {(zone.dm_required_kg_ha ?? 0).toFixed(0)} kg DM/ha</span>
                  </span>
                  <span className="text-[10px] text-[#6B7280] block">6.25 kg DM/TLU/day</span>
                </div>
                <div className="bg-white p-2.5 rounded-lg border border-[#E5EBE3]">
                  <span className="text-[#6B7280] text-[11px] block">Trend & Breach Projection</span>
                  <span className={`font-extrabold text-sm ${zone.days_to_breach !== null && zone.days_to_breach !== undefined && zone.days_to_breach <= 30 ? "text-amber-800" : "text-[#374151]"}`}>
                    {zone.days_to_breach !== null && zone.days_to_breach !== undefined ? `${zone.days_to_breach.toFixed(0)} Days` : "Stable (>60d)"}
                  </span>
                  <span className="text-[10px] text-[#6B7280] block">4-6 acquisition trend</span>
                </div>
                <div className="bg-white p-2.5 rounded-lg border border-[#E5EBE3]">
                  <span className="text-[#6B7280] text-[11px] block">Cover / Household</span>
                  <span className="font-extrabold text-sm text-[#1B5E20]">₹{zone.sum_insured_per_household.toLocaleString()}</span>
                  <span className="text-[10px] text-[#6B7280] block">Total: ₹{(zone.sum_insured_per_household * zone.num_households).toLocaleString()}</span>
                </div>
              </div>

              {/* Watch Early Warning Pre-Alert Banner */}
              {isWatch && !hasTriggeredPayout && (
                <div className="mb-3 p-3 bg-amber-100 border border-amber-300 rounded-lg text-xs space-y-1">
                  <div className="flex items-center justify-between font-bold text-amber-900">
                    <span className="flex items-center gap-1.5">
                      <Bell className="w-4 h-4 text-amber-700" />
                      ⚠️ EARLY WARNING: WATCH STATE (PROJECTED BREACH IN {zone.days_to_breach?.toFixed(0) ?? 30} DAYS)
                    </span>
                    <span className="text-[10px] bg-amber-200 text-amber-900 px-2 py-0.5 rounded font-mono uppercase">
                      SMS Advisory Dispatched
                    </span>
                  </div>
                  <p className="text-amber-800 leading-relaxed font-medium">
                    Pre-alert dispatched to agricultural officers and SMS advisory sent to {zone.num_households} pastoralist households. No financial payout is triggered during Watch state.
                  </p>
                </div>
              )}

              {/* Active Payout Banner if Triggered */}
              {hasTriggeredPayout && (
                <div className="mb-3 p-3 bg-red-100 border border-red-300 rounded-lg text-xs space-y-1.5">
                  <div className="flex items-center justify-between font-bold text-red-900">
                    <span className="flex items-center gap-1.5">
                      <AlertTriangle className="w-4 h-4 text-red-700" />
                      🚨 AUTOMATIC FORAGE PAYOUT TRIGGERED
                    </span>
                    <span className="text-[10px] bg-red-200 text-red-900 px-2 py-0.5 rounded font-mono">
                      REF: {zone.active_payout?.reference_id}
                    </span>
                  </div>
                  <p className="text-red-800 leading-relaxed font-medium">
                    Breach detected: VCI <span className="font-bold">{zone.active_payout?.vci_at_trigger}%</span> (or forage DM shortfall). Parametric payout of <span className="font-bold">₹{zone.active_payout?.total_payout.toLocaleString()}</span> generated for {zone.num_households} pastoralist households.
                  </p>
                  <div className="flex items-center justify-between pt-1 border-t border-red-200 text-[11px] text-red-700">
                    <span>Status: <strong className="uppercase font-mono bg-red-200 px-1.5 py-0.5 rounded text-red-900">{zone.active_payout?.status}</strong></span>
                    <span>Pay before livestock starve — Disbursing via DBT / PFMS.</span>
                  </div>
                </div>
              )}

              {/* Action Buttons */}
              <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-[#EEF2EE]">
                <button
                  onClick={() => handleScanZone(zone.id)}
                  disabled={actionLoading[zone.id]}
                  className="inline-flex items-center gap-1.5 text-xs bg-[#1B5E20] hover:bg-[#2E7D32] text-white px-3 py-1.5 rounded-md font-bold transition disabled:opacity-50"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${actionLoading[zone.id] ? "animate-spin" : ""}`} />
                  Scan Zone VCI Now
                </button>

                {/* Demo Test Injection Button */}
                {process.env.NEXT_PUBLIC_DEMO_MODE === "true" && (
                  <button
                    onClick={() => handleInjectLowVCITest(zone.id)}
                    disabled={injectingTest}
                    className="inline-flex items-center gap-1.5 text-xs bg-amber-100 hover:bg-amber-200 text-amber-900 border border-amber-300 px-3 py-1.5 rounded-md font-bold transition disabled:opacity-50"
                  >
                    <Sparkles className="w-3.5 h-3.5 text-amber-700" />
                    Test Inject Low VCI (28.0% Breach)
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

