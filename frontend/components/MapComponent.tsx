"use client";

import { useState, useEffect } from "react";
import { MapContainer, TileLayer, Polygon, Marker, useMapEvents, useMap } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { Search, Loader2 } from "lucide-react";

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
  onLocationSelect?: (location: { state: string; district: string; taluka: string; village: string }) => void;
  targetLocationQuery?: string;
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
  targetLocationQuery 
}: MapComponentProps) {
  const [mapCenter] = useState<[number, number]>([28.6139, 77.2090]); // New Delhi default
  const [searchQuery, setSearchQuery] = useState("");
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchMarker, setSearchMarker] = useState<[number, number] | null>(null);
  const [centerOverride, setCenterOverride] = useState<[number, number] | null>(null);
  const [locationStatus, setLocationStatus] = useState<string | null>(null);

  // Auto-navigate map when targetLocationQuery updates from form
  useEffect(() => {
    if (!targetLocationQuery || targetLocationQuery.trim().length < 3) return;

    const timer = setTimeout(async () => {
      try {
        setSearchLoading(true);
        setLocationStatus(`Navigating map to ${targetLocationQuery}...`);
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
            setSearchMarker(coords);
            setLocationStatus(`Centered on ${data[0].display_name.split(',')[0]}`);
          }
        }
      } catch (err) {
        console.error("Auto geocoding error:", err);
      } finally {
        setSearchLoading(false);
      }
    }, 700);

    return () => clearTimeout(timer);
  }, [targetLocationQuery]);

  // Custom event handler to capture click coordinates on the map
  function MapEvents() {
    useMapEvents({
      click(e) {
        const { lat, lng } = e.latlng;
        setPoints([...points, [lat, lng]]);
        reverseGeocode(lat, lng, onLocationSelect);
      },
    });
    return null;
  }

  // Component to dynamically pan the map to the searched coordinates
  function MapController({ center }: { center: [number, number] | null }) {
    const map = useMap();
    useEffect(() => {
      if (center) {
        map.flyTo(center, 15, { animate: true, duration: 1.5 });
      }
    }, [center, map]);
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
          // Reverse geocode the first coordinate to populate address fields
          reverseGeocode(coords[0][0], coords[0][1], onLocationSelect);
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
        setSearchMarker(newCenter);
        
        // Auto-fill the form with search result's address details
        if (onLocationSelect && firstResult.address) {
          const addr = firstResult.address;
          onLocationSelect({
            state: addr.state || "",
            district: addr.district || addr.state_district || addr.county || "",
            taluka: addr.subdistrict || addr.tehsil || addr.taluk || "",
            village: addr.village || addr.town || addr.city || addr.neighbourhood || addr.suburb || "",
          });
        }
      } else {
        alert("Location not found. Please try a different query.");
      }
    } catch (err) {
      console.error("Geocoding search error:", err);
      alert("Error searching location. Please try again.");
    } finally {
      setSearchLoading(false);
    }
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

        {/* Dynamic map controller for centering */}
        <MapController center={centerOverride} />

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

        {/* Render searched location marker */}
        {searchMarker && (
          <Marker
            position={searchMarker}
            eventHandlers={{
              click: (e) => {
                e.originalEvent.stopPropagation();
                // Add search marker as a vertex
                setPoints([...points, searchMarker]);
              },
            }}
          />
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

      {/* Search Bar Overlay */}
      <div className="absolute top-4 left-14 z-[1000] w-72">
        <form onSubmit={handleSearch} className="flex items-center gap-1 bg-[#0a1f0a]/95 border border-emerald-800 rounded-md p-1 shadow-md backdrop-blur-sm">
          <input
            type="text"
            placeholder="Search location (e.g. Karnal)..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-transparent text-xs text-[#e2ebd5] placeholder-emerald-600 px-2 py-1 focus:outline-none"
          />
          <button
            type="submit"
            disabled={searchLoading}
            className="p-1 bg-[#133513] hover:bg-[#1b4f1b] text-emerald-400 rounded transition"
          >
            {searchLoading ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Search className="h-3.5 w-3.5" />
            )}
          </button>
        </form>
      </div>

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

      {locationStatus && (
        <div className="absolute bottom-4 right-4 z-[1000] bg-[#0a1f0a]/95 border border-emerald-500 text-emerald-300 text-xs px-3 py-2 rounded-md shadow-lg backdrop-blur-sm flex items-center gap-2 pointer-events-none animate-pulse">
          {searchLoading && <Loader2 className="w-3.5 h-3.5 animate-spin text-emerald-400" />}
          <span>{locationStatus}</span>
        </div>
      )}
    </div>
  );
}
