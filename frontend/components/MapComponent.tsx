"use client";

import { useState, useEffect } from "react";
import { MapContainer, TileLayer, Polygon, Marker, Circle, Popup, useMapEvents, useMap } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { Search, Loader2, Navigation, MapPin, Layers, AlertTriangle } from "lucide-react";
import { isPointInPolygon } from "@/lib/spatialUtils";

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

// Custom GPS Location Pin (Blue)
const gpsIcon = L.divIcon({
  html: `<div class="relative flex items-center justify-center w-8 h-8">
    <div class="absolute w-8 h-8 bg-blue-500/40 rounded-full animate-ping"></div>
    <div class="relative w-6 h-6 bg-blue-600 border-2 border-white text-white rounded-full flex items-center justify-center text-xs font-bold shadow-lg">📍</div>
  </div>`,
  className: "",
  iconSize: [32, 32],
  iconAnchor: [16, 16],
});

// Custom Land Reference Center Pin (Red Pin)
const centerPinIcon = L.divIcon({
  html: `<div class="relative flex items-center justify-center w-9 h-9">
    <div class="relative w-7 h-7 bg-red-600 border-2 border-white text-white rounded-full flex items-center justify-center text-sm font-bold shadow-xl animate-bounce">📌</div>
  </div>`,
  className: "",
  iconSize: [36, 36],
  iconAnchor: [18, 18],
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
}

interface MapComponentProps {
  points: [number, number][];
  setPoints: (points: [number, number][]) => void;
  existingFarms: Farm[];
  onLocationSelect?: (location: { state: string; district: string; taluka: string; village: string }) => void;
  targetLocationQuery?: string;
  targetCoordinates?: { lat: number; lng: number; zoom?: number } | null;
  // GPS Location props
  gpsLocation: { lat: number; lng: number; accuracy: number | null } | null;
  setGpsLocation: (loc: { lat: number; lng: number; accuracy: number | null } | null) => void;
  // Land Center Pin props
  landCenterPin: [number, number] | null;
  setLandCenterPin: (pin: [number, number] | null) => void;
  isMarkPinMode: boolean;
  setIsMarkPinMode: (active: boolean) => void;
  // Overlap Detection Props
  overlappingFarmIds?: number[];
  overlapType?: "NONE" | "PARTIAL" | "SIGNIFICANT";
  currentStep?: number;
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
  gpsLocation,
  setGpsLocation,
  landCenterPin,
  setLandCenterPin,
  isMarkPinMode,
  setIsMarkPinMode,
  overlappingFarmIds = [],
  overlapType = "NONE",
  currentStep = 1,
}: MapComponentProps) {
  const [mapCenter] = useState<[number, number]>([28.6139, 77.2090]); // Default New Delhi
  const [searchQuery, setSearchQuery] = useState("");
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchMarker, setSearchMarker] = useState<[number, number] | null>(null);
  const [centerOverride, setCenterOverride] = useState<[number, number] | null>(null);
  const [zoomOverride, setZoomOverride] = useState<number>(16);
  const [locationStatus, setLocationStatus] = useState<string | null>(null);
  const [gpsLoading, setGpsLoading] = useState(false);
  const [gpsError, setGpsError] = useState<string | null>(null);

  // Instant navigation when exact targetCoordinates are provided
  useEffect(() => {
    if (targetCoordinates && targetCoordinates.lat && targetCoordinates.lng) {
      const coords: [number, number] = [targetCoordinates.lat, targetCoordinates.lng];
      setCenterOverride(coords);
      setZoomOverride(targetCoordinates.zoom || 16);
      setLocationStatus(`Map centered on selected location`);
    }
  }, [targetCoordinates]);

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
            setZoomOverride(16);
            setLocationStatus(`Centered on ${data[0].display_name.split(",")[0]}`);
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

  // GPS Location Trigger
  const handleUseMyLocation = () => {
    setGpsLoading(true);
    setGpsError(null);
    setLocationStatus("Requesting browser GPS position...");

    if (!navigator.geolocation) {
      setGpsError("Geolocation is not supported by your browser.");
      setGpsLoading(false);
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const { latitude, longitude, accuracy } = pos.coords;
        const coords: [number, number] = [latitude, longitude];
        setGpsLocation({ lat: latitude, lng: longitude, accuracy: Math.round(accuracy) });
        setCenterOverride(coords);
        setZoomOverride(17);
        setGpsLoading(false);
        setLocationStatus(`GPS Captured (Accuracy: ${Math.round(accuracy)}m)`);
        reverseGeocode(latitude, longitude, onLocationSelect);
      },
      (err) => {
        setGpsLoading(false);
        let errMsg = "Unable to retrieve GPS location.";
        if (err.code === err.PERMISSION_DENIED) {
          errMsg = "GPS permission denied by user. Please allow location access in your browser settings.";
        } else if (err.code === err.POSITION_UNAVAILABLE) {
          errMsg = "GPS position unavailable. Please ensure location services are enabled.";
        } else if (err.code === err.TIMEOUT) {
          errMsg = "GPS request timed out. Please try again.";
        }
        setGpsError(errMsg);
        setLocationStatus(errMsg);
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    );
  };

  // Map Click Handler for vertices vs Land Pin
  function MapEvents() {
    useMapEvents({
      click(e) {
        const { lat, lng } = e.latlng;
        if (isMarkPinMode) {
          setLandCenterPin([lat, lng]);
          setIsMarkPinMode(false); // Turn off pin mode after placing
          setLocationStatus(`Land Reference Pin placed inside field`);
        } else {
          setPoints([...points, [lat, lng]]);
          reverseGeocode(lat, lng, onLocationSelect);
        }
      },
    });
    return null;
  }

  // Component to dynamically pan the map to coordinates
  function MapController({ center, zoom }: { center: [number, number] | null; zoom: number }) {
    const map = useMap();
    useEffect(() => {
      if (center) {
        map.flyTo(center, zoom || 16, { animate: true, duration: 1.0 });
      }
    }, [center, zoom, map]);
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
          if (
            coords[0][0] === coords[coords.length - 1][0] &&
            coords[0][1] === coords[coords.length - 1][1]
          ) {
            coords.pop();
          }
          setPoints(coords);
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

  const isPinInside = landCenterPin && points.length >= 3 ? isPointInPolygon(landCenterPin, points) : true;

  return (
    <div className="relative w-full h-[480px] rounded-lg overflow-hidden border border-emerald-800 shadow-xl flex flex-col">
      {/* Top Banner Guide */}
      <div className="bg-[#0a1f0a] border-b border-emerald-800/80 px-4 py-2 flex items-center justify-between z-10 text-xs text-[#e2ebd5]">
        <div className="flex items-center gap-2">
          {isMarkPinMode ? (
            <span className="flex items-center gap-1 text-amber-300 font-medium animate-pulse">
              <MapPin className="w-4 h-4 text-amber-400" />
              Click anywhere on your field to place the Land Reference Pin.
            </span>
          ) : points.length === 0 ? (
            <span className="flex items-center gap-1 text-emerald-300">
              💡 Zoom in until field boundaries are clearly visible. Click to trace your field boundary.
            </span>
          ) : (
            <span className="flex items-center gap-1 text-emerald-300">
              ✨ Point {points.length} added. Click more points or click a vertex to remove it.
            </span>
          )}
        </div>
        {points.length > 0 && !isPinInside && (
          <span className="px-2 py-0.5 bg-red-950/80 border border-red-500 text-red-300 rounded font-semibold text-[11px]">
            ⚠️ Center Pin must be inside polygon
          </span>
        )}
      </div>

      <div className="relative flex-1 w-full">
        <MapContainer center={mapCenter} zoom={6} className="w-full h-full">
          {/* Esri World Imagery (Satellite Base Layer) */}
          <TileLayer
            url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
            attribution="&copy; Esri &mdash; Source: Esri, USDA, USGS, AEX, GeoEye, Getmapping, Aerogrid, IGN, IGP, and GIS User Community"
          />

          <MapController center={centerOverride} zoom={zoomOverride} />
          <MapEvents />

          {/* Render User GPS Location Marker */}
          {gpsLocation && (
            <>
              <Marker position={[gpsLocation.lat, gpsLocation.lng]} icon={gpsIcon}>
                <Popup>
                  <div className="text-xs font-sans">
                    <p className="font-bold text-blue-700">📍 Your GPS Location</p>
                    <p>Lat: {gpsLocation.lat.toFixed(6)}</p>
                    <p>Lng: {gpsLocation.lng.toFixed(6)}</p>
                    {gpsLocation.accuracy && <p>Accuracy: ±{gpsLocation.accuracy} meters</p>}
                  </div>
                </Popup>
              </Marker>
              {gpsLocation.accuracy && (
                <Circle
                  center={[gpsLocation.lat, gpsLocation.lng]}
                  radius={gpsLocation.accuracy}
                  pathOptions={{ color: "#3b82f6", fillColor: "#3b82f6", fillOpacity: 0.1, weight: 1.5 }}
                />
              )}
            </>
          )}

          {/* Render Land Reference Center Pin */}
          {landCenterPin && (
            <Marker
              position={landCenterPin}
              icon={centerPinIcon}
              draggable={true}
              eventHandlers={{
                dragend: (e) => {
                  const marker = e.target;
                  const pos = marker.getLatLng();
                  setLandCenterPin([pos.lat, pos.lng]);
                },
              }}
            >
              <Popup>
                <div className="text-xs font-sans">
                  <p className="font-bold text-red-700">📌 Land Reference Pin</p>
                  <p>Center point of insured land</p>
                  <p className="text-[10px] text-gray-500">Drag to reposition pin</p>
                </div>
              </Popup>
            </Marker>
          )}

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
                  pathOptions={{
                    color: overlapType === "SIGNIFICANT" ? "#ef4444" : overlapType === "PARTIAL" ? "#f59e0b" : "#22c55e",
                    fillColor: overlapType === "SIGNIFICANT" ? "#ef4444" : overlapType === "PARTIAL" ? "#f59e0b" : "#22c55e",
                    fillOpacity: 0.35,
                    dashArray: overlapType !== "NONE" ? "6, 6" : undefined,
                  }}
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
                  setPoints([...points, searchMarker]);
                },
              }}
            />
          )}

          {/* Render already registered farms */}
          {existingFarms.map((farm) => {
            if (!farm.boundary?.coordinates?.[0]) return null;
            const positions = farm.boundary.coordinates[0].map((c) => [c[1], c[0]]) as [number, number][];
            const isOverlapping = overlappingFarmIds.includes(farm.id);

            return (
              <Polygon
                key={`farm-poly-${farm.id}`}
                positions={positions}
                pathOptions={{
                  color: isOverlapping ? "#ef4444" : "#3b82f6",
                  fillColor: isOverlapping ? "#ef4444" : "#3b82f6",
                  fillOpacity: isOverlapping ? 0.4 : 0.15,
                  weight: isOverlapping ? 2.5 : 1.5,
                }}
              />
            );
          })}
        </MapContainer>

        {/* Search Bar Overlay */}
        <div className="absolute top-3 left-3 z-[1000] w-64">
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
              {searchLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Search className="h-3.5 w-3.5" />}
            </button>
          </form>
        </div>

        {/* Primary Map Workflow Controls */}
        <div className="absolute top-3 right-3 z-[1000] flex flex-col gap-2">
          {/* GPS Button */}
          <button
            type="button"
            onClick={handleUseMyLocation}
            disabled={gpsLoading}
            className="flex items-center justify-center gap-1.5 px-3 py-1.5 bg-blue-900/90 hover:bg-blue-800 text-blue-100 border border-blue-600 text-xs font-semibold rounded-md transition shadow-lg backdrop-blur-sm"
          >
            {gpsLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Navigation className="w-3.5 h-3.5 text-blue-300" />}
            <span>📍 Use My Location</span>
          </button>

          {/* Mark My Land Button */}
          <button
            type="button"
            onClick={() => setIsMarkPinMode(!isMarkPinMode)}
            className={`flex items-center justify-center gap-1.5 px-3 py-1.5 border text-xs font-semibold rounded-md transition shadow-lg backdrop-blur-sm ${
              isMarkPinMode
                ? "bg-amber-600 text-white border-amber-400 animate-pulse"
                : landCenterPin
                ? "bg-[#133513] hover:bg-[#1b4f1b] text-emerald-200 border-emerald-600"
                : "bg-red-950/90 hover:bg-red-900 text-red-200 border-red-700"
            }`}
          >
            <MapPin className="w-3.5 h-3.5" />
            <span>{isMarkPinMode ? "Click Map to Place Pin" : landCenterPin ? "📌 Reposition Land Pin" : "📌 Mark My Land"}</span>
          </button>

          {/* Import GeoJSON */}
          <label className="flex items-center justify-center px-3 py-1.5 bg-[#133513] hover:bg-[#1b4f1b] text-[#e2ebd5] border border-emerald-700 text-xs font-medium rounded-md cursor-pointer transition shadow-md">
            <span>📁 Import GeoJSON</span>
            <input type="file" accept=".geojson,.json" onChange={handleGeoJSONImport} className="hidden" />
          </label>

          {/* Clear Polygon */}
          {points.length > 0 && (
            <button
              type="button"
              onClick={() => setPoints([])}
              className="px-3 py-1.5 bg-red-950/90 hover:bg-red-900 text-red-200 border border-red-800 text-xs font-medium rounded-md transition shadow-md"
            >
              🗑️ Clear Vertices
            </button>
          )}
        </div>

        {/* Map Legend Overlay */}
        <div className="absolute bottom-3 left-3 z-[1000] bg-[#0a1f0a]/95 border border-emerald-800 px-3 py-2 rounded-md text-[11px] text-[#e2ebd5] shadow-lg backdrop-blur-sm flex flex-col gap-1 max-w-[220px]">
          <div className="font-semibold text-emerald-400 text-xs flex items-center gap-1 border-b border-emerald-800/80 pb-1">
            <Layers className="w-3.5 h-3.5" /> Map Legend
          </div>
          <div className="flex items-center gap-2">
            <span className="text-blue-400 font-bold">📍</span> GPS Location Marker
          </div>
          <div className="flex items-center gap-2">
            <span className="text-red-500 font-bold">📌</span> Land Reference Pin
          </div>
          <div className="flex items-center gap-2">
            <span className="w-3 h-3 bg-emerald-500/40 border border-emerald-400 rounded-sm"></span> Selected Farm Boundary
          </div>
          <div className="flex items-center gap-2">
            <span className="w-3 h-3 bg-blue-500/30 border border-blue-400 rounded-sm"></span> Registered Farm
          </div>
          <div className="flex items-center gap-2">
            <span className="w-3 h-3 bg-red-500/40 border border-red-400 rounded-sm"></span> Overlapping Boundary
          </div>
        </div>

        {/* Status Alert Overlay */}
        {locationStatus && (
          <div className="absolute bottom-3 right-3 z-[1000] bg-[#0a1f0a]/95 border border-emerald-500 text-emerald-300 text-xs px-3 py-2 rounded-md shadow-lg backdrop-blur-sm flex items-center gap-2 pointer-events-none">
            {searchLoading && <Loader2 className="w-3.5 h-3.5 animate-spin text-emerald-400" />}
            <span>{locationStatus}</span>
          </div>
        )}
      </div>
    </div>
  );
}
