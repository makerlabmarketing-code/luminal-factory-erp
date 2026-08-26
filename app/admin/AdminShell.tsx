"use client";

import { AdminAppShell } from "@/component/app-shell/AdminAppShell";
import { filterAdminNavigation } from "@/lib/navigation/admin";

interface AdminShellProps {
  children: React.ReactNode;
  canAccessAdmin: boolean;
  canAccessStaff: boolean;
  permissionCodes: readonly string[];
}

export default function AdminShell({
  children,
  canAccessAdmin,
  canAccessStaff,
  permissionCodes,
}: AdminShellProps) {
  return (
    <AdminAppShell
      navigationGroups={filterAdminNavigation(permissionCodes)}
      canSwitchWorkspace={canAccessAdmin && canAccessStaff}
    >
      {children}
    </AdminAppShell>
  );
}
