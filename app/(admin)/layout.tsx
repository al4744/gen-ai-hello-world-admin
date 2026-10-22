
import type { ReactNode } from "react";
import { connection } from "next/server";
import AdminNav from "@/components/admin-nav";
import { requireSuperadmin } from "@/lib/auth/require-superadmin";

export const instant = false;

export default async function AdminLayout({
  children,
}: {
  children: ReactNode;
}) {
  // Establish request-time rendering before checking the session.
  await connection();

  // Verify superadmin authorization before rendering the layout.
  await requireSuperadmin();

  return (
    <div className="min-h-screen bg-[#09090b] text-white md:flex">
      <AdminNav />

      <div className="min-w-0 flex-1">
        {children}
      </div>
    </div>
  );
}
