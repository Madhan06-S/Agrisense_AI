import React from "react";
import { CheckCircle, AlertTriangle, XCircle } from "lucide-react";

interface TrafficLightProps {
  light: "green" | "yellow" | "red";
  score: number;
  message: string;
  size?: "sm" | "md" | "lg";
}

export default function TrafficLight({
  light,
  score,
  message,
  size = "md",
}: TrafficLightProps) {
  const isRed = light === "red";
  const isYellow = light === "yellow";
  const isGreen = light === "green";

  const sizeClasses = {
    sm: "w-8 h-8",
    md: "w-12 h-12",
    lg: "w-16 h-16",
  };

  return (
    <div className="bg-white border border-slate-200 rounded-lg p-6 flex flex-col items-center">
      <div className="flex gap-4 mb-4">
        {/* Red light */}
        <div
          className={`rounded-full flex items-center justify-center transition-all ${
            sizeClasses[size]
          } ${
            isRed
              ? "bg-red-600 text-white scale-110 ring-4 ring-red-100"
              : "bg-red-100 text-red-400 opacity-40"
          }`}
        >
          <XCircle className="w-6 h-6" />
        </div>

        {/* Yellow light */}
        <div
          className={`rounded-full flex items-center justify-center transition-all ${
            sizeClasses[size]
          } ${
            isYellow
              ? "bg-amber-500 text-white scale-110 ring-4 ring-amber-100"
              : "bg-amber-100 text-amber-500 opacity-40"
          }`}
        >
          <AlertTriangle className="w-6 h-6" />
        </div>

        {/* Green light */}
        <div
          className={`rounded-full flex items-center justify-center transition-all ${
            sizeClasses[size]
          } ${
            isGreen
              ? "bg-green-600 text-white scale-110 ring-4 ring-green-100"
              : "bg-green-100 text-green-500 opacity-40"
          }`}
        >
          <CheckCircle className="w-6 h-6" />
        </div>
      </div>

      <div className="mb-4">
        {isRed && (
          <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold bg-red-50 text-red-800 border border-red-200">
            <XCircle className="w-3.5 h-3.5" /> RED — Score: {score}/100
          </span>
        )}
        {isYellow && (
          <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold bg-amber-50 text-amber-800 border border-amber-200">
            <AlertTriangle className="w-3.5 h-3.5" /> YELLOW — Score: {score}/100
          </span>
        )}
        {isGreen && (
          <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold bg-green-50 text-green-800 border border-green-200">
            <CheckCircle className="w-3.5 h-3.5" /> GREEN — Score: {score}/100
          </span>
        )}
      </div>

      <p className="text-sm font-semibold text-slate-800 text-center mb-4">
        {message}
      </p>

      <div className="w-full">
        {isRed && (
          <div className="bg-red-50 border border-red-200 text-red-800 text-xs font-medium rounded-md p-3.5 text-center">
            Auto-approve eligible. Officer confirmation required for payout release.
          </div>
        )}
        {isYellow && (
          <div className="bg-amber-50 border border-amber-200 text-amber-800 text-xs font-medium rounded-md p-3.5 text-center">
            Manual review required. Please verify satellite and farmer evidence before deciding.
          </div>
        )}
        {isGreen && (
          <div className="bg-green-50 border border-green-200 text-green-800 text-xs font-medium rounded-md p-3.5 text-center">
            Auto-close eligible. No significant damage detected across all three sources.
          </div>
        )}
      </div>
    </div>
  );
}
