"use client";

import { useState, useEffect } from "react";
import { MapContainer, TileLayer, Polygon, Marker, Circle, useMapEvents, useMap } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { Search, Loader2, Plus, Minus } from "lucide-react";
import { doPolygonsOverlap, FarmerCurrentLocation, InsuredFarmLocation } from "@/lib/spatialUtils";

// Default Leaflet icon fallback
const iconUrl = "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png";
const shadowUrl = "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png";
const defaultIcon = L.icon({
  iconUrl,
  shadowUrl,
  iconSize: [25, 41],
  iconAnchor: [12, 41],
});
L.Marker.prototype.options.icon = defaultIcon;

// Custom Icons
const createCurrentGpsIcon = () =>
  L.divIcon({
    className: "custom-gps-marker",
    html: `
      <div class="relative flex items-center justify-center">
        <div class="absolute w-8 h-8 bg-blue-500/40 rounded-full animate-ping"></div>
        <div class="relative w-6 h-6 bg-blue-600 border-2 border-white rounded-full shadow-lg flex items-center justify-center text-white text-xs font-bold">
          📍
        </div>
      </div>
    `,
    iconSize: [24, 24],
    iconAnchor: [12, 12],
  });

const createInsuredFarmPinIcon = () =>
  L.divIcon({
    className: "custom-center-pin-marker",
    html: `
      <div class="flex items-center justify-center transform -translate-y-4">
        <div class="px-2.5 py-1 bg-red-600 text-white font-bold rounded-full shadow-2xl border-2 border-white text-xs flex items-center gap-1 animate-bounce">
          📌 Insured Farm Center
        </div>
      </div>
    `,
    iconSize: [120, 30],
    iconAnchor: [60, 30],
  });

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
  verification_status?: string;
  farmerCurrentLocation?: FarmerCurrentLocation;
  insuredFarmLocation?: InsuredFarmLocation;
}

interface MapComponentProps {
  points: [number, number][];
  setPoints: (points: [number, number][]) => void;
  existingFarms: Farm[];
  onLocationSelect?: (location: { state: string; district: string; taluka: string; village: string }) => void;
  targetLocationQuery?: string;
  targetCoordinates?: { lat: number; lng: number; zoom?: number } | null;
  
  // Explicit Location Distinction Props
  farmerCurrentLocation?: FarmerCurrentLocation | null;
  insuredFarmLocation?: [number, number] | null;
  setInsuredFarmLocation?: (pin: [number, number] | null) => void;
  mode?: "gps" | "search" | "mark" | "draw" | "check" | "view";
  locationOption?: "at_field" | "somewhere_else";
  isSelfIntersecting?: boolean;
  hasOverlap?: boolean;
  activeStep?: number;
}

const reverseGeocode = async (lat: number, lon: number, callback?: MapComponentProps["onLocationSelect"]) => {
  try {
    const res = await fetch(
      `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lon}&zoom=18&addressdetails=1`,
      { headers: { "User-Agent": "AgriSense-AI-App/1.0" } }
    );
    if (!res.ok) return;
    const data = await res.json();
    if (data && data.address && callback) {
      const addr = data.address;
      callback({
        state: addr.state || "",
        district: addr.district || addr.state_district || addr.county || "",
        taluka: addr.subdistrict || addr.tehsil || addr.taluk || "",
        village: addr.village || addr.town || addr.city || addr.neighbourhood || addr.suburb || "",
      });
    }
  } catch (err) {
    console.error("Reverse geocoding error:", err);
  }
};

export default function MapComponent({
  points,
  setPoints,
  existingFarms,
  onLocationSelect,
  targetLocationQuery,
  targetCoordinates,
  farmerCurrentLocation,
  insuredFarmLocation,
  setInsuredFarmLocation,
  mode = "draw",
  locationOption = "at_field",
  isSelfIntersecting = false,
  hasOverlap = false,
  activeStep = 1,
}: MapComponentProps) {
  const [mapCenter] = useState<[number, number]>([20.5937, 78.9629]); // India center
  const [searchQuery, setSearchQuery] = useState("");
  const [searchLoading, setSearchLoading] = useState(false);
  const [centerOverride, setCenterOverride] = useState<[number, number] | null>(null);
  const [zoomOverride, setZoomOverride] = useState<number>(6);
  const [locationStatus, setLocationStatus] = useState<string | null>(null);

  // Target coordinates handler
  useEffect(() => {
    if (targetCoordinates && targetCoordinates.lat && targetCoordinates.lng) {
      const coords: [number, number] = [targetCoordinates.lat, targetCoordinates.lng];
      setCenterOverride(coords);
      setZoomOverride(targetCoordinates.zoom || 14);
      setLocationStatus(`Centered on location`);
    }
  }, [targetCoordinates]);

  // Target location query auto-navigate
  useEffect(() => {
    if (!targetLocationQuery || targetLocationQuery.trim().length < 3) return;

    const timer = setTimeout(async () => {
      try {
        setSearchLoading(true);
        setLocationStatus(`Finding ${targetLocationQuery}...`);
        const query = targetLocationQuery.toLowerCase().includes("india")
          ? targetLocationQuery
          : `${targetLocationQuery}, India`;

        const res = await fetch(
          `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&limit=1&addressdetails=1`,
          { headers: { "User-Agent": "AgriSense-AI-App/1.0" } }
        );
        if (res.ok) {
          const data = await res.json();
          if (data && data.length > 0) {
            const lat = parseFloat(data[0].lat);
            const lon = parseFloat(data[0].lon);
            const coords: [number, number] = [lat, lon];
            setCenterOverride(coords);
            setZoomOverride(15);
            setLocationStatus(`Centered on ${data[0].display_name.split(',')[0]}`);
          }
        }
      } catch (err) {
        console.error("Auto geocoding error:", err);
      } finally {
        setSearchLoading(false);
      }
    }, 400);

    return () => clearTimeout(timer);
  }, [targetLocationQuery]);

  // Handle Map Click based on mode
  function MapEvents() {
    useMapEvents({
      click(e) {
        const { lat, lng } = e.latlng;
        if ((mode === "mark" || mode === "search") && setInsuredFarmLocation) {
          setInsuredFarmLocation([lat, lng]);
          reverseGeocode(lat, lng, onLocationSelect);
        } else if (mode === "draw") {
          setPoints([...points, [lat, lng]]);
          if (points.length === 0) {
            reverseGeocode(lat, lng, onLocationSelect);
          }
        }
      },
    });
    return null;
  }

  // Dynamic controller for smooth flyTo
  function MapController({ center, zoom }: { center: [number, number] | null; zoom: number }) {
    const map = useMap();
    useEffect(() => {
      if (center) {
        map.flyTo(center, zoom, { animate: true, duration: 1.2 });
      }
    }, [center, zoom, map]);
    return null;
  }

  // Custom Zoom Control Buttons inside Leaflet
  function CustomZoomButtons() {
    const map = useMap();
    return (
      <div className="absolute bottom-6 right-4 z-[1000] flex flex-col gap-1">
        <button
          type="button"
          onClick={() => map.zoomIn()}
          className="w-9 h-9 bg-emerald-950/90 hover:bg-emerald-900 text-white font-bold rounded-t border border-emerald-600 flex items-center justify-center shadow-lg transition"
          title="Zoom In"
        >
          <Plus className="w-5 h-5" />
        </button>
        <button
          type="button"
          onClick={() => map.zoomOut()}
          className="w-9 h-9 bg-emerald-950/90 hover:bg-emerald-900 text-white font-bold rounded-b border-x border-b border-emerald-600 flex items-center justify-center shadow-lg transition"
          title="Zoom Out"
        >
          <Minus className="w-5 h-5" />
        </button>
      </div>
    );
  }

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchQuery.trim()) return;
    setSearchLoading(true);
    try {
      const res = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(searchQuery)}&limit=1&addressdetails=1`,
        { headers: { "User-Agent": "AgriSense-AI-App/1.0" } }
      );
      if (!res.ok) throw new Error("Search failed");
      const data = await res.json();
      if (data && data.length > 0) {
        const firstResult = data[0];
        const lat = parseFloat(firstResult.lat);
        const lon = parseFloat(firstResult.lon);
        const newCenter: [number, number] = [lat, lon];
        setCenterOverride(newCenter);
        setZoomOverride(16);
        if (setInsuredFarmLocation) {
          setInsuredFarmLocation(newCenter);
        }
      }
    } catch (err) {
      console.error("Search error:", err);
    } finally {
      setSearchLoading(false);
    }
  };

  const polygonColor = isSelfIntersecting || hasOverlap ? "#ef4444" : "#22c55e";

  return (
    <div className="relative w-full h-[480px] rounded-xl overflow-hidden border border-emerald-800/80 shadow-2xl">
      <MapContainer center={mapCenter} zoom={6} className="w-full h-full" zoomControl={false}>
        {/* Esri World Imagery (Satellite Base Layer) */}
        <TileLayer
          url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
          attribution="&copy; Esri World Imagery"
          maxNativeZoom={18}
          maxZoom={20}
        />

        <MapController center={centerOverride} zoom={zoomOverride} />
        <CustomZoomButtons />
        <MapEvents />

        {/* Farmer's Current GPS Location Marker */}
        {farmerCurrentLocation && farmerCurrentLocation.latitude && farmerCurrentLocation.longitude && (
          <>
            <Marker
              position={[farmerCurrentLocation.latitude, farmerCurrentLocation.longitude]}
              icon={createCurrentGpsIcon()}
            />
            {farmerCurrentLocation.accuracy && (
              <Circle
                center={[farmerCurrentLocation.latitude, farmerCurrentLocation.longitude]}
                radius={farmerCurrentLocation.accuracy}
                pathOptions={{ color: "#3b82f6", fillColor: "#3b82f6", fillOpacity: 0.15, weight: 1.5 }}
              />
            )}
          </>
        )}

        {/* Insured Farm Center Pin Marker */}
        {insuredFarmLocation && (
          <Marker
            position={insuredFarmLocation}
            draggable={mode === "mark" || mode === "draw" || mode === "search"}
            icon={createInsuredFarmPinIcon()}
            eventHandlers={{
              dragend: (e) => {
                const marker = e.target;
                const pos = marker.getLatLng();
                if (setInsuredFarmLocation) {
                  setInsuredFarmLocation([pos.lat, pos.lng]);
                }
              },
            }}
          />
        )}

        {/* Current Polygon Being Drawn */}
        {points.length > 0 && (
          <>
            {points.map((pt, idx) => (
              <Marker
                key={`vertex-${idx}`}
                position={pt}
                draggable={mode === "draw"}
                eventHandlers={{
                  dragend: (e) => {
                    const marker = e.target;
                    const pos = marker.getLatLng();
                    const updated = [...points];
                    updated[idx] = [pos.lat, pos.lng];
                    setPoints(updated);
                  },
                  click: (e) => {
                    e.originalEvent.stopPropagation();
                    if (mode === "draw") {
                      const updated = [...points];
                      updated.splice(idx, 1);
                      setPoints(updated);
                    }
                  },
                }}
              />
            ))}
            {points.length >= 3 && (
              <Polygon
                positions={points}
                pathOptions={{
                  color: polygonColor,
                  fillColor: polygonColor,
                  fillOpacity: 0.35,
                  weight: 3,
                }}
              />
            )}
          </>
        )}

        {/* Render Existing Registered Farms */}
        {existingFarms.map((farm) => {
          if (!farm.boundary?.coordinates?.[0]) return null;
          const positions = farm.boundary.coordinates[0].map((c) => [c[1], c[0]]) as [number, number][];
          const isOverlapping = points.length >= 3 && doPolygonsOverlap(points, positions);

          return (
            <Polygon
              key={`farm-poly-${farm.id}`}
              positions={positions}
              pathOptions={{
                color: isOverlapping ? "#ef4444" : "#3b82f6",
                fillColor: isOverlapping ? "#ef4444" : "#3b82f6",
                fillOpacity: isOverlapping ? 0.4 : 0.18,
                weight: isOverlapping ? 3 : 1.5,
                dashArray: isOverlapping ? "6, 6" : undefined,
              }}
            />
          );
        })}
      </MapContainer>

      {/* Top Search Bar */}
      <div className="absolute top-3 left-4 z-[1000] w-80">
        <form onSubmit={handleSearch} className="flex flex-col bg-[#0a1f0a]/95 border border-emerald-700/80 rounded-lg p-1.5 shadow-xl backdrop-blur-md space-y-1">
          <div className="flex items-center gap-1">
            <input
              type="text"
              placeholder="Search farm village/town (e.g. Kallakurichi)..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-transparent text-xs text-[#e2ebd5] placeholder-emerald-500 px-2 focus:outline-none"
            />
            <button type="submit" disabled={searchLoading} className="p-1.5 bg-[#133513] hover:bg-[#1b4f1b] text-emerald-400 rounded transition shrink-0">
              {searchLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Search className="h-3.5 w-3.5" />}
            </button>
          </div>
          <p className="text-[10px] text-emerald-500 px-2">
            Search helps you navigate the map to locate your insured land.
          </p>
        </form>
      </div>

      {/* Step Prompt Banner */}
      <div className="absolute top-3 right-4 z-[1000] max-w-sm bg-[#0a1f0a]/95 border border-emerald-600 px-3 py-2 rounded-lg shadow-xl backdrop-blur-md text-xs text-[#e2ebd5] flex items-center gap-2">
        {activeStep === 2 && <span>📍 Select whether you are physically at your field or registering land located somewhere else.</span>}
        {activeStep === 3 && <span>🗺️ Search or navigate the map to locate your insured farm plot.</span>}
        {activeStep === 4 && <span>📌 Place the land center pin inside your plot, then tap around its edges.</span>}
        {activeStep === 5 && <span>✓ Reviewing land check results.</span>}
        {activeStep === 6 && <span>🔍 Review all farm details before final submission.</span>}
      </div>

      {/* Compact Map Legend Overlay */}
      <div className="absolute bottom-4 left-4 z-[1000] bg-[#0a1f0a]/95 border border-emerald-800/90 p-2.5 rounded-lg text-[11px] text-[#e2ebd5] shadow-xl backdrop-blur-md space-y-1">
        <div className="font-semibold text-emerald-400 border-b border-emerald-800/80 pb-1 mb-1">Map Legend</div>
        {farmerCurrentLocation && (
          <div className="flex items-center gap-2">
            <span>📍</span> <span>Your Current Location</span>
          </div>
        )}
        <div className="flex items-center gap-2">
          <span>📌</span> <span>Insured Farm Center Pin</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="w-3 h-3 rounded-sm bg-emerald-500/60 border border-emerald-400 inline-block"></span>
          <span>Your Field Boundary</span>
        </div>
        {hasOverlap && (
          <div className="flex items-center gap-2 text-red-300 font-semibold">
            <span className="w-3 h-3 rounded-sm bg-red-500/60 border border-red-400 inline-block"></span>
            <span>⚠️ Overlapping Field</span>
          </div>
        )}
        <div className="flex items-center gap-2">
          <span className="w-3 h-3 rounded-sm bg-blue-500/40 border border-blue-400 inline-block"></span>
          <span>Registered Neighbor Farm</span>
        </div>
      </div>
    </div>
  );
}
