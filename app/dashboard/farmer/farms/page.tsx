"use client";

import { useState, useEffect } from "react";
import dynamic from "next/dynamic";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { motion, AnimatePresence } from "framer-motion";
import { QueryClient, QueryClientProvider, useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { LandPlot, PlusCircle, Trash2, CheckCircle2, Box, Eye, X, HelpCircle, Layers, Globe } from "lucide-react";
import { Farm } from "@/components/MapComponent";
import { HoloCard } from "@/components/ui/HoloCard";
import FarmTerrain3D from "@/components/maps/FarmTerrain3D";
import FeatureCube3D from "@/components/features/FeatureCube3D";

// Dynamically import Leaflet MapComponent to disable Server-Side Rendering (SSR)
const MapComponent = dynamic(() => import("@/components/MapComponent"), {
  ssr: false,
  loading: () => (
    <div className="w-full h-[450px] bg-slate-100 animate-pulse border border-emerald-800 rounded-lg flex items-center justify-center">
      <span className="text-[#166534] font-medium">Loading Satellite Map...</span>
    </div>
  ),
});

// Create TanStack Query Client
const queryClient = new QueryClient();

// Zod Validation Schema
const farmSchema = z.object({
  name: z.string().min(2, "Farm name must be at least 2 characters"),
  crop_type: z.enum(["Rice", "Wheat", "Cotton", "Sugarcane", "Maize", "Mustard", "Soybeans"]),
  sowing_date: z.string().min(1, "Sowing date is required"),
  insurance_policy_number: z.string().min(5, "Insurance policy is required"),
  khasra_number: z.string().min(1, "Khasra number is required"),
  state: z.string().min(2, "State is required"),
  district: z.string().min(2, "District is required"),
  taluka: z.string().min(2, "Taluka is required"),
  village: z.string().min(2, "Village is required"),
});

type FarmFormData = z.infer<typeof farmSchema>;

function calculatePolygonAreaHectares(coords: [number, number][]): number {
  if (coords.length < 3) return 0;
  
  const meanLat = coords.reduce((sum, c) => sum + c[0], 0) / coords.length;
  const meanLatRad = (meanLat * Math.PI) / 180;
  
  let area = 0;
  for (let i = 0; i < coords.length; i++) {
    const p1 = coords[i];
    const p2 = coords[(i + 1) % coords.length];
    
    const x1 = p1[1] * 111132 * Math.cos(meanLatRad);
    const y1 = p1[0] * 111132;
    const x2 = p2[1] * 111132 * Math.cos(meanLatRad);
    const y2 = p2[0] * 111132;
    
    area += x1 * y2 - x2 * y1;
  }
  
  return Math.abs(area / 2) / 10000; // in Hectares
}

// Subcomponent to encapsulate Query Provider
function DashboardContent() {
  const queryClientRef = useQueryClient();
  const [points, setPoints] = useState<[number, number][]>([]);
  const [calculatedArea, setCalculatedArea] = useState<number>(0);
  const [localFarms, setLocalFarms] = useState<Farm[]>([]);

  // 3D Visualizer States
  const [hasWebGL, setHasWebGL] = useState(true);
  const [selectedFarm3D, setSelectedFarm3D] = useState<Farm | null>(null);
  const [is3DModalOpen, setIs3DModalOpen] = useState(false);
  const [modalTab, setModalTab] = useState<"terrain" | "cube" | "compare">("terrain");

  // WebGL support check
  useEffect(() => {
    try {
      const canvas = document.createElement("canvas");
      setHasWebGL(
        !!(window.WebGLRenderingContext && 
          (canvas.getContext("webgl") || canvas.getContext("experimental-webgl")))
      );
    } catch (e) {
      setHasWebGL(false);
    }
  }, []);

  // React Hook Form Configuration
  const {
    register,
    handleSubmit,
    reset,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<FarmFormData>({
    resolver: zodResolver(farmSchema),
    defaultValues: {
      state: "Haryana",
      district: "Karnal",
      taluka: "Gharaunda",
      village: "Basdhara",
    },
  });

  const handleLocationSelect = (loc: { state: string; district: string; taluka: string; village: string }) => {
    if (loc.state) setValue("state", loc.state, { shouldValidate: true });
    if (loc.district) setValue("district", loc.district, { shouldValidate: true });
    if (loc.taluka) setValue("taluka", loc.taluka, { shouldValidate: true });
    if (loc.village) setValue("village", loc.village, { shouldValidate: true });
  };

  // Automatically update area field when polygon points change
  useEffect(() => {
    const area = calculatePolygonAreaHectares(points);
    setCalculatedArea(area);
  }, [points]);

  // Load local mock farms on mount
  useEffect(() => {
    const cached = localStorage.getItem("agrisense_cached_farms");
    if (cached) {
      setLocalFarms(JSON.parse(cached));
    } else {
      const initialSeed: Farm[] = [
        {
          id: 1,
          name: "Basdhara Paddy Fields",
          crop_type: "Rice",
          sowing_date: "2026-06-15",
          area_hectares: 4.82,
          insurance_policy_number: "INS-772819",
          khasra_number: "223/4",
          state: "Haryana",
          district: "Karnal",
          taluka: "Gharaunda",
          village: "Basdhara",
          boundary: {
            type: "Polygon",
            coordinates: [
              [
                [76.96, 29.54],
                [76.98, 29.54],
                [76.98, 29.56],
                [76.96, 29.56],
                [76.96, 29.54]
              ]
            ]
          }
        }
      ];
      setLocalFarms(initialSeed);
      localStorage.setItem("agrisense_cached_farms", JSON.stringify(initialSeed));
    }
  }, []);

  // Fetch Farms Query
  const { data: dbFarms = [] } = useQuery<Farm[]>({
    queryKey: ["farms"],
    queryFn: async () => {
      try {
        const res = await fetch("http://localhost:8000/api/v1/farms/");
        if (!res.ok) throw new Error("API Offline");
        return await res.json();
      } catch (err) {
        console.warn("FastAPI backend offline; reading cached farms from local storage. Error:", err);
        const cached = localStorage.getItem("agrisense_cached_farms");
        return cached ? JSON.parse(cached) : [];
      }
    },
  });

  const farmsList = dbFarms.length > 0 ? dbFarms : localFarms;

  // Fetch NDVI data query for selected farm in 3D modal
  const { data: ndviTimeseries = null } = useQuery({
    queryKey: ["ndvi_timeseries", selectedFarm3D?.id],
    queryFn: async () => {
      if (!selectedFarm3D) return null;
      try {
        const res = await fetch(`http://localhost:8000/api/v1/features/${selectedFarm3D.id}/timeseries`);
        if (!res.ok) throw new Error("Timeseries API offline");
        return await res.json();
      } catch (err) {
        console.warn("FastAPI offline; using client-side simulated NDVI. Error:", err);
        return null;
      }
    },
    enabled: !!selectedFarm3D,
  });

  // Add Farm Mutation
  const addFarmMutation = useMutation({
    mutationFn: async (newFarm: Omit<Farm, "id">) => {
      try {
        const res = await fetch("http://localhost:8000/api/v1/farms/", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(newFarm),
        });
        if (!res.ok) throw new Error("API Failure");
        return await res.json();
      } catch (err) {
        console.warn("FastAPI backend offline; saving registered farm locally. Error:", err);
        const mockResponse: Farm = {
          id: Date.now(),
          name: newFarm.name,
          crop_type: newFarm.crop_type,
          sowing_date: newFarm.sowing_date,
          area_hectares: calculatePolygonAreaHectares(
            newFarm.boundary.coordinates[0].map((c) => [c[1], c[0]])
          ),
          insurance_policy_number: newFarm.insurance_policy_number,
          khasra_number: newFarm.khasra_number,
          state: newFarm.state,
          district: newFarm.district,
          taluka: newFarm.taluka,
          village: newFarm.village,
          boundary: newFarm.boundary,
        };
        const updated = [...localFarms, mockResponse];
        setLocalFarms(updated);
        localStorage.setItem("agrisense_cached_farms", JSON.stringify(updated));
        return mockResponse;
      }
    },
    onSuccess: (savedFarm) => {
      queryClientRef.invalidateQueries({ queryKey: ["farms"] });
      reset();
      setPoints([]);
      // Instantly open the newly saved farm in 3D terrain viewer to wow the farmer
      if (hasWebGL) {
        setSelectedFarm3D(savedFarm);
        setModalTab("terrain");
        setIs3DModalOpen(true);
      }
    },
  });

  // Delete Farm Mutation (Soft Delete)
  const deleteFarmMutation = useMutation({
    mutationFn: async (farmId: number) => {
      try {
        const res = await fetch(`http://localhost:8000/api/v1/farms/${farmId}`, {
          method: "DELETE",
        });
        if (!res.ok) throw new Error("API Failure");
      } catch (err) {
        console.warn("FastAPI backend offline; deleting farm locally. Error:", err);
        const updated = localFarms.filter((f) => f.id !== farmId);
        setLocalFarms(updated);
        localStorage.setItem("agrisense_cached_farms", JSON.stringify(updated));
      }
    },
    onSuccess: () => {
      queryClientRef.invalidateQueries({ queryKey: ["farms"] });
    },
  });

  const onSubmit = (formData: FarmFormData) => {
    if (points.length < 3) {
      alert("Please draw or import a boundary polygon with at least 3 points on the map.");
      return;
    }

    const closedCoords = [...points.map((p) => [p[1], p[0]]), [points[0][1], points[0][0]]];
    
    const payload: Omit<Farm, "id"> = {
      name: formData.name,
      crop_type: formData.crop_type,
      sowing_date: formData.sowing_date,
      area_hectares: calculatedArea,
      insurance_policy_number: formData.insurance_policy_number,
      khasra_number: formData.khasra_number,
      state: formData.state,
      district: formData.district,
      taluka: formData.taluka,
      village: formData.village,
      boundary: {
        type: "Polygon",
        coordinates: [closedCoords],
      },
    };

    addFarmMutation.mutate(payload);
  };

  const openFarm3D = (farm: Farm, tab: "terrain" | "cube" | "compare" = "terrain") => {
    setSelectedFarm3D(farm);
    setModalTab(tab);
    setIs3DModalOpen(true);
  };

  return (
    <div className="min-h-screen bg-[#F8FAFC] text-slate-800 p-6 font-sans">
      {/* Title Header */}
      <header className="mb-8 flex items-center justify-between border-b border-slate-200 pb-4">
        <div className="flex items-center gap-3">
          <LandPlot className="h-8 w-8 text-[#166534]" />
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-slate-800">Farm Polygon Ingestion & 3D Analytics</h1>
            <p className="text-xs text-[#166534]">Register land boundaries, view dynamic 3D extruded terrain and crop feature cubes.</p>
          </div>
        </div>
      </header>

      {/* Main Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Registration Form Panel */}
        <div className="lg:col-span-1 bg-white border border-slate-200 p-5 rounded-2xl shadow-xl flex flex-col gap-4">
          <h2 className="text-base font-bold text-slate-800 mb-2 flex items-center gap-2">
            <PlusCircle className="h-5 w-5 text-[#166534]" />
            Register New Farm
          </h2>

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-3.5">
            <div>
              <label className="block text-[10px] font-bold uppercase tracking-wider text-[#166534] mb-1">
                Farm Name
              </label>
              <input
                type="text"
                placeholder="e.g. Basdhara Fields"
                {...register("name")}
                className="w-full bg-white border border-slate-300 rounded-md px-3 py-1.5 text-xs text-slate-800 focus:outline-none focus:border-[#22c55e]"
              />
              {errors.name && <p className="text-[10px] text-red-400 mt-0.5">{errors.name.message}</p>}
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-[10px] font-bold uppercase tracking-wider text-[#166534] mb-1">
                  Crop Type
                </label>
                <select
                  {...register("crop_type")}
                  className="w-full bg-white border border-slate-300 rounded-md px-2.5 py-1.5 text-xs text-slate-800 focus:outline-none focus:border-[#22c55e]"
                >
                  <option value="">Select Crop</option>
                  <option value="Rice">Rice</option>
                  <option value="Wheat">Wheat</option>
                  <option value="Cotton">Cotton</option>
                  <option value="Sugarcane">Sugarcane</option>
                  <option value="Maize">Maize</option>
                  <option value="Mustard">Mustard</option>
                  <option value="Soybeans">Soybeans</option>
                </select>
                {errors.crop_type && <p className="text-[10px] text-red-400 mt-0.5">{errors.crop_type.message}</p>}
              </div>

              <div>
                <label className="block text-[10px] font-bold uppercase tracking-wider text-[#166534] mb-1">
                  Sowing Date
                </label>
                <input
                  type="date"
                  {...register("sowing_date")}
                  className="w-full bg-white border border-slate-300 rounded-md px-2 py-1.5 text-xs text-slate-800 focus:outline-none focus:border-[#22c55e]"
                />
                {errors.sowing_date && <p className="text-[10px] text-red-400 mt-0.5">{errors.sowing_date.message}</p>}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-[10px] font-bold uppercase tracking-wider text-[#166534] mb-1">
                  Khasra Number (Land Record ID)
                </label>
                <input
                  type="text"
                  placeholder="e.g. 104/12"
                  {...register("khasra_number")}
                  className="w-full bg-white border border-slate-300 rounded-md px-3 py-1.5 text-xs text-slate-800 focus:outline-none focus:border-[#22c55e]"
                />
                {errors.khasra_number && <p className="text-[10px] text-red-400 mt-0.5">{errors.khasra_number.message}</p>}
              </div>

              <div>
                <label className="block text-[10px] font-bold uppercase tracking-wider text-[#166534] mb-1">
                  Insurance Policy No.
                </label>
                <input
                  type="text"
                  placeholder="e.g. INS-992812"
                  {...register("insurance_policy_number")}
                  className="w-full bg-white border border-slate-300 rounded-md px-3 py-1.5 text-xs text-slate-800 focus:outline-none focus:border-[#22c55e]"
                />
                {errors.insurance_policy_number && (
                  <p className="text-[10px] text-red-400 mt-0.5">{errors.insurance_policy_number.message}</p>
                )}
              </div>
            </div>

            {/* Geographical details */}
            <div className="grid grid-cols-2 gap-2 bg-white/50 p-2.5 rounded-lg border border-emerald-800/40">
              <div>
                <label className="block text-[9px] font-semibold uppercase text-[#166534] mb-0.5">State</label>
                <input type="text" {...register("state")} className="w-full bg-[#030903] border border-slate-200 rounded px-2 py-0.5 text-[10px]" />
              </div>
              <div>
                <label className="block text-[9px] font-semibold uppercase text-[#166534] mb-0.5">District</label>
                <input type="text" {...register("district")} className="w-full bg-[#030903] border border-slate-200 rounded px-2 py-0.5 text-[10px]" />
              </div>
              <div>
                <label className="block text-[9px] font-semibold uppercase text-[#166534] mb-0.5">Taluka</label>
                <input type="text" {...register("taluka")} className="w-full bg-[#030903] border border-slate-200 rounded px-2 py-0.5 text-[10px]" />
              </div>
              <div>
                <label className="block text-[9px] font-semibold uppercase text-[#166534] mb-0.5">Village</label>
                <input type="text" {...register("village")} className="w-full bg-[#030903] border border-slate-200 rounded px-2 py-0.5 text-[10px]" />
              </div>
            </div>

            {/* Area Display */}
            <div className="bg-[#1b4f1b]/20 border border-emerald-800/50 p-3 rounded-lg flex items-center justify-between">
              <div>
                <p className="text-[10px] text-[#166534] font-medium">Calculated Area</p>
                <p className="text-base font-bold text-slate-800 mt-0.5">
                  {calculatedArea.toFixed(2)} Hectares
                </p>
              </div>
              <LandPlot className="h-6 w-6 text-[#166534] opacity-75" />
            </div>

            {/* Submission Button */}
            <button
              type="submit"
              disabled={isSubmitting || addFarmMutation.isPending}
              className="w-full flex items-center justify-center gap-2 bg-[#22c55e] hover:bg-emerald-500 disabled:bg-emerald-800 text-black font-bold py-2 px-4 rounded-md text-xs transition shadow cursor-pointer"
            >
              {addFarmMutation.isPending ? "Saving..." : "Save Farm Boundary"}
            </button>
          </form>

          {/* Real-time 3D Preview Panel */}
          <div className="border-t border-emerald-800/40 pt-4 mt-2">
            {hasWebGL ? (
              <>
                {points.length >= 3 ? (
                  <div className="flex flex-col gap-1.5">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-[#166534]">Live 3D Terrain Preview</span>
                    <FarmTerrain3D points={points} livePreview={true} />
                  </div>
                ) : (
                  <div className="border border-dashed border-emerald-800/40 rounded-xl p-4 flex flex-col items-center justify-center bg-white/40 text-center">
                    <Box className="w-6 h-6 text-emerald-600 mb-1.5 animate-pulse" />
                    <span className="text-[9px] leading-relaxed text-emerald-600/90 max-w-[200px]">
                      Live 3D terrain preview will render here automatically as you click to map vertices (min 3 points).
                    </span>
                  </div>
                )}
              </>
            ) : (
              <div className="p-3 bg-red-950/20 border border-red-900/40 rounded-xl text-center text-[10px] text-red-400">
                ⚠️ WebGL not supported on this device. 3D features are disabled.
              </div>
            )}
          </div>
        </div>

        {/* Map Ingestion Panel */}
        <div className="lg:col-span-2 flex flex-col gap-6">
          <div className="bg-white border border-slate-200 p-5 rounded-2xl shadow-xl">
            <h2 className="text-base font-bold text-slate-800 mb-3 flex items-center gap-2">
              <LandPlot className="h-5 w-5 text-[#166534]" />
              Boundary Mapping View (Esri Satellite Base Layer)
            </h2>
            <MapComponent points={points} setPoints={setPoints} existingFarms={farmsList} onLocationSelect={handleLocationSelect} />
          </div>

          {/* List of Registered Farms using HoloCards */}
          <div className="bg-white border border-slate-200 p-5 rounded-2xl shadow-xl">
            <h2 className="text-base font-bold text-slate-800 mb-4 flex items-center gap-2">
              <CheckCircle2 className="h-5 w-5 text-[#166534]" />
              Registered Farm Boundaries ({farmsList.length})
            </h2>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-h-[400px] overflow-y-auto pr-2 scrollbar-thin scrollbar-thumb-emerald-800">
              <AnimatePresence>
                {farmsList.map((farm) => (
                  <motion.div
                    key={`list-farm-${farm.id}`}
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.9 }}
                  >
                    <HoloCard
                      className="border border-slate-200/60 hover:border-emerald-500/50 p-4 rounded-xl flex flex-col justify-between h-40 bg-[#071707]/60"
                      title={farm.name}
                    >
                      <div className="text-[10px] text-[#166534] space-y-1">
                        <p>Crop: <b className="text-slate-200">{farm.crop_type}</b></p>
                        <p>📐 Area: <b className="text-slate-200">{farm.area_hectares} ha</b></p>
                        <p>📄 Khasra: <b className="text-slate-200">{farm.khasra_number}</b></p>
                        <p>📍 Village: <b className="text-slate-200">{farm.village}, {farm.district}</b></p>
                      </div>

                      <div className="flex gap-2 justify-between items-center mt-3 border-t border-slate-200/40 pt-2">
                        {hasWebGL ? (
                          <div className="flex gap-1.5">
                            <button
                              onClick={() => openFarm3D(farm, "terrain")}
                              className="flex items-center gap-1 py-1 px-2.5 rounded bg-[#166534]/10 hover:bg-emerald-500 text-[#166534] hover:text-black font-semibold text-[9px] uppercase tracking-wider transition-all"
                            >
                              <Box className="w-3 h-3" /> 3D View
                            </button>
                            <button
                              onClick={() => openFarm3D(farm, "compare")}
                              className="flex items-center gap-1 py-1 px-2 rounded bg-blue-500/10 hover:bg-blue-500 text-blue-400 hover:text-slate-800 font-semibold text-[9px] uppercase tracking-wider transition-all"
                            >
                              <Layers className="w-3 h-3" /> Compare
                            </button>
                          </div>
                        ) : (
                          <span className="text-[9px] text-slate-500 italic">2D view only</span>
                        )}

                        <button
                          onClick={() => deleteFarmMutation.mutate(farm.id)}
                          className="p-1 text-red-400 hover:text-slate-800 hover:bg-red-950/80 rounded transition"
                          title="Delete Farm"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </HoloCard>
                  </motion.div>
                ))}
                {farmsList.length === 0 && (
                  <div className="col-span-2 py-8 text-center text-xs text-emerald-600">
                    No registered farm boundaries found. Use the map and form to register a new farm.
                  </div>
                )}
              </AnimatePresence>
            </div>
          </div>
        </div>

      </div>

      {/* 3D Visualizer Modal Overlay */}
      <AnimatePresence>
        {is3DModalOpen && selectedFarm3D && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 p-4 md:p-6 backdrop-blur-sm overflow-y-auto"
          >
            <motion.div
              initial={{ scale: 0.95, y: 15 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.95, y: 15 }}
              className="bg-white border border-slate-200 text-slate-800 border border-emerald-500/30 rounded-2xl w-full max-w-5xl overflow-hidden shadow-2xl flex flex-col"
            >
              
              {/* Modal Header */}
              <div className="p-4 bg-slate-900 border-b border-slate-200 flex justify-between items-center">
                <div>
                  <h2 className="text-base font-bold text-slate-800 flex items-center gap-2">
                    <Globe className="w-5 h-5 text-[#166534] animate-spin-slow" />
                    3D Spatial Intelligence Viewer &mdash; {selectedFarm3D.name}
                  </h2>
                  <p className="text-[10px] text-slate-400 mt-0.5">
                    Taluka: {selectedFarm3D.taluka} • Area: {selectedFarm3D.area_hectares} Ha • Khasra: {selectedFarm3D.khasra_number}
                  </p>
                </div>
                <button
                  onClick={() => setIs3DModalOpen(false)}
                  className="p-1.5 rounded-full hover:bg-white/10 text-slate-400 hover:text-slate-800 transition"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Tab Selector */}
              <div className="flex bg-white border border-slate-200 shadow-sm text-slate-800 border-b border-slate-100 p-1 gap-1">
                <button
                  onClick={() => setModalTab("terrain")}
                  className={`py-1.5 px-4 rounded-lg font-semibold text-xs tracking-wide transition-all uppercase ${
                    modalTab === "terrain" ? "bg-emerald-500 text-black shadow" : "text-slate-400 hover:text-slate-800 hover:bg-white/5"
                  }`}
                >
                  3D Terrain Extrusion
                </button>
                <button
                  onClick={() => setModalTab("cube")}
                  className={`py-1.5 px-4 rounded-lg font-semibold text-xs tracking-wide transition-all uppercase ${
                    modalTab === "cube" ? "bg-emerald-500 text-black shadow" : "text-slate-400 hover:text-slate-800 hover:bg-white/5"
                  }`}
                >
                  3D Feature Cube (R3F)
                </button>
                <button
                  onClick={() => setModalTab("compare")}
                  className={`py-1.5 px-4 rounded-lg font-semibold text-xs tracking-wide transition-all uppercase ${
                    modalTab === "compare" ? "bg-emerald-500 text-black shadow" : "text-slate-400 hover:text-slate-800 hover:bg-white/5"
                  }`}
                >
                  Side-By-Side Compare
                </button>
              </div>

              {/* Modal Body */}
              <div className="p-4 bg-[#020617] flex-grow">
                {modalTab === "terrain" && (
                  <FarmTerrain3D geojson={selectedFarm3D.boundary} ndviData={ndviTimeseries} />
                )}
                {modalTab === "cube" && (
                  <FeatureCube3D farmName={selectedFarm3D.name} farmGeoJSON={selectedFarm3D.boundary} ndviData={ndviTimeseries} />
                )}
                {modalTab === "compare" && (
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                    {/* Left side: 2D Leaflet map */}
                    <div className="bg-slate-100/20 border border-slate-200/50 p-4 rounded-xl flex flex-col gap-2">
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Left: 2D Satellite View</span>
                      <div className="h-[360px] rounded-lg overflow-hidden border border-emerald-800/40">
                        <MapComponent
                          points={[]}
                          setPoints={() => {}}
                          existingFarms={[selectedFarm3D]}
                        />
                      </div>
                    </div>

                    {/* Right side: 3D Terrain */}
                    <div className="bg-slate-100/20 border border-slate-200/50 p-4 rounded-xl flex flex-col gap-2">
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Right: 3D Terrain Extrusion</span>
                      <div className="h-[360px]">
                        <FarmTerrain3D geojson={selectedFarm3D.boundary} ndviData={ndviTimeseries} />
                      </div>
                    </div>
                  </div>
                )}
              </div>

            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// Default export wrapping DashboardContent in Query Provider
export default function Page() {
  return (
    <QueryClientProvider client={queryClient}>
      <GlobeIconStyle />
      <DashboardContent />
    </QueryClientProvider>
  );
}

// Custom simple spin animation utility
const GlobeIconStyle = () => (
  <style jsx global>{`
    @keyframes spin-slow {
      from { transform: rotate(0deg); }
      to { transform: rotate(360deg); }
    }
    .animate-spin-slow {
      animation: spin-slow 12s linear infinite;
    }
  `}</style>
);
