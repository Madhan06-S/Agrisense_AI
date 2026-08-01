"use client";

import React, { useMemo, useState } from "react";
import { Canvas } from "@react-three/fiber";
import { OrbitControls, Html } from "@react-three/drei";
import * as THREE from "three";
import { Info, HelpCircle, Landmark } from "lucide-react";

interface CreditScore3DProps {
  score?: number;
  breakdown?: Record<string, number>;
  regionalAverage?: number;
}

// Subcomponent: Ring sector segment representation
function RingSegment({
  label,
  value,
  color,
  rotationZ
}: {
  label: string;
  value: number;
  color: string;
  rotationZ: number;
}) {
  // sector fill arc based on metric value
  const arcLength = (value / 100.0) * (Math.PI / 3.2); // ~45 deg max sector

  return (
    <group rotation={[0, 0, rotationZ]}>
      {/* Torus Sector outline background */}
      <mesh>
        <torusGeometry args={[2.0, 0.12, 16, 64, Math.PI / 3.2]} />
        <meshStandardMaterial color="#1e293b" roughness={0.9} />
      </mesh>
      
      {/* Torus Sector fill */}
      <mesh>
        <torusGeometry args={[2.0, 0.13, 16, 64, arcLength]} />
        <meshStandardMaterial color={color} emissive={color} emissiveIntensity={0.5} roughness={0.1} />
      </mesh>
    </group>
  );
}

// Subcomponent: 3D Historical line plot
function TimelineTrajectory() {
  const points = useMemo(() => [
    new THREE.Vector3(-3.0, -1.0, 0.0),
    new THREE.Vector3(-1.0, -0.5, 0.5),
    new THREE.Vector3(1.0, 0.2, -0.5),
    new THREE.Vector3(3.0, 1.0, 0.0)
  ], []);

  const lineGeometry = useMemo(() => new THREE.BufferGeometry().setFromPoints(points), [points]);

  return (
    <group position={[0, -2.5, 0]}>
      {/* Historical line path */}
      <line geometry={lineGeometry}>
        <lineBasicMaterial color="#38bdf8" linewidth={3} />
      </line>
      
      {/* Event node points */}
      <mesh position={[-3.0, -1.0, 0.0]}>
        <sphereGeometry args={[0.15, 8, 8]} />
        <meshStandardMaterial color="#38bdf8" />
      </mesh>
      <Html position={[-3.0, -1.4, 0.0]} center>
        <div className="px-1 py-0.5 rounded bg-slate-900 text-[6px] text-slate-400 font-bold uppercase pointer-events-none whitespace-nowrap">
          2024: 520
        </div>
      </Html>

      <mesh position={[-1.0, -0.5, 0.5]}>
        <sphereGeometry args={[0.15, 8, 8]} />
        <meshStandardMaterial color="#38bdf8" />
      </mesh>
      <Html position={[-1.0, -0.9, 0.5]} center>
        <div className="px-1 py-0.5 rounded bg-slate-900 text-[6px] text-slate-400 font-bold uppercase pointer-events-none whitespace-nowrap">
          2025: 610
        </div>
      </Html>

      <mesh position={[1.0, 0.2, -0.5]}>
        <sphereGeometry args={[0.15, 8, 8]} />
        <meshStandardMaterial color="#10b981" />
      </mesh>
      <Html position={[1.0, -0.2, -0.5]} center>
        <div className="px-1 py-0.5 rounded bg-emerald-500 text-black text-[6px] font-bold uppercase pointer-events-none whitespace-nowrap">
          2026: 680
        </div>
      </Html>

      {/* Grid background floor */}
      <gridHelper args={[8, 8, "#334155", "#0f172a"]} position={[0, -1.4, 0]} />
    </group>
  );
}

export default function CreditScore3D({ score = 680, breakdown, regionalAverage = 620 }: CreditScore3DProps) {
  const metrics = useMemo(() => {
    if (breakdown) return breakdown;
    return {
      stability: 80.0,
      diversity: 70.0,
      productivity: 85.0,
      resilience: 80.0,
      payment_history: 95.0,
      tenure: 60.0
    };
  }, [breakdown]);

  // Loan simulator state
  const [loanAmount, setLoanAmount] = useState(150000);
  const [tenureMonths, setTenureMonths] = useState(12);

  // Interest rate depends on score tier
  const interestRate = useMemo(() => {
    if (score >= 750) return 7.0;
    if (score >= 650) return 9.0;
    if (score >= 550) return 12.0;
    return 15.0;
  }, [score]);

  // Calculate monthly EMI: principal * rate / 12
  const monthlyEMI = useMemo(() => {
    const rateDecimal = interestRate / 100.0 / 12.0;
    const emi = (loanAmount * rateDecimal * Math.pow(1 + rateDecimal, tenureMonths)) / 
                (Math.pow(1 + rateDecimal, tenureMonths) - 1);
    return emi || 0.0;
  }, [loanAmount, tenureMonths, interestRate]);

  // Score tier text
  const scoreTier = useMemo(() => {
    if (score >= 750) return { label: "EXCELLENT", colorClass: "text-emerald-400 border-emerald-500/30" };
    if (score >= 650) return { label: "GOOD", colorClass: "text-blue-400 border-blue-500/30" };
    if (score >= 550) return { label: "FAIR", colorClass: "text-yellow-500 border-yellow-500/30" };
    return { label: "BUILDING", colorClass: "text-red-500 border-red-500/30" };
  }, [score]);

  return (
    <div className="relative w-full rounded-2xl border border-white/10 bg-slate-950 overflow-hidden flex flex-col md:flex-row font-sans">
      
      {/* 3D Canvas view (Left) */}
      <div className="relative flex-grow h-[380px] bg-slate-950">
        <Canvas camera={{ position: [0, 0, 7.5], fov: 40 }}>
          <ambientLight intensity={0.6} />
          <directionalLight position={[5, 5, 5]} intensity={1.5} />
          
          {/* Main 6 Segmented Credit Ring */}
          <group position={[0, 0.8, 0]}>
            {/* Center score orb */}
            <mesh>
              <sphereGeometry args={[1.0, 32, 32]} />
              <meshStandardMaterial color="#0b1329" metalness={0.9} roughness={0.1} />
            </mesh>
            <Html position={[0, 0, 0]} center>
              <div className="text-center pointer-events-none">
                <span className="text-2xl font-black text-white block leading-none">{score}</span>
                <span className="text-[7.5px] text-slate-400 font-bold uppercase tracking-wider block mt-1">CIBIL Alternate</span>
              </div>
            </Html>

            {/* Segments (rotated around Z-axis) */}
            {/* 1. Stability */}
            <RingSegment label="Stability" value={metrics.stability} color="#10b981" rotationZ={0} />
            {/* 2. Diversity */}
            <RingSegment label="Diversity" value={metrics.diversity} color="#34d399" rotationZ={Math.PI / 3} />
            {/* 3. Productivity */}
            <RingSegment label="Productivity" value={metrics.productivity} color="#60a5fa" rotationZ={2 * Math.PI / 3} />
            {/* 4. Resilience */}
            <RingSegment label="Resilience" value={metrics.resilience} color="#38bdf8" rotationZ={Math.PI} />
            {/* 5. Payments */}
            <RingSegment label="Payments" value={metrics.payment_history} color="#fbbf24" rotationZ={4 * Math.PI / 3} />
            {/* 6. Tenure */}
            <RingSegment label="Tenure" value={metrics.tenure} color="#f59e0b" rotationZ={5 * Math.PI / 3} />
          </group>

          {/* Timeline Trajectory */}
          <TimelineTrajectory />

          <OrbitControls enableDamping maxPolarAngle={Math.PI / 2.1} minDistance={4} maxDistance={10} />
        </Canvas>

        {/* Regional indicator badge */}
        <div className="absolute top-4 left-4 bg-slate-900/90 border border-white/10 px-3 py-1.5 rounded-lg backdrop-blur text-[9.5px]">
          <span className="text-slate-400 block mb-0.5 uppercase tracking-wide">Regional Comparison</span>
          <p className="text-white font-bold">You: <span className="text-emerald-400">{score}</span> | Region Avg: <span className="text-slate-400">{regionalAverage}</span></p>
        </div>
      </div>

      {/* Loan Simulator Panel (Right sidebar) */}
      <div className="w-full md:w-80 bg-slate-900/40 p-4 border-t md:border-t-0 md:border-l border-white/10 flex flex-col gap-4">
        <div>
          <h4 className="text-xs font-bold text-white tracking-wide uppercase">Interactive Loan Simulator</h4>
          <p className="text-[10px] text-slate-400 mt-1 leading-relaxed">
            See your eligible credit limit, interest rates, and monthly EMI based on satellite score.
          </p>
        </div>

        {/* Simulator controls */}
        <div className="flex flex-col gap-4 flex-grow">
          {/* Loan Amount Slider */}
          <div className="flex flex-col gap-1">
            <div className="flex justify-between text-[10px]">
              <span className="text-slate-300 font-semibold uppercase">Loan Amount</span>
              <span className="text-emerald-400 font-bold">₹{loanAmount.toLocaleString("en-IN")}</span>
            </div>
            <input
              type="range"
              min="10000"
              max={score >= 750 ? 500000 : score >= 650 ? 300000 : score >= 550 ? 100000 : 50000}
              step="5000"
              value={loanAmount}
              onChange={(e) => setLoanAmount(parseInt(e.target.value))}
              className="w-full accent-emerald-400"
            />
            <span className="text-[8px] text-slate-500 italic">Max limit based on your credit tier.</span>
          </div>

          {/* Tenure Slider */}
          <div className="flex flex-col gap-1">
            <div className="flex justify-between text-[10px]">
              <span className="text-slate-300 font-semibold uppercase">Tenure (Months)</span>
              <span className="text-blue-400 font-bold">{tenureMonths} months</span>
            </div>
            <input
              type="range"
              min="3"
              max="24"
              step="1"
              value={tenureMonths}
              onChange={(e) => setTenureMonths(parseInt(e.target.value))}
              className="w-full accent-blue-400"
            />
          </div>

          {/* EMI Results Box */}
          <div className="p-3.5 rounded-lg border border-white/5 bg-slate-950 flex flex-col gap-2">
            <div className="flex justify-between items-center text-[10px]">
              <span className="text-slate-400 uppercase font-semibold">Interest Rate</span>
              <span className="text-white font-extrabold">{interestRate}% p.a.</span>
            </div>
            <div className="flex justify-between items-center text-[10px]">
              <span className="text-slate-400 uppercase font-semibold">Monthly EMI</span>
              <span className="text-emerald-400 font-extrabold text-xs">₹{Math.round(monthlyEMI).toLocaleString("en-IN")}</span>
            </div>
            <div className="flex justify-between items-center text-[10px] border-t border-white/5 pt-2 mt-1">
              <span className="text-slate-400 uppercase font-semibold text-[8px]">Repayment Total</span>
              <span className="text-white font-bold text-[10px]">₹{Math.round(monthlyEMI * tenureMonths).toLocaleString("en-IN")}</span>
            </div>
          </div>
        </div>

        {/* Global actions */}
        <div className="flex flex-col gap-2 pt-4 border-t border-white/5">
          <button className="w-full flex items-center justify-center gap-1.5 bg-[#22c55e] hover:bg-emerald-500 text-black font-bold py-2 px-4 rounded-lg text-xs transition cursor-pointer">
            <Landmark className="w-3.5 h-3.5" /> Apply for Loan
          </button>
          
          <div className="p-2.5 rounded border border-[#eab308]/20 bg-[#eab308]/5 text-[9px] text-[#eab308] leading-normal flex gap-1.5 items-start">
            <Info className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
            <p>
              Credit scoring is evaluated solely against crop vigor stability and exclude sensitive demographic bias parameters.
            </p>
          </div>
        </div>

      </div>

    </div>
  );
}
