"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { 
  ArrowRight, 
  Shield, 
  Satellite, 
  Zap,
  Lock,
  MessageSquare,
  Activity,
  Layers,
  Radio,
  CheckCircle,
  Database,
  Globe,
  Sliders,
  Sparkles
} from "lucide-react";

export default function HomePage() {
  const [lang, setLang] = useState<"en" | "hi">("en");
  const [userRole, setUserRole] = useState<string | null>(null);
  const [activeBand, setActiveBand] = useState<"ndvi" | "sar" | "thermal" | "soil">("ndvi");
  const [ndviPulse, setNdviPulse] = useState<number>(0.74);

  useEffect(() => {
    if (typeof window !== "undefined") {
      const role = localStorage.getItem("user_role");
      const token = localStorage.getItem("access_token");
      if (token && role) {
        setUserRole(role);
      }
    }
  }, []);

  useEffect(() => {
    const interval = setInterval(() => {
      setNdviPulse((prev) => +(prev + (Math.random() * 0.04 - 0.02)).toFixed(2));
    }, 3000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="min-h-screen bg-[#F7F9F5] text-slate-900 font-sans flex flex-col justify-between selection:bg-emerald-100 selection:text-emerald-900">
      
      {/* 1. Official Government Dateline Header */}
      <div className="bg-[#144723] text-emerald-100 text-xs px-6 md:px-14 py-2.5 flex justify-between items-center border-b border-emerald-900/50 font-mono">
        <div className="flex items-center gap-3">
          <span className="flex items-center gap-1.5 font-bold text-white tracking-widest uppercase">
            <span className="inline-block w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
            PMFBY Pillar 5 · Parametric Index 2026
          </span>
          <span className="hidden md:inline text-emerald-400/40">|</span>
          <span className="hidden md:inline text-emerald-200/90 text-[11px] font-normal">
            Department of Agriculture & Farmers Welfare · Government of India
          </span>
        </div>
        <div className="flex items-center gap-3 text-xs">
          <button 
            onClick={() => setLang("en")} 
            className={`transition-all px-2 py-0.5 rounded font-mono ${lang === "en" ? "bg-emerald-700 text-white font-bold" : "text-emerald-200/70 hover:text-white"}`}
          >
            EN
          </button>
          <span className="text-emerald-800">|</span>
          <button 
            onClick={() => setLang("hi")} 
            className={`transition-all px-2 py-0.5 rounded font-mono ${lang === "hi" ? "bg-emerald-700 text-white font-bold" : "text-emerald-200/70 hover:text-white"}`}
          >
            हिन्दी
          </button>
        </div>
      </div>

      {/* 2. Main Inspo-Styled Header */}
      <header className="sticky top-0 z-50 bg-white/95 backdrop-blur-md border-b border-slate-200/80 py-4 px-6 md:px-14">
        <div className="max-w-7xl mx-auto flex justify-between items-center">
          <Link href="/" className="flex items-center gap-3 group">
            <div className="p-2 rounded-xl bg-emerald-50 border border-emerald-200 text-[#15803d]">
              <Shield className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-xl font-extrabold text-slate-900 tracking-tight leading-none">
                AgriSense <span className="text-emerald-700">AI</span>
              </h1>
              <p className="text-[10px] font-mono text-slate-400 uppercase tracking-widest mt-1">
                Parametric Satellite Insurance Platform
              </p>
            </div>
          </Link>
          
          <nav className="hidden md:flex items-center gap-8 text-xs font-mono font-bold uppercase tracking-wider text-slate-600">
            <a href="#stat-hero" className="hover:text-emerald-700 transition-colors">01 Index</a>
            <a href="#telemetry" className="hover:text-emerald-700 transition-colors">02 Telemetry</a>
            <a href="#features" className="hover:text-emerald-700 transition-colors">03 Stack</a>
            <a href="#how-it-works" className="hover:text-emerald-700 transition-colors">04 Mechanics</a>
            <a href="#portals" className="hover:text-emerald-700 transition-colors">05 Console</a>
          </nav>

          <div className="flex items-center gap-3">
            {userRole ? (
              <Link 
                href={userRole === 'officer' || userRole === 'admin' ? '/dashboard/officer/claims' : '/dashboard/farmer'} 
                className="bg-[#15803d] hover:bg-[#166534] text-white text-xs font-bold font-mono px-4.5 py-2.5 rounded-xl shadow-xs transition-all flex items-center gap-2"
              >
                Console <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            ) : (
              <Link 
                href="/login" 
                className="bg-[#15803d] hover:bg-[#166534] text-white text-xs font-bold font-mono px-5 py-2.5 rounded-xl shadow-xs transition-all flex items-center gap-2"
              >
                Sign In <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            )}
          </div>
        </div>
      </header>

      {/* 3. Inspo Stat-Led Hero Section */}
      <section id="stat-hero" className="relative bg-white py-14 md:py-20 px-6 md:px-14 border-b border-slate-200/80 agri-grid-pattern">
        <div className="max-w-7xl mx-auto space-y-12">
          
          {/* Stat-Led Archetype Header Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-12 items-end gap-8 border-b border-slate-200/80 pb-12">
            
            {/* Massive Quantified Stat Figure */}
            <div className="lg:col-span-7">
              <div className="flex items-center gap-2 mb-3">
                <span className="w-2 h-2 rounded-full bg-emerald-600"></span>
                <p className="text-xs font-mono text-emerald-800 font-bold uppercase tracking-widest">
                  PMFBY Coverage Index 2026 · Source: PMFBY National Crop Portal (2024-2026)
                </p>
              </div>
              <h1 
                className="font-black text-slate-900 leading-[0.85] tracking-tight tabular-nums"
                style={{ fontSize: "clamp(4.2rem, 10.5vw, 9rem)" }}
              >
                500M<span className="text-emerald-700">+</span>
              </h1>
              <p className="text-[11px] font-mono text-slate-500 mt-2">
                *500M+ Hectares cumulative risk tracked across PMFBY Kharif/Rabi seasons
              </p>
            </div>

            {/* Right Supporting Editorial Title */}
            <div className="lg:col-span-5 lg:pb-2 space-y-4">
              <h2 className="text-2xl md:text-3xl lg:text-4xl font-extrabold text-slate-900 leading-tight text-balance">
                Smallholder farmers de-risked via{" "}
                <em className="italic text-emerald-800 font-serif">satellite parametric indices</em>.
              </h2>
              <p className="text-xs font-mono text-slate-500 leading-relaxed max-w-md">
                Sentinel-2 multispectral vegetation monitoring, SAR flood indexing, and 48-hour Direct Benefit Transfer (DBT) claim settlement.
              </p>
              
              <div className="flex flex-wrap gap-3 pt-2">
                <Link 
                  href="/login?role=farmer" 
                  className="bg-[#15803d] hover:bg-[#166534] text-white font-mono font-bold text-xs px-6 py-3 rounded-xl shadow-md transition-all flex items-center gap-2"
                >
                  Farmer Portal <ArrowRight className="w-4 h-4" />
                </Link>
                <Link 
                  href="/login?role=officer" 
                  className="bg-slate-900 hover:bg-slate-800 text-white font-mono font-bold text-xs px-6 py-3 rounded-xl shadow-md transition-all flex items-center gap-2"
                >
                  Officer Queue
                </Link>
              </div>
            </div>

          </div>

          {/* Institutional Partner Bar */}
          <div className="flex flex-wrap items-center justify-between gap-6 pt-2 pb-6 border-b border-slate-200/60 text-slate-500 text-xs font-mono">
            <span className="font-bold text-slate-400 uppercase tracking-widest text-[10px]">Integrated Infrastructures:</span>
            <div className="flex flex-wrap items-center gap-8 text-slate-700 font-semibold text-xs">
              <span className="flex items-center gap-1.5"><Globe className="w-3.5 h-3.5 text-emerald-700" /> PMFBY National Crop Portal</span>
              <span className="flex items-center gap-1.5"><Satellite className="w-3.5 h-3.5 text-blue-700" /> Copernicus Sentinel-2 L2A</span>
              <span className="flex items-center gap-1.5"><Database className="w-3.5 h-3.5 text-amber-700" /> ISRO Bhuvan Spatial Hub</span>
              <span className="flex items-center gap-1.5"><Radio className="w-3.5 h-3.5 text-purple-700" /> Open-Meteo Weather Mesh</span>
            </div>
          </div>

          {/* Inspo Split-Screen Telemetry Sandbox Panel */}
          <div id="telemetry" className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center pt-4">
            
            <div className="lg:col-span-5 space-y-5">
              <div className="inline-flex items-center gap-2 bg-emerald-100/80 border border-emerald-300 text-emerald-900 text-xs font-mono font-bold px-3 py-1 rounded-full">
                <Zap className="w-3.5 h-3.5 text-emerald-700 animate-pulse" />
                Live Satellite Telemetry Terminal
              </div>
              <h3 className="text-2xl font-extrabold text-slate-900 tracking-tight leading-snug">
                Real-Time Multispectral Vegetation & Parametric Index Sandbox
              </h3>
              <p className="text-xs text-slate-600 leading-relaxed max-w-lg">
                Automated index computation over active GeoJSON farm boundaries with zero-claim parametric payouts on drought breach (VCI below 35%).
              </p>

              {/* Band Spectrum Selector Buttons */}
              <div className="space-y-2 pt-2">
                <span className="text-[10px] font-mono text-slate-400 uppercase tracking-wider font-bold">Select Active Imagery Layer:</span>
                <div className="grid grid-cols-2 gap-2 text-xs font-mono font-semibold">
                  <button
                    onClick={() => setActiveBand("ndvi")}
                    className={`p-2.5 rounded-xl border text-left transition-all flex items-center justify-between ${activeBand === "ndvi" ? "bg-emerald-50 border-emerald-500 text-emerald-900 shadow-xs" : "bg-white border-slate-200 text-slate-600 hover:bg-slate-50"}`}
                  >
                    <span>🌱 Sentinel-2 NDVI</span>
                    {activeBand === "ndvi" && <CheckCircle className="w-3.5 h-3.5 text-emerald-700" />}
                  </button>

                  <button
                    onClick={() => setActiveBand("sar")}
                    className={`p-2.5 rounded-xl border text-left transition-all flex items-center justify-between ${activeBand === "sar" ? "bg-blue-50 border-blue-500 text-blue-900 shadow-xs" : "bg-white border-slate-200 text-slate-600 hover:bg-slate-50"}`}
                  >
                    <span>📡 SAR Flood Radar</span>
                    {activeBand === "sar" && <CheckCircle className="w-3.5 h-3.5 text-blue-700" />}
                  </button>

                  <button
                    onClick={() => setActiveBand("thermal")}
                    className={`p-2.5 rounded-xl border text-left transition-all flex items-center justify-between ${activeBand === "thermal" ? "bg-amber-50 border-amber-500 text-amber-900 shadow-xs" : "bg-white border-slate-200 text-slate-600 hover:bg-slate-50"}`}
                  >
                    <span>🌡️ Landsat Thermal</span>
                    {activeBand === "thermal" && <CheckCircle className="w-3.5 h-3.5 text-amber-700" />}
                  </button>

                  <button
                    onClick={() => setActiveBand("soil")}
                    className={`p-2.5 rounded-xl border text-left transition-all flex items-center justify-between ${activeBand === "soil" ? "bg-purple-50 border-purple-500 text-purple-900 shadow-xs" : "bg-white border-slate-200 text-slate-600 hover:bg-slate-50"}`}
                  >
                    <span>💧 NISAR Moisture</span>
                    {activeBand === "soil" && <CheckCircle className="w-3.5 h-3.5 text-purple-700" />}
                  </button>
                </div>
              </div>
            </div>

            {/* Telemetry Visual Card */}
            <div className="lg:col-span-7">
              <div className="bg-slate-950 rounded-2xl p-6 text-white space-y-4 border border-slate-800 shadow-2xl">
                <div className="flex justify-between items-center border-b border-slate-800 pb-3 text-xs font-mono">
                  <span className="text-emerald-400 font-bold flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping"></span>
                    {activeBand === "ndvi" && "Sentinel-2 L2A Multispectral (10m Resolution)"}
                    {activeBand === "sar" && "Sentinel-1 C-Band SAR Synthetic Aperture Radar"}
                    {activeBand === "thermal" && "Landsat-9 TIRS Surface Temperature Sensor"}
                    {activeBand === "soil" && "NISAR L-Band Polarimetric Soil Moisture"}
                  </span>
                  <span className="text-slate-400">TARGET: 18.5204° N, 73.8567° E</span>
                </div>

                <div className="grid grid-cols-2 gap-3 font-mono">
                  <div className="bg-slate-900/90 border border-slate-800 p-3.5 rounded-xl space-y-1">
                    <span className="text-[10px] text-slate-400 block uppercase">
                      {activeBand === "ndvi" ? "NDVI Vegetation Index" : activeBand === "sar" ? "Radar Backscatter (VV/VH)" : activeBand === "thermal" ? "Canopy Surface Temp" : "Volumetric Soil Water"}
                    </span>
                    <span className="text-2xl font-black text-emerald-400">
                      {activeBand === "ndvi" && `${ndviPulse} / 1.0`}
                      {activeBand === "sar" && `-21.4 dB`}
                      {activeBand === "thermal" && `31.2 °C`}
                      {activeBand === "soil" && `28.4 %`}
                    </span>
                    <span className="text-[10px] text-emerald-300 block">
                      {activeBand === "ndvi" && "✓ Vigorous Biomass Growth"}
                      {activeBand === "sar" && "✓ Normal Water Extent (No Inundation)"}
                      {activeBand === "thermal" && "✓ Thermal Stress Within Limits"}
                      {activeBand === "soil" && "✓ Adequate Root Zone Moisture"}
                    </span>
                  </div>

                  <div className="bg-slate-900/90 border border-slate-800 p-3.5 rounded-xl space-y-1">
                    <span className="text-[10px] text-slate-400 block uppercase">Parametric VCI Score</span>
                    <span className="text-2xl font-black text-white">68.4%</span>
                    <span className="text-[10px] text-emerald-300 block">✓ Safe Threshold (&gt; 35.0%)</span>
                  </div>
                </div>

                {/* Simulated Spectral Chart Bar */}
                <div className="bg-slate-900/90 border border-slate-800 p-4 rounded-xl space-y-2 font-mono text-xs">
                  <div className="flex justify-between items-center text-[10px] text-slate-400">
                    <span>14-DAY SPECTRAL HEALTH SPECTRUM</span>
                    <span className="text-emerald-400 font-bold">ORBIT PASS #142 CONFIRMED</span>
                  </div>
                  <div className="h-4 w-full bg-slate-950 rounded-full overflow-hidden flex p-0.5 border border-slate-800">
                    <div className="h-full bg-emerald-500 rounded-full transition-all duration-500" style={{ width: `${ndviPulse * 100}%` }}></div>
                  </div>
                  <div className="flex justify-between text-[9px] text-slate-500">
                    <span>0.0 (Severe Stress)</span>
                    <span>0.35 (Breach Level)</span>
                    <span>1.0 (Dense Canopy)</span>
                  </div>
                </div>

                <div className="bg-slate-900/90 border border-slate-800 p-3.5 rounded-xl flex items-center justify-between text-xs font-mono">
                  <div>
                    <span className="text-slate-400 text-[10px] uppercase block">Traffic Light Verification</span>
                    <span className="text-emerald-400 font-bold">GREEN — PARCEL STANDING HEALTHY</span>
                  </div>
                  <span className="text-emerald-400 font-bold text-sm">₹24,500.00 Max Cover</span>
                </div>
              </div>
            </div>

          </div>

        </div>
      </section>

      {/* 4. Inspo Feature-Stack Section */}
      <section id="features" className="py-20 px-6 md:px-14 bg-[#F7F9F5] border-b border-slate-200/80">
        <div className="max-w-7xl mx-auto space-y-12">
          
          <div className="space-y-2">
            <p className="text-xs font-mono text-emerald-800 font-bold uppercase tracking-widest">Architecture Stack</p>
            <h2 className="text-3xl font-extrabold text-slate-900 tracking-tight">
              Enterprise De-Risking Capabilities
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            
            <div className="bg-white border border-slate-200/80 rounded-2xl p-6 space-y-3 hover:border-emerald-600 transition-colors shadow-xs">
              <div className="w-10 h-10 rounded-xl bg-emerald-100 text-[#15803d] flex items-center justify-center font-bold">
                <Satellite className="w-5 h-5" />
              </div>
              <h3 className="text-base font-bold text-slate-900">Multispectral NDVI</h3>
              <p className="text-xs text-slate-600 leading-relaxed">
                Daily Sentinel-2 satellite vegetation health mapped directly to GeoJSON land boundaries.
              </p>
            </div>

            <div className="bg-white border border-slate-200/80 rounded-2xl p-6 space-y-3 hover:border-emerald-600 transition-colors shadow-xs">
              <div className="w-10 h-10 rounded-xl bg-blue-100 text-blue-800 flex items-center justify-center font-bold">
                <Shield className="w-5 h-5" />
              </div>
              <h3 className="text-base font-bold text-slate-900">AFII Pastoral Index</h3>
              <p className="text-xs text-slate-600 leading-relaxed">
                Zero-claim drought payouts for pastoralists triggered when VCI falls below 35%.
              </p>
            </div>

            <div className="bg-white border border-slate-200/80 rounded-2xl p-6 space-y-3 hover:border-emerald-600 transition-colors shadow-xs">
              <div className="w-10 h-10 rounded-xl bg-amber-100 text-amber-800 flex items-center justify-center font-bold">
                <Lock className="w-5 h-5" />
              </div>
              <h3 className="text-base font-bold text-slate-900">SHA-256 Audit Chain</h3>
              <p className="text-xs text-slate-600 leading-relaxed">
                Immutable cryptographic ledger recording all claim verifications & EXIF photo freshness checks.
              </p>
            </div>

            <div className="bg-white border border-slate-200/80 rounded-2xl p-6 space-y-3 hover:border-emerald-600 transition-colors shadow-xs">
              <div className="w-10 h-10 rounded-xl bg-purple-100 text-purple-800 flex items-center justify-center font-bold">
                <MessageSquare className="w-5 h-5" />
              </div>
              <h3 className="text-base font-bold text-slate-900">Multilingual Copilot</h3>
              <p className="text-xs text-slate-600 leading-relaxed">
                EN, HI, TA agronomy guidance with feature-phone GSM SMS alerts.
              </p>
            </div>

          </div>
        </div>
      </section>

      {/* 5. Inspo 4-Step Narrative Process */}
      <section id="how-it-works" className="py-20 px-6 md:px-14 bg-white border-b border-slate-200/80">
        <div className="max-w-7xl mx-auto space-y-12">
          
          <div className="space-y-2">
            <p className="text-xs font-mono text-emerald-800 font-bold uppercase tracking-widest">Workflow Mechanics</p>
            <h2 className="text-3xl font-extrabold text-slate-900 tracking-tight">
              Transparent 4-Step Claim Settlement
            </h2>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 font-mono text-xs">
            
            <div className="bg-[#F7F9F5] border border-slate-200/80 rounded-2xl p-6 space-y-3">
              <span className="text-xs font-bold text-emerald-800 block uppercase">Step 01</span>
              <h4 className="text-sm font-bold text-slate-900 font-sans">Register Parcel</h4>
              <p className="text-slate-600 font-sans leading-relaxed">Draw GeoJSON land boundaries and link Khasra land record identifiers.</p>
            </div>

            <div className="bg-[#F7F9F5] border border-slate-200/80 rounded-2xl p-6 space-y-3">
              <span className="text-xs font-bold text-emerald-800 block uppercase">Step 02</span>
              <h4 className="text-sm font-bold text-slate-900 font-sans">Monitor Risk</h4>
              <p className="text-slate-600 font-sans leading-relaxed">Daily satellite vegetation health updates and Open-Meteo weather alerts.</p>
            </div>

            <div className="bg-[#F7F9F5] border border-slate-200/80 rounded-2xl p-6 space-y-3">
              <span className="text-xs font-bold text-emerald-800 block uppercase">Step 03</span>
              <h4 className="text-sm font-bold text-slate-900 font-sans">File Claim</h4>
              <p className="text-slate-600 font-sans leading-relaxed">Upload EXIF geotagged photo reports following extreme weather events.</p>
            </div>

            <div className="bg-[#F7F9F5] border border-slate-200/80 rounded-2xl p-6 space-y-3">
              <span className="text-xs font-bold text-emerald-800 block uppercase">Step 04</span>
              <h4 className="text-sm font-bold text-slate-900 font-sans">Direct Payout</h4>
              <p className="text-slate-600 font-sans leading-relaxed">Automated Traffic Light verification dispatches Aadhaar DBT transfers.</p>
            </div>

          </div>
        </div>
      </section>

      {/* 6. Portals Selection */}
      <section id="portals" className="py-20 px-6 md:px-14 bg-[#F7F9F5] border-b border-slate-200/80">
        <div className="max-w-7xl mx-auto space-y-10">
          
          <div className="space-y-2 text-center max-w-xl mx-auto">
            <p className="text-xs font-mono text-emerald-800 font-bold uppercase tracking-widest">Authentication Gateway</p>
            <h2 className="text-3xl font-extrabold text-slate-900 tracking-tight">Select Role Account</h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-4xl mx-auto">
            
            <div className="bg-white border border-slate-200/80 rounded-2xl p-8 space-y-6 shadow-xs flex flex-col justify-between hover:shadow-md transition-shadow">
              <div className="space-y-3">
                <span className="text-xs font-mono text-emerald-800 font-bold uppercase tracking-widest">Role 01 · Farmer</span>
                <h3 className="text-xl font-bold text-slate-900">Farmer & Pastoralist Login</h3>
                <p className="text-xs text-slate-600 leading-relaxed">
                  View satellite NDVI health, file crop loss claims, and track direct benefit transfer payouts.
                </p>
                <div className="bg-slate-50 border border-slate-200 p-3 rounded-xl text-xs font-mono text-slate-700">
                  Demo Mobile: <strong>9876543210</strong>
                </div>
              </div>
              <Link
                href="/login?role=farmer"
                className="w-full bg-[#15803d] text-white text-xs font-mono font-bold py-3 rounded-xl text-center shadow-xs hover:bg-[#166534] transition-all flex items-center justify-center gap-2"
              >
                Farmer Login <ArrowRight className="w-4 h-4" />
              </Link>
            </div>

            <div className="bg-white border border-slate-200/80 rounded-2xl p-8 space-y-6 shadow-xs flex flex-col justify-between hover:shadow-md transition-shadow">
              <div className="space-y-3">
                <span className="text-xs font-mono text-slate-500 font-bold uppercase tracking-widest">Role 02 · Agriculture Officer</span>
                <h3 className="text-xl font-bold text-slate-900">Agriculture Officer Login</h3>
                <p className="text-xs text-slate-600 leading-relaxed">
                  Evaluate Traffic Light decision scores, review GPS photo authenticity, and approve parametric settlements.
                </p>
                <div className="bg-slate-50 border border-slate-200 p-3 rounded-xl text-xs font-mono text-slate-700">
                  Demo Mobile: <strong>9876543299</strong>
                </div>
              </div>
              <Link
                href="/login?role=officer"
                className="w-full bg-slate-900 text-white text-xs font-mono font-bold py-3 rounded-xl text-center shadow-xs hover:bg-slate-800 transition-all flex items-center justify-center gap-2"
              >
                Officer Login <ArrowRight className="w-4 h-4" />
              </Link>
            </div>

          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-8 px-6 md:px-14 bg-white text-xs text-slate-500 font-mono">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row justify-between items-center gap-4">
          <span>AgriSense National Portal · Department of Agriculture & Farmers Welfare</span>
          <span>Digital India · NIC Enabled</span>
        </div>
      </footer>
    </div>
  );
}

