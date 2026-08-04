"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { 
  Tractor, 
  FileText, 
  CheckCircle, 
  Clock, 
  Plus, 
  ArrowRight, 
  Shield,
  Loader2,
  AlertTriangle,
  LogOut
} from "lucide-react";
import Link from "next/link";

interface Claim {
  id: number;
  claim_type: string;
  status: string;
  ai_score: number | null;
  submitted_at: string;
  farm_name?: string;
}

interface Farm {
  id: number;
  name: string;
  crop_type: string;
}

export default function FarmerDashboard() {
  const router = useRouter();
  const [userName, setUserName] = useState("Farmer");
  const [claims, setClaims] = useState<Claim[]>([]);
  const [farms, setFarms] = useState<Farm[]>([]);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    totalFarms: 0,
    activeClaims: 0,
    approvedClaims: 0,
    pendingPayout: 0
  });

  const handleLogout = () => {
    localStorage.removeItem("access_token");
    localStorage.removeItem("refresh_token");
    localStorage.removeItem("user_role");
    localStorage.removeItem("user_name");
    router.push("/login");
  };

  useEffect(() => {
    const name = localStorage.getItem("user_name") || "Farmer";
    setUserName(name);
    fetchDashboardData();
  }, []);

  async function fetchDashboardData() {
    try {
      const token = localStorage.getItem("access_token");
      if (!token) {
        router.push("/login");
        return;
      }

      const headers = { Authorization: `Bearer ${token}` };

      // Fetch claims
      const claimsRes = await fetch("/api/v1/claims", { headers });
      const claimsData = claimsRes.ok ? await claimsRes.json() : [];

      // Fetch farms
      const farmsRes = await fetch("/api/v1/farms", { headers });
      const farmsData = farmsRes.ok ? await farmsRes.json() : [];

      setClaims(claimsData);
      setFarms(farmsData);

      // Calculate stats
      const approved = claimsData.filter((c: Claim) => c.status === "approved").length;
      const active = claimsData.filter((c: Claim) => 
        ["submitted", "under_review"].includes(c.status)
      ).length;
      
      setStats({
        totalFarms: farmsData.length,
        activeClaims: active,
        approvedClaims: approved,
        pendingPayout: approved * 45000 // Demo calculation
      });
    } catch (e) {
      console.error("Dashboard load error:", e);
    } finally {
      setLoading(false);
    }
  }

  const recentClaims = claims.slice(0, 3);

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-green-700" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <div className="bg-white border-b border-slate-200">
        <div className="max-w-7xl mx-auto px-4 h-14 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Shield className="w-5 h-5 text-green-700" />
            <span className="font-semibold text-slate-900">AgriSense AI</span>
          </div>
          <div className="flex items-center gap-4 text-sm text-slate-600">
            <span>Welcome, <span className="font-medium text-slate-900">{userName}</span></span>
            <button
              onClick={handleLogout}
              className="inline-flex items-center gap-1 text-xs px-2.5 py-1.5 border border-slate-200 hover:bg-slate-50 hover:text-red-700 text-slate-600 rounded-md font-medium transition-colors"
            >
              <LogOut className="w-3.5 h-3.5" />
              Logout
            </button>
          </div>
        </div>
      </div>

      <main className="max-w-7xl mx-auto px-4 py-6 space-y-6">
        {/* Welcome Banner */}
        <div className="bg-[#1a4d2e] text-white rounded-lg p-6">
          <h1 className="text-lg font-semibold">PMFBY Digital Claim Settlement Portal</h1>
          <p className="text-sm text-green-100 mt-1">
            File crop insurance claims and track settlement status online.
          </p>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard 
            icon={<Tractor className="w-5 h-5 text-blue-600" />}
            label="Total Farms"
            value={stats.totalFarms}
            bg="bg-blue-50"
          />
          <StatCard 
            icon={<FileText className="w-5 h-5 text-amber-600" />}
            label="Active Claims"
            value={stats.activeClaims}
            bg="bg-amber-50"
          />
          <StatCard 
            icon={<CheckCircle className="w-5 h-5 text-green-600" />}
            label="Approved Claims"
            value={stats.approvedClaims}
            bg="bg-green-50"
          />
          <StatCard 
            icon={<Clock className="w-5 h-5 text-purple-600" />}
            label="Pending Payout"
            value={`₹${stats.pendingPayout.toLocaleString()}`}
            bg="bg-purple-50"
          />
        </div>

        {/* Quick Actions */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Link 
            href="/dashboard/farmer/farms"
            className="flex items-center gap-3 bg-white border border-slate-200 rounded-lg p-4 hover:border-green-500 hover:shadow-sm transition-all"
          >
            <div className="w-10 h-10 bg-green-100 rounded-md flex items-center justify-center">
              <Plus className="w-5 h-5 text-green-700" />
            </div>
            <div>
              <p className="font-medium text-slate-900">Register Farm</p>
              <p className="text-xs text-slate-500">Add new land parcel</p>
            </div>
          </Link>

          <Link 
            href="/dashboard/farmer/claims/new"
            className="flex items-center gap-3 bg-white border border-slate-200 rounded-lg p-4 hover:border-green-500 hover:shadow-sm transition-all"
          >
            <div className="w-10 h-10 bg-green-100 rounded-md flex items-center justify-center">
              <FileText className="w-5 h-5 text-green-700" />
            </div>
            <div>
              <p className="font-medium text-slate-900">File Claim</p>
              <p className="text-xs text-slate-500">Submit damage report</p>
            </div>
          </Link>

          <Link 
            href="/dashboard/farmer/claims"
            className="flex items-center gap-3 bg-white border border-slate-200 rounded-lg p-4 hover:border-green-500 hover:shadow-sm transition-all"
          >
            <div className="w-10 h-10 bg-green-100 rounded-md flex items-center justify-center">
              <Clock className="w-5 h-5 text-green-700" />
            </div>
            <div>
              <p className="font-medium text-slate-900">My Claims</p>
              <p className="text-xs text-slate-500">Track application status</p>
            </div>
          </Link>
        </div>

        {/* Recent Claims */}
        <div className="bg-white border border-slate-200 rounded-lg">
          <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between">
            <h2 className="font-semibold text-slate-900">Recent Claims</h2>
            <Link 
              href="/dashboard/farmer/claims"
              className="text-sm text-green-700 hover:text-green-800 font-medium flex items-center gap-1"
            >
              View All <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
          
          {recentClaims.length === 0 ? (
            <div className="p-8 text-center">
              <p className="text-sm text-slate-500">No claims filed yet.</p>
              <Link 
                href="/dashboard/farmer/claims/new"
                className="inline-flex items-center gap-2 mt-3 text-sm text-green-700 hover:text-green-800 font-medium"
              >
                File your first claim <ArrowRight className="w-4 h-4" />
              </Link>
            </div>
          ) : (
            <div className="divide-y divide-slate-100">
              {recentClaims.map((claim) => (
                <div key={claim.id} className="px-5 py-4 flex items-center justify-between">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-slate-900">#{claim.id}</span>
                      <span className="text-sm text-slate-500 capitalize">{claim.claim_type}</span>
                    </div>
                    <p className="text-xs text-slate-400 mt-0.5">
                      {claim.submitted_at ? new Date(claim.submitted_at).toLocaleDateString() : "—"}
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    {claim.ai_score !== null && (
                      <span className="text-xs font-medium text-slate-600">
                        AI Score: {claim.ai_score}
                      </span>
                    )}
                    <StatusBadge status={claim.status} />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}

function StatCard({ icon, label, value, bg }: { icon: React.ReactNode; label: string; value: string | number; bg: string }) {
  return (
    <div className="bg-white border border-slate-200 rounded-lg p-4">
      <div className={`w-8 h-8 ${bg} rounded-md flex items-center justify-center mb-3`}>
        {icon}
      </div>
      <p className="text-2xl font-bold text-slate-900">{value}</p>
      <p className="text-xs text-slate-500 mt-0.5">{label}</p>
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
