"use client";

import React, { useEffect, useRef, useState } from "react";
import { Loader2 } from "lucide-react";

interface Stage {
  id: number;
  name: string;
  description: string;
  status: "idle" | "running" | "completed" | "failed";
  duration: string;
}

export default function Pipeline3D() {
  const containerRef = useRef<HTMLDivElement>(null);
  const [loading, setLoading] = useState(true);
  const [activeStage, setActiveStage] = useState<Stage | null>(null);

  const stages: Stage[] = [
    { id: 1, name: "RAW ACQUISITION", description: "Fetch satellite imagery from GEE/MinIO", status: "completed", duration: "1.2s" },
    { id: 2, name: "RADIOMETRIC CORRECTION", description: "Convert DN values to TOA reflectance", status: "completed", duration: "0.8s" },
    { id: 3, name: "ATMOSPHERIC CORRECTION", description: "Apply DOS path scattering haze reduction", status: "completed", duration: "1.5s" },
    { id: 4, name: "TOPOGRAPHIC CORRECTION", description: "Apply terrain C-correction using DEM", status: "running", duration: "2.1s" },
    { id: 5, name: "CLOUD MASKING", description: "Build SCL binary clouds and shadow masks", status: "idle", duration: "--" },
    { id: 6, name: "DIFFUSION RECONSTRUCTION", description: "Reconstruct cloud-blocked pixels via U-Net", status: "idle", duration: "--" },
    { id: 7, name: "FEATURE ENGINEERING", description: "Calculate 10 vegetation indices timeseries", status: "idle", duration: "--" }
  ];

  useEffect(() => {
    let renderer: any = null;
    let scene: any = null;
    let camera: any = null;
    let animationFrameId: any = null;
    const stageMeshes: any[] = [];
    const connectionLines: any[] = [];
    const particles: any[] = [];

    const initThree = async () => {
      try {
        const THREE = await import("three");
        const { OrbitControls } = await import("three/examples/jsm/controls/OrbitControls");

        if (!containerRef.current) return;
        const width = containerRef.current.clientWidth;
        const height = 450;

        // 1. Create Scene & Fog
        scene = new THREE.Scene();
        scene.background = new THREE.Color("#020617");
        scene.fog = new THREE.FogExp2("#020617", 0.02);

        // 2. Set up Camera
        camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 100);
        camera.position.set(0, 8, 14);

        // 3. Set up Renderer
        renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
        renderer.setSize(width, height);
        renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

        containerRef.current.innerHTML = "";
        containerRef.current.appendChild(renderer.domElement);

        const controls = new OrbitControls(camera, renderer.domElement);
        controls.enableDamping = true;
        controls.minDistance = 6;
        controls.maxDistance = 25;

        // 4. Lights
        const ambientLight = new THREE.AmbientLight("#475569", 0.6);
        scene.add(ambientLight);

        const pointLight = new THREE.PointLight("#10b981", 2, 50);
        pointLight.position.set(0, 5, 0);
        scene.add(pointLight);

        // 5. Create Platforms in a Spiral Staircase
        stages.forEach((stage, idx) => {
          const theta = (idx / stages.length) * Math.PI * 1.5; # 270 degree spiral
          const radius = 4.5;
          
          const x = Math.cos(theta) * radius;
          const z = Math.sin(theta) * radius;
          const y = (idx - stages.length / 2) * 1.2; # Spiral elevation

          // Stage Cylinder Mesh
          const geom = new THREE.CylinderGeometry(0.8, 0.8, 0.15, 32);
          
          // Color code based on status
          let colorString = "#1e293b"; // Idle
          if (stage.status === "completed") colorString = "#10b981"; // Green
          else if (stage.status === "running") colorString = "#f59e0b"; // Orange
          else if (stage.status === "failed") colorString = "#ef4444"; // Red

          const mat = new THREE.MeshStandardMaterial({
            color: colorString,
            transparent: true,
            opacity: 0.8,
            roughness: 0.2,
            metalness: 0.8,
          });

          const mesh = new THREE.Mesh(geom, mat);
          mesh.position.set(x, y, z);
          mesh.userData = { stage };
          scene.add(mesh);
          stageMeshes.push(mesh);

          // Add glowing ring edge
          const ringGeom = new THREE.RingGeometry(0.81, 0.85, 32);
          ringGeom.rotateX(-Math.PI / 2);
          const ringMat = new THREE.MeshBasicMaterial({
            color: colorString,
            side: THREE.DoubleSide,
          });
          const ringMesh = new THREE.Mesh(ringGeom, ringMat);
          ringMesh.position.set(x, y + 0.08, z);
          scene.add(ringMesh);
        });

        // 6. Connect Platforms with Energy Beams
        for (let i = 0; i < stageMeshes.length - 1; i++) {
          const p1 = stageMeshes[i].position;
          const p2 = stageMeshes[i + 1].position;

          // Draw bezier/linear line connection
          const points = [p1, p2];
          const lineGeom = new THREE.BufferGeometry().setFromPoints(points);
          const lineMat = new THREE.LineBasicMaterial({
            color: "#64748b",
            transparent: true,
            opacity: 0.4,
          });
          const line = new THREE.Line(lineGeom, lineMat);
          scene.add(line);
          connectionLines.push({ p1, p2 });

          // 7. Initialize Flow Particles along connections
          const particleCount = 4;
          for (let p = 0; p < particleCount; p++) {
            const pGeom = new THREE.SphereGeometry(0.06, 8, 8);
            
            // Map particle color to stage status
            let pColor = "#10b981"; // default green
            if (stages[i].status === "running") pColor = "#f59e0b";
            
            const pMat = new THREE.MeshBasicMaterial({ color: pColor });
            const particle = new THREE.Mesh(pGeom, pMat);
            
            particle.position.copy(p1);
            scene.add(particle);
            
            particles.push({
              mesh: particle,
              p1,
              p2,
              progress: p / particleCount, # Stagger start progress
              speed: 0.005 + Math.random() * 0.005
            });
          }
        }

        // 8. Animation Loop
        const animate = () => {
          animationFrameId = requestAnimationFrame(animate);
          controls.update();

          // Animate Particles along path
          particles.forEach((part) => {
            part.progress += part.speed;
            if (part.progress >= 1.0) {
              part.progress = 0.0;
            }
            // Linear lerp position
            part.mesh.position.lerpVectors(part.p1, part.p2, part.progress);
          });

          // Spin platforms slowly
          stageMeshes.forEach((mesh) => {
            mesh.rotation.y += 0.01;
          });

          renderer.render(scene, camera);
        };
        animate();

        setLoading(false);

        // Raycasting for Mouse Interaction
        const raycaster = new THREE.Raycaster();
        const mouse = new THREE.Vector2();

        const handleMouseMove = (e: MouseEvent) => {
          if (!containerRef.current || !renderer || !camera) return;
          const rect = renderer.domElement.getBoundingClientRect();
          mouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
          mouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;

          raycaster.setFromCamera(mouse, camera);
          const intersects = raycaster.intersectObjects(stageMeshes);

          if (intersects.length > 0) {
            const hitStage = intersects[0].object.userData.stage;
            setActiveStage(hitStage);
          }
        };

        window.addEventListener("mousemove", handleMouseMove);

      } catch (err) {
        console.error("Three.js Pipeline error:", err);
        setLoading(false);
      }
    };

    initThree();

    return () => {
      cancelAnimationFrame(animationFrameId);
      if (renderer) renderer.dispose();
    };
  }, []);

  return (
    <div className="relative w-full rounded-2xl border border-white/10 bg-slate-950 overflow-hidden">
      {loading && (
        <div className="absolute inset-0 z-10 flex flex-col items-center justify-center bg-slate-950/80 gap-3">
          <Loader2 className="w-10 h-10 animate-spin text-emerald-400" />
          <span className="text-sm font-medium tracking-wider text-slate-300">Building 3D Pipeline...</span>
        </div>
      )}

      {/* Target Canvas */}
      <div ref={containerRef} className="w-full h-[450px]" />

      {/* Stage detail cards overlay */}
      <div className="absolute top-4 right-4 z-20 w-72 p-4 rounded-xl border border-white/10 bg-slate-950/80 backdrop-blur-md">
        <h4 className="text-[10px] font-bold text-slate-400 tracking-wider uppercase mb-3">Live Stage Monitor</h4>
        {activeStage ? (
          <div className="flex flex-col gap-2">
            <span className="text-sm font-semibold text-emerald-400">{activeStage.name}</span>
            <span className="text-xs text-slate-300 leading-normal">{activeStage.description}</span>
            <div className="flex justify-between items-center mt-2 pt-2 border-t border-white/5">
              <span className="text-[10px] text-slate-500 font-semibold uppercase">Status</span>
              <span className={`text-[10px] font-bold uppercase tracking-wider ${
                activeStage.status === "completed" ? "text-emerald-400" : (
                  activeStage.status === "running" ? "text-yellow-400" : "text-slate-400"
                )
              }`}>{activeStage.status}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-[10px] text-slate-500 font-semibold uppercase">Duration</span>
              <span className="text-xs font-bold text-slate-200">{activeStage.duration}</span>
            </div>
          </div>
        ) : (
          <span className="text-xs text-slate-500 italic">Hover over any 3D platform stage to inspect details...</span>
        )}
      </div>
    </div>
  );
}
