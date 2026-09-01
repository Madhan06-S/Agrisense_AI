"use client";

import React, { useMemo, useRef, useState, useEffect } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { OrbitControls, Sparkles, Html } from "@react-three/drei";
import * as THREE from "three";
import { CheckCircle2, Landmark, RefreshCw, Smartphone, TrendingUp } from "lucide-react";

interface Payout3DProps {
  amount?: number;
  farmerName?: string;
  status?: "INITIATED" | "PENDING" | "PROCESSING" | "COMPLETED" | "FAILED";
  onRetry?: () => void;
}

// Subcomponent: Golden coin flow particle
function FlowingCoin({
  startPos,
  endPos,
  delay,
  speed,
  active
}: {
  startPos: [number, number, number];
  endPos: [number, number, number];
  delay: number;
  speed: number;
  active: boolean;
}) {
  const meshRef = useRef<THREE.Mesh>(null);
  const startTime = useMemo(() => Date.now() + delay * 1000, [delay]);

  useFrame(() => {
    if (meshRef.current && active) {
      const now = Date.now();
      if (now < startTime) {
        meshRef.current.position.set(...startPos);
        return;
      }
      
      const elapsed = (now - startTime) / 1000;
      const progress = (elapsed * speed) % 1.0;
      
      // Linear interpolation along pipeline curve
      const x = startPos[0] + (endPos[0] - startPos[0]) * progress;
      // Arch curve height
      const y = startPos[1] + (endPos[1] - startPos[1]) * progress + 2.0 * Math.sin(progress * Math.PI);
      const z = startPos[2] + (endPos[2] - startPos[2]) * progress;
      
      meshRef.current.position.set(x, y, z);
      meshRef.current.rotation.y += 0.05;
    }
  });

  return (
    <mesh ref={meshRef} position={startPos}>
      <cylinderGeometry args={[0.18, 0.18, 0.03, 16]} />
      <meshStandardMaterial
        color="#fbbf24"
        emissive="#d97706"
        emissiveIntensity={active ? 0.6 : 0.05}
        metalness={0.9}
        roughness={0.1}
      />
    </mesh>
  );
}

// Subcomponent: Glowing dot on India map
function MapDot({ position, active }: { position: [number, number, number]; active: boolean }) {
  const dotRef = useRef<THREE.Mesh>(null);

  useFrame(({ clock }) => {
    if (dotRef.current && active) {
      const elapsed = clock.getElapsedTime();
      const scale = 1.0 + 0.25 * Math.sin(elapsed * 5.0);
      dotRef.current.scale.set(scale, scale, scale);
    }
  });

  const color = active ? "#34d399" : "#4b5563";

  return (
    <mesh ref={dotRef} position={position}>
      <sphereGeometry args={[0.08, 8, 8]} />
      <meshStandardMaterial color={color} emissive={color} emissiveIntensity={active ? 0.8 : 0.1} />
    </mesh>
  );
}

export default function Payout3D({ amount = 45000, farmerName = "Ramesh Patel", status = "COMPLETED", onRetry }: Payout3DProps) {
  const [currentStage, setCurrentStage] = useState(0);

  // Animate stages sequencing
  useEffect(() => {
    if (status === "INITIATED") {
      setCurrentStage(1);
    } else if (status === "PENDING") {
      setCurrentStage(2);
    } else if (status === "PROCESSING") {
      setCurrentStage(3);
    } else if (status === "COMPLETED") {
      setCurrentStage(5);
    } else {
      setCurrentStage(0);
    }
  }, [status]);

  // Coordinates for flows
  const treasuryPos: [number, number, number] = [-4.0, 0.5, 0.0];
  const bankPos: [number, number, number] = [4.0, 0.5, 0.0];

  // Map of India simulated coordinates on floor
  const indiaDots: Array<[number, number, number]> = useMemo(() => [
    [-1.0, -0.49, -1.0], [0.0, -0.49, -1.5], [1.0, -0.49, -1.0],
    [-0.5, -0.49, 0.0], [0.5, -0.49, 0.0], [0.0, -0.49, 1.0],
    [-0.8, -0.49, 1.5], [0.8, -0.49, 1.5]
  ], []);

  return (
    <div className="relative w-full rounded-2xl border border-white/10 bg-slate-950 overflow-hidden flex flex-col font-sans">
      
      {/* 3D Money flow canvas */}
      <div className="relative w-full h-[320px] bg-[#020617]">
        <Canvas camera={{ position: [0, 6, 10], fov: 40 }}>
          <ambientLight intensity={0.5} />
          <directionalLight position={[10, 15, 10]} intensity={1.5} />
          
          {/* Government Treasury (Left Building) */}
          <group position={treasuryPos}>
            <mesh position={[0, 0.4, 0]}>
              <boxGeometry args={[1.6, 1.0, 1.6]} />
              <meshStandardMaterial color="#1e293b" roughness={0.3} metalness={0.7} />
            </mesh>
            {/* Columns */}
            <mesh position={[-0.6, -0.2, 0.6]}><cylinderGeometry args={[0.08, 0.08, 0.6]} /><meshStandardMaterial color="#475569" /></mesh>
            <mesh position={[0.6, -0.2, 0.6]}><cylinderGeometry args={[0.08, 0.08, 0.6]} /><meshStandardMaterial color="#475569" /></mesh>
            {/* Roof Cone */}
            <mesh position={[0, 1.1, 0]} rotation={[0, Math.PI / 4, 0]}>
              <coneGeometry args={[1.3, 0.6, 4]} />
              <meshStandardMaterial color="#0f172a" roughness={0.4} />
            </mesh>
            <Html position={[0, 1.7, 0]} center>
              <div className="flex gap-1 items-center px-2 py-0.5 rounded bg-slate-900 border border-white/10 text-[7px] text-slate-300 font-bold uppercase tracking-wider whitespace-nowrap pointer-events-none">
                <Landmark className="w-2.5 h-2.5 text-blue-400" />
                RBI Treasury
              </div>
            </Html>
          </group>

          {/* Farmer Phone / Bank (Right Box) */}
          <group position={bankPos}>
            {/* Phone Base */}
            <mesh position={[0, 0.5, 0]} rotation={[0.2, -0.4, 0.1]}>
              <boxGeometry args={[0.9, 1.6, 0.12]} />
              <meshStandardMaterial color="#020617" roughness={0.1} metalness={0.9} />
            </mesh>
            {/* Screen */}
            <mesh position={[0, 0.5, 0.07]} rotation={[0.2, -0.4, 0.1]}>
              <planeGeometry args={[0.8, 1.5]} />
              <meshStandardMaterial
                color="#047857"
                emissive="#059669"
                emissiveIntensity={status === "COMPLETED" ? 0.6 : 0.05}
              />
            </mesh>
            <Html position={[0, 1.6, 0]} center>
              <div className="flex gap-1 items-center px-2 py-0.5 rounded bg-slate-900 border border-white/10 text-[7px] text-slate-300 font-bold uppercase tracking-wider whitespace-nowrap pointer-events-none">
                <Smartphone className="w-2.5 h-2.5 text-emerald-400" />
                Farmer Phone
              </div>
            </Html>
          </group>

          {/* Golden coins flowing through arch pipeline */}
          {status === "PROCESSING" && (
            <>
              <FlowingCoin startPos={treasuryPos} endPos={bankPos} delay={0.0} speed={0.9} active={true} />
              <FlowingCoin startPos={treasuryPos} endPos={bankPos} delay={0.3} speed={0.9} active={true} />
              <FlowingCoin startPos={treasuryPos} endPos={bankPos} delay={0.6} speed={0.9} active={true} />
              <FlowingCoin startPos={treasuryPos} endPos={bankPos} delay={0.9} speed={0.9} active={true} />
            </>
          )}

          {/* Confetti explosion at destination upon success */}
          {status === "COMPLETED" && (
            <Sparkles count={120} scale={2.5} size={3.0} speed={1.5} color="#fbbf24" position={[4.0, 1.2, 0]} />
          )}

          {/* India Grid base plane */}
          <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.5, 0]}>
            <planeGeometry args={[14, 6]} />
            <meshStandardMaterial color="#070f1e" roughness={0.9} />
          </mesh>
          <gridHelper args={[14, 15, "#1e293b", "#0f172a"]} position={[0, -0.49, 0]} />

          {/* India Map dots */}
          {indiaDots.map((dot, idx) => (
            <MapDot key={`dot-${idx}`} position={dot} active={status === "COMPLETED"} />
          ))}

          <OrbitControls enableDamping maxPolarAngle={Math.PI / 2.1} minDistance={6} maxDistance={15} />
        </Canvas>

        {/* Real-time status badge */}
        <div className="absolute top-4 left-4 bg-slate-900/90 border border-white/10 px-3 py-1.5 rounded-lg backdrop-blur flex gap-2 items-center">
          <div className={`w-2.5 h-2.5 rounded-full ${
            status === "COMPLETED" ? "bg-emerald-500 animate-pulse" : status === "FAILED" ? "bg-red-500" : "bg-blue-400 animate-ping"
          }`} />
          <span className="text-[10px] text-white font-bold uppercase tracking-wider">{status}</span>
        </div>
      </div>

      {/* Transaction status stages progress checklist */}
      <div className="p-4 border-t border-white/10 bg-slate-900/30 grid grid-cols-5 gap-2 text-center">
        <div className="flex flex-col items-center gap-1.5">
          <CheckCircle2 className={`w-4 h-4 ${currentStage >= 1 ? "text-emerald-500" : "text-slate-600"}`} />
          <span className="text-[7.5px] text-slate-400 font-semibold uppercase">AI Approved</span>
        </div>
        <div className="flex flex-col items-center gap-1.5">
          <CheckCircle2 className={`w-4 h-4 ${currentStage >= 2 ? "text-emerald-500" : "text-slate-600"}`} />
          <span className="text-[7.5px] text-slate-400 font-semibold uppercase">Rules Evaluated</span>
        </div>
        <div className="flex flex-col items-center gap-1.5">
          <CheckCircle2 className={`w-4 h-4 ${currentStage >= 3 ? "text-emerald-500" : "text-slate-600"}`} />
          <span className="text-[7.5px] text-slate-400 font-semibold uppercase">Calculated</span>
        </div>
        <div className="flex flex-col items-center gap-1.5">
          <CheckCircle2 className={`w-4 h-4 ${currentStage >= 4 ? "text-emerald-500" : "text-slate-600"}`} />
          <span className="text-[7.5px] text-slate-400 font-semibold uppercase">Bank Verified</span>
        </div>
        <div className="flex flex-col items-center gap-1.5">
          <CheckCircle2 className={`w-4 h-4 ${currentStage >= 5 ? "text-emerald-500" : "text-slate-600"}`} />
          <span className="text-[7.5px] text-slate-400 font-semibold uppercase">Disbursed</span>
        </div>
      </div>

      {/* Payout Details */}
      <div className="p-4 border-t border-white/10 bg-slate-900/50 flex justify-between items-center text-xs">
        <div>
          <span className="text-[9px] text-slate-500 font-bold uppercase tracking-wider block">Recipient</span>
          <span className="font-bold text-white">{farmerName}</span>
        </div>
        
        <div className="text-right">
          <span className="text-[9px] text-slate-500 font-bold uppercase tracking-wider block">Disbursement Amount</span>
          <span className="font-extrabold text-emerald-400 text-sm">₹{amount.toLocaleString("en-IN")}</span>
        </div>
        
        {status === "FAILED" && onRetry && (
          <button
            onClick={onRetry}
            className="flex gap-1.5 items-center py-1.5 px-3 rounded bg-red-600 hover:bg-red-500 text-white font-bold uppercase text-[9px] tracking-wider transition"
          >
            <RefreshCw className="w-3.5 h-3.5" /> Retry Payment
          </button>
        )}
      </div>

    </div>
  );
}
