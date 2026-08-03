import RoleGuard from "@/components/auth/RoleGuard";

export default function FarmerLayout({ children }: { children: React.ReactNode }) {
  return (
    <RoleGuard allowedRoles={["farmer"]}>
      {children}
    </RoleGuard>
  );
}
