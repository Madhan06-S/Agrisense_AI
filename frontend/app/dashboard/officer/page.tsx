"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function OfficerDashboardRedirect() {
  const router = useRouter();
  useEffect(() => {
    router.replace("/dashboard/officer/claims");
  }, [router]);

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center text-slate-500 text-sm">
      Redirecting to Official Insurance Dashboard...
    </div>
  );
}
