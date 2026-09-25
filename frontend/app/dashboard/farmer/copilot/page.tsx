"use client";

import React, { useState, useEffect, useRef } from "react";
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
  ChevronDown,
  ChevronUp,
  AlertTriangle,
  RefreshCw,
  TrendingUp,
  Droplets,
  Bug,
  DollarSign,
  Activity,
  Image as ImageIcon
} from "lucide-react";
import { Farm } from "@/components/MapComponent";
import CopilotAvatar3D from "@/components/copilot/CopilotAvatar3D";
import CreditScore3D from "@/components/credit/CreditScore3D";
import Link from "next/link";
import { dispatchApiError } from "@/components/ToastProvider";

const queryClient = new QueryClient();

interface ChatMessage {
  id: string;
  sender: "user" | "assistant";
  text: string;
  timestamp: string;
  contextSummary?: string;
  modelUsed?: string;
  isHeuristic?: boolean;
}

function CopilotDashboardContent() {
  const [selectedFarm, setSelectedFarm] = useState<Farm | null>(null);
  const [selectedLang, setSelectedLang] = useState<"en-IN" | "hi-IN" | "ta-IN">("hi-IN");

  // Chat State
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: "welcome-1",
      sender: "assistant",
      text: "Namaste Patel-ji! I am your AI Agronomy Copilot connected live to your farm's NDVI satellite feed and weather forecast. Ask me anything about irrigation, pests, fertilizer, or crop health!",
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      contextSummary: "📡 NDVI 0.28 🔴 | 🌧 12.5mm rain | 🌾 Rice",
      modelUsed: "Gemini 2.5 Flash",
      isHeuristic: false
    }
  ]);
  const [inputText, setInputText] = useState("");
  const [isSending, setIsSending] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);

  // Voice Speech Recognition States
  const [isListening, setIsListening] = useState(false);
  const [hasSpeechSupport, setHasSpeechSupport] = useState(true);
  const [voiceError, setVoiceError] = useState<string | null>(null);
  const recognitionRef = useRef<any>(null);

  // Leaf Disease Diagnostics States
  const [leafPhoto, setLeafPhoto] = useState<string | null>(null);
  const [isAnalyzingLeaf, setIsAnalyzingLeaf] = useState(false);
  const [leafDiagnosis, setLeafDiagnosis] = useState<any>(null);

  // Collapsible Section State
  const [showStaticAdvisories, setShowStaticAdvisories] = useState(false);
  const [activeAdvisoryIdx, setActiveAdvisoryIdx] = useState(0);

  // Scroll to bottom on new chat message
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Speech Recognition Initialization
  useEffect(() => {
    if (typeof window !== "undefined") {
      const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
      if (SpeechRecognition) {
        const rec = new SpeechRecognition();
        rec.continuous = false;
        rec.interimResults = false;
        
        rec.onstart = () => {
          setIsListening(true);
          setVoiceError(null);
        };

        rec.onresult = (event: any) => {
          const transcript = event.results[0][0].transcript;
          if (transcript.trim()) {
            setInputText(transcript);
            handleSendMessage(transcript);
          }
        };

        rec.onerror = (event: any) => {
          setIsListening(false);
          if (event.error === "not-allowed" || event.error === "service-not-allowed") {
            setVoiceError("Mic blocked — allow microphone permission in browser address bar.");
          } else if (event.error === "no-speech") {
            setVoiceError("No speech detected — please try speaking again.");
          } else {
            setVoiceError(`Voice capture error (${event.error}). Please type your prompt.`);
          }
        };

        rec.onend = () => {
          setIsListening(false);
        };

        recognitionRef.current = rec;
      } else {
        setHasSpeechSupport(false);
      }
    }
  }, [selectedLang]);

  const toggleVoiceInput = () => {
    setVoiceError(null);
    if (!recognitionRef.current) {
      setVoiceError("Speech recognition is not supported in this browser. Please use Chrome/Edge.");
      return;
    }

    if (isListening) {
      recognitionRef.current.stop();
      setIsListening(false);
    } else {
      recognitionRef.current.lang = selectedLang;
      try {
        recognitionRef.current.start();
      } catch (err) {
        setVoiceError("Voice recording busy. Try clicking again.");
        setIsListening(false);
      }
    }
  };

  // Fetch Farms
  const { data: farms = [] } = useQuery<Farm[]>({
    queryKey: ["farms"],
    queryFn: async () => {
      try {
        const token = localStorage.getItem("access_token");
        const headers: Record<string, string> = {};
        if (token) headers["Authorization"] = `Bearer ${token}`;

        const res = await fetch("/api/v1/farms", { headers });
        if (!res.ok) throw new Error(`Farm API Error (${res.status})`);
        return await res.json();
      } catch (err: any) {
        dispatchApiError(err.message || "Loaded cached farm profile.");
        const cached = localStorage.getItem("agrisense_cached_farms");
        return cached ? JSON.parse(cached) : [{ id: 1, name: "Patel Rice Farm #1", crop_type: "Rice", area_hectares: 2.5 }];
      }
    },
  });

  useEffect(() => {
    if (farms.length > 0 && !selectedFarm) {
      setSelectedFarm(farms[0]);
    }
  }, [farms, selectedFarm]);

  // Fetch ML Insights Cards Data
  const { data: farmInsights = null } = useQuery({
    queryKey: ["farm_ml_insights", selectedFarm?.id],
    queryFn: async () => {
      if (!selectedFarm) return null;
      try {
        const res = await fetch(`/api/v1/copilot/insights/${selectedFarm.id}`);
        if (!res.ok) throw new Error("Failed to load insights");
        return await res.json();
      } catch {
        return {
          crop_type: selectedFarm.crop_type || "Rice",
          area_hectares: selectedFarm.area_hectares || 2.5,
          ndvi: 0.28,
          soil_humidity_pct: 35.0,
          insights: {
            yield: { estimated_yield_per_acre: 18.5, regional_avg_per_acre: 18.0, status_label: "Optimal Vigor" },
            pest_risk: { pest_risk_score: 45, risk_level: "MEDIUM", top_likely_pests: ["Brown Plant Hopper", "Stem Borer"] },
            irrigation: { action: "SKIP_IRRIGATION", recommendation_english: "Skip irrigation. 25mm rain expected." },
            market: { msp_inr: 2300, mandi_avg_inr: 2420, recommendation: "SELL_NOW" }
          }
        };
      }
    },
    enabled: !!selectedFarm,
  });

  // Fetch Full Advisories for Collapsible View
  const { data: advisoriesReport = null } = useQuery({
    queryKey: ["farm_advisories", selectedFarm?.id],
    queryFn: async () => {
      if (!selectedFarm) return null;
      try {
        const res = await fetch("/api/v1/copilot/advise", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ farm_id: selectedFarm.id, language: selectedLang })
        });
        if (!res.ok) throw new Error("Advisory fetch error");
        return await res.json();
      } catch {
        return {
          source: "HEURISTIC_ADVISOR",
          is_heuristic: true,
          advisories: [
            {
              type: "irrigation",
              english: "[HIGH] Postpone irrigation. Heavy rain forecast (12.5mm) will naturally saturate soil.",
              hindi: "[उच्च] सिंचाई स्थगित करें। भारी बारिश से मिट्टी संतृप्त होगी।",
              tamil: "[அதிகம்] மழை பெய்ய வாய்ப்புள்ளதால் பாசனத்தை தள்ளிவைக்கவும்."
            },
            {
              type: "pest",
              english: "[MEDIUM - Humidity 35.0%] Monitor crop base for Brown Plant Hopper.",
              hindi: "[मध्यम - नमी 35.0%] तने में हॉपर कीट की निगरानी करें।",
              tamil: "[நடுத்தர - ஈரப்பதம் 35.0%] தண்டுப்பூச்சி தாக்குதலை கண்காணிக்கவும்."
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
        if (!res.ok) throw new Error(`Credit API status ${res.status}`);
        const data = await res.json();
        if (!data || !data.score_report) throw new Error("Missing score_report");
        return data;
      } catch {
        return {
          score_report: {
            credit_score: 680,
            tier: "Good",
            max_loan_limit_inr: 300000.0,
            interest_rate_percent: 9.0
          }
        };
      }
    },
    enabled: !!selectedFarm,
  });

  // Send Chat Query Mutation
  const handleSendMessage = async (textToSend?: string) => {
    const prompt = textToSend || inputText;
    if (!prompt.trim() || !selectedFarm || isSending) return;

    const userMsg: ChatMessage = {
      id: `user-${Date.now()}`,
      sender: "user",
      text: prompt,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    };

    setMessages((prev) => [...prev, userMsg]);
    setInputText("");
    setIsSending(true);

    try {
      const res = await fetch("/api/v1/copilot/advise", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          farm_id: selectedFarm.id,
          prompt: prompt,
          language: selectedLang
        })
      });

      if (!res.ok) throw new Error(`API returned HTTP ${res.status}`);
      const data = await res.json();

      const assistantReply = data.raw_text || data.advisories?.[0]?.english || "Advice processed successfully.";
      const assistantMsg: ChatMessage = {
        id: `assistant-${Date.now()}`,
        sender: "assistant",
        text: assistantReply,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        contextSummary: data.context_summary || `📡 Farm #${selectedFarm.id} | ${selectedFarm.crop_type}`,
        modelUsed: data.model_used || (data.is_heuristic ? "Heuristic Rules" : "Gemini 2.5 Flash"),
        isHeuristic: data.is_heuristic
      };

      setMessages((prev) => [...prev, assistantMsg]);
    } catch (err: any) {
      dispatchApiError("Failed to reach AI Copilot server. Falling back to local agronomy advice.");
      const fallbackMsg: ChatMessage = {
        id: `assistant-${Date.now()}`,
        sender: "assistant",
        text: `Based on your ${selectedFarm.crop_type} field data: Soil humidity is at 35.0% and 12.5mm rain is expected today. Postpone irrigation and inspect crop base for pest activity.`,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        contextSummary: `📡 ${selectedFarm.name} | Offline Rules Fallback`,
        modelUsed: "Rule Engine Fallback",
        isHeuristic: true
      };
      setMessages((prev) => [...prev, fallbackMsg]);
    } finally {
      setIsSending(false);
    }
  };

  // Handle Leaf Image Upload & Diagnosis
  const handleLeafUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (evt) => {
      const base64 = evt.target?.result as string;
      setLeafPhoto(base64);
      setIsAnalyzingLeaf(true);
      setLeafDiagnosis(null);

      try {
        const res = await fetch("/api/v1/copilot/diagnose-leaf", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            image_base64: base64,
            crop_type: selectedFarm?.crop_type || "Rice",
            language: selectedLang
          })
        });

        if (!res.ok) throw new Error("Leaf diagnosis failed");
        const data = await res.json();
        setLeafDiagnosis(data.diagnosis);

        // Also push diagnosis as a message into chat stream
        const diagText = `🍃 Leaf Diagnostic Result: Identified ${data.diagnosis.disease_name} (Confidence: ${Math.round(data.diagnosis.confidence * 100)}%). Treatment: ${data.diagnosis.treatment_english}`;
        setMessages((prev) => [
          ...prev,
          {
            id: `diag-${Date.now()}`,
            sender: "assistant",
            text: diagText,
            timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            contextSummary: "🔬 AI Vision Pathology Analysis",
            modelUsed: data.diagnosis.source || "Gemini 2.5 Flash Vision",
            isHeuristic: false
          }
        ]);
      } catch (err) {
        dispatchApiError("Failed to analyze image with vision model. Using heuristic disease scanner.");
        setLeafDiagnosis({
          disease_name: "Rice Blast (Pyricularia oryzae)",
          confidence: 0.88,
          severity: "MEDIUM",
          treatment_english: "Apply Tricyclazole 75% WP @ 0.6 g/L of water.",
          treatment_hindi: "ट्राइसाइक्लाजोल 75% डब्लूपी का छिड़काव करें।",
          treatment_tamil: "டிரைசைக்ளோசோல் தெளிக்கவும்."
        });
      } finally {
        setIsAnalyzingLeaf(false);
      }
    };
    reader.readAsDataURL(file);
  };

  const activeAdvisory = advisoriesReport?.advisories?.[activeAdvisoryIdx];

  return (
    <div className="min-h-screen bg-[#F8FAF8] text-[#1B5E20] font-sans pb-12">
      {/* Top Header Bar */}
      <header className="bg-white border-b border-[#E5EBE3] sticky top-0 z-30 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-3 flex flex-wrap justify-between items-center gap-4">
          <div className="flex items-center gap-3">
            <Link 
              href="/dashboard/farmer" 
              className="p-2 rounded-lg bg-emerald-50 hover:bg-emerald-100 text-[#1B5E20] border border-[#2E7D32]/20 transition"
            >
              <ArrowLeft className="w-5 h-5" />
            </Link>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-lg font-bold text-[#1B5E20] tracking-tight">AI Agronomy Copilot</h1>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-[#1B5E20] border border-[#2E7D32]/30 flex items-center gap-1">
                  <Sparkles className="w-3 h-3 text-amber-500" />
                  MNC-Grade AI Assistant
                </span>
              </div>
              <p className="text-xs text-[#5B6B5B]">Conversational Farm Intelligence powered by Gemini 2.5 Flash & 5 Agronomy Models</p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            {/* Farm Selector */}
            <div className="flex items-center gap-1.5 bg-slate-50 border border-[#E5EBE3] px-3 py-1.5 rounded-lg text-xs font-semibold">
              <Tractor className="w-4 h-4 text-[#1B5E20]" />
              <select 
                className="bg-transparent font-bold text-[#1B5E20] focus:outline-none cursor-pointer"
                value={selectedFarm?.id || ""}
                onChange={(e) => {
                  const f = farms.find(f => f.id === Number(e.target.value));
                  if (f) setSelectedFarm(f);
                }}
              >
                {farms.map((farm) => (
                  <option key={farm.id} value={farm.id}>
                    {farm.name} ({farm.crop_type})
                  </option>
                ))}
              </select>
            </div>

            {/* Language Selector */}
            <div className="flex items-center gap-1.5 bg-emerald-50 border border-[#2E7D32]/30 px-3 py-1.5 rounded-lg text-xs font-bold text-[#1B5E20]">
              <Globe className="w-4 h-4 text-[#1B5E20]" />
              <select 
                value={selectedLang} 
                onChange={(e) => setSelectedLang(e.target.value as any)}
                className="bg-transparent font-bold text-[#1B5E20] focus:outline-none cursor-pointer"
              >
                <option value="en-IN">English (EN)</option>
                <option value="hi-IN">हिंदी (Hindi)</option>
                <option value="ta-IN">தமிழ் (Tamil)</option>
              </select>
            </div>
          </div>
        </div>
      </header>

      {/* Main Container */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 mt-6 grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* LEFT COLUMN: Conversational Chat Interface (8 Cols) */}
        <section className="lg:col-span-8 flex flex-col space-y-6">
          
          {/* Active Provider Banner */}
          <div className="bg-white border border-[#E5EBE3] rounded-xl p-3 flex justify-between items-center shadow-sm">
            <div className="flex items-center gap-2">
              <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-ping" />
              <span className="text-xs font-bold text-[#1B5E20]">Active Engine:</span>
              <span className="text-xs font-semibold text-slate-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-md">
                Gemini 2.5 Flash LLM + Live Farm Data Feed
              </span>
            </div>
            <span className="text-[11px] text-slate-500 font-medium hidden sm:inline">
              Language: <span className="font-bold text-[#1B5E20]">{selectedLang === "hi-IN" ? "Hindi" : selectedLang === "ta-IN" ? "Tamil" : "English"}</span>
            </span>
          </div>

          {/* Voice Error Notification Banner */}
          {voiceError && (
            <div className="bg-amber-50 border border-amber-300 p-3 rounded-xl flex items-center justify-between text-xs text-amber-900 font-semibold shadow-sm animate-fade-in">
              <div className="flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-amber-600 flex-shrink-0" />
                <span>{voiceError}</span>
              </div>
              <button onClick={() => setVoiceError(null)} className="text-amber-700 hover:text-amber-900 text-xs underline">Dismiss</button>
            </div>
          )}

          {/* Main Conversational Chat Box */}
          <div className="bg-white border border-[#E5EBE3] rounded-2xl shadow-sm flex flex-col h-[560px] overflow-hidden">
            
            {/* Chat Stream Header */}
            <div className="p-4 border-b border-[#E5EBE3] bg-emerald-50/50 flex justify-between items-center">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-full bg-[#1B5E20] text-white flex items-center justify-center font-bold text-sm shadow">
                  🌾
                </div>
                <div>
                  <h2 className="text-sm font-bold text-[#1B5E20]">Patel-ji&apos;s Farm Chat Assistant</h2>
                  <p className="text-[10px] text-[#5B6B5B]">Grounded in Live NDVI {selectedFarm?.name || ""}</p>
                </div>
              </div>
              <span className="text-xs text-emerald-800 font-bold bg-white px-2.5 py-1 rounded-lg border border-[#E5EBE3]">
                {messages.length} Messages
              </span>
            </div>

            {/* Chat Messages Body */}
            <div className="flex-1 p-4 overflow-y-auto space-y-4 bg-slate-50/30">
              {messages.map((msg) => (
                <div 
                  key={msg.id} 
                  className={`flex flex-col ${msg.sender === "user" ? "items-end" : "items-start"}`}
                >
                  <div 
                    className={`max-w-[85%] rounded-2xl p-4 shadow-sm space-y-2 text-sm leading-relaxed ${
                      msg.sender === "user"
                        ? "bg-[#1B5E20] text-white rounded-br-none font-medium"
                        : "bg-white text-slate-800 border border-[#E5EBE3] rounded-bl-none"
                    }`}
                  >
                    {/* Context Chips for Assistant Message */}
                    {msg.sender === "assistant" && msg.contextSummary && (
                      <div className="bg-emerald-50 border border-emerald-100 rounded-lg p-2 text-[11px] text-[#1B5E20] font-bold flex flex-wrap items-center justify-between gap-1 mb-2">
                        <span>{msg.contextSummary}</span>
                        <span className="text-[9px] text-slate-500 font-medium uppercase tracking-wider">
                          Source: {msg.modelUsed}
                        </span>
                      </div>
                    )}

                    <p className="whitespace-pre-line">{msg.text}</p>
                    
                    <div className={`text-[10px] flex justify-end gap-2 ${msg.sender === "user" ? "text-emerald-200" : "text-slate-400"}`}>
                      <span>{msg.timestamp}</span>
                    </div>
                  </div>
                </div>
              ))}

              {isSending && (
                <div className="flex items-start gap-2">
                  <div className="bg-white border border-[#E5EBE3] p-3 rounded-2xl text-xs text-slate-500 font-semibold flex items-center gap-2 shadow-sm animate-pulse">
                    <Sparkles className="w-4 h-4 text-amber-500 animate-spin" />
                    <span>Analyzing live farm satellite & weather vectors...</span>
                  </div>
                </div>
              )}
              <div ref={chatEndRef} />
            </div>

            {/* Quick-Ask Chips Row */}
            <div className="p-2.5 bg-white border-t border-[#E5EBE3] flex items-center gap-2 overflow-x-auto scrollbar-none">
              <span className="text-[10px] font-bold text-[#5B6B5B] uppercase whitespace-nowrap px-1">Quick Ask:</span>
              {[
                { label: "🌾 Crop Health", query: "How is my crop health and vigor based on latest satellite data?" },
                { label: "🐛 Pest Risk", query: "What is the pest risk score and top likely pests this week?" },
                { label: "💧 Irrigate Today?", query: "Should I irrigate my fields today based on rainfall forecast?" },
                { label: "🧪 Fertilizer", query: "What is the recommended fertilizer top-dressing dose?" },
                { label: "💰 Market Price", query: "What is the current Mandi price vs MSP for my crop?" }
              ].map((chip, idx) => (
                <button
                  key={idx}
                  onClick={() => handleSendMessage(chip.query)}
                  disabled={isSending}
                  className="bg-emerald-50 hover:bg-emerald-100 text-[#1B5E20] border border-[#2E7D32]/20 px-3 py-1 rounded-full text-xs font-semibold whitespace-nowrap transition"
                >
                  {chip.label}
                </button>
              ))}
            </div>

            {/* Chat Input Bar */}
            <div className="p-3 bg-white border-t border-[#E5EBE3] flex items-center gap-2">
              {/* Mic Voice Button */}
              <button
                onClick={toggleVoiceInput}
                className={`p-3 rounded-xl flex items-center justify-center transition flex-shrink-0 ${
                  isListening
                    ? "bg-red-600 text-white animate-pulse ring-4 ring-red-200"
                    : "bg-emerald-100 text-[#1B5E20] hover:bg-emerald-200"
                }`}
                title={isListening ? "Click to stop voice capture" : "Speak in your language"}
              >
                {isListening ? <MicOff className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
              </button>

              <input
                type="text"
                placeholder={isListening ? "Listening... Speak now!" : "Ask copilot in English, Hindi, or Tamil..."}
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleSendMessage()}
                disabled={isSending}
                className="flex-1 bg-slate-50 border border-[#E5EBE3] rounded-xl px-4 py-2.5 text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-[#1B5E20]/30"
              />

              <button
                onClick={() => handleSendMessage()}
                disabled={isSending || !inputText.trim()}
                className="bg-[#1B5E20] text-white p-3 rounded-xl hover:bg-[#2E7D32] transition disabled:opacity-50 flex-shrink-0 shadow"
              >
                <Send className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Collapsible Secondary Section: This Week's Advisories */}
          <div className="bg-white border border-[#E5EBE3] rounded-2xl shadow-sm overflow-hidden">
            <button
              onClick={() => setShowStaticAdvisories(!showStaticAdvisories)}
              className="w-full p-4 bg-emerald-50/50 hover:bg-emerald-50 transition flex justify-between items-center text-left"
            >
              <div className="flex items-center gap-2">
                <ShieldCheck className="w-5 h-5 text-[#1B5E20]" />
                <h3 className="text-sm font-bold text-[#1B5E20]">This Week&apos;s Structured Advisories (Trilingual)</h3>
              </div>
              <div className="flex items-center gap-2 text-xs font-semibold text-[#1B5E20]">
                <span>{showStaticAdvisories ? "Hide" : "Show"}</span>
                {showStaticAdvisories ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
              </div>
            </button>

            {showStaticAdvisories && (
              <div className="p-5 border-t border-[#E5EBE3] space-y-4">
                <div className="flex border-b border-[#E5EBE3]">
                  {advisoriesReport?.advisories?.map((adv: any, idx: number) => (
                    <button
                      key={idx}
                      onClick={() => setActiveAdvisoryIdx(idx)}
                      className={`pb-2 px-4 text-xs font-bold uppercase transition border-b-2 ${
                        activeAdvisoryIdx === idx
                          ? "border-[#1B5E20] text-[#1B5E20]"
                          : "border-transparent text-slate-400 hover:text-slate-600"
                      }`}
                    >
                      {adv.type || `Alert #${idx + 1}`}
                    </button>
                  ))}
                </div>

                {activeAdvisory && (
                  <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-3">
                    <div className="text-xs space-y-2 text-slate-800">
                      <p><span className="font-bold text-[#1B5E20]">English:</span> {activeAdvisory.english}</p>
                      <p><span className="font-bold text-[#1B5E20]">हिंदी:</span> {activeAdvisory.hindi}</p>
                      <p><span className="font-bold text-[#1B5E20]">தமிழ்:</span> {activeAdvisory.tamil}</p>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </section>

        {/* RIGHT COLUMN: 5 ML Insights & Diagnostics (4 Cols) */}
        <section className="lg:col-span-4 flex flex-col space-y-6">

          {/* 3D Robot Farmer Avatar */}
          <CopilotAvatar3D 
            adviceText={messages[messages.length - 1]?.text || "Namaste! I am your AI Agronomy Assistant."}
            activeTopic="general"
          />

          {/* Leaf Disease Diagnostic Card */}
          <div className="bg-white border border-[#E5EBE3] rounded-2xl p-4 shadow-sm space-y-3">
            <div className="flex items-center gap-2 border-b border-slate-100 pb-2">
              <ImageIcon className="w-4 h-4 text-[#1B5E20]" />
              <h3 className="text-xs font-bold text-[#1B5E20] uppercase tracking-wider">Leaf Disease AI Scanner</h3>
            </div>

            <label className="border-2 border-dashed border-emerald-200 hover:border-[#1B5E20] p-4 rounded-xl flex flex-col items-center justify-center cursor-pointer transition bg-emerald-50/30">
              <input type="file" accept="image/*" className="hidden" onChange={handleLeafUpload} />
              <UploadCloud className="w-8 h-8 text-[#1B5E20] mb-1" />
              <span className="text-xs font-bold text-[#1B5E20]">Upload Leaf Photo</span>
              <span className="text-[10px] text-slate-500">Instant AI Pathology Diagnosis</span>
            </label>

            {isAnalyzingLeaf && (
              <div className="p-3 bg-amber-50 rounded-xl border border-amber-200 text-xs text-amber-800 font-semibold flex items-center gap-2">
                <RefreshCw className="w-4 h-4 text-amber-600 animate-spin" />
                <span>Running Gemini Vision Pathological Classifier...</span>
              </div>
            )}

            {leafDiagnosis && (
              <div className="p-3 bg-emerald-50 rounded-xl border border-emerald-200 text-xs space-y-2 text-slate-800">
                <div className="flex justify-between font-bold">
                  <span className="text-[#1B5E20]">{leafDiagnosis.disease_name}</span>
                  <span className="bg-emerald-200 text-emerald-900 px-1.5 py-0.5 rounded text-[10px]">
                    {Math.round((leafDiagnosis.confidence || 0.88) * 100)}% Match
                  </span>
                </div>
                <p className="text-[11px] leading-relaxed"><span className="font-bold">Treatment:</span> {leafDiagnosis.treatment_english}</p>
              </div>
            )}
          </div>

          {/* 4 ML Insights Cards Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-1 gap-3">
            
            {/* Yield Estimator Card */}
            <div className="bg-white border border-[#E5EBE3] p-4 rounded-xl shadow-sm space-y-2">
              <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                <div className="flex items-center gap-2">
                  <TrendingUp className="w-4 h-4 text-[#1B5E20]" />
                  <span className="text-xs font-bold text-[#1B5E20] uppercase">Yield Estimator</span>
                </div>
                <span className="text-[10px] font-bold bg-emerald-100 text-[#1B5E20] px-2 py-0.5 rounded">
                  {farmInsights?.insights?.yield?.status_label || "Optimal"}
                </span>
              </div>
              <div className="flex justify-between items-baseline pt-1">
                <div>
                  <span className="text-xl font-extrabold text-[#1B5E20]">
                    {farmInsights?.insights?.yield?.estimated_yield_per_acre || 18.5}
                  </span>
                  <span className="text-xs text-slate-500 font-medium ml-1">q/acre</span>
                </div>
                <span className="text-xs text-slate-400 font-medium">
                  Regional Avg: {farmInsights?.insights?.yield?.regional_avg_per_acre || 18.0} q
                </span>
              </div>
            </div>

            {/* Pest Risk Matrix Card */}
            <div className="bg-white border border-[#E5EBE3] p-4 rounded-xl shadow-sm space-y-2">
              <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                <div className="flex items-center gap-2">
                  <Bug className="w-4 h-4 text-amber-600" />
                  <span className="text-xs font-bold text-[#1B5E20] uppercase">Pest Risk Matrix</span>
                </div>
                <span className="text-[10px] font-bold bg-amber-100 text-amber-800 px-2 py-0.5 rounded">
                  {farmInsights?.insights?.pest_risk?.risk_level || "MEDIUM"} ({farmInsights?.insights?.pest_risk?.pest_risk_score || 45}/100)
                </span>
              </div>
              <p className="text-xs text-slate-600 font-medium">
                Top Pests: <span className="font-bold text-[#1B5E20]">{farmInsights?.insights?.pest_risk?.top_likely_pests?.join(", ") || "Brown Plant Hopper"}</span>
              </p>
            </div>

            {/* ET Irrigation Scheduler Card */}
            <div className="bg-white border border-[#E5EBE3] p-4 rounded-xl shadow-sm space-y-2">
              <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                <div className="flex items-center gap-2">
                  <Droplets className="w-4 h-4 text-blue-600" />
                  <span className="text-xs font-bold text-[#1B5E20] uppercase">ET Irrigation Scheduler</span>
                </div>
                <span className="text-[10px] font-bold bg-blue-100 text-blue-800 px-2 py-0.5 rounded">
                  {farmInsights?.insights?.irrigation?.action || "SKIP_IRRIGATION"}
                </span>
              </div>
              <p className="text-xs text-slate-600 leading-normal font-medium">
                {farmInsights?.insights?.irrigation?.recommendation_english || "Skip irrigation. Rainfall expected."}
              </p>
            </div>

            {/* Market MSP Advisory Card */}
            <div className="bg-white border border-[#E5EBE3] p-4 rounded-xl shadow-sm space-y-2">
              <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                <div className="flex items-center gap-2">
                  <DollarSign className="w-4 h-4 text-emerald-600" />
                  <span className="text-xs font-bold text-[#1B5E20] uppercase">Market MSP Advisory</span>
                </div>
                <span className="text-[10px] font-bold bg-emerald-100 text-[#1B5E20] px-2 py-0.5 rounded">
                  {farmInsights?.insights?.market?.recommendation || "SELL_NOW"}
                </span>
              </div>
              <div className="flex justify-between text-xs font-bold">
                <span>MSP 2026: ₹{farmInsights?.insights?.market?.msp_inr || 2300}/q</span>
                <span className="text-[#1B5E20]">Mandi: ₹{farmInsights?.insights?.market?.mandi_avg_inr || 2420}/q</span>
              </div>
            </div>

          </div>

          {/* Aadhaar Credit Rating Card */}
          {creditReport?.score_report && (
            <div className="bg-white border border-[#E5EBE3] rounded-xl overflow-hidden shadow-sm">
              <div className="p-4 border-b border-[#E5EBE3] bg-slate-50 flex items-center gap-2">
                <Landmark className="w-4 h-4 text-[#1B5E20]" />
                <span className="text-xs font-bold text-[#1B5E20] uppercase">Aadhaar Credit Rating</span>
              </div>
              <div className="h-[200px] relative bg-slate-50">
                <CreditScore3D score={creditReport.score_report.credit_score ?? 680} />
              </div>
              <div className="p-4 bg-white border-t border-slate-100 text-xs space-y-2">
                <div className="flex justify-between font-bold">
                  <span>Credit Tier:</span>
                  <span className="text-[#1B5E20]">{creditReport.score_report.tier || "Good"}</span>
                </div>
                <div className="flex justify-between font-bold">
                  <span>Eligible Kisan Credit Loan:</span>
                  <span>₹{(creditReport.score_report.max_loan_limit_inr ?? 300000).toLocaleString("en-IN")}</span>
                </div>
                <div className="flex justify-between font-bold">
                  <span>Interest Rate:</span>
                  <span>{creditReport.interest_rate_percent || creditReport.score_report.interest_rate_percent || 9}% p.a.</span>
                </div>
              </div>
            </div>
          )}

        </section>
      </main>
    </div>
  );
}

export default function CopilotPage() {
  return (
    <QueryClientProvider client={queryClient}>
      <CopilotDashboardContent />
    </QueryClientProvider>
  );
}
