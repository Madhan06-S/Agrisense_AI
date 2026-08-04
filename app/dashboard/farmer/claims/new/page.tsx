"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
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
  CloudLightning
} from "lucide-react";
import Link from "next/link";

interface Farm {
  id: number;
  name: string;
  crop_type: string;
  area_hectares: number;
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
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  
  const [formData, setFormData] = useState({
    farm_id: "",
    claim_type: "",
    description: "",
    images: [] as File[]
  });

  const [previewUrls, setPreviewUrls] = useState<string[]>([]);

  useEffect(() => {
    fetchFarms();
  }, []);

  async function fetchFarms() {
    try {
      const token = localStorage.getItem("access_token");
      if (!token) {
        router.push("/login");
        return;
      }

      const res = await fetch("/api/v1/farms", {
        headers: { Authorization: `Bearer ${token}` }
      });

      if (res.ok) {
        const data = await res.json();
        setFarms(data);
      }
    } catch (e) {
      console.error("Failed to load farms:", e);
    } finally {
      setLoading(false);
    }
  }

  function handleImageUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files || []);
    const remaining = 5 - formData.images.length;
    const toAdd = files.slice(0, remaining);
    
    if (toAdd.length === 0) return;

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
      if (!token) {
        router.push("/login");
        return;
      }

      // Step 1: Create claim
      const claimRes = await fetch("/api/v1/claims", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          farm_id: parseInt(formData.farm_id),
          claim_type: formData.claim_type,
          description: formData.description
        })
      });

      if (claimRes.status === 401 || claimRes.status === 403) {
        // Token expired or invalid — force re-login
        localStorage.removeItem("access_token");
        localStorage.removeItem("refresh_token");
        localStorage.removeItem("user_role");
        router.push("/login");
        return;
      }

      if (!claimRes.ok) {
        const err = await claimRes.json();
        throw new Error(err.detail || "Failed to submit claim");
      }

      const claimData = await claimRes.json();

      // Step 2: Upload images if any
      if (formData.images.length > 0) {
        const imageForm = new FormData();
        formData.images.forEach(img => imageForm.append("files", img));

        const imgRes = await fetch(`/api/v1/claims/${claimData.claim_id}/images`, {
          method: "POST",
          headers: { Authorization: `Bearer ${token}` },
          body: imageForm
        });

        if (imgRes.status === 401 || imgRes.status === 403) {
          localStorage.clear();
          router.push("/login");
          return;
        }
      }

      // Success — redirect to My Claims
      router.push("/dashboard/farmer/claims");

    } catch (e: any) {
      alert(e.message || "Submission failed. Please try again.");
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
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-green-700" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="bg-white border-b border-slate-200">
        <div className="max-w-3xl mx-auto px-4 h-14 flex items-center gap-3">
          <Link href="/dashboard/farmer/claims" className="p-1.5 hover:bg-slate-100 rounded">
            <ArrowLeft className="w-5 h-5 text-slate-600" />
          </Link>
          <div>
            <h1 className="text-base font-semibold text-slate-900">File New Claim</h1>
            <p className="text-xs text-slate-500">Step {step} of 4</p>
          </div>
        </div>
      </div>

      <main className="max-w-3xl mx-auto px-4 py-6">
        {/* Progress Bar */}
        <div className="flex gap-2 mb-6">
          {[1, 2, 3, 4].map((s) => (
            <div 
              key={s}
              className={`h-2 flex-1 rounded-full ${
                s < step ? "bg-green-600" : s === step ? "bg-green-500" : "bg-slate-200"
              }`}
            />
          ))}
        </div>

        <div className="bg-white border border-slate-200 rounded-lg p-6">
          {/* Step 1: Select Farm */}
          {step === 1 && (
            <div className="space-y-4">
              <h2 className="text-base font-semibold text-slate-900">Select Farm</h2>
              <p className="text-sm text-slate-500">Choose the affected farm parcel</p>
              
              {farms.length === 0 ? (
                <div className="text-center py-8 border border-dashed border-slate-300 rounded-lg">
                  <p className="text-sm text-slate-500">No farms registered.</p>
                  <Link href="/dashboard/farmer/farms" className="text-sm text-green-700 hover:underline mt-1 inline-block">
                    Register a farm first
                  </Link>
                </div>
              ) : (
                <div className="space-y-2">
                  {farms.map((farm) => (
                    <label 
                      key={farm.id}
                      className={`flex items-center gap-4 p-4 border-2 rounded-lg cursor-pointer transition-all ${
                        formData.farm_id === String(farm.id) 
                          ? "border-green-500 bg-green-50" 
                          : "border-slate-200 hover:border-slate-300"
                      }`}
                    >
                      <input
                        type="radio"
                        name="farm"
                        value={farm.id}
                        checked={formData.farm_id === String(farm.id)}
                        onChange={(e) => setFormData(prev => ({ ...prev, farm_id: e.target.value }))}
                        className="sr-only"
                      />
                      <div className="w-10 h-10 bg-green-100 rounded-md flex items-center justify-center">
                        <MapPin className="w-5 h-5 text-green-700" />
                      </div>
                      <div className="flex-1">
                        <p className="font-medium text-slate-900">{farm.name}</p>
                        <p className="text-xs text-slate-500">{farm.crop_type} • {farm.area_hectares} ha</p>
                      </div>
                      {formData.farm_id === String(farm.id) && (
                        <CheckCircle className="w-5 h-5 text-green-600" />
                      )}
                    </label>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Step 2: Damage Type */}
          {step === 2 && (
            <div className="space-y-4">
              <h2 className="text-base font-semibold text-slate-900">Damage Type</h2>
              <p className="text-sm text-slate-500">Select the type of crop damage</p>
              
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {DAMAGE_TYPES.map((type) => (
                  <label
                    key={type.id}
                    className={`flex items-center gap-3 p-4 border-2 rounded-lg cursor-pointer transition-all ${
                      formData.claim_type === type.id
                        ? "border-green-500 bg-green-50"
                        : "border-slate-200 hover:border-slate-300"
                    }`}
                  >
                    <input
                      type="radio"
                      name="damage_type"
                      value={type.id}
                      checked={formData.claim_type === type.id}
                      onChange={(e) => setFormData(prev => ({ ...prev, claim_type: e.target.value }))}
                      className="sr-only"
                    />
                    <div className="text-slate-600">{type.icon}</div>
                    <span className="text-sm font-medium text-slate-900">{type.label}</span>
                    {formData.claim_type === type.id && (
                      <CheckCircle className="w-4 h-4 text-green-600 ml-auto" />
                    )}
                  </label>
                ))}
              </div>
            </div>
          )}

          {/* Step 3: Evidence */}
          {step === 3 && (
            <div className="space-y-4">
              <h2 className="text-base font-semibold text-slate-900">Evidence & Description</h2>
              <p className="text-sm text-slate-500">Describe the damage and upload photos</p>
              
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">
                  Damage Description <span className="text-slate-400">(min 10 characters)</span>
                </label>
                <textarea
                  value={formData.description}
                  onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                  placeholder="Describe the extent of damage, affected area, crop stage, etc."
                  rows={4}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-green-500 text-sm text-slate-900"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">
                  Photos <span className="text-slate-400">(max 5)</span>
                </label>
                
                <div className="grid grid-cols-3 sm:grid-cols-5 gap-3">
                  {previewUrls.map((url, idx) => (
                    <div key={idx} className="relative aspect-square rounded-lg overflow-hidden border border-slate-200">
                      <img src={url} alt="" className="w-full h-full object-cover" />
                      <button
                        onClick={() => removeImage(idx)}
                        className="absolute top-1 right-1 w-5 h-5 bg-white rounded-full flex items-center justify-center shadow-sm"
                      >
                        <X className="w-3 h-3 text-slate-600" />
                      </button>
                    </div>
                  ))}
                  
                  {formData.images.length < 5 && (
                    <label className="aspect-square rounded-lg border-2 border-dashed border-slate-300 flex flex-col items-center justify-center cursor-pointer hover:border-green-500 hover:bg-green-50 transition-all">
                      <Upload className="w-5 h-5 text-slate-400 mb-1" />
                      <span className="text-[10px] text-slate-500">Add Photo</span>
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
              <h2 className="text-base font-semibold text-slate-900">Review & Submit</h2>
              <p className="text-sm text-slate-500">Verify your claim details before submission</p>
              
              <div className="bg-slate-50 border border-slate-200 rounded-lg p-4 space-y-3">
                <ReviewItem label="Farm" value={farms.find(f => String(f.id) === formData.farm_id)?.name || "—"} />
                <ReviewItem label="Crop" value={farms.find(f => String(f.id) === formData.farm_id)?.crop_type || "—"} />
                <ReviewItem label="Damage Type" value={DAMAGE_TYPES.find(t => t.id === formData.claim_type)?.label || "—"} />
                <ReviewItem label="Description" value={formData.description} />
                <ReviewItem label="Photos" value={`${formData.images.length} uploaded`} />
              </div>

              <div className="p-3 bg-amber-50 border border-amber-200 rounded-md text-xs text-amber-800">
                <strong>Note:</strong> Once submitted, your claim will be analyzed by AI and routed to the block agriculture officer for verification.
              </div>
            </div>
          )}

          {/* Navigation Buttons */}
          <div className="flex justify-between mt-6 pt-4 border-t border-slate-200">
            {step > 1 ? (
              <button
                onClick={() => setStep(step - 1)}
                className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-slate-700 hover:text-slate-900"
              >
                <ArrowLeft className="w-4 h-4" /> Back
              </button>
            ) : (
              <div />
            )}

            {step < 4 ? (
              <button
                onClick={() => setStep(step + 1)}
                disabled={!canProceed()}
                className="inline-flex items-center gap-2 bg-green-700 hover:bg-green-800 disabled:bg-slate-300 disabled:cursor-not-allowed text-white text-sm font-medium px-5 py-2.5 rounded-md transition-colors"
              >
                Next <ArrowRight className="w-4 h-4" />
              </button>
            ) : (
              <button
                onClick={handleSubmit}
                disabled={submitting}
                className="inline-flex items-center gap-2 bg-green-700 hover:bg-green-800 disabled:bg-slate-300 disabled:cursor-not-allowed text-white text-sm font-medium px-5 py-2.5 rounded-md transition-colors"
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
    <div className="flex justify-between text-sm">
      <span className="text-slate-500">{label}</span>
      <span className="font-medium text-slate-900 text-right max-w-[60%]">{value}</span>
    </div>
  );
}
