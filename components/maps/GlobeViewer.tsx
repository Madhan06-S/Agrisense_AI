"use client";

import React, { useEffect, useRef, useState } from "react";
import { Loader2 } from "lucide-react";

interface FarmMarker {
  id: number;
  name: string;
  cropType: string;
  lat: number;
  lng: number;
  area: number;
}

export default function GlobeViewer() {
  const containerRef = useRef<HTMLDivElement>(null);
  const [loading, setLoading] = useState(true);
  const [rotationSpeed, setRotationSpeed] = useState(0.5);
  const [isRotating, setIsRotating] = useState(true);
  const viewerRef = useRef<any>(null);

  const mockFarms: FarmMarker[] = [
    { id: 1, name: "Patiala Field A", cropType: "Wheat", lat: 30.35, lng: 76.10, area: 12.5 },
    { id: 2, name: "Ludhiana Paddy", cropType: "Rice", lat: 30.90, lng: 75.80, area: 24.0 },
    { id: 3, name: "Amritsar Sugarcane", cropType: "Sugarcane", lat: 31.60, lng: 74.80, area: 8.2 },
    { id: 4, name: "Bathinda Cotton", cropType: "Cotton", lat: 30.20, lng: 74.95, area: 18.0 },
    { id: 5, name: "Jalandhar Potato", cropType: "Potato", lat: 31.32, lng: 75.57, area: 15.6 },
  ];

  useEffect(() => {
    let viewer: any = null;
    let rotationInterval: any = null;

    // Load Cesium dynamically on client side
    const initCesium = async () => {
      try {
        const Cesium = await import("cesium");
        
        // Disable Cesium Ion token warning by providing a default open layer
        Cesium.Ion.defaultAccessToken = "";

        if (!containerRef.current) return;

        viewer = new Cesium.Viewer(containerRef.current, {
          terrainProvider: await Cesium.createWorldTerrainAsync(),
          baseLayerPicker: false,
          geocoder: false,
          homeButton: false,
          infoBox: false,
          sceneModePicker: false,
          selectionIndicator: false,
          navigationHelpButton: false,
          animation: false,
          timeline: false,
          fullscreenButton: false,
        });

        viewerRef.current = viewer;

        // Apply dark space skybox colors and atmospheric effects
        viewer.scene.skyAtmosphere.show = true;
        viewer.scene.globe.enableLighting = true;
        viewer.scene.globe.depthTestAgainstTerrain = true;

        // 1. Center camera over India on load
        viewer.camera.flyTo({
          destination: Cesium.Cartesian3.fromDegrees(78.9629, 22.5937, 8000000.0),
          duration: 2.0,
        });

        // 2. Add farm markers as extruded pillars
        mockFarms.forEach((farm) => {
          const height = farm.area * 10000.0; # Max height based on hectares
          viewer.entities.add({
            name: farm.name,
            description: `${farm.cropType} (${farm.area} ha)`,
            position: Cesium.Cartesian3.fromDegrees(farm.lng, farm.lat, height / 2),
            cylinder: {
              length: height,
              topRadius: 15000.0,
              bottomRadius: 15000.0,
              material: Cesium.Color.fromCssColorString("rgba(16, 185, 129, 0.6)"),
              outline: true,
              outlineColor: Cesium.Color.EMERALD,
            },
          });
        });

        // 3. Draw Orbit Tracks (Sentinel-1: Red, Sentinel-2: Green, LISS-IV: Orange)
        const drawOrbit = (color: any, offsetLng: number) => {
          const positions = [];
          for (let lat = -80; lat <= 80; lat += 5) {
            // Simplified polar orbit trajectory calculations
            const lng = 78.9629 + Math.sin(lat * Math.PI / 180.0) * 30.0 + offsetLng;
            positions.push(Cesium.Cartesian3.fromDegrees(lng, lat, 700000.0)); # 700km altitude
          }
          viewer.entities.add({
            polyline: {
              positions: positions,
              width: 2.0,
              material: color,
            },
          });
          
          // Moving satellite marker
          const satEntity = viewer.entities.add({
            position: positions[0],
            point: {
              pixelSize: 10,
              color: color,
              outlineColor: Cesium.Color.WHITE,
              outlineWidth: 2,
            },
          });

          // Animate satellite along track
          let step = 0;
          setInterval(() => {
            step = (step + 1) % positions.length;
            satEntity.position = positions[step];
          }, 1000);
        };

        drawOrbit(Cesium.Color.RED, -20.0);    # Sentinel-1
        drawOrbit(Cesium.Color.GREEN, 0.0);     # Sentinel-2
        drawOrbit(Cesium.Color.ORANGE, 20.0);   # LISS-IV

        setLoading(false);
      } catch (err) {
        logger.error("Cesium loading failed: %s", err);
        setLoading(false);
      }
    };

    initCesium();

    // 4. Slow Earth Rotation
    rotationInterval = setInterval(() => {
      if (viewer && isRotating && viewer.scene && viewer.camera) {
        viewer.camera.rotateLeft(rotationSpeed * 0.005);
      }
    }, 50);

    return () => {
      if (viewer) viewer.destroy();
      clearInterval(rotationInterval);
    };
  }, [isRotating, rotationSpeed]);

  const resetView = async () => {
    const Cesium = await import("cesium");
    if (viewerRef.current) {
      viewerRef.current.camera.flyTo({
        destination: Cesium.Cartesian3.fromDegrees(78.9629, 22.5937, 8000000.0),
        duration: 1.5,
      });
    }
  };

  return (
    <div className="relative w-full h-[600px] rounded-2xl overflow-hidden border border-white/10 bg-slate-950">
      {loading && (
        <div className="absolute inset-0 z-10 flex flex-col items-center justify-center bg-slate-950/80 gap-3">
          <Loader2 className="w-10 h-10 animate-spin text-emerald-400" />
          <span className="text-sm font-medium tracking-wider text-slate-300">Initializing Cesium Globe...</span>
        </div>
      )}
      
      {/* Globe Target Div */}
      <div ref={containerRef} className="w-full h-full" />

      {/* Control Widgets */}
      <div className="absolute top-4 left-4 z-20 flex flex-col gap-3 p-4 rounded-xl border border-white/10 bg-slate-950/70 backdrop-blur-md">
        <h4 className="text-xs font-semibold text-slate-400 uppercase tracking-widest">Globe Dashboard</h4>
        
        <button
          onClick={resetView}
          className="w-full py-1.5 px-3 rounded-lg text-xs font-medium bg-emerald-500 hover:bg-emerald-600 text-slate-950 transition-colors"
        >
          Reset View
        </button>

        <div className="flex flex-col gap-1.5">
          <span className="text-[10px] text-slate-400 font-medium">Rotation controls</span>
          <div className="flex gap-2 items-center">
            <button
              onClick={() => setIsRotating(!isRotating)}
              className="py-1 px-2 rounded bg-white/10 hover:bg-white/20 text-[10px] font-medium text-slate-200"
            >
              {isRotating ? "Pause" : "Spin"}
            </button>
            <input
              type="range"
              min="0.1"
              max="2.0"
              step="0.1"
              value={rotationSpeed}
              onChange={(e) => setRotationSpeed(parseFloat(e.target.value))}
              className="w-20 accent-emerald-400"
            />
          </div>
        </div>
      </div>
    </div>
  );
}
