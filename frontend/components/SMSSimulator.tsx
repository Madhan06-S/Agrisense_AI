"use client";

import React, { useEffect, useState } from "react";
import { MessageSquare, X, Smartphone } from "lucide-react";

export default function SMSSimulator() {
  const [sms, setSms] = useState<{ phone: string; message: string; timestamp: number } | null>(null);
  const [visible, setVisible] = useState(true);
  const [minimized, setMinimized] = useState(false);

  useEffect(() => {
    let lastTimestamp = 0;
    
    const checkSMS = async () => {
      try {
        const res = await fetch("http://localhost:8000/api/v1/auth/last-sms");
        if (res.ok) {
          const data = await res.json();
          if (data && data.timestamp && data.timestamp > lastTimestamp) {
            lastTimestamp = data.timestamp;
            setSms(data);
            setVisible(true);
          }
        }
      } catch (err) {
        // Silent error
      }
    };

    // Initial check
    checkSMS();
    const interval = setInterval(checkSMS, 2000);
    return () => clearInterval(interval);
  }, []);

  if (!visible || !sms) return null;

  return (
    <div className="fixed bottom-6 right-6 z-50 transition-all duration-300 font-sans max-w-sm w-[350px]">
      {minimized ? (
        <button 
          onClick={() => setMinimized(false)}
          className="flex items-center gap-2 bg-[#166534] text-white px-4 py-3 rounded-full shadow-lg hover:bg-emerald-800 transition-all text-xs font-semibold animate-bounce"
        >
          <Smartphone className="w-4 h-4" />
          <span>Show SMS Sim</span>
          <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
        </button>
      ) : (
        <div className="bg-white border border-[#E2E8F0] rounded-2xl shadow-2xl overflow-hidden border-t-4 border-t-[#166534]">
          {/* Header */}
          <div className="bg-slate-50 px-4 py-3 border-b border-slate-100 flex items-center justify-between">
            <div className="flex items-center gap-2 text-slate-700">
              <Smartphone className="w-4 h-4 text-[#166534]" />
              <span className="text-xs font-bold uppercase tracking-wider">SMS Simulator (AGRISE)</span>
            </div>
            <div className="flex items-center gap-2">
              <button 
                onClick={() => setMinimized(true)}
                className="text-slate-400 hover:text-slate-600 text-xs px-1.5 py-0.5 rounded hover:bg-slate-100"
              >
                Min
              </button>
              <button 
                onClick={() => setVisible(false)}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* SMS Notification */}
          <div className="p-4 bg-slate-50/50">
            <div className="bg-white border border-slate-200 rounded-xl p-3 shadow-sm flex gap-3">
              <div className="w-8 h-8 rounded-full bg-[#166534]/15 border border-[#166534]/30 flex items-center justify-center shrink-0">
                <MessageSquare className="w-4 h-4 text-[#166534]" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-[11px] font-bold text-slate-800">AGRISE OTP</span>
                  <span className="text-[9px] text-slate-400">Just now</span>
                </div>
                <p className="text-xs text-slate-600 leading-relaxed font-mono select-all bg-slate-50 p-2 rounded border border-slate-100 mt-1.5">
                  {sms.message}
                </p>
                <div className="text-[9px] text-slate-400 mt-2 italic">
                  *Click and copy the 6-digit code to log in.
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
