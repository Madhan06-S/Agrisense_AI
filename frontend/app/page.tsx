"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { ArrowRight, Shield, Satellite, CheckCircle, Info, FileText, Globe, Landmark, MapPin, AlertTriangle, CreditCard } from "lucide-react";

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
    <div className="min-h-screen bg-[#F7F9F5] text-slate-800 font-sans flex flex-col justify-between">
      {/* 1. Official Government Header Bar */}
      <div className="bg-[#E8F5E9] text-[#1B5E20] text-xs px-6 py-2 flex justify-between items-center border-b border-[#E5EBE3] font-medium">
        <div className="flex items-center gap-4">
          <span className="font-medium">भारत सरकार | Government of India</span>
          <span className="hidden md:inline text-slate-400">| Pradhan Mantri Fasal Bima Yojana (PMFBY) Portal</span>
        </div>
        <div className="flex items-center gap-3">
          <button 
            onClick={() => setLang("en")} 
            className={`hover:text-[#1B5E20] transition-colors ${lang === "en" ? "font-bold text-[#1B5E20]" : "text-[#5B6B5B]"}`}
          >
            English
          </button>
          <span className="text-[#5B6B5B]">|</span>
          <button 
            onClick={() => setLang("hi")} 
            className={`hover:text-[#1B5E20] transition-colors ${lang === "hi" ? "font-bold text-[#1B5E20]" : "text-[#5B6B5B]"}`}
          >
            हिंदी
          </button>
        </div>
      </div>

      {/* 2. Main Portal Brand Header */}
      <header className="bg-white border-b border-[#E5EBE3] shadow-sm py-4 px-6 md:px-12">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row justify-between items-center gap-4">
          <div className="flex items-center gap-4">
            {/* Ashoka Chakra SVG Icon */}
            <div className="shrink-0">
              <svg className="w-12 h-12 text-[#1B5E20]" viewBox="0 0 100 100" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="50" cy="50" r="45" strokeWidth="4" />
                <circle cx="50" cy="50" r="10" fill="currentColor" />
                {[...Array(24)].map((_, i) => {
                  const angle = (i * 360) / 24;
                  const rad = (angle * Math.PI) / 180;
                  return (
                    <line
                      key={i}
                      x1="50"
                      y1="50"
                      x2={Number((50 + 45 * Math.cos(rad)).toFixed(4))}
                      y2={Number((50 + 45 * Math.sin(rad)).toFixed(4))}
                      strokeWidth="1.5"
                    />
                  );
                })}
              </svg>
            </div>
            <div>
              <h1 className="text-xl font-bold text-[#1B5E20] tracking-tight leading-tight">
                AgriSense AI Portal
              </h1>
              <p className="text-xs text-[#5B6B5B] font-semibold tracking-wide uppercase">
                Pradhan Mantri Fasal Bima Yojana (PMFBY)
              </p>
              <p className="text-[10px] text-slate-400">
                Department of Agriculture & Farmers Welfare, Ministry of Agriculture
              </p>
            </div>
          </div>
          
          <div className="flex items-center gap-4 text-xs font-semibold">
            <a href="#features" className="text-[#374151] hover:text-[#1B5E20]">Features</a>
            <a href="#how-it-works" className="text-[#374151] hover:text-[#1B5E20]">How It Works</a>
            <a href="#eligibility" className="text-[#374151] hover:text-[#1B5E20]">Eligibility</a>
            {userRole ? (
              <Link 
                href={userRole === 'officer' || userRole === 'admin' ? '/dashboard/officer/claims' : '/dashboard/farmer'} 
                className="bg-[#2E7D32] hover:bg-[#1B5E20] text-white px-4 py-2 rounded-md font-bold transition flex items-center gap-1.5"
              >
                Go to Dashboard <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            ) : (
              <Link 
                href="/login" 
                className="bg-[#2E7D32] hover:bg-[#1B5E20] text-white px-4 py-2 rounded-md font-bold transition"
              >
                Get Started
              </Link>
            )}
          </div>
        </div>
      </header>

      {/* 3. Hero Section */}
      <section className="bg-white border-b border-[#E5EBE3] py-12 md:py-20 px-6 md:px-12">
        <div className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
          <div className="lg:col-span-7 space-y-6">
            <div className="inline-flex items-center gap-2 bg-[#2E7D32]/10 border border-[#166534]/30 px-3 py-1 rounded-full text-[#1B5E20] text-xs font-bold uppercase tracking-wider">
              Official e-Governance Service
            </div>
            <h2 className="text-3xl md:text-5xl font-extrabold text-[#1B5E20] leading-tight">
              AgriSense AI — AI-Powered Agricultural Risk, Insurance & Agronomic Support
            </h2>
            <p className="text-[#374151] text-base md:text-lg leading-relaxed max-w-xl">
              De-risking smallholder farmers with Sentinel-2 multispectral daily imagery, SAR flood indexing, XGBoost damage scoring, and automated parametric claim settlements.
            </p>
            
            <div className="flex flex-col sm:flex-row gap-4 pt-2">
              <Link 
                href="/login" 
                className="bg-[#2E7D32] hover:bg-[#1B5E20] text-white font-bold px-8 py-3.5 rounded-lg text-sm text-center shadow-md hover:shadow-lg transition-all flex items-center justify-center gap-2"
              >
                Get Started
                <ArrowRight className="w-4 h-4" />
              </Link>
              <Link 
                href="/login?role=farmer" 
                className="border-2 border-[#166534] text-[#1B5E20] hover:bg-[#2E7D32]/5 font-bold px-8 py-3.5 rounded-lg text-sm text-center transition-all flex items-center justify-center gap-2"
              >
                Farmer Login
              </Link>
            </div>

            <div className="bg-amber-50 border-l-4 border-amber-500 p-4 rounded-r-lg max-w-xl">
              <div className="flex gap-3">
                <Info className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
                <div>
                  <h4 className="text-xs font-bold text-amber-800 uppercase tracking-wider">National Helpline Number</h4>
                  <p className="text-sm font-semibold text-slate-800 mt-0.5">
                    For portal support or crop loss registration: <span className="text-[#1B5E20] font-bold">1800-180-1551</span>
                  </p>
                </div>
              </div>
            </div>
          </div>

          <div className="lg:col-span-5 bg-[#F7F9F5] border border-[#E5EBE3] rounded-xl p-6 shadow-sm space-y-4">
            <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wider border-b border-[#E5EBE3] pb-2">
              Portal Overview & Live Indicators
            </h3>
            <div className="space-y-3 text-xs">
              <div className="p-3 bg-white border border-[#E5EBE3] rounded-lg flex items-start gap-3">
                <CheckCircle className="w-4 h-4 text-emerald-600 mt-0.5" />
                <div>
                  <span className="font-bold block text-slate-700">Daily Sentinel-2 Indexing</span>
                  <span className="text-[#5B6B5B]">Multispectral NDVI vegetation indices computed over active farm parcels.</span>
                </div>
              </div>
              <div className="p-3 bg-white border border-[#E5EBE3] rounded-lg flex items-start gap-3">
                <CheckCircle className="w-4 h-4 text-emerald-600 mt-0.5" />
                <div>
                  <span className="font-bold block text-slate-700">Parametric Insurance Triggers</span>
                  <span className="text-[#5B6B5B]">Automated claim processing driven by satellite damage detection models.</span>
                </div>
              </div>
              <div className="p-3 bg-white border border-[#E5EBE3] rounded-lg flex items-start gap-3">
                <CheckCircle className="w-4 h-4 text-emerald-600 mt-0.5" />
                <div>
                  <span className="font-bold block text-slate-700">Traffic Light Verification</span>
                  <span className="text-[#5B6B5B]">Instant auto-approval for green/red claims with officer dispatch for yellow zones.</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 4. Platform Features Section */}
      <section id="features" className="bg-[#F7F9F5] border-b border-[#E5EBE3] py-16 px-6">
        <div className="max-w-7xl mx-auto">
          <div className="text-center max-w-2xl mx-auto mb-12">
            <h3 className="text-2xl font-bold text-[#1B5E20]">Core Platform Capabilities</h3>
            <p className="text-sm text-[#5B6B5B] mt-2">End-to-end de-risking ecosystem built for smallholder farmers</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="bg-white border border-[#E5EBE3] rounded-xl p-6 shadow-sm">
              <div className="w-10 h-10 bg-emerald-100 text-[#1B5E20] rounded-lg flex items-center justify-center font-bold mb-4">
                <Satellite className="w-5 h-5" />
              </div>
              <h4 className="text-base font-bold text-[#1B5E20] mb-2">Crop Health & NDVI Risk Monitoring</h4>
              <p className="text-xs text-[#374151] leading-relaxed">
                Daily satellite vegetation index tracking mapped to GeoJSON farm boundaries with IMD weather risk integration.
              </p>
            </div>

            <div className="bg-white border border-[#E5EBE3] rounded-xl p-6 shadow-sm">
              <div className="w-10 h-10 bg-blue-100 text-blue-800 rounded-lg flex items-center justify-center font-bold mb-4">
                <Shield className="w-5 h-5" />
              </div>
              <h4 className="text-base font-bold text-[#1B5E20] mb-2">Traffic Light Claims Verification</h4>
              <p className="text-xs text-[#374151] leading-relaxed">
                Automated Green/Yellow/Red decision engine linking satellite spectral drops directly to Instant Approval or Officer Field Dispatch.
              </p>
            </div>

            <div className="bg-white border border-[#E5EBE3] rounded-xl p-6 shadow-sm">
              <div className="w-10 h-10 bg-amber-100 text-amber-800 rounded-lg flex items-center justify-center font-bold mb-4">
                <Landmark className="w-5 h-5" />
              </div>
              <h4 className="text-base font-bold text-[#1B5E20] mb-2">Parametric Insurance & DBT Payouts</h4>
              <p className="text-xs text-[#374151] leading-relaxed">
                Seamless digital claim filings with direct Aadhaar bank account transfer for approved indemnities.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* 5. How It Works (4 Steps) */}
      <section id="how-it-works" className="bg-white border-b border-[#E5EBE3] py-16 px-6">
        <div className="max-w-7xl mx-auto">
          <div className="text-center max-w-2xl mx-auto mb-12">
            <h3 className="text-2xl font-bold text-[#1B5E20]">How AgriSense AI Works</h3>
            <p className="text-sm text-[#5B6B5B] mt-2">Transparent 4-step process from land registration to claim payout</p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            <div className="bg-[#F7F9F5] border border-[#E5EBE3] rounded-xl p-6 text-center space-y-3">
              <div className="w-12 h-12 bg-[#2E7D32] text-white rounded-full flex items-center justify-center font-bold mx-auto text-lg">
                1
              </div>
              <h4 className="text-sm font-bold text-slate-800">Register Farm</h4>
              <p className="text-xs text-[#5B6B5B] leading-relaxed">Draw GeoJSON land boundaries on interactive maps and link Khasra land records.</p>
            </div>

            <div className="bg-[#F7F9F5] border border-[#E5EBE3] rounded-xl p-6 text-center space-y-3">
              <div className="w-12 h-12 bg-[#2E7D32] text-white rounded-full flex items-center justify-center font-bold mx-auto text-lg">
                2
              </div>
              <h4 className="text-sm font-bold text-slate-800">Monitor Risk</h4>
              <p className="text-xs text-[#5B6B5B] leading-relaxed">Receive daily satellite vegetation health updates and regional weather alerts.</p>
            </div>

            <div className="bg-[#F7F9F5] border border-[#E5EBE3] rounded-xl p-6 text-center space-y-3">
              <div className="w-12 h-12 bg-[#2E7D32] text-white rounded-full flex items-center justify-center font-bold mx-auto text-lg">
                3
              </div>
              <h4 className="text-sm font-bold text-slate-800">File Claim</h4>
              <p className="text-xs text-[#5B6B5B] leading-relaxed">Submit damage reports after extreme weather events with geotagged media.</p>
            </div>

            <div className="bg-[#F7F9F5] border border-[#E5EBE3] rounded-xl p-6 text-center space-y-3">
              <div className="w-12 h-12 bg-[#2E7D32] text-white rounded-full flex items-center justify-center font-bold mx-auto text-lg">
                4
              </div>
              <h4 className="text-sm font-bold text-slate-800">Get Payout</h4>
              <p className="text-xs text-[#5B6B5B] leading-relaxed">Automated Traffic Light verification triggers direct bank account transfers.</p>
            </div>
          </div>
        </div>
      </section>

      {/* 6. Role Portal Access */}
      <section className="bg-[#F7F9F5] border-b border-[#E5EBE3] py-12 px-6">
        <div className="max-w-7xl mx-auto">
          <div className="text-center max-w-2xl mx-auto mb-8">
            <h3 className="text-xl font-bold text-[#1B5E20]">Select Role to Continue</h3>
            <p className="text-xs text-[#5B6B5B] mt-1">Access AgriSense AI with your registered account</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-3xl mx-auto">
            <div className="bg-white border border-[#E5EBE3] rounded-xl p-6 shadow-sm flex flex-col justify-between">
              <div className="space-y-3">
                <div className="w-12 h-12 bg-green-100 text-[#1B5E20] rounded-lg flex items-center justify-center font-bold text-xl">
                  🌾
                </div>
                <h4 className="text-base font-bold text-[#1B5E20]">Farmer Portal</h4>
                <p className="text-xs text-[#374151] leading-relaxed">
                  File crop loss claims, track parametric satellite assessments, and receive direct benefit transfer payouts.
                </p>
                <div className="text-[11px] font-mono text-slate-600 bg-[#F7F9F5] p-2 rounded border border-[#E5EBE3]">
                  Registered Mobile: <strong>9876543210</strong>
                </div>
              </div>
              <Link
                href="/login?role=farmer"
                className="mt-6 w-full bg-[#2E7D32] hover:bg-[#1B5E20] text-white text-xs font-bold py-2.5 px-4 rounded-lg text-center transition-all flex items-center justify-center gap-2"
              >
                Farmer Login <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            </div>

            <div className="bg-white border border-[#E5EBE3] rounded-xl p-6 shadow-sm flex flex-col justify-between">
              <div className="space-y-3">
                <div className="w-12 h-12 bg-blue-100 text-blue-800 rounded-lg flex items-center justify-center font-bold text-xl">
                  👮
                </div>
                <h4 className="text-base font-bold text-[#1B5E20]">Agriculture Officer Portal</h4>
                <p className="text-xs text-[#374151] leading-relaxed">
                  Evaluate Traffic Light AI indicators, conduct field visit verifications with centroid GPS, and approve claim payouts.
                </p>
                <div className="text-[11px] font-mono text-slate-600 bg-[#F7F9F5] p-2 rounded border border-[#E5EBE3]">
                  Registered Mobile: <strong>9876543299</strong>
                </div>
              </div>
              <Link
                href="/login?role=officer"
                className="mt-6 w-full border-2 border-[#166534] text-[#1B5E20] hover:bg-[#2E7D32]/5 text-xs font-bold py-2 px-4 rounded-lg text-center transition-all flex items-center justify-center gap-2"
              >
                Officer Login <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* 7. Official Footer */}
      <footer className="bg-white border-t border-[#E5EBE3] py-8 px-6 md:px-12 text-xs text-[#5B6B5B]">
        <div className="max-w-7xl mx-auto grid grid-cols-1 md:grid-cols-3 gap-8 items-center border-b border-slate-100 pb-8 mb-6">
          <div className="space-y-2">
            <h4 className="font-bold text-slate-700">Ministry of Agriculture & Farmers Welfare</h4>
            <p className="text-[#5B6B5B] leading-relaxed">
              Department of Agriculture & Farmers Welfare<br />
              Krishi Bhawan, New Delhi - 110001
            </p>
          </div>
          <div className="space-y-2">
            <h4 className="font-bold text-slate-700">Quick Links</h4>
            <div className="grid grid-cols-2 gap-2 text-slate-400">
              <a href="https://pmfby.gov.in" target="_blank" rel="noreferrer" className="hover:underline">PMFBY Portal</a>
              <a href="https://pmkisan.gov.in" target="_blank" rel="noreferrer" className="hover:underline">PM-KISAN</a>
              <a href="https://enam.gov.in" target="_blank" rel="noreferrer" className="hover:underline">e-NAM Portal</a>
              <a href="https://dacfw.nic.in" target="_blank" rel="noreferrer" className="hover:underline">Ministry Website</a>
            </div>
          </div>
          <div className="space-y-2">
            <h4 className="font-bold text-slate-700">Data Security & Compliance</h4>
            <p className="text-slate-400 leading-relaxed">
              Your personal data and agricultural records are protected under the Digital Personal Data Protection Act, 2023.
            </p>
          </div>
        </div>
        
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row justify-between items-center gap-4">
          <div className="flex items-center gap-2">
            <Globe className="w-4 h-4 text-[#1B5E20]" />
            <span className="font-medium text-[#374151]">AgriSense AI Portal — National e-Governance Division</span>
          </div>
          <div className="text-slate-400 font-bold uppercase tracking-wider text-[10px]">
            🇮🇳 Digital India | NIC Enabled
          </div>
        </div>
      </footer>
    </div>
  );
}
