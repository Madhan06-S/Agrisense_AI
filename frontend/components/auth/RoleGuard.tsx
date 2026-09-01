"use client";

import { useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";

export default function RoleGuard({ 
  allowedRoles, 
  children 
}: { 
  allowedRoles: string[]; 
  children: React.ReactNode 
}) {
  const router = useRouter();
  const pathname = usePathname();
  const [authorized, setAuthorized] = useState(false);

  useEffect(() => {
    const token = localStorage.getItem("access_token");
    const role = localStorage.getItem("user_role");

    if (!token) {
      router.push("/login");
      return;
    }

    if (!role || !allowedRoles.includes(role)) {
      // Redirect to correct dashboard based on role
      if (role === "farmer") router.push("/dashboard/farmer");
      else if (role === "officer") router.push("/dashboard/officer/claims");
      else router.push("/login");
      return;
    }

    setAuthorized(true);
  }, [router, pathname, allowedRoles]);

  if (!authorized) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="text-center">
          <div className="w-8 h-8 border-4 border-green-700 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-sm text-slate-600">Verifying access...</p>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
