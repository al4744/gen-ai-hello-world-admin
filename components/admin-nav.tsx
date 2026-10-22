
"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut } from "@/app/(admin)/actions";

const navigation = [
  { label: "Dashboard", href: "/dashboard", number: "01" },
  { label: "Users", href: "/users", number: "02" },
  { label: "Media", href: "/media", number: "03" },
  { label: "Votes", href: "/votes", number: "04" },
];

export default function AdminNav() {
  const pathname = usePathname();

  function isActive(href: string) {
    return pathname === href || pathname.startsWith(`${href}/`);
  }

  return (
    <>
      {/* Desktop sidebar */}
      <aside className="hidden h-screen w-64 shrink-0 flex-col border-r border-white/10 bg-white/[0.015] md:sticky md:top-0 md:flex">
        <div className="border-b border-white/10 px-6 py-8">
          <Link href="/dashboard" className="block">
            <p className="text-xs font-semibold tracking-[0.2em] text-gray-500">
              CAPTION ARENA
            </p>

            <h2 className="mt-2 text-2xl font-bold tracking-tight">
              Admin
              <span className="text-gray-500">.</span>
            </h2>
          </Link>
        </div>

        <nav
          aria-label="Admin navigation"
          className="flex-1 space-y-2 px-4 py-6"
        >
          <p className="mb-4 px-3 text-xs font-semibold uppercase tracking-widest text-gray-600">
            Workspace
          </p>

          {navigation.map((item) => {
            const active = isActive(item.href);

            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={`flex items-center justify-between rounded-xl px-4 py-3 text-sm font-medium transition-colors ${
                  active
                    ? "bg-white text-black"
                    : "text-gray-400 hover:bg-white/10 hover:text-white"
                }`}
              >
                <span>{item.label}</span>

                <span
                  className={`font-mono text-xs ${
                    active ? "text-gray-500" : "text-gray-600"
                  }`}
                >
                  {item.number}
                </span>
              </Link>
            );
          })}
        </nav>

        {/* Desktop footer and log out */}
        <div className="border-t border-white/10 px-6 py-6">
          <p className="text-xs font-medium text-gray-400">
            Caption Arena Admin
          </p>

          <p className="mt-1 text-xs text-gray-600">
            Administration & Analytics
          </p>

          <form action={signOut} className="mt-5">
            <button
              type="submit"
              className="w-full cursor-pointer rounded-xl border border-white/15 px-4 py-3 text-left text-sm font-medium text-gray-400 transition-colors hover:border-red-500/30 hover:bg-red-500/10 hover:text-red-300"
            >
              Log Out →
            </button>
          </form>
        </div>
      </aside>

      {/* Mobile navigation */}
      <header className="sticky top-0 z-30 border-b border-white/10 bg-[#09090b]/95 px-4 py-4 backdrop-blur-md md:hidden">
        <div className="flex items-center justify-between gap-3">
          <Link
            href="/dashboard"
            className="text-lg font-bold tracking-tight"
          >
            Caption Arena{" "}
            <span className="text-gray-500">Admin</span>
          </Link>

          <form action={signOut}>
            <button
              type="submit"
              className="cursor-pointer rounded-lg border border-white/15 px-3 py-2 text-xs font-medium text-gray-400 transition-colors hover:bg-white/10 hover:text-white"
            >
              Log Out
            </button>
          </form>
        </div>

        <nav
          aria-label="Mobile admin navigation"
          className="mt-4 flex gap-2 overflow-x-auto"
        >
          {navigation.map((item) => {
            const active = isActive(item.href);

            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={`shrink-0 rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
                  active
                    ? "bg-white text-black"
                    : "bg-white/5 text-gray-400 hover:bg-white/10 hover:text-white"
                }`}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>
      </header>
    </>
  );
}
