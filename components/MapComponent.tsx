"use client";

import { useState } from "react";
import { MapContainer, TileLayer, Polygon, Marker, useMapEvents } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

// Configure default Leaflet marker icons
const iconUrl = "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png";
const shadowUrl = "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png";
const defaultIcon = L.icon({
  iconUrl,
  shadowUrl,
  iconSize: [25, 41],
  iconAnchor: [12, 41],
});

L.Marker.prototype.options.icon = defaultIcon;

export interface Farm {
  id: number;
  name: string;
  crop_type: string;
  sowing_date: string;
  area_hectares: number;
  insurance_policy_number: string;
  khasra_number: string;
  state: string;
  district: string;
  taluka: string;
  village: string;
  boundary: {
    type: "Polygon";
    coordinates: number[][][];
  };
}

interface MapComponentProps {
  points: [number, number][];
  setPoints: (points: [number, number][]) => void;
  existingFarms: Farm[];
}

export default function MapComponent({ points, setPoints, existingFarms }: MapComponentProps) {
  const [mapCenter] = useState<[number, number]>([28.6139, 77.2090]); // New Delhi default

  // Custom event handler to capture click coordinates on the map
  function MapEvents() {
    useMapEvents({
      click(e) {
        const { lat, lng } = e.latlng;
        setPoints([...points, [lat, lng]]);
      },
    });
    return null;
  }

  // Handle GeoJSON file upload
  const handleGeoJSONImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const geojson = JSON.parse(event.target?.result as string);
        let coords: [number, number][] = [];

        // Parse coordinates based on geometry type
        if (geojson.type === "Feature" && geojson.geometry?.type === "Polygon") {
          const polyCoords = geojson.geometry.coordinates as number[][][];
          coords = polyCoords[0].map((c) => [c[1], c[0]]);
        } else if (geojson.type === "Polygon") {
          const polyCoords = geojson.coordinates as number[][][];
          coords = polyCoords[0].map((c) => [c[1], c[0]]);
        } else if (geojson.type === "FeatureCollection") {
          const firstFeature = geojson.features?.[0];
          if (firstFeature?.geometry?.type === "Polygon") {
            const polyCoords = firstFeature.geometry.coordinates as number[][][];
            coords = polyCoords[0].map((c) => [c[1], c[0]]);
          }
        }

        if (coords.length > 0) {
          // Remove duplicate closing point if present in GeoJSON
          if (
            coords[0][0] === coords[coords.length - 1][0] &&
            coords[0][1] === coords[coords.length - 1][1]
          ) {
            coords.pop();
          }
          setPoints(coords);
        } else {
          alert("Could not find a valid Polygon in the uploaded GeoJSON file.");
        }
      } catch (err) {
        console.error("GeoJSON parse error:", err);
        alert("Failed to parse file as GeoJSON.");
      }
    };
    reader.readAsText(file);
  };

  return (
    <div className="relative w-full h-[450px] rounded-lg overflow-hidden border border-emerald-800 shadow-lg">
      <MapContainer
        center={mapCenter}
        zoom={6}
        className="w-full h-full"
      >
        {/* Esri World Imagery (Satellite Base Layer) */}
        <TileLayer
          url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
          attribution="&copy; Esri &mdash; Source: Esri, i-cubed, USDA, USGS, AEX, GeoEye, Getmapping, Aerogrid, IGN, IGP, UPR-EGP, and the GIS User Community"
        />

        {/* Listen for click to draw vertices */}
        <MapEvents />

        {/* Render current polygon path being drawn */}
        {points.length > 0 && (
          <>
            {points.map((pt, idx) => (
              <Marker
                key={`vertex-${idx}`}
                position={pt}
                eventHandlers={{
                  click: (e) => {
                    e.originalEvent.stopPropagation();
                    // Remove vertex on click
                    const updated = [...points];
                    updated.splice(idx, 1);
                    setPoints(updated);
                  },
                }}
              />
            ))}
            {points.length >= 3 && (
              <Polygon
                positions={points}
                pathOptions={{ color: "#22c55e", fillColor: "#22c55e", fillOpacity: 0.3 }}
              />
            )}
          </>
        )}

        {/* Render already registered farms */}
        {existingFarms.map((farm) => {
          if (!farm.boundary?.coordinates?.[0]) return null;
          // Convert GeoJSON coordinates [lon, lat] back to [lat, lon] for Leaflet
          const positions = farm.boundary.coordinates[0].map((c) => [c[1], c[0]]) as [number, number][];
          return (
            <Polygon
              key={`farm-poly-${farm.id}`}
              positions={positions}
              pathOptions={{ color: "#3b82f6", fillColor: "#3b82f6", fillOpacity: 0.15 }}
            />
          );
        })}
      </MapContainer>

      {/* Control Buttons */}
      <div className="absolute top-4 right-4 z-[1000] flex flex-col gap-2">
        <label className="flex items-center justify-center px-3 py-1.5 bg-[#133513] hover:bg-[#1b4f1b] text-[#e2ebd5] border border-emerald-700 text-sm font-medium rounded-md cursor-pointer transition shadow-md">
          <span>📁 Import GeoJSON</span>
          <input
            type="file"
            accept=".geojson,.json"
            onChange={handleGeoJSONImport}
            className="hidden"
          />
        </label>
        
        {points.length > 0 && (
          <button
            onClick={() => setPoints([])}
            className="px-3 py-1.5 bg-red-950 hover:bg-red-900 text-red-200 border border-red-800 text-sm font-medium rounded-md transition shadow-md"
          >
            🗑️ Clear vertices
          </button>
        )}
      </div>

      <div className="absolute bottom-4 left-4 z-[1000] bg-[#0a1f0a]/90 border border-emerald-800/80 px-3 py-2 rounded-md text-xs text-[#e2ebd5] pointer-events-none shadow-md backdrop-blur-sm">
        <p className="font-semibold text-emerald-400">💡 Polygon Drawing Guide:</p>
        <p>• Click on the map to add farm boundary vertices.</p>
        <p>• Click any marker vertex to delete it.</p>
        <p>• Minimum 3 vertices to register a valid boundary.</p>
      </div>
    </div>
  );
}
