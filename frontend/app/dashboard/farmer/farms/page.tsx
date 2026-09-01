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
  PlusCircle,
  Trash2,
  CheckCircle2,
  Box,
  Eye,
  X,
  HelpCircle,
  Layers,
  Globe,
  Navigation,
  MapPin,
  AlertTriangle,
  ShieldCheck,
  FileText,
  Clock,
  History,
  Check,
  AlertCircle,
  ExternalLink,
  ChevronRight
} from "lucide-react";
import { Farm } from "@/components/MapComponent";
import { HoloCard } from "@/components/ui/HoloCard";
import FarmTerrain3D from "@/components/maps/FarmTerrain3D";
import FeatureCube3D from "@/components/features/FeatureCube3D";
import { INDIA_LOCATION_DATA } from "@/lib/indiaLocations";
import {
  calculateHaversineDistance,
  isPointInPolygon,
  isPolygonSelfIntersecting,
  hectaresToAcres,
  checkPolygonOverlap,
  OverlapResult
} from "@/lib/spatialUtils";
import {
  InsuredLandSnapshot,
  BoundaryVersion,
  ParcelVerificationService,
  AuditLogEntry
} from "@/lib/parcelVerificationService";

// Dynamically import Leaflet MapComponent to disable Server-Side Rendering (SSR)
const MapComponent = dynamic(() => import("@/components/MapComponent"), {
  ssr: false,
  loading: () => (
    <div className="w-full h-[480px] bg-slate-900 animate-pulse border border-emerald-800 rounded-lg flex items-center justify-center">
      <span className="text-[#22c55e] font-medium flex items-center gap-2">
        <Globe className="w-5 h-5 animate-spin" /> Loading Esri High-Resolution Satellite Map...
      </span>
    </div>
  ),
});

// Create TanStack Query Client
const queryClient = new QueryClient();

// Enhanced Zod Validation Schema
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

export interface ExtendedFarm extends Farm {
  gps_latitude?: number | null;
  gps_longitude?: number | null;
  gps_accuracy_meters?: number | null;
  center_pin_latitude?: number | null;
  center_pin_longitude?: number | null;
  verification_status?: string;
  overlap_status?: string;
  current_version?: number;
  snapshots?: InsuredLandSnapshot[];
  boundary_versions?: BoundaryVersion[];
  audit_logs?: AuditLogEntry[];
}

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
  return Math.abs(area / 2) / 10000;
}

// Subcomponent encapsulating dashboard UI logic
function DashboardContent() {
  const queryClientRef = useQueryClient();
  const [points, setPoints] = useState<[number, number][]>([]);
  const [calculatedArea, setCalculatedArea] = useState<number>(0);
  const [localFarms, setLocalFarms] = useState<ExtendedFarm[]>([]);

  // Instant map coordinates target
  const [targetCoords, setTargetCoords] = useState<{ lat: number; lng: number; zoom?: number } | null>(null);

  // New Verification & Land Identification States
  const [gpsLocation, setGpsLocation] = useState<{ lat: number; lng: number; accuracy: number | null } | null>(null);
  const [landCenterPin, setLandCenterPin] = useState<[number, number] | null>(null);
  const [isMarkPinMode, setIsMarkPinMode] = useState<boolean>(false);
  const [isReviewModalOpen, setIsReviewModalOpen] = useState<boolean>(false);
  const [selectedSnapshotFarm, setSelectedSnapshotFarm] = useState<ExtendedFarm | null>(null);
  const [isSnapshotModalOpen, setIsSnapshotModalOpen] = useState<boolean>(false);
  const [isVersionsModalOpen, setIsVersionsModalOpen] = useState<boolean>(false);
  const [validationErrors, setValidationErrors] = useState<string[]>([]);

  // 3D Visualizer States
  const [hasWebGL, setHasWebGL] = useState(true);
  const [selectedFarm3D, setSelectedFarm3D] = useState<ExtendedFarm | null>(null);
  const [is3DModalOpen, setIs3DModalOpen] = useState(false);
  const [modalTab, setModalTab] = useState<"terrain" | "cube" | "compare">("terrain");

  // WebGL support check
  useEffect(() => {
    try {
      const canvas = document.createElement("canvas");
      setHasWebGL(
        !!(window.WebGLRenderingContext && (canvas.getContext("webgl") || canvas.getContext("experimental-webgl")))
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
    watch,
    getValues,
    formState: { errors, isSubmitting },
  } = useForm<FarmFormData>({
    resolver: zodResolver(farmSchema),
    defaultValues: {
      state: "Tamil Nadu",
      district: "Coimbatore",
      taluka: "Kinathukadavu",
      village: "Basdhara",
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
    const selectedState = e.target.value;
    setValue("state", selectedState, { shouldValidate: true });
    setValue("district", "", { shouldValidate: true });
    setValue("taluka", "", { shouldValidate: true });
    setValue("village", "", { shouldValidate: true });
    const stateData = INDIA_LOCATION_DATA[selectedState];
    if (stateData) {
      setTargetCoords({ lat: stateData.lat, lng: stateData.lng, zoom: 7 });
    }
  };

  const handleDistrictChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const selectedDistrict = e.target.value;
    setValue("district", selectedDistrict, { shouldValidate: true });
    setValue("taluka", "", { shouldValidate: true });
    setValue("village", "", { shouldValidate: true });
    const distData = currentStateData?.districts[selectedDistrict];
    if (distData) {
      setTargetCoords({ lat: distData.lat, lng: distData.lng, zoom: 11 });
    }
  };

  const handleTalukaChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const selectedTaluka = e.target.value;
    setValue("taluka", selectedTaluka, { shouldValidate: true });
    setValue("village", "", { shouldValidate: true });
    if (currentDistrictData) {
      setTargetCoords({ lat: currentDistrictData.lat, lng: currentDistrictData.lng, zoom: 13 });
    }
  };

  const locationQuery = [villageVal, talukaVal, districtVal, stateVal].filter(Boolean).join(", ");

  const handleLocationSelect = (loc: { state: string; district: string; taluka: string; village: string }) => {
    if (loc.state) setValue("state", loc.state, { shouldValidate: true });
    if (loc.district) setValue("district", loc.district, { shouldValidate: true });
    if (loc.taluka) setValue("taluka", loc.taluka, { shouldValidate: true });
    if (loc.village) setValue("village", loc.village, { shouldValidate: true });
  };

  // Update area when polygon points change
  useEffect(() => {
    const area = calculatePolygonAreaHectares(points);
    setCalculatedArea(area);
  }, [points]);

  // Load local cached farms on mount
  useEffect(() => {
    const cached = localStorage.getItem("agrisense_cached_farms");
    if (cached) {
      setLocalFarms(JSON.parse(cached));
    } else {
      const initialSeed: ExtendedFarm[] = [
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
          verification_status: "PENDING_OFFICIAL_VERIFICATION",
          overlap_status: "NONE",
          current_version: 1,
          gps_latitude: 29.55,
          gps_longitude: 76.97,
          gps_accuracy_meters: 8,
          center_pin_latitude: 29.55,
          center_pin_longitude: 76.97,
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
  const { data: dbFarms = [] } = useQuery<ExtendedFarm[]>({
    queryKey: ["farms"],
    queryFn: async () => {
      try {
        const res = await fetch("http://localhost:8000/api/v1/farms/");
        if (!res.ok) throw new Error("API Offline");
        return await res.json();
      } catch (err) {
        console.warn("FastAPI backend offline; reading cached farms from local storage.");
        const cached = localStorage.getItem("agrisense_cached_farms");
        return cached ? JSON.parse(cached) : [];
      }
    },
  });

  const farmsList = dbFarms.length > 0 ? dbFarms : localFarms;

  // Spatial calculations & validations
  const areaAcres = hectaresToAcres(calculatedArea);
  const vertexCount = points.length;
  const isSelfIntersecting = isPolygonSelfIntersecting(points);
  const isPinInside = landCenterPin && points.length >= 3 ? isPointInPolygon(landCenterPin, points) : true;

  const existingFarmsFormatted = farmsList.map((f) => {
    const coords = f.boundary?.coordinates?.[0]?.map((c) => [c[1], c[0]] as [number, number]) || [];
    return { id: f.id, name: f.name, coordinates: coords };
  });

  const overlapCheck: OverlapResult = checkPolygonOverlap(points, existingFarmsFormatted);

  const gpsDistanceMeters =
    gpsLocation && landCenterPin
      ? calculateHaversineDistance(gpsLocation.lat, gpsLocation.lng, landCenterPin[0], landCenterPin[1])
      : null;

  const MAX_GPS_DISTANCE_METERS = 1000;

  // Determine current active workflow step (1 to 7)
  let currentStep = 1;
  if (gpsLocation) currentStep = 2;
  if (gpsLocation && targetCoords) currentStep = 3;
  if (landCenterPin) currentStep = 4;
  if (points.length >= 3) currentStep = 5;

  // Comprehensive Form Validation before review/saving
  const validateFormAndLand = (): boolean => {
    const errs: string[] = [];

    if (points.length < 3) {
      errs.push("Minimum 3 boundary points required to trace field plot.");
    }
    if (calculatedArea <= 0) {
      errs.push("Calculated polygon area must be greater than zero.");
    }
    if (calculatedArea > 500) {
      errs.push("Calculated area exceeds maximum single farm boundary limit (500 ha).");
    }
    if (isSelfIntersecting) {
      errs.push("Polygon edges self-intersect. Please adjust vertices to form a simple closed polygon.");
    }
    if (!landCenterPin) {
      errs.push("Land Reference Pin missing. Click '📌 Mark My Land' to place the reference pin on your field.");
    } else if (!isPinInside) {
      errs.push("Land Reference Pin must be placed inside the final drawn field polygon boundary.");
    }

    setValidationErrors(errs);
    return errs.length === 0;
  };

  // Open Review Section
  const handleOpenReview = (formData: FarmFormData) => {
    if (validateFormAndLand()) {
      setIsReviewModalOpen(true);
    }
  };

  // Create Farm Mutation
  const createFarmMutation = useMutation({
    mutationFn: async (formData: FarmFormData) => {
      const boundaryGeoJSON = {
        type: "Polygon",
        coordinates: [points.map((p) => [p[1], p[0]])],
      };

      const payload = {
        name: formData.name,
        crop_type: formData.crop_type,
        sowing_date: formData.sowing_date,
        insurance_policy_number: formData.insurance_policy_number,
        khasra_number: formData.khasra_number,
        state: formData.state,
        district: formData.district,
        taluka: formData.taluka,
        village: formData.village,
        gps_latitude: gpsLocation?.lat || null,
        gps_longitude: gpsLocation?.lng || null,
        gps_accuracy_meters: gpsLocation?.accuracy || null,
        center_pin_latitude: landCenterPin ? landCenterPin[0] : null,
        center_pin_longitude: landCenterPin ? landCenterPin[1] : null,
        overlap_status: overlapCheck.overlapType,
        boundary_geojson: boundaryGeoJSON,
      };

      try {
        const res = await fetch("http://localhost:8000/api/v1/farms/", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        if (!res.ok) throw new Error("API Offline");
        return await res.json();
      } catch (err) {
        console.warn("Backend API offline; storing farm in local storage cache.");
        const newId = Date.now();
        const initialVersion: BoundaryVersion = {
          version: 1,
          boundaryGeoJSON,
          areaHectares: calculatedArea,
          areaAcres,
          createdAt: new Date().toISOString(),
          changeReason: "Initial farm boundary registration",
          isActive: true,
        };

        const snapshot = ParcelVerificationService.createSnapshot({
          farmId: newId,
          version: 1,
          farmName: formData.name,
          cropType: formData.crop_type,
          sowingDate: formData.sowing_date,
          state: formData.state,
          district: formData.district,
          taluka: formData.taluka,
          village: formData.village,
          khasraNumber: formData.khasra_number,
          insurancePolicyNumber: formData.insurance_policy_number,
          gpsLatitude: gpsLocation?.lat || null,
          gpsLongitude: gpsLocation?.lng || null,
          gpsAccuracyMeters: gpsLocation?.accuracy || null,
          centerPinLatitude: landCenterPin ? landCenterPin[0] : null,
          centerPinLongitude: landCenterPin ? landCenterPin[1] : null,
          boundaryGeoJSON,
          areaHectares: calculatedArea,
          areaAcres,
          boundaryVertexCount: vertexCount,
          overlapStatus: overlapCheck.overlapType,
          overlappingFarmIds: overlapCheck.overlappingFarmIds,
          verificationStatus: "PENDING_OFFICIAL_VERIFICATION",
          disclaimer: "GPS and satellite imagery are used to identify the selected agricultural plot. Legal ownership and official parcel boundaries must be verified using applicable land records.",
        });

        const newFarm: ExtendedFarm = {
          id: newId,
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
          overlap_status: overlapCheck.overlapType,
          current_version: 1,
          gps_latitude: gpsLocation?.lat || null,
          gps_longitude: gpsLocation?.lng || null,
          gps_accuracy_meters: gpsLocation?.accuracy || null,
          center_pin_latitude: landCenterPin ? landCenterPin[0] : null,
          center_pin_longitude: landCenterPin ? landCenterPin[1] : null,
          boundary: boundaryGeoJSON as { type: "Polygon"; coordinates: number[][][] },
          boundary_versions: [initialVersion],
          snapshots: [snapshot],
        };

        const updated = [...localFarms, newFarm];
        setLocalFarms(updated);
        localStorage.setItem("agrisense_cached_farms", JSON.stringify(updated));
        return newFarm;
      }
    },
    onSuccess: () => {
      queryClientRef.invalidateQueries({ queryKey: ["farms"] });
      reset();
      setPoints([]);
      setLandCenterPin(null);
      setGpsLocation(null);
      setIsReviewModalOpen(false);
      setValidationErrors([]);
    },
  });

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      {/* Module Title Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-emerald-950 pb-4">
        <div>
          <h1 className="text-2xl font-bold text-[#e2ebd5] tracking-tight flex items-center gap-2">
            <LandPlot className="w-7 h-7 text-emerald-400" />
            Farm Polygon Ingestion & Land Identification
          </h1>
          <p className="text-xs text-emerald-600 font-sans mt-1">
            Precision crop plot boundary mapping, GPS center-pin verification, and insurance evidence snapshotting.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <span className="px-3 py-1 bg-[#0a1f0a] border border-amber-500/50 text-amber-300 rounded-full text-xs font-semibold flex items-center gap-1.5 shadow-sm">
            <Clock className="w-3.5 h-3.5 text-amber-400 animate-pulse" /> Status: PENDING OFFICIAL VERIFICATION
          </span>
        </div>
      </div>

      {/* 7-STEP WORKFLOW STEPPER BAR */}
      <div className="bg-[#0a1f0a] border border-emerald-800 rounded-xl p-3 shadow-lg">
        <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-7 gap-2 text-center text-xs">
          {[
            { step: 1, label: "📍 Find Location", icon: Navigation, active: currentStep >= 1 },
            { step: 2, label: "🔎 Zoom Field", icon: Globe, active: currentStep >= 2 },
            { step: 3, label: "📌 Mark Land Pin", icon: MapPin, active: currentStep >= 3 },
            { step: 4, label: "🗺 Trace Boundary", icon: LandPlot, active: currentStep >= 4 },
            { step: 5, label: "✓ Spatial Check", icon: CheckCircle2, active: currentStep >= 5 },
            { step: 6, label: "🔍 Review Land", icon: ShieldCheck, active: isReviewModalOpen },
            { step: 7, label: "💾 Insure Plot", icon: PlusCircle, active: false },
          ].map((item) => (
            <div
              key={item.step}
              className={`p-2 rounded-lg border transition flex flex-col items-center gap-1 ${
                item.active
                  ? "bg-[#133513] border-emerald-500 text-emerald-200 font-semibold shadow-md"
                  : "bg-slate-900/50 border-emerald-900/50 text-slate-400"
              }`}
            >
              <item.icon className={`w-4 h-4 ${item.active ? "text-emerald-400" : "text-slate-500"}`} />
              <span className="text-[11px] leading-tight">{item.label}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* LEFT COLUMN: Registration Form & Verification Details Panel (5 cols) */}
        <div className="lg:col-span-5 space-y-6">
          {/* Main Form Card */}
          <div className="bg-[#0a1f0a] border border-emerald-800/80 rounded-xl p-5 shadow-xl space-y-4">
            <div className="flex items-center gap-2 border-b border-emerald-900 pb-3">
              <PlusCircle className="w-5 h-5 text-emerald-400" />
              <h2 className="text-base font-semibold text-[#e2ebd5]">Register Insured Farm</h2>
            </div>

            <form onSubmit={handleSubmit(handleOpenReview)} className="space-y-4">
              {/* Farm Name */}
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-emerald-400 mb-1">
                  Farm Name
                </label>
                <input
                  {...register("name")}
                  type="text"
                  placeholder="e.g. Basdhara Paddy Fields"
                  className="w-full bg-[#133513]/60 border border-emerald-700/80 rounded-md px-3 py-2 text-sm text-[#e2ebd5] placeholder-emerald-700 focus:outline-none focus:border-emerald-400"
                />
                {errors.name && <p className="text-red-400 text-xs mt-1">{errors.name.message}</p>}
              </div>

              {/* Crop & Sowing Date */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-emerald-400 mb-1">
                    Crop Type
                  </label>
                  <select
                    {...register("crop_type")}
                    className="w-full bg-[#133513]/60 border border-emerald-700/80 rounded-md px-3 py-2 text-sm text-[#e2ebd5] focus:outline-none focus:border-emerald-400"
                  >
                    <option value="Rice">Rice</option>
                    <option value="Wheat">Wheat</option>
                    <option value="Cotton">Cotton</option>
                    <option value="Sugarcane">Sugarcane</option>
                    <option value="Maize">Maize</option>
                    <option value="Mustard">Mustard</option>
                    <option value="Soybeans">Soybeans</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-emerald-400 mb-1">
                    Sowing Date
                  </label>
                  <input
                    {...register("sowing_date")}
                    type="date"
                    className="w-full bg-[#133513]/60 border border-emerald-700/80 rounded-md px-3 py-2 text-sm text-[#e2ebd5] focus:outline-none focus:border-emerald-400"
                  />
                  {errors.sowing_date && <p className="text-red-400 text-xs mt-1">{errors.sowing_date.message}</p>}
                </div>
              </div>

              {/* Khasra / Land Record ID & Insurance Policy Number */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-emerald-400 mb-1">
                    Khasra / Land Record ID
                  </label>
                  <input
                    {...register("khasra_number")}
                    type="text"
                    placeholder="e.g. 223/4"
                    className="w-full bg-[#133513]/60 border border-emerald-700/80 rounded-md px-3 py-2 text-sm text-[#e2ebd5] placeholder-emerald-700 focus:outline-none focus:border-emerald-400"
                  />
                  <p className="text-[10px] text-slate-400 mt-0.5">User Provided — Land Record ID</p>
                  {errors.khasra_number && <p className="text-red-400 text-xs mt-1">{errors.khasra_number.message}</p>}
                </div>

                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-emerald-400 mb-1">
                    Insurance Policy No.
                  </label>
                  <input
                    {...register("insurance_policy_number")}
                    type="text"
                    placeholder="e.g. INS-992812"
                    className="w-full bg-[#133513]/60 border border-emerald-700/80 rounded-md px-3 py-2 text-sm text-[#e2ebd5] placeholder-emerald-700 focus:outline-none focus:border-emerald-400"
                  />
                  {errors.insurance_policy_number && (
                    <p className="text-red-400 text-xs mt-1">{errors.insurance_policy_number.message}</p>
                  )}
                </div>
              </div>

              {/* Cascading Location Hierarchy (State, District, Taluka, Village) */}
              <div className="space-y-3 bg-[#061506] p-3 rounded-lg border border-emerald-900">
                <p className="text-xs font-semibold text-emerald-300 uppercase tracking-wider flex items-center gap-1">
                  📍 Location Hierarchy
                </p>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] font-medium text-emerald-500 mb-1">State</label>
                    <select
                      value={stateVal}
                      onChange={handleStateChange}
                      className="w-full bg-[#133513]/80 border border-emerald-700/80 rounded px-2.5 py-1.5 text-xs text-[#e2ebd5] focus:outline-none"
                    >
                      {Object.keys(INDIA_LOCATION_DATA).map((st) => (
                        <option key={st} value={st}>
                          {st}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-[11px] font-medium text-emerald-500 mb-1">District</label>
                    <select
                      value={districtVal}
                      onChange={handleDistrictChange}
                      className="w-full bg-[#133513]/80 border border-emerald-700/80 rounded px-2.5 py-1.5 text-xs text-[#e2ebd5] focus:outline-none"
                    >
                      <option value="">-- Select District --</option>
                      {availableDistricts.map((dst) => (
                        <option key={dst} value={dst}>
                          {dst}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] font-medium text-emerald-500 mb-1">Taluka / Tehsil</label>
                    <select
                      value={talukaVal}
                      onChange={handleTalukaChange}
                      className="w-full bg-[#133513]/80 border border-emerald-700/80 rounded px-2.5 py-1.5 text-xs text-[#e2ebd5] focus:outline-none"
                    >
                      <option value="">-- Select Taluka --</option>
                      {availableTalukas.map((tlk) => (
                        <option key={tlk} value={tlk}>
                          {tlk}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-[11px] font-medium text-emerald-500 mb-1">Village</label>
                    <input
                      {...register("village")}
                      type="text"
                      placeholder="e.g. Basdhara"
                      className="w-full bg-[#133513]/80 border border-emerald-700/80 rounded px-2.5 py-1.5 text-xs text-[#e2ebd5] placeholder-emerald-700 focus:outline-none"
                    />
                  </div>
                </div>
              </div>

              {/* Live Area Output Card */}
              <div className="bg-[#051305] border border-emerald-800/90 rounded-lg p-3 flex items-center justify-between shadow-inner">
                <div>
                  <p className="text-[11px] font-medium text-emerald-500 uppercase tracking-wider">Calculated Field Plot Area</p>
                  <p className="text-lg font-bold text-[#22c55e]">
                    {calculatedArea.toFixed(2)} Hectares{" "}
                    <span className="text-xs text-emerald-400 font-normal">({areaAcres.toFixed(2)} Acres)</span>
                  </p>
                </div>
                <div className="text-right">
                  <span className="text-xs text-slate-400">Boundary Vertices</span>
                  <p className="text-sm font-bold text-emerald-300">{vertexCount} Points</p>
                </div>
              </div>

              {/* Validation Warnings Box */}
              {validationErrors.length > 0 && (
                <div className="bg-red-950/80 border border-red-700 text-red-200 text-xs p-3 rounded-lg space-y-1">
                  <p className="font-bold flex items-center gap-1">
                    <AlertTriangle className="w-4 h-4 text-red-400" /> Action Required Before Saving:
                  </p>
                  <ul className="list-disc pl-4 space-y-0.5 text-[11px]">
                    {validationErrors.map((err, i) => (
                      <li key={i}>{err}</li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Review & Submit Button */}
              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full py-2.5 bg-[#22c55e] hover:bg-[#16a34a] text-slate-950 font-bold rounded-lg transition shadow-lg flex items-center justify-center gap-2 text-sm"
              >
                <ShieldCheck className="w-4 h-4" /> Review Insured Plot & Save
              </button>
            </form>
          </div>

          {/* LAND VERIFICATION DETAILS PANEL */}
          <div className="bg-[#0a1f0a] border border-emerald-800/80 rounded-xl p-5 shadow-xl space-y-4">
            <div className="flex items-center justify-between border-b border-emerald-900 pb-3">
              <h3 className="text-sm font-bold text-[#e2ebd5] flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-emerald-400" /> Land Verification Checklist
              </h3>
              <span className="px-2 py-0.5 bg-amber-950 text-amber-300 border border-amber-600/60 rounded text-[10px] font-bold">
                🟡 PENDING
              </span>
            </div>

            <div className="space-y-2 text-xs font-sans">
              {/* Checklist Items */}
              <div className="flex items-center justify-between bg-[#061506] p-2 rounded border border-emerald-900">
                <span className="flex items-center gap-1.5 text-slate-300">
                  {gpsLocation ? <CheckCircle2 className="w-4 h-4 text-emerald-400" /> : <AlertCircle className="w-4 h-4 text-slate-500" />}
                  GPS Location Captured
                </span>
                <span className="text-slate-400 text-[11px]">
                  {gpsLocation ? `${gpsLocation.lat.toFixed(4)}, ${gpsLocation.lng.toFixed(4)} (±${gpsLocation.accuracy}m)` : "Not Captured"}
                </span>
              </div>

              <div className="flex items-center justify-between bg-[#061506] p-2 rounded border border-emerald-900">
                <span className="flex items-center gap-1.5 text-slate-300">
                  {landCenterPin ? <CheckCircle2 className="w-4 h-4 text-emerald-400" /> : <AlertCircle className="w-4 h-4 text-slate-500" />}
                  Center Pin Added inside Field
                </span>
                <span className={isPinInside ? "text-emerald-400 text-[11px]" : "text-red-400 text-[11px] font-bold"}>
                  {landCenterPin ? (isPinInside ? "Inside Boundary ✓" : "⚠️ Outside Polygon!") : "Missing"}
                </span>
              </div>

              <div className="flex items-center justify-between bg-[#061506] p-2 rounded border border-emerald-900">
                <span className="flex items-center gap-1.5 text-slate-300">
                  {vertexCount >= 3 && !isSelfIntersecting ? (
                    <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                  ) : (
                    <AlertCircle className="w-4 h-4 text-amber-400" />
                  )}
                  Boundary Validated
                </span>
                <span className="text-slate-400 text-[11px]">
                  {vertexCount >= 3 ? (isSelfIntersecting ? "⚠️ Self-Intersecting" : `${vertexCount} Vertices`) : "Incomplete"}
                </span>
              </div>

              {/* Overlap Status Check */}
              <div className="flex items-center justify-between bg-[#061506] p-2 rounded border border-emerald-900">
                <span className="flex items-center gap-1.5 text-slate-300">
                  {overlapCheck.overlapType === "NONE" ? (
                    <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                  ) : overlapCheck.overlapType === "PARTIAL" ? (
                    <AlertTriangle className="w-4 h-4 text-amber-400" />
                  ) : (
                    <AlertTriangle className="w-4 h-4 text-red-500" />
                  )}
                  Existing Boundary Conflict
                </span>
                <span className="text-[11px]">
                  {overlapCheck.overlapType === "NONE" && <span className="text-emerald-400">✓ Clear</span>}
                  {overlapCheck.overlapType === "PARTIAL" && (
                    <span className="text-amber-400 font-bold">⚠️ Potential Conflict</span>
                  )}
                  {overlapCheck.overlapType === "SIGNIFICANT" && (
                    <span className="text-red-400 font-bold">🔴 Significant Conflict</span>
                  )}
                </span>
              </div>

              {/* Distance Check Output */}
              {gpsDistanceMeters !== null && (
                <div className="p-2 bg-[#061506] rounded border border-emerald-900 flex items-center justify-between">
                  <span className="text-slate-300">GPS ↔ Land Pin Distance:</span>
                  <span
                    className={
                      gpsDistanceMeters > MAX_GPS_DISTANCE_METERS
                        ? "text-amber-400 font-bold"
                        : "text-emerald-400 font-semibold"
                    }
                  >
                    {gpsDistanceMeters} meters
                  </span>
                </div>
              )}

              {gpsDistanceMeters !== null && gpsDistanceMeters > MAX_GPS_DISTANCE_METERS && (
                <p className="text-[11px] text-amber-300 bg-amber-950/60 p-2 rounded border border-amber-700/60">
                  ⚠️ GPS position and land center pin are {gpsDistanceMeters}m apart. Please verify that the center pin is inside your field.
                </p>
              )}
            </div>
          </div>
        </div>

        {/* RIGHT COLUMN: Satellite Map Component & Registered Farm Cards (7 cols) */}
        <div className="lg:col-span-7 space-y-6">
          {/* Esri Satellite Map Component */}
          <div className="bg-[#0a1f0a] border border-emerald-800 rounded-xl p-2 shadow-2xl space-y-2">
            <MapComponent
              points={points}
              setPoints={setPoints}
              existingFarms={farmsList}
              onLocationSelect={handleLocationSelect}
              targetLocationQuery={locationQuery}
              targetCoordinates={targetCoords}
              gpsLocation={gpsLocation}
              setGpsLocation={setGpsLocation}
              landCenterPin={landCenterPin}
              setLandCenterPin={setLandCenterPin}
              isMarkPinMode={isMarkPinMode}
              setIsMarkPinMode={setIsMarkPinMode}
              overlappingFarmIds={overlapCheck.overlappingFarmIds}
              overlapType={overlapCheck.overlapType}
              currentStep={currentStep}
            />

            <p className="text-[11px] text-slate-400 px-2 py-1 italic border-t border-emerald-950 flex items-center justify-between">
              <span>* High-Resolution Esri Satellite Imagery Base Layer.</span>
              <span className="text-emerald-500 not-italic font-medium">Click map to trace vertices.</span>
            </p>
          </div>

          {/* Registered Farm Boundaries List */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-base font-bold text-[#e2ebd5] flex items-center gap-2">
                <Box className="w-5 h-5 text-emerald-400" /> Registered Insured Plot Cards ({farmsList.length})
              </h2>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {farmsList.map((farm) => (
                <HoloCard key={farm.id} className="p-4 space-y-3 bg-[#0a1f0a]/90 border border-emerald-800/90 rounded-xl">
                  <div className="flex items-start justify-between">
                    <div>
                      <h3 className="font-bold text-[#22c55e] text-base">{farm.name}</h3>
                      <p className="text-xs text-slate-300 mt-0.5">
                        Crop: <span className="font-semibold text-emerald-300">{farm.crop_type}</span>
                      </p>
                    </div>
                    <span className="px-2 py-0.5 bg-amber-950/80 border border-amber-600 text-amber-300 text-[10px] font-bold rounded">
                      🟡 Pending Official Verification
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-xs font-sans text-slate-300 border-t border-b border-emerald-950 py-2">
                    <div>
                      <span className="text-slate-400 block text-[10px]">AREA</span>
                      <span className="font-semibold text-emerald-300">
                        {farm.area_hectares} ha ({hectaresToAcres(farm.area_hectares || 0)} acres)
                      </span>
                    </div>
                    <div>
                      <span className="text-slate-400 block text-[10px]">KHASRA / LAND ID</span>
                      <span className="font-semibold text-emerald-300">{farm.khasra_number || "223/4"}</span>
                    </div>
                    <div>
                      <span className="text-slate-400 block text-[10px]">LOCATION</span>
                      <span className="truncate block">{farm.village || "Basdhara"}, {farm.district || "Karnal"}</span>
                    </div>
                    <div>
                      <span className="text-slate-400 block text-[10px]">POLICY NO.</span>
                      <span className="truncate block text-slate-200">{farm.insurance_policy_number}</span>
                    </div>
                  </div>

                  <div className="flex items-center justify-between pt-1">
                    <button
                      onClick={() => {
                        setSelectedFarm3D(farm);
                        setIs3DModalOpen(true);
                      }}
                      className="px-2.5 py-1 bg-[#133513] hover:bg-[#1b4f1b] text-emerald-300 border border-emerald-700 text-xs font-medium rounded transition flex items-center gap-1"
                    >
                      <Box className="w-3.5 h-3.5" /> 3D Terrain
                    </button>

                    <button
                      onClick={() => {
                        setSelectedSnapshotFarm(farm);
                        setIsSnapshotModalOpen(true);
                      }}
                      className="px-2.5 py-1 bg-blue-950 hover:bg-blue-900 text-blue-200 border border-blue-700 text-xs font-medium rounded transition flex items-center gap-1"
                    >
                      <FileText className="w-3.5 h-3.5" /> Evidence Snapshot
                    </button>
                  </div>
                </HoloCard>
              ))}
            </div>
          </div>

          {/* Mandatory Professional Disclaimer Banner */}
          <div className="bg-[#051305] border border-emerald-900 rounded-lg p-3 text-[11px] text-slate-400 flex items-start gap-2 shadow-sm">
            <ShieldCheck className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
            <p className="leading-tight">
              <strong>Professional Disclaimer:</strong> GPS and satellite imagery are used to identify the selected agricultural plot. Legal ownership and official parcel boundaries must be verified using applicable land records.
            </p>
          </div>
        </div>
      </div>

      {/* MODAL 1: 🔍 REVIEW INSURED LAND BEFORE SAVING */}
      <AnimatePresence>
        {isReviewModalOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[2000] bg-black/80 backdrop-blur-md flex items-center justify-center p-4"
          >
            <motion.div
              initial={{ scale: 0.95 }}
              animate={{ scale: 1 }}
              exit={{ scale: 0.95 }}
              className="bg-[#0a1f0a] border border-emerald-600 rounded-xl p-6 max-w-lg w-full space-y-5 shadow-2xl text-[#e2ebd5]"
            >
              <div className="flex items-center justify-between border-b border-emerald-800 pb-3">
                <h3 className="text-lg font-bold text-[#22c55e] flex items-center gap-2">
                  <ShieldCheck className="w-5 h-5" /> 🔍 REVIEW INSURED LAND
                </h3>
                <button onClick={() => setIsReviewModalOpen(false)} className="p-1 hover:bg-emerald-900 rounded text-slate-400 hover:text-white">
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="space-y-3 text-xs font-sans bg-[#061506] p-4 rounded-lg border border-emerald-900">
                <div className="grid grid-cols-2 gap-3 border-b border-emerald-900 pb-3">
                  <div>
                    <span className="text-slate-400 block text-[10px]">FARM NAME</span>
                    <span className="font-bold text-emerald-300 text-sm">{getValues("name")}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[10px]">CROP TYPE</span>
                    <span className="font-semibold text-emerald-300">{getValues("crop_type")}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[10px]">KHASRA / LAND RECORD ID</span>
                    <span className="font-bold text-amber-300">{getValues("khasra_number")}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[10px]">INSURANCE POLICY</span>
                    <span className="font-semibold text-slate-200">{getValues("insurance_policy_number")}</span>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3 border-b border-emerald-900 pb-3">
                  <div>
                    <span className="text-slate-400 block text-[10px]">GPS LOCATION</span>
                    <span>
                      {gpsLocation ? `${gpsLocation.lat.toFixed(5)}, ${gpsLocation.lng.toFixed(5)}` : "Not Captured"}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[10px]">GPS ACCURACY</span>
                    <span>{gpsLocation?.accuracy ? `±${gpsLocation.accuracy} meters` : "N/A"}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[10px]">SELECTED AREA</span>
                    <span className="font-bold text-emerald-400">
                      {calculatedArea.toFixed(2)} ha ({areaAcres.toFixed(2)} acres)
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[10px]">BOUNDARY POINTS</span>
                    <span>{vertexCount} Vertices</span>
                  </div>
                </div>

                {gpsDistanceMeters !== null && (
                  <div className="flex items-center justify-between pt-1">
                    <span className="text-slate-400">GPS ↔ Land Pin Distance:</span>
                    <span className={gpsDistanceMeters > MAX_GPS_DISTANCE_METERS ? "text-amber-400 font-bold" : "text-emerald-400 font-semibold"}>
                      {gpsDistanceMeters} meters
                    </span>
                  </div>
                )}

                {/* Overlap Status Warning */}
                {overlapCheck.overlapType !== "NONE" && (
                  <div className="p-2.5 bg-amber-950/80 border border-amber-600 rounded text-amber-200 text-xs">
                    <p className="font-bold flex items-center gap-1">
                      <AlertTriangle className="w-4 h-4 text-amber-400" /> Potential Boundary Conflict Detected:
                    </p>
                    <p className="text-[11px] mt-0.5">
                      This boundary overlaps an existing registered farm by ~{overlapCheck.maxOverlapPercentage}%. Manual verification is recommended before final insurance claim processing.
                    </p>
                  </div>
                )}

                <div className="flex items-center justify-between pt-2 border-t border-emerald-900 text-[11px]">
                  <span className="text-slate-400">Verification Status:</span>
                  <span className="px-2 py-0.5 bg-amber-950 border border-amber-600 text-amber-300 font-bold rounded">
                    🟡 Pending Official Land Verification
                  </span>
                </div>
              </div>

              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setIsReviewModalOpen(false)}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-xs font-semibold"
                >
                  Edit Boundary
                </button>

                <button
                  type="button"
                  onClick={() => createFarmMutation.mutate(getValues())}
                  disabled={createFarmMutation.isPending}
                  className="px-5 py-2 bg-[#22c55e] hover:bg-[#16a34a] text-slate-950 font-bold rounded-lg text-xs transition flex items-center gap-1.5 shadow-lg"
                >
                  {createFarmMutation.isPending ? "Saving..." : "✓ Confirm & Save Farm"}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* MODAL 2: 📷 INSURED PARCEL EVIDENCE SNAPSHOT VIEW */}
      <AnimatePresence>
        {isSnapshotModalOpen && selectedSnapshotFarm && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[2000] bg-black/80 backdrop-blur-md flex items-center justify-center p-4"
          >
            <motion.div
              initial={{ scale: 0.95 }}
              animate={{ scale: 1 }}
              exit={{ scale: 0.95 }}
              className="bg-[#0a1f0a] border border-blue-600 rounded-xl p-6 max-w-xl w-full space-y-4 shadow-2xl text-[#e2ebd5]"
            >
              <div className="flex items-center justify-between border-b border-emerald-800 pb-3">
                <h3 className="text-base font-bold text-blue-400 flex items-center gap-2">
                  <FileText className="w-5 h-5" /> INSURED PARCEL EVIDENCE SNAPSHOT
                </h3>
                <button onClick={() => setIsSnapshotModalOpen(false)} className="p-1 hover:bg-emerald-900 rounded text-slate-400 hover:text-white">
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="bg-[#040e04] p-4 rounded-lg border border-emerald-900 font-mono text-xs space-y-2 leading-relaxed text-emerald-300 overflow-x-auto max-h-[350px]">
                <p className="text-blue-400 font-bold">--- INSURED PARCEL SNAPSHOT RECORD ---</p>
                <p>Boundary captured: {new Date().toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })}</p>
                <p>Farm Name: {selectedSnapshotFarm.name}</p>
                <p>Crop Type: {selectedSnapshotFarm.crop_type}</p>
                <p>Sowing Date: {selectedSnapshotFarm.sowing_date}</p>
                <p>Khasra / Land Record ID: {selectedSnapshotFarm.khasra_number || "223/4"}</p>
                <p>Insurance Policy No.: {selectedSnapshotFarm.insurance_policy_number}</p>
                <p>Area: {selectedSnapshotFarm.area_hectares} ha ({hectaresToAcres(selectedSnapshotFarm.area_hectares || 0)} acres)</p>
                <p>GPS Coordinates: {selectedSnapshotFarm.gps_latitude || 29.55}, {selectedSnapshotFarm.gps_longitude || 76.97}</p>
                <p>GPS Accuracy: ±{selectedSnapshotFarm.gps_accuracy_meters || 8} meters</p>
                <p>Boundary Version: v{selectedSnapshotFarm.current_version || 1}</p>
                <p>Status: PENDING OFFICIAL VERIFICATION</p>
                <p className="text-slate-400 text-[10px] mt-2 italic">
                  * Immutable baseline snapshot preserved for future insurance claim validation.
                </p>
              </div>

              <div className="flex justify-end">
                <button
                  onClick={() => setIsSnapshotModalOpen(false)}
                  className="px-4 py-1.5 bg-blue-900 hover:bg-blue-800 text-blue-100 text-xs font-semibold rounded"
                >
                  Close Snapshot
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* MODAL 3: 3D TERRAIN & FEATURE CUBE VISUALIZER */}
      <AnimatePresence>
        {is3DModalOpen && selectedFarm3D && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[2000] bg-black/80 backdrop-blur-md flex items-center justify-center p-4"
          >
            <motion.div
              initial={{ scale: 0.95 }}
              animate={{ scale: 1 }}
              exit={{ scale: 0.95 }}
              className="bg-[#0a1f0a] border border-emerald-600 rounded-xl p-6 max-w-4xl w-full space-y-4 shadow-2xl text-[#e2ebd5]"
            >
              <div className="flex items-center justify-between border-b border-emerald-800 pb-3">
                <div>
                  <h3 className="text-lg font-bold text-[#22c55e] flex items-center gap-2">
                    <Box className="w-5 h-5" /> 3D Extruded Terrain & Crop Feature Cube
                  </h3>
                  <p className="text-xs text-slate-400">{selectedFarm3D.name} — {selectedFarm3D.crop_type}</p>
                </div>
                <button onClick={() => setIs3DModalOpen(false)} className="p-1 hover:bg-emerald-900 rounded text-slate-400 hover:text-white">
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="flex border-b border-emerald-800 gap-4 text-xs font-semibold">
                <button
                  onClick={() => setModalTab("terrain")}
                  className={`pb-2 border-b-2 transition ${modalTab === "terrain" ? "border-emerald-400 text-emerald-400" : "border-transparent text-slate-400"}`}
                >
                  3D Extruded Terrain
                </button>
                <button
                  onClick={() => setModalTab("cube")}
                  className={`pb-2 border-b-2 transition ${modalTab === "cube" ? "border-emerald-400 text-emerald-400" : "border-transparent text-slate-400"}`}
                >
                  Crop Feature Cube
                </button>
              </div>

              <div className="h-[400px] w-full bg-[#051305] rounded-lg overflow-hidden border border-emerald-900 flex items-center justify-center">
                {modalTab === "terrain" ? (
                  <FarmTerrain3D geojson={selectedFarm3D.boundary} />
                ) : (
                  <FeatureCube3D farmName={selectedFarm3D.name} farmGeoJSON={selectedFarm3D.boundary} />
                )}
              </div>
            </motion.div>
          </motion.div>
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
