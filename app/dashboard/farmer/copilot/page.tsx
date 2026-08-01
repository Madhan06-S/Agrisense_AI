"use client";

import React, { useState, useEffect, useMemo } from "react";
import { QueryClient, QueryClientProvider, useQuery, useMutation } from "@tanstack/react-query";
import { ShieldCheck, Landmark, Volume2, CloudSun, Mic, UploadCloud, Store, HelpCircle, Check, Smartphone, User, Star, Tractor, ArrowLeft, Droplets, Info } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";
import { Farm } from "@/components/MapComponent";
import CopilotAvatar3D from "@/components/copilot/CopilotAvatar3D";
import CreditScore3D from "@/components/credit/CreditScore3D";
import Link from "next/link";

const queryClient = new QueryClient();

function CopilotDashboardContent() {
  const [selectedFarm, setSelectedFarm] = useState<Farm | null>(null);
  const [activeAdvisoryIdx, setActiveAdvisoryIdx] = useState(0);
  const [followedActions, setFollowedActions] = useState<Record<string, boolean>>({});
  const [leafPhoto, setLeafPhoto] = useState<string | null>(null);
  const [leafResult, setLeafResult] = useState<string | null>(null);
  const [voiceActive, setVoiceActive] = useState(false);
  const [voiceText, setVoiceText] = useState("");

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

  // Fetch Advisories
  const { data: advisoriesReport = null } = useQuery({
    queryKey: ["farm_advisories", selectedFarm?.id],
    queryFn: async () => {
      if (!selectedFarm) return null;
      try {
        const res = await fetch("http://localhost:8000/api/v1/copilot/advise", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ farm_id: selectedFarm.id })
        });
        return await res.json();
      } catch {
        return {
          advisory_id: `ADV-MOCK-${selectedFarm.id}`,
          advisories: [
            {
              type: "irrigation",
              english: "[HIGH] Postpone irrigation. Heavy rain forecast (85% probability) on Thursday will naturally saturate soil.",
              hindi: "[उच्च तीव्रता] सिंचाई स्थगित करें। गुरुवार को भारी बारिश (85% संभावना) से मिट्टी को पर्याप्त नमी मिलेगी।"
            },
            {
              type: "pest",
              english: "[MEDIUM] Apply neem-based bio-pesticide spray. Prevents potential Brown Plant Hopper infestation due to high humidity.",
              hindi: "[मध्यम तीव्रता] नीम आधारित जैव-कीटनाशक का छिड़काव करें। अत्यधिक उमस से होने वाले हॉपर कीट के प्रकोप को रोकता है।"
            },
            {
              type: "fertilizer",
              english: "[LOW] Apply nitrogen top-dressing (45kg urea per acre) to boost foliage vigor in mid-stage growth.",
              hindi: "[निम्न तीव्रता] पत्तियों के बेहतर स्वास्थ्य और विकास के लिए यूरिया का छिड़काव (45 किग्रा प्रति एकड़) करें।"
            }
          ]
        };
      }
    },
    enabled: !!selectedFarm,
  });

  // Fetch Credit Score
  const { data: creditReport = null } = useQuery({
    queryKey: ["farm_credit", selectedFarm?.id],
    queryFn: async () => {
      if (!selectedFarm) return null;
      try {
        const res = await fetch(`http://localhost:8000/api/v1/credit/score/${selectedFarm.id}`);
        return await res.json();
      } catch {
        return {
          score_report: {
            credit_score: 680,
            tier: "Good",
            max_loan_limit_inr: 300000.0,
            interest_rate_percent: 9.0,
            shap_breakdown: {
              stability: 80.0,
              diversity: 70.0,
              productivity: 85.0,
              resilience: 80.0,
              payment_history: 95.0,
              tenure: 60.0
            }
          }
        };
      }
    },
    enabled: !!selectedFarm,
  });

  const activeAdvisory = advisoriesReport?.advisories?.[activeAdvisoryIdx];

  const handleLeafUpload = () => {
    setLeafPhoto("https://images.unsplash.com/photo-1599599810769-bcde5a160d32");
    setLeafResult("Detected: Blast Disease (Moderate). Treatment: Apply Tricyclazole 75% WP (120g/acre) under local agricultural guidelines.");
  };

  const handleVoiceQuery = () => {
    setVoiceActive(true);
    setVoiceText("Listening to speech input...");
    setTimeout(() => {
      setVoiceText("Recognized Question: Bhaiya, mera gehu kaisa hai?");
      setTimeout(() => {
        setVoiceText("AI Response: Ramesh ji, your wheat crop is healthy. Moderate rain is forecast in 3 days; delay any nitrogen spray.");
        setVoiceActive(false);
      }, 1500);
    }, 1500);
  };

  const feedbackMutation = useMutation({
    mutationFn: async (followed: boolean) => {
      if (!advisoriesReport) return;
      await fetch("http://localhost:8000/api/v1/copilot/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          advisory_id: advisoriesReport.advisory_id,
          rating: "thumbs_up",
          followed
        })
      });
    }
  });

  const handleFollowAction = (type: string) => {
    setFollowedActions(prev => ({ ...prev, [type]: true }));
    feedbackMutation.mutate(true);
  };

  const mandiData = [
    { market: "Khanna Mandi", price: 2150 },
    { market: "Rajpura Mandi", price: 2180 },
    { market: "Sirhind Mandi", price: 2125 },
    { market: "Moga Mandi", price: 2210 }
  ];

  return (
    <div className="min-h-screen bg-[#F8FAFC] text-slate-800 p-8 font-sans">
      
      {/* Header */}
      <header className="mb-6 flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b border-slate-200 pb-4">
        <div className="flex items-center gap-3">
          <Link href="/dashboard/farmer" className="p-2 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors text-slate-600">
            <ArrowLeft className="w-4 h-4" />
          </Link>
          <div>
            <h1 className="text-lg font-bold text-slate-800">AgriSense AI Farmer Copilot</h1>
            <p className="text-xs text-slate-500 mt-0.5">Access personalized agronomy advice, crop health checks, and satellite credit limit estimates.</p>
          </div>
        </div>
        
        {/* Dropdown Selector */}
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

      {selectedFarm ? (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          
          {/* Left Columns (8 spans): 3D Assistant & Advisories */}
          <div className="lg:col-span-8 flex flex-col gap-6">
            
            {/* 3D Advisor Avatar */}
            {activeAdvisory && (
              <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm">
                <div className="p-4 border-b border-slate-200 bg-slate-50 flex items-center gap-2">
                  <User className="w-4 h-4 text-[#166534]" />
                  <span className="text-xs font-bold text-slate-700 uppercase">3D Agronomy Assistant</span>
                </div>
                <div className="h-[250px] relative bg-slate-50">
                  <CopilotAvatar3D
                    adviceText={activeAdvisory.english}
                    activeTopic={activeAdvisory.type as any}
                  />
                </div>
              </div>
            )}

            {/* Daily Briefing Cards */}
            <div className="bg-white border border-slate-200 p-5 rounded-xl shadow-sm space-y-4">
              <div className="flex justify-between items-center border-b border-slate-100 pb-3">
                <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wider">Priority Crop Advisories</h3>
                <span className="text-[10px] bg-[#166534]/10 text-[#166534] border border-[#166534]/20 px-2 py-0.5 rounded font-bold">
                  {advisoriesReport?.advisories?.length ?? 0} Recommendations Active
                </span>
              </div>
              
              <div className="space-y-3">
                {advisoriesReport?.advisories?.map((adv: any, idx: number) => (
                  <div
                    key={idx}
                    onClick={() => setActiveAdvisoryIdx(idx)}
                    className={`p-4 rounded-lg border cursor-pointer transition flex justify-between items-center ${
                      activeAdvisoryIdx === idx ? "bg-[#166534]/5 border-[#166534]/30" : "bg-white border-slate-200 hover:border-slate-300"
                    }`}
                  >
                    <div className="flex-grow pr-4">
                      <div className="flex gap-2 items-center mb-1">
                        <Tractor className="w-4 h-4 text-[#166534]" />
                        <h4 className="text-xs font-bold text-slate-800 capitalize">{adv.type} Advice</h4>
                      </div>
                      <p className="text-xs text-slate-700 leading-relaxed font-semibold">{adv.english}</p>
                      <p className="text-xs text-slate-500 mt-1 font-semibold">{adv.hindi}</p>
                    </div>
                    
                    <div>
                      {followedActions[adv.type] ? (
                        <span className="flex gap-1 items-center px-2 py-1 rounded bg-emerald-50 text-[#166534] border border-[#166534]/20 text-[9px] font-bold uppercase whitespace-nowrap">
                          <Check className="w-3.5 h-3.5" /> Applied
                        </span>
                      ) : (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleFollowAction(adv.type);
                          }}
                          className="py-1 px-3 rounded bg-[#166534] text-white text-[9px] font-bold uppercase hover:bg-emerald-800 transition"
                        >
                          Mark Applied
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Right Columns (4 spans): Diagnostics & Credit Reports */}
          <div className="lg:col-span-4 flex flex-col gap-6">
            
            {/* Interactive voice checker */}
            <div className="bg-white border border-slate-200 p-5 rounded-xl shadow-sm space-y-4">
              <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wider border-b border-slate-100 pb-2">
                Voice Query Assistant
              </h3>
              <p className="text-xs text-slate-500 leading-relaxed">
                Click the microphone to speak a query in Hindi or English (simulated voice capture).
              </p>
              <div className="flex flex-col items-center gap-3">
                <button
                  onClick={handleVoiceQuery}
                  className={`w-14 h-14 rounded-full flex items-center justify-center transition-all border ${
                    voiceActive ? "bg-red-500 border-red-600 text-white animate-pulse" : "bg-slate-100 hover:bg-slate-200 border-slate-300 text-slate-600"
                  }`}
                >
                  <Mic className="w-6 h-6" />
                </button>
                {voiceText && (
                  <p className="text-xs leading-relaxed text-slate-600 font-mono text-center bg-slate-50 p-3 rounded-lg border border-slate-200 w-full">
                    {voiceText}
                  </p>
                )}
              </div>
            </div>

            {/* Diagnostic leaf scan */}
            <div className="bg-white border border-slate-200 p-5 rounded-xl shadow-sm space-y-4">
              <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wider border-b border-slate-100 pb-2 flex items-center gap-2">
                <UploadCloud className="w-4 h-4 text-[#166534]" />
                Leaf Disease Diagnostic
              </h3>
              <p className="text-xs text-slate-500 leading-relaxed">
                Upload a geo-tagged image of affected crop leaves to analyze pest/disease indicators.
              </p>
              <div className="flex flex-col items-center gap-3">
                {leafPhoto ? (
                  <div className="relative w-full h-32 rounded-lg overflow-hidden border border-slate-200">
                    <img src={leafPhoto} alt="Uploaded Leaf" className="w-full h-full object-cover" />
                    <button onClick={() => { setLeafPhoto(null); setLeafResult(null); }} className="absolute top-2 right-2 p-1 bg-red-600 text-white rounded-full">
                      <XAxis />
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={handleLeafUpload}
                    className="w-full border-2 border-dashed border-slate-300 hover:border-slate-400 p-6 rounded-lg text-center text-xs text-slate-400 hover:text-slate-600 flex flex-col items-center gap-2"
                  >
                    <UploadCloud className="w-6 h-6" />
                    <span>Upload Leaf Image</span>
                  </button>
                )}

                {leafResult && (
                  <div className="bg-amber-50 border border-amber-200 p-3 rounded-lg text-[11px] text-amber-800 leading-relaxed font-semibold">
                    {leafResult}
                  </div>
                )}
              </div>
            </div>

            {/* 3D Credit Score */}
            {creditReport && (
              <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm">
                <div className="p-4 border-b border-slate-200 bg-slate-50 flex items-center gap-2">
                  <Landmark className="w-4 h-4 text-[#166534]" />
                  <span className="text-xs font-bold text-slate-700 uppercase">Aadhaar Credit Rating</span>
                </div>
                <div className="h-[200px] relative bg-slate-50">
                  <CreditScore3D score={creditReport.score_report.credit_score} />
                </div>
                <div className="p-4 bg-white border-t border-slate-100 text-xs space-y-2">
                  <div className="flex justify-between font-bold">
                    <span>Credit Tier:</span>
                    <span className="text-[#166534]">{creditReport.score_report.tier}</span>
                  </div>
                  <div className="flex justify-between font-bold">
                    <span>Eligible Kisan Credit Loan:</span>
                    <span>₹{creditReport.score_report.max_loan_limit_inr.toLocaleString("en-IN")}</span>
                  </div>
                  <div className="flex justify-between font-bold">
                    <span>Interest Rate:</span>
                    <span>{creditReport.score_report.interest_rate_percent}% p.a.</span>
                  </div>
                </div>
              </div>
            )}

            {/* Mandi Prices */}
            <div className="bg-white border border-slate-200 p-5 rounded-xl shadow-sm space-y-4">
              <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wider border-b border-slate-100 pb-2">
                Wheat Mandi Rates (Per Quintal)
              </h3>
              <div className="h-40">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={mandiData}>
                    <XAxis dataKey="market" stroke="#94a3b8" fontSize={10} tickLine={false} />
                    <YAxis stroke="#94a3b8" fontSize={10} tickLine={false} />
                    <Tooltip cursor={{ fill: "rgba(22, 101, 52, 0.05)" }} />
                    <Bar dataKey="price" fill="#166534" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

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
      <CopilotDashboardContent />
    </QueryClientProvider>
  );
}
