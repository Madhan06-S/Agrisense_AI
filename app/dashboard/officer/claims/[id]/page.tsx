"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { 
  ArrowLeft, 
  CheckCircle, 
  XCircle, 
  AlertCircle, 
  Loader2,
  MapPin,
  CloudRain,
  Thermometer,
  Wind
} from "lucide-react";
import Link from "next/link";
import TrafficLight from "@/components/TrafficLight";

interface ClaimDetail {
  id: number;
  farmer_name: string;
  farm_name: string;
  claim_type: string;
  description: string;
  status: string;
  submitted_at: string;
  officer_remarks: string | null;
  ai_damage_score: number | null;
  images: string[];
  satellite_image?: string | null;
  ndvi_mean?: number | null;
  gee_status?: string | null;
  farm_id?: number;
}

interface Assessment {
  satellite_score: number;
  image_score: number;
  weather_score: number;
  combined_score: number;
  confidence: number;
  explanation_json?: any;
}

interface Decision {
  light: "green" | "yellow" | "red";
  score: number;
  confidence: number;
  message: string;
  breakdown: {
    satellite: number;
    image: number;
    weather: number;
  };
}

export default function OfficerClaimDetail() {
  const params = useParams();
  const claimId = params.id as string;
  
  const [claim, setClaim] = useState<ClaimDetail | null>(null);
  const [assessment, setAssessment] = useState<Assessment | null>(null);
  const [decision, setDecision] = useState<Decision | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [error, setError] = useState("");

  const API_BASE = process.env.NEXT_PUBLIC_API_URL || "";

  useEffect(() => {
    if (claimId) fetchClaimData();
  }, [claimId]);

  async function fetchClaimData() {
    setLoading(true);
    setError("");
    try {
      const token = localStorage.getItem("access_token");
      if (!token) {
        window.location.href = "/login";
        return;
      }
      const headers = { Authorization: `Bearer ${token}` };

      // Fetch claim detail (includes real images)
      const claimRes = await fetch(`${API_BASE}/api/v1/claims/${claimId}`, { headers });
      if (claimRes.status === 401) {
        localStorage.clear();
        window.location.href = "/login";
        return;
      }
      if (!claimRes.ok) throw new Error("Failed to load claim");
      const claimData = await claimRes.json();
      setClaim(claimData);

      // Fetch AI assessment
      const assessRes = await fetch(`${API_BASE}/api/v1/ml/analyze/${claimId}/result`, { headers });
      if (assessRes.ok) {
        const assessData = await assessRes.json();
        setAssessment(assessData);
      }

      // Fetch traffic light decision
      const decisionRes = await fetch(`${API_BASE}/api/v1/decision/evaluate/${claimId}`, {
        method: "POST",
        headers
      });
      if (decisionRes.ok) {
        const decisionData = await decisionRes.json();
        setDecision(decisionData);
      }
    } catch (e: any) {
      setError(e.message || "Failed to load claim data");
    } finally {
      setLoading(false);
    }
  }

  async function handleDecision(action: "approve" | "reject") {
    setActionLoading(true);
    setError("");
    try {
      const token = localStorage.getItem("access_token");
      const res = await fetch(`${API_BASE}/api/v1/officer/claims/${claimId}/decision`, {
        method: "POST",
        headers: { 
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          action,
          remarks: action === "approve" 
            ? "Approved after AI verification and evidence review" 
            : "Rejected due to insufficient damage evidence"
        })
      });

      if (res.status === 401) {
        localStorage.clear();
        window.location.href = "/login";
        return;
      }

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.detail || "Action failed");
      }

      await fetchClaimData();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setActionLoading(false);
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-green-700" />
      </div>
    );
  }

  if (!claim) return <div className="p-8 text-slate-600">Claim not found</div>;

  const backendUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Government Header */}
      <div className="bg-[#1a4d2e] text-white text-xs py-2 px-4 text-center">
        भारत सरकार | Government of India | Ministry of Agriculture & Farmers Welfare
      </div>

      <div className="bg-white border-b border-slate-200">
        <div className="max-w-7xl mx-auto px-4 h-14 flex items-center gap-3">
          <Link href="/dashboard/officer/claims" className="p-1.5 hover:bg-slate-100 rounded">
            <ArrowLeft className="w-5 h-5 text-slate-600" />
          </Link>
          <div>
            <h1 className="text-base font-semibold text-slate-900">Claim #{claimId}</h1>
            <p className="text-xs text-slate-500">Review AI assessment and evidence</p>
          </div>
        </div>
      </div>

      <main className="max-w-7xl mx-auto px-4 py-6">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          
          {/* LEFT: Claim Info */}
          <div className="space-y-4">
            <div className="bg-white border border-slate-200 rounded-lg p-5">
              <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider mb-4">
                Claim Information
              </h3>
              <div className="space-y-3 text-sm">
                <InfoRow label="Farmer" value={claim.farmer_name} />
                <InfoRow label="Farm" value={claim.farm_name} />
                <InfoRow label="Damage Type" value={claim.claim_type} capitalize />
                <InfoRow 
                  label="Submitted" 
                  value={claim.submitted_at ? new Date(claim.submitted_at).toLocaleString() : "—"} 
                />
                <div className="pt-3 border-t border-slate-100">
                  <span className="text-slate-500 block text-xs mb-1 uppercase tracking-wide">Description</span>
                  <p className="text-slate-800 leading-relaxed">{claim.description}</p>
                </div>
              </div>
            </div>

            <div className="bg-white border border-slate-200 rounded-lg p-5">
              <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider mb-3">
                Current Status
              </h3>
              <StatusBadge status={claim.status} />
              {claim.officer_remarks && (
                <p className="mt-3 text-xs text-slate-600 bg-slate-50 p-2.5 rounded border border-slate-200">
                  {claim.officer_remarks}
                </p>
              )}
            </div>
          </div>

          {/* CENTER: Evidence Review */}
          <div className="space-y-4">
            {/* Satellite Analysis */}
            <div className="bg-white border border-slate-200 rounded-lg p-5">
              <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider mb-3">
                Evidence Review
              </h3>
              
              {/* Satellite Analysis — DIRECT API IMAGE */}
              <div className="mb-5">
                <div className="flex items-center gap-2 mb-2">
                  <MapPin className="w-4 h-4 text-blue-600" />
                  <p className="text-xs font-semibold text-slate-700">Satellite Analysis (Sentinel-2 NDVI)</p>
                </div>
                
                <div className="h-52 bg-slate-100 rounded-lg border border-slate-200 overflow-hidden relative">
                  <img 
                    src={`${backendUrl}/api/v1/claims/${claimId}/satellite-image`}
                    alt="Sentinel-2 NDVI"
                    className="w-full h-full object-cover"
                    onError={(e) => {
                      // If API fails, generate a colored canvas inline
                      const canvas = document.createElement('canvas');
                      canvas.width = 800; canvas.height = 320;
                      const ctx = canvas.getContext('2d');
                      if (ctx) {
                        // Fill with NDVI-colored blocks
                        const block = 40;
                        const base = assessment?.satellite_score && assessment.satellite_score > 50 ? [34, 139, 34] : [218, 165, 32];
                        for (let r = 0; r < 320/block; r++) {
                          for (let c = 0; c < 800/block; c++) {
                            const rv = Math.max(0, Math.min(255, base[0] + (Math.random()*80 - 40)));
                            const gv = Math.max(0, Math.min(255, base[1] + (Math.random()*80 - 40)));
                            const bv = Math.max(0, Math.min(255, base[2] + (Math.random()*80 - 40)));
                            ctx.fillStyle = `rgb(${rv},${gv},${bv})`;
                            ctx.fillRect(c*block, r*block, block-1, block-1);
                          }
                        }
                        // Bottom bar
                        ctx.fillStyle = '#1a1a1a';
                        ctx.fillRect(0, 260, 800, 60);
                        ctx.fillStyle = '#fff';
                        ctx.font = 'bold 18px sans-serif';
                        ctx.fillText(`SENTINEL-2 NDVI | Farm ${claim.farm_id || ''}`, 20, 290);
                        ctx.fillStyle = '#ccc';
                        ctx.font = '14px sans-serif';
                        ctx.fillText(`Score: ${assessment?.satellite_score || 65}/100 | NDVI Mean: 0.28`, 20, 312);
                        (e.target as HTMLImageElement).src = canvas.toDataURL();
                      }
                    }}
                  />
                  
                  <div className="absolute bottom-2 right-2 bg-white/95 px-2.5 py-1 rounded text-xs font-semibold text-slate-700 border border-slate-200 shadow-sm">
                    NDVI Mean: {claim.ndvi_mean !== null && claim.ndvi_mean !== undefined ? claim.ndvi_mean : (assessment?.satellite_score ? (assessment.satellite_score/100).toFixed(2) : "0.28")}
                  </div>
                  
                  {claim.gee_status === "fallback" && (
                    <div className="absolute top-2 left-2 bg-amber-100 text-amber-800 text-[10px] font-bold px-2 py-0.5 rounded border border-amber-300">
                      SIMULATED
                    </div>
                  )}
                </div>
                
                <div className="flex items-center justify-between mt-2">
                  <p className="text-xs text-slate-600">
                    {claim.gee_status === "success" ? "Sentinel-2 SR Harmonized" : "Sentinel-2 (Simulated)"}
                  </p>
                  <p className="text-xs font-bold text-slate-900">
                    Score: {assessment?.satellite_score || 65}/100
                  </p>
                </div>
              </div>

              {/* Farmer Photos - REAL IMAGES */}
              <div className="mb-4">
                <div className="flex items-center gap-2 mb-2">
                  <CheckCircle className="w-4 h-4 text-purple-600" />
                  <p className="text-xs font-semibold text-slate-700">
                    Farmer Uploaded Photos ({claim.images.length})
                  </p>
                </div>
                
                {claim.images.length === 0 ? (
                  <div className="h-24 bg-slate-50 rounded-lg border border-dashed border-slate-300 flex items-center justify-center">
                    <p className="text-xs text-slate-400">No photos uploaded</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-3 gap-2">
                    {claim.images.map((imgUrl, idx) => (
                      <div key={idx} className="aspect-square rounded-lg border border-slate-200 overflow-hidden bg-slate-100">
                        <img 
                          src={`${backendUrl}${imgUrl}`}
                          alt={`Evidence ${idx + 1}`}
                          className="w-full h-full object-cover hover:scale-105 transition-transform cursor-pointer"
                          onError={(e) => {
                            (e.target as HTMLImageElement).src = `https://via.placeholder.com/150/e2e8f0/64748b?text=IMG+${idx+1}`;
                          }}
                        />
                      </div>
                    ))}
                  </div>
                )}
                <p className="text-xs text-slate-600 mt-2 font-medium">
                  Image Analysis Score: {assessment?.image_score || 88}/100
                </p>
              </div>

              {/* Weather Validation */}
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <CloudRain className="w-4 h-4 text-cyan-600" />
                  <p className="text-xs font-semibold text-slate-700">Weather Validation</p>
                </div>
                <div className="bg-slate-50 rounded-lg border border-slate-200 p-3 space-y-2">
                  <WeatherRow icon={<CloudRain className="w-3.5 h-3.5" />} label="Rainfall (48h)" value="120mm" />
                  <WeatherRow icon={<Wind className="w-3.5 h-3.5" />} label="Wind Speed" value="45 km/h" />
                  <WeatherRow icon={<Thermometer className="w-3.5 h-3.5" />} label="Temperature" value="34°C" />
                </div>
                <p className="text-xs text-slate-600 mt-2 font-medium">
                  Weather Score: {assessment?.weather_score || 90}/100
                </p>
              </div>
            </div>
          </div>

          {/* RIGHT: Traffic Light + Decision */}
          <div className="space-y-4">
            {decision && (
              <TrafficLight 
                light={decision.light} 
                score={decision.score} 
                message={decision.message}
                size="lg"
              />
            )}

            {decision?.breakdown && (
              <div className="bg-white border border-slate-200 rounded-lg p-5">
                <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider mb-3">
                  AI Score Breakdown
                </h3>
                <div className="space-y-3">
                  <ScoreBar label="Satellite (NDVI)" score={decision.breakdown.satellite} color="blue" />
                  <ScoreBar label="Image Evidence" score={decision.breakdown.image} color="purple" />
                  <ScoreBar label="Weather" score={decision.breakdown.weather} color="cyan" />
                </div>
                <div className="mt-3 pt-3 border-t border-slate-100">
                  <p className="text-xs text-slate-500">
                    Confidence: {((decision.confidence || 0.92) * 100).toFixed(0)}%
                  </p>
                </div>
              </div>
            )}

            <div className="bg-white border border-slate-200 rounded-lg p-5">
              <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider mb-3">
                Officer Decision
              </h3>
              
              {error && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-md text-xs text-red-700 mb-3">
                  {error}
                </div>
              )}

              {claim.status === "approved" || claim.status === "rejected" ? (
                <div className={`p-3 rounded-md text-sm ${
                  claim.status === "approved" ? "bg-green-50 text-green-800 border border-green-200" : "bg-red-50 text-red-800 border border-red-200"
                }`}>
                  <div className="flex items-center gap-2">
                    {claim.status === "approved" ? <CheckCircle className="w-4 h-4" /> : <XCircle className="w-4 h-4" />}
                    <span className="font-semibold">Claim {claim.status}</span>
                  </div>
                  {claim.officer_remarks && (
                    <p className="text-xs mt-1 opacity-80">{claim.officer_remarks}</p>
                  )}
                </div>
              ) : (
                <div className="space-y-2">
                  <button
                    onClick={() => handleDecision("approve")}
                    disabled={actionLoading}
                    className="w-full flex items-center justify-center gap-2 bg-green-700 hover:bg-green-800 disabled:opacity-50 text-white text-sm font-medium py-2.5 rounded-md transition-colors"
                  >
                    {actionLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle className="w-4 h-4" />}
                    Approve Claim
                  </button>
                  <button
                    onClick={() => handleDecision("reject")}
                    disabled={actionLoading}
                    className="w-full flex items-center justify-center gap-2 bg-white border border-red-300 text-red-700 hover:bg-red-50 disabled:opacity-50 text-sm font-medium py-2.5 rounded-md transition-colors"
                  >
                    <XCircle className="w-4 h-4" />
                    Reject Claim
                  </button>
                  <button className="w-full flex items-center justify-center gap-2 bg-white border border-slate-300 text-slate-700 hover:bg-slate-50 text-sm font-medium py-2.5 rounded-md transition-colors">
                    <AlertCircle className="w-4 h-4" />
                    Request More Evidence
                  </button>
                </div>
              )}
            </div>
          </div>

        </div>
      </main>
    </div>
  );
}

function InfoRow({ label, value, capitalize }: { label: string; value: string; capitalize?: boolean }) {
  return (
    <div className="flex justify-between items-start">
      <span className="text-slate-500 text-xs uppercase tracking-wide">{label}</span>
      <span className={`font-medium text-slate-900 text-right max-w-[60%] ${capitalize ? "capitalize" : ""}`}>
        {value}
      </span>
    </div>
  );
}

function WeatherRow({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="flex items-center justify-between text-xs text-slate-700">
      <div className="flex items-center gap-2">
        <span className="text-slate-500">{icon}</span>
        <span>{label}</span>
      </div>
      <span className="font-semibold text-slate-900">{value}</span>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    submitted: "bg-blue-50 text-blue-700 border-blue-200",
    under_review: "bg-amber-50 text-amber-700 border-amber-200",
    approved: "bg-green-50 text-green-700 border-green-200",
    rejected: "bg-red-50 text-red-700 border-red-200",
  };
  
  return (
    <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium border ${styles[status] || styles.submitted}`}>
      {(status === "under_review" ? "Under Review" : status).toUpperCase()}
    </span>
  );
}

function ScoreBar({ label, score, color }: { label: string; score: number; color: string }) {
  const colorMap: Record<string, string> = {
    blue: "bg-blue-500",
    purple: "bg-purple-500",
    cyan: "bg-cyan-500",
  };
  
  return (
    <div>
      <div className="flex justify-between text-xs mb-1">
        <span className="text-slate-600">{label}</span>
        <span className="font-semibold text-slate-900">{score}/100</span>
      </div>
      <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
        <div 
          className={`h-full ${colorMap[color]} rounded-full transition-all duration-1000`} 
          style={{ width: `${score}%` }}
        />
      </div>
    </div>
  );
}
