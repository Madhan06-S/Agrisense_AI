"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, FileText, Loader2, Plus, Shield, IndianRupee } from "lucide-react";
import Link from "next/link";

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
      const token = localStorage.getItem("access_token");
      if (!token) {
        router.push("/login");
        return;
      }

      const res = await fetch("/api/v1/claims", {
        headers: { Authorization: `Bearer ${token}` }
      });

      if (res.ok) {
        const data = await res.json();
        setClaims(data);
      }
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
                    <th className="text-left font-semibold text-[#1B5E20] px-5 py-3">AI Score</th>
                    <th className="text-left font-semibold text-[#1B5E20] px-5 py-3">Status</th>
                    <th className="text-left font-semibold text-[#1B5E20] px-5 py-3">Payout</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#EEF2EE]">
                  {claims.map((claim) => (
                    <tr key={claim.id} className="hover:bg-[#F7F9F5]">
                      <td className="px-5 py-3 font-medium text-[#1B5E20]">#{claim.id}</td>
                      <td className="px-5 py-3 capitalize text-[#1B5E20]">{claim.claim_type}</td>
                      <td className="px-5 py-3 text-[#5B6B5B]">
                        {claim.submitted_at ? new Date(claim.submitted_at).toLocaleDateString() : "—"}
                      </td>
                      <td className="px-5 py-3">
                        {claim.ai_score !== null ? (
                          <span className="font-medium text-[#1B5E20]">{claim.ai_score}/100</span>
                        ) : (
                          <span className="text-slate-400">Pending</span>
                        )}
                      </td>
                      <td className="px-5 py-3">
                        <StatusBadge status={claim.status} />
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
      </main>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    submitted: "bg-blue-50 text-blue-700 border-blue-200",
    under_review: "bg-amber-50 text-amber-700 border-amber-200",
    approved: "bg-green-50 text-[#1B5E20] border-[#2E7D32]/30",
    rejected: "bg-red-50 text-red-700 border-red-200",
    payout_processed: "bg-blue-50 text-blue-700 border-blue-200",
  };
  
  const labels: Record<string, string> = {
    submitted: "Submitted",
    under_review: "Under Review",
    approved: "Approved",
    rejected: "Rejected",
    payout_processed: "Paid",
  };

  return (
    <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium border ${styles[status] || styles.submitted}`}>
      {labels[status] || status}
    </span>
  );
}
