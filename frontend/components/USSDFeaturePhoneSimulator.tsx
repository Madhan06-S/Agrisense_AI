"use client";

import React, { useState } from "react";
import { Smartphone, Send, RotateCcw, Volume2, Globe } from "lucide-react";

interface USSDResponse {
  status: string;
  code: string;
  message: string;
  char_count: number;
}

export default function USSDFeaturePhoneSimulator() {
  const [selectedCode, setSelectedCode] = useState<string>("1");
  const [selectedLang, setSelectedLang] = useState<"en-IN" | "hi-IN" | "ta-IN">("hi-IN");
  const [loading, setLoading] = useState(false);
  const [response, setResponse] = useState<USSDResponse | null>({
    status: "success",
    code: "1",
    message: "एग्रीसेंस [1]: खेत #1 धान NDVI 0.58। फसल स्थिति: स्वस्थ। नमी 38%।",
    char_count: 60
  });

  const sendUSSDCode = async (codeStr: string) => {
    setSelectedCode(codeStr);
    setLoading(true);
    try {
      const res = await fetch("http://localhost:8000/api/v1/sms/ussd", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mobile: "+919876543210",
          code: codeStr,
          language: selectedLang
        })
      });
      if (res.ok) {
        const data = await res.json();
        setResponse(data);
      }
    } catch (err) {
      setResponse({
        status: "error",
        code: codeStr,
        message: `AgriSense USSD [${codeStr}]: Offline mode fallback. Farm NDVI 0.58 healthy.`,
        char_count: 72
      });
    } finally {
      setLoading(false);
    }
  };

  const speakText = (text: string) => {
    if (typeof window !== "undefined" && "speechSynthesis" in window) {
      window.speechSynthesis.cancel();
      const uttr = new SpeechSynthesisUtterance(text);
      uttr.lang = selectedLang;
      window.speechSynthesis.speak(uttr);
    }
  };

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-3xl p-5 text-white shadow-2xl space-y-4 max-w-sm mx-auto font-sans">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-slate-800 pb-3">
        <div className="flex items-center gap-2">
          <Smartphone className="w-5 h-5 text-emerald-400" />
          <h3 className="text-xs font-bold uppercase tracking-wider text-emerald-300">
            Feature Phone USSD Simulator (*999#)
          </h3>
        </div>
        <select
          value={selectedLang}
          onChange={(e) => {
            const l = e.target.value as any;
            setSelectedLang(l);
            sendUSSDCode(selectedCode);
          }}
          className="bg-slate-800 text-xs font-bold text-emerald-300 px-2 py-1 rounded border border-slate-700 focus:outline-none"
        >
          <option value="en-IN">EN</option>
          <option value="hi-IN">हिंदी</option>
          <option value="ta-IN">தமிழ்</option>
        </select>
      </div>

      {/* Feature Phone Screen Frame */}
      <div className="bg-[#8ba888] text-slate-950 p-4 rounded-xl font-mono shadow-inner border-4 border-slate-800 space-y-2 min-h-[140px] flex flex-col justify-between relative overflow-hidden">
        {/* Screen Status Bar */}
        <div className="flex justify-between text-[10px] font-bold border-b border-slate-800/20 pb-1">
          <span>📶 GSM SMS</span>
          <span>&lt; 160 chars</span>
        </div>

        {/* Message Output */}
        <div className="py-2">
          {loading ? (
            <p className="text-xs font-bold animate-pulse text-center">Dispatching USSD Code *999*{selectedCode}# ...</p>
          ) : (
            <p className="text-xs font-bold leading-relaxed">{response?.message}</p>
          )}
        </div>

        {/* Character Counter & Speaker button */}
        <div className="flex justify-between items-center text-[10px] font-bold border-t border-slate-800/20 pt-1">
          <span className={`${(response?.char_count || 0) <= 160 ? "text-slate-900" : "text-red-700 font-extrabold"}`}>
            Length: {response?.char_count || 0} / 160 chars
          </span>
          {response?.message && (
            <button
              onClick={() => speakText(response.message)}
              className="px-2 py-0.5 bg-slate-900 text-emerald-400 rounded text-[9px] font-bold hover:bg-slate-800 flex items-center gap-1 cursor-pointer"
            >
              <Volume2 className="w-3 h-3" /> Listen
            </button>
          )}
        </div>
      </div>

      {/* Shortcode Options Keypad Grid */}
      <div className="space-y-2">
        <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Press Shortcode Button:</p>
        <div className="grid grid-cols-2 gap-2">
          {[
            { code: "1", label: "1: Farm Status", icon: "🌾" },
            { code: "2", label: "2: Claim Status", icon: "📄" },
            { code: "3", label: "3: Weather", icon: "🌧" },
            { code: "4", label: "4: Mandi Prices", icon: "💰" }
          ].map((item) => (
            <button
              key={item.code}
              onClick={() => sendUSSDCode(item.code)}
              disabled={loading}
              className={`py-3 px-3 rounded-xl border text-xs font-bold transition-all flex items-center justify-between cursor-pointer ${
                selectedCode === item.code
                  ? "bg-emerald-600 text-white border-emerald-500 shadow-md"
                  : "bg-slate-800 text-slate-200 border-slate-700 hover:bg-slate-700"
              }`}
            >
              <span>{item.label}</span>
              <span>{item.icon}</span>
            </button>
          ))}
        </div>
      </div>

      <p className="text-[10px] text-slate-500 text-center italic">
        GSM SMS/USSD Gateway Protocol — Works on basic ₹800 feature phones without internet.
      </p>
    </div>
  );
}
