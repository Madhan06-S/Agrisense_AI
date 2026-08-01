"use client";

import React, { useState } from "react";
import dynamic from "next/dynamic";
import { 
  Play, 
  RotateCw, 
  Download, 
  AlertTriangle, 
  CheckCircle, 
  Activity, 
  Calendar,
  Cloud,
  Layers,
  Database
} from "lucide-react";
import { HoloCard } from "@/components/ui/HoloCard";

// Dynamically import 3D WebGL components to prevent SSR build issues in Next.js
const GlobeViewer = dynamic(() => import("@/components/maps/GlobeViewer"), {
  ssr: false,
  loading: () => (
    <div className="w-full h-[600px] flex items-center justify-center bg-white border border-slate-200 text-slate-800/80 rounded-2xl border border-slate-100">
      <span className="text-slate-500 text-xs animate-pulse">Loading 3D Globe...</span>
    </div>
  )
});

const FarmTerrain3D = dynamic(() => import("@/components/maps/FarmTerrain3D"), {
  ssr: false,
  loading: () => (
    <div className="w-full h-[500px] flex items-center justify-center bg-white border border-slate-200 text-slate-800/80 rounded-2xl border border-slate-100">
      <span className="text-slate-500 text-xs animate-pulse">Loading 3D Terrain Model...</span>
    </div>
  )
});

const Pipeline3D = dynamic(() => import("@/components/animations/Pipeline3D"), {
  ssr: false,
  loading: () => (
    <div className="w-full h-[450px] flex items-center justify-center bg-white border border-slate-200 text-slate-800/80 rounded-2xl border border-slate-100">
      <span className="text-slate-500 text-xs animate-pulse">Loading 3D Pipeline...</span>
    </div>
  )
});

const Damage3DViewer = dynamic(() => import("@/components/claims/Damage3DViewer"), {
  ssr: false,
  loading: () => (
    <div className="w-full h-[480px] flex items-center justify-center bg-white border border-slate-200 text-slate-800/80 rounded-2xl border border-slate-100">
      <span className="text-slate-500 text-xs animate-pulse">Loading 3D Damage Assessor...</span>
    </div>
  )
});

export default function PreprocessingDashboard() {
  const [activeTab, setActiveTab] = useState<"visuals" | "status" | "gaps">("visuals");
  const [pipelineProgress, setPipelineProgress] = useState({
    radiometric: "completed",
    atmospheric: "completed",
    topographic: "completed",
    cloudMask: "completed",
    sarPreprocess: "running",
    reconstruction: "idle"
  });

  // Calendar Heatmap Mock Data: 35 days (5 weeks)
  const heatmapDays = [
    { day: 1, type: "optical", date: "June 01" },
    { day: 2, type: "optical", date: "June 02" },
    { day: 3, type: "sar", date: "June 03" },
    { day: 4, type: "sar", date: "June 04" },
    { day: 5, type: "gap", date: "June 05" },
    { day: 6, type: "interpolated", date: "June 06" },
    { day: 7, type: "interpolated", date: "June 07" },
    { day: 8, type: "optical", date: "June 08" },
    { day: 9, type: "optical", date: "June 09" },
    { day: 10, type: "sar", date: "June 10" },
    { day: 11, type: "sar", date: "June 11" },
    { day: 12, type: "gap", date: "June 12" },
    { day: 13, type: "interpolated", date: "June 13" },
    { day: 14, type: "optical", date: "June 14" },
    { day: 15, type: "optical", date: "June 15" },
    { day: 16, type: "sar", date: "June 16" },
    { day: 17, type: "sar", date: "June 17" },
    { day: 18, type: "gap", date: "June 18" },
    { day: 19, type: "gap", date: "June 19" },
    { day: 20, type: "interpolated", date: "June 20" },
    { day: 21, type: "optical", date: "June 21" },
    { day: 22, type: "optical", date: "June 22" },
    { day: 23, type: "sar", date: "June 23" },
    { day: 24, type: "sar", date: "June 24" },
    { day: 25, type: "interpolated", date: "June 25" },
    { day: 26, type: "optical", date: "June 26" },
    { day: 27, type: "optical", date: "June 27" },
    { day: 28, type: "sar", date: "June 28" },
    { day: 29, type: "sar", date: "June 29" },
    { day: 30, type: "gap", date: "June 30" },
    { day: 31, type: "interpolated", date: "July 01" },
    { day: 32, type: "optical", date: "July 02" },
    { day: 33, type: "optical", date: "July 03" },
    { day: 34, type: "sar", date: "July 04" },
    { day: 35, type: "sar", date: "July 05" }
  ];

  return (
    <main className="min-h-screen bg-[#F8FAFC] text-slate-100 p-8 font-sans">
      
      {/* Dashboard Top Navigation Header */}
      <header className="mb-10 flex flex-col md:flex-row justify-between items-start md:items-center gap-6 pb-6 border-b border-slate-100">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <span className="h-2 w-2 rounded-full bg-[#166534] animate-pulse" />
            <h1 className="text-2xl font-extrabold tracking-wider bg-clip-text text-transparent bg-gradient-to-r from-emerald-400 via-cyan-300 to-blue-500">
              NATIONAL PREPROCESSING & QUALITY HUB
            </h1>
          </div>
          <p className="text-xs text-slate-500 tracking-wide font-medium">
            Immersive 3D data clearing, atmospheric calibrations, and reconstruction telemetry.
          </p>
        </div>

        {/* Global Action Tools */}
        <div className="flex gap-3">
          <button className="flex items-center gap-2 py-2 px-4 rounded-xl text-xs font-semibold bg-[#166534] hover:bg-emerald-600 text-slate-950 transition-colors shadow-lg shadow-emerald-500/20">
            <Play className="w-3.5 h-3.5 fill-current" />
            Trigger Reconstruction
          </button>
          <button className="flex items-center gap-2 py-2 px-4 rounded-xl text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-200 transition-colors">
            <RotateCw className="w-3.5 h-3.5" />
            Re-run Corrections
          </button>
          <button className="flex items-center gap-2 py-2 px-4 rounded-xl text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-200 transition-colors">
            <Download className="w-3.5 h-3.5" />
            Export GeoTIFF Zip
          </button>
        </div>
      </div></div></header>

      {/* Main Grid Section */}
      <section className="grid grid-cols-1 xl:grid-cols-3 gap-8 mb-8">
        
        {/* Left Side: 3D Orbit Globe */}
        <div className="xl:col-span-2">
          <HoloCard title="National Satellites Tracking Globe">
            <GlobeViewer />
          </HoloCard>
        </div>

        {/* Right Side: 3D Flow Platforms */}
        <div className="xl:col-span-1">
          <HoloCard title="3D Pipeline Process flow">
            <Pipeline3D />
          </HoloCard>
        </div>

      </section>

      {/* Bento Layout Grid for Details */}
      <section className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-8 mb-8">
        
        {/* Bento Cell 1: 3D Farm Terrain */}
        <HoloCard title="3D Farmland Vegetation Topography">
          <FarmTerrain3D />
        </HoloCard>

        {/* Bento Cell 2: 3D Damage Viewer */}
        <HoloCard title="3D Damage Heatmap & XGBoost Weights">
          <Damage3DViewer />
        </HoloCard>

        {/* Bento Cell 3: Quality Metrics & Calendar heatmap */}
        <HoloCard title="Temporal Gap Filling Heatmap" flippable={true} backContent={
          <div className="flex flex-col justify-between h-full">
            <div>
              <h4 className="text-xs font-bold text-[#166534] uppercase mb-2">Heatmap Info</h4>
              <p className="text-xs text-slate-700 leading-relaxed">
                Represents data availability grids over a 35-day timeline. Green boxes indicate available optical sensor images. Blue is SAR backscatter data only. Yellow indicates cubic spline/linear interpolated fields. Red indicates unfillable data gaps.
              </p>
            </div>
            <span className="text-[10px] text-slate-500 font-bold uppercase">Click to flip card back</span>
          </div>
        }>
          <div className="flex flex-col gap-4">
            
            {/* Calendar Heatmap Representation */}
            <div className="grid grid-cols-7 gap-2.5 bg-white border border-slate-200 text-slate-800/40 p-4 rounded-xl border border-slate-100">
              {heatmapDays.map((day) => (
                <div 
                  key={day.day}
                  className={`h-7 w-7 rounded flex items-center justify-center text-[10px] font-bold cursor-help transition-all hover:scale-110 ${
                    day.type === "optical" ? "bg-[#166534]/80 text-slate-950 shadow-sm shadow-emerald-500/30" :
                    day.type === "sar" ? "bg-cyan-500/80 text-slate-950" :
                    day.type === "interpolated" ? "bg-yellow-500/80 text-slate-950" :
                    "bg-red-500/80 text-slate-950 animate-pulse"
                  }`}
                  title={`${day.date} - Type: ${day.type}`}
                >
                  {day.day}
                </div>
              ))}
            </div>

            {/* Heatmap Legend */}
            <div className="grid grid-cols-2 gap-2.5 text-[10px] font-semibold tracking-wider">
              <div className="flex gap-2 items-center">
                <div className="w-2.5 h-2.5 rounded bg-[#166534]" />
                <span className="text-slate-700">Optical Available</span>
              </div>
              <div className="flex gap-2 items-center">
                <div className="w-2.5 h-2.5 rounded bg-cyan-500" />
                <span className="text-slate-700">SAR S1 Only</span>
              </div>
              <div className="flex gap-2 items-center">
                <div className="w-2.5 h-2.5 rounded bg-yellow-500" />
                <span className="text-slate-700">Interpolated Data</span>
              </div>
              <div className="flex gap-2 items-center">
                <div className="w-2.5 h-2.5 rounded bg-red-500" />
                <span className="text-slate-700">Severe Gap</span>
              </div>
            </div>

            {/* Statistics details */}
            <div className="mt-4 flex flex-col gap-2.5 border-t border-slate-100 pt-4">
              <div className="flex justify-between items-center text-xs">
                <span className="text-slate-500">Temporal Coverage</span>
                <span className="font-bold text-[#166534]">88.5%</span>
              </div>
              <div className="flex justify-between items-center text-xs">
                <span className="text-slate-500">Interpolation Ratio</span>
                <span className="font-bold text-yellow-400">14.2%</span>
              </div>
              <div className="flex justify-between items-center text-xs">
                <span className="text-slate-500">Unfillable Gaps</span>
                <span className="font-bold text-red-500">4 Gaps</span>
              </div>
            </div>
            
          </div>
        </HoloCard>

      </section>

      {/* Pipeline Status cards row */}
      <section className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-6 gap-6">
        
        {/* Ingestion cards */}
        {Object.entries(pipelineProgress).map(([stage, status], index) => (
          <HoloCard key={stage} className="py-4 px-5">
            <div className="flex justify-between items-center mb-1">
              <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">Stage {index + 1}</span>
              {status === "completed" && <CheckCircle className="w-3.5 h-3.5 text-[#166534]" />}
              {status === "running" && <Activity className="w-3.5 h-3.5 text-yellow-400 animate-pulse" />}
              {status === "idle" && <Database className="w-3.5 h-3.5 text-slate-600" />}
            </div>
            <span className="text-xs font-bold text-slate-200 uppercase tracking-widest block truncate">
              {stage.replace(/([A-Z])/g, " $1")}
            </span>
            <span className={`text-[10px] font-bold block mt-1 uppercase ${
              status === "completed" ? "text-[#166534]" :
              status === "running" ? "text-yellow-400" :
              "text-slate-500"
            }`}>
              {status}
            </span>
          </HoloCard>
        ))}

      </section>
      
    </main>
  );
}
