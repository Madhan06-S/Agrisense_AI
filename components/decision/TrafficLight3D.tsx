"use client";

import React, { useMemo, useRef } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { OrbitControls, Sparkles, Html } from "@react-three/drei";
import * as THREE from "three";
import { HelpCircle, Wallet } from "lucide-react";

interface TrafficLight3DProps {
  decisionColor: "GREEN" | "RED";
  payoutAmount?: number;
  timelineStep?: number;
}

// Subcomponent: Timeline step node
function TimelineNode({
  label,
  position,
  active,
  completed
}: {
  label: string;
  position: [number, number, number];
  active: boolean;
  completed: boolean;
}) {
  const color = active ? "#10b981" : (completed ? "#059669" : "#475569");
  const size = active ? 0.35 : 0.22;

  return (
    <group position={position}>
      <mesh>
        <sphereGeometry args={[size, 16, 16]} />
        <meshStandardMaterial color={color} emissive={color} emissiveIntensity={active ? 0.8 : 0.1} />
      </mesh>
      <Html position={[0, -0.6, 0]} center>
        <div className={`px-1.5 py-0.5 rounded text-[8px] font-bold uppercase tracking-wider whitespace-nowrap pointer-events-none ${
          active ? "bg-emerald-500 text-black shadow" : "bg-slate-900/80 text-slate-400 border border-white/5"
        }`}>
          {label}
        </div>
      </Html>
    </group>
  );
}

// Subcomponent: Pulsing volumetric light bulb
function VolumetricLight({
  color,
  active,
  position
}: {
  color: string;
  active: boolean;
  position: [number, number, number];
}) {
  const lightRef = useRef<THREE.Mesh>(null);

  useFrame(({ clock }) => {
    if (lightRef.current && active) {
      const elapsed = clock.getElapsedTime();
      const intensity = 0.8 + 0.4 * Math.sin(elapsed * 4.0);
      (lightRef.current.material as THREE.MeshStandardMaterial).emissiveIntensity = intensity;
    }
  });

  return (
    <mesh ref={lightRef} position={position}>
      <sphereGeometry args={[0.85, 32, 32]} />
      <meshStandardMaterial
        color={active ? color : "#1e293b"}
        emissive={active ? color : "#0f172a"}
        emissiveIntensity={active ? 1.0 : 0.05}
        roughness={0.1}
        metalness={0.9}
      />
    </mesh>
  );
}

// GREEN: Rising gold coins — micro-payout received
function RisingCoins({ count = 20 }) {
  const groupRef = useRef<THREE.Group>(null);
  const coins = useMemo(() => {
    const arr = [];
    for (let i = 0; i < count; i++) {
      arr.push({
        x: (Math.random() - 0.5) * 3.5,
        y: Math.random() * 5.0,
        z: (Math.random() - 0.5) * 3.5,
        speed: 0.8 + Math.random() * 1.5,
        rotationSpeed: 1.0 + Math.random() * 2.0
      });
    }
    return arr;
  }, [count]);

  useFrame((state, delta) => {
    if (groupRef.current) {
      groupRef.current.children.forEach((mesh, idx) => {
        const coin = coins[idx];
        if (!coin) return;
        mesh.position.y += coin.speed * delta;
        mesh.rotation.y += coin.rotationSpeed * delta;
        if (mesh.position.y > 6.0) mesh.position.y = -0.5;
      });
    }
  });

  return (
    <group ref={groupRef}>
      {coins.map((c, idx) => (
        <mesh key={`coin-${idx}`} position={[c.x, c.y, c.z]}>
          <cylinderGeometry args={[0.2, 0.2, 0.04, 16]} />
          <meshStandardMaterial color="#fbbf24" metalness={0.9} roughness={0.1} />
        </mesh>
      ))}
    </group>
  );
}

// RED: Broken terrain shards — pasture devastation
function DevastedTerrain() {
  const shards = useMemo(() => {
    return Array.from({ length: 20 }).map((_, i) => ({
      x: (Math.random() - 0.5) * 5,
      z: (Math.random() - 0.5) * 5,
      height: 0.2 + Math.random() * 0.5,
      rotation: Math.random() * Math.PI
    }));
  }, []);

  const groupRef = useRef<THREE.Group>(null);
  useFrame(({ clock }) => {
    if (groupRef.current) {
      groupRef.current.children.forEach((mesh, i) => {
        mesh.position.y = -0.8 + 0.1 * Math.sin(clock.getElapsedTime() * 1.5 + i);
      });
    }
  });

  return (
    <group ref={groupRef} position={[0, -0.5, 0]}>
      {shards.map((s, i) => (
        <mesh key={i} position={[s.x, 0, s.z]} rotation={[0.3, s.rotation, 0.2]}>
          <boxGeometry args={[0.4, s.height, 0.4]} />
          <meshStandardMaterial color="#7f1d1d" roughness={0.9} />
        </mesh>
      ))}
      <gridHelper args={[7, 10, "#450a0a", "#1a0000"]} position={[0, -0.5, 0]} />
    </group>
  );
}

export default function TrafficLight3D({ decisionColor, payoutAmount = 0, timelineStep = 2 }: TrafficLight3DProps) {

  const textInfo = useMemo(() => {
    if (decisionColor === "GREEN") {
      return {
        label: "AUTO-CLOSE: NO DAMAGE",
        colorClass: "text-emerald-400 border-emerald-500/30 bg-emerald-500/10",
        payoutDesc: "Pasture Health Index is normal. De-Risking Status: Claim closed. Your pasture is healthy — no insurance payout needed.",
        walletMsg: null
      };
    }
    return {
      label: "INSTANT MICRO-PAYOUT",
      colorClass: "text-red-500 border-red-500/30 bg-red-500/10",
      payoutDesc: `Disaster detected via Automated Verification (${payoutAmount > 0 ? `₹${payoutAmount.toLocaleString("en-IN")}` : "calculating..."}). Digital Wallet Transfer initiated within 5 minutes.`,
      walletMsg: payoutAmount > 0 ? `₹${payoutAmount.toLocaleString("en-IN")} → Digital Wallet` : null
    };
  }, [decisionColor, payoutAmount]);

  return (
    <div className="relative w-full rounded-2xl border border-white/10 bg-slate-950 overflow-hidden flex flex-col font-sans">

      {/* Header */}
      <div className="p-4 border-b border-white/10 bg-slate-900/40 flex justify-between items-center z-10">
        <div>
          <h3 className="text-sm font-bold text-white tracking-wide">Automated Verification</h3>
          <p className="text-[10px] text-slate-400 mt-0.5">Pillar 5 Binary De-Risking Status</p>
        </div>
        <div className={`px-2.5 py-1 rounded-md border text-[9px] font-bold uppercase tracking-wider ${textInfo.colorClass}`}>
          {textInfo.label}
        </div>
      </div>

      {/* R3F Canvas */}
      <div className="relative w-full h-[380px] bg-slate-950">
        <Canvas camera={{ position: [0, 5, 9], fov: 45 }}>
          <ambientLight intensity={0.6} />
          <directionalLight position={[5, 10, 5]} intensity={1.5} />

          {/* Support frame — binary: only two lights */}
          <group position={[0, 1.5, 0]}>
            <mesh position={[0, 0, 0]}>
              <boxGeometry args={[3.2, 0.15, 0.15]} />
              <meshStandardMaterial color="#1e293b" roughness={0.3} />
            </mesh>
            <mesh position={[0, -2.4, 0]}>
              <cylinderGeometry args={[0.08, 0.08, 4.8, 16]} />
              <meshStandardMaterial color="#1e293b" roughness={0.3} />
            </mesh>
          </group>

          {/* RED Light (left) */}
          <VolumetricLight color="#ef4444" active={decisionColor === "RED"} position={[-1.2, 1.5, 0]} />
          {/* GREEN Light (right) */}
          <VolumetricLight color="#10b981" active={decisionColor === "GREEN"} position={[1.2, 1.5, 0]} />

          {/* Sparkles */}
          {decisionColor === "GREEN" && (
            <Sparkles count={80} scale={3.5} size={2.5} speed={1.5} color="#10b981" position={[1.2, 1.5, 0]} />
          )}
          {decisionColor === "RED" && (
            <Sparkles count={60} scale={3.0} size={2.0} speed={2.0} color="#ef4444" position={[-1.2, 1.5, 0]} />
          )}

          {/* GREEN: Rising Coins (micro-payout celebration) */}
          {decisionColor === "GREEN" && <RisingCoins count={25} />}

          {/* RED: Devastated Terrain */}
          {decisionColor === "RED" && <DevastedTerrain />}

          {/* 3D Journey Timeline */}
          <group position={[0, -2.2, 1.5]}>
            <mesh position={[0, 0, 0]}>
              <boxGeometry args={[6.2, 0.04, 0.04]} />
              <meshStandardMaterial color="#1e293b" />
            </mesh>
            <TimelineNode label="Submitted" position={[-3.0, 0, 0]} active={timelineStep === 0} completed={timelineStep > 0} />
            <TimelineNode label="Satellite Scanned" position={[-1.0, 0, 0]} active={timelineStep === 1} completed={timelineStep > 1} />
            <TimelineNode label="AI Verified" position={[1.0, 0, 0]} active={timelineStep === 2} completed={timelineStep > 2} />
            <TimelineNode label="Resolved" position={[3.0, 0, 0]} active={timelineStep === 3} completed={timelineStep > 3} />
          </group>

          <OrbitControls enableDamping maxPolarAngle={Math.PI / 1.9} minDistance={5} maxDistance={15} />
        </Canvas>

        {/* Payout wallet badge — RED state */}
        {decisionColor === "RED" && textInfo.walletMsg && (
          <div className="absolute bottom-16 left-1/2 -translate-x-1/2 bg-red-950/80 border border-red-500/30 px-3 py-1.5 rounded-lg text-center pointer-events-none backdrop-blur-md flex gap-2 items-center">
            <Wallet className="w-4 h-4 text-red-400 flex-shrink-0" />
            <div>
              <span className="text-[10px] text-red-400 font-bold uppercase tracking-wider block">Digital Wallet Transfer</span>
              <span className="text-sm font-bold text-white">{textInfo.walletMsg}</span>
            </div>
          </div>
        )}
        {/* No payout badge — GREEN state */}
        {decisionColor === "GREEN" && (
          <div className="absolute bottom-16 left-1/2 -translate-x-1/2 bg-emerald-950/80 border border-emerald-500/30 px-3 py-1.5 rounded-lg text-center pointer-events-none backdrop-blur-md">
            <span className="text-[10px] text-emerald-400 font-bold uppercase tracking-wider block">Pasture Health Index</span>
            <span className="text-sm font-bold text-white">Healthy — No Payout Required</span>
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="p-3 border-t border-white/10 bg-slate-900/30 text-[9.5px] text-slate-400 flex flex-col gap-1">
        <div className="flex items-center gap-1 text-slate-200">
          <HelpCircle className="w-3.5 h-3.5 text-slate-400" />
          <span>Digital Trust Verification — How was this decided?</span>
        </div>
        <p className="leading-relaxed">
          {textInfo.payoutDesc} Evidence Trail verified using 47 satellite images (Sentinel-1 SAR + Sentinel-2 NDVI).
        </p>
      </div>

    </div>
  );
}
