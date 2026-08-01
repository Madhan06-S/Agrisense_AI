"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  LayoutDashboard, Tractor, FilePlus, ClipboardList, Wallet, HelpCircle,
  Bell, LogOut, Globe, CheckCircle, AlertTriangle, Clock, RefreshCw, X, ChevronRight, User, Phone
} from "lucide-react";
import SMSSimulator from "@/components/SMSSimulator";

const queryClient = new QueryClient();

interface Farm {
  id: number;
  name: string;
  crop_type: string;
  area_hectares: number;
  insurance_policy_number: string;
  state: string;
  district: string;
  taluka: string;
  village: string;
  khasra_number: string;
  is_deleted: boolean;
}

interface Notification {
  id: string;
  title: string;
  message: string;
  type: string;
  is_read: boolean;
  created_at: number;
  action_url: string;
}

function FarmerDashboardContent() {
  const router = useRouter();
  const [lang, setLang] = useState<"en" | "hi">("en");
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [showNotifications, setShowNotifications] = useState(false);
  const [user, setUser] = useState<{ id: number; phone: string; email: string; role: string } | null>(null);

  // Load user details
  useEffect(() => {
    const fetchUser = async () => {
      try {
        const res = await fetch("http://localhost:8000/api/v1/auth/me");
        if (res.ok) {
          const data = await res.json();
          setUser(data);
        } else {
          // If not logged in, try checking localStorage
          const localUser = localStorage.getItem("user");
          if (localUser) {
            setUser(JSON.parse(localUser));
          } else {
            // Default mock fallback
            setUser({ id: 1, phone: "9876543210", email: "farmer.singh@agrisense.gov.in", role: "farmer" });
          }
        }
      } catch (err) {
        setUser({ id: 1, phone: "9876543210", email: "farmer.singh@agrisense.gov.in", role: "farmer" });
      }
    };
    fetchUser();
  }, []);

  // Fetch Farms
  const { data: farms = [], isLoading: farmsLoading, refetch: refetchFarms } = useQuery<Farm[]>({
    queryKey: ["farms"],
    queryFn: async () => {
      try {
        const res = await fetch("http://localhost:8000/api/v1/farms/");
        if (!res.ok) throw new Error("offline");
        const data = await res.json();
        localStorage.setItem("agrisense_cached_farms", JSON.stringify(data));
        return data;
      } catch {
        const cached = localStorage.getItem("agrisense_cached_farms");
        return cached ? JSON.parse(cached) : [];
      }
    },
  });

  // Fetch Notifications
  const { data: notifications = [], refetch: refetchNotifs } = useQuery<Notification[]>({
    queryKey: ["notifications"],
    queryFn: async () => {
      try {
        const res = await fetch("http://localhost:8000/api/v1/notifications/");
        if (res.ok) return await res.json();
      } catch (err) {}
      return [];
    },
    refetchInterval: 10000, // Poll every 10s
  });

  const unreadNotifs = notifications.filter((n) => !n.is_read);

  const handleMarkAllRead = async () => {
    try {
      await fetch("http://localhost:8000/api/v1/notifications/read-all", { method: "POST" });
      refetchNotifs();
    } catch (err) {}
  };

  const handleMarkRead = async (id: string) => {
    try {
      await fetch(`http://localhost:8000/api/v1/notifications/${id}/read`, { method: "POST" });
      refetchNotifs();
    } catch (err) {}
  };

  const handleLogout = async () => {
    try {
      await fetch("http://localhost:8000/api/v1/auth/logout", { method: "POST" });
      localStorage.removeItem("user");
      router.push("/login");
    } catch (err) {
      router.push("/login");
    }
  };

  // Static Mock Claims (real data would be fetched from claims API)
  const mockClaims = [
    { id: "CLM-1002", type: "Flood", date: "25/07/2026", status: "Approved", score: 85, amount: "₹25,000" },
    { id: "CLM-1003", type: "Drought", date: "28/07/2026", status: "Under Review", score: 58, amount: "Pending" },
    { id: "CLM-1004", type: "Pest", date: "20/07/2026", status: "Rejected", score: 18, amount: "—" },
  ];

  const totalArea = farms.reduce((acc, f) => acc + (f.area_hectares ?? 0), 0);
  const activeClaimsCount = mockClaims.filter(c => c.status === "Under Review").length;

  return (
    <div className="min-h-screen bg-[#F8FAFC] text-slate-800 font-sans flex">
      {/* 1. Left Collapsible Sidebar */}
      <aside className={`bg-white border-r border-[#E2E8F0] flex flex-col justify-between transition-all duration-300 ${sidebarOpen ? "w-[280px]" : "w-[70px]"} shrink-0 z-30`}>
        <div>
          {/* Logo & Scheme Badge */}
          <div className="p-4 border-b border-[#E2E8F0] flex items-center justify-between">
            {sidebarOpen ? (
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-[#166534]/10 flex items-center justify-center">
                  <Tractor className="w-4 h-4 text-[#166534]" />
                </div>
                <div>
                  <span className="font-bold text-slate-800 text-sm block">AgriSense AI</span>
                  <span className="text-[9px] font-bold text-[#166534] tracking-wide uppercase">PMFBY Portal</span>
                </div>
              </div>
            ) : (
              <div className="w-8 h-8 rounded-lg bg-[#166534]/10 flex items-center justify-center mx-auto">
                <Tractor className="w-4 h-4 text-[#166534]" />
              </div>
            )}
            <button onClick={() => setSidebarOpen(!sidebarOpen)} className="text-slate-400 hover:text-slate-600">
              <ChevronRight className={`w-4 h-4 transition-transform ${sidebarOpen ? "rotate-180" : ""}`} />
            </button>
          </div>

          {/* Navigation Links */}
          <nav className="p-3 space-y-1">
            {[
              { label: "Dashboard", href: "/dashboard/farmer", icon: <LayoutDashboard className="w-4 h-4" /> },
              { label: "My Farms", href: "/dashboard/farmer/farms", icon: <Tractor className="w-4 h-4" /> },
              { label: "File Claim", href: "/dashboard/farmer/claims/decision", icon: <FilePlus className="w-4 h-4" /> },
              { label: "My Claims", href: "/dashboard/farmer/claims/decision", icon: <ClipboardList className="w-4 h-4" /> },
              { label: "Digital Wallet", href: "/dashboard/farmer/copilot", icon: <Wallet className="w-4 h-4" /> },
              { label: "Help & Support", href: "/dashboard/farmer/copilot", icon: <HelpCircle className="w-4 h-4" /> },
            ].map((link, idx) => (
              <Link
                key={idx}
                href={link.href}
                className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-slate-600 hover:text-[#166534] hover:bg-[#166534]/5 text-xs font-semibold transition-all"
              >
                <div className="shrink-0">{link.icon}</div>
                {sidebarOpen && <span>{link.label}</span>}
              </Link>
            ))}
          </nav>
        </div>

        {/* Sidebar Footer */}
        <div className="p-3 border-t border-[#E2E8F0] space-y-2">
          {sidebarOpen && (
            <div className="flex items-center justify-between p-2 bg-slate-50 rounded-lg">
              <span className="text-[10px] font-bold text-slate-500 uppercase">Language</span>
              <div className="flex gap-1 text-[10px] font-bold">
                <button onClick={() => setLang("en")} className={`px-2 py-0.5 rounded ${lang === "en" ? "bg-[#166534] text-white" : "text-slate-500"}`}>EN</button>
                <button onClick={() => setLang("hi")} className={`px-2 py-0.5 rounded ${lang === "hi" ? "bg-[#166534] text-white" : "text-slate-500"}`}>हिं</button>
              </div>
            </div>
          )}
          <button
            onClick={handleLogout}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-red-600 hover:bg-red-50 text-xs font-semibold transition-all"
          >
            <LogOut className="w-4 h-4 shrink-0" />
            {sidebarOpen && <span>Logout Portal</span>}
          </button>
        </div>
      </aside>

      {/* 2. Main Area */}
      <main className="flex-1 flex flex-col overflow-y-auto">
        {/* Top Header */}
        <header className="bg-white border-b border-[#E2E8F0] h-16 px-8 flex items-center justify-between shrink-0 relative">
          <h2 className="text-sm font-bold text-slate-800 uppercase tracking-wider">Farmer Dashboard</h2>

          <div className="flex items-center gap-6">
            <span className="text-xs text-slate-500 font-medium">01 August 2026</span>

            {/* Notification Bell with Dropdown */}
            <div className="relative">
              <button 
                onClick={() => setShowNotifications(!showNotifications)} 
                className="p-1.5 rounded-full hover:bg-slate-100 text-slate-500 hover:text-slate-800 relative transition-all"
              >
                <Bell className="w-4 h-4" />
                {unreadNotifs.length > 0 && (
                  <span className="absolute top-1 right-1 w-2 h-2 rounded-full bg-[#DC2626]" />
                )}
              </button>

              {showNotifications && (
                <div className="absolute right-0 mt-3 bg-white border border-[#E2E8F0] rounded-xl shadow-2xl w-80 py-2 z-50">
                  <div className="px-4 py-2 border-b border-[#E2E8F0] flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-800">Notifications</span>
                    {unreadNotifs.length > 0 && (
                      <button onClick={handleMarkAllRead} className="text-[10px] text-[#166534] hover:underline font-bold">
                        Mark all read
                      </button>
                    )}
                  </div>
                  <div className="max-h-64 overflow-y-auto divide-y divide-slate-100">
                    {notifications.length === 0 ? (
                      <div className="px-4 py-6 text-center text-xs text-slate-400">No notifications</div>
                    ) : (
                      notifications.map((notif) => (
                        <div 
                          key={notif.id} 
                          onClick={() => handleMarkRead(notif.id)}
                          className={`p-3 text-left hover:bg-slate-50 transition-all cursor-pointer flex gap-3 ${!notif.is_read ? "bg-blue-50/50 border-l-2 border-l-[#166534]" : ""}`}
                        >
                          <div className="flex-1">
                            <h4 className="text-xs font-bold text-slate-800">{notif.title}</h4>
                            <p className="text-[11px] text-slate-500 mt-1 leading-relaxed">{notif.message}</p>
                            <span className="text-[9px] text-slate-400 block mt-1">Recently</span>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Profile Avatar */}
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-full bg-[#166534] text-white text-xs font-bold flex items-center justify-center">
                RP
              </div>
              <div className="hidden md:block text-left">
                <span className="text-xs font-bold text-slate-800 block">Ramesh Patel</span>
                <span className="px-2 py-0.5 bg-[#166534]/15 border border-[#166534]/30 rounded-full text-[8px] font-bold text-[#166534] uppercase tracking-wide">
                  Farmer
                </span>
              </div>
            </div>
          </div>
        </header>

        {/* Content Body */}
        <div className="p-8 space-y-6 max-w-7xl w-full mx-auto">
          {/* Welcome Banner */}
          <div className="bg-[#F0FDF4] border-l-4 border-[#166534] p-5 rounded-r-xl shadow-sm">
            <h3 className="text-base font-bold text-[#166534]">Welcome back, Ramesh Patel</h3>
            <p className="text-xs text-slate-600 mt-1.5">
              Your registered farms: <span className="font-bold text-slate-800">{farms.length}</span> | Active claims: <span className="font-bold text-slate-800">{activeClaimsCount}</span>
            </p>
          </div>

          {/* Stat Cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {[
              { label: "Total Farms", value: farms.length, sub: "Registered via satellite", color: "border-slate-200" },
              { label: "Active Claims", value: activeClaimsCount, sub: "Under satellite assessment", color: "border-slate-200" },
              { label: "Approved Claims", value: 1, sub: "₹25,000 credited", color: "border-slate-200" },
              { label: "Pending Payout", value: "₹25,000", sub: "Approved claim waiting release", color: "border-[#F59E0B]/50 bg-amber-50/20" },
            ].map((stat, i) => (
              <div key={i} className={`bg-white border rounded-xl p-5 shadow-sm ${stat.color}`}>
                <span className="text-[10px] text-slate-500 uppercase tracking-wider block font-bold">{stat.label}</span>
                <span className="text-2xl font-extrabold text-slate-800 block mt-2">{stat.value}</span>
                <span className="text-[10px] text-slate-400 block mt-1">{stat.sub}</span>
              </div>
            ))}
          </div>

          {/* Tables Row */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* My Farms Table */}
            <div className="lg:col-span-7 bg-white border border-[#E2E8F0] rounded-xl shadow-sm p-6 space-y-4">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wider flex items-center gap-2">
                  <Tractor className="w-4 h-4 text-[#166534]" />
                  My Registered Farms
                </h3>
                <Link href="/dashboard/farmer/farms" className="text-xs text-[#166534] hover:underline font-bold">
                  Manage Farms
                </Link>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-xs text-left">
                  <thead>
                    <tr className="bg-slate-50 text-slate-500 font-bold border-b border-slate-200">
                      <th className="py-2.5 px-3">Farm Name</th>
                      <th className="py-2.5 px-3">Crop</th>
                      <th className="py-2.5 px-3">Area</th>
                      <th className="py-2.5 px-3">Status</th>
                      <th className="py-2.5 px-3 text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {farmsLoading ? (
                      <tr>
                        <td colSpan={5} className="py-4 text-center text-slate-400">Loading farms...</td>
                      </tr>
                    ) : farms.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="py-6 text-center text-slate-400">No farms registered yet.</td>
                      </tr>
                    ) : (
                      farms.map((f, i) => (
                        <tr key={f.id} className={`${i % 2 === 0 ? "bg-white" : "bg-slate-50/50"} hover:bg-slate-50`}>
                          <td className="py-3 px-3 font-semibold text-slate-700">{f.name}</td>
                          <td className="py-3 px-3">{f.crop_type}</td>
                          <td className="py-3 px-3">{f.area_hectares?.toFixed(1)} ha</td>
                          <td className="py-3 px-3">
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-50 text-[#166534] border border-[#166534]/20 font-bold text-[9px] uppercase tracking-wide">
                              Active
                            </span>
                          </td>
                          <td className="py-3 px-3 text-right">
                            <Link href="/dashboard/farmer/farms" className="border border-slate-300 hover:border-slate-500 px-2.5 py-1 rounded text-[10px] font-semibold transition-all">
                              View Map
                            </Link>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Recent Claims Table */}
            <div className="lg:col-span-5 bg-white border border-[#E2E8F0] rounded-xl shadow-sm p-6 space-y-4">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wider flex items-center gap-2">
                  <ClipboardList className="w-4 h-4 text-[#166534]" />
                  Recent Claims
                </h3>
                <Link href="/dashboard/farmer/claims/decision" className="text-xs text-[#166534] hover:underline font-bold">
                  File Claim
                </Link>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-xs text-left">
                  <thead>
                    <tr className="bg-slate-50 text-slate-500 font-bold border-b border-slate-200">
                      <th className="py-2.5 px-3">Claim ID</th>
                      <th className="py-2.5 px-3">Type</th>
                      <th className="py-2.5 px-3">Date</th>
                      <th className="py-2.5 px-3">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {mockClaims.map((claim, idx) => {
                      let badge = "";
                      if (claim.status === "Approved") {
                        badge = "bg-emerald-50 text-[#166534] border-[#166534]/20";
                      } else if (claim.status === "Rejected") {
                        badge = "bg-red-50 text-[#DC2626] border-red-500/20";
                      } else {
                        badge = "bg-amber-50 text-[#F59E0B] border-[#F59E0B]/20";
                      }
                      return (
                        <tr key={idx} className="hover:bg-slate-50">
                          <td className="py-3 px-3 font-semibold text-slate-700">{claim.id}</td>
                          <td className="py-3 px-3">{claim.type}</td>
                          <td className="py-3 px-3 text-slate-500">{claim.date}</td>
                          <td className="py-3 px-3">
                            <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full border font-bold text-[9px] uppercase tracking-wide ${badge}`}>
                              {claim.status}
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          {/* Quick Actions Footer Row */}
          <div className="bg-white border border-[#E2E8F0] p-5 rounded-xl shadow-sm flex flex-col sm:flex-row gap-4 items-center justify-between">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Quick Actions</span>
            <div className="flex flex-wrap gap-3">
              <Link href="/dashboard/farmer/farms" className="px-4 py-2 border border-slate-300 hover:border-slate-500 rounded-lg text-xs font-semibold transition-all">
                + Register New Farm
              </Link>
              <Link href="/dashboard/farmer/claims/decision" className="px-4 py-2 bg-[#166534] hover:bg-emerald-800 text-white rounded-lg text-xs font-semibold transition-all shadow-sm">
                + File Insurance Claim
              </Link>
              <a href="tel:18001801551" className="px-4 py-2 border border-[#DC2626] text-[#DC2626] hover:bg-red-50 rounded-lg text-xs font-semibold transition-all flex items-center gap-1.5">
                <Phone className="w-3.5 h-3.5" />
                Contact Helpline
              </a>
            </div>
          </div>
        </div>
      </main>

      {/* SMS Simulator Widget */}
      <SMSSimulator />
    </div>
  );
}

export default function FarmerDashboard() {
  return (
    <QueryClientProvider client={queryClient}>
      <FarmerDashboardContent />
    </QueryClientProvider>
  );
}
