"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { ArrowLeft, CheckCircle, XCircle, AlertCircle, Loader2 } from "lucide-react";
import Link from "next/link";
import TrafficLight from "@/components/TrafficLight";

export default function OfficerClaimDetail() {
  const params = useParams();
  const claimId = params.id;
  
  const [claim, setClaim] = useState<any>(null);
  const [assessment, setAssessment] = useState<any>(null);
  const [decision, setDecision] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);

  useEffect(() => {
    fetchClaimData();
  }, [claimId]);

  async function fetchClaimData() {
    try {
      // Fetch claim
      const claimRes = await fetch(`http://localhost:8000/api/v1/claims/${claimId}`);
      const claimData = await claimRes.json();
      setClaim(claimData);

      // Fetch assessment
      const assessRes = await fetch(`http://localhost:8000/api/v1/ml/analyze/${claimId}/result`);
      if (assessRes.ok) {
        const assessData = await assessRes.json();
        setAssessment(assessData);
      }

      // Fetch traffic light decision
      const decisionRes = await fetch(`http://localhost:8000/api/v1/decision/evaluate/${claimId}`, {
        method: "POST"
      });
      if (decisionRes.ok) {
        const decisionData = await decisionRes.json();
        setDecision(decisionData);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }

  async function handleDecision(action: "approve" | "reject") {
    setActionLoading(true);
    await fetch(`http://localhost:8000/api/v1/officer/claims/${claimId}/decision`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action,
        remarks: action === "approve" ? "Approved after AI verification" : "Rejected due to insufficient evidence"
      })
    });
    await fetchClaimData();
    setActionLoading(false);
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-green-700" />
      </div>
    );
  }

  if (!claim) return <div className="p-8 text-slate-800">Claim not found</div>;

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800">
      {/* Header */}
      <div className="bg-white border-b border-slate-200">
        <div className="max-w-7xl mx-auto px-4 h-14 flex items-center gap-3">
          <Link href="/dashboard/official/insurance" className="p-1.5 hover:bg-slate-100 rounded">
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
              <h3 className="text-sm font-semibold text-slate-900 uppercase tracking-wider mb-3">
                Claim Information
              </h3>
              <div className="space-y-2.5 text-sm">
                <div className="flex justify-between">
                  <span className="text-slate-500 font-semibold">Farmer</span>
                  <span className="font-semibold text-slate-900">{claim.farmer_name || "Ramesh Patel"}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500 font-semibold">Farm</span>
                  <span className="font-semibold text-slate-900">{claim.farm_name || "Patel Rice Farm"}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500 font-semibold">Damage Type</span>
                  <span className="font-semibold text-slate-900 capitalize">{claim.claim_type}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500 font-semibold">Submitted</span>
                  <span className="font-semibold text-slate-900">{claim.submitted_at}</span>
                </div>
                <div className="pt-2 border-t border-slate-100">
                  <span className="text-slate-500 block mb-1 font-semibold">Description</span>
                  <p className="text-slate-800 font-medium">{claim.description || "No description provided."}</p>
                </div>
              </div>
            </div>

            {/* Status Card */}
            <div className="bg-white border border-slate-200 rounded-lg p-5">
              <h3 className="text-sm font-semibold text-slate-900 uppercase tracking-wider mb-3">
                Current Status
              </h3>
              <StatusBadge status={claim.status} />
            </div>
          </div>

          {/* CENTER: Evidence */}
          <div className="space-y-4">
            <div className="bg-white border border-slate-200 rounded-lg p-5">
              <h3 className="text-sm font-semibold text-slate-900 uppercase tracking-wider mb-3">
                Evidence Review
              </h3>
              
              {/* Satellite */}
              <div className="mb-4 p-3 bg-slate-50 rounded-md border border-slate-200">
                <p className="text-xs font-semibold text-slate-700 mb-2">Satellite Analysis (NDVI)</p>
                <div className="h-32 bg-slate-200 rounded flex items-center justify-center text-xs text-slate-500 font-bold">
                  Sentinel-2 Imagery Placeholder
                </div>
                <p className="text-xs text-slate-600 mt-2 font-bold">
                  Score: {assessment?.satellite_score || 82}/100
                </p>
              </div>

              {/* Farmer Photos */}
              <div className="mb-4 p-3 bg-slate-50 rounded-md border border-slate-200">
                <p className="text-xs font-semibold text-slate-700 mb-2">Farmer Uploaded Photos</p>
                <div className="grid grid-cols-3 gap-2">
                  {[1,2,3].map(i => (
                    <div key={i} className="h-20 bg-slate-200 rounded flex items-center justify-center text-[10px] text-slate-500 font-bold">
                      IMG {i}
                    </div>
                  ))}
                </div>
                <p className="text-xs text-slate-600 mt-2 font-bold">
                  Score: {assessment?.image_score || 88}/100
                </p>
              </div>

              {/* Weather */}
              <div className="p-3 bg-slate-50 rounded-md border border-slate-200">
                <p className="text-xs font-semibold text-slate-700 mb-2">Weather Validation</p>
                <div className="space-y-1 text-xs text-slate-700 font-bold">
                  <p>Rainfall (48h): 120mm</p>
                  <p>Wind Speed: 45 km/h</p>
                  <p>Temperature: 34°C</p>
                </div>
                <p className="text-xs text-slate-600 mt-2 font-bold">
                  Score: {assessment?.weather_score || 90}/100
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

            {/* AI Breakdown */}
            {decision?.breakdown && (
              <div className="bg-white border border-slate-200 rounded-lg p-5">
                <h3 className="text-sm font-semibold text-slate-900 uppercase tracking-wider mb-3">
                  AI Score Breakdown
                </h3>
                <div className="space-y-3">
                  <ScoreBar label="Satellite" score={decision.breakdown.satellite} color="blue" />
                  <ScoreBar label="Image Evidence" score={decision.breakdown.image} color="purple" />
                  <ScoreBar label="Weather" score={decision.breakdown.weather} color="cyan" />
                </div>
                <div className="mt-3 pt-3 border-t border-slate-100">
                  <p className="text-xs text-slate-500 font-bold">
                    Confidence: {(decision.confidence * 100).toFixed(0)}%
                  </p>
                </div>
              </div>
            )}

            {/* Officer Actions */}
            <div className="bg-white border border-slate-200 rounded-lg p-5">
              <h3 className="text-sm font-semibold text-slate-900 uppercase tracking-wider mb-3">
                Officer Decision
              </h3>
              
              {claim.status === "approved" || claim.status === "rejected" ? (
                <div className={`p-3 rounded-md text-sm ${
                  claim.status === "approved" ? "bg-green-50 text-green-800" : "bg-red-50 text-red-800"
                }`}>
                  <div className="flex items-center gap-2">
                    {claim.status === "approved" ? <CheckCircle className="w-4 h-4" /> : <XCircle className="w-4 h-4" />}
                    <span className="font-semibold uppercase">Claim {claim.status}</span>
                  </div>
                  <p className="text-xs mt-1 opacity-80">{claim.officer_remarks}</p>
                </div>
              ) : (
                <div className="space-y-2">
                  <button
                    onClick={() => handleDecision("approve")}
                    disabled={actionLoading}
                    className="w-full flex items-center justify-center gap-2 bg-[#166534] hover:bg-emerald-800 disabled:opacity-50 text-white text-sm font-semibold py-2.5 rounded-md transition-colors"
                  >
                    {actionLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle className="w-4 h-4" />}
                    Approve Claim
                  </button>
                  <button
                    onClick={() => handleDecision("reject")}
                    disabled={actionLoading}
                    className="w-full flex items-center justify-center gap-2 bg-white border border-red-300 text-red-700 hover:bg-red-50 disabled:opacity-50 text-sm font-semibold py-2.5 rounded-md transition-colors"
                  >
                    <XCircle className="w-4 h-4" />
                    Reject Claim
                  </button>
                  <button className="w-full flex items-center justify-center gap-2 bg-white border border-slate-300 text-slate-700 hover:bg-slate-50 text-sm font-semibold py-2.5 rounded-md transition-colors">
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

function StatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    submitted: "bg-blue-50 text-blue-700 border-blue-200",
    under_review: "bg-amber-50 text-amber-700 border-amber-200",
    approved: "bg-green-50 text-green-700 border-green-200",
    rejected: "bg-red-50 text-red-700 border-red-200",
    pending_evidence: "bg-orange-50 text-orange-700 border-orange-200",
  };
  
  return (
    <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold border ${styles[status] || styles.submitted}`}>
      {status.replace("_", " ").toUpperCase()}
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
        <span className="text-slate-600 font-semibold">{label}</span>
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
