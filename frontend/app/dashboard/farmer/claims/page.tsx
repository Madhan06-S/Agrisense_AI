"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, FileText, Loader2, Plus, Shield, IndianRupee } from "lucide-react";
import Link from "next/link";
import FloatingVoiceCopilot from "@/components/FloatingVoiceCopilot";

interface Claim {
  id: number;
  farm_id: number;
  claim_type: string;
  description: string;
  status: string;
  submitted_at: string;
  ai_score: number | null;
  officer_remarks: string | null;
  payout_amount: number | null;
  damage_percent: number | null;
  farm_area: number | null;
  sum_insured: number | null;
}

export default function MyClaimsPage() {
  const router = useRouter();
  const [claims, setClaims] = useState<Claim[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchClaims();
  }, []);

  async function fetchClaims() {
    try {
      const cachedStr = localStorage.getItem("agrisense_cached_claims");
      let cachedClaims: Claim[] = cachedStr ? JSON.parse(cachedStr) : [];

      const token = localStorage.getItem("access_token");
      const headers: Record<string, string> = {};
      if (token) headers["Authorization"] = `Bearer ${token}`;

      let apiClaims: Claim[] = [];
      try {
        const res = await fetch("/api/v1/claims", { headers });
        if (res.ok) {
          apiClaims = await res.json();
        }
      } catch (err) {
        console.warn("Backend fetch claims error:", err);
      }

      // Combine API claims + cached claims, deduplicating by ID
      const map = new Map<number, Claim>();
      [...apiClaims, ...cachedClaims].forEach((c) => {
        if (c && c.id) map.set(c.id, c);
      });

      const combined = Array.from(map.values());
      setClaims(combined);
    } catch (e) {
      console.error("Failed to load claims:", e);
    } finally {
      setLoading(false);
    }
  }

  const totalPayout = claims
    .filter(c => (c.status === "approved" || c.status === "payout_processed") && c.payout_amount)
    .reduce((sum, c) => sum + (c.payout_amount || 0), 0);

  const approvedCount = claims.filter(c => c.status === "approved" || c.status === "payout_processed").length;

  return (
    <div className="min-h-screen bg-[#F7F9F5]">
      <div className="bg-white border-b border-[#E5EBE3]">
        <div className="max-w-7xl mx-auto px-4 h-14 flex items-center gap-3">
          <Link href="/dashboard/farmer" className="p-1.5 hover:bg-[#F7F9F5] rounded">
            <ArrowLeft className="w-5 h-5 text-[#374151]" />
          </Link>
          <div>
            <h1 className="text-base font-bold text-[#1B5E20]">My Claims</h1>
            <p className="text-xs text-[#5B6B5B]">Track all submitted insurance claims</p>
          </div>
        </div>
      </div>

      <main className="max-w-7xl mx-auto px-4 py-6">
        {/* Stats */}
        <div className="grid grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
          <div className="bg-white border border-[#E5EBE3] rounded-lg p-4">
            <div className="flex items-center gap-2 mb-2">
              <FileText className="w-4 h-4 text-blue-600" />
              <span className="text-xs text-[#5B6B5B] uppercase tracking-wide">Total Claims</span>
            </div>
            <p className="text-2xl font-bold text-[#1B5E20]">{claims.length}</p>
          </div>
          
          <div className="bg-white border border-[#E5EBE3] rounded-lg p-4">
            <div className="flex items-center gap-2 mb-2">
              <Shield className="w-4 h-4 text-green-600" />
              <span className="text-xs text-[#5B6B5B] uppercase tracking-wide">Approved</span>
            </div>
            <p className="text-2xl font-bold text-[#1B5E20]">{approvedCount}</p>
          </div>
          
          <div className="bg-white border border-[#2E7D32]/30 rounded-lg p-4 bg-[#E8F5E9]/40">
            <div className="flex items-center gap-2 mb-2">
              <IndianRupee className="w-4 h-4 text-[#1B5E20]" />
              <span className="text-xs text-[#1B5E20] uppercase tracking-wide font-medium">Total Payout</span>
            </div>
            <p className="text-2xl font-bold text-[#1B5E20]">
              ₹{totalPayout.toLocaleString()}
            </p>
          </div>
        </div>

        <div className="flex justify-between items-center mb-4">
          <div className="flex items-center gap-2 text-sm text-[#374151]">
            <Shield className="w-4 h-4 text-[#1B5E20]" />
            <span>Total: {claims.length} claim{claims.length !== 1 ? "s" : ""}</span>
          </div>
          <Link
            href="/dashboard/farmer/claims/new"
            className="inline-flex items-center gap-2 bg-[#2E7D32] hover:bg-[#1B5E20] text-white text-sm font-medium px-4 py-2 rounded-md transition-colors"
          >
            <Plus className="w-4 h-4" />
            File New Claim
          </Link>
        </div>

        {loading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="w-8 h-8 animate-spin text-[#1B5E20]" />
          </div>
        ) : claims.length === 0 ? (
          <div className="bg-white border border-[#E5EBE3] rounded-lg p-12 text-center">
            <FileText className="w-12 h-12 text-slate-300 mx-auto mb-3" />
            <h3 className="text-sm font-medium text-[#1B5E20]">No claims yet</h3>
            <p className="text-xs text-[#5B6B5B] mt-1 mb-4">Submit your first crop damage claim to get started.</p>
            <Link
              href="/dashboard/farmer/claims/new"
              className="inline-flex items-center gap-2 bg-[#2E7D32] hover:bg-[#1B5E20] text-white text-sm font-medium px-4 py-2 rounded-md"
            >
              <Plus className="w-4 h-4" />
              File Claim
            </Link>
          </div>
        ) : (
          <div className="bg-white border border-[#E5EBE3] rounded-lg overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-[#E5EBE3] bg-[#F7F9F5]">
                    <th className="text-left font-semibold text-[#1B5E20] px-5 py-3">Claim ID</th>
                    <th className="text-left font-semibold text-[#1B5E20] px-5 py-3">Damage Type</th>
                    <th className="text-left font-semibold text-[#1B5E20] px-5 py-3">Date</th>
                    <th className="text-left font-semibold text-[#1B5E20] px-5 py-3">Photos & Verification</th>
                    <th className="text-left font-semibold text-[#1B5E20] px-5 py-3">Status & Officer Remarks</th>
                    <th className="text-left font-semibold text-[#1B5E20] px-5 py-3">Payout</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#EEF2EE]">
                  {claims.map((claim: any) => (
                    <tr key={claim.id} className="hover:bg-[#F7F9F5]">
                      <td className="px-5 py-3 font-medium text-[#1B5E20]">#{claim.id}</td>
                      <td className="px-5 py-3 capitalize text-[#1B5E20]">
                        <p className="font-semibold">{claim.claim_type}</p>
                        <p className="text-xs text-[#5B6B5B] truncate max-w-xs">{claim.description}</p>
                      </td>
                      <td className="px-5 py-3 text-[#5B6B5B] text-xs">
                        {claim.submitted_at ? new Date(claim.submitted_at).toLocaleDateString() : "—"}
                      </td>
                      <td className="px-5 py-3">
                        {claim.images && claim.images.length > 0 ? (
                          <div className="flex items-center gap-1.5">
                            <span className="text-xs bg-green-50 text-[#1B5E20] border border-green-200 px-2 py-0.5 rounded font-bold">
                              ✅ {claim.images.filter((i: any) => typeof i === "object" ? i.verified : true).length} Verified
                            </span>
                          </div>
                        ) : (
                          <span className="text-xs text-slate-400">No photos</span>
                        )}
                      </td>
                      <td className="px-5 py-3">
                        <StatusBadge status={claim.status} payoutAmount={claim.payout_amount} />
                        {claim.officer_remarks && (
                          <p className="text-[11px] text-[#374151] mt-1 bg-slate-50 p-1.5 rounded border border-slate-200">
                            <strong>Note:</strong> {claim.officer_remarks}
                          </p>
                        )}
                      </td>
                      <td className="px-5 py-3">
                        {(claim.status === "approved" || claim.status === "payout_processed") && claim.payout_amount ? (
                          <div className="flex items-center gap-1 text-[#1B5E20] font-bold">
                            <IndianRupee className="w-3.5 h-3.5" />
                            {claim.payout_amount.toLocaleString()}
                          </div>
                        ) : claim.status === "approved" ? (
                          <span className="text-xs text-amber-600 font-medium">Calculating...</span>
                        ) : (
                          <span className="text-slate-400">—</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        <FloatingVoiceCopilot />
      </main>
    </div>
  );
}

function StatusBadge({ status, payoutAmount }: { status: string; payoutAmount?: number | null }) {
  const styles: Record<string, string> = {
    submitted: "bg-amber-100 text-amber-800 border-amber-300",
    under_review: "bg-blue-100 text-blue-800 border-blue-300",
    approved: "bg-green-100 text-[#1B5E20] border-green-300",
    payout_processed: "bg-green-100 text-[#1B5E20] border-green-300",
    paid: "bg-green-100 text-[#1B5E20] border-green-300",
    rejected: "bg-red-100 text-red-800 border-red-300",
  };
  
  const getLabel = () => {
    if (status === "approved" || status === "payout_processed" || status === "paid") {
      return payoutAmount ? `✅ Paid ₹${payoutAmount.toLocaleString("en-IN")}` : "✅ Approved (Payout Ready)";
    }
    if (status === "submitted") return "⏳ Officer is checking";
    if (status === "under_review") return "📋 Need more photos / Info";
    if (status === "rejected") return "❌ Claim Rejected";
    return status;
  };

  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-bold border ${styles[status] || styles.submitted}`}>
      {getLabel()}
    </span>
  );
}
