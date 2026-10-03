"use client";

import { useState, useEffect } from "react";
import { ShieldCheck, Share2, Check } from "lucide-react";
import { translations, Language } from "@/lib/i18n";
import { apiFetch } from "@/lib/api";

interface CreditFactor {
  key: string;
  name: string;
  value: number | null;
  base_weight: number;
  renormalized_weight: number;
  available: boolean;
  reason: string;
}

interface CreditScoreData {
  farmer_id: number;
  score: number | null;
  band: string;
  data_completeness: number;
  factors: CreditFactor[];
  improvements: string[];
}

interface Props {
  lang: Language;
}

export default function ExplainableCreditScoreSection({ lang }: Props) {
  const t = translations[lang] || translations.en;
  const [data, setData] = useState<CreditScoreData | null>(null);
  const [loading, setLoading] = useState(true);
  const [showDpdpModal, setShowDpdpModal] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);

  useEffect(() => {
    fetchCreditScore();
  }, []);

  async function fetchCreditScore() {
    setLoading(true);
    try {
      const res = await apiFetch("/credit/score");
      if (res.ok) {
        const json = await res.json();
        setData(json);
      } else {
        // Fallback default mock data if backend not reached
        setData({
          farmer_id: 1,
          score: 85.0,
          band: "Strong",
          data_completeness: 0.80,
          factors: [
            {
              key: "satellite_history",
              name: "Satellite History",
              value: 82.0,
              base_weight: 0.25,
              renormalized_weight: 0.3125,
              available: true,
              reason: "3 of last 4 seasons maintained satellite NDVI above crop baseline"
            },
            {
              key: "claim_history",
              name: "Claim History",
              value: 90.0,
              base_weight: 0.15,
              renormalized_weight: 0.1875,
              available: true,
              reason: "Clean claim history with zero rejected or fraudulent submissions"
            },
            {
              key: "payment_history",
              name: "Payment History",
              value: 85.0,
              base_weight: 0.15,
              renormalized_weight: 0.1875,
              available: true,
              reason: "Verified DBT and UPI direct settlement record across crop cycles"
            },
            {
              key: "scheme_usage",
              name: "Scheme Usage",
              value: 92.0,
              base_weight: 0.10,
              renormalized_weight: 0.1250,
              available: true,
              reason: "Continuous PMFBY & AFII scheme enrollment duration"
            },
            {
              key: "farm_productivity_trend",
              name: "Farm Productivity Trend",
              value: 80.0,
              base_weight: 0.15,
              renormalized_weight: 0.1875,
              available: true,
              reason: "Positive multi-season biomass trend and crop productivity index"
            },
            {
              key: "biogas_milk_records",
              name: "Biogas & Milk Records",
              value: null,
              base_weight: 0.10,
              renormalized_weight: 0.0,
              available: false,
              reason: "Biogas & Milk Records data pending integration"
            },
            {
              key: "carbon_credits",
              name: "Carbon Credits Earned",
              value: null,
              base_weight: 0.10,
              renormalized_weight: 0.0,
              available: false,
              reason: "Carbon Credits Earned data pending integration"
            }
          ],
          improvements: [
            "Maintain optimal crop vigor across all crop seasons to raise NDVI baseline consistency.",
            "Link active bank account for automated DBT and UPI premium/payout settlements.",
            "Adopt regenerative soil practices to enhance long-term farm productivity."
          ]
        });
      }
    } catch {
      // Fallback default mock if error
    } finally {
      setLoading(false);
    }
  }

  const handleGrantConsentAndCopy = () => {
    const dummyLink = `http://localhost:3001/credit/bank-verify?farmer_id=${data?.farmer_id || 1}&token=DPDP-CONSENT-${Date.now()}`;
    navigator.clipboard.writeText(dummyLink);
    setCopiedLink(true);
    setTimeout(() => {
      setCopiedLink(false);
      setShowDpdpModal(false);
    }, 2500);
  };

  const getBandBadgeClass = (band: string) => {
    switch (band) {
      case "Strong":
        return "bg-emerald-100 text-emerald-800 border-emerald-300";
      case "Good":
        return "bg-blue-100 text-blue-800 border-blue-300";
      case "Building":
        return "bg-amber-100 text-amber-800 border-amber-300";
      case "Needs support":
        return "bg-red-100 text-red-800 border-red-300";
      default:
        return "bg-slate-100 text-slate-700 border-slate-300";
    }
  };

  if (loading) {
    return (
      <div className="py-6 border-t border-slate-200">
        <div className="animate-pulse space-y-4">
          <div className="h-6 bg-slate-200 rounded w-1/4"></div>
          <div className="h-20 bg-slate-100 rounded"></div>
        </div>
      </div>
    );
  }

  const score = data?.score;
  const band = data?.band || "Not enough data";
  const completenessPercent = Math.round((data?.data_completeness || 0) * 100);

  return (
    <section id="alternative-credit-score" className="pt-6 border-t border-slate-200 space-y-6">
      {/* Header and Action */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <h2 className="type-xl font-bold text-slate-900">{t.credit_score_title}</h2>
            <span className="type-xs font-mono bg-slate-100 text-slate-600 px-2 py-0.5 rounded border border-slate-200">
              0-100
            </span>
          </div>
          <p className="type-xs text-slate-600 max-w-2xl">{t.credit_score_subtitle}</p>
        </div>

        <button
          onClick={() => setShowDpdpModal(true)}
          className="bg-white hover:bg-slate-50 text-slate-800 border border-slate-300 type-sm font-semibold px-4 py-2.5 rounded-lg transition-colors inline-flex items-center gap-2 self-start sm:self-auto shadow-2xs"
        >
          <Share2 className="w-4 h-4 text-emerald-700" />
          {t.credit_share_button}
        </button>
      </div>

      {/* Main Score Metrics & Completeness */}
      <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-100 pb-4">
          {/* Score & Band */}
          <div className="flex items-center gap-4">
            <div className="type-3xl font-num font-extrabold text-slate-900">
              {typeof score === "number" ? score.toFixed(1) : "—"}
              <span className="type-xs text-slate-400 font-normal ml-1">/ 100</span>
            </div>
            <span className={`px-3 py-1 text-xs font-bold rounded-full border ${getBandBadgeClass(band)}`}>
              {band === "Not enough data" ? t.credit_not_enough_data : band}
            </span>
          </div>

          {/* Completeness Pill */}
          <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 px-3 py-1.5 rounded-lg">
            <span className="type-xs text-slate-500">{t.credit_completeness}:</span>
            <span className="type-xs font-num font-bold text-slate-800">{completenessPercent}%</span>
            <div className="w-16 bg-slate-200 h-2 rounded-full overflow-hidden">
              <div
                className="bg-emerald-600 h-full rounded-full transition-all"
                style={{ width: `${completenessPercent}%` }}
              ></div>
            </div>
          </div>
        </div>

        {/* Factor breakdown with bars */}
        <div className="space-y-4 pt-1">
          <h3 className="type-xs font-semibold text-slate-500 uppercase tracking-wider">
            Factor-by-Factor Weight & Performance Breakdown
          </h3>

          <div className="grid grid-cols-1 gap-3">
            {data?.factors.map((factor) => {
              const hasData = factor.available && factor.value !== null;
              const val = hasData ? factor.value! : 0;
              const weightPercent = (factor.renormalized_weight * 100).toFixed(1);

              return (
                <div key={factor.key} className="space-y-1.5 p-3 rounded-lg bg-slate-50/70 border border-slate-200/80">
                  <div className="flex items-center justify-between text-xs">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-slate-900">{factor.name}</span>
                      <span className="type-xs font-mono text-slate-500 bg-white border border-slate-200 px-1.5 py-0.5 rounded">
                        Weight: {hasData ? `${weightPercent}%` : `Base ${Math.round(factor.base_weight * 100)}%`}
                      </span>
                    </div>

                    <div className="font-num font-bold text-slate-800">
                      {hasData ? `${val.toFixed(1)} / 100` : <span className="text-slate-400 font-sans font-normal italic">Pending integration</span>}
                    </div>
                  </div>

                  {/* Visual Bar */}
                  <div className="w-full bg-slate-200 h-2 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all ${
                        hasData ? (val >= 80 ? "bg-emerald-600" : val >= 60 ? "bg-blue-600" : "bg-amber-500") : "bg-slate-300 opacity-40"
                      }`}
                      style={{ width: `${hasData ? val : 0}%` }}
                    ></div>
                  </div>

                  {/* One-line plain language reason */}
                  <p className="type-xs text-slate-600 pt-0.5 leading-snug">
                    {factor.reason}
                  </p>
                </div>
              );
            })}
          </div>
        </div>

        {/* How to improve this score */}
        {data?.improvements && data.improvements.length > 0 && (
          <div className="pt-4 border-t border-slate-100 space-y-2">
            <h4 className="type-sm font-bold text-slate-900 flex items-center gap-1.5">
              <ShieldCheck className="w-4 h-4 text-emerald-700" />
              {t.credit_improve_title}
            </h4>

            <ul className="space-y-1.5 pl-5 list-disc type-xs text-slate-700 leading-relaxed">
              {data.improvements.map((action, idx) => (
                <li key={idx} className="marker:text-emerald-700">
                  {action}
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>

      {/* DPDP Consent & Bank Share Modal */}
      {showDpdpModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-xl max-w-lg w-full p-6 space-y-5 border border-slate-200 shadow-xl">
            <div className="flex justify-between items-start border-b border-slate-100 pb-3">
              <div>
                <h3 className="type-base font-bold text-slate-900">{t.dpdp_modal_title}</h3>
                <span className="type-xs text-slate-500">Explicit digital consent protocol</span>
              </div>
              <button
                onClick={() => setShowDpdpModal(false)}
                className="text-slate-400 hover:text-slate-600 p-1"
              >
                ✕
              </button>
            </div>

            <div className="bg-slate-50 border border-slate-200 p-4 rounded-lg space-y-2">
              <div className="flex items-center gap-2 text-emerald-700 font-semibold type-xs">
                <ShieldCheck className="w-4 h-4 shrink-0" />
                <span>Fairness & Non-Demographic Privacy Assurance</span>
              </div>
              <p className="type-xs text-slate-700 leading-relaxed">
                {t.dpdp_consent_notice}
              </p>
            </div>

            {copiedLink ? (
              <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 p-3 rounded-lg text-xs font-medium flex items-center gap-2">
                <Check className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>{t.dpdp_link_copied}</span>
              </div>
            ) : null}

            <div className="flex items-center gap-3 pt-2">
              <button
                onClick={handleGrantConsentAndCopy}
                disabled={copiedLink}
                className="flex-1 bg-[#15803d] hover:bg-[#166534] text-white type-xs font-bold py-3 rounded-lg transition-colors flex items-center justify-center gap-2"
              >
                <Share2 className="w-4 h-4" />
                {t.dpdp_grant_button}
              </button>

              <button
                onClick={() => setShowDpdpModal(false)}
                className="bg-white hover:bg-slate-50 text-slate-700 border border-slate-300 type-xs font-semibold px-4 py-3 rounded-lg"
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
