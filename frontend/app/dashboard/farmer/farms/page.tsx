"use client";

import { useState, useEffect } from "react";
import dynamic from "next/dynamic";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { motion, AnimatePresence } from "framer-motion";
import { QueryClient, QueryClientProvider, useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  LandPlot,
  CheckCircle2,
  AlertTriangle,
  ChevronDown,
  ChevronUp,
  RotateCcw,
  Trash2,
  Check,
  MapPin,
  FileText,
  ShieldCheck,
  Box,
  Eye,
  ArrowRight,
  ArrowLeft,
  Globe
} from "lucide-react";
import { Farm } from "@/components/MapComponent";
import FarmTerrain3D from "@/components/maps/FarmTerrain3D";
import FeatureCube3D from "@/components/features/FeatureCube3D";
import { INDIA_LOCATION_DATA } from "@/lib/indiaLocations";
import {
  calculateHaversineDistance,
  evaluateLocationDistanceStatus,
  calculatePolygonCentroid,
  isPointInPolygon,
  isPolygonSelfIntersecting,
  calculatePolygonAreaHectares,
  calculateAreaAcres,
  doPolygonsOverlap,
  FarmerCurrentLocation,
  InsuredFarmLocation
} from "@/lib/spatialUtils";

// Dynamically import Leaflet MapComponent to disable Server-Side Rendering (SSR)
const MapComponent = dynamic(() => import("@/components/MapComponent"), {
  ssr: false,
  loading: () => (
    <div className="w-full h-[480px] bg-slate-900 animate-pulse border border-emerald-800 rounded-xl flex items-center justify-center">
      <span className="text-emerald-400 font-medium text-sm flex items-center gap-2">
        <LandPlot className="w-5 h-5 animate-spin" /> Loading Satellite Imagery...
      </span>
    </div>
  ),
});

const queryClient = new QueryClient();

// Zod Validation Schema
const farmSchema = z.object({
  name: z.string().min(2, "Farm name must be at least 2 characters"),
  crop_type: z.enum(["Rice", "Wheat", "Cotton", "Sugarcane", "Maize", "Mustard", "Soybeans"]),
  sowing_date: z.string().min(1, "Sowing date is required"),
  insurance_scheme: z.enum(["PMFBY", "RWBCIS"]),
  insurance_policy_number: z.string().min(5, "Insurance policy number is required"),
  season: z.enum(["Kharif", "Rabi", "Zaid"]),
  khasra_number: z.string().min(1, "Land Record / Khasra ID is required"),
  state: z.string().min(2, "State is required"),
  district: z.string().min(2, "District is required"),
  taluka: z.string().min(2, "Taluka is required"),
  village: z.string().min(2, "Village is required"),
});

type FarmFormData = z.infer<typeof farmSchema>;

function DashboardContent() {
  const queryClientRef = useQueryClient();

  // 7-Step Stepper State (1: Details, 2: Choice, 3: Find Land, 4: Mark/Draw, 5: Check, 6: Review, 7: Success)
  const [activeStep, setActiveStep] = useState<number>(1);
  const [locationChoice, setLocationChoice] = useState<"at_field" | "somewhere_else" | null>(null);

  // Map & Spatial State
  const [points, setPoints] = useState<[number, number][]>([]);
  const [insuredFarmLocation, setInsuredFarmLocation] = useState<[number, number] | null>(null);
  const [farmerCurrentLocation, setFarmerCurrentLocation] = useState<FarmerCurrentLocation | null>(null);
  const [gpsLoading, setGpsLoading] = useState(false);
  const [gpsError, setGpsError] = useState<string | null>(null);
  const [calculatedArea, setCalculatedArea] = useState<number>(0);
  const [targetCoords, setTargetCoords] = useState<{ lat: number; lng: number; zoom?: number } | null>(null);
  const [localFarms, setLocalFarms] = useState<Farm[]>([]);

  // Accordions
  const [showTechnicalDetails, setShowTechnicalDetails] = useState(false);
  const [showInsuranceDetails, setShowInsuranceDetails] = useState(false);
  const [showWhyPending, setShowWhyPending] = useState(false);

  // 3D Visualizer State
  const [hasWebGL, setHasWebGL] = useState(true);
  const [selectedFarm3D, setSelectedFarm3D] = useState<Farm | null>(null);
  const [is3DModalOpen, setIs3DModalOpen] = useState(false);
  const [modalTab, setModalTab] = useState<"terrain" | "cube">("terrain");
  const [submittedFarmResult, setSubmittedFarmResult] = useState<Farm | null>(null);

  // WebGL Check
  useEffect(() => {
    try {
      const canvas = document.createElement("canvas");
      setHasWebGL(
        !!(window.WebGLRenderingContext && (canvas.getContext("webgl") || canvas.getContext("experimental-webgl")))
      );
    } catch {
      setHasWebGL(false);
    }
  }, []);

  // Form Setup
  const {
    register,
    handleSubmit,
    reset,
    setValue,
    watch,
    trigger,
    formState: { errors }
  } = useForm<FarmFormData>({
    resolver: zodResolver(farmSchema),
    defaultValues: {
      name: "",
      crop_type: "Rice",
      sowing_date: new Date().toISOString().split("T")[0],
      insurance_scheme: "PMFBY",
      insurance_policy_number: "",
      season: "Kharif",
      khasra_number: "",
      state: "Tamil Nadu",
      district: "Kallakurichi",
      taluka: "Ulundurpet",
      village: "Nagalur",
    },
  });

  const stateVal = watch("state");
  const districtVal = watch("district");
  const talukaVal = watch("taluka");
  const villageVal = watch("village");

  const currentStateData = INDIA_LOCATION_DATA[stateVal];
  const availableDistricts = currentStateData ? Object.keys(currentStateData.districts) : [];
  const currentDistrictData = currentStateData?.districts[districtVal];
  const availableTalukas = currentDistrictData ? currentDistrictData.talukas : [];

  const handleStateChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const val = e.target.value;
    setValue("state", val, { shouldValidate: true });
    setValue("district", "", { shouldValidate: true });
    setValue("taluka", "", { shouldValidate: true });
    setValue("village", "", { shouldValidate: true });
    const sData = INDIA_LOCATION_DATA[val];
    if (sData) setTargetCoords({ lat: sData.lat, lng: sData.lng, zoom: 7 });
  };

  const handleDistrictChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const val = e.target.value;
    setValue("district", val, { shouldValidate: true });
    setValue("taluka", "", { shouldValidate: true });
    setValue("village", "", { shouldValidate: true });
    const dData = currentStateData?.districts[val];
    if (dData) setTargetCoords({ lat: dData.lat, lng: dData.lng, zoom: 11 });
  };

  const handleTalukaChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const val = e.target.value;
    setValue("taluka", val, { shouldValidate: true });
    setValue("village", "", { shouldValidate: true });
    if (currentDistrictData) setTargetCoords({ lat: currentDistrictData.lat, lng: currentDistrictData.lng, zoom: 13 });
  };

  const locationQuery = [villageVal, talukaVal, districtVal, stateVal].filter(Boolean).join(", ");

  const handleLocationSelect = (loc: { state: string; district: string; taluka: string; village: string }) => {
    if (loc.state) setValue("state", loc.state, { shouldValidate: true });
    if (loc.district) setValue("district", loc.district, { shouldValidate: true });
    if (loc.taluka) setValue("taluka", loc.taluka, { shouldValidate: true });
    if (loc.village) setValue("village", loc.village, { shouldValidate: true });
  };

  // Recalculate Area & Auto-Place Land Center Pin inside drawn polygon
  useEffect(() => {
    const ha = calculatePolygonAreaHectares(points);
    setCalculatedArea(ha);

    // Auto-place center pin inside drawn polygon if missing or currently outside
    if (points.length >= 3) {
      const centroid = calculatePolygonCentroid(points);
      if (!insuredFarmLocation || !isPointInPolygon(insuredFarmLocation, points)) {
        setInsuredFarmLocation(centroid);
      }
    }
  }, [points]);

  // Load Cached Local Farms
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
          state: "Tamil Nadu",
          district: "Kallakurichi",
          taluka: "Ulundurpet",
          village: "Nagalur",
          verification_status: "PENDING_OFFICIAL_VERIFICATION",
          insuredFarmLocation: { latitude: 11.7384, longitude: 78.9639 },
          boundary: {
            type: "Polygon",
            coordinates: [
              [
                [78.95, 11.73],
                [78.97, 11.73],
                [78.97, 11.75],
                [78.95, 11.75],
                [78.95, 11.73]
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
      } catch {
        const cached = localStorage.getItem("agrisense_cached_farms");
        return cached ? JSON.parse(cached) : [];
      }
    },
  });

  const farmsList = dbFarms.length > 0 ? dbFarms : localFarms;

  // Handle Option A: "I'M AT MY FIELD" (GPS Capture)
  const handleSelectAtFieldChoice = () => {
    setLocationChoice("at_field");
    setGpsLoading(true);
    setGpsError(null);

    if (!navigator.geolocation) {
      setGpsError("📍 Geolocation is not supported by your browser.");
      setGpsLoading(false);
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const currentLoc: FarmerCurrentLocation = {
          latitude: pos.coords.latitude,
          longitude: pos.coords.longitude,
          accuracy: Math.round(pos.coords.accuracy),
        };
        setFarmerCurrentLocation(currentLoc);
        setTargetCoords({ lat: currentLoc.latitude!, lng: currentLoc.longitude!, zoom: 17 });
        
        if (!insuredFarmLocation) {
          setInsuredFarmLocation([currentLoc.latitude!, currentLoc.longitude!]);
        }
        setGpsLoading(false);
        setActiveStep(3); // Move to Step 3
      },
      (err) => {
        let msg = "📍 We couldn't find your location. Please allow location access and try again.";
        if (err.code === err.PERMISSION_DENIED) {
          msg = "📍 Location access was denied. You can still select 'My field is somewhere else'.";
        }
        setGpsError(msg);
        setGpsLoading(false);
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    );
  };

  // Handle Option B: "MY FIELD IS SOMEWHERE ELSE" (Skip GPS)
  const handleSelectSomewhereElseChoice = () => {
    setLocationChoice("somewhere_else");
    setFarmerCurrentLocation(null); // No GPS required
    setActiveStep(3); // Move directly to Step 3 Find Land
  };

  // Handle "PLACE PIN INSIDE FIELD" Click
  const handlePlacePinInsideField = () => {
    if (points.length >= 3) {
      const centroid = calculatePolygonCentroid(points);
      setInsuredFarmLocation(centroid);
    } else if (targetCoords) {
      setInsuredFarmLocation([targetCoords.lat, targetCoords.lng]);
    } else {
      setInsuredFarmLocation([11.7384, 78.9639]);
    }
  };

  // SPATIAL BACKGROUND VALIDATION (Step 5)
  const isPolygonClosed = points.length >= 3;
  const isSelfIntersecting = isPolygonSelfIntersecting(points);
  const isCenterPinInside = insuredFarmLocation ? isPointInPolygon(insuredFarmLocation, points) : false;

  // Overlap check
  let hasOverlap = false;
  if (points.length >= 3) {
    for (const f of farmsList) {
      if (f.boundary?.coordinates?.[0]) {
        const existingPoly = f.boundary.coordinates[0].map((c) => [c[1], c[0]]) as [number, number][];
        if (doPolygonsOverlap(points, existingPoly)) {
          hasOverlap = true;
          break;
        }
      }
    }
  }

  // Evaluate Distance Status
  const distanceEval = evaluateLocationDistanceStatus(
    farmerCurrentLocation,
    insuredFarmLocation ? { latitude: insuredFarmLocation[0], longitude: insuredFarmLocation[1] } : null
  );

  // Overall Land Check Validity
  const isLandCheckValid =
    isPolygonClosed && !isSelfIntersecting && (isCenterPinInside || points.length >= 3) && !hasOverlap && calculatedArea > 0;

  // Handle Proceed to Step 5 (Land Check)
  const handleProceedToLandCheck = () => {
    if (points.length >= 3) {
      const centroid = calculatePolygonCentroid(points);
      if (!insuredFarmLocation || !isPointInPolygon(insuredFarmLocation, points)) {
        setInsuredFarmLocation(centroid);
      }
    }
    setActiveStep(5);
  };

  // SAVE FARM MUTATION
  const createFarmMutation = useMutation({
    mutationFn: async (formData: FarmFormData) => {
      const polygonGeoJSON = {
        type: "Polygon",
        coordinates: [points.map((p) => [p[1], p[0]])],
      };

      const finalPin = insuredFarmLocation || (points.length >= 3 ? calculatePolygonCentroid(points) : [11.7384, 78.9639]);

      const newFarmObj: Farm = {
        id: Date.now(),
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
        verification_status: "PENDING_OFFICIAL_VERIFICATION",
        farmerCurrentLocation: farmerCurrentLocation || undefined,
        insuredFarmLocation: { latitude: finalPin[0], longitude: finalPin[1] },
        boundary: polygonGeoJSON as any,
      };

      try {
        const res = await fetch("http://localhost:8000/api/v1/farms/", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: formData.name,
            crop_type: formData.crop_type,
            sowing_date: formData.sowing_date,
            insurance_policy_number: formData.insurance_policy_number,
            khasra_number: formData.khasra_number,
            boundary_geojson: polygonGeoJSON,
          }),
        });

        if (res.ok) {
          const apiFarm = await res.json();
          newFarmObj.id = apiFarm.id;
        }
      } catch {
        console.warn("Backend offline; saving locally.");
      }

      const updatedLocal = [newFarmObj, ...localFarms];
      setLocalFarms(updatedLocal);
      localStorage.setItem("agrisense_cached_farms", JSON.stringify(updatedLocal));
      return newFarmObj;
    },
    onSuccess: (savedFarm) => {
      queryClientRef.invalidateQueries({ queryKey: ["farms"] });
      setSubmittedFarmResult(savedFarm);
      setActiveStep(7); // Step 7: Success Screen
    },
  });

  const onConfirmSubmit = () => {
    handleSubmit((data) => createFarmMutation.mutate(data))();
  };

  const handleResetWorkflow = () => {
    reset({
      name: "",
      crop_type: "Rice",
      sowing_date: new Date().toISOString().split("T")[0],
      insurance_policy_number: "",
      khasra_number: "",
      state: "Tamil Nadu",
      district: "Kallakurichi",
      taluka: "Ulundurpet",
      village: "Nagalur",
    });
    setPoints([]);
    setInsuredFarmLocation(null);
    setFarmerCurrentLocation(null);
    setLocationChoice(null);
    setCalculatedArea(0);
    setSubmittedFarmResult(null);
    setActiveStep(1);
  };

  return (
    <div className="min-h-screen bg-[#061406] text-[#e2ebd5] p-4 md:p-8 space-y-8 font-sans">
      {/* Top Title Banner */}
      <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-start md:items-center justify-between gap-4 border-b border-emerald-800/60 pb-6">
        <div>
          <h1 className="text-3xl md:text-4xl font-extrabold text-white flex items-center gap-3 tracking-tight">
            <LandPlot className="w-9 h-9 text-emerald-400" /> Insured Land Registration
          </h1>
          <p className="text-emerald-400 text-sm mt-1">
            Register your agricultural plot for crop insurance. You can register land even if you are away from the field.
          </p>
        </div>
      </div>

      {/* FARMER-FIRST 7-STEP GUIDED PROGRESS BAR */}
      <div className="max-w-7xl mx-auto">
        <div className="bg-[#0c240c]/90 border border-emerald-800/80 rounded-2xl p-4 shadow-xl backdrop-blur-md">
          <div className="grid grid-cols-6 gap-2 text-center">
            {[
              { step: 1, title: "1. Details" },
              { step: 2, title: "2. Choice" },
              { step: 3, title: "3. Find Land" },
              { step: 4, title: "4. Mark & Draw" },
              { step: 5, title: "5. Land Check" },
              { step: 6, title: "6. Review" },
            ].map((s) => {
              const isCompleted = activeStep > s.step;
              const isActive = activeStep === s.step;
              return (
                <div
                  key={`step-nav-${s.step}`}
                  className={`flex flex-col items-center justify-center p-2 rounded-xl transition-all ${
                    isActive
                      ? "bg-emerald-600/30 border-2 border-emerald-400 text-white font-bold scale-105 shadow-lg"
                      : isCompleted
                      ? "bg-emerald-950/60 border border-emerald-700/60 text-emerald-300"
                      : "bg-[#071707] border border-emerald-900/40 text-emerald-700"
                  }`}
                >
                  <span className="text-xs md:text-sm font-semibold">{s.title}</span>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* MAIN REGISTRATION SECTION */}
      <div className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-12 gap-8">

        {/* LEFT COLUMN: GUIDED STEP CARDS */}
        <div className="lg:col-span-6 space-y-6">

          {/* STEP 7: SUCCESS SCREEN */}
          {activeStep === 7 && submittedFarmResult && (
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="bg-[#0c240c] border border-emerald-500/80 rounded-2xl p-6 md:p-8 space-y-6 shadow-2xl"
            >
              <div className="text-center space-y-3 border-b border-emerald-800/80 pb-6">
                <div className="w-16 h-16 bg-emerald-600/30 border-2 border-emerald-400 rounded-full flex items-center justify-center mx-auto text-3xl">
                  🎉
                </div>
                <h2 className="text-2xl font-bold text-white">FARM REGISTERED</h2>
                <p className="text-emerald-300 text-sm">Your insured farm has been successfully registered.</p>
              </div>

              <div className="bg-[#061406] border border-emerald-800 rounded-xl p-4 space-y-3 text-sm">
                <div className="flex justify-between border-b border-emerald-900/60 pb-2">
                  <span className="text-emerald-400">Farm:</span>
                  <span className="font-bold text-white">{submittedFarmResult.name}</span>
                </div>
                <div className="flex justify-between border-b border-emerald-900/60 pb-2">
                  <span className="text-emerald-400">Crop:</span>
                  <span className="text-emerald-200">{submittedFarmResult.crop_type}</span>
                </div>
                <div className="flex justify-between border-b border-emerald-900/60 pb-2">
                  <span className="text-emerald-400">Area:</span>
                  <span className="font-bold text-emerald-300">{submittedFarmResult.area_hectares} hectares</span>
                </div>
                <div className="flex justify-between border-b border-emerald-900/60 pb-2">
                  <span className="text-emerald-400">Insurance Policy:</span>
                  <span className="text-emerald-200">{submittedFarmResult.insurance_policy_number}</span>
                </div>
                <div className="flex justify-between border-b border-emerald-900/60 pb-2">
                  <span className="text-emerald-400">Land Record ID:</span>
                  <span className="text-emerald-200">{submittedFarmResult.khasra_number}</span>
                </div>
                <div className="flex justify-between items-center pt-1">
                  <span className="text-emerald-400">Land verification:</span>
                  <span className="px-3 py-1 bg-amber-950/80 border border-amber-600/80 text-amber-300 text-xs font-semibold rounded-full flex items-center gap-1.5">
                    🟡 Pending official verification
                  </span>
                </div>
              </div>

              <div className="flex flex-col sm:flex-row gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => {
                    setSelectedFarm3D(submittedFarmResult);
                    setIs3DModalOpen(true);
                  }}
                  className="flex-1 px-4 py-3 bg-[#133513] hover:bg-[#1b4f1b] border border-emerald-600 text-white font-semibold rounded-xl transition flex items-center justify-center gap-2 shadow-lg"
                >
                  <Eye className="w-4 h-4 text-emerald-400" /> View 3D Farm
                </button>
                <button
                  type="button"
                  onClick={handleResetWorkflow}
                  className="flex-1 px-4 py-3 bg-emerald-600 hover:bg-emerald-500 text-slate-950 font-extrabold rounded-xl transition flex items-center justify-center gap-2 shadow-lg"
                >
                  <RotateCcw className="w-4 h-4" /> Register Another Farm
                </button>
              </div>
            </motion.div>
          )}

          {/* STEP 1: FARM DETAILS */}
          {activeStep === 1 && (
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
              <div className="bg-[#0c240c] border border-emerald-800 rounded-2xl p-6 shadow-xl space-y-4">
                <h2 className="text-xl font-bold text-white flex items-center gap-2 border-b border-emerald-800/80 pb-3">
                  <FileText className="w-5 h-5 text-emerald-400" /> STEP 1 — FARM DETAILS
                </h2>

                <div className="space-y-4 text-sm">
                  {/* Farm Name */}
                  <div>
                    <label className="block text-emerald-300 font-semibold mb-1">Farm Name</label>
                    <input
                      {...register("name")}
                      placeholder="Example: My Paddy Field"
                      className="w-full bg-[#061406] border border-emerald-700/80 rounded-xl px-4 py-2.5 text-white placeholder-emerald-700 focus:outline-none focus:border-emerald-400"
                    />
                    <p className="text-xs text-emerald-500 mt-1">Give a descriptive name for your plot.</p>
                    {errors.name && <p className="text-red-400 text-xs mt-1">{errors.name.message}</p>}
                  </div>

                  {/* Crop & Sowing Date */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-emerald-300 font-semibold mb-1">Crop Type</label>
                      <select
                        {...register("crop_type")}
                        className="w-full bg-[#061406] border border-emerald-700/80 rounded-xl px-4 py-2.5 text-white focus:outline-none focus:border-emerald-400"
                      >
                        {["Rice", "Wheat", "Cotton", "Sugarcane", "Maize", "Mustard", "Soybeans"].map((c) => (
                          <option key={c} value={c}>
                            {c}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block text-emerald-300 font-semibold mb-1">Sowing Date</label>
                      <input
                        type="date"
                        {...register("sowing_date")}
                        className="w-full bg-[#061406] border border-emerald-700/80 rounded-xl px-4 py-2.5 text-white focus:outline-none focus:border-emerald-400"
                      />
                    </div>
                  </div>

                  {/* Land Record / Khasra ID */}
                  <div>
                    <label className="block text-emerald-300 font-semibold mb-1">Land Record / Khasra ID</label>
                    <input
                      {...register("khasra_number")}
                      placeholder="e.g. 223/4"
                      className="w-full bg-[#061406] border border-emerald-700/80 rounded-xl px-4 py-2.5 text-white placeholder-emerald-700 focus:outline-none focus:border-emerald-400 font-mono"
                    />
                    <p className="text-xs text-emerald-500 mt-1">Enter the number from your official land document.</p>
                    {errors.khasra_number && <p className="text-red-400 text-xs mt-1">{errors.khasra_number.message}</p>}
                  </div>

                  {/* 🛡️ FARM INSURANCE SECTION */}
                  <div className="bg-[#061406] border border-emerald-800/80 rounded-xl p-4 space-y-4">
                    <div className="flex items-center justify-between border-b border-emerald-800/60 pb-2">
                      <h3 className="text-xs font-bold text-emerald-400 tracking-wider uppercase flex items-center gap-1.5">
                        <ShieldCheck className="w-4 h-4 text-emerald-400" /> 🛡️ Farm Insurance
                      </h3>
                      <span className="text-[10px] font-semibold bg-emerald-950 text-emerald-300 px-2 py-0.5 rounded border border-emerald-800">
                        Status: 🟢 Active
                      </span>
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-emerald-300 mb-2">
                        Which insurance scheme covers this farm?
                      </label>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <label
                          className={`p-3 rounded-xl border-2 cursor-pointer transition flex items-start gap-2.5 ${
                            watch("insurance_scheme") === "PMFBY"
                              ? "bg-emerald-950/80 border-emerald-400"
                              : "bg-[#0a1f0a] border-emerald-900 hover:border-emerald-700"
                          }`}
                        >
                          <input
                            type="radio"
                            value="PMFBY"
                            {...register("insurance_scheme")}
                            className="mt-0.5 accent-emerald-500"
                          />
                          <div>
                            <p className="text-sm font-bold text-white">PMFBY</p>
                            <p className="text-xs text-emerald-400">Crop Insurance</p>
                          </div>
                        </label>

                        <label
                          className={`p-3 rounded-xl border-2 cursor-pointer transition flex items-start gap-2.5 ${
                            watch("insurance_scheme") === "RWBCIS"
                              ? "bg-emerald-950/80 border-emerald-400"
                              : "bg-[#0a1f0a] border-emerald-900 hover:border-emerald-700"
                          }`}
                        >
                          <input
                            type="radio"
                            value="RWBCIS"
                            {...register("insurance_scheme")}
                            className="mt-0.5 accent-emerald-500"
                          />
                          <div>
                            <p className="text-sm font-bold text-white">RWBCIS</p>
                            <p className="text-xs text-emerald-400">Weather-Based Insurance</p>
                          </div>
                        </label>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs text-emerald-300 mb-1">Insurance Policy Number</label>
                        <input
                          {...register("insurance_policy_number")}
                          placeholder="e.g. INS-772819"
                          className="w-full bg-[#0a1f0a] border border-emerald-700/80 rounded-lg px-3 py-2 text-xs text-white placeholder-emerald-700 font-mono"
                        />
                        {errors.insurance_policy_number && (
                          <p className="text-red-400 text-[10px] mt-0.5">{errors.insurance_policy_number.message}</p>
                        )}
                      </div>

                      <div>
                        <label className="block text-xs text-emerald-300 mb-1">Season</label>
                        <select
                          {...register("season")}
                          className="w-full bg-[#0a1f0a] border border-emerald-700/80 rounded-lg px-3 py-2 text-xs text-white"
                        >
                          <option value="Kharif">Kharif (Monsoon)</option>
                          <option value="Rabi">Rabi (Winter)</option>
                          <option value="Zaid">Zaid (Summer)</option>
                        </select>
                      </div>
                    </div>

                    {/* Expandable Insurance Details */}
                    <div>
                      <button
                        type="button"
                        onClick={() => setShowInsuranceDetails(!showInsuranceDetails)}
                        className="text-xs text-emerald-400 hover:text-emerald-200 underline flex items-center gap-1 font-semibold"
                      >
                        {showInsuranceDetails ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                        {showInsuranceDetails ? "Hide insurance details" : "View insurance details"}
                      </button>

                      {showInsuranceDetails && (
                        <div className="mt-2.5 p-3 bg-[#061406] border border-emerald-800 rounded-lg text-xs space-y-1.5 text-emerald-300">
                          <p><span className="text-emerald-500 font-bold">Scheme Selected:</span> {watch("insurance_scheme") === "PMFBY" ? "Pradhan Mantri Fasal Bima Yojana" : "Restructured Weather Based Crop Insurance Scheme"}</p>
                          <p><span className="text-emerald-500 font-bold">Sum Insured Estimate:</span> ₹1,20,000 / hectare</p>
                          <p><span className="text-emerald-500 font-bold">Coverage Period:</span> Kharif Season 2026 (Active)</p>
                          {watch("insurance_scheme") === "PMFBY" ? (
                            <p><span className="text-emerald-500 font-bold">Coverage Provisions:</span> Standing Crop / Yield Loss, Prevented Sowing, Localized Calamity, Mid-Season Adversity, Post-Harvest Loss (Available during claim filing).</p>
                          ) : (
                            <p><span className="text-emerald-500 font-bold">Weather Protection:</span> Automatic weather-index monitoring active for rainfall, temperature, and wind anomalies.</p>
                          )}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Cascading Location Selection */}
                  <div className="bg-[#061406] border border-emerald-800/80 rounded-xl p-4 space-y-3">
                    <h3 className="text-xs font-bold text-emerald-400 tracking-wider uppercase">Insured Land Location</h3>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs text-emerald-300 mb-1">State</label>
                        <select
                          value={stateVal}
                          onChange={handleStateChange}
                          className="w-full bg-[#0a1f0a] border border-emerald-700/80 rounded-lg px-3 py-2 text-xs text-white"
                        >
                          {Object.keys(INDIA_LOCATION_DATA).map((st) => (
                            <option key={st} value={st}>
                              {st}
                            </option>
                          ))}
                        </select>
                      </div>

                      <div>
                        <label className="block text-xs text-emerald-300 mb-1">District</label>
                        <select
                          value={districtVal}
                          onChange={handleDistrictChange}
                          className="w-full bg-[#0a1f0a] border border-emerald-700/80 rounded-lg px-3 py-2 text-xs text-white"
                        >
                          {availableDistricts.map((d) => (
                            <option key={d} value={d}>
                              {d}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs text-emerald-300 mb-1">Taluka / Tehsil</label>
                        <select
                          value={talukaVal}
                          onChange={handleTalukaChange}
                          className="w-full bg-[#0a1f0a] border border-emerald-700/80 rounded-lg px-3 py-2 text-xs text-white"
                        >
                          {availableTalukas.map((t) => (
                            <option key={t} value={t}>
                              {t}
                            </option>
                          ))}
                        </select>
                      </div>

                      <div>
                        <label className="block text-xs text-emerald-300 mb-1">Village</label>
                        <input
                          {...register("village")}
                          placeholder="e.g. Nagalur"
                          className="w-full bg-[#0a1f0a] border border-emerald-700/80 rounded-lg px-3 py-2 text-xs text-white placeholder-emerald-700"
                        />
                      </div>
                    </div>
                  </div>
                </div>

                <div className="pt-2">
                  <button
                    type="button"
                    onClick={async () => {
                      const valid = await trigger();
                      if (valid) setActiveStep(2);
                    }}
                    className="w-full py-3 bg-emerald-600 hover:bg-emerald-500 text-slate-950 font-extrabold rounded-xl transition flex items-center justify-center gap-2 shadow-lg text-base"
                  >
                    NEXT: WHERE IS YOUR FIELD? <ArrowRight className="w-5 h-5" />
                  </button>
                </div>
              </div>
            </motion.div>
          )}

          {/* STEP 2: WHERE IS YOUR FIELD? (OPTION A vs OPTION B) */}
          {activeStep === 2 && (
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
              <div className="bg-[#0c240c] border border-emerald-800 rounded-2xl p-6 shadow-xl space-y-5">
                <h2 className="text-xl font-bold text-white border-b border-emerald-800/80 pb-3">
                  WHERE IS YOUR FIELD?
                </h2>

                <p className="text-emerald-300 text-sm">
                  Select how you want to locate your field on satellite imagery.
                </p>

                <div className="space-y-4">
                  {/* OPTION A: I'M AT MY FIELD */}
                  <button
                    type="button"
                    onClick={handleSelectAtFieldChoice}
                    disabled={gpsLoading}
                    className="w-full p-5 bg-[#061406] hover:bg-[#0e2c0e] border-2 border-emerald-600 rounded-2xl text-left transition flex items-start gap-4 shadow-lg group"
                  >
                    <div className="p-3 bg-blue-600/30 border border-blue-400 rounded-xl text-2xl shrink-0">
                      📍
                    </div>
                    <div className="space-y-1">
                      <h3 className="text-base font-bold text-white group-hover:text-emerald-300 transition">
                        I'M AT MY FIELD
                      </h3>
                      <p className="text-xs text-emerald-400">
                        Use your current GPS location to find your field on satellite imagery.
                      </p>
                    </div>
                  </button>

                  {/* OPTION B: MY FIELD IS SOMEWHERE ELSE */}
                  <button
                    type="button"
                    onClick={handleSelectSomewhereElseChoice}
                    className="w-full p-5 bg-[#061406] hover:bg-[#0e2c0e] border-2 border-emerald-600 rounded-2xl text-left transition flex items-start gap-4 shadow-lg group"
                  >
                    <div className="p-3 bg-emerald-600/30 border border-emerald-400 rounded-xl text-2xl shrink-0">
                      🗺️
                    </div>
                    <div className="space-y-1">
                      <h3 className="text-base font-bold text-white group-hover:text-emerald-300 transition">
                        MY FIELD IS SOMEWHERE ELSE
                      </h3>
                      <p className="text-xs text-emerald-400">
                        Find your field by searching or navigating the map (no GPS required).
                      </p>
                    </div>
                  </button>
                </div>

                <div className="p-3 bg-[#061406] border border-emerald-800 rounded-xl text-xs text-emerald-400 italic">
                  💡 You can register land even if you are not currently at the field.
                </div>

                {gpsError && (
                  <div className="p-3 bg-red-950/80 border border-red-700/80 rounded-xl text-red-200 text-xs flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4 text-red-400 shrink-0" />
                    <span>{gpsError}</span>
                  </div>
                )}

                <div className="pt-2">
                  <button
                    type="button"
                    onClick={() => setActiveStep(1)}
                    className="px-4 py-3 bg-[#133513] hover:bg-[#1b4f1b] border border-emerald-700 text-emerald-300 font-bold rounded-xl transition flex items-center gap-1"
                  >
                    <ArrowLeft className="w-4 h-4" /> Back to Details
                  </button>
                </div>
              </div>
            </motion.div>
          )}

          {/* STEP 3: FIND YOUR FIELD */}
          {activeStep === 3 && (
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
              <div className="bg-[#0c240c] border border-emerald-800 rounded-2xl p-6 shadow-xl space-y-4">
                <h2 className="text-xl font-bold text-white flex items-center gap-2 border-b border-emerald-800/80 pb-3">
                  <Globe className="w-5 h-5 text-emerald-400" /> STEP 3 — FIND YOUR FIELD
                </h2>

                <p className="text-emerald-300 text-sm">
                  {locationChoice === "at_field"
                    ? "Your current GPS location has been loaded on the map."
                    : "Search or navigate the map to find your insured plot."}
                </p>

                <div className="p-4 bg-[#061406] border border-emerald-700/80 rounded-xl space-y-2 text-xs">
                  <p className="text-emerald-300 font-bold">Location Summary:</p>
                  <p className="text-emerald-400">Insured Area: {villageVal}, {districtVal}, {stateVal}</p>
                  {farmerCurrentLocation && (
                    <p className="text-blue-300">
                      📍 Your Current Location: Captured ({farmerCurrentLocation.accuracy}m accuracy)
                    </p>
                  )}
                </div>

                <div className="flex gap-3 pt-2">
                  <button
                    type="button"
                    onClick={() => setActiveStep(2)}
                    className="px-4 py-3 bg-[#133513] hover:bg-[#1b4f1b] border border-emerald-700 text-emerald-300 font-bold rounded-xl transition flex items-center gap-1"
                  >
                    <ArrowLeft className="w-4 h-4" /> Back
                  </button>
                  <button
                    type="button"
                    onClick={() => setActiveStep(4)}
                    className="flex-1 py-3 bg-emerald-600 hover:bg-emerald-500 text-slate-950 font-extrabold rounded-xl transition flex items-center justify-center gap-2 shadow-lg text-base"
                  >
                    NEXT: MARK & DRAW FIELD <ArrowRight className="w-5 h-5" />
                  </button>
                </div>
              </div>
            </motion.div>
          )}

          {/* STEP 4: MARK & DRAW FIELD */}
          {activeStep === 4 && (
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
              <div className="bg-[#0c240c] border border-emerald-800 rounded-2xl p-6 shadow-xl space-y-4">
                <h2 className="text-xl font-bold text-white flex items-center gap-2 border-b border-emerald-800/80 pb-3">
                  <LandPlot className="w-5 h-5 text-emerald-400" /> STEP 4 — MARK & DRAW FIELD
                </h2>

                <div className="bg-[#061406] border border-emerald-700/80 rounded-xl p-4 space-y-2">
                  <p className="font-bold text-white text-base">📌 Is this your field?</p>
                  <p className="text-emerald-300 text-xs">
                    Tap around the edges of your field plot. The land center pin will be positioned automatically.
                  </p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={handlePlacePinInsideField}
                    className="py-3 px-4 bg-amber-950/80 hover:bg-amber-900 border border-amber-600/80 text-amber-200 font-bold rounded-xl transition flex items-center justify-center gap-2 text-sm shadow"
                  >
                    📌 PLACE PIN INSIDE FIELD
                  </button>

                  <button
                    type="button"
                    className="py-3 px-4 bg-emerald-950/80 border border-emerald-600/80 text-emerald-300 font-bold rounded-xl flex items-center justify-center gap-2 text-sm shadow cursor-default"
                  >
                    ✏️ TAP MAP TO DRAW
                  </button>
                </div>

                {/* Controls (Undo, Clear) */}
                <div className="bg-[#061406] border border-emerald-800/80 rounded-xl p-4 space-y-3">
                  <div className="text-xs text-emerald-400 font-semibold space-y-1">
                    <p>• Tap map once = add boundary point</p>
                    <p>• Drag point = move position</p>
                    <p>• Undo = remove last point</p>
                  </div>

                  <div className="flex flex-wrap gap-2 pt-1">
                    <button
                      type="button"
                      onClick={() => setPoints(points.slice(0, -1))}
                      disabled={points.length === 0}
                      className="px-3 py-2 bg-[#133513] hover:bg-[#1b4f1b] disabled:opacity-40 text-emerald-300 text-xs font-bold rounded-lg border border-emerald-700 transition flex items-center gap-1"
                    >
                      <RotateCcw className="w-3.5 h-3.5" /> Undo
                    </button>
                    <button
                      type="button"
                      onClick={() => setPoints([])}
                      disabled={points.length === 0}
                      className="px-3 py-2 bg-red-950 hover:bg-red-900 disabled:opacity-40 text-red-200 text-xs font-bold rounded-lg border border-red-800 transition flex items-center gap-1"
                    >
                      <Trash2 className="w-3.5 h-3.5" /> Clear
                    </button>
                  </div>
                </div>

                {/* Validation Prompts */}
                {points.length > 0 && points.length < 3 && (
                  <p className="text-amber-400 text-xs bg-amber-950/60 p-2.5 rounded-lg border border-amber-800/60">
                    Please mark at least 3 points around your field.
                  </p>
                )}

                {isSelfIntersecting && (
                  <p className="text-red-400 text-xs bg-red-950/80 p-2.5 rounded-lg border border-red-700">
                    ⚠️ Some boundary lines cross each other. Please adjust the points.
                  </p>
                )}

                <div className="flex gap-3 pt-2">
                  <button
                    type="button"
                    onClick={() => setActiveStep(3)}
                    className="px-4 py-3 bg-[#133513] hover:bg-[#1b4f1b] border border-emerald-700 text-emerald-300 font-bold rounded-xl transition flex items-center gap-1"
                  >
                    <ArrowLeft className="w-4 h-4" /> Back
                  </button>
                  <button
                    type="button"
                    disabled={points.length < 3 || isSelfIntersecting}
                    onClick={handleProceedToLandCheck}
                    className="flex-1 py-3 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 text-slate-950 font-extrabold rounded-xl transition flex items-center justify-center gap-2 shadow-lg text-base"
                  >
                    ✓ DONE <ArrowRight className="w-5 h-5" />
                  </button>
                </div>
              </div>
            </motion.div>
          )}

          {/* STEP 5: AUTOMATIC LAND CHECK */}
          {activeStep === 5 && (
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
              <div className="bg-[#0c240c] border border-emerald-800 rounded-2xl p-6 shadow-xl space-y-4">
                <h2 className="text-xl font-bold text-white flex items-center gap-2 border-b border-emerald-800/80 pb-3">
                  <ShieldCheck className="w-5 h-5 text-emerald-400" /> STEP 5 — AUTOMATIC LAND CHECK
                </h2>

                {/* Result Status Banner */}
                {isLandCheckValid ? (
                  <div className="bg-emerald-950/90 border-2 border-emerald-500 rounded-2xl p-5 space-y-3 shadow-xl">
                    <div className="flex items-center gap-2 text-emerald-300 font-bold text-lg border-b border-emerald-800/80 pb-2">
                      <CheckCircle2 className="w-6 h-6 text-emerald-400" /> YOUR FIELD LOOKS GOOD
                    </div>

                    <div className="space-y-1">
                      <p className="text-xs text-emerald-400 font-bold uppercase tracking-wider">FIELD AREA</p>
                      <p className="text-3xl font-extrabold text-white">
                        {calculatedArea} <span className="text-lg text-emerald-400 font-medium">hectares</span>
                      </p>
                      <p className="text-emerald-300 text-sm font-medium">
                        ({calculateAreaAcres(calculatedArea)} acres)
                      </p>
                    </div>

                    {/* Distance Status Badge (Informative badge, DOES NOT block) */}
                    {distanceEval.isAway && (
                      <div className="p-3 bg-blue-950/80 border border-blue-600/80 rounded-xl text-blue-200 text-xs flex items-center gap-2 font-medium">
                        <span>{distanceEval.message}</span>
                      </div>
                    )}

                    {/* Simple Checklist */}
                    <div className="pt-2 border-t border-emerald-800/80 space-y-2 text-xs text-emerald-200">
                      <div className="flex items-center gap-2">
                        <Check className="w-4 h-4 text-emerald-400" /> Location found & mapped
                      </div>
                      <div className="flex items-center gap-2">
                        <Check className="w-4 h-4 text-emerald-400" /> Field boundary added
                      </div>
                      <div className="flex items-center gap-2">
                        <Check className="w-4 h-4 text-emerald-400" /> No conflict with registered fields detected
                      </div>

                      <div className="pt-1 flex items-center justify-between text-amber-300">
                        <span className="flex items-center gap-1.5 font-semibold">
                          🟡 Official land record check may still be required
                        </span>
                        <button
                          type="button"
                          onClick={() => setShowWhyPending(!showWhyPending)}
                          className="text-[11px] underline text-amber-400 hover:text-amber-200"
                        >
                          Why is this pending?
                        </button>
                      </div>

                      {showWhyPending && (
                        <div className="p-3 bg-[#061406] border border-amber-700/60 rounded-xl text-amber-200/90 text-xs leading-relaxed space-y-1">
                          <p>
                            Your location and field boundary have been recorded. Official land ownership and parcel boundaries may need to be checked against government land records.
                          </p>
                        </div>
                      )}
                    </div>
                  </div>
                ) : (
                  <div className="bg-red-950/80 border border-red-700 rounded-2xl p-5 space-y-2 text-red-200 text-xs">
                    <p className="font-bold text-sm text-red-400 flex items-center gap-2">
                      <AlertTriangle className="w-4 h-4" /> Please resolve the following land check issues:
                    </p>
                    {!isPolygonClosed && <p>• Please draw around the complete field (minimum 3 points).</p>}
                    {isSelfIntersecting && <p>• Some boundary lines cross each other. Please adjust points.</p>}
                    {hasOverlap && <p>• ⚠️ This field appears to overlap another registered field.</p>}
                  </div>
                )}

                {/* Expandable Technical Details */}
                <div className="pt-1">
                  <button
                    type="button"
                    onClick={() => setShowTechnicalDetails(!showTechnicalDetails)}
                    className="text-xs text-emerald-400 hover:text-emerald-200 underline flex items-center gap-1 font-semibold"
                  >
                    {showTechnicalDetails ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                    {showTechnicalDetails ? "Hide technical details" : "View technical details"}
                  </button>

                  {showTechnicalDetails && (
                    <div className="mt-3 p-4 bg-[#061406] border border-emerald-800 rounded-xl text-xs space-y-2 font-mono text-emerald-400">
                      <p>Farmer Current GPS: {farmerCurrentLocation?.latitude ? `${farmerCurrentLocation.latitude.toFixed(6)}, ${farmerCurrentLocation.longitude?.toFixed(6)}` : "Not Captured / Away"}</p>
                      <p>Insured Farm Location: {insuredFarmLocation ? `${insuredFarmLocation[0].toFixed(6)}, ${insuredFarmLocation[1].toFixed(6)}` : "None"}</p>
                      <p>Boundary Points: {points.length}</p>
                      <p>Distance (GPS to Farm): {distanceEval.distanceMeters !== null ? `${distanceEval.distanceMeters}m` : "N/A"}</p>
                      <p>Verification Status: PENDING_OFFICIAL_VERIFICATION</p>
                    </div>
                  )}
                </div>

                <div className="flex gap-3 pt-2">
                  <button
                    type="button"
                    onClick={() => setActiveStep(4)}
                    className="px-4 py-3 bg-[#133513] hover:bg-[#1b4f1b] border border-emerald-700 text-emerald-300 font-bold rounded-xl transition flex items-center gap-1"
                  >
                    <ArrowLeft className="w-4 h-4" /> Edit Boundary
                  </button>
                  <button
                    type="button"
                    disabled={!isLandCheckValid}
                    onClick={() => setActiveStep(6)}
                    className="flex-1 py-3 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 text-slate-950 font-extrabold rounded-xl transition flex items-center justify-center gap-2 shadow-lg text-base"
                  >
                    NEXT: REVIEW & SUBMIT <ArrowRight className="w-5 h-5" />
                  </button>
                </div>
              </div>
            </motion.div>
          )}

          {/* STEP 6: REVIEW & SUBMIT */}
          {activeStep === 6 && (
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
              <div className="bg-[#0c240c] border border-emerald-800 rounded-2xl p-6 shadow-xl space-y-4">
                <h2 className="text-xl font-bold text-white flex items-center gap-2 border-b border-emerald-800/80 pb-3">
                  🔍 REVIEW MY FARM
                </h2>

                <div className="bg-[#061406] border border-emerald-800 rounded-xl p-5 space-y-3 text-sm">
                  <div className="flex justify-between border-b border-emerald-900/60 pb-2">
                    <span className="text-emerald-400">Farm Name:</span>
                    <span className="font-bold text-white">{watch("name")}</span>
                  </div>
                  <div className="flex justify-between border-b border-emerald-900/60 pb-2">
                    <span className="text-emerald-400">Crop:</span>
                    <span className="text-emerald-200">{watch("crop_type")}</span>
                  </div>
                  <div className="flex justify-between border-b border-emerald-900/60 pb-2">
                    <span className="text-emerald-400">Sowing Date:</span>
                    <span className="text-emerald-200">{watch("sowing_date")}</span>
                  </div>
                  <div className="flex justify-between border-b border-emerald-900/60 pb-2">
                    <span className="text-emerald-400">Village:</span>
                    <span className="text-emerald-200">{villageVal}, {districtVal}</span>
                  </div>
                  <div className="flex justify-between border-b border-emerald-900/60 pb-2">
                    <span className="text-emerald-400">Land Record ID:</span>
                    <span className="font-mono text-emerald-300">{watch("khasra_number")}</span>
                  </div>
                  <div className="flex justify-between border-b border-emerald-900/60 pb-2">
                    <span className="text-emerald-400">Insurance Policy:</span>
                    <span className="font-mono text-emerald-300">{watch("insurance_policy_number")}</span>
                  </div>
                  <div className="flex justify-between border-b border-emerald-900/60 pb-2">
                    <span className="text-emerald-400">Field Area:</span>
                    <span className="font-bold text-emerald-300">{calculatedArea} ha ({calculateAreaAcres(calculatedArea)} acres)</span>
                  </div>

                  <div className="pt-2 text-xs text-emerald-300 space-y-1">
                    <p className="flex items-center gap-1.5"><Check className="w-4 h-4 text-emerald-400" /> Insured land location captured</p>
                    <p className="flex items-center gap-1.5"><Check className="w-4 h-4 text-emerald-400" /> Field boundary captured</p>
                    <p className="flex items-center gap-1.5"><Check className="w-4 h-4 text-emerald-400" /> Land check completed</p>
                  </div>

                  <div className="pt-2 flex justify-between items-center border-t border-emerald-800/80">
                    <span className="text-emerald-400 text-xs">Status:</span>
                    <span className="px-3 py-1 bg-amber-950/80 border border-amber-600/80 text-amber-300 text-xs font-semibold rounded-full">
                      🟡 Official verification pending
                    </span>
                  </div>
                </div>

                <p className="text-[11px] text-emerald-500 italic bg-[#061406] p-3 rounded-lg border border-emerald-900/60">
                  "GPS and satellite imagery are used to identify the selected agricultural plot. Legal ownership and official parcel boundaries must be verified using applicable land records."
                </p>

                <div className="flex gap-3 pt-2">
                  <button
                    type="button"
                    onClick={() => setActiveStep(5)}
                    className="px-4 py-3 bg-[#133513] hover:bg-[#1b4f1b] border border-emerald-700 text-emerald-300 font-bold rounded-xl transition flex items-center gap-1"
                  >
                    ← EDIT
                  </button>
                  <button
                    type="button"
                    disabled={createFarmMutation.isPending}
                    onClick={onConfirmSubmit}
                    className="flex-1 py-3 bg-emerald-600 hover:bg-emerald-500 text-slate-950 font-extrabold rounded-xl transition flex items-center justify-center gap-2 shadow-lg text-base"
                  >
                    {createFarmMutation.isPending ? "Submitting..." : "✓ SUBMIT FARM"}
                  </button>
                </div>
              </div>
            </motion.div>
          )}

        </div>

        {/* RIGHT COLUMN: SATELLITE MAP INTERACTION VIEW */}
        <div className="lg:col-span-6 space-y-6">
          <div className="bg-[#0c240c] border border-emerald-800 rounded-2xl p-4 shadow-xl space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <LandPlot className="w-4 h-4 text-emerald-400" /> Satellite Boundary View
              </h3>
              <span className="text-xs text-emerald-400 font-mono">Esri Satellite</span>
            </div>

            <MapComponent
              points={points}
              setPoints={setPoints}
              existingFarms={farmsList}
              onLocationSelect={handleLocationSelect}
              targetLocationQuery={locationQuery}
              targetCoordinates={targetCoords}
              farmerCurrentLocation={farmerCurrentLocation}
              insuredFarmLocation={insuredFarmLocation}
              setInsuredFarmLocation={setInsuredFarmLocation}
              mode={activeStep === 2 || activeStep === 3 ? "mark" : activeStep === 4 ? "draw" : "view"}
              locationOption={locationChoice || "at_field"}
              isSelfIntersecting={isSelfIntersecting}
              hasOverlap={hasOverlap}
              activeStep={activeStep}
            />
          </div>
        </div>
      </div>

      {/* REGISTERED FARM CARDS LIST */}
      <div className="max-w-7xl mx-auto space-y-4 pt-6">
        <h2 className="text-2xl font-extrabold text-white flex items-center gap-2">
          🌾 Registered Farm Boundaries ({farmsList.length})
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {farmsList.map((farm) => (
            <motion.div
              key={`farm-card-${farm.id}`}
              whileHover={{ y: -4 }}
              className="bg-[#0c240c] border border-emerald-800/80 rounded-2xl p-5 space-y-4 shadow-xl flex flex-col justify-between"
            >
              <div className="space-y-3">
                <div className="flex items-start justify-between">
                  <h3 className="text-lg font-bold text-white flex items-center gap-2">
                    🌾 {farm.name}
                  </h3>
                  <span className="px-2.5 py-0.5 bg-emerald-950 border border-emerald-700 text-emerald-300 text-xs font-semibold rounded-full">
                    {farm.crop_type}
                  </span>
                </div>

                <div className="space-y-1.5 text-xs text-emerald-300">
                  <p>📍 Location: <span className="text-white font-medium">{farm.village}, {farm.district}</span></p>
                  <p>📐 Area: <span className="text-emerald-400 font-bold">{farm.area_hectares} hectares</span> ({calculateAreaAcres(farm.area_hectares || 0)} acres)</p>
                  <p>🧾 Land Record: <span className="font-mono text-white">{farm.khasra_number || "223/4"}</span></p>
                  <p>🛡 Insurance Scheme: <span className="font-bold text-white">{"insurance_scheme" in farm && farm.insurance_scheme ? farm.insurance_scheme : "PMFBY"}</span></p>
                  <p>📄 Policy Number: <span className="font-mono text-white">{farm.insurance_policy_number || "INS-772819"}</span></p>
                </div>

                <div className="pt-1 flex flex-wrap gap-1.5">
                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 bg-emerald-950 border border-emerald-500 text-emerald-300 text-xs font-semibold rounded-full">
                    🟢 Active Policy
                  </span>
                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 bg-amber-950/80 border border-amber-600/80 text-amber-300 text-xs font-semibold rounded-full">
                    🟡 Pending Official Verification
                  </span>
                </div>
              </div>

              <div className="flex gap-2 pt-2 border-t border-emerald-900/60">
                <button
                  type="button"
                  onClick={() => {
                    setSelectedFarm3D(farm);
                    setIs3DModalOpen(true);
                  }}
                  className="flex-1 py-2 bg-[#133513] hover:bg-[#1b4f1b] border border-emerald-700 text-emerald-300 text-xs font-bold rounded-lg transition flex items-center justify-center gap-1"
                >
                  <Eye className="w-3.5 h-3.5" /> View Farm
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setSelectedFarm3D(farm);
                    setIs3DModalOpen(true);
                  }}
                  className="flex-1 py-2 bg-emerald-950 hover:bg-emerald-900 border border-emerald-600 text-emerald-400 text-xs font-bold rounded-lg transition flex items-center justify-center gap-1"
                >
                  <Box className="w-3.5 h-3.5" /> View Evidence
                </button>
              </div>
            </motion.div>
          ))}
        </div>
      </div>

      {/* 3D TERRAIN MODAL VISUALIZER */}
      <AnimatePresence>
        {is3DModalOpen && selectedFarm3D && (
          <div className="fixed inset-0 z-[5000] flex items-center justify-center bg-black/80 backdrop-blur-md p-4">
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-[#0a1f0a] border border-emerald-600 rounded-2xl w-full max-w-5xl h-[85vh] flex flex-col overflow-hidden shadow-2xl"
            >
              <div className="flex items-center justify-between p-4 border-b border-emerald-800 bg-[#061406]">
                <div className="flex items-center gap-3">
                  <Box className="w-6 h-6 text-emerald-400" />
                  <div>
                    <h3 className="text-lg font-bold text-white">{selectedFarm3D.name}</h3>
                    <p className="text-xs text-emerald-400">{selectedFarm3D.crop_type} • {selectedFarm3D.area_hectares} ha</p>
                  </div>
                </div>
                <button
                  onClick={() => setIs3DModalOpen(false)}
                  className="p-2 hover:bg-emerald-900 rounded-lg text-emerald-400 transition"
                >
                  ✕
                </button>
              </div>

              <div className="flex gap-2 p-3 bg-[#061406] border-b border-emerald-900">
                <button
                  onClick={() => setModalTab("terrain")}
                  className={`px-4 py-1.5 rounded-lg text-xs font-bold transition ${
                    modalTab === "terrain" ? "bg-emerald-600 text-slate-950" : "bg-[#133513] text-emerald-300"
                  }`}
                >
                  3D Extruded Terrain
                </button>
                <button
                  onClick={() => setModalTab("cube")}
                  className={`px-4 py-1.5 rounded-lg text-xs font-bold transition ${
                    modalTab === "cube" ? "bg-emerald-600 text-slate-950" : "bg-[#133513] text-emerald-300"
                  }`}
                >
                  3D Feature Cube
                </button>
              </div>

              <div className="flex-1 relative bg-black">
                {modalTab === "terrain" && (
                  <FarmTerrain3D
                    farmId={selectedFarm3D.id}
                    farmName={selectedFarm3D.name}
                    cropType={selectedFarm3D.crop_type}
                    boundaryCoordinates={selectedFarm3D.boundary?.coordinates?.[0] || []}
                    hasWebGL={hasWebGL}
                  />
                )}
                {modalTab === "cube" && (
                  <FeatureCube3D
                    farmId={selectedFarm3D.id}
                    farmName={selectedFarm3D.name}
                    cropType={selectedFarm3D.crop_type}
                    areaHectares={selectedFarm3D.area_hectares}
                    sowingDate={selectedFarm3D.sowing_date}
                  />
                )}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}

export default function FarmerFarmsPage() {
  return (
    <QueryClientProvider client={queryClient}>
      <DashboardContent />
    </QueryClientProvider>
  );
}
