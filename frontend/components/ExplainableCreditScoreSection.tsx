"use client";

import { useState, useEffect } from "react";
import {
  ShieldCheck, Share2, Check, Satellite, Leaf, Truck,
  ClipboardCheck, ChevronDown, ChevronUp, Plus, Upload, X
} from "lucide-react";
import { translations, Language } from "@/lib/i18n";
import { apiFetch } from "@/lib/api";

// ─── Types ───────────────────────────────────────────────────────────────────

interface CreditFactor {
  key: string;
  name: string;
  value: number | null;
  base_weight: number;
  renormalized_weight: number;
  available: boolean;
  reason: string;
  action?: string;
}

interface CreditScoreData {
  farmer_id: number;
  score: number | null;
  band: string;
  data_completeness: number;
  factors: CreditFactor[];
  improvements: string[];
}

interface DeliveryRecord {
  id: number | null;
  delivery_date: string;
  crop_name: string;
  quantity_promised_kg: number;
  quantity_delivered_kg: number;
  on_time: string;
  buyer_name: string | null;
}

interface Props {
  lang: Language;
  farmerId?: number;
}

// ─── Factor icons & colors ────────────────────────────────────────────────────

const FACTOR_META: Record<string, { icon: React.ReactNode; color: string; barColor: string }> = {
  satellite_productivity: {
    icon: <Satellite className="w-4 h-4" />,
    color: "text-violet-700",
    barColor: "bg-violet-500",
  },
  soil_health: {
    icon: <Leaf className="w-4 h-4" />,
    color: "text-emerald-700",
    barColor: "bg-emerald-500",
  },
  supply_chain: {
    icon: <Truck className="w-4 h-4" />,
    color: "text-sky-700",
    barColor: "bg-sky-500",
  },
  insurance_payment: {
    icon: <ClipboardCheck className="w-4 h-4" />,
    color: "text-amber-700",
    barColor: "bg-amber-500",
  },
};

function factorBarColor(factor: CreditFactor): string {
  const meta = FACTOR_META[factor.key];
  if (!factor.available) return "bg-slate-200";
  return meta?.barColor ?? "bg-slate-400";
}

// ─── Band display ─────────────────────────────────────────────────────────────

const BAND_STYLES: Record<string, string> = {
  Strong: "bg-emerald-50 text-emerald-800 border-emerald-300",
  Good: "bg-sky-50 text-sky-800 border-sky-300",
  Building: "bg-amber-50 text-amber-800 border-amber-300",
  "Needs support": "bg-red-50 text-red-800 border-red-300",
  "Not enough data": "bg-slate-100 text-slate-600 border-slate-300",
};

// ─── Demo fallback data ───────────────────────────────────────────────────────

const DEMO_DATA: CreditScoreData = {
  farmer_id: 1,
  score: 78.4,
  band: "Good",
  data_completeness: 0.75,
  factors: [
    {
      key: "satellite_productivity",
      name: "Satellite-verified productivity",
      value: 82.0,
      base_weight: 0.35,
      renormalized_weight: 0.467,
      available: true,
      reason: "3 of last 4 seasons maintained peak NDVI above crop baseline",
      action: "Ensure irrigation and soil health to maintain NDVI above crop baseline across all seasons.",
    },
    {
      key: "soil_health",
      name: "Soil health trajectory",
      value: 68.0,
      base_weight: 0.30,
      renormalized_weight: 0.400,
      available: true,
      reason: "Soil indicators stable across observed seasons",
      action: "Adopt regenerative practices (composting, cover crops) to improve soil health trend.",
    },
    {
      key: "supply_chain",
      name: "Supply chain reliability",
      value: null,
      base_weight: 0.25,
      renormalized_weight: 0.0,
      available: false,
      reason: "No cooperative delivery records registered yet",
      action: "Register delivery records with a cooperative or FPC to build your supply chain score.",
    },
    {
      key: "insurance_payment",
      name: "Insurance & payment record",
      value: 88.0,
      base_weight: 0.10,
      renormalized_weight: 0.133,
      available: true,
      reason: "Clean claim history; PMFBY enrolled",
      action: "Maintain clean claim filing and enroll in PMFBY / AFII continuously.",
    },
  ],
  improvements: [
    "Register delivery records with a cooperative or FPC to build your supply chain score.",
    "Adopt regenerative practices (composting, cover crops) to improve soil health trend.",
    "Ensure irrigation and soil health to maintain NDVI above crop baseline across all seasons.",
  ],
};

// ─────────────────────────────────────────────────────────────────────────────
// Main Component
// ─────────────────────────────────────────────────────────────────────────────

export default function ExplainableCreditScoreSection({ lang, farmerId = 1 }: Props) {
  const t = translations[lang] || translations.en;
  const [data, setData] = useState<CreditScoreData | null>(null);
  const [loading, setLoading] = useState(true);
  const [showDpdpModal, setShowDpdpModal] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);
  const [showDeliveries, setShowDeliveries] = useState(false);
  const [deliveries, setDeliveries] = useState<DeliveryRecord[]>([]);
  const [showAddDelivery, setShowAddDelivery] = useState(false);
  const [newDelivery, setNewDelivery] = useState({
    delivery_date: "",
    crop_name: "",
    quantity_promised_kg: "",
    quantity_delivered_kg: "",
    on_time: "yes",
    buyer_name: "",
  });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetchCreditScore();
    fetchDeliveries();
  }, [farmerId]);

  async function fetchCreditScore() {
    setLoading(true);
    try {
      const res = await apiFetch(`/credit/score?farmer_id=${farmerId}`);
      if (res.ok) {
        setData(await res.json());
      } else {
        setData(DEMO_DATA);
      }
    } catch {
      setData(DEMO_DATA);
    } finally {
      setLoading(false);
    }
  }

  async function fetchDeliveries() {
    try {
      const res = await apiFetch(`/credit/cooperative/deliveries?farmer_id=${farmerId}`);
      if (res.ok) {
        setDeliveries(await res.json());
      }
    } catch {
      // silently use empty
    }
  }

  async function handleAddDelivery(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      const res = await apiFetch("/credit/cooperative/deliveries", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          farmer_id: farmerId,
          delivery_date: newDelivery.delivery_date,
          crop_name: newDelivery.crop_name,
          quantity_promised_kg: parseFloat(newDelivery.quantity_promised_kg),
          quantity_delivered_kg: parseFloat(newDelivery.quantity_delivered_kg),
          on_time: newDelivery.on_time,
          buyer_name: newDelivery.buyer_name || null,
        }),
      });
      if (res.ok) {
        setShowAddDelivery(false);
        setNewDelivery({
          delivery_date: "", crop_name: "", quantity_promised_kg: "",
          quantity_delivered_kg: "", on_time: "yes", buyer_name: "",
        });
        await fetchDeliveries();
        await fetchCreditScore(); // refresh score after new delivery
      }
    } finally {
      setSaving(false);
    }
  }

  async function handleGrantConsentAndCopy() {
    try {
      // Create a bank-link token via API
      const res = await apiFetch(`/credit/bank-link?farmer_id=${farmerId}`, { method: "POST" });
      let link = `${window.location.origin}/credit/bank-view?farmer_id=${farmerId}&token=DPDP-${Date.now()}`;
      if (res.ok) {
        const json = await res.json();
        link = `${window.location.origin}${json.bank_view_url}`;
      }
      navigator.clipboard.writeText(link).catch(() => {});
      setCopiedLink(true);
      setTimeout(() => {
        setCopiedLink(false);
        setShowDpdpModal(false);
      }, 2500);
    } catch {
      setCopiedLink(true);
      setTimeout(() => {
        setCopiedLink(false);
        setShowDpdpModal(false);
      }, 2500);
    }
  }

  // ── Loading skeleton ────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="pt-6 border-t border-slate-200 space-y-4 animate-pulse">
        <div className="h-6 bg-slate-200 rounded w-1/3" />
        <div className="h-32 bg-slate-100 rounded-xl" />
      </div>
    );
  }

  const score = data?.score;
  const band = data?.band || "Not enough data";
  const completeness = Math.round((data?.data_completeness || 0) * 100);

  // Score ring gauge color
  const ringColor =
    band === "Strong" ? "#059669" :
    band === "Good" ? "#0284c7" :
    band === "Building" ? "#d97706" :
    band === "Needs support" ? "#dc2626" : "#94a3b8";

  return (
    <section id="alternative-credit-score" className="pt-6 border-t border-slate-200 space-y-5">

      {/* ── Header row ─────────────────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
        <div className="space-y-0.5">
          <h2 className="type-xl font-bold text-slate-900 flex items-center gap-2">
            {t.credit_score_title}
            <span className="type-xs font-mono bg-slate-100 text-slate-500 px-2 py-0.5 rounded border border-slate-200">
              0-100
            </span>
          </h2>
          <p className="type-xs text-slate-500">{t.credit_score_subtitle}</p>
        </div>
        <button
          onClick={() => setShowDpdpModal(true)}
          className="inline-flex items-center gap-2 bg-white border border-slate-300 text-slate-800 hover:bg-slate-50 type-xs font-semibold px-4 py-2 rounded-lg transition shadow-sm self-start"
        >
          <Share2 className="w-4 h-4 text-emerald-700 shrink-0" />
          {t.credit_share_button}
        </button>
      </div>

      {/* ── Score card ─────────────────────────────────────────────────────── */}
      <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-5">

        {/* Score + band + completeness */}
        <div className="flex flex-wrap items-center gap-6 pb-4 border-b border-slate-100">
          {/* Circular score gauge */}
          <div className="relative shrink-0">
            <svg width="80" height="80" viewBox="0 0 80 80">
              <circle cx="40" cy="40" r="34" fill="none" stroke="#e2e8f0" strokeWidth="7" />
              <circle
                cx="40" cy="40" r="34"
                fill="none"
                stroke={ringColor}
                strokeWidth="7"
                strokeDasharray={`${2 * Math.PI * 34}`}
                strokeDashoffset={`${2 * Math.PI * 34 * (1 - (score ?? 0) / 100)}`}
                strokeLinecap="round"
                transform="rotate(-90 40 40)"
                style={{ transition: "stroke-dashoffset 0.6s ease" }}
              />
              <text x="40" y="37" textAnchor="middle" className="font-mono" fill="#0f172a" fontSize="15" fontWeight="800">
                {typeof score === "number" ? Math.round(score) : "—"}
              </text>
              <text x="40" y="52" textAnchor="middle" fill="#94a3b8" fontSize="9">
                / 100
              </text>
            </svg>
          </div>

          <div className="space-y-2 flex-1 min-w-0">
            <span className={`inline-block px-3 py-1 text-xs font-bold rounded-full border ${BAND_STYLES[band] || BAND_STYLES["Not enough data"]}`}>
              {band === "Not enough data" ? t.credit_not_enough_data : band}
            </span>
            {/* Completeness bar */}
            <div className="flex items-center gap-2">
              <span className="type-xs text-slate-500 shrink-0">{t.credit_completeness}</span>
              <div className="flex-1 bg-slate-100 h-2 rounded-full overflow-hidden max-w-40">
                <div
                  className="bg-emerald-500 h-full rounded-full transition-all"
                  style={{ width: `${completeness}%` }}
                />
              </div>
              <span className="type-xs font-mono font-semibold text-slate-700">{completeness}%</span>
            </div>
          </div>
        </div>

        {/* ── Factor breakdown ─────────────────────────────────────────────── */}
        <div className="space-y-3">
          {data?.factors.map((factor) => {
            const meta = FACTOR_META[factor.key];
            const val = factor.available && factor.value !== null ? factor.value : 0;
            const weightPct = factor.available
              ? `${(factor.renormalized_weight * 100).toFixed(0)}%`
              : `base ${Math.round(factor.base_weight * 100)}%`;

            return (
              <div
                key={factor.key}
                className={`rounded-lg border p-3 space-y-1.5 ${
                  factor.available ? "bg-white border-slate-200" : "bg-slate-50 border-slate-200 opacity-70"
                }`}
              >
                {/* Factor header */}
                <div className="flex items-center justify-between gap-2 text-xs">
                  <div className="flex items-center gap-2">
                    <span className={`shrink-0 ${meta?.color ?? "text-slate-500"}`}>
                      {meta?.icon}
                    </span>
                    <span className="font-semibold text-slate-900">{factor.name}</span>
                    <span className="font-mono text-slate-400 bg-slate-100 px-1.5 py-px rounded border border-slate-200 text-[10px]">
                      {weightPct}
                    </span>
                  </div>
                  <span className="font-mono font-bold text-slate-800 shrink-0">
                    {factor.available && factor.value !== null
                      ? `${factor.value.toFixed(1)} / 100`
                      : <span className="text-slate-400 font-sans font-normal italic text-[11px]">Pending</span>}
                  </span>
                </div>

                {/* Progress bar */}
                <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all ${factorBarColor(factor)}`}
                    style={{ width: `${factor.available ? val : 0}%` }}
                  />
                </div>

                {/* Plain language reason */}
                <p className="type-xs text-slate-500 leading-snug">{factor.reason}</p>
              </div>
            );
          })}
        </div>

        {/* ── How to improve ───────────────────────────────────────────────── */}
        {data?.improvements && data.improvements.length > 0 && (
          <div className="pt-3 border-t border-slate-100 space-y-2">
            <h4 className="type-xs font-semibold text-slate-800 flex items-center gap-1.5">
              <ShieldCheck className="w-4 h-4 text-emerald-700" />
              {t.credit_improve_title}
            </h4>
            <ul className="space-y-1 pl-5 list-disc type-xs text-slate-600 leading-relaxed">
              {data.improvements.map((action, i) => (
                <li key={i} className="marker:text-emerald-600">{action}</li>
              ))}
            </ul>
          </div>
        )}
      </div>

      {/* ── Supply chain delivery records ────────────────────────────────────── */}
      <div className="border border-slate-200 rounded-xl overflow-hidden">
        <button
          onClick={() => setShowDeliveries(!showDeliveries)}
          className="w-full flex items-center justify-between px-4 py-3 bg-slate-50 hover:bg-slate-100 transition text-left"
        >
          <div className="flex items-center gap-2">
            <Truck className="w-4 h-4 text-sky-600" />
            <span className="type-sm font-semibold text-slate-800">
              {t.supply_chain_records} ({deliveries.length})
            </span>
          </div>
          {showDeliveries ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
        </button>

        {showDeliveries && (
          <div className="bg-white divide-y divide-slate-100">
            {/* Add entry button */}
            <div className="px-4 py-2 flex items-center justify-between">
              <span className="type-xs text-slate-500">{t.supply_chain_subtitle}</span>
              <button
                onClick={() => setShowAddDelivery(true)}
                className="inline-flex items-center gap-1.5 bg-sky-600 hover:bg-sky-700 text-white type-xs font-semibold px-3 py-1.5 rounded-lg transition"
              >
                <Plus className="w-3.5 h-3.5" />
                {t.supply_add_entry}
              </button>
            </div>

            {/* Add delivery inline form */}
            {showAddDelivery && (
              <form onSubmit={handleAddDelivery} className="p-4 bg-sky-50 space-y-3 border-t border-sky-100">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="type-xs text-slate-600 font-medium block mb-1">Date</label>
                    <input
                      type="date"
                      required
                      value={newDelivery.delivery_date}
                      onChange={e => setNewDelivery(p => ({ ...p, delivery_date: e.target.value }))}
                      className="w-full border border-slate-300 rounded-lg px-3 py-1.5 type-xs focus:ring-2 focus:ring-sky-400 outline-none"
                    />
                  </div>
                  <div>
                    <label className="type-xs text-slate-600 font-medium block mb-1">Crop</label>
                    <input
                      type="text"
                      required
                      placeholder="Rice, Wheat…"
                      value={newDelivery.crop_name}
                      onChange={e => setNewDelivery(p => ({ ...p, crop_name: e.target.value }))}
                      className="w-full border border-slate-300 rounded-lg px-3 py-1.5 type-xs focus:ring-2 focus:ring-sky-400 outline-none"
                    />
                  </div>
                  <div>
                    <label className="type-xs text-slate-600 font-medium block mb-1">Promised (kg)</label>
                    <input
                      type="number" min="0" step="0.1" required
                      value={newDelivery.quantity_promised_kg}
                      onChange={e => setNewDelivery(p => ({ ...p, quantity_promised_kg: e.target.value }))}
                      className="w-full border border-slate-300 rounded-lg px-3 py-1.5 type-xs focus:ring-2 focus:ring-sky-400 outline-none"
                    />
                  </div>
                  <div>
                    <label className="type-xs text-slate-600 font-medium block mb-1">Delivered (kg)</label>
                    <input
                      type="number" min="0" step="0.1" required
                      value={newDelivery.quantity_delivered_kg}
                      onChange={e => setNewDelivery(p => ({ ...p, quantity_delivered_kg: e.target.value }))}
                      className="w-full border border-slate-300 rounded-lg px-3 py-1.5 type-xs focus:ring-2 focus:ring-sky-400 outline-none"
                    />
                  </div>
                  <div>
                    <label className="type-xs text-slate-600 font-medium block mb-1">On time?</label>
                    <select
                      value={newDelivery.on_time}
                      onChange={e => setNewDelivery(p => ({ ...p, on_time: e.target.value }))}
                      className="w-full border border-slate-300 rounded-lg px-3 py-1.5 type-xs focus:ring-2 focus:ring-sky-400 outline-none"
                    >
                      <option value="yes">Yes</option>
                      <option value="partial">Partial</option>
                      <option value="no">No</option>
                    </select>
                  </div>
                  <div>
                    <label className="type-xs text-slate-600 font-medium block mb-1">Buyer / FPC</label>
                    <input
                      type="text"
                      placeholder="Optional"
                      value={newDelivery.buyer_name}
                      onChange={e => setNewDelivery(p => ({ ...p, buyer_name: e.target.value }))}
                      className="w-full border border-slate-300 rounded-lg px-3 py-1.5 type-xs focus:ring-2 focus:ring-sky-400 outline-none"
                    />
                  </div>
                </div>
                <div className="flex gap-2">
                  <button
                    type="submit"
                    disabled={saving}
                    className="bg-sky-600 hover:bg-sky-700 text-white type-xs font-semibold px-4 py-2 rounded-lg transition"
                  >
                    {saving ? "Saving…" : "Save delivery"}
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowAddDelivery(false)}
                    className="bg-white border border-slate-300 text-slate-700 type-xs font-semibold px-4 py-2 rounded-lg"
                  >
                    Cancel
                  </button>
                </div>
              </form>
            )}

            {/* Delivery list */}
            {deliveries.length === 0 ? (
              <p className="px-4 py-6 type-xs text-slate-400 text-center">
                No delivery records yet. Add the first entry above.
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full type-xs text-left">
                  <thead className="bg-slate-50 border-b border-slate-100">
                    <tr>
                      <th className="px-4 py-2 font-semibold text-slate-500">Date</th>
                      <th className="px-4 py-2 font-semibold text-slate-500">Crop</th>
                      <th className="px-4 py-2 font-semibold text-slate-500 text-right">Promised</th>
                      <th className="px-4 py-2 font-semibold text-slate-500 text-right">Delivered</th>
                      <th className="px-4 py-2 font-semibold text-slate-500">On time</th>
                      <th className="px-4 py-2 font-semibold text-slate-500">Buyer</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    {deliveries.map((d, i) => {
                      const rate = d.quantity_promised_kg > 0
                        ? Math.round((d.quantity_delivered_kg / d.quantity_promised_kg) * 100)
                        : 100;
                      return (
                        <tr key={d.id ?? i} className="hover:bg-slate-50/60">
                          <td className="px-4 py-2 font-mono text-slate-700">{d.delivery_date}</td>
                          <td className="px-4 py-2 text-slate-800 font-medium">{d.crop_name}</td>
                          <td className="px-4 py-2 text-right font-mono text-slate-600">{d.quantity_promised_kg.toFixed(0)} kg</td>
                          <td className="px-4 py-2 text-right font-mono font-semibold text-slate-800">
                            {d.quantity_delivered_kg.toFixed(0)} kg
                            <span className={`ml-1 text-[10px] font-sans ${rate >= 95 ? "text-emerald-600" : rate >= 80 ? "text-amber-600" : "text-red-600"}`}>
                              ({rate}%)
                            </span>
                          </td>
                          <td className="px-4 py-2">
                            <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold uppercase ${
                              d.on_time === "yes" ? "bg-emerald-50 text-emerald-700" :
                              d.on_time === "partial" ? "bg-amber-50 text-amber-700" :
                              "bg-red-50 text-red-700"
                            }`}>
                              {d.on_time}
                            </span>
                          </td>
                          <td className="px-4 py-2 text-slate-500">{d.buyer_name ?? "—"}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </div>

      {/* ── DPDP Consent Modal ─────────────────────────────────────────────── */}
      {showDpdpModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-xl max-w-lg w-full p-6 space-y-5 border border-slate-200 shadow-2xl">
            <div className="flex justify-between items-start border-b border-slate-100 pb-3">
              <div>
                <h3 className="type-base font-bold text-slate-900">{t.dpdp_modal_title}</h3>
                <p className="type-xs text-slate-500 mt-0.5">Explicit digital consent · DPDP Act 2023</p>
              </div>
              <button onClick={() => setShowDpdpModal(false)} className="text-slate-400 hover:text-slate-700 p-1 rounded">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-4 space-y-2">
              <div className="flex items-center gap-2 text-emerald-800 font-semibold type-xs">
                <ShieldCheck className="w-4 h-4 shrink-0" />
                Fairness & privacy assurance
              </div>
              <p className="type-xs text-slate-700 leading-relaxed">{t.dpdp_consent_notice}</p>
            </div>

            <div className="bg-slate-50 border border-slate-200 rounded-lg p-3 space-y-1">
              <p className="type-xs font-semibold text-slate-700">What the bank sees:</p>
              <ul className="type-xs text-slate-600 space-y-0.5 pl-4 list-disc">
                <li>Your credit score (0–100) and band</li>
                <li>Factor names and plain-language reasons</li>
                <li>No raw farm data, GPS coordinates, or personal details</li>
              </ul>
            </div>

            {copiedLink && (
              <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 px-3 py-2 rounded-lg type-xs flex items-center gap-2">
                <Check className="w-4 h-4" />
                {t.dpdp_link_copied}
              </div>
            )}

            <div className="flex gap-3 pt-1">
              <button
                onClick={handleGrantConsentAndCopy}
                disabled={copiedLink}
                className="flex-1 bg-emerald-700 hover:bg-emerald-800 disabled:opacity-70 text-white type-xs font-bold py-3 rounded-lg transition flex items-center justify-center gap-2"
              >
                <Share2 className="w-4 h-4" />
                {t.dpdp_grant_button}
              </button>
              <button
                onClick={() => setShowDpdpModal(false)}
                className="bg-white border border-slate-300 text-slate-700 type-xs font-semibold px-5 py-3 rounded-lg hover:bg-slate-50 transition"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
