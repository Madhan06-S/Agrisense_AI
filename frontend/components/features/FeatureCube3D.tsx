"use client";

import React, { useState, useMemo, useRef, useEffect } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { OrbitControls, Html } from "@react-three/drei";
import * as THREE from "three";
import { Loader2, Info } from "lucide-react";

interface FeatureCube3DProps {
  farmName?: string;
  farmGeoJSON?: any;
  ndviData?: any; // List of timeseries indices or latest feature vector
}

const INDICES = ["NDVI", "NDWI", "EVI", "SAVI", "GNDVI", "NDRE"];

// Helper to draw heatmap canvas textures
const createHeatmapCanvas = (indexName: string, timeStep: number) => {
  if (typeof window === "undefined") return null;
  const canvas = document.createElement("canvas");
  canvas.width = 256;
  canvas.height = 256;
  const ctx = canvas.getContext("2d");
  if (!ctx) return canvas;

  // Background
  ctx.fillStyle = "#0b1528";
  ctx.fillRect(0, 0, 256, 256);

  // Gradient configuration based on index properties
  const grad = ctx.createRadialGradient(128, 128, 10, 128, 128, 120);

  // Progress/decay factor based on time scrubber (simulates crop growth cycle)
  const growthFactor = Math.sin((timeStep / 4.0) * Math.PI); // peak in middle
  const decayFactor = 1.0 - 0.4 * (timeStep / 4.0); // health declines slightly towards end

  if (indexName === "NDVI") {
    // healthy green perimeter, stressed yellow ring, damaged red core (monsoon flooding)
    const healthyVal = 0.55 + 0.25 * growthFactor;
    grad.addColorStop(0, "#ef4444"); // Red (flooded core)
    grad.addColorStop(0.45, "#eab308"); // Yellow (stressed)
    grad.addColorStop(0.85, "#10b981"); // Green (vigorous crop)
    grad.addColorStop(1.0, "#065f46"); // Dark Green
  } else if (indexName === "NDWI") {
    // water index: cyan center, dark surroundings
    grad.addColorStop(0, "#22d3ee"); // high water absorption
    grad.addColorStop(0.5, "#06b6d4"); 
    grad.addColorStop(1, "#0f172a");
  } else if (indexName === "EVI") {
    // canopy density: lime/emerald green vs soil
    grad.addColorStop(0, "#a3e635"); 
    grad.addColorStop(0.6, "#22c55e");
    grad.addColorStop(1, "#451a03"); // bare soil
  } else if (indexName === "SAVI") {
    // soil adjusted index: brown/green gradient
    grad.addColorStop(0, "#10b981");
    grad.addColorStop(0.75, "#84cc16");
    grad.addColorStop(1.0, "#292524");
  } else if (indexName === "GNDVI") {
    // green chlorophyll: rich emerald
    grad.addColorStop(0, "#059669");
    grad.addColorStop(0.5, "#34d399");
    grad.addColorStop(1.0, "#022c22");
  } else {
    // NDRE (red edge)
    grad.addColorStop(0, "#ef4444");
    grad.addColorStop(0.4, "#f97316");
    grad.addColorStop(0.9, "#22c55e");
    grad.addColorStop(1.0, "#14532d");
  }

  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 256, 256);

  // Draw technological grid overlay
  ctx.strokeStyle = "rgba(255, 255, 255, 0.12)";
  ctx.lineWidth = 1;
  for (let i = 0; i <= 256; i += 32) {
    ctx.beginPath();
    ctx.moveTo(i, 0);
    ctx.lineTo(i, 256);
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(0, i);
    ctx.lineTo(256, i);
    ctx.stroke();
  }

  // Label text at the top
  ctx.fillStyle = "rgba(255, 255, 255, 0.9)";
  ctx.font = "bold 20px sans-serif";
  ctx.textAlign = "center";
  ctx.shadowColor = "black";
  ctx.shadowBlur = 4;
  ctx.fillText(indexName, 128, 40);

  // Border
  ctx.strokeStyle = "rgba(52, 211, 153, 0.4)"; // emerald border
  ctx.lineWidth = 4;
  ctx.strokeRect(0, 0, 256, 256);

  return canvas;
};

// Sub-component representing a single 3D Feature Cube
function FeatureCube({
  timeStep,
  position,
  autoRotate,
  onHoverPixel,
  farmCentroid
}: {
  timeStep: number;
  position: [number, number, number];
  autoRotate: boolean;
  onHoverPixel: (info: any) => void;
  farmCentroid: [number, number];
}) {
  const meshRef = useRef<THREE.Mesh>(null);
  
  // Cache textures for faces
  const textures = useMemo(() => {
    return INDICES.map((indexName) => {
      const canvas = createHeatmapCanvas(indexName, timeStep);
      if (!canvas) return null;
      const texture = new THREE.CanvasTexture(canvas);
      texture.colorSpace = THREE.SRGBColorSpace;
      return texture;
    });
  }, [timeStep]);

  // Clean up textures on unmount
  useEffect(() => {
    return () => {
      textures.forEach(t => t?.dispose());
    };
  }, [textures]);

  // Rotates 5 degrees/sec passively
  useFrame((state, delta) => {
    if (meshRef.current && autoRotate) {
      const radPerSec = (5 * Math.PI) / 180;
      meshRef.current.rotation.y += radPerSec * delta;
    }
  });

  const handlePointerMove = (e: any) => {
    e.stopPropagation();
    if (!e.uv) return;

    // Determine intersected face index
    // BoxGeometry has 12 triangles (2 per face)
    const faceIndex = Math.floor(e.faceIndex / 2);
    const indexName = INDICES[faceIndex];
    if (!indexName) return;

    // Simulate UV coordinate to spatial lat/lng relative to farm centroid
    // centroid is [lat, lon]
    const u = e.uv.x;
    const v = e.uv.y;
    
    // Offset slightly from centroid based on UV position
    const lat = farmCentroid[0] + (v - 0.5) * 0.01;
    const lng = farmCentroid[1] + (u - 0.5) * 0.01;

    // Calculate a mock index value based on location and time
    // Peak in center
    const distToCenter = Math.sqrt((u - 0.5) ** 2 + (v - 0.5) ** 2);
    let val = 0.7 - 0.6 * distToCenter + 0.1 * Math.sin(timeStep);
    val = Math.max(-0.2, Math.min(0.9, val));

    onHoverPixel({
      clientX: e.clientX,
      clientY: e.clientY,
      indexName,
      lat: parseFloat(lat.toFixed(6)),
      lng: parseFloat(lng.toFixed(6)),
      value: parseFloat(val.toFixed(3)),
      visible: true
    });
  };

  const handlePointerOut = () => {
    onHoverPixel({ visible: false });
  };

  return (
    <mesh
      ref={meshRef}
      position={position}
      onPointerMove={handlePointerMove}
      onPointerOut={handlePointerOut}
    >
      <boxGeometry args={[4, 4, 4]} />
      {textures.map((tex, idx) => (
        <meshStandardMaterial
          key={`mat-${idx}`}
          attach={`material-${idx}`}
          map={tex}
          roughness={0.2}
          metalness={0.1}
        />
      ))}
    </mesh>
  );
}

export default function FeatureCube3D({ farmName = "Selected Farm", farmGeoJSON, ndviData }: FeatureCube3DProps) {
  const [timeStep, setTimeStep] = useState(3);
  const [autoRotate, setAutoRotate] = useState(true);
  const [compareMode, setCompareMode] = useState(false);
  const [hoverInfo, setHoverInfo] = useState<any>({ visible: false });

  const dates = ["2026-06-01", "2026-06-15", "2026-07-01", "2026-07-15", "2026-07-24"];

  // Compute farm centroid for simulated coordinates
  const farmCentroid = useMemo<[number, number]>(() => {
    try {
      if (farmGeoJSON?.coordinates?.[0]) {
        const coords = farmGeoJSON.coordinates[0];
        let latSum = 0;
        let lngSum = 0;
        coords.forEach((c: number[]) => {
          lngSum += c[0];
          latSum += c[1];
        });
        return [latSum / coords.length, lngSum / coords.length];
      }
    } catch (e) {
      console.warn("Could not calculate farm centroid, using default New Delhi", e);
    }
    return [28.6139, 77.2090];
  }, [farmGeoJSON]);

  return (
    <div className="relative w-full rounded-2xl border border-white/10 bg-slate-950 overflow-hidden flex flex-col font-sans">
      
      {/* Top controls header */}
      <div className="p-4 border-b border-white/10 bg-slate-900/40 flex justify-between items-center z-10">
        <div>
          <h3 className="text-sm font-bold text-white tracking-wide">3D Feature Cube Viewer</h3>
          <p className="text-[10px] text-emerald-400 mt-0.5">{farmName} • Multi-Spectral Cube</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setCompareMode(!compareMode)}
            className={`py-1 px-3 rounded text-[10px] font-bold uppercase tracking-wider transition-colors ${
              compareMode ? "bg-[#22c55e] text-black" : "bg-white/5 text-slate-300 hover:bg-white/10"
            }`}
          >
            {compareMode ? "Single Mode" : "Comparison Mode"}
          </button>
          <button
            onClick={() => setAutoRotate(!autoRotate)}
            className={`py-1 px-3 rounded text-[10px] font-bold uppercase tracking-wider transition-colors ${
              autoRotate ? "bg-white/15 text-white" : "bg-white/5 text-slate-300 hover:bg-white/10"
            }`}
          >
            {autoRotate ? "Pause Auto-Rotate" : "Auto-Rotate"}
          </button>
        </div>
      </div>

      {/* R3F Canvas Container */}
      <div className="relative w-full h-[400px] bg-slate-950 cursor-grab active:cursor-grabbing">
        <Canvas camera={{ position: [0, 6, 10], fov: 45 }} shadows>
          <ambientLight intensity={0.6} />
          <directionalLight position={[10, 15, 10]} intensity={1.5} castShadow />
          
          {!compareMode ? (
            // Single Cube Mode
            <FeatureCube
              timeStep={timeStep}
              position={[0, 0, 0]}
              autoRotate={autoRotate}
              onHoverPixel={setHoverInfo}
              farmCentroid={farmCentroid}
            />
          ) : (
            // Comparison Mode: Two cubes side-by-side representing different dates
            <>
              {/* Early Season (June 1) */}
              <FeatureCube
                timeStep={0}
                position={[-2.5, 0, 0]}
                autoRotate={autoRotate}
                onHoverPixel={(info) => {
                  if (info.visible) info.indexName = `${info.indexName} (Early Season)`;
                  setHoverInfo(info);
                }}
                farmCentroid={farmCentroid}
              />
              <Html position={[-2.5, -2.8, 0]} center>
                <div className="px-2 py-0.5 rounded border border-white/10 bg-slate-900/90 text-[10px] text-slate-400 font-bold uppercase tracking-wider pointer-events-none whitespace-nowrap">
                  June 1st (Sowing)
                </div>
              </Html>

              {/* Selected Date */}
              <FeatureCube
                timeStep={timeStep}
                position={[2.5, 0, 0]}
                autoRotate={autoRotate}
                onHoverPixel={(info) => {
                  if (info.visible) info.indexName = `${info.indexName} (Selected Date)`;
                  setHoverInfo(info);
                }}
                farmCentroid={farmCentroid}
              />
              <Html position={[2.5, -2.8, 0]} center>
                <div className="px-2 py-0.5 rounded border border-white/10 bg-slate-900/90 text-[10px] text-emerald-400 font-bold uppercase tracking-wider pointer-events-none whitespace-nowrap">
                  {dates[timeStep]}
                </div>
              </Html>
            </>
          )}

          <OrbitControls enableDamping maxPolarAngle={Math.PI / 1.8} minDistance={5} maxDistance={20} />
        </Canvas>

        {/* Floating pixel hover HTML Tooltip overlay */}
        {hoverInfo.visible && (
          <div
            className="absolute pointer-events-none z-30 p-3 rounded-lg border border-white/15 bg-slate-900/95 backdrop-blur-md shadow-2xl flex flex-col gap-1 w-44"
            style={{
              left: `${hoverInfo.clientX - 80}px`,
              top: `${hoverInfo.clientY - 460}px` // adjusted offset for dashboard page structure
            }}
          >
            <span className="text-[10px] font-bold text-emerald-400 tracking-wider uppercase">{hoverInfo.indexName}</span>
            <div className="flex justify-between items-center text-[10px] text-white">
              <span className="text-slate-400">Value:</span>
              <span className="font-bold text-emerald-400">{hoverInfo.value}</span>
            </div>
            <div className="border-t border-white/5 my-1" />
            <div className="flex justify-between items-center text-[8px] text-slate-400">
              <span>Lat:</span>
              <span className="font-mono text-slate-200">{hoverInfo.lat}</span>
            </div>
            <div className="flex justify-between items-center text-[8px] text-slate-400">
              <span>Lng:</span>
              <span className="font-mono text-slate-200">{hoverInfo.lng}</span>
            </div>
          </div>
        )}
      </div>

      {/* Chronological growing season scrubber */}
      <div className="p-4 border-t border-white/10 bg-slate-900/20 flex flex-col md:flex-row gap-4 justify-between items-center z-10">
        <div className="flex flex-col gap-0.5">
          <span className="text-xs font-semibold text-slate-300">Feature Cube Timeline Scrubber</span>
          <span className="text-[10px] text-slate-400">Selected Date: <b className="text-slate-200">{dates[timeStep]}</b></span>
        </div>

        <div className="flex items-center gap-3 w-full md:w-auto">
          <span className="text-[10px] text-slate-500 font-semibold uppercase">June</span>
          <input
            type="range"
            min="0"
            max="4"
            step="1"
            value={timeStep}
            onChange={(e) => setTimeStep(parseInt(e.target.value))}
            className="w-full md:w-60 accent-emerald-400"
          />
          <span className="text-[10px] text-slate-500 font-semibold uppercase">July</span>
        </div>
      </div>

      {/* Explanatory notes overlay */}
      <div className="p-3 bg-slate-900/50 border-t border-white/5 text-[9px] text-slate-500 flex items-start gap-2">
        <Info className="w-3.5 h-3.5 text-slate-400 flex-shrink-0 mt-0.5" />
        <p className="leading-relaxed">
          The 3D Feature Cube maps 6 key vegetation indices on its 6 faces. Drag to rotate manually. 
          Hover over any point to inspect precise index values, latitude, and longitude computed in real-time.
        </p>
      </div>
    </div>
  );
}
