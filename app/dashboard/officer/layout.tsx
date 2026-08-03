import RoleGuard from "@/components/auth/RoleGuard";

export default function OfficerLayout({ children }: { children: React.ReactNode }) {
  return (
    <RoleGuard allowedRoles={["officer", "admin"]}>
      {children}
    </RoleGuard>
  );
}
