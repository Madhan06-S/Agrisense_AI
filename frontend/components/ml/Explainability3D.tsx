"use client";

import React, { useState, useMemo, useRef, useEffect } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { OrbitControls, Html } from "@react-three/drei";
import * as THREE from "three";
import { Info, RotateCcw } from "lucide-react";

// List of 22 Early Fusion Feature names
const FEATURE_NAMES = [
    // Optical (10)
    "ndvi", "ndwi", "evi", "savi", "gndvi", "ndre", "msi", "ndbi", "nbr", "gci",
    // SAR (3)
    "vv", "vh", "sar_ratio",
    // Weather (5)
    "temp", "precip", "humidity", "wind_speed", "solar_rad",
    // Soil (4)
    "soil_moisture", "soil_ph", "soil_n", "soil_p"
];

interface Explainability3DProps {
  farmName?: string;
  shapData?: {
    base_value: number;
    prediction_value: number;
    shap_values: Record<string, number>;
  };
}

// Subcomponent: Central Prediction Orb
function PredictionOrb({
  probability,
  confidence,
  onHover
}: {
  probability: number;
  confidence: number;
  onHover: (info: any) => void;
}) {
  const meshRef = useRef<THREE.Mesh>(null);

  // Pulse speed depends on confidence
  useFrame(({ clock }) => {
    if (meshRef.current) {
      const elapsed = clock.getElapsedTime();
      const pulseSpeed = 1.0 + confidence * 4.0;
      const scale = 1.0 + 0.08 * Math.sin(elapsed * pulseSpeed);
      meshRef.current.scale.set(scale, scale, scale);
    }
  });

  // Color matches traffic light logic
  const color = useMemo(() => {
    if (probability < 0.15) return "#10b981"; // green
    if (probability < 0.70) return "#f59e0b"; // yellow
    return "#ef4444"; // red
  }, [probability]);

  return (
    <mesh
      ref={meshRef}
      position={[0, 1.5, 0]}
      onPointerMove={(e) => {
        e.stopPropagation();
        onHover({
          clientX: e.clientX,
          clientY: e.clientY,
          visible: true,
          type: "orb",
          prob: probability,
          conf: confidence
        });
      }}
      onPointerOut={() => onHover({ visible: false })}
    >
      <sphereGeometry args={[1.2, 32, 32]} />
      <meshStandardMaterial
        color={color}
        emissive={color}
        emissiveIntensity={0.6}
        roughness={0.1}
        metalness={0.9}
      />
    </mesh>
  );
}

// Subcomponent: 3D Feature Column (Forest tree)
function FeatureColumn({
  name,
  importance,
  impact, // positive = increases damage (red), negative = reduces (green)
  variance,
  position,
  onHover
}: {
  name: string;
  importance: number;
  impact: number;
  variance: number;
  position: [number, number, number];
  onHover: (info: any) => void;
}) {
  const height = Math.max(0.2, importance * 6.0);
  const radius = Math.max(0.12, variance * 0.4);
  const color = impact >= 0.0 ? "#f87171" : "#34d399"; // red increases damage risk, green reduces

  return (
    <group position={position}>
      {/* Column Cylinder */}
      <mesh
        position={[0, height / 2, 0]}
        onPointerMove={(e) => {
          e.stopPropagation();
          onHover({
            clientX: e.clientX,
            clientY: e.clientY,
            visible: true,
            type: "tree",
            name,
            impact,
            importance,
            variance
          });
        }}
        onPointerOut={() => onHover({ visible: false })}
      >
        <cylinderGeometry args={[radius, radius, height, 16]} />
        <meshStandardMaterial
          color={color}
          roughness={0.4}
          metalness={0.5}
        />
      </mesh>
    </group>
  );
}

// Subcomponent: SHAP Steps Waterfall in 3D
function WaterfallSteps({
  waterfallData
}: {
  waterfallData: Array<{ feature: string; shap_value: number; step_from: number; step_to: number }>;
}) {
  // Renders a floating steps pathway in 3D: each step goes up/down depending on SHAP contribution
  return (
    <group position={[-5, 0, -5]}>
      {/* Starting Platform: Base expected value */}
      <mesh position={[0, 0.1, 0]}>
        <boxGeometry args={[1.8, 0.2, 1.8]} />
        <meshStandardMaterial color="#475569" roughness={0.8} />
      </mesh>
      <Html position={[0, 0.4, 0]} center>
        <div className="px-1.5 py-0.5 rounded bg-slate-900/90 text-[8px] text-slate-400 font-bold uppercase pointer-events-none whitespace-nowrap">
          Base Val
        </div>
      </Html>

      {/* Renders floating steps */}
      {waterfallData.map((step, idx) => {
        // Only show top 5 contributors to avoid cluttering the 3D path
        if (idx > 4) return null;
        
        const stepX = (idx + 1) * 2.0;
        const stepY = step.step_to * 4.0; // scale height
        const color = step.shap_value >= 0.0 ? "#ef4444" : "#10b981"; // red pushes up damage, green lowers
        
        return (
          <group key={`step-${idx}`}>
            {/* Step platform */}
            <mesh position={[stepX, stepY, 0]}>
              <boxGeometry args={[1.5, 0.15, 1.5]} />
              <meshStandardMaterial color={color} roughness={0.6} />
            </mesh>
            {/* Connection beam */}
            <mesh position={[stepX - 1.0, (step.step_from + step.step_to) * 2.0, 0]} rotation={[0, 0, Math.atan2(step.step_to - step.step_from, 2.0)]}>
              <cylinderGeometry args={[0.04, 0.04, 2.2, 8]} />
              <meshStandardMaterial color="#334155" />
            </mesh>
            <Html position={[stepX, stepY + 0.3, 0]} center>
              <div className="px-1.5 py-0.5 rounded bg-slate-900/95 border border-white/10 text-[7px] text-slate-300 font-medium pointer-events-none whitespace-nowrap">
                {step.feature}: {step.shap_value >= 0 ? "+" : ""}{step.shap_value.toFixed(2)}
              </div>
            </Html>
          </group>
        );
      })}
    </group>
  );
}

export default function Explainability3D({ farmName = "Basdhara Paddy Fields", shapData }: Explainability3DProps) {
  // Default values
  const baseVal = shapData?.base_value ?? 0.15;
  const initialPrediction = shapData?.prediction_value ?? 0.42;
  const initialShapValues = useMemo(() => {
    if (shapData?.shap_values) return shapData.shap_values;
    // mock values if empty
    const mocks: Record<string, number> = {};
    FEATURE_NAMES.forEach((name) => {
      if (name === "ndvi") mocks[name] = -0.28; // reduced damage
      else if (name === "precip") mocks[name] = 0.15; // increased
      else if (name === "soil_moisture") mocks[name] = 0.12;
      else mocks[name] = (Math.random() - 0.5) * 0.04;
    });
    return mocks;
  }, [shapData]);

  // Adjust values state (What-if sliders)
  const [adjustedValues, setAdjustedValues] = useState<Record<string, number>>({});
  const [compareMode, setCompareMode] = useState(false);
  const [hoverInfo, setHoverInfo] = useState<any>({ visible: false });

  // Reset values
  const handleReset = () => {
    setAdjustedValues({});
  };

  // Compute live prediction probability based on adjusted values
  // NDVI (idx 0): lower value increases damage, higher reduces
  // Precip (idx 14): higher value increases damage, lower reduces
  // Soil moisture (idx 18): higher value increases damage
  const liveProbability = useMemo(() => {
    let prob = initialPrediction;
    
    // adjust NDVI contribution
    if ("ndvi" in adjustedValues) {
      const diff = adjustedValues["ndvi"] - 0.5; // default is 0.5
      prob += diff * -0.6; // negative slope
    }
    if ("precip" in adjustedValues) {
      const diff = adjustedValues["precip"] - 1.0;
      prob += diff * 0.4;
    }
    if ("soil_moisture" in adjustedValues) {
      const diff = adjustedValues["soil_moisture"] - 0.3;
      prob += diff * 0.3;
    }
    
    return Math.max(0.01, Math.min(0.99, prob));
  }, [adjustedValues, initialPrediction]);

  // Semi-circle position calculator for columns
  const columnPositions = useMemo(() => {
    const positions: Array<[number, number, number]> = [];
    const count = 22;
    const radius = 6.5;
    for (let i = 0; i < count; i++) {
      // Semi-circle angle (from -PI/2 to PI/2)
      const angle = -Math.PI / 1.8 + (i / (count - 1)) * (Math.PI * 1.11);
      const x = Math.sin(angle) * radius;
      const z = Math.cos(angle) * radius;
      positions.push([x, -0.5, z]);
    }
    return positions;
  }, []);

  // Compute live waterfall steps data for top 5 features
  const waterfallData = useMemo(() => {
    const list = [
      { feature: "ndvi", shap_value: initialShapValues["ndvi"] ?? -0.28 },
      { feature: "precip", shap_value: initialShapValues["precip"] ?? 0.15 },
      { feature: "soil_moisture", shap_value: initialShapValues["soil_moisture"] ?? 0.12 },
      { feature: "sar_ratio", shap_value: initialShapValues["sar_ratio"] ?? 0.05 },
      { feature: "temp", shap_value: initialShapValues["temp"] ?? -0.04 }
    ];
    
    let current = baseVal;
    return list.map((item) => {
      const from = current;
      current += item.shap_value;
      return {
        ...item,
        step_from: from,
        step_to: current
      };
    });
  }, [baseVal, initialShapValues]);

  return (
    <div className="relative w-full rounded-2xl border border-white/10 bg-slate-950 overflow-hidden flex flex-col md:flex-row font-sans">
      
      {/* 3D Canvas View (Left) */}
      <div className="relative flex-grow h-[450px] bg-slate-950">
        <Canvas camera={{ position: [0, 8, 14], fov: 45 }}>
          <ambientLight intensity={0.6} />
          <directionalLight position={[10, 15, 10]} intensity={1.5} />

          {/* Central Orb */}
          {!compareMode ? (
            <PredictionOrb
              probability={liveProbability}
              confidence={0.92}
              onHover={setHoverInfo}
            />
          ) : (
            <>
              {/* Compare: Left Orb (Healthy baseline) */}
              <group position={[-3.5, 0, 0]}>
                <PredictionOrb
                  probability={0.08}
                  confidence={0.96}
                  onHover={(info) => {
                    if (info.visible) info.type = "orb_healthy";
                    setHoverInfo(info);
                  }}
                />
                <Html position={[0, -0.8, 0]} center>
                  <div className="px-2 py-0.5 rounded bg-emerald-500 text-black text-[8px] font-bold uppercase tracking-wider whitespace-nowrap">
                    Healthy baseline
                  </div>
                </Html>
              </group>

              {/* Compare: Right Orb (Actual/Adjusted) */}
              <group position={[3.5, 0, 0]}>
                <PredictionOrb
                  probability={liveProbability}
                  confidence={0.88}
                  onHover={(info) => {
                    if (info.visible) info.type = "orb_actual";
                    setHoverInfo(info);
                  }}
                />
                <Html position={[0, -0.8, 0]} center>
                  <div className="px-2 py-0.5 rounded bg-red-500 text-white text-[8px] font-bold uppercase tracking-wider whitespace-nowrap">
                    Current Farm (Adjusted)
                  </div>
                </Html>
              </group>
            </>
          )}

          {/* Feature columns forest */}
          {!compareMode &&
            FEATURE_NAMES.map((name, idx) => {
              // Extract values
              const imp = Math.abs(initialShapValues[name] ?? 0.02);
              const val = adjustedValues[name] ?? (name === "ndvi" ? 0.5 : name === "precip" ? 1.0 : name === "soil_moisture" ? 0.3 : 0.5);
              const impact = initialShapValues[name] ?? 0.0;
              const pos = columnPositions[idx];
              
              return (
                <FeatureColumn
                  key={`forest-${name}`}
                  name={name}
                  importance={imp}
                  impact={impact}
                  variance={0.4}
                  position={pos}
                  onHover={setHoverInfo}
                />
              );
            })}

          {/* Render 3D SHAP Waterfall Steps */}
          {!compareMode && <WaterfallSteps waterfallData={waterfallData} />}

          {/* Grid helper floor */}
          <gridHelper args={[20, 20, "#334155", "#1e293b"]} position={[0, -0.6, 0]} />
          <OrbitControls enableDamping maxPolarAngle={Math.PI / 2.1} minDistance={6} maxDistance={25} />
        </Canvas>

        {/* Dynamic Tooltip Overlay */}
        {hoverInfo.visible && (
          <div
            className="absolute pointer-events-none z-30 p-3 rounded-lg border border-white/15 bg-slate-900/95 backdrop-blur-md shadow-2xl flex flex-col gap-1 w-44"
            style={{
              left: `${hoverInfo.clientX - 100}px`,
              top: `${hoverInfo.clientY - 380}px`
            }}
          >
            {hoverInfo.type === "orb" && (
              <>
                <span className="text-[10px] font-bold text-emerald-400 tracking-wider uppercase">AI Prediction Orb</span>
                <div className="flex justify-between items-center text-[10px] text-white">
                  <span>Damage Prob:</span>
                  <span className={`font-bold ${hoverInfo.prob >= 0.7 ? "text-red-400" : hoverInfo.prob >= 0.15 ? "text-yellow-400" : "text-emerald-400"}`}>
                    {Math.round(hoverInfo.prob * 100)}%
                  </span>
                </div>
                <div className="flex justify-between items-center text-[10px] text-white">
                  <span>Confidence:</span>
                  <span className="font-bold text-slate-300">{Math.round(hoverInfo.conf * 100)}%</span>
                </div>
              </>
            )}
            {hoverInfo.type === "tree" && (
              <>
                <span className="text-[10px] font-bold text-slate-300 tracking-wider uppercase">{hoverInfo.name}</span>
                <div className="flex justify-between items-center text-[10px] text-white mt-1">
                  <span>SHAP Impact:</span>
                  <span className={`font-bold ${hoverInfo.impact >= 0 ? "text-red-400" : "text-emerald-400"}`}>
                    {hoverInfo.impact >= 0 ? "+" : ""}{hoverInfo.impact.toFixed(3)}
                  </span>
                </div>
                <div className="flex justify-between items-center text-[8px] text-slate-400">
                  <span>Importance:</span>
                  <span className="font-bold text-slate-200">{hoverInfo.importance.toFixed(3)}</span>
                </div>
                <div className="flex justify-between items-center text-[8px] text-slate-400">
                  <span>Variance:</span>
                  <span className="font-bold text-slate-200">{hoverInfo.variance.toFixed(2)}</span>
                </div>
              </>
            )}
          </div>
        )}
      </div>

      {/* What-If Sliders Panel (Right sidebar) */}
      <div className="w-full md:w-80 bg-slate-900/40 p-4 border-t md:border-t-0 md:border-l border-white/10 flex flex-col gap-4">
        <div>
          <h4 className="text-xs font-bold text-white tracking-wide uppercase">XGBoost What-If Simulator</h4>
          <p className="text-[10px] text-slate-400 mt-1 leading-relaxed">
            Drag sliders to simulate ground changes and observe predictions update in real-time.
          </p>
        </div>

        {/* Simulators */}
        <div className="flex flex-col gap-4 flex-grow">
          {/* NDVI Slider */}
          <div className="flex flex-col gap-1">
            <div className="flex justify-between text-[10px]">
              <span className="text-slate-300 font-semibold uppercase">NDVI (Crop Health)</span>
              <span className="text-emerald-400 font-bold">
                {(adjustedValues["ndvi"] ?? 0.5).toFixed(2)}
              </span>
            </div>
            <input
              type="range"
              min="0.1"
              max="0.9"
              step="0.01"
              value={adjustedValues["ndvi"] ?? 0.5}
              onChange={(e) => setAdjustedValues({ ...adjustedValues, ndvi: parseFloat(e.target.value) })}
              className="w-full accent-emerald-400"
            />
            <span className="text-[8px] text-slate-500 italic">Increases damage probability if below 0.4.</span>
          </div>

          {/* Rainfall / Precip Slider */}
          <div className="flex flex-col gap-1">
            <div className="flex justify-between text-[10px]">
              <span className="text-slate-300 font-semibold uppercase">Rainfall Anomaly</span>
              <span className="text-blue-400 font-bold">
                {(adjustedValues["precip"] ?? 1.0).toFixed(1)}x
              </span>
            </div>
            <input
              type="range"
              min="0.2"
              max="2.5"
              step="0.05"
              value={adjustedValues["precip"] ?? 1.0}
              onChange={(e) => setAdjustedValues({ ...adjustedValues, precip: parseFloat(e.target.value) })}
              className="w-full accent-blue-400"
            />
            <span className="text-[8px] text-slate-500 italic">Simulates heavy rainfall (flooding risk).</span>
          </div>

          {/* Soil Moisture Slider */}
          <div className="flex flex-col gap-1">
            <div className="flex justify-between text-[10px]">
              <span className="text-slate-300 font-semibold uppercase">Soil Moisture</span>
              <span className="text-yellow-500 font-bold">
                {Math.round((adjustedValues["soil_moisture"] ?? 0.3) * 100)}%
              </span>
            </div>
            <input
              type="range"
              min="0.05"
              max="0.8"
              step="0.01"
              value={adjustedValues["soil_moisture"] ?? 0.3}
              onChange={(e) => setAdjustedValues({ ...adjustedValues, soil_moisture: parseFloat(e.target.value) })}
              className="w-full accent-yellow-400"
            />
            <span className="text-[8px] text-slate-500 italic">High saturation simulates waterlogging.</span>
          </div>
        </div>

        {/* Global actions */}
        <div className="flex flex-col gap-2 pt-4 border-t border-white/5">
          <div className="flex gap-2">
            <button
              onClick={() => setCompareMode(!compareMode)}
              className={`flex-grow py-1.5 px-3 rounded text-[10px] font-bold uppercase tracking-wider transition-colors ${
                compareMode ? "bg-emerald-500 text-black" : "bg-white/5 text-slate-300 hover:bg-white/10"
              }`}
            >
              {compareMode ? "Single View" : "Compare Forest"}
            </button>
            
            <button
              onClick={handleReset}
              className="p-1.5 rounded bg-white/5 text-slate-400 hover:text-white transition"
              title="Reset sliders"
            >
              <RotateCcw className="w-3.5 h-3.5" />
            </button>
          </div>
          
          <div className="p-2.5 rounded-lg border border-[#eab308]/20 bg-[#eab308]/5 text-[9px] text-[#eab308] leading-relaxed flex gap-1.5 items-start">
            <Info className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
            <p>
              Adjusting sliders computes predictions locally based on linear SHAP weight margins.
            </p>
          </div>
        </div>

      </div>

    </div>
  );
}
