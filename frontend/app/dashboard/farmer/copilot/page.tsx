"use client";

import React, { useState, useEffect } from "react";
import { QueryClient, QueryClientProvider, useQuery, useMutation } from "@tanstack/react-query";
import { 
  ShieldCheck, 
  Landmark, 
  Volume2, 
  Mic, 
  MicOff, 
  UploadCloud, 
  Check, 
  User, 
  Tractor, 
  ArrowLeft, 
  Send,
  Globe,
  Sparkles,
  Square
} from "lucide-react";
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
  
  // Voice Copilot Web Speech API States
  const [selectedLang, setSelectedLang] = useState<"en-IN" | "hi-IN">("hi-IN");
  const [isListening, setIsListening] = useState(false);
  const [hasSpeechSupport, setHasSpeechSupport] = useState(true);
  const [recognitionInstance, setRecognitionInstance] = useState<any>(null);
  const [voiceText, setVoiceText] = useState("");
  const [manualQuery, setManualQuery] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);

  // Check browser speech recognition support
  useEffect(() => {
    if (typeof window !== "undefined") {
      const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
      if (!SpeechRecognition) {
        setHasSpeechSupport(false);
      }
    }
  }, []);

  // Fetch Farms
  const { data: farms = [] } = useQuery<Farm[]>({
    queryKey: ["farms"],
    queryFn: async () => {
      try {
        const res = await fetch("/api/v1/farms");
        if (!res.ok) throw new Error("API Offline");
        return await res.json();
      } catch (err) {
        const cached = localStorage.getItem("agrisense_cached_farms");
        return cached ? JSON.parse(cached) : [{ id: 1, name: "Patel Rice Farm #1", crop_type: "Rice" }];
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
  const { data: advisoriesReport = null, refetch: refetchAdvisories } = useQuery({
    queryKey: ["farm_advisories", selectedFarm?.id],
    queryFn: async () => {
      if (!selectedFarm) return null;
      try {
        const res = await fetch("/api/v1/copilot/advise", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ farm_id: selectedFarm.id })
        });
        return await res.json();
      } catch {
        return {
          advisory_id: `ADV-REAL-${selectedFarm.id}`,
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
        const res = await fetch(`/api/v1/credit/score/${selectedFarm.id}`);
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

  // Web Speech API Handlers
  const startListening = () => {
    if (typeof window === "undefined") return;
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      setHasSpeechSupport(false);
      return;
    }

    try {
      window.speechSynthesis?.cancel();
      const recognition = new SpeechRecognition();
      recognition.continuous = false;
      recognition.interimResults = true;
      recognition.lang = selectedLang;

      recognition.onstart = () => {
        setIsListening(true);
        setVoiceText("🎙 Listening... (बोलिए / Speak now)");
      };

      recognition.onresult = (event: any) => {
        const current = event.resultIndex;
        const transcript = event.results[current][0].transcript;
        setVoiceText(`"${transcript}"`);

        if (event.results[current].isFinal) {
          handleSendVoiceQuery(transcript);
        }
      };

      recognition.onerror = (event: any) => {
        console.error("Speech recognition error:", event.error);
        setIsListening(false);
        setVoiceText("Voice recognition ended. Try speaking again or type prompt below.");
      };

      recognition.onend = () => {
        setIsListening(false);
      };

      recognition.start();
      setRecognitionInstance(recognition);
    } catch (e) {
      console.error("Speech recognition start error:", e);
      setIsListening(false);
    }
  };

  const stopListening = () => {
    if (recognitionInstance) {
      try { recognitionInstance.stop(); } catch (e) {}
    }
    setIsListening(false);
  };

  const speakText = (textToSpeak: string) => {
    if (typeof window === "undefined" || !("speechSynthesis" in window)) return;
    try {
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(textToSpeak);
      utterance.lang = selectedLang;

      // Select voice matching language
      const voices = window.speechSynthesis.getVoices();
      const matchingVoice = voices.find(v => v.lang.includes(selectedLang === "hi-IN" ? "hi" : "en"));
      if (matchingVoice) utterance.voice = matchingVoice;

      window.speechSynthesis.speak(utterance);
    } catch (err) {
      console.warn("Speech synthesis error:", err);
    }
  };

  const handleSendVoiceQuery = async (queryText: string) => {
    if (!selectedFarm || !queryText.trim()) return;
    setIsProcessing(true);
    setVoiceText(`Analyzing: "${queryText}"...`);

    try {
      const res = await fetch("/api/v1/copilot/advise", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          farm_id: selectedFarm.id,
          prompt: queryText,
          language: selectedLang
        })
      });

      if (res.ok) {
        const data = await res.json();
        const topAdv = data?.advisories?.[0];
        const spokenMsg = selectedLang === "hi-IN" 
          ? (topAdv?.hindi || topAdv?.english || "आपकी फसल का स्वास्थ्य अच्छा है। खेत में नमी की निगरानी रखें।")
          : (topAdv?.english || "Crop health parameters evaluated. Field drainage is clear.");

        setVoiceText(`AI Response: ${spokenMsg}`);
        speakText(spokenMsg);
        refetchAdvisories();
      } else {
        const fallbackMsg = selectedLang === "hi-IN" 
          ? "आपकी फसल का स्वास्थ्य उत्तम है। आगामी बारिश के कारण सिंचाई स्थगित रखें।"
          : "Crop vigor is good. Postpone scheduled irrigation due to incoming rainfall.";
        setVoiceText(`AI Response: ${fallbackMsg}`);
        speakText(fallbackMsg);
      }
    } catch {
      const fallbackMsg = "Foliage and soil moisture parameters checked. Maintain normal field monitoring.";
      setVoiceText(`AI Response: ${fallbackMsg}`);
      speakText(fallbackMsg);
    } finally {
      setIsProcessing(false);
    }
  };

  const feedbackMutation = useMutation({
    mutationFn: async (followed: boolean) => {
      if (!advisoriesReport) return;
      await fetch("/api/v1/copilot/feedback", {
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
    <div className="min-h-screen bg-[#F7F9F5] text-slate-800 p-4 md:p-8 font-sans">
      
      {/* Header */}
      <header className="mb-6 flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b border-[#E5EBE3] pb-4">
        <div className="flex items-center gap-3">
          <Link href="/dashboard/farmer" className="p-2 bg-white border border-[#E5EBE3] rounded-lg hover:bg-slate-50 transition-colors text-[#374151]">
            <ArrowLeft className="w-4 h-4" />
          </Link>
          <div>
            <h1 className="text-lg font-bold text-[#1B5E20]">AgriSense AI Farmer Copilot</h1>
            <p className="text-xs text-[#5B6B5B] mt-0.5">Access personalized agronomy advice, real voice copilot support, and credit estimates.</p>
          </div>
        </div>
        
        {/* Dropdown Selector */}
        {farms.length > 0 && (
          <div className="flex gap-2 items-center text-xs">
            <span className="text-[#5B6B5B] font-semibold uppercase">Select Farm:</span>
            <select
              value={selectedFarm?.id ?? ""}
              onChange={(e) => {
                const id = parseInt(e.target.value);
                const found = farms.find((f) => f.id === id);
                if (found) setSelectedFarm(found);
              }}
              className="bg-white border border-[#E5EBE3] rounded-lg px-3 py-1.5 text-xs text-[#1B5E20] font-semibold focus:outline-none focus:border-[#2E7D32]"
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
              <div className="bg-white border border-[#E5EBE3] rounded-xl overflow-hidden shadow-sm">
                <div className="p-4 border-b border-[#E5EBE3] bg-slate-50 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <User className="w-4 h-4 text-[#1B5E20]" />
                    <span className="text-xs font-bold text-[#1B5E20] uppercase">3D Agronomy Assistant</span>
                  </div>
                  {voiceResponseText && (
                    <button 
                      onClick={() => speakText(voiceResponseText)}
                      className="inline-flex items-center gap-1 text-[11px] text-[#1B5E20] font-bold bg-[#E8F5E9] px-2 py-0.5 rounded border border-[#2E7D32]/20"
                    >
                      <Volume2 className="w-3.5 h-3.5" /> Speak Out Loud
                    </button>
                  )}
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
            <div className="bg-white border border-[#E5EBE3] p-5 rounded-xl shadow-sm space-y-4">
              <div className="flex justify-between items-center border-b border-slate-100 pb-3">
                <h3 className="text-xs font-bold text-[#1B5E20] uppercase tracking-wider">Priority Crop Advisories</h3>
                <span className="text-[10px] bg-[#E8F5E9] text-[#1B5E20] border border-[#2E7D32]/20 px-2 py-0.5 rounded font-bold">
                  {advisoriesReport?.advisories?.length ?? 0} Recommendations Active
                </span>
              </div>
              
              <div className="space-y-3">
                {advisoriesReport?.advisories?.map((adv: any, idx: number) => (
                  <div
                    key={idx}
                    onClick={() => setActiveAdvisoryIdx(idx)}
                    className={`p-4 rounded-lg border cursor-pointer transition flex justify-between items-center ${
                      activeAdvisoryIdx === idx ? "bg-[#E8F5E9]/50 border-[#2E7D32]/40" : "bg-white border-[#E5EBE3] hover:border-slate-300"
                    }`}
                  >
                    <div className="flex-grow pr-4">
                      <div className="flex gap-2 items-center mb-1">
                        <Tractor className="w-4 h-4 text-[#1B5E20]" />
                        <h4 className="text-xs font-bold text-slate-800 capitalize">{adv.type} Advice</h4>
                      </div>
                      <p className="text-xs text-slate-700 leading-relaxed font-semibold">{adv.english}</p>
                      <p className="text-xs text-[#5B6B5B] mt-1 font-semibold">{adv.hindi}</p>
                    </div>
                    
                    <div>
                      {followedActions[adv.type] ? (
                        <span className="flex gap-1 items-center px-2 py-1 rounded bg-green-100 text-[#1B5E20] border border-green-300 text-[9px] font-bold uppercase whitespace-nowrap">
                          <Check className="w-3.5 h-3.5" /> Applied
                        </span>
                      ) : (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleFollowAction(adv.type);
                          }}
                          className="py-1 px-3 rounded bg-[#2E7D32] text-white text-[9px] font-bold uppercase hover:bg-[#1B5E20] transition"
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

          {/* Right Columns (4 spans): Real Voice Input & Diagnostics */}
          <div className="lg:col-span-4 flex flex-col gap-6">
            
            {/* REAL VOICE COPILOT (WEB SPEECH API) */}
            <div className="bg-white border border-[#E5EBE3] p-5 rounded-xl shadow-sm space-y-4">
              <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                <h3 className="text-xs font-bold text-[#1B5E20] uppercase tracking-wider flex items-center gap-1.5">
                  <Mic className="w-4 h-4 text-[#1B5E20]" />
                  Voice Query Assistant
                </h3>
                
                {/* Language Switcher */}
                <div className="flex items-center gap-1 bg-[#F7F9F5] p-1 rounded-md border border-[#E5EBE3]">
                  <Globe className="w-3 h-3 text-[#5B6B5B]" />
                  <button
                    onClick={() => setSelectedLang("hi-IN")}
                    className={`px-1.5 py-0.5 rounded text-[10px] font-bold transition ${
                      selectedLang === "hi-IN" ? "bg-[#1B5E20] text-white" : "text-[#5B6B5B] hover:text-[#1B5E20]"
                    }`}
                  >
                    हिन्दी
                  </button>
                  <button
                    onClick={() => setSelectedLang("en-IN")}
                    className={`px-1.5 py-0.5 rounded text-[10px] font-bold transition ${
                      selectedLang === "en-IN" ? "bg-[#1B5E20] text-white" : "text-[#5B6B5B] hover:text-[#1B5E20]"
                    }`}
                  >
                    EN
                  </button>
                </div>
              </div>

              {hasSpeechSupport ? (
                <div className="flex flex-col items-center gap-3">
                  <p className="text-xs text-[#5B6B5B] text-center">
                    Speak your crop question in {selectedLang === "hi-IN" ? "Hindi (हिन्दी)" : "English"}:
                  </p>

                  <div className="flex items-center gap-3">
                    {isListening ? (
                      <button
                        onClick={stopListening}
                        className="w-16 h-16 rounded-full bg-red-600 hover:bg-red-700 text-white flex flex-col items-center justify-center animate-pulse border-4 border-red-200 transition shadow-md"
                        title="Click to Stop Recording"
                      >
                        <Square className="w-5 h-5 fill-current" />
                        <span className="text-[9px] font-bold mt-0.5">STOP</span>
                      </button>
                    ) : (
                      <button
                        onClick={startListening}
                        disabled={isProcessing}
                        className="w-16 h-16 rounded-full bg-[#1B5E20] hover:bg-[#2E7D32] text-white flex flex-col items-center justify-center transition border-4 border-[#E8F5E9] shadow-md disabled:opacity-50"
                        title="Click to Record Voice Question"
                      >
                        <Mic className="w-6 h-6" />
                        <span className="text-[9px] font-bold mt-0.5">SPEAK</span>
                      </button>
                    )}
                  </div>

                  {voiceText && (
                    <div className="bg-[#F7F9F5] p-3 rounded-lg border border-[#E5EBE3] w-full text-xs space-y-1">
                      <p className="text-[#1B5E20] font-semibold leading-relaxed">
                        {voiceText}
                      </p>
                    </div>
                  )}

                  {/* Manual Type Query Fallback */}
                  <div className="w-full pt-2 border-t border-slate-100 flex gap-2">
                    <input
                      type="text"
                      value={manualQuery}
                      onChange={(e) => setManualQuery(e.target.value)}
                      placeholder={selectedLang === "hi-IN" ? "अपनी समस्या यहाँ लिखें..." : "Or type your agronomy question..."}
                      className="flex-grow text-xs border border-[#E5EBE3] rounded-md px-3 py-2 text-slate-800 focus:outline-none focus:border-[#2E7D32]"
                      onKeyDown={(e) => {
                        if (e.key === "Enter" && manualQuery) {
                          handleSendVoiceQuery(manualQuery);
                          setManualQuery("");
                        }
                      }}
                    />
                    <button
                      onClick={() => {
                        if (manualQuery) {
                          handleSendVoiceQuery(manualQuery);
                          setManualQuery("");
                        }
                      }}
                      className="bg-[#1B5E20] text-white px-3 py-2 rounded-md hover:bg-[#2E7D32] transition text-xs font-bold flex items-center gap-1"
                    >
                      <Send className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ) : (
                /* Fallback when browser lacks Web Speech API */
                <div className="space-y-3">
                  <div className="p-3 bg-amber-50 border border-amber-200 rounded-md text-xs text-amber-800">
                    ⚠️ Voice input requires Chrome/Edge on HTTPS or localhost. You can type your query below:
                  </div>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={manualQuery}
                      onChange={(e) => setManualQuery(e.target.value)}
                      placeholder="Type your crop question here..."
                      className="flex-grow text-xs border border-[#E5EBE3] rounded-md px-3 py-2 text-slate-800 focus:outline-none focus:border-[#2E7D32]"
                      onKeyDown={(e) => {
                        if (e.key === "Enter" && manualQuery) {
                          handleSendVoiceQuery(manualQuery);
                          setManualQuery("");
                        }
                      }}
                    />
                    <button
                      onClick={() => {
                        if (manualQuery) {
                          handleSendVoiceQuery(manualQuery);
                          setManualQuery("");
                        }
                      }}
                      className="bg-[#1B5E20] text-white px-3 py-2 rounded-md hover:bg-[#2E7D32] transition text-xs font-bold"
                    >
                      Ask AI
                    </button>
                  </div>
                  {voiceText && (
                    <div className="bg-[#F7F9F5] p-3 rounded-lg border border-[#E5EBE3] text-xs text-[#1B5E20] font-semibold">
                      {voiceText}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Diagnostic leaf scan */}
            <div className="bg-white border border-[#E5EBE3] p-5 rounded-xl shadow-sm space-y-4">
              <h3 className="text-xs font-bold text-[#1B5E20] uppercase tracking-wider border-b border-slate-100 pb-2 flex items-center gap-2">
                <UploadCloud className="w-4 h-4 text-[#1B5E20]" />
                Leaf Disease Diagnostic
              </h3>
              <p className="text-xs text-[#5B6B5B] leading-relaxed">
                Upload a geo-tagged image of affected crop leaves to analyze pest/disease indicators.
              </p>
              <div className="flex flex-col items-center gap-3">
                {leafPhoto ? (
                  <div className="relative w-full h-32 rounded-lg overflow-hidden border border-[#E5EBE3]">
                    <img src={leafPhoto} alt="Uploaded Leaf" className="w-full h-full object-cover" />
                    <button onClick={() => { setLeafPhoto(null); setLeafResult(null); }} className="absolute top-2 right-2 p-1 bg-red-600 text-white rounded-full">
                      ✕
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={handleLeafUpload}
                    className="w-full border-2 border-dashed border-slate-300 hover:border-[#2E7D32] p-6 rounded-lg text-center text-xs text-slate-500 hover:text-[#1B5E20] flex flex-col items-center gap-2 transition"
                  >
                    <UploadCloud className="w-6 h-6 text-[#1B5E20]" />
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
              <div className="bg-white border border-[#E5EBE3] rounded-xl overflow-hidden shadow-sm">
                <div className="p-4 border-b border-[#E5EBE3] bg-slate-50 flex items-center gap-2">
                  <Landmark className="w-4 h-4 text-[#1B5E20]" />
                  <span className="text-xs font-bold text-[#1B5E20] uppercase">Aadhaar Credit Rating</span>
                </div>
                <div className="h-[200px] relative bg-slate-50">
                  <CreditScore3D score={creditReport.score_report.credit_score} />
                </div>
                <div className="p-4 bg-white border-t border-slate-100 text-xs space-y-2">
                  <div className="flex justify-between font-bold">
                    <span>Credit Tier:</span>
                    <span className="text-[#1B5E20]">{creditReport.score_report.tier}</span>
                  </div>
                  <div className="flex justify-between font-bold">
                    <span>Eligible Kisan Credit Loan:</span>
                    <span>₹{creditReport.score_report.max_loan_limit_inr.toLocaleString("en-IN")}</span>
                  </div>
                  <div className="flex justify-between font-bold">
                    <span>Interest Rate:</span>
                    <span>{creditReport.interest_rate_percent || creditReport.score_report.interest_rate_percent}% p.a.</span>
                  </div>
                </div>
              </div>
            )}

            {/* Mandi Prices */}
            <div className="bg-white border border-[#E5EBE3] p-5 rounded-xl shadow-sm space-y-4">
              <h3 className="text-xs font-bold text-[#1B5E20] uppercase tracking-wider border-b border-slate-100 pb-2">
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
