"use client";

import { useEffect, useState } from "react";
import { 
  ShieldAlert, 
  CheckCircle, 
  AlertTriangle, 
  Activity, 
  RefreshCw, 
  Zap, 
  Landmark, 
  Users,
  TrendingDown,
  Sparkles
} from "lucide-react";

interface AFIIZone {
  id: number;
  name: string;
  state: string;
  district: string;
  num_households: number;
  livestock_count: number;
  vci_score: number;
  ndvi_current: number;
  vci_status: "normal" | "watch" | "triggered";
  survival_baseline_vci: number;
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

  const getVciBadge = (score: number) => {
    if (score > 50) {
      return { label: "Normal (Healthy Forage)", color: "bg-green-100 text-[#1B5E20] border-green-300", dot: "bg-green-600" };
    }
    if (score >= 35) {
      return { label: "Watch (Moderate Stress)", color: "bg-amber-100 text-amber-800 border-amber-300", dot: "bg-amber-600" };
    }
    return { label: "CRITICAL (Payout Triggered)", color: "bg-red-100 text-red-800 border-red-300", dot: "bg-red-600" };
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
            <p className="text-xs text-[#5B6B5B]">Automated Satellite VCI Index Protection for Livestock & Pastoralists</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-[10px] font-mono bg-[#E8F5E9] text-[#1B5E20] px-2.5 py-1 rounded-full border border-[#2E7D32]/20 font-bold flex items-center gap-1">
            <Zap className="w-3 h-3 text-[#1B5E20]" />
            PARAMETRIC AUTO-TRIGGER
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
          const badge = getVciBadge(zone.vci_score);
          const hasTriggeredPayout = zone.active_payout !== null;

          return (
            <div 
              key={zone.id} 
              className={`p-4 rounded-xl border transition-all ${
                zone.vci_score < 35 ? "bg-red-50/50 border-red-300" : "bg-[#F7F9F5] border-[#E5EBE3]"
              }`}
            >
              {/* Zone Title & Badge */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-3">
                <div>
                  <h3 className="text-sm font-bold text-[#1B5E20]">{zone.name}</h3>
                  <p className="text-xs text-[#5B6B5B]">
                    {zone.district}, {zone.state} • {zone.num_households} Pastoral Households • {zone.livestock_count} Livestock
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold border ${badge.color}`}>
                    <span className={`w-2 h-2 rounded-full ${badge.dot}`} />
                    VCI: {zone.vci_score}% ({badge.label})
                  </span>
                </div>
              </div>

              {/* VCI & Policy Metrics Grid */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs mb-3">
                <div className="bg-white p-2.5 rounded-lg border border-[#E5EBE3]">
                  <span className="text-[#6B7280] text-[11px] block">Current VCI Score</span>
                  <span className="font-extrabold text-sm text-[#1B5E20]">{zone.vci_score}%</span>
                </div>
                <div className="bg-white p-2.5 rounded-lg border border-[#E5EBE3]">
                  <span className="text-[#6B7280] text-[11px] block">Survival Baseline</span>
                  <span className="font-extrabold text-sm text-[#374151]">&le; {zone.survival_baseline_vci}% VCI</span>
                </div>
                <div className="bg-white p-2.5 rounded-lg border border-[#E5EBE3]">
                  <span className="text-[#6B7280] text-[11px] block">Cover / Household</span>
                  <span className="font-extrabold text-sm text-[#1B5E20]">₹{zone.sum_insured_per_household.toLocaleString()}</span>
                </div>
                <div className="bg-white p-2.5 rounded-lg border border-[#E5EBE3]">
                  <span className="text-[#6B7280] text-[11px] block">Total Zone Cover</span>
                  <span className="font-extrabold text-sm text-[#1B5E20]">₹{(zone.sum_insured_per_household * zone.num_households).toLocaleString()}</span>
                </div>
              </div>

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
                    VCI dropped to <span className="font-bold">{zone.active_payout?.vci_at_trigger}%</span> (breached survival baseline of {zone.survival_baseline_vci}%). Parametric payout of <span className="font-bold">₹{zone.active_payout?.total_payout.toLocaleString()}</span> generated for {zone.num_households} pastoralist households.
                  </p>
                  <div className="flex items-center justify-between pt-1 border-t border-red-200 text-[11px] text-red-700">
                    <span>Status: <strong className="uppercase">{zone.active_payout?.status}</strong></span>
                    <span>No claim filing required. Disbursing via PFMS.</span>
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
                <button
                  onClick={() => handleInjectLowVCITest(zone.id)}
                  disabled={injectingTest}
                  className="inline-flex items-center gap-1.5 text-xs bg-amber-100 hover:bg-amber-200 text-amber-900 border border-amber-300 px-3 py-1.5 rounded-md font-bold transition disabled:opacity-50"
                >
                  <Sparkles className="w-3.5 h-3.5 text-amber-700" />
                  Test Inject Low VCI (28.0% Breach)
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
