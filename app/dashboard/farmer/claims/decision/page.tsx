"use client";

import React, { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import { QueryClient, QueryClientProvider, useQuery } from "@tanstack/react-query";
import { ShieldCheck, Calendar, AlertOctagon, Volume2, ArrowRight, HelpCircle, Layers, FileText, ChevronRight, Tractor, ArrowLeft } from "lucide-react";
import { Farm } from "@/components/MapComponent";
import TrafficLight3D from "@/components/decision/TrafficLight3D";
import Explainability3D from "@/components/ml/Explainability3D";
import FarmTerrain3D from "@/components/maps/FarmTerrain3D";

const queryClient = new QueryClient();

function DecisionDashboardContent() {
  const [selectedFarm, setSelectedFarm] = useState<Farm | null>(null);
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
    } catch (e) {
      setHasWebGL(false);
    }
  }, []);

  // Fetch Farms
  const { data: farms = [] } = useQuery<Farm[]>({
    queryKey: ["farms"],
    queryFn: async () => {
      try {
        const res = await fetch("http://localhost:8000/api/v1/farms/");
        if (!res.ok) throw new Error("API Offline");
        return await res.json();
      } catch (err) {
        const cached = localStorage.getItem("agrisense_cached_farms");
        return cached ? JSON.parse(cached) : [];
      }
    },
  });

  // Select first farm by default
  useEffect(() => {
    if (farms.length > 0 && !selectedFarm) {
      setSelectedFarm(farms[0]);
    }
  }, [farms, selectedFarm]);

  // Fetch Claim routing evaluation
  const { data: claimEvaluation = null, isLoading } = useQuery({
    queryKey: ["claim_evaluation", selectedFarm?.id],
    queryFn: async () => {
      if (!selectedFarm) return null;
      try {
        const res = await fetch("http://localhost:8000/api/v1/decision/evaluate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            farm_id: selectedFarm.id,
            ndvi: 0.65,
            vci: 65.0,
            rainfall_anomaly_percent: -45.0,
            flood_index: 0.42,
            moisture_drop: 25.0,
            ndvi_drop_2w: 28.0,
            num_cows: 6
          })
        });
        if (!res.ok) throw new Error("Evaluation API offline");
        return await res.json();
      } catch (err) {
        const color = selectedFarm.crop_type === "Wheat" ? "GREEN" : "RED";
        const payoutAmount = color === "RED" ? 6 * 5000 * 1.2 : 0.0;
        
        return {
          claim_id: selectedFarm.id,
          farm_name: selectedFarm.name,
          crop_type: selectedFarm.crop_type,
          routing: {
            color,
            status: color === "GREEN" ? "CLAIM_CLOSED_NO_DAMAGE" : "INSTANT_MICRO_PAYOUT",
            message: color === "GREEN" ? "Pasture is healthy." : "Crop damage detected.",
            payout_amount: payoutAmount
          },
          payout: {
            payout_amount: payoutAmount,
            trigger_rules: color === "RED" ? ["ndvi_drop_2w > 50"] : []
          },
          prediction: {
            damage_probability: color === "RED" ? 0.82 : 0.08,
            confidence: 0.91,
            damage_class: color === "GREEN" ? "no_damage" : "severe_damage"
          }
        };
      }
    },
    enabled: !!selectedFarm,
  });

  const decisionColor = ((claimEvaluation?.routing?.color as string) ?? "RED") as "GREEN" | "RED";

  // Natural Language Explanations
  const explanationTexts = useMemo(() => {
    const payoutStr = claimEvaluation?.payout?.payout_amount?.toLocaleString("en-IN");
    if (decisionColor === "GREEN") {
      return {
        eng: `Digital Trust Verification complete. The computed Pasture Health Index shows normal parameters. No major anomalies or vegetation drop detected. No micro-payout is required for this claim cycle.`,
        hin: `डिजिटल ट्रस्ट सत्यापन पूर्ण। चारागाह स्वास्थ्य सूचकांक सामान्य मापदंडों को दर्शाता है। कोई मुख्य विसंगति या वनस्पति गिरावट दर्ज नहीं की गई है। इस चक्र के लिए कोई माइक्रो-भुगतान आवश्यक नहीं है।`
      };
    }
    return {
      eng: `Automated assessment complete. Crop damage verified based on vegetation index drop threshold and weather correlation. Instant micro-payout of ₹${payoutStr ?? "calculating..."} has been scheduled for bank transfer.`,
      hin: `स्वचालित मूल्यांकन पूर्ण। वनस्पति सूचकांक में गिरावट और मौसम सहसंबंध के आधार पर फसल नुकसान का सत्यापन किया गया है। ₹${payoutStr ?? "गणना हो रही है..."} का तत्काल माइक्रो-भुगतान बैंक हस्तांतरण के लिए निर्धारित किया गया है।`
    };
  }, [decisionColor, claimEvaluation]);

  const handleVoicePlay = () => {
    if (typeof window === "undefined" || !window.speechSynthesis) return;
    
    if (isSpeaking) {
      window.speechSynthesis.cancel();
      setIsSpeaking(false);
      return;
    }

    setIsSpeaking(true);
    const text = speechLanguage === "en" ? explanationTexts.eng : speechLanguage === "hi" ? explanationTexts.hin : "";
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = speechLanguage === "en" ? "en-US" : "hi-IN";
    utterance.rate = 0.95;
    
    utterance.onend = () => setIsSpeaking(false);
    utterance.onerror = () => setIsSpeaking(false);
    
    window.speechSynthesis.speak(utterance);
  };

  useEffect(() => {
    return () => {
      if (typeof window !== "undefined" && window.speechSynthesis) {
        window.speechSynthesis.cancel();
      }
    };
  }, []);

  return (
    <div className="min-h-screen bg-[#F8FAFC] text-slate-800 p-8 font-sans">
      {/* Selector Header */}
      <header className="mb-6 flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b border-slate-200 pb-4">
        <div className="flex items-center gap-3">
          <Link href="/dashboard/farmer" className="p-2 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors text-slate-600">
            <ArrowLeft className="w-4 h-4" />
          </Link>
          <div>
            <h1 className="text-lg font-bold text-slate-800">Claim Evaluation & AI Decision Assessment</h1>
            <p className="text-xs text-slate-500 mt-0.5">Explore satellite analytics and parametric index validation for your crop insurance policy.</p>
          </div>
        </div>
        
        {/* Farm dropdown selector */}
        {farms.length > 0 && (
          <div className="flex gap-2 items-center text-xs">
            <span className="text-slate-500 font-semibold uppercase">Select Farm:</span>
            <select
              value={selectedFarm?.id ?? ""}
              onChange={(e) => {
                const id = parseInt(e.target.value);
                const found = farms.find((f) => f.id === id);
                if (found) setSelectedFarm(found);
              }}
              className="bg-white border border-slate-300 rounded-lg px-3 py-1.5 text-xs text-slate-800 focus:outline-none focus:border-[#166534]"
            >
              {farms.map((f) => (
                <option key={f.id} value={f.id}>{f.name}</option>
              ))}
            </select>
          </div>
        )}
      </header>

      {/* Main Content Layout */}
      {selectedFarm ? (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Visualizers (Left column, 8 spans) */}
          <div className="lg:col-span-8 flex flex-col gap-6">
            {hasWebGL ? (
              <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm">
                <div className="p-4 border-b border-slate-200 bg-slate-50 flex items-center gap-2">
                  <Layers className="w-4 h-4 text-[#166534]" />
                  <span className="text-xs font-bold text-slate-700 uppercase">3D Parametric Status Indicator</span>
                </div>
                <div className="h-[250px] relative bg-slate-50">
                  <TrafficLight3D
                    decisionColor={decisionColor}
                    payoutAmount={claimEvaluation?.payout?.payout_amount ?? 0}
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
                    farmName={selectedFarm.name}
                    shapData={{
                      base_value: 0.15,
                      prediction_value: claimEvaluation?.prediction?.damage_probability ?? 0.42,
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
          </div>

          {/* Details Pane (Right column, 4 spans) */}
          <div className="lg:col-span-4 flex flex-col gap-6">
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

              {/* Next Steps */}
              <div className="flex flex-col gap-3 mt-2 border-t border-slate-100 pt-4">
                <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Workflow Verification</span>
                
                <div className="flex gap-3 items-start text-xs">
                  <div className="w-5 h-5 rounded-full bg-[#166534]/15 border border-[#166534]/30 flex items-center justify-center text-[10px] text-[#166534] font-bold flex-shrink-0">1</div>
                  <div>
                    <h5 className="font-bold text-slate-800">Satellite Analysis</h5>
                    <p className="text-[10px] text-slate-400 mt-0.5">Multispectral indices compared against historical crop records.</p>
                  </div>
                </div>

                <div className="flex gap-3 items-start text-xs">
                  <div className="w-5 h-5 rounded-full bg-blue-100 border border-blue-200 flex items-center justify-center text-[10px] text-blue-800 font-bold flex-shrink-0">2</div>
                  <div>
                    <h5 className="font-bold text-slate-800">Parametric Triggers</h5>
                    <p className="text-[10px] text-slate-400 mt-0.5">Decision system verifies criteria for auto-closure or payout transfer.</p>
                  </div>
                </div>

                <div className="flex gap-3 items-start text-xs">
                  <div className="w-5 h-5 rounded-full bg-slate-100 border border-slate-200 flex items-center justify-center text-[10px] text-slate-500 font-bold flex-shrink-0">3</div>
                  <div>
                    <h5 className="font-bold text-slate-700">Payment Release</h5>
                    <p className="text-[10px] text-slate-400 mt-0.5">Direct benefit transfer schedules release directly to Aadhaar link.</p>
                  </div>
                </div>
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

            {/* Farm Terrain */}
            {hasWebGL && (
              <div className="bg-white border border-slate-200 p-5 rounded-xl shadow-sm flex flex-col gap-3">
                <span className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-2 border-b border-slate-100 pb-2">
                  <Layers className="w-4 h-4 text-[#166534]" />
                  Spatial Health Map
                </span>
                <p className="text-[10px] text-slate-500 leading-relaxed">
                  Interactive representation of farm boundary and vegetation levels. Darker green shades indicate normal canopy levels.
                </p>
                <div className="h-[150px] rounded-lg overflow-hidden border border-slate-200 relative bg-slate-50">
                  <FarmTerrain3D geojson={selectedFarm.boundary} livePreview={true} />
                </div>
              </div>
            )}
          </div>
        </div>
      ) : (
        <div className="p-12 text-center text-xs text-slate-400 border border-dashed border-slate-300 rounded-xl bg-white">
          No farms registered yet. Please register a farm on the farm ingestion page.
        </div>
      )}
    </div>
  );
}

export default function Page() {
  return (
    <QueryClientProvider client={queryClient}>
      <DecisionDashboardContent />
    </QueryClientProvider>
  );
}
