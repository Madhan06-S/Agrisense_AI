"use client";

import { AlertTriangle, CheckCircle, XCircle } from "lucide-react";

interface TrafficLightProps {
  light: "green" | "yellow" | "red";
  score: number;
  message: string;
  size?: "sm" | "md" | "lg";
}

export default function TrafficLight({ light, score, message, size = "md" }: TrafficLightProps) {
  const sizes = {
    sm: { wrapper: "gap-2", circle: "w-8 h-8", icon: "w-4 h-4", text: "text-xs" },
    md: { wrapper: "gap-3", circle: "w-12 h-12", icon: "w-6 h-6", text: "text-sm" },
    lg: { wrapper: "gap-4", circle: "w-20 h-20", icon: "w-10 h-10", text: "text-base" },
  };

  const s = sizes[size];

  const lights = [
    {
      color: "red",
      active: light === "red",
      icon: <AlertTriangle className={s.icon} />,
      label: "Severe Damage",
      bg: "bg-red-100 border-red-300",
      activeBg: "bg-red-500 border-red-600 shadow-red-200",
      text: "text-red-700",
    },
    {
      color: "yellow",
      active: light === "yellow",
      icon: <AlertTriangle className={s.icon} />,
      label: "Review Required",
      bg: "bg-amber-100 border-amber-300",
      activeBg: "bg-amber-500 border-amber-600 shadow-amber-200",
      text: "text-amber-700",
    },
    {
      color: "green",
      active: light === "green",
      icon: <CheckCircle className={s.icon} />,
      label: "No Significant Damage",
      bg: "bg-green-100 border-green-300",
      activeBg: "bg-green-500 border-green-600 shadow-green-200",
      text: "text-green-700",
    },
  ];

  return (
    <div className="bg-white border border-slate-200 rounded-lg p-5">
      <h3 className="text-sm font-semibold text-slate-900 uppercase tracking-wider mb-4">
        AI Decision — Traffic Light
      </h3>
      
      <div className={`flex items-center justify-center ${s.wrapper} mb-4`}>
        {lights.map((l) => (
          <div
            key={l.color}
            className={`relative flex items-center justify-center rounded-full border-2 transition-all duration-500 ${
              l.active ? `${l.activeBg} text-white shadow-lg scale-110` : `${l.bg} ${l.text} opacity-40`
            } ${s.circle}`}
          >
            {l.icon}
            {l.active && (
              <span className="absolute -top-1 -right-1 w-3 h-3 bg-white rounded-full border-2 border-slate-300 animate-pulse" />
            )}
          </div>
        ))}
      </div>

      <div className="text-center space-y-1">
        <div className={`inline-flex items-center gap-2 px-3 py-1 rounded-full text-sm font-semibold ${
          light === "red" ? "bg-red-50 text-red-700 border border-red-200" :
          light === "yellow" ? "bg-amber-50 text-amber-700 border border-amber-200" :
          "bg-green-50 text-green-700 border border-green-200"
        }`}>
          {light === "red" && <XCircle className="w-4 h-4" />}
          {light === "yellow" && <AlertTriangle className="w-4 h-4" />}
          {light === "green" && <CheckCircle className="w-4 h-4" />}
          {light.toUpperCase()} — Score: {score}/100
        </div>
        <p className="text-xs text-slate-500 mt-2">{message}</p>
      </div>

      {light === "red" && (
        <div className="mt-3 p-2.5 bg-red-50 border border-red-200 rounded-md text-xs text-red-800">
          <strong>Auto-approve eligible.</strong> Officer confirmation required for payout release.
        </div>
      )}
      {light === "yellow" && (
        <div className="mt-3 p-2.5 bg-amber-50 border border-amber-200 rounded-md text-xs text-amber-800">
          <strong>Manual review required.</strong> Please verify satellite and farmer evidence before deciding.
        </div>
      )}
      {light === "green" && (
        <div className="mt-3 p-2.5 bg-green-50 border border-green-200 rounded-md text-xs text-green-800">
          <strong>Auto-close eligible.</strong> No significant damage detected across all three sources.
        </div>
      )}
    </div>
  );
}
