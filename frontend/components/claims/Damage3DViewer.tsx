"use client";

import React, { useEffect, useRef, useState } from "react";
import { Loader2 } from "lucide-react";

export default function Damage3DViewer() {
  const containerRef = useRef<HTMLDivElement>(null);
  const [loading, setLoading] = useState(true);
  const [isPostDamage, setIsPostDamage] = useState(true);
  const [activeFeature, setActiveFeature] = useState<string | null>(null);

  const features = [
    { name: "NDVI (Crop vigor)", weight: 0.42, color: "#10b981" },
    { name: "NDWI (Water indices)", weight: 0.28, color: "#06b6d4" },
    { name: "EVI (Canopy density)", weight: 0.18, color: "#3b82f6" },
    { name: "SAVI (Soil correction)", weight: 0.12, color: "#eab308" }
  ];

  useEffect(() => {
    let renderer: any = null;
    let scene: any = null;
    let camera: any = null;
    let terrainMesh: any = null;
    let featurePillars: any[] = [];
    let trafficLightMesh: any = null;
    let animationFrameId: any = null;

    const initThree = async () => {
      try {
        const THREE = await import("three");
        const { OrbitControls } = await import("three/examples/jsm/controls/OrbitControls");

        if (!containerRef.current) return;
        const width = containerRef.current.clientWidth;
        const height = 480;

        // 1. Create Scene & Fog
        scene = new THREE.Scene();
        scene.background = new THREE.Color("#020617");
        scene.fog = new THREE.FogExp2("#020617", 0.02);

        // 2. Set up Camera
        camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 100);
        camera.position.set(-8, 10, 16);

        // 3. Set up Renderer
        renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
        renderer.setSize(width, height);
        renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
        renderer.shadowMap.enabled = true;

        containerRef.current.innerHTML = "";
        containerRef.current.appendChild(renderer.domElement);

        const controls = new OrbitControls(camera, renderer.domElement);
        controls.enableDamping = true;
        controls.minDistance = 6;
        controls.maxDistance = 30;

        // 4. Lights
        const ambientLight = new THREE.AmbientLight("#475569", 0.6);
        scene.add(ambientLight);

        const keyLight = new THREE.DirectionalLight("#f59e0b", 1.0); // amber glow
        keyLight.position.set(-10, 15, 10);
        scene.add(keyLight);

        // 5. Create Morphing Terrain Plane (Healthy Green vs. Depressed Damaged Red)
        const gridSegments = 30;
        const geometry = new THREE.PlaneGeometry(10, 10, gridSegments, gridSegments);
        geometry.rotateX(-Math.PI / 2);

        const pos = geometry.attributes.position;
        const colors = [];

        // Apply heights and colors based on damage state
        for (let i = 0; i < pos.count; i++) {
          const vx = pos.getX(i);
          const vz = pos.getZ(i);
          const dist = Math.sqrt(vx*vx + vz*vz);
          
          let heightVal = 0.0;
          let color = new THREE.Color();
          
          if (!isPostDamage) {
            // Healthy Green State
            heightVal = Math.sin(vx * 0.5) * 0.4 + Math.cos(vz * 0.5) * 0.4;
            color.setHSL(0.35 + Math.random() * 0.05, 0.85, 0.4);
          } else {
            // Post-Damage Depressed Red State (center flooded/depressed crater)
            const depression = 1.2 * Math.exp(-0.15 * (vx*vx + vz*vz));
            heightVal = (Math.sin(vx * 0.5) * 0.4 + Math.cos(vz * 0.5) * 0.4) - depression;
            
            if (dist < 2.5) {
              color.setHSL(0.02, 0.9, 0.4); // Flooded/Damaged Red
            } else {
              color.setHSL(0.12, 0.8, 0.45); // Stressed Yellow/Brown
            }
          }
          
          pos.setY(i, heightVal);
          colors.push(color.r, color.g, color.b);
        }

        geometry.setAttribute("color", new THREE.Float32BufferAttribute(colors, 3));
        geometry.computeVertexNormals();

        const material = new THREE.MeshStandardMaterial({
          vertexColors: true,
          roughness: 0.8,
          flatShading: true,
        });

        terrainMesh = new THREE.Mesh(geometry, material);
        terrainMesh.position.set(-3.0, 0, 0); // Offset to the left
        scene.add(terrainMesh);

        // 6. Create XGBoost Radial 3D Bar Chart (Offset to the right)
        const centerPos = new THREE.Vector3(4.5, -0.5, 0);
        
        // Central prediction core
        const coreGeom = new THREE.SphereGeometry(0.5, 32, 32);
        const coreMat = new THREE.MeshStandardMaterial({
          color: isPostDamage ? "#ef4444" : "#10b981", // Red core if severe damage
          emissive: isPostDamage ? "#ef4444" : "#10b981",
          emissiveIntensity: 0.6,
        });
        const coreMesh = new THREE.Mesh(coreGeom, coreMat);
        coreMesh.position.copy(centerPos);
        scene.add(coreMesh);

        // Radial features pillars
        features.forEach((feat, idx) => {
          const angle = (idx / features.length) * Math.PI * 2;
          const radius = 2.5;
          const px = centerPos.x + Math.cos(angle) * radius;
          const pz = centerPos.z + Math.sin(angle) * radius;
          
          const pillarHeight = feat.weight * 4.0;
          const pGeom = new THREE.BoxGeometry(0.4, pillarHeight, 0.4);
          const pMat = new THREE.MeshStandardMaterial({
            color: feat.color,
            roughness: 0.3,
            metalness: 0.5,
          });
          const pillar = new THREE.Mesh(pGeom, pMat);
          pillar.position.set(px, centerPos.y + pillarHeight / 2, pz);
          pillar.userData = { feature: feat.name };
          scene.add(pillar);
          featurePillars.push(pillar);
        });

        // 7. Add Floating 3D Traffic Light (Center Top)
        const lightBoxGeom = new THREE.BoxGeometry(0.8, 2.2, 0.5);
        const lightBoxMat = new THREE.MeshStandardMaterial({ color: "#1e293b", roughness: 0.5 });
        const lightBox = new THREE.Mesh(lightBoxGeom, lightBoxMat);
        lightBox.position.set(0, 4.5, -4.0);
        scene.add(lightBox);

        // Active state traffic light sphere
        const activeColor = isPostDamage ? "#ef4444" : "#10b981";
        const lightS2Geom = new THREE.SphereGeometry(0.22, 16, 16);
        const lightS2Mat = new THREE.MeshStandardMaterial({
          color: activeColor,
          emissive: activeColor,
          emissiveIntensity: 1.0,
        });
        const lightS2 = new THREE.Mesh(lightS2Geom, lightS2Mat);
        lightS2.position.set(0, 4.5, -3.7);
        scene.add(lightS2);
        trafficLightMesh = lightS2;

        // 8. Animation loop
        const animate = () => {
          animationFrameId = requestAnimationFrame(animate);
          controls.update();
          
          // Animate core pulsing
          if (coreMesh) {
            const pulse = 1.0 + 0.1 * Math.sin(Date.now() * 0.005);
            coreMesh.scale.set(pulse, pulse, pulse);
          }
          
          // Animate traffic light pulse
          if (trafficLightMesh) {
            trafficLightMesh.material.emissiveIntensity = 0.8 + 0.4 * Math.sin(Date.now() * 0.008);
          }
          
          renderer.render(scene, camera);
        };
        animate();

        setLoading(false);

        // Raycasting to show feature names
        const raycaster = new THREE.Raycaster();
        const mouse = new THREE.Vector2();

        const handleMouseMove = (e: MouseEvent) => {
          if (!containerRef.current || !renderer || !camera) return;
          const rect = renderer.domElement.getBoundingClientRect();
          mouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
          mouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;

          raycaster.setFromCamera(mouse, camera);
          const intersects = raycaster.intersectObjects(featurePillars);

          if (intersects.length > 0) {
            const featureName = intersects[0].object.userData.feature;
            setActiveFeature(featureName);
          }
        };
        window.addEventListener("mousemove", handleMouseMove);

      } catch (err) {
        console.error("Three.js Damage Viewer error:", err);
        setLoading(false);
      }
    };

    initThree();

    return () => {
      cancelAnimationFrame(animationFrameId);
      if (renderer) renderer.dispose();
    };
  }, [isPostDamage]);

  return (
    <div className="relative w-full rounded-2xl border border-white/10 bg-slate-950 overflow-hidden">
      {loading && (
        <div className="absolute inset-0 z-10 flex flex-col items-center justify-center bg-slate-950/80 gap-3">
          <Loader2 className="w-10 h-10 animate-spin text-emerald-400" />
          <span className="text-sm font-medium tracking-wider text-slate-300">Initializing 3D Claims Assessment...</span>
        </div>
      )}

      {/* Target Canvas */}
      <div ref={containerRef} className="w-full h-[480px]" />

      {/* Left-side slider overlays */}
      <div className="absolute bottom-4 left-4 z-20 p-4 rounded-xl border border-white/10 bg-slate-950/80 backdrop-blur-md flex flex-col gap-2">
        <span className="text-xs font-semibold text-slate-300">3D Terrain Chronology</span>
        <div className="flex gap-2">
          <button
            onClick={() => setIsPostDamage(false)}
            className={`py-1 px-3 rounded text-[10px] font-bold uppercase tracking-wider transition-colors ${
              !isPostDamage ? "bg-emerald-500 text-slate-950" : "bg-white/5 text-slate-300 hover:bg-white/10"
            }`}
          >
            Pre-damage (Normal)
          </button>
          <button
            onClick={() => setIsPostDamage(true)}
            className={`py-1 px-3 rounded text-[10px] font-bold uppercase tracking-wider transition-colors ${
              isPostDamage ? "bg-red-500 text-slate-950" : "bg-white/5 text-slate-300 hover:bg-white/10"
            }`}
          >
            Post-damage (Flooded)
          </button>
        </div>
      </div>

      {/* Right-side model feature weights overlays */}
      <div className="absolute top-4 right-4 z-20 w-72 p-4 rounded-xl border border-white/10 bg-slate-950/80 backdrop-blur-md">
        <h4 className="text-[10px] font-bold text-slate-400 tracking-wider uppercase mb-2">XGBoost Feature Importance</h4>
        {activeFeature ? (
          <div className="flex flex-col gap-1">
            <span className="text-xs font-semibold text-emerald-400">{activeFeature}</span>
            <span className="text-[10px] text-slate-400">Hovering 3D Feature Bar</span>
          </div>
        ) : (
          <span className="text-xs text-slate-500 italic">Hover over radial 3D pillars to inspect weights...</span>
        )}
        
        <div className="mt-3 flex flex-col gap-2 border-t border-white/5 pt-3">
          {features.map((feat, idx) => (
            <div key={idx} className="flex justify-between items-center text-[10px]">
              <span className="text-slate-400">{feat.name}</span>
              <span className="font-bold text-slate-200">{Math.round(feat.weight * 100)}%</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
