
import Link from "next/link";
import { requireSuperadmin } from "@/lib/auth/require-superadmin";

export const instant = false;

export default async function UsersPage() {
  // Verify authorization before querying user data.
  const { supabase } = await requireSuperadmin();

  const { data, count, error } = await supabase
    .from("profiles")
    .select(
      "id, first_name, last_name, created_at, is_superadmin",
      { count: "exact" }
    )
    .order("created_at", { ascending: false })
    .range(0, 49);

  if (error) {
    console.error("Unable to load profiles:", error);
    throw new Error("Unable to load user profiles.");
  }

  const profiles = data ?? [];

  return (
    <main className="mx-auto min-h-screen max-w-7xl px-6 py-12">
      <header className="space-y-5">
        <Link
          href="/dashboard"
          className="inline-block text-sm text-gray-400 transition-colors hover:text-white"
        >
          ← Back to Dashboard
        </Link>

        <div>
          <p className="text-sm font-semibold tracking-[0.2em] text-gray-500">
            CAPTION ARENA ADMIN
          </p>

          <h1 className="mt-4 text-4xl font-bold tracking-tight md:text-5xl">
            Users
          </h1>

          <p className="mt-4 text-gray-400">
            View registered Caption Arena profiles.
          </p>
        </div>
      </header>

      <section className="mt-12 overflow-hidden rounded-2xl border border-white/15">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/10 p-6">
          <h2 className="text-xl font-semibold">
            User directory
          </h2>

          <span className="rounded-full border border-white/15 px-3 py-1 text-sm text-gray-400">
            {(count ?? profiles.length).toLocaleString("en-US")} profiles
          </span>
        </div>

        {profiles.length === 0 ? (
          <p className="p-8 text-center text-gray-400">
            No user profiles found.
          </p>
        ) : (
          <div className="divide-y divide-white/10">
            {profiles.map((profile) => {
              const name =
                [profile.first_name, profile.last_name]
                  .filter(Boolean)
                  .join(" ") || "Unnamed user";

              const initials =
                (
                  (profile.first_name?.charAt(0) ?? "") +
                  (profile.last_name?.charAt(0) ?? "")
                ).toUpperCase() || "?";

              return (
                <article
                  key={profile.id}
                  className="flex flex-wrap items-center justify-between gap-4 px-6 py-5"
                >
                  <div className="flex min-w-0 items-center gap-4">
                    <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-white/10 text-sm font-semibold">
                      {initials}
                    </div>

                    <div className="min-w-0">
                      <p className="font-medium">
                        {name}
                      </p>

                      <p className="mt-1 break-all font-mono text-xs text-gray-500">
                        {profile.id}
                      </p>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-4">
                    <div className="text-right">
                      <p className="text-xs text-gray-500">
                        Joined
                      </p>

                      <p className="mt-1 text-sm text-gray-300">
                        {profile.created_at
                          ? new Date(
                              profile.created_at
                            ).toLocaleDateString(
                              "en-US",
                              {
                                month: "short",
                                day: "numeric",
                                year: "numeric",
                              }
                            )
                          : "Unknown"}
                      </p>
                    </div>

                    <span
                      className={`rounded-full border px-3 py-1 text-xs font-medium ${
                        profile.is_superadmin
                          ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-300"
                          : "border-white/15 text-gray-400"
                      }`}
                    >
                      {profile.is_superadmin
                        ? "Superadmin"
                        : "Member"}
                    </span>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </section>

      {(count ?? 0) > 50 && (
        <p className="mt-4 text-center text-sm text-gray-500">
          Showing the first 50 profiles. Pagination will be added as needed.
        </p>
      )}
    </main>
  );
}
