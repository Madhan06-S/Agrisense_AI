"use client";

import Link from "next/link";
import { Mic } from "lucide-react";

export default function FloatingVoiceCopilot() {
  return (
    <Link
      href="/dashboard/farmer/copilot"
      className="fixed bottom-6 right-6 z-40 w-10 h-10 bg-slate-900 hover:bg-slate-800 text-white rounded-full shadow-md border border-slate-700 flex items-center justify-center transition-all group"
      title="Voice Copilot"
    >
      <Mic className="w-4 h-4" />
      <span className="absolute -top-7 right-0 bg-slate-800 text-white type-xs font-semibold px-2 py-0.5 rounded shadow opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap">
        Voice Copilot
      </span>
    </Link>
  );
}

