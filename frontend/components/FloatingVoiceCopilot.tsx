"use client";

import Link from "next/link";
import { Mic } from "lucide-react";

export default function FloatingVoiceCopilot() {
  return (
    <Link
      href="/dashboard/farmer/copilot"
      className="fixed bottom-6 right-6 z-40 w-14 h-14 bg-[#1B5E20] hover:bg-green-800 text-white rounded-full shadow-lg border-2 border-white flex items-center justify-center transition-transform hover:scale-105 active:scale-95 group"
      title="Open AI Voice Copilot 🎙"
    >
      <Mic className="w-6 h-6 animate-pulse" />
      <span className="absolute -top-8 right-0 bg-slate-800 text-white text-[10px] font-bold px-2 py-0.5 rounded shadow opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap">
        Voice Copilot 🎙
      </span>
    </Link>
  );
}
