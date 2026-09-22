"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { 
  ArrowLeft, 
  Shield, 
  Loader2, 
  Filter, 
  Search,
  Eye,
  AlertTriangle,
  CheckCircle,
  XCircle,
  Clock,
  LogOut
} from "lucide-react";
import Link from "next/link";

interface Claim {
  id: number;
  farmer_name?: string;
  farm_name?: string;
  claim_type: string;
  submitted_at: string;
  status: string;
  ai_score: number | null;
}

export default function OfficerClaimsQueue() {
  const router = useRouter();
  const [claims, setClaims] = useState<Claim[]>([]);
  const [filtered, setFiltered] = useState<Claim[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("all");
  const [search, setSearch] = useState("");

  const handleLogout = () => {
    localStorage.removeItem("access_token");
    localStorage.removeItem("refresh_token");
    localStorage.removeItem("user_role");
    localStorage.removeItem("user_name");
    router.push("/");
  };

  useEffect(() => {
    fetchClaims();
  }, []);

  useEffect(() => {
    let result = claims;
    
    if (filter !== "all") {
      result = result.filter(c => c.status === filter);
    }
    
    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter(c => 
        c.farmer_name?.toLowerCase().includes(q) ||
        c.farm_name?.toLowerCase().includes(q) ||
        c.claim_type.toLowerCase().includes(q) ||
        String(c.id).includes(q)
      );
    }
    
    setFiltered(result);
  }, [claims, filter, search]);

  async function fetchClaims() {
    try {
      const token = localStorage.getItem("access_token");
      if (!token) {
        router.push("/login");
        return;
      }

      // Try officer endpoint first, fallback to general claims
      const res = await fetch("/api/v1/officer/claims", {
        headers: { Authorization: `Bearer ${token}` }
      });

      if (res.status === 401) {
        localStorage.clear();
        router.push("/login");
        return;
      }

      const data = res.ok ? await res.json() : [];
      setClaims(data);
      setFiltered(data);
    } catch (e) {
      console.error("Failed to load claims:", e);
    } finally {
      setLoading(false);
    }
  }

  const stats = {
    total: claims.length,
    pending: claims.filter(c => ["submitted", "under_review"].includes(c.status)).length,
    approved: claims.filter(c => c.status === "approved").length,
    rejected: claims.filter(c => c.status === "rejected").length,
  };

  const filters = [
    { key: "all", label: "All Claims", count: claims.length },
    { key: "submitted", label: "Submitted", count: claims.filter(c => c.status === "submitted").length },
    { key: "under_review", label: "Under Review", count: claims.filter(c => c.status === "under_review").length },
    { key: "approved", label: "Approved", count: stats.approved },
    { key: "rejected", label: "Rejected", count: stats.rejected },
  ];

  return (
    <div className="min-h-screen bg-[#F7F9F5]">
      {/* Government Header */}
      <div className="bg-[#E8F5E9] text-[#1B5E20] text-xs py-2 px-4 text-center font-semibold border-b border-[#E5EBE3]">
        भारत सरकार | Government of India | Ministry of Agriculture & Farmers Welfare
      </div>

      {/* Page Header */}
      <div className="bg-white border-b border-[#E5EBE3]">
        <div className="max-w-7xl mx-auto px-4 h-14 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link href="/dashboard/officer" className="p-1.5 hover:bg-slate-100 rounded">
              <ArrowLeft className="w-5 h-5 text-[#374151]" />
            </Link>
            <div>
              <h1 className="text-base font-semibold text-[#1B5E20]">Claims Review Queue</h1>
              <p className="text-xs text-[#5B6B5B]">PMFBY Digital Claim Settlement</p>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <Shield className="w-4 h-4 text-[#1B5E20]" />
              <span className="text-xs text-[#374151]">Block Agriculture Officer</span>
            </div>
            <button
              onClick={handleLogout}
              className="inline-flex items-center gap-1 text-xs px-2.5 py-1.5 border border-[#E5EBE3] hover:bg-[#F7F9F5] hover:text-red-700 text-[#374151] rounded-md font-medium transition-colors"
            >
              <LogOut className="w-3.5 h-3.5" />
              Logout
            </button>
          </div>
        </div>
      </div>

      <main className="max-w-7xl mx-auto px-4 py-6 space-y-6">
        {/* Stats */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard icon={<Clock className="w-5 h-5 text-blue-600" />} label="Total Claims" value={stats.total} bg="bg-blue-50" />
          <StatCard icon={<AlertTriangle className="w-5 h-5 text-amber-600" />} label="Pending Review" value={stats.pending} bg="bg-amber-50" />
          <StatCard icon={<CheckCircle className="w-5 h-5 text-green-600" />} label="Approved" value={stats.approved} bg="bg-green-50" />
          <StatCard icon={<XCircle className="w-5 h-5 text-red-600" />} label="Rejected" value={stats.rejected} bg="bg-red-50" />
        </div>

        {/* Filters & Search */}
        <div className="bg-white border border-[#E5EBE3] rounded-lg p-4">
          <div className="flex flex-col sm:flex-row gap-3 justify-between">
            <div className="flex flex-wrap gap-2">
              {filters.map(f => (
                <button
                  key={f.key}
                  onClick={() => setFilter(f.key)}
                  className={`px-3 py-1.5 rounded-md text-xs font-medium border transition-colors ${
                    filter === f.key
                      ? "bg-[#2E7D32] text-white border-[#2E7D32]"
                      : "bg-white text-[#374151] border-[#E5EBE3] hover:border-[#2E7D32]"
                  }`}
                >
                  {f.label} ({f.count})
                </button>
              ))}
            </div>
            
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                type="text"
                placeholder="Search claims..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9 pr-4 py-1.5 border border-[#E5EBE3] rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-[#2E7D32] focus:border-[#2E7D32] w-full sm:w-64"
              />
            </div>
          </div>
        </div>

        {/* Claims Table */}
        <div className="bg-white border border-[#E5EBE3] rounded-lg overflow-hidden">
          {loading ? (
            <div className="flex justify-center py-12">
              <Loader2 className="w-8 h-8 animate-spin text-[#1B5E20]" />
            </div>
          ) : filtered.length === 0 ? (
            <div className="p-12 text-center">
              <Filter className="w-10 h-10 text-slate-300 mx-auto mb-3" />
              <p className="text-sm text-[#5B6B5B]">No claims match the selected filter.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-[#E5EBE3] bg-[#F7F9F5]">
                    <th className="text-left font-semibold text-[#1B5E20] px-5 py-3 uppercase tracking-wider text-xs">Claim ID</th>
                    <th className="text-left font-semibold text-[#1B5E20] px-5 py-3 uppercase tracking-wider text-xs">Farmer</th>
                    <th className="text-left font-semibold text-[#1B5E20] px-5 py-3 uppercase tracking-wider text-xs">Farm</th>
                    <th className="text-left font-semibold text-[#1B5E20] px-5 py-3 uppercase tracking-wider text-xs">Damage Type</th>
                    <th className="text-left font-semibold text-[#1B5E20] px-5 py-3 uppercase tracking-wider text-xs">Date</th>
                    <th className="text-left font-semibold text-[#1B5E20] px-5 py-3 uppercase tracking-wider text-xs">AI Score</th>
                    <th className="text-left font-semibold text-[#1B5E20] px-5 py-3 uppercase tracking-wider text-xs">Status</th>
                    <th className="text-left font-semibold text-[#1B5E20] px-5 py-3 uppercase tracking-wider text-xs">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#EEF2EE]">
                  {filtered.map((claim) => (
                    <tr key={claim.id} className="hover:bg-[#F7F9F5] transition-colors">
                      <td className="px-5 py-3">
                        <span className="font-mono font-medium text-[#1B5E20]">#{claim.id}</span>
                      </td>
                      <td className="px-5 py-3 text-[#1B5E20] font-medium">
                        {claim.farmer_name || "—"}
                      </td>
                      <td className="px-5 py-3 text-[#374151]">
                        {claim.farm_name || "—"}
                      </td>
                      <td className="px-5 py-3 capitalize text-[#1B5E20]">
                        {claim.claim_type}
                      </td>
                      <td className="px-5 py-3 text-[#5B6B5B] text-xs">
                        {claim.submitted_at ? new Date(claim.submitted_at).toLocaleDateString() : "—"}
                      </td>
                      <td className="px-5 py-3">
                        {claim.ai_score !== null ? (
                          <span className={`font-semibold ${
                            claim.ai_score >= 70 ? "text-red-600" :
                            claim.ai_score >= 25 ? "text-amber-600" :
                            "text-green-600"
                          }`}>
                            {claim.ai_score}
                          </span>
                        ) : (
                          <span className="text-slate-400">—</span>
                        )}
                      </td>
                      <td className="px-5 py-3">
                        <StatusBadge status={claim.status} />
                      </td>
                      <td className="px-5 py-3">
                        <Link
                          href={`/dashboard/officer/claims/${claim.id}`}
                          className="inline-flex items-center gap-1.5 text-xs font-medium text-[#1B5E20] hover:text-green-800 hover:underline"
                        >
                          <Eye className="w-3.5 h-3.5" />
                          Review
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}

function StatCard({ icon, label, value, bg }: { icon: React.ReactNode; label: string; value: number; bg: string }) {
  return (
    <div className="bg-white border border-[#E5EBE3] rounded-lg p-4">
      <div className={`w-8 h-8 ${bg} rounded-md flex items-center justify-center mb-3`}>
        {icon}
      </div>
      <p className="text-2xl font-bold text-[#1B5E20]">{value}</p>
      <p className="text-xs text-[#5B6B5B] mt-0.5">{label}</p>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    submitted: "bg-blue-50 text-blue-700 border-blue-200",
    under_review: "bg-amber-50 text-amber-700 border-amber-200",
    approved: "bg-green-50 text-[#1B5E20] border-green-200",
    rejected: "bg-red-50 text-red-700 border-red-200",
  };
  
  const labels: Record<string, string> = {
    submitted: "Submitted",
    under_review: "Under Review",
    approved: "Approved",
    rejected: "Rejected",
  };

  return (
    <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium border ${styles[status] || styles.submitted}`}>
      {labels[status] || status}
    </span>
  );
}
