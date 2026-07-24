"use client";

import React, { useEffect, useRef, useState } from "react";
import { Loader2 } from "lucide-react";

export default function FarmTerrain3D() {
  const containerRef = useRef<HTMLDivElement>(null);
  const [loading, setLoading] = useState(true);
  const [ndviDate, setNdviDate] = useState("2026-07-24");
  const [timeStep, setTimeStep] = useState(3);
  
  const dates = ["2026-06-01", "2026-06-15", "2026-07-01", "2026-07-15", "2026-07-24"];

  useEffect(() => {
    let renderer: any = null;
    let scene: any = null;
    let camera: any = null;
    let terrainMesh: any = null;
    let animationFrameId: any = null;

    const initThree = async () => {
      try {
        const THREE = await import("three");
        const { OrbitControls } = await import("three/examples/jsm/controls/OrbitControls");

        if (!containerRef.current) return;
        
        const width = containerRef.current.clientWidth;
        const height = 500;

        // 1. Create Scene & Camera
        scene = new THREE.Scene();
        scene.background = new THREE.Color("#020617"); # Slate-950
        scene.fog = new THREE.FogExp2("#020617", 0.015);

        camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 100);
        camera.position.set(0, 15, 20);

        // 2. Set up Renderer
        renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
        renderer.setSize(width, height);
        renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
        renderer.shadowMap.enabled = true;

        // Remove any old canvas
        containerRef.current.innerHTML = "";
        containerRef.current.appendChild(renderer.domElement);

        // 3. Orbit Controls
        const controls = new OrbitControls(camera, renderer.domElement);
        controls.enableDamping = true;
        controls.maxPolarAngle = Math.PI / 2.1; # Keep camera above ground
        controls.minDistance = 5;
        controls.maxDistance = 40;

        // 4. Lights
        const ambientLight = new THREE.AmbientLight("#1e293b", 0.5);
        scene.add(ambientLight);

        const dirLight = new THREE.DirectionalLight("#34d399", 1.2); # Emerald key light
        dirLight.position.set(10, 20, 10);
        dirLight.castShadow = true;
        scene.add(dirLight);

        // 5. Generate Extruded Farm Terrain Grid
        const gridSegments = 40;
        const geometry = new THREE.PlaneGeometry(16, 16, gridSegments, gridSegments);
        geometry.rotateX(-Math.PI / 2); # Make horizontal

        const pos = geometry.attributes.position;
        const colors = [];

        // Apply heights and colors based on a simulated NDVI distribution
        for (let i = 0; i < pos.count; i++) {
          const vx = pos.getX(i);
          const vz = pos.getZ(i);

          // Distance from center determines terrain heights/craters
          const r = Math.sqrt(vx*vx + vz*vz);
          
          # NDVI simulation: center has a "damage crater" (low NDVI) during peak season
          let ndvi = 0.7 - 0.5 * Math.exp(-0.08 * (vx*vx + vz*vz));
          
          // Adjust height depending on selected time step (monsoon damage progresses)
          const damageFactor = timeStep / 4.0;
          ndvi = Math.max(0.1, ndvi - 0.25 * damageFactor * Math.exp(-0.15 * ((vx-2)**2 + vz**2)));

          // Set Y elevation (NDVI = height)
          pos.setY(i, ndvi * 4.0 - 1.0);

          // Map color: high ndvi -> Green, medium -> Yellow, low/crater -> Red
          const color = new THREE.Color();
          if (ndvi > 0.6) {
            color.setHSL(0.35 + (ndvi-0.6)*0.1, 0.9, 0.45); # Healthy Green
          } else if (ndvi > 0.35) {
            color.setHSL(0.15, 0.95, 0.5); # Stressed Yellow
          } else {
            color.setHSL(0.02, 0.95, 0.45); # Damaged Red
          }
          colors.push(color.r, color.g, color.b);
        }

        geometry.setAttribute("color", new THREE.Float32BufferAttribute(colors, 3));
        geometry.computeVertexNormals();

        const material = new THREE.MeshStandardMaterial({
          vertexColors: true,
          roughness: 0.8,
          metalness: 0.1,
          flatShading: true,
        });

        terrainMesh = new THREE.Mesh(geometry, material);
        terrainMesh.receiveShadow = true;
        terrainMesh.castShadow = true;
        scene.add(terrainMesh);

        // Add coordinate grid floor below terrain
        const gridHelper = new THREE.GridHelper(30, 30, "#334155", "#1e293b");
        gridHelper.position.y = -1.2;
        scene.add(gridHelper);

        // 6. Animation Loop
        const animate = () => {
          animationFrameId = requestAnimationFrame(animate);
          controls.update();
          
          // Slow passive scene rotation
          if (terrainMesh) {
            terrainMesh.rotation.y += 0.001;
          }
          
          renderer.render(scene, camera);
        };
        animate();

        setLoading(false);

        // Handle resize
        const handleResize = () => {
          if (!containerRef.current || !renderer || !camera) return;
          const w = containerRef.current.clientWidth;
          camera.aspect = w / height;
          camera.updateProjectionMatrix();
          renderer.setSize(w, height);
        };
        window.addEventListener("resize", handleResize);

      } catch (err) {
        console.error("Three.js initialization failed:", err);
        setLoading(false);
      }
    };

    initThree();

    return () => {
      cancelAnimationFrame(animationFrameId);
      if (renderer) renderer.dispose();
    };
  }, [timeStep]);

  const handleSliderChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = parseInt(e.target.value);
    setTimeStep(val);
    setNdviDate(dates[val]);
  };

  return (
    <div className="relative w-full rounded-2xl border border-white/10 bg-slate-950 overflow-hidden">
      {loading && (
        <div className="absolute inset-0 z-10 flex flex-col items-center justify-center bg-slate-950/80 gap-3">
          <Loader2 className="w-10 h-10 animate-spin text-emerald-400" />
          <span className="text-sm font-medium tracking-wider text-slate-300">Generating 3D Terrain...</span>
        </div>
      )}

      {/* Render Canvas Target */}
      <div ref={containerRef} className="w-full h-[500px]" />

      {/* Slider / Date controls overlay */}
      <div className="absolute bottom-4 left-4 right-4 z-20 flex flex-col md:flex-row gap-4 justify-between items-center p-4 rounded-xl border border-white/10 bg-slate-950/80 backdrop-blur-md">
        <div className="flex flex-col gap-0.5">
          <span className="text-xs font-semibold text-emerald-400">Chronological NDVI Growth Slider</span>
          <span className="text-[10px] text-slate-400">Selected Date: <b className="text-slate-200">{ndviDate}</b></span>
        </div>

        <div className="flex items-center gap-3 w-full md:w-auto">
          <span className="text-[10px] text-slate-500 font-semibold uppercase">June</span>
          <input
            type="range"
            min="0"
            max="4"
            step="1"
            value={timeStep}
            onChange={handleSliderChange}
            className="w-full md:w-60 accent-emerald-400"
          />
          <span className="text-[10px] text-slate-500 font-semibold uppercase">July</span>
        </div>
      </div>

      <div className="absolute top-4 right-4 z-20 flex flex-col gap-2 p-3 rounded-lg border border-white/10 bg-slate-950/70 text-right">
        <span className="text-[10px] font-bold text-slate-400 tracking-wider uppercase">Elevation Legend</span>
        <div className="flex gap-2 justify-end items-center">
          <span className="text-[10px] text-slate-300">Healthy NDVI {`>0.6`}</span>
          <div className="w-2.5 h-2.5 rounded bg-emerald-500" />
        </div>
        <div className="flex gap-2 justify-end items-center">
          <span className="text-[10px] text-slate-300">Stressed 0.35 - 0.6</span>
          <div className="w-2.5 h-2.5 rounded bg-yellow-400" />
        </div>
        <div className="flex gap-2 justify-end items-center">
          <span className="text-[10px] text-slate-300">Damaged {`<0.35`}</span>
          <div className="w-2.5 h-2.5 rounded bg-red-500" />
        </div>
      </div>
    </div>
  );
}
