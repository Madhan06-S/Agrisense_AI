"use client";

import React, { useState } from "react";
import Link from "next/link";
import { ArrowRight, Shield, Satellite, CheckCircle, Info, Phone, FileText, Globe, Landmark } from "lucide-react";

export default function HomePage() {
  const [lang, setLang] = useState<"en" | "hi">("en");

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 font-sans flex flex-col justify-between">
      {/* 1. Official Government Header Bar */}
      <div className="bg-[#1a4d2e] text-white text-xs px-6 py-2 flex justify-between items-center border-b border-[#166534]">
        <div className="flex items-center gap-4">
          <span className="font-medium">भारत सरकार | Government of India</span>
          <span className="hidden md:inline text-slate-300">| Pradhan Mantri Fasal Bima Yojana (PMFBY) Portal</span>
        </div>
        <div className="flex items-center gap-3">
          <button 
            onClick={() => setLang("en")} 
            className={`hover:text-emerald-300 transition-colors ${lang === "en" ? "font-bold text-emerald-400" : ""}`}
          >
            English
          </button>
          <span className="text-slate-500">|</span>
          <button 
            onClick={() => setLang("hi")} 
            className={`hover:text-emerald-300 transition-colors ${lang === "hi" ? "font-bold text-emerald-400" : ""}`}
          >
            हिंदी
          </button>
        </div>
      </div>

      {/* 2. Main Portal Brand Header */}
      <header className="bg-white border-b border-slate-200 shadow-sm py-4 px-6 md:px-12">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row justify-between items-center gap-4">
          <div className="flex items-center gap-4">
            {/* Ashoka Chakra SVG Icon */}
            <div className="shrink-0">
              <svg className="w-12 h-12 text-[#166534]" viewBox="0 0 100 100" fill="none" stroke="currentColor" strokeWidth="2">
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
                      x2={50 + 45 * Math.cos(rad)}
                      y2={50 + 45 * Math.sin(rad)}
                      strokeWidth="1.5"
                    />
                  );
                })}
              </svg>
            </div>
            <div>
              <h1 className="text-xl font-bold text-[#166534] tracking-tight leading-tight">
                AgriSense AI Portal
              </h1>
              <p className="text-xs text-slate-500 font-semibold tracking-wide uppercase">
                Pradhan Mantri Fasal Bima Yojana (PMFBY)
              </p>
              <p className="text-[10px] text-slate-400">
                Department of Agriculture & Farmers Welfare, Ministry of Agriculture
              </p>
            </div>
          </div>
          
          <div className="flex items-center gap-4 text-xs font-semibold">
            <a href="#eligibility" className="text-slate-600 hover:text-[#166534]">Eligibility</a>
            <a href="#documents" className="text-slate-600 hover:text-[#166534]">Required Documents</a>
            <a href="#process" className="text-slate-600 hover:text-[#166534]">Assessment Process</a>
          </div>
        </div>
      </header>

      {/* 3. Hero Section (Left-aligned Clean Government Theme) */}
      <section className="bg-white border-b border-slate-200 py-12 md:py-20 px-6 md:px-12">
        <div className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
          <div className="lg:col-span-7 space-y-6">
            <div className="inline-flex items-center gap-2 bg-[#166534]/10 border border-[#166534]/30 px-3 py-1 rounded-full text-[#166534] text-xs font-bold uppercase tracking-wider">
              Official e-Governance Service
            </div>
            <h2 className="text-3xl md:text-5xl font-extrabold text-slate-900 leading-tight">
              PMFBY Digital Claim Settlement Portal
            </h2>
            <p className="text-slate-600 text-base md:text-lg leading-relaxed max-w-xl">
              AgriSense AI uses Sentinel-2 multispectral daily imagery, SAR flood indexing, and certified machine learning models to detect agricultural damage and process claims with audit trails.
            </p>
            
            <div className="flex flex-col sm:flex-row gap-4 pt-2">
              <Link 
                href="/login" 
                className="bg-[#166534] hover:bg-emerald-800 text-white font-bold px-8 py-3.5 rounded-lg text-sm text-center shadow-md hover:shadow-lg transition-all flex items-center justify-center gap-2"
              >
                Farmer Login
                <ArrowRight className="w-4 h-4" />
              </Link>
              <Link 
                href="/login" 
                className="border-2 border-[#166534] text-[#166534] hover:bg-[#166534]/5 font-bold px-8 py-3 rounded-lg text-sm text-center transition-all flex items-center justify-center gap-2"
              >
                Officer Portal
                <ArrowRight className="w-4 h-4" />
              </Link>
            </div>

            <div className="bg-amber-50 border-l-4 border-amber-500 p-4 rounded-r-lg max-w-xl">
              <div className="flex gap-3">
                <Info className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
                <div>
                  <h4 className="text-xs font-bold text-amber-800 uppercase tracking-wider">National Helpline Number</h4>
                  <p className="text-sm font-semibold text-slate-800 mt-0.5">
                    For portal support or crop loss registration: <span className="text-[#166534] font-bold">1800-180-1551</span>
                  </p>
                </div>
              </div>
            </div>
          </div>

          <div className="lg:col-span-5 bg-slate-50 border border-slate-200 rounded-xl p-6 shadow-sm space-y-4">
            <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wider border-b border-slate-200 pb-2">
              Notice Board & Quick Statistics
            </h3>
            <div className="space-y-3 text-xs">
              <div className="p-3 bg-white border border-slate-200 rounded-lg flex items-start gap-3">
                <CheckCircle className="w-4 h-4 text-emerald-600 mt-0.5" />
                <div>
                  <span className="font-bold block text-slate-700">Daily Sentinel-2 Indexing</span>
                  <span className="text-slate-500">Multispectral indices computed over active farms daily.</span>
                </div>
              </div>
              <div className="p-3 bg-white border border-slate-200 rounded-lg flex items-start gap-3">
                <CheckCircle className="w-4 h-4 text-emerald-600 mt-0.5" />
                <div>
                  <span className="font-bold block text-slate-700">Parametric Insurance Triggers</span>
                  <span className="text-slate-500">Automated payout scheduling triggered based on NDVI drop profiles.</span>
                </div>
              </div>
              <div className="p-3 bg-white border border-slate-200 rounded-lg flex items-start gap-3">
                <CheckCircle className="w-4 h-4 text-emerald-600 mt-0.5" />
                <div>
                  <span className="font-bold block text-slate-700">Verification Time</span>
                  <span className="text-slate-500">Evaluation pipeline completes within 5 minutes of imagery capture.</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 4. Scheme Details & Document Requirements */}
      <section className="max-w-7xl mx-auto py-12 px-6 grid grid-cols-1 md:grid-cols-2 gap-12">
        {/* Left: Eligibility */}
        <div id="eligibility" className="space-y-4">
          <h3 className="text-lg font-bold text-[#166534] border-b border-slate-200 pb-2 flex items-center gap-2">
            <Landmark className="w-5 h-5" />
            Scheme Eligibility & Details
          </h3>
          <ul className="space-y-3 text-sm text-slate-600">
            <li className="flex items-start gap-2.5">
              <span className="w-1.5 h-1.5 rounded-full bg-[#166534] mt-2 shrink-0" />
              <span>All farmers including sharecroppers and tenant farmers growing notified crops in notified areas are eligible.</span>
            </li>
            <li className="flex items-start gap-2.5">
              <span className="w-1.5 h-1.5 rounded-full bg-[#166534] mt-2 shrink-0" />
              <span>Covers crop losses arising from non-preventable risks such as drought, dry spells, flood, inundation, pests, landslides, natural fire, lightning, storm, hailstorm, and cyclone.</span>
            </li>
            <li className="flex items-start gap-2.5">
              <span className="w-1.5 h-1.5 rounded-full bg-[#166534] mt-2 shrink-0" />
              <span>Parametric index triggers automatically verify crop loss based on geo-spatial boundaries without physical audit delay.</span>
            </li>
          </ul>
        </div>

        {/* Right: Required Documents */}
        <div id="documents" className="space-y-4">
          <h3 className="text-lg font-bold text-[#166534] border-b border-slate-200 pb-2 flex items-center gap-2">
            <FileText className="w-5 h-5" />
            Required Documents for Registration
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
            <div className="p-3 bg-white border border-slate-200 rounded-lg">
              <span className="font-bold text-slate-700 block">Land Records</span>
              <span className="text-slate-500">Land ownership document / Khasra number details.</span>
            </div>
            <div className="p-3 bg-white border border-slate-200 rounded-lg">
              <span className="font-bold text-slate-700 block">Aadhaar Card</span>
              <span className="text-slate-500">Government identity verification linked with phone.</span>
            </div>
            <div className="p-3 bg-white border border-slate-200 rounded-lg">
              <span className="font-bold text-slate-700 block">Bank Passbook</span>
              <span className="text-slate-500">Linked bank account details for direct benefit transfer (DBT).</span>
            </div>
            <div className="p-3 bg-white border border-slate-200 rounded-lg">
              <span className="font-bold text-slate-700 block">Sowing Certificate</span>
              <span className="text-slate-500">Official sowing certificate from Patwari or revenue officer.</span>
            </div>
          </div>
        </div>
      </section>

      {/* 5. Process Pipeline Overview */}
      <section id="process" className="bg-slate-100 border-t border-slate-200 py-12 px-6">
        <div className="max-w-7xl mx-auto text-center space-y-8">
          <div>
            <h3 className="text-2xl font-bold text-slate-800">Satellite-Verified Parametric Evaluation</h3>
            <p className="text-sm text-slate-500 mt-2">Transparent, automated claim assessment workflow</p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 max-w-4xl mx-auto">
            <div className="bg-white border border-slate-200 p-6 rounded-xl text-center space-y-3">
              <div className="w-12 h-12 bg-blue-100 text-blue-800 rounded-full flex items-center justify-center mx-auto">
                <Satellite className="w-6 h-6" />
              </div>
              <h4 className="text-sm font-bold text-slate-800">1. Image Ingestion</h4>
              <p className="text-xs text-slate-500 leading-relaxed">Daily multispectral imagery from Sentinel-2 satellite is mapped onto registered farm boundaries.</p>
            </div>
            <div className="bg-white border border-slate-200 p-6 rounded-xl text-center space-y-3">
              <div className="w-12 h-12 bg-amber-100 text-amber-800 rounded-full flex items-center justify-center mx-auto">
                <Shield className="w-6 h-6" />
              </div>
              <h4 className="text-sm font-bold text-slate-800">2. AI Scoring & Analytics</h4>
              <p className="text-xs text-slate-500 leading-relaxed">XGBoost models analyze vegetation drops (NDVI/VCI) and verify anomalies against regional weather records.</p>
            </div>
            <div className="bg-white border border-slate-200 p-6 rounded-xl text-center space-y-3">
              <div className="w-12 h-12 bg-emerald-100 text-[#166534] rounded-full flex items-center justify-center mx-auto">
                <Landmark className="w-6 h-6" />
              </div>
              <h4 className="text-sm font-bold text-slate-800">3. Direct Wallet Transfer</h4>
              <p className="text-xs text-slate-500 leading-relaxed">Approved claim funds are disbursed via Aadhaar-enabled payment bridge straight to linked accounts.</p>
            </div>
          </div>
        </div>
      </section>

      {/* 6. Official Footer */}
      <footer className="bg-white border-t border-slate-200 py-8 px-6 md:px-12 text-xs text-slate-500">
        <div className="max-w-7xl mx-auto grid grid-cols-1 md:grid-cols-3 gap-8 items-center border-b border-slate-100 pb-8 mb-6">
          <div className="space-y-2">
            <h4 className="font-bold text-slate-700">Ministry of Agriculture & Farmers Welfare</h4>
            <p className="text-slate-500 leading-relaxed">
              Department of Agriculture & Farmers Welfare<br />
              Krishi Bhawan, New Delhi - 110001
            </p>
          </div>
          <div className="space-y-2">
            <h4 className="font-bold text-slate-700">Quick Links</h4>
            <div className="grid grid-cols-2 gap-2 text-slate-400">
              <a href="https://pmfby.gov.in" target="_blank" className="hover:underline">PMFBY Portal</a>
              <a href="https://pmkisan.gov.in" target="_blank" className="hover:underline">PM-KISAN</a>
              <a href="https://enam.gov.in" target="_blank" className="hover:underline">e-NAM Portal</a>
              <a href="https://dacfw.nic.in" target="_blank" className="hover:underline">Ministry Website</a>
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
            <Globe className="w-4 h-4 text-[#166534]" />
            <span className="font-medium text-slate-600">AgriSense AI Portal — National e-Governance Division</span>
          </div>
          <div className="text-slate-400 font-bold uppercase tracking-wider text-[10px]">
            🇮🇳 Digital India | Nic Enabled
          </div>
        </div>
      </footer>
    </div>
  );
}
