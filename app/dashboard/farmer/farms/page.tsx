"use client";

import { useState, useEffect } from "react";
import dynamic from "next/dynamic";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { motion, AnimatePresence } from "framer-motion";
import { QueryClient, QueryClientProvider, useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { LandPlot, PlusCircle, Trash2, CheckCircle2 } from "lucide-react";
import { Farm } from "@/components/MapComponent";

// Dynamically import Leaflet MapComponent to disable Server-Side Rendering (SSR)
const MapComponent = dynamic(() => import("@/components/MapComponent"), {
  ssr: false,
  loading: () => (
    <div className="w-full h-[450px] bg-[#112c11] animate-pulse border border-emerald-800 rounded-lg flex items-center justify-center">
      <span className="text-emerald-400 font-medium">Loading Satellite Map...</span>
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
  
  // Geodesic shoelace formula approximation
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

  // React Hook Form Configuration
  const {
    register,
    handleSubmit,
    reset,
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
    onSuccess: () => {
      queryClientRef.invalidateQueries({ queryKey: ["farms"] });
      reset();
      setPoints([]);
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

    // Convert Leaflet points [lat, lon] to GeoJSON format: [lon, lat] and close loop
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

  return (
    <div className="min-h-screen bg-[#0a1f0a] text-[#e2ebd5] p-6 font-sans">
      {/* Title Header */}
      <header className="mb-8 flex items-center justify-between border-b border-emerald-900 pb-4">
        <div className="flex items-center gap-3">
          <LandPlot className="h-8 w-8 text-[#22c55e]" />
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-white">Farm Polygon Ingestion Dashboard</h1>
            <p className="text-xs text-emerald-400">Register land boundaries, calculate acreage, and link insurance policies.</p>
          </div>
        </div>
      </header>

      {/* Main Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Registration Form Panel */}
        <div className="lg:col-span-1 bg-[#112c11] border border-emerald-800 p-6 rounded-xl shadow-md">
          <h2 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
            <PlusCircle className="h-5 w-5 text-[#22c55e]" />
            Register New Farm
          </h2>

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-emerald-400 mb-1">
                Farm Name
              </label>
              <input
                type="text"
                placeholder="e.g. Green Valley Farm"
                {...register("name")}
                className="w-full bg-[#0a1f0a] border border-emerald-800/80 rounded-md px-3 py-2 text-sm text-white focus:outline-none focus:border-[#22c55e]"
              />
              {errors.name && <p className="text-xs text-red-400 mt-1">{errors.name.message}</p>}
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-emerald-400 mb-1">
                  Crop Type
                </label>
                <select
                  {...register("crop_type")}
                  className="w-full bg-[#0a1f0a] border border-emerald-800/80 rounded-md px-3 py-2 text-sm text-white focus:outline-none focus:border-[#22c55e]"
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
                {errors.crop_type && <p className="text-xs text-red-400 mt-1">{errors.crop_type.message}</p>}
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-emerald-400 mb-1">
                  Sowing Date
                </label>
                <input
                  type="date"
                  {...register("sowing_date")}
                  className="w-full bg-[#0a1f0a] border border-emerald-800/80 rounded-md px-3 py-2 text-sm text-white focus:outline-none focus:border-[#22c55e]"
                />
                {errors.sowing_date && <p className="text-xs text-red-400 mt-1">{errors.sowing_date.message}</p>}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-emerald-400 mb-1">
                  Khasra Number (Land Record ID)
                </label>
                <input
                  type="text"
                  placeholder="e.g. 104/12"
                  {...register("khasra_number")}
                  className="w-full bg-[#0a1f0a] border border-emerald-800/80 rounded-md px-3 py-2 text-sm text-white focus:outline-none focus:border-[#22c55e]"
                />
                {errors.khasra_number && <p className="text-xs text-red-400 mt-1">{errors.khasra_number.message}</p>}
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-emerald-400 mb-1">
                  Insurance Policy No.
                </label>
                <input
                  type="text"
                  placeholder="e.g. INS-992812"
                  {...register("insurance_policy_number")}
                  className="w-full bg-[#0a1f0a] border border-emerald-800/80 rounded-md px-3 py-2 text-sm text-white focus:outline-none focus:border-[#22c55e]"
                />
                {errors.insurance_policy_number && (
                  <p className="text-xs text-red-400 mt-1">{errors.insurance_policy_number.message}</p>
                )}
              </div>
            </div>

            {/* Geographical details (State, District, Taluka, Village) */}
            <div className="grid grid-cols-2 gap-3 bg-[#0a1f0a]/50 p-3 rounded-lg border border-emerald-800/50">
              <div>
                <label className="block text-[10px] font-semibold uppercase text-emerald-500 mb-0.5">State</label>
                <input type="text" {...register("state")} className="w-full bg-[#071507] border border-emerald-900 rounded px-2 py-1 text-xs" />
              </div>
              <div>
                <label className="block text-[10px] font-semibold uppercase text-emerald-500 mb-0.5">District</label>
                <input type="text" {...register("district")} className="w-full bg-[#071507] border border-emerald-900 rounded px-2 py-1 text-xs" />
              </div>
              <div>
                <label className="block text-[10px] font-semibold uppercase text-emerald-500 mb-0.5">Taluka</label>
                <input type="text" {...register("taluka")} className="w-full bg-[#071507] border border-emerald-900 rounded px-2 py-1 text-xs" />
              </div>
              <div>
                <label className="block text-[10px] font-semibold uppercase text-emerald-500 mb-0.5">Village</label>
                <input type="text" {...register("village")} className="w-full bg-[#071507] border border-emerald-900 rounded px-2 py-1 text-xs" />
              </div>
            </div>

            {/* Area Display (Read Only, calculated from points) */}
            <div className="bg-[#1b4f1b]/30 border border-emerald-700/60 p-4 rounded-lg flex items-center justify-between">
              <div>
                <p className="text-xs text-emerald-400 font-medium">Calculated Area</p>
                <p className="text-lg font-bold text-white mt-0.5">
                  {calculatedArea.toFixed(2)} Hectares
                </p>
              </div>
              <LandPlot className="h-8 w-8 text-[#22c55e] opacity-75" />
            </div>

            {/* Submission Button */}
            <button
              type="submit"
              disabled={isSubmitting || addFarmMutation.isPending}
              className="w-full flex items-center justify-center gap-2 bg-[#22c55e] hover:bg-emerald-500 disabled:bg-emerald-800 text-black font-bold py-2.5 px-4 rounded-md transition shadow"
            >
              {addFarmMutation.isPending ? "Saving..." : "Save Farm Boundary"}
            </button>
          </form>
        </div>

        {/* Map Ingestion Panel */}
        <div className="lg:col-span-2 flex flex-col gap-6">
          <div className="bg-[#112c11] border border-emerald-800 p-6 rounded-xl shadow-md">
            <h2 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
              <LandPlot className="h-5 w-5 text-[#22c55e]" />
              Boundary Mapping View (Esri Satellite)
            </h2>
            <MapComponent points={points} setPoints={setPoints} existingFarms={farmsList} />
          </div>

          {/* List of Registered Farms */}
          <div className="bg-[#112c11] border border-emerald-800 p-6 rounded-xl shadow-md">
            <h2 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
              <CheckCircle2 className="h-5 w-5 text-[#22c55e]" />
              Registered Farm Boundaries ({farmsList.length})
            </h2>

            <div className="max-h-[300px] overflow-y-auto space-y-3 pr-2 scrollbar-thin scrollbar-thumb-emerald-800">
              <AnimatePresence>
                {farmsList.map((farm) => (
                  <motion.div
                    key={`list-farm-${farm.id}`}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    className="p-4 bg-[#0a1f0a]/60 border border-emerald-800/60 hover:border-emerald-600 rounded-lg flex items-center justify-between transition"
                  >
                    <div>
                      <h3 className="font-bold text-white text-sm">{farm.name}</h3>
                      <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-emerald-400 mt-1">
                        <span>🌾 Crop: {farm.crop_type}</span>
                        <span>📐 Area: {farm.area_hectares} ha</span>
                        <span>📄 Khasra: {farm.khasra_number}</span>
                        <span>📍 Village: {farm.village}, {farm.district}</span>
                      </div>
                    </div>

                    <button
                      onClick={() => deleteFarmMutation.mutate(farm.id)}
                      className="p-2 text-red-400 hover:text-red-300 hover:bg-red-950/40 rounded transition"
                      title="Delete Farm"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </motion.div>
                ))}
                {farmsList.length === 0 && (
                  <p className="text-sm text-emerald-600 text-center py-6">No registered farm boundaries found. Register one above.</p>
                )}
              </AnimatePresence>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}

// Default export wrapping DashboardContent in Query Provider
export default function Page() {
  return (
    <QueryClientProvider client={queryClient}>
      <DashboardContent />
    </QueryClientProvider>
  );
}
