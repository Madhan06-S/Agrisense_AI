"use client";

import React, { useEffect, useRef, useState, useMemo } from "react";
import { Loader2 } from "lucide-react";

interface FarmTerrain3DProps {
  geojson?: any;
  ndviData?: any; // Single feature vector or timeseries list
  livePreview?: boolean;
  points?: [number, number][]; // Leaflet coordinate array [lat, lon]
}

// Point-in-Polygon Ray Casting algorithm
function isPointInPolygon(point: [number, number], polygon: [number, number][]) {
  const x = point[0], y = point[1];
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const xi = polygon[i][0], yi = polygon[i][1];
    const xj = polygon[j][0], yj = polygon[j][1];
    
    const intersect = ((yi > y) !== (yj > y))
        && (x < (xj - xi) * (y - yi) / (yj - yi) + xi);
    if (intersect) inside = !inside;
  }
  return inside;
}

export default function FarmTerrain3D({ geojson, ndviData, livePreview = false, points }: FarmTerrain3DProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [loading, setLoading] = useState(true);
  const [ndviDate, setNdviDate] = useState("2026-07-24");
  const [timeStep, setTimeStep] = useState(3);
  
  const dates = ["2026-06-01", "2026-06-15", "2026-07-01", "2026-07-15", "2026-07-24"];

  // Parse coordinates
  const polygonCoords = useMemo<[number, number][]>(() => {
    if (points && points.length >= 3) {
      // Map Leaflet points: [lat, lon] -> [lon, lat]
      return points.map(p => [p[1], p[0]]);
    }
    if (geojson?.coordinates?.[0]) {
      return geojson.coordinates[0]; // GeoJSON is already [lon, lat]
    }
    // Default mock square polygon if nothing provided
    return [
      [76.96, 29.54],
      [76.98, 29.54],
      [76.98, 29.56],
      [76.96, 29.56],
      [76.96, 29.54]
    ];
  }, [points, geojson]);

  // Compute centroid
  const centroid = useMemo<[number, number]>(() => {
    if (polygonCoords.length === 0) return [76.97, 29.55];
    let lonSum = 0, latSum = 0;
    polygonCoords.forEach(c => {
      lonSum += c[0];
      latSum += c[1];
    });
    return [lonSum / polygonCoords.length, latSum / polygonCoords.length];
  }, [polygonCoords]);

  // Bounding box in degrees
  const bbox = useMemo(() => {
    let minLon = Infinity, maxLon = -Infinity, minLat = Infinity, maxLat = -Infinity;
    polygonCoords.forEach(c => {
      if (c[0] < minLon) minLon = c[0];
      if (c[0] > maxLon) maxLon = c[0];
      if (c[1] < minLat) minLat = c[1];
      if (c[1] > maxLat) maxLat = c[1];
    });
    return { minLon, maxLon, minLat, maxLat };
  }, [polygonCoords]);

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
        const height = livePreview ? 280 : 450;

        // 1. Create Scene & Camera
        scene = new THREE.Scene();
        scene.background = new THREE.Color(livePreview ? "#081608" : "#020617"); // Darker matching farmer registration theme
        scene.fog = new THREE.FogExp2(livePreview ? "#081608" : "#020617", 0.02);

        camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 100);
        camera.position.set(0, livePreview ? 10 : 12, livePreview ? 14 : 18);

        // 2. Set up Renderer
        renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
        renderer.setSize(width, height);
        renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
        renderer.shadowMap.enabled = true;

        containerRef.current.innerHTML = "";
        containerRef.current.appendChild(renderer.domElement);

        // 3. Orbit Controls
        const controls = new OrbitControls(camera, renderer.domElement);
        controls.enableDamping = true;
        controls.maxPolarAngle = Math.PI / 2.1;
        controls.minDistance = 4;
        controls.maxDistance = 30;
        if (livePreview) {
          controls.enableZoom = false; // Disable zoom on mini-preview
        }

        // 4. Lights
        const ambientLight = new THREE.AmbientLight("#1e293b", 0.5);
        scene.add(ambientLight);

        const dirLight = new THREE.DirectionalLight("#34d399", 1.5); // Emerald key light
        dirLight.position.set(10, 20, 10);
        dirLight.castShadow = true;
        scene.add(dirLight);

        // 5. Generate Extruded Farm Terrain Grid based on Bounding Box
        // Map degrees of bbox to meters
        const latCenter = centroid[1];
        const lonCenter = centroid[0];
        
        const widthMeters = (bbox.maxLon - bbox.minLon) * 111320 * Math.cos(latCenter * Math.PI / 180);
        const heightMeters = (bbox.maxLat - bbox.minLat) * 111320;
        
        // Scale to a logical size in Three.js units (e.g. fits in 12x12 box)
        const maxDim = Math.max(widthMeters, heightMeters, 1);
        const scaleFactor = 10.0 / maxDim;
        
        const gridW = Math.max(2, widthMeters * scaleFactor);
        const gridH = Math.max(2, heightMeters * scaleFactor);

        const gridSegments = livePreview ? 20 : 40;
        const geometry = new THREE.PlaneGeometry(gridW, gridH, gridSegments, gridSegments);
        geometry.rotateX(-Math.PI / 2); // Make horizontal

        const pos = geometry.attributes.position;
        const colors = [];

        // Fetch NDVI reference value if available
        let baseNdvi = 0.6;
        if (ndviData) {
          if (Array.isArray(ndviData) && ndviData.length > timeStep) {
            baseNdvi = ndviData[timeStep].ndvi || 0.6;
          } else if (ndviData.ndvi) {
            baseNdvi = ndviData.ndvi;
          }
        }
        
        // Simulated NDVI progression depending on chronological slider
        if (!ndviData) {
          baseNdvi = 0.65 - 0.25 * Math.abs(2 - timeStep);
        }

        for (let i = 0; i < pos.count; i++) {
          const vx = pos.getX(i);
          const vz = pos.getZ(i);

          // Convert relative 3D coordinate back to lat/lon
          const relativeX = vx / scaleFactor;
          const relativeZ = -vz / scaleFactor;

          const lon = lonCenter + relativeX / (111320 * Math.cos(latCenter * Math.PI / 180));
          const lat = latCenter + relativeZ / 111320;

          // Check if coordinate lies within the polygon
          const inside = isPointInPolygon([lon, lat], polygonCoords);

          let yVal = -0.5;
          const color = new THREE.Color("#0f172a"); // Dark slate for outside boundary

          if (inside) {
            // Apply height extrusion and color scales inside farm boundary
            // Add a beautiful natural noise/undulation inside
            const noise = 0.12 * Math.sin(vx * 1.5) * Math.cos(vz * 1.5);
            let ndvi = baseNdvi + noise;
            
            // Limit range
            ndvi = Math.max(0.05, Math.min(0.95, ndvi));

            // Set height (extrude)
            yVal = ndvi * 2.5 - 0.5;

            // Map color green (healthy) -> yellow (stressed) -> red (damaged)
            if (ndvi > 0.58) {
              color.setHSL(0.35 + (ndvi - 0.58) * 0.12, 0.85, 0.42); // Healthy green
            } else if (ndvi > 0.35) {
              color.setHSL(0.14, 0.95, 0.48); // Stressed yellow
            } else {
              color.setHSL(0.01, 0.95, 0.45); // Damaged red
            }
          } else {
            // Outside polygon, fade/transparent color
            color.setHSL(0.6, 0.2, 0.12);
          }

          pos.setY(i, yVal);
          colors.push(color.r, color.g, color.b);
        }

        geometry.setAttribute("color", new THREE.Float32BufferAttribute(colors, 3));
        geometry.computeVertexNormals();

        const material = new THREE.MeshStandardMaterial({
          vertexColors: true,
          roughness: 0.75,
          metalness: 0.05,
          flatShading: true,
          transparent: true,
          opacity: 0.95
        });

        terrainMesh = new THREE.Mesh(geometry, material);
        terrainMesh.receiveShadow = true;
        terrainMesh.castShadow = true;
        scene.add(terrainMesh);

        // Add grid helper floor
        const gridHelper = new THREE.GridHelper(16, 16, "#334155", "#1e293b");
        gridHelper.position.y = -0.8;
        scene.add(gridHelper);

        // 6. Animation Loop
        const animate = () => {
          animationFrameId = requestAnimationFrame(animate);
          controls.update();
          
          if (terrainMesh) {
            // Slow passive rotation
            terrainMesh.rotation.y += 0.001;
          }
          
          renderer.render(scene, camera);
        };
        animate();

        setLoading(false);

        // Resize handler
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
  }, [polygonCoords, centroid, bbox, timeStep, ndviData, livePreview]);

  const handleSliderChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = parseInt(e.target.value);
    setTimeStep(val);
    setNdviDate(dates[val]);
  };

  return (
    <div className={`relative w-full rounded-2xl border border-white/10 bg-slate-950 overflow-hidden ${livePreview ? "h-[280px]" : ""}`}>
      {loading && (
        <div className="absolute inset-0 z-10 flex flex-col items-center justify-center bg-slate-950/80 gap-3">
          <Loader2 className="w-8 h-8 animate-spin text-emerald-400" />
          <span className="text-xs font-medium text-slate-300">Generating 3D Terrain...</span>
        </div>
      )}

      {/* Render Canvas Target */}
      <div ref={containerRef} className={`w-full ${livePreview ? "h-[280px]" : "h-[450px]"}`} />

      {/* Slider / Date controls overlay - hide on live preview */}
      {!livePreview && (
        <div className="absolute bottom-4 left-4 right-4 z-20 flex flex-col md:flex-row gap-4 justify-between items-center p-3 rounded-xl border border-white/10 bg-slate-950/80 backdrop-blur-md">
          <div className="flex flex-col gap-0.5">
            <span className="text-[10px] font-semibold text-emerald-400">Chronological NDVI Growth Slider</span>
            <span className="text-[9px] text-slate-400">Selected Date: <b className="text-slate-200">{ndviDate}</b></span>
          </div>

          <div className="flex items-center gap-3 w-full md:w-auto">
            <span className="text-[9px] text-slate-500 font-semibold uppercase">June</span>
            <input
              type="range"
              min="0"
              max="4"
              step="1"
              value={timeStep}
              onChange={handleSliderChange}
              className="w-full md:w-48 accent-emerald-400"
            />
            <span className="text-[9px] text-slate-500 font-semibold uppercase">July</span>
          </div>
        </div>
      )}

      {/* Mini Legend overlay */}
      {!livePreview && (
        <div className="absolute top-4 right-4 z-20 flex flex-col gap-1.5 p-2.5 rounded-lg border border-white/10 bg-slate-950/70 text-right">
          <span className="text-[9px] font-bold text-slate-400 tracking-wider uppercase">NDVI Elevation</span>
          <div className="flex gap-1.5 justify-end items-center">
            <span className="text-[9px] text-slate-300">Healthy {`>0.58`}</span>
            <div className="w-2 h-2 rounded bg-emerald-500" />
          </div>
          <div className="flex gap-1.5 justify-end items-center">
            <span className="text-[9px] text-slate-300">Stressed 0.35 - 0.58</span>
            <div className="w-2 h-2 rounded bg-yellow-400" />
          </div>
          <div className="flex gap-1.5 justify-end items-center">
            <span className="text-[9px] text-slate-300">Damaged {`<0.35`}</span>
            <div className="w-2 h-2 rounded bg-red-500" />
          </div>
        </div>
      )}
    </div>
  );
}
