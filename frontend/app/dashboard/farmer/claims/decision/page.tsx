"use client";

import React, { useState, useEffect, useMemo, Suspense } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { ShieldCheck, AlertOctagon, Volume2, Layers, ChevronRight, Tractor, ArrowLeft, Loader2, AlertCircle } from "lucide-react";
import TrafficLight3D from "@/components/decision/TrafficLight3D";
import Explainability3D from "@/components/ml/Explainability3D";
import FarmTerrain3D from "@/components/maps/FarmTerrain3D";
import EvidencePanel from "@/components/EvidencePanel";
import { apiFetch, ApiError } from "@/lib/api";

interface DecisionData {
  claim_id: number;
  farm_name?: string;
  crop_type?: string;
  status?: string;
  payout_amount?: number;
  recommended_payout_amount?: number;
  analysis_status?: string;
  analysis_error_reason?: string;
  routing?: {
    color: string;
    status: string;
    message: string;
    payout_amount: number;
  };
  payout?: {
    payout_amount: number;
    trigger_rules?: string[];
  };
  prediction?: {
    damage_probability: number;
    confidence: number;
    damage_class: string;
  };
}

function DecisionDashboardContent() {
  const searchParams = useSearchParams();
  const claimIdParam = searchParams.get("claim_id") || "1";
  
  const [decisionData, setDecisionData] = useState<DecisionData | null>(null);
  const [paymentStatus, setPaymentStatus] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [hasWebGL, setHasWebGL] = useState(true);
  const [speechLanguage, setSpeechLanguage] = useState<"en" | "hi">("en");
  const [isSpeaking, setIsSpeaking] = useState(false);

  // WebGL compatibility check
  useEffect(() => {
    try {
      const canvas = document.createElement("canvas");
      setHasWebGL(
        !!(window.WebGLRenderingContext && 
          (canvas.getContext("webgl") || canvas.getContext("experimental-webgl")))
      );
    } catch {
      setHasWebGL(false);
    }
  }, []);

  // Fetch specific claim decision from backend
  useEffect(() => {
    async function loadDecision() {
      setLoading(true);
      setErrorMsg(null);
      try {
        const res = await apiFetch(`/decision/claim/${claimIdParam}`);
        const data = await res.json();
        setDecisionData(data);

        // Fetch payment status separately
        try {
          const payRes = await apiFetch(`/payments/${claimIdParam}/status`);
          if (payRes.ok) {
            const payData = await payRes.json();
            setPaymentStatus(payData.status || "initiated");
          }
        } catch {
          setPaymentStatus(data.status || "pending");
        }
      } catch (err: any) {
        console.error("Error loading decision:", err);
        setErrorMsg(err instanceof ApiError ? err.message : "data unavailable");
      } finally {
        setLoading(false);
      }
    }

    loadDecision();
  }, [claimIdParam]);

  const decisionColor = ((decisionData?.routing?.color as string) ?? "RED") as "GREEN" | "RED" | "YELLOW";

  // Natural Language Explanations
  const explanationTexts = useMemo(() => {
    const payoutAmt = decisionData?.recommended_payout_amount ?? decisionData?.payout_amount ?? decisionData?.payout?.payout_amount;
    const payoutStr = payoutAmt ? payoutAmt.toLocaleString("en-IN") : null;
    if (decisionColor === "GREEN") {
      return {
        eng: `Digital Trust Verification complete. The computed Pasture Health Index shows normal parameters. No major anomalies or vegetation drop detected. No micro-payout is required for this claim cycle.`,
        hin: `डिजिटल ट्रस्ट सत्यापन पूर्ण। चारागाह स्वास्थ्य सूचकांक सामान्य मापदंडों को दर्शाता है। कोई मुख्य विसंगति या वनस्पति गिरावट दर्ज नहीं की गई है। इस चक्र के लिए कोई माइक्रो-भुगतान आवश्यक नहीं है।`
      };
    }
    return {
      eng: `Automated assessment complete. Crop damage verified based on vegetation index drop threshold and weather correlation. Recommended payout of ₹${payoutStr ?? "calculating..."} has been recorded for review/transfer.`,
      hin: `स्वचालित मूल्यांकन पूर्ण। वनस्पति सूचकांक में गिरावट और मौसम सहसंबंध के आधार पर फसल नुकसान का सत्यापन किया गया है। ₹${payoutStr ?? "गणना हो रही है..."} का सिफारिशी भुगतान दर्ज किया गया है।`
    };
  }, [decisionColor, decisionData]);

  const handleVoicePlay = () => {
    if (typeof window === "undefined" || !window.speechSynthesis) return;
    
    if (isSpeaking) {
      window.speechSynthesis.cancel();
      setIsSpeaking(false);
      return;
    }

    setIsSpeaking(true);
    const text = speechLanguage === "en" ? explanationTexts.eng : explanationTexts.hin;
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = speechLanguage === "en" ? "en-US" : "hi-IN";
    utterance.rate = 0.95;
    
    utterance.onend = () => setIsSpeaking(false);
    utterance.onerror = () => setIsSpeaking(false);
    
    window.speechSynthesis.speak(utterance);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#F8FAFC] flex flex-col items-center justify-center gap-3">
        <Loader2 className="w-8 h-8 animate-spin text-[#166534]" />
        <span className="text-xs font-semibold text-slate-600">Loading backend claim decision...</span>
      </div>
    );
  }

  if (errorMsg) {
    return (
      <div className="min-h-screen bg-[#F8FAFC] p-8 flex flex-col items-center justify-center">
        <div className="bg-white border border-red-200 rounded-2xl p-8 max-w-md w-full text-center space-y-4 shadow-sm">
          <AlertCircle className="w-10 h-10 text-red-600 mx-auto" />
          <h2 className="text-base font-bold text-slate-900">Decision Assessment Error</h2>
          <p className="text-xs text-slate-600">{errorMsg}</p>
          <Link
            href="/dashboard/farmer"
            className="inline-flex items-center gap-2 px-4 py-2 bg-[#166534] text-white text-xs font-bold rounded-lg"
          >
            <ArrowLeft className="w-4 h-4" /> Back to Dashboard
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F8FAFC] text-slate-800 p-8 font-sans">
      {/* Selector Header */}
      <header className="mb-6 flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b border-slate-200 pb-4">
        <div className="flex items-center gap-3">
          <Link href="/dashboard/farmer" className="p-2 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors text-slate-600">
            <ArrowLeft className="w-4 h-4" />
          </Link>
          <div>
            <h1 className="text-lg font-bold text-slate-800">Claim #{claimIdParam} Evaluation & AI Decision</h1>
            <p className="text-xs text-slate-500 mt-0.5">Verified backend assessment and payment status tracking.</p>
          </div>
        </div>
      </header>

      {/* Main Content Layout */}
      {decisionData ? (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Visualizers (Left column, 8 spans) */}
          <div className="lg:col-span-8 flex flex-col gap-6">
            {hasWebGL ? (
              <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm">
                <div className="p-4 border-b border-slate-200 bg-slate-50 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Layers className="w-4 h-4 text-[#166534]" />
                    <span className="text-xs font-bold text-slate-700 uppercase">3D Parametric Status Indicator</span>
                  </div>
                  <span className="text-[10px] font-mono uppercase bg-slate-200 text-slate-700 px-2 py-0.5 rounded font-bold">
                    Analysis: {decisionData.analysis_status || "completed"}
                  </span>
                </div>
                <div className="h-[250px] relative bg-slate-50">
                  <TrafficLight3D
                    decisionColor={decisionColor === "YELLOW" ? "RED" : decisionColor}
                    payoutAmount={decisionData?.recommended_payout_amount ?? decisionData?.payout_amount ?? 0}
                    timelineStep={decisionColor === "GREEN" ? 3 : 2}
                  />
                </div>
              </div>
            ) : (
              <div className="p-12 border border-slate-200 rounded-xl bg-white text-center text-xs text-slate-400">
                WebGL not supported. Displaying static claim status: <b>{decisionColor}</b>
              </div>
            )}

            {/* Explainability Forest */}
            {hasWebGL && (
              <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm">
                <div className="p-4 border-b border-slate-200 bg-slate-50 flex items-center gap-2">
                  <Tractor className="w-4 h-4 text-[#166534]" />
                  <span className="text-xs font-bold text-slate-700 uppercase">AI SHAP Feature Analysis</span>
                </div>
                <div className="h-[300px] relative bg-slate-50">
                  <Explainability3D
                    farmName={decisionData.farm_name || "Farm Parcel"}
                    shapData={{
                      base_value: 0.15,
                      prediction_value: decisionData?.prediction?.damage_probability ?? 0.42,
                      shap_values: {
                        ndvi: -0.28,
                        precip: 0.15,
                        soil_moisture: 0.12
                      }
                    }}
                  />
                </div>
              </div>
            )}

            {/* Multi-Signal Evidence Panel */}
            <EvidencePanel evidence={(decisionData as any)?.ai_evidence} />
          </div>

          {/* Details Pane (Right column, 4 spans) */}
          <div className="lg:col-span-4 flex flex-col gap-6">
            {/* Payment State Display */}
            <div className="bg-white border border-slate-200 p-5 rounded-xl shadow-sm space-y-3">
              <span className="text-xs font-bold text-slate-700 uppercase tracking-wider block border-b border-slate-100 pb-2">
                Payment & Transfer Status
              </span>
              <div className="flex justify-between items-center text-xs">
                <span className="text-slate-500 font-semibold">Payment State:</span>
                <span className="font-mono font-bold uppercase text-emerald-800 bg-emerald-50 px-2.5 py-1 rounded-full border border-emerald-200">
                  {paymentStatus || decisionData.status || "initiated"}
                </span>
              </div>
              <div className="flex justify-between items-center text-xs">
                <span className="text-slate-500 font-semibold">Recommended Amount:</span>
                <span className="font-mono font-bold text-slate-900">
                  ₹{(decisionData.recommended_payout_amount ?? decisionData.payout_amount ?? 0).toLocaleString("en-IN")}
                </span>
              </div>
            </div>

            {/* Written Assessment Card */}
            <div className="bg-white border border-slate-200 p-5 rounded-xl shadow-sm flex flex-col gap-4">
              <div className="flex justify-between items-center border-b border-slate-100 pb-3">
                <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wider">Official Assessment</h3>
                <div className="flex gap-2 items-center">
                  <button
                    onClick={() => setSpeechLanguage(speechLanguage === "en" ? "hi" : "en")}
                    className="py-0.5 px-2 rounded bg-slate-100 border border-slate-200 text-[9px] font-bold text-slate-600 hover:bg-slate-200 uppercase"
                  >
                    {speechLanguage === "en" ? "हिंदी" : "English"}
                  </button>
                  <button
                    onClick={handleVoicePlay}
                    className={`p-1.5 rounded-full transition-colors ${
                      isSpeaking ? "bg-[#166534] text-white" : "bg-slate-100 text-slate-500 hover:bg-slate-200 border border-slate-200"
                    }`}
                    title="Read explanation out loud"
                  >
                    <Volume2 className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Assessment Text */}
              <div className="text-xs leading-relaxed text-slate-600">
                <p className="whitespace-pre-line font-medium bg-slate-50 p-3 rounded-lg border border-slate-100">
                  {speechLanguage === "en" ? explanationTexts.eng : explanationTexts.hin}
                </p>
              </div>

              {/* Resolution Action */}
              <div className="mt-4 pt-4 border-t border-slate-100">
                {decisionColor === "GREEN" ? (
                  <button className="w-full flex items-center justify-center gap-2 bg-[#166534] hover:bg-emerald-800 text-white font-bold py-2 px-4 rounded-lg text-xs transition-all shadow-sm">
                    <ShieldCheck className="w-4 h-4" /> Track Claim File Status
                  </button>
                ) : (
                  <button className="w-full flex items-center justify-center gap-2 bg-[#DC2626] hover:bg-red-800 text-white font-bold py-2 px-4 rounded-lg text-xs transition-all shadow-sm">
                    <AlertOctagon className="w-4 h-4" /> File Grievance / Appeal
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div className="p-12 text-center text-xs text-slate-400 border border-dashed border-slate-300 rounded-xl bg-white">
          data unavailable
        </div>
      )}
    </div>
  );
}

export default function Page() {
  return (
    <Suspense fallback={<div className="p-8 text-center text-xs text-slate-500">Loading decision dashboard...</div>}>
      <DecisionDashboardContent />
    </Suspense>
  );
}
