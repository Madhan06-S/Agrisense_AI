"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { 
  Shield, 
  Satellite, 
  Database, 
  Globe, 
  Radio, 
  CheckCircle, 
  Check, 
  AlertCircle, 
  XCircle, 
  Zap, 
  FileText,
  Lock,
  MessageSquare
} from "lucide-react";

export default function HomePage() {
  const [lang, setLang] = useState<"en" | "hi">("en");
  const [userRole, setUserRole] = useState<string | null>(null);

  useEffect(() => {
    if (typeof window !== "undefined") {
      const role = localStorage.getItem("user_role");
      const token = localStorage.getItem("access_token");
      if (token && role) {
        setUserRole(role);
      }
    }
  }, []);

  return (
    <div className="min-h-screen bg-[#F7F9F5] text-slate-900 font-sans flex flex-col justify-between selection:bg-emerald-100 selection:text-emerald-900">
      
      {/* 1. Official Government Dateline Header */}
      <div className="bg-[#144723] text-emerald-100 text-xs px-4 sm:px-6 md:px-14 py-2.5 flex justify-between items-center border-b border-emerald-900/50 font-mono">
        <div className="flex items-center gap-3">
          <span className="flex items-center gap-1.5 font-bold text-white tracking-widest uppercase text-[11px] sm:text-xs">
            <span className="inline-block w-2 h-2 rounded-full bg-emerald-400"></span>
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

      {/* 2. Main Navigation Header */}
      <header className="sticky top-0 z-50 bg-white/95 backdrop-blur-md border-b border-slate-200/80 py-3.5 px-4 sm:px-6 md:px-14">
        <div className="max-w-7xl mx-auto flex justify-between items-center">
          <Link href="/" className="flex items-center gap-3 group">
            <div className="p-2 rounded-xl bg-emerald-50 border border-emerald-200 text-[#15803d]">
              <Shield className="w-5 h-5 sm:w-6 sm:h-6" />
            </div>
            <div>
              <h1 className="text-lg sm:text-xl font-extrabold text-slate-900 tracking-tight leading-none">
                AgriSense <span className="text-emerald-700">AI</span>
              </h1>
              <p className="text-[10px] font-mono text-slate-500 uppercase tracking-widest mt-1">
                Parametric Satellite Insurance
              </p>
            </div>
          </Link>
          
          <nav className="hidden md:flex items-center gap-8 text-xs font-mono font-bold uppercase tracking-wider text-slate-600">
            <a href="#hero" className="hover:text-emerald-700 transition-colors">Overview</a>
            <a href="#features" className="hover:text-emerald-700 transition-colors">Architecture</a>
            <a href="#how-it-works" className="hover:text-emerald-700 transition-colors">Workflow</a>
            <a href="#portals" className="hover:text-emerald-700 transition-colors">Portals</a>
          </nav>

          <div className="flex items-center gap-3">
            {userRole ? (
              <Link 
                href={userRole === 'officer' || userRole === 'admin' ? '/dashboard/officer/claims' : '/dashboard/farmer'} 
                className="bg-[#15803d] hover:bg-[#166534] text-white text-xs font-bold font-mono px-4 py-2.5 rounded-xl shadow-xs transition-colors"
              >
                Go to Console
              </Link>
            ) : (
              <Link 
                href="/login" 
                className="bg-[#15803d] hover:bg-[#166534] text-white text-xs font-bold font-mono px-4 py-2.5 rounded-xl shadow-xs transition-colors"
              >
                Sign In
              </Link>
            )}
          </div>
        </div>
      </header>

      {/* 3. NEW HERO SECTION (left-aligned, single column on mobile) */}
      <section id="hero" className="bg-white py-10 sm:py-14 md:py-16 px-4 sm:px-6 md:px-14 border-b border-slate-200/80 agri-grid-pattern">
        <div className="max-w-7xl mx-auto space-y-10">
          
          {/* Main Hero Content Block */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-12 items-start">
            
            {/* Left Column: Context, Headline, Supporting Sentence, Buttons & 3-Step Strip */}
            <div className="lg:col-span-7 space-y-6 text-left">
              
              {/* 1. Context line (small) */}
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-md bg-emerald-50 border border-emerald-200/80 text-emerald-900 text-xs font-mono font-bold tracking-wide">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-600"></span>
                PMFBY Pillar 5, Government of India
              </div>

              {/* 2. Headline (largest element, plain words) - NO animation, NO gradient background */}
              <h1 className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-black text-slate-900 leading-[1.12] tracking-tight">
                Crop insurance that pays in 48 hours. Decided by satellite, not by site visits.
              </h1>

              {/* 3. One supporting sentence (max 20 words) */}
              <p className="text-base sm:text-lg text-slate-700 font-medium leading-relaxed max-w-2xl">
                Monitors crop greenness, rainfall, and floods via satellite to deliver instant parametric payouts directly to bank accounts.
              </p>

              {/* 4. Two Buttons: Plain labels, NO arrow icons */}
              <div className="flex flex-wrap items-center gap-3.5 pt-1">
                <Link 
                  href="/login?role=farmer" 
                  className="bg-[#15803d] hover:bg-[#166534] text-white font-bold text-sm sm:text-base px-6 py-3.5 rounded-xl shadow-xs transition-colors text-center min-w-[160px]"
                >
                  I'm a farmer
                </Link>
                <Link 
                  href="/login?role=officer" 
                  className="bg-slate-900 hover:bg-slate-800 text-white font-bold text-sm sm:text-base px-6 py-3.5 rounded-xl transition-colors text-center min-w-[160px]"
                >
                  I'm an officer
                </Link>
              </div>

              {/* 5. 3-step Strip explaining the flow */}
              <div className="pt-6 border-t border-slate-200/80 space-y-4">
                <p className="text-xs font-mono font-bold text-slate-500 uppercase tracking-wider">
                  How Payout Decision Works
                </p>

                {/* 3-Step Flow Summary Strip */}
                <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm font-medium text-slate-800 flex flex-wrap items-center gap-2 leading-relaxed">
                  <span className="font-bold text-slate-900">1. Satellite reads your field</span>
                  <span className="text-slate-400 font-normal">→</span>
                  <span className="font-bold text-slate-900">2. System decides: green, yellow or red</span>
                  <span className="text-slate-400 font-normal">→</span>
                  <span className="font-bold text-slate-900">3. Direct payout on severe loss</span>
                </div>

                {/* Labeled Dots (green / yellow / red) according to backend source of truth */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div className="p-3 rounded-xl border border-emerald-200 bg-emerald-50/60 flex items-start gap-2.5">
                    <span className="w-3 h-3 rounded-full bg-emerald-600 shrink-0 mt-0.5"></span>
                    <div className="text-xs">
                      <span className="font-bold text-emerald-950 block">Green dot</span>
                      <span className="text-emerald-800 font-medium">Healthy crop (claim closed, no payout)</span>
                    </div>
                  </div>

                  <div className="p-3 rounded-xl border border-amber-200 bg-amber-50/60 flex items-start gap-2.5">
                    <span className="w-3 h-3 rounded-full bg-amber-500 shrink-0 mt-0.5"></span>
                    <div className="text-xs">
                      <span className="font-bold text-amber-950 block">Yellow dot</span>
                      <span className="text-amber-800 font-medium">Send an officer (field visit required)</span>
                    </div>
                  </div>

                  <div className="p-3 rounded-xl border border-red-200 bg-red-50/60 flex items-start gap-2.5">
                    <span className="w-3 h-3 rounded-full bg-red-600 shrink-0 mt-0.5"></span>
                    <div className="text-xs">
                      <span className="font-bold text-red-950 block">Red dot</span>
                      <span className="text-red-800 font-medium">Auto-pay (severe damage / instant payout)</span>
                    </div>
                  </div>
                </div>
              </div>

            </div>

            {/* Right Column: 6. Real Product Artifact (Static Example - NO 3D) */}
            <div className="lg:col-span-5 w-full">
              <div className="bg-slate-950 text-white rounded-2xl p-5 sm:p-6 border border-slate-800 shadow-xl space-y-5">
                
                {/* Product Artifact Header */}
                <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                  <div className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-red-500"></span>
                    <span className="text-xs font-mono font-bold text-red-400 uppercase tracking-wider">
                      Live Product Verdict Example
                    </span>
                  </div>
                  <span className="text-[11px] font-mono text-slate-900 bg-slate-200 px-2 py-0.5 rounded font-bold uppercase">
                    Example result
                  </span>
                </div>

                {/* Single Farm Result Content */}
                <div className="space-y-4 font-sans text-xs">
                  
                  {/* Farm Name */}
                  <div className="bg-slate-900/90 p-3.5 rounded-xl border border-slate-800 space-y-1">
                    <span className="text-[10px] font-mono text-slate-400 uppercase block font-semibold">Farm Registered</span>
                    <p className="text-sm font-bold text-white">Rajesh Kumar — Survey No. 402/A</p>
                    <p className="text-slate-300 text-[11px]">Kolhapur District, Maharashtra (Soybean 2.4 Hectares)</p>
                  </div>

                  {/* NDVI Value */}
                  <div className="grid grid-cols-2 gap-3 font-mono">
                    <div className="bg-slate-900/90 p-3 rounded-xl border border-slate-800 space-y-1">
                      <span className="text-[10px] text-slate-400 uppercase block">NDVI Vegetation Value</span>
                      <p className="text-xl font-extrabold text-red-400">0.24</p>
                      <span className="text-[10px] text-red-300 block">Below the 0.35 drought threshold</span>
                    </div>

                    <div className="bg-slate-900/90 p-3 rounded-xl border border-slate-800 space-y-1">
                      <span className="text-[10px] text-slate-400 uppercase block">Satellite Source</span>
                      <p className="text-sm font-bold text-slate-200 mt-1">Sentinel-2 L2A</p>
                      <span className="text-[10px] text-slate-400 block">10m resolution imagery</span>
                    </div>
                  </div>

                  {/* Traffic Light Verdict (RED for NDVI 0.24 severe loss) */}
                  <div className="bg-red-950/80 border border-red-600/70 p-3.5 rounded-xl flex items-center justify-between">
                    <div className="flex items-center gap-2.5">
                      <span className="w-3.5 h-3.5 rounded-full bg-red-500"></span>
                      <div>
                        <span className="text-[10px] font-mono text-red-300 uppercase block font-bold">Traffic Light Verdict</span>
                        <span className="text-xs font-extrabold text-red-100">RED — SEVERE LOSS (PAYOUT AUTO-APPROVED)</span>
                      </div>
                    </div>
                    <span className="text-xs font-mono font-bold text-red-400 bg-red-900/60 px-2 py-1 rounded border border-red-700/50">Auto-Pay</span>
                  </div>

                  {/* Payout Status */}
                  <div className="bg-slate-900/90 p-3.5 rounded-xl border border-slate-800 space-y-1.5 font-mono">
                    <div className="flex justify-between items-center">
                      <span className="text-[10px] text-slate-400 uppercase">Payout Status</span>
                      <span className="text-xs font-bold text-emerald-400">DISPATCHED (48 HRS)</span>
                    </div>
                    <p className="text-xl font-black text-white">₹24,500.00</p>
                    <p className="text-[10px] text-slate-400">
                      Bank A/C ending in <span className="text-slate-200 font-bold">4082</span> · Ref: DBT-2026-8941
                    </p>
                  </div>

                </div>

              </div>
            </div>

          </div>

        </div>
      </section>

      {/* 4. SECTION DIRECTLY BELOW THE HERO */}
      <section className="bg-slate-50 py-6 px-4 sm:px-6 md:px-14 border-b border-slate-200/80">
        <div className="max-w-7xl mx-auto space-y-4">
          
          {/* Quiet Integrated Infrastructures Row (small, grey) */}
          <div className="flex flex-wrap items-center justify-between gap-4 text-[11px] font-mono text-slate-400">
            <span className="font-semibold uppercase tracking-wider text-slate-400">Integrated Infrastructures:</span>
            <div className="flex flex-wrap items-center gap-4 sm:gap-6 text-slate-500 font-medium">
              <span>PMFBY National Crop Portal</span>
              <span className="text-slate-300">•</span>
              <span>Copernicus Sentinel-2 L2A</span>
              <span className="text-slate-300">•</span>
              <span>ISRO Bhuvan Spatial Hub</span>
              <span className="text-slate-300">•</span>
              <span>Open-Meteo Weather Mesh</span>
            </div>
          </div>

        </div>
      </section>


      {/* 5. Feature Stack Section */}
      <section id="features" className="py-16 sm:py-20 px-4 sm:px-6 md:px-14 bg-[#F7F9F5] border-b border-slate-200/80">
        <div className="max-w-7xl mx-auto space-y-12">
          
          <div className="space-y-2">
            <p className="text-xs font-mono text-emerald-800 font-bold uppercase tracking-widest">Architecture Stack</p>
            <h2 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
              Enterprise De-Risking Capabilities
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            
            <div className="bg-white border border-slate-200/80 rounded-2xl p-6 space-y-3 shadow-2xs">
              <div className="w-10 h-10 rounded-xl bg-emerald-100 text-[#15803d] flex items-center justify-center font-bold">
                <Satellite className="w-5 h-5" />
              </div>
              <h3 className="text-base font-bold text-slate-900">Multispectral NDVI</h3>
              <p className="text-xs text-slate-600 leading-relaxed">
                Daily Sentinel-2 satellite vegetation health mapped directly to GeoJSON land boundaries.
              </p>
            </div>

            <div className="bg-white border border-slate-200/80 rounded-2xl p-6 space-y-3 shadow-2xs">
              <div className="w-10 h-10 rounded-xl bg-blue-100 text-blue-800 flex items-center justify-center font-bold">
                <Shield className="w-5 h-5" />
              </div>
              <h3 className="text-base font-bold text-slate-900">AFII Pastoral Index</h3>
              <p className="text-xs text-slate-600 leading-relaxed">
                Zero-claim drought payouts for pastoralists triggered when VCI falls below 35%.
              </p>
            </div>

            <div className="bg-white border border-slate-200/80 rounded-2xl p-6 space-y-3 shadow-2xs">
              <div className="w-10 h-10 rounded-xl bg-amber-100 text-amber-800 flex items-center justify-center font-bold">
                <Lock className="w-5 h-5" />
              </div>
              <h3 className="text-base font-bold text-slate-900">SHA-256 Audit Chain</h3>
              <p className="text-xs text-slate-600 leading-relaxed">
                Immutable cryptographic ledger recording all claim verifications & EXIF photo freshness checks.
              </p>
            </div>

            <div className="bg-white border border-slate-200/80 rounded-2xl p-6 space-y-3 shadow-2xs">
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

      {/* 6. Portals Selection */}
      <section id="portals" className="py-16 sm:py-20 px-4 sm:px-6 md:px-14 bg-white border-b border-slate-200/80">
        <div className="max-w-7xl mx-auto space-y-10">
          
          <div className="space-y-2 text-center max-w-xl mx-auto">
            <p className="text-xs font-mono text-emerald-800 font-bold uppercase tracking-widest">Authentication Gateway</p>
            <h2 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">Select Role Account</h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-4xl mx-auto">
            
            <div className="bg-[#F7F9F5] border border-slate-200/80 rounded-2xl p-6 sm:p-8 space-y-6 shadow-2xs flex flex-col justify-between">
              <div className="space-y-3">
                <span className="text-xs font-mono text-emerald-800 font-bold uppercase tracking-widest">Role 01 · Farmer</span>
                <h3 className="text-xl font-bold text-slate-900">Farmer & Pastoralist Login</h3>
                <p className="text-xs text-slate-600 leading-relaxed">
                  View satellite NDVI health, file crop loss claims, and track direct benefit transfer payouts.
                </p>
                <div className="bg-white border border-slate-200 p-3 rounded-xl text-xs font-mono text-slate-700">
                  Demo Mobile: <strong>9876543210</strong>
                </div>
              </div>
              <Link
                href="/login?role=farmer"
                className="w-full bg-[#15803d] text-white text-xs font-mono font-bold py-3.5 rounded-xl text-center shadow-2xs hover:bg-[#166534] transition-colors"
              >
                Farmer Login
              </Link>
            </div>

            <div className="bg-[#F7F9F5] border border-slate-200/80 rounded-2xl p-6 sm:p-8 space-y-6 shadow-2xs flex flex-col justify-between">
              <div className="space-y-3">
                <span className="text-xs font-mono text-slate-500 font-bold uppercase tracking-widest">Role 02 · Agriculture Officer</span>
                <h3 className="text-xl font-bold text-slate-900">Agriculture Officer Login</h3>
                <p className="text-xs text-slate-600 leading-relaxed">
                  Evaluate Traffic Light decision scores, review GPS photo authenticity, and approve parametric settlements.
                </p>
                <div className="bg-white border border-slate-200 p-3 rounded-xl text-xs font-mono text-slate-700">
                  Demo Mobile: <strong>9876543299</strong>
                </div>
              </div>
              <Link
                href="/login?role=officer"
                className="w-full bg-slate-900 text-white text-xs font-mono font-bold py-3.5 rounded-xl text-center shadow-2xs hover:bg-slate-800 transition-colors"
              >
                Officer Login
              </Link>
            </div>

          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-8 px-4 sm:px-6 md:px-14 bg-white text-xs text-slate-500 font-mono">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row justify-between items-center gap-4">
          <span>AgriSense National Portal · Department of Agriculture & Farmers Welfare</span>
          <span>Digital India · NIC Enabled</span>
        </div>
      </footer>
    </div>
  );
}

