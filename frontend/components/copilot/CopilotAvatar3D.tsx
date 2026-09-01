"use client";

import React, { useRef, useState, useMemo } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { OrbitControls, Html } from "@react-three/drei";
import * as THREE from "three";
import { Volume2, Play, Circle } from "lucide-react";

interface CopilotAvatar3DProps {
  adviceText?: string;
  activeTopic?: "irrigation" | "pest" | "fertilizer" | "weather" | "general";
  onSpeak?: () => void;
}

// Subcomponent: 3D Robot Farmer Avatar
function RobotFarmer({
  speaking,
  topic
}: {
  speaking: boolean;
  topic: string;
}) {
  const bodyRef = useRef<THREE.Group>(null);
  const headRef = useRef<THREE.Mesh>(null);
  const rightArmRef = useRef<THREE.Mesh>(null);

  useFrame(({ clock }) => {
    const elapsed = clock.getElapsedTime();

    // 1. Idle Bobbing
    if (bodyRef.current) {
      bodyRef.current.position.y = 0.5 + 0.15 * Math.sin(elapsed * 2.0);
      bodyRef.current.rotation.y = 0.05 * Math.sin(elapsed * 0.5);
    }

    // 2. Speaking head bob/mouth pulse
    if (headRef.current && speaking) {
      headRef.current.rotation.x = 0.08 * Math.sin(clock.getElapsedTime() * 10.0);
    } else if (headRef.current) {
      headRef.current.rotation.x = 0.02 * Math.sin(elapsed * 1.5);
    }

    // 3. Gesturing with arms based on topic
    if (rightArmRef.current) {
      if (topic === "irrigation") {
        // Pointing down gesture
        rightArmRef.current.rotation.x = -Math.PI / 3;
        rightArmRef.current.rotation.z = -Math.PI / 4;
      } else if (speaking) {
        // Wave hand gesture
        rightArmRef.current.rotation.z = -Math.PI / 3 + 0.2 * Math.sin(elapsed * 8.0);
      } else {
        // Relaxed position
        rightArmRef.current.rotation.z = -Math.PI / 8;
        rightArmRef.current.rotation.x = 0.0;
      }
    }
  });

  return (
    <group ref={bodyRef} position={[0, 0.5, 0]}>
      {/* Robot Torso */}
      <mesh position={[0, 0, 0]}>
        <cylinderGeometry args={[0.5, 0.6, 1.0, 16]} />
        <meshStandardMaterial color="#0284c7" metalness={0.8} roughness={0.2} />
      </mesh>

      {/* Robot Head */}
      <mesh ref={headRef} position={[0, 0.9, 0]}>
        <boxGeometry args={[0.7, 0.7, 0.7]} />
        <meshStandardMaterial color="#0369a1" metalness={0.9} roughness={0.1} />
      </mesh>
      
      {/* Eyes (glow screen) */}
      <mesh position={[0, 0.9, 0.36]}>
        <boxGeometry args={[0.4, 0.15, 0.05]} />
        <meshStandardMaterial color="#38bdf8" emissive="#38bdf8" emissiveIntensity={speaking ? 1.5 : 0.6} />
      </mesh>

      {/* Farmer Straw Hat (Topi) */}
      <group position={[0, 1.3, 0]}>
        {/* Hat Rim */}
        <mesh rotation={[Math.PI / 2, 0, 0]}>
          <cylinderGeometry args={[0.8, 0.8, 0.04, 32]} />
          <meshStandardMaterial color="#eab308" roughness={0.9} />
        </mesh>
        {/* Hat Cone */}
        <mesh position={[0, 0.2, 0]}>
          <coneGeometry args={[0.4, 0.4, 16]} />
          <meshStandardMaterial color="#ca8a04" roughness={0.9} />
        </mesh>
      </group>

      {/* Left Arm (Relaxed) */}
      <mesh position={[-0.7, 0.1, 0]} rotation={[0, 0, Math.PI / 8]}>
        <cylinderGeometry args={[0.08, 0.08, 0.7, 8]} />
        <meshStandardMaterial color="#0284c7" />
      </mesh>

      {/* Right Arm (Gesturing/Pointing) */}
      <mesh ref={rightArmRef} position={[0.7, 0.1, 0]} rotation={[0, 0, -Math.PI / 8]}>
        <cylinderGeometry args={[0.08, 0.08, 0.7, 8]} />
        <meshStandardMaterial color="#0284c7" />
      </mesh>

      {/* Floating Base energy glow */}
      <mesh position={[0, -0.6, 0]} rotation={[Math.PI / 2, 0, 0]}>
        <ringGeometry args={[0.1, 0.4, 16]} />
        <meshStandardMaterial color="#38bdf8" emissive="#38bdf8" emissiveIntensity={0.8} />
      </mesh>
    </group>
  );
}

export default function CopilotAvatar3D({ adviceText = "Namaste Ramesh ji! Heavy rainfall expected this Thursday. Please delay watering fields.", activeTopic = "irrigation", onSpeak }: CopilotAvatar3DProps) {
  const [speaking, setSpeaking] = useState(false);

  const topicIcon = useMemo(() => {
    if (activeTopic === "irrigation") return "💧";
    if (activeTopic === "pest") return "🐛";
    if (activeTopic === "fertilizer") return "🌾";
    if (activeTopic === "weather") return "⛈️";
    return "🤖";
  }, [activeTopic]);

  const handleSpeakText = () => {
    if (typeof window === "undefined" || !window.speechSynthesis) return;

    if (speaking) {
      window.speechSynthesis.cancel();
      setSpeaking(false);
      return;
    }

    setSpeaking(true);
    if (onSpeak) onSpeak();

    const utterance = new SpeechSynthesisUtterance(adviceText);
    // Auto-detect Hindi characters to set correct voice properties
    const hasHindi = /[\u0900-\u097F]/.test(adviceText);
    utterance.lang = hasHindi ? "hi-IN" : "en-US";
    utterance.rate = 0.85;

    utterance.onend = () => setSpeaking(false);
    utterance.onerror = () => setSpeaking(false);

    window.speechSynthesis.speak(utterance);
  };

  return (
    <div className="relative w-full rounded-2xl border border-white/10 bg-slate-950 overflow-hidden flex flex-col font-sans">
      
      {/* Speech bubble header */}
      <div className="p-4 border-b border-white/10 bg-slate-900/40 flex justify-between items-center z-10">
        <div className="flex gap-2 items-center">
          <span className="text-xl">{topicIcon}</span>
          <div>
            <h3 className="text-xs font-bold text-white tracking-wide uppercase">AI Agronomy Assistant</h3>
            <p className="text-[9px] text-slate-400">Interactive 3D Guidance</p>
          </div>
        </div>
        
        <button
          onClick={handleSpeakText}
          className={`flex gap-1.5 items-center py-1 px-2.5 rounded text-[9px] font-bold uppercase transition ${
            speaking ? "bg-emerald-500 text-black animate-pulse" : "bg-white/5 text-slate-300 hover:bg-white/10"
          }`}
        >
          <Volume2 className="w-3.5 h-3.5" />
          {speaking ? "Speaking" : "Listen"}
        </button>
      </div>

      {/* R3F Canvas */}
      <div className="relative w-full h-[280px] bg-slate-950">
        <Canvas camera={{ position: [0, 2, 5], fov: 40 }}>
          <ambientLight intensity={0.6} />
          <directionalLight position={[5, 8, 5]} intensity={1.5} />
          
          <RobotFarmer speaking={speaking} topic={activeTopic} />
          
          {/* Floating Speech Bubble inside 3D space */}
          <Html position={[0, 2.3, 0]} center>
            <div className="p-3 rounded-lg border border-white/15 bg-slate-900/95 backdrop-blur-md shadow-2xl w-48 text-center relative pointer-events-none">
              <span className="text-[10px] text-slate-200 leading-normal block">
                {adviceText}
              </span>
              {/* Pointer triangle */}
              <div className="absolute bottom-[-6px] left-1/2 -translate-x-1/2 w-0 h-0 border-l-[6px] border-l-transparent border-r-[6px] border-r-transparent border-t-[6px] border-t-slate-900" />
            </div>
          </Html>

          <gridHelper args={[8, 8, "#334155", "#1e293b"]} position={[0, -0.4, 0]} />
          <OrbitControls enableDamping maxPolarAngle={Math.PI / 2.1} minDistance={3} maxDistance={8} />
        </Canvas>
      </div>

    </div>
  );
}
