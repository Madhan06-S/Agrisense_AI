"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import dynamic from "next/dynamic";
import { 
  ArrowLeft, 
  ArrowRight, 
  CheckCircle, 
  Loader2, 
  Upload, 
  X,
  MapPin,
  CloudRain,
  Bug,
  Wind,
  ThermometerSun,
  CloudLightning,
  ShieldCheck,
  Check
} from "lucide-react";
import Link from "next/link";

interface Farm {
  id: number;
  name: string;
  crop_type: string;
  area_hectares: number;
  insurance_policy_number?: string;
  khasra_number?: string;
  village?: string;
  district?: string;
  boundary?: {
    type: "Polygon";
    coordinates: number[][][];
  };
}

const DAMAGE_TYPES = [
  { id: "flood", label: "Flood / Waterlogging", icon: <CloudRain className="w-5 h-5" /> },
  { id: "drought", label: "Drought", icon: <ThermometerSun className="w-5 h-5" /> },
  { id: "pest", label: "Pest / Disease", icon: <Bug className="w-5 h-5" /> },
  { id: "cyclone", label: "Cyclone / Storm", icon: <Wind className="w-5 h-5" /> },
  { id: "hailstorm", label: "Hailstorm", icon: <CloudLightning className="w-5 h-5" /> },
];

export default function FileClaimPage() {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [farms, setFarms] = useState<Farm[]>([]);
  const [selectedFarm, setSelectedFarm] = useState<Farm | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  
  // Claimant Field Presence Choice
  const [isAtFieldChoice, setIsAtFieldChoice] = useState<"yes" | "no" | null>(null);
  const [claimantLocation, setClaimantLocation] = useState<{ lat: number; lng: number; accuracy: number } | null>(null);
  const [gpsLoading, setGpsLoading] = useState(false);

  const [formData, setFormData] = useState({
    farm_id: "",
    claim_type: "",
    description: "",
    images: [] as File[]
  });

  const [previewUrls, setPreviewUrls] = useState<string[]>([]);
  const [uploadError, setUploadError] = useState("");
  const [submitError, setSubmitError] = useState("");

  useEffect(() => {
    fetchFarms();
  }, []);

  async function fetchFarms() {
    try {
      const cached = localStorage.getItem("agrisense_cached_farms");
      let loadedFarms: Farm[] = cached ? JSON.parse(cached) : [];

      const token = localStorage.getItem("access_token");
      if (token) {
        try {
          const res = await fetch("/api/v1/farms", {
            headers: { Authorization: `Bearer ${token}` }
          });
          if (res.ok) {
            const apiData = await res.json();
            if (apiData.length > 0) loadedFarms = apiData;
          }
        } catch {
          console.warn("Backend offline; using cached farms.");
        }
      }

      setFarms(loadedFarms);
    } catch (e) {
      console.error("Failed to load farms:", e);
    } finally {
      setLoading(false);
    }
  }

  function handleSelectFarm(farm: Farm) {
    setFormData(prev => ({ ...prev, farm_id: String(farm.id) }));
    setSelectedFarm(farm);
  }

  function handleCaptureClaimantGps() {
    setGpsLoading(true);
    if (!navigator.geolocation) {
      setGpsLoading(false);
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setClaimantLocation({
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
          accuracy: Math.round(pos.coords.accuracy)
        });
        setIsAtFieldChoice("yes");
        setGpsLoading(false);
      },
      () => {
        setGpsLoading(false);
      }
    );
  }

  function handleImageUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files || []);
    const remaining = 5 - formData.images.length;
    const toAdd = files.slice(0, remaining);
    
    if (toAdd.length === 0) return;

    setUploadError("");
    for (const file of toAdd) {
      if (file.size > 5 * 1024 * 1024) {
        setUploadError(`${file.name} is too large. Max 5MB.`);
        return;
      }
      if (!file.type.startsWith('image/')) {
        setUploadError(`${file.name} is not an image.`);
        return;
      }
    }

    const newImages = [...formData.images, ...toAdd];
    setFormData(prev => ({ ...prev, images: newImages }));
    
    const newPreviews = toAdd.map(file => URL.createObjectURL(file));
    setPreviewUrls(prev => [...prev, ...newPreviews]);
  }

  function removeImage(index: number) {
    const newImages = formData.images.filter((_, i) => i !== index);
    const newPreviews = previewUrls.filter((_, i) => i !== index);
    setFormData(prev => ({ ...prev, images: newImages }));
    setPreviewUrls(newPreviews);
  }

  async function handleSubmit() {
    setSubmitting(true);
    try {
      const token = localStorage.getItem("access_token");
      
      const payload = {
        farm_id: parseInt(formData.farm_id),
        claim_type: formData.claim_type,
        damage_type: formData.claim_type,
        coverage_type: (formData as any).coverage_type || "Standing Crop / Yield Loss",
        description: formData.description,
        insured_snapshot_id: `SNAP-FARM${formData.farm_id}-V1`,
        insured_boundary_version: 1,
        claimant_current_location: claimantLocation,
        is_at_field: isAtFieldChoice === "yes"
      };

      if (token) {
        const claimRes = await fetch("/api/v1/claims", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`
          },
          body: JSON.stringify(payload)
        });

        if (claimRes.ok && formData.images.length > 0) {
          const claimData = await claimRes.json();
          const imageForm = new FormData();
          formData.images.forEach(img => imageForm.append("files", img));
          await fetch(`/api/v1/claims/${claimData.claim_id}/images`, {
            method: "POST",
            headers: { Authorization: `Bearer ${token}` },
            body: imageForm
          });
        }
      }

      router.push("/dashboard/farmer/claims");
    } catch (e: any) {
      setSubmitError(e.message || "Submission failed. Please try again.");
      setSubmitting(false);
    }
  }

  const canProceed = () => {
    if (step === 1) return formData.farm_id !== "";
    if (step === 2) return formData.claim_type !== "";
    if (step === 3) return formData.description.length > 10;
    return true;
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#F7F9F5] flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-[#5B6B5B]" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F7F9F5] text-[#374151]">
      <div className="bg-white border-b border-[#E5EBE3]">
        <div className="max-w-3xl mx-auto px-4 h-16 flex items-center gap-3">
          <Link href="/dashboard/farmer/claims" className="p-2 hover:bg-[#F7F9F5] rounded-lg text-[#1B5E20]">
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div>
            <h1 className="text-base font-bold text-[#1B5E20]">File New Insurance Claim</h1>
            <p className="text-xs text-[#5B6B5B]">Step {step} of 4</p>
          </div>
        </div>
      </div>

      <main className="max-w-3xl mx-auto px-4 py-6 space-y-6">
        {/* Progress Bar */}
        <div className="flex gap-2">
          {[1, 2, 3, 4].map((s) => (
            <div 
              key={s}
              className={`h-2 flex-1 rounded-full ${
                s < step ? "bg-[#2E7D32]" : s === step ? "bg-[#1B5E20]" : "bg-[#E5EBE3]"
              }`}
            />
          ))}
        </div>

        <div className="bg-white border border-[#E5EBE3] rounded-2xl p-6 shadow-[0_2px_8px_rgba(0,0,0,0.04)] space-y-6">
          {/* Step 1: Select Farm */}
          {step === 1 && (
            <div className="space-y-4">
              <h2 className="text-lg font-bold text-[#1B5E20]">1. SELECT INSURED FARM</h2>
              <p className="text-xs text-[#5B6B5B]">Choose the insured farm parcel affected by crop loss</p>
              
              {farms.length === 0 ? (
                <div className="text-center py-8 border border-dashed border-emerald-700/60 rounded-xl">
                  <p className="text-sm text-[#5B6B5B]">No farms registered.</p>
                  <Link href="/dashboard/farmer/farms" className="text-sm text-[#374151] underline mt-1 inline-block">
                    Register a farm first
                  </Link>
                </div>
              ) : (
                <div className="space-y-3">
                  {farms.map((farm) => (
                    <div
                      key={farm.id}
                      onClick={() => handleSelectFarm(farm)}
                      className={`p-4 border-2 rounded-xl cursor-pointer transition-all ${
                        formData.farm_id === String(farm.id) 
                          ? "border-[#2E7D32] bg-[#E8F5E9]/50 shadow-sm" 
                          : "border-[#E5EBE3] bg-white hover:border-[#2E7D32]"
                      }`}
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex items-center gap-3">
                          <div className="p-2.5 bg-[#E8F5E9] border border-[#2E7D32]/30 rounded-lg text-[#1B5E20]">
                            <MapPin className="w-5 h-5" />
                          </div>
                          <div>
                            <p className="font-bold text-[#1B5E20] text-base">{farm.name}</p>
                            <p className="text-xs text-[#5B6B5B]">
                              {farm.crop_type} • {farm.area_hectares} ha • Policy: {farm.insurance_policy_number || "INS-772819"}
                            </p>
                          </div>
                        </div>
                        {formData.farm_id === String(farm.id) && (
                          <CheckCircle className="w-6 h-6 text-[#5B6B5B]" />
                        )}
                      </div>

                      {/* Snapshot Loaded Notice */}
                      {formData.farm_id === String(farm.id) && (
                        <div className="mt-3 pt-3 border-t border-[#EEF2EE] text-xs text-[#374151] space-y-1">
                          <p className="flex items-center gap-1 font-semibold text-[#5B6B5B]">
                            <ShieldCheck className="w-4 h-4 text-[#5B6B5B]" /> Insured Parcel Snapshot Auto-Loaded
                          </p>
                          <p>Snapshot ID: SNAP-FARM{farm.id}-V1 (Boundary Version 1)</p>
                          <p>Insured Boundary Coords & Coverage: Active</p>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}

              {/* Optional Field Presence Question */}
              {selectedFarm && (
                <div className="pt-4 border-t border-emerald-800 space-y-3">
                  <p className="text-sm font-bold text-[#1B5E20]">Are you currently at the insured field?</p>
                  
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <button
                      type="button"
                      onClick={handleCaptureClaimantGps}
                      className={`p-3 rounded-xl border text-xs font-bold transition flex items-center justify-center gap-2 ${
                        isAtFieldChoice === "yes"
                          ? "bg-[#2E7D32] text-white border-[#2E7D32]"
                          : "bg-white text-[#374151] border-[#E5EBE3] hover:border-[#2E7D32]"
                      }`}
                    >
                      {gpsLoading ? "Capturing Location..." : "📍 YES, I'M AT THE FIELD"}
                    </button>
                    <button
                      type="button"
                      onClick={() => setIsAtFieldChoice("no")}
                      className={`p-3 rounded-xl border text-xs font-bold transition flex items-center justify-center gap-2 ${
                        isAtFieldChoice === "no"
                          ? "bg-[#2E7D32] text-white border-[#2E7D32] font-extrabold"
                          : "bg-white text-[#374151] border-[#E5EBE3] hover:border-[#2E7D32]"
                      }`}
                    >
                      🗺️ NO, I'M SOMEWHERE ELSE
                    </button>
                  </div>

                  {isAtFieldChoice === "no" && (
                    <p className="text-xs text-[#5B6B5B] italic">
                      ℹ️ You can submit a claim even if you are not currently at the field.
                    </p>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Step 2: Coverage Situation & Damage Cause */}
          {step === 2 && (
            <div className="space-y-6">
              <div>
                <h2 className="text-lg font-bold text-[#1B5E20]">2. COVERAGE & DAMAGE DETAILS</h2>
                <p className="text-xs text-[#5B6B5B]">Specify what happened and what caused the damage to your crop</p>
              </div>

              {/* Question 1: What happened? (Coverage Situation) */}
              <div className="bg-[#F7F9F5] border border-[#E5EBE3] rounded-xl p-4 space-y-3">
                <p className="text-sm font-bold text-[#1B5E20] flex items-center gap-2">
                  <span>❓ What happened?</span>
                  <span className="text-xs font-normal text-[#5B6B5B]">
                    (Insurance Scheme: {selectedFarm && "insurance_scheme" in selectedFarm && selectedFarm.insurance_scheme ? (selectedFarm as any).insurance_scheme : "PMFBY"})
                  </span>
                </p>

                {selectedFarm && "insurance_scheme" in selectedFarm && (selectedFarm as any).insurance_scheme === "RWBCIS" ? (
                  <div className="p-3 bg-blue-950/80 border border-blue-600/80 rounded-lg text-xs text-blue-200 space-y-1">
                    <p className="font-semibold text-blue-300">Weather-Based Index Monitoring (RWBCIS):</p>
                    <p>"Weather conditions are being evaluated against the applicable policy trigger."</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {[
                      { id: "Standing Crop / Yield Loss", label: "Standing Crop / Yield Loss", desc: "Damage to crop during growing stage" },
                      { id: "Prevented Sowing", label: "Prevented Sowing / Planting", desc: "Unable to sow crop due to adverse weather" },
                      { id: "Localized Calamity", label: "Localized Calamity", desc: "Hailstorm, landslide, or inundation in isolated field" },
                      { id: "Mid-Season Adversity", label: "Mid-Season Adversity", desc: "Severe drought or dry spell during crop season" },
                      { id: "Post-Harvest Loss", label: "Post-Harvest Loss", desc: "Damage to harvested crop cut and spread in field" },
                    ].map((cov) => (
                      <label
                        key={cov.id}
                        className={`flex items-start gap-3 p-3 border rounded-xl cursor-pointer transition ${
                          formData.description.includes(`Coverage: ${cov.id}`)
                            ? "border-[#2E7D32] bg-[#E8F5E9]/50"
                            : "border-[#E5EBE3] bg-white hover:border-[#2E7D32]"
                        }`}
                        onClick={() => {
                          setFormData(prev => ({
                            ...prev,
                            coverage_type: cov.id
                          }));
                        }}
                      >
                        <input
                          type="radio"
                          name="coverage_type"
                          value={cov.id}
                          defaultChecked={cov.id === "Standing Crop / Yield Loss"}
                          className="mt-1 accent-[#2E7D32]"
                        />
                        <div>
                          <p className="text-xs font-bold text-[#1B5E20]">{cov.label}</p>
                          <p className="text-[11px] text-[#5B6B5B]">{cov.desc}</p>
                        </div>
                      </label>
                    ))}
                  </div>
                )}
              </div>

              {/* Question 2: What caused the damage? */}
              <div className="space-y-3">
                <p className="text-sm font-bold text-[#1B5E20]">What caused the damage?</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {[
                    { id: "flood", label: "Flood / Heavy Rainfall", icon: <CloudRain className="w-5 h-5" /> },
                    { id: "drought", label: "Drought / Water Deficit", icon: <ThermometerSun className="w-5 h-5" /> },
                    { id: "cyclone", label: "Cyclone / High Winds", icon: <Wind className="w-5 h-5" /> },
                    { id: "hailstorm", label: "Hailstorm", icon: <CloudLightning className="w-5 h-5" /> },
                    { id: "pest", label: "Pest / Disease Attack", icon: <Bug className="w-5 h-5" /> },
                    { id: "other", label: "Other Natural Calamity", icon: <ShieldCheck className="w-5 h-5" /> },
                  ].map((type) => (
                    <div
                      key={type.id}
                      onClick={() => setFormData(prev => ({ ...prev, claim_type: type.id }))}
                      className={`flex items-center gap-3 p-3.5 border-2 rounded-xl cursor-pointer transition-all ${
                        formData.claim_type === type.id
                          ? "border-[#2E7D32] bg-[#E8F5E9]/50"
                          : "border-[#E5EBE3] bg-white hover:border-[#2E7D32]"
                      }`}
                    >
                      <div className="text-[#5B6B5B]">{type.icon}</div>
                      <span className="text-xs font-semibold text-white">{type.label}</span>
                      {formData.claim_type === type.id && (
                        <CheckCircle className="w-5 h-5 text-[#5B6B5B] ml-auto" />
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Step 3: Evidence */}
          {step === 3 && (
            <div className="space-y-4">
              <h2 className="text-lg font-bold text-[#1B5E20]">3. DAMAGE EVIDENCE & DESCRIPTION</h2>
              <p className="text-xs text-[#5B6B5B]">Describe crop loss and upload photos</p>
              
              <div>
                <label className="block text-xs font-semibold text-[#374151] mb-1.5">
                  Damage Description <span className="text-emerald-600">(min 10 characters)</span>
                </label>
                <textarea
                  value={formData.description}
                  onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                  placeholder="Describe the extent of damage, affected crop stage, etc."
                  rows={4}
                  className="w-full px-4 py-2.5 bg-white border border-[#E5EBE3] rounded-xl focus:outline-none focus:border-[#2E7D32] text-sm text-[#374151] placeholder-[#6B7280]"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#374151] mb-1.5">
                  Damage Photos <span className="text-emerald-600">(max 5)</span>
                </label>
                
                {uploadError && (
                  <div className="p-3 bg-red-950/80 border border-red-700 rounded-xl text-xs text-red-200 mb-3">
                    {uploadError}
                  </div>
                )}
                <div className="grid grid-cols-3 sm:grid-cols-5 gap-3">
                  {previewUrls.map((url, idx) => (
                    <div key={idx} className="relative aspect-square rounded-xl overflow-hidden border border-[#E5EBE3]">
                      <img src={url} alt="" className="w-full h-full object-cover" />
                      <button
                        onClick={() => removeImage(idx)}
                        className="absolute top-1 right-1 w-5 h-5 bg-black/70 rounded-full flex items-center justify-center text-white"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </div>
                  ))}
                  
                  {formData.images.length < 5 && (
                    <label className="aspect-square rounded-xl border-2 border-dashed border-[#E5EBE3] flex flex-col items-center justify-center cursor-pointer hover:border-[#2E7D32] hover:bg-[#E8F5E9]/30 transition">
                      <Upload className="w-5 h-5 text-[#5B6B5B] mb-1" />
                      <span className="text-[10px] text-[#5B6B5B] font-bold">Add Photo</span>
                      <input
                        type="file"
                        accept="image/*"
                        multiple
                        className="sr-only"
                        onChange={handleImageUpload}
                      />
                    </label>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Step 4: Review */}
          {step === 4 && (
            <div className="space-y-4">
              <h2 className="text-lg font-bold text-[#1B5E20]">4. REVIEW & SUBMIT</h2>
              <p className="text-xs text-[#5B6B5B]">Verify your claim details before submission</p>
              
              <div className="bg-[#F7F9F5] border border-[#E5EBE3] rounded-xl p-4 space-y-3 text-xs">
                <ReviewItem label="Insured Farm" value={selectedFarm?.name || "—"} />
                <ReviewItem label="Crop" value={selectedFarm?.crop_type || "—"} />
                <ReviewItem label="Insured Policy" value={selectedFarm?.insurance_policy_number || "INS-772819"} />
                <ReviewItem label="Damage Type" value={DAMAGE_TYPES.find(t => t.id === formData.claim_type)?.label || "—"} />
                <ReviewItem label="Claimant Location" value={isAtFieldChoice === "yes" ? "At Field (GPS Captured)" : "Submitted Remotely"} />
                <ReviewItem label="Description" value={formData.description} />
                <ReviewItem label="Photos" value={`${formData.images.length} uploaded`} />
              </div>
            </div>
          )}

          {/* Navigation Buttons */}
          {submitError && (
            <div className="p-3 bg-red-950/80 border border-red-700 rounded-xl text-xs text-red-200">
              {submitError}
            </div>
          )}

          <div className="flex justify-between pt-4 border-t border-[#EEF2EE]">
            {step > 1 ? (
              <button
                type="button"
                onClick={() => setStep(step - 1)}
                className="px-4 py-2.5 text-xs font-bold text-[#374151] hover:text-white bg-[#133513] border border-[#E5EBE3] rounded-xl flex items-center gap-1"
              >
                <ArrowLeft className="w-4 h-4" /> Back
              </button>
            ) : (
              <div />
            )}

            {step < 4 ? (
              <button
                type="button"
                onClick={() => setStep(step + 1)}
                disabled={!canProceed()}
                className="px-5 py-2.5 bg-[#2E7D32] hover:bg-[#1B5E20] disabled:opacity-40 text-white font-extrabold text-xs rounded-xl flex items-center gap-2 shadow-sm transition-colors"
              >
                Next <ArrowRight className="w-4 h-4" />
              </button>
            ) : (
              <button
                type="button"
                onClick={handleSubmit}
                disabled={submitting}
                className="px-6 py-2.5 bg-[#2E7D32] hover:bg-[#1B5E20] disabled:opacity-40 text-white font-extrabold text-xs rounded-xl flex items-center gap-2 shadow-sm transition-colors"
              >
                {submitting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" /> Submitting...
                  </>
                ) : (
                  <>
                    <CheckCircle className="w-4 h-4" /> Submit Claim
                  </>
                )}
              </button>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}

function ReviewItem({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between border-b border-[#EEF2EE] pb-1.5">
      <span className="text-[#5B6B5B]">{label}</span>
      <span className="font-bold text-white text-right max-w-[65%]">{value}</span>
    </div>
  );
}
