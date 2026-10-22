
import Link from "next/link";
import { connection } from "next/server";
import { requireSuperadmin } from "@/lib/auth/require-superadmin";

export const instant = false;

const PAGE_SIZE = 25;

type VotesPageProps = {
  searchParams: Promise<{
    page?: string;
  }>;
};

const choiceLabels: Record<string, string> = {
  a: "Caption A",
  b: "Caption B",
  both: "Both",
  neither: "Neither",
};

const choiceStyles: Record<string, string> = {
  a: "border-blue-500/30 bg-blue-500/10 text-blue-300",
  b: "border-violet-500/30 bg-violet-500/10 text-violet-300",
  both: "border-emerald-500/30 bg-emerald-500/10 text-emerald-300",
  neither: "border-amber-500/30 bg-amber-500/10 text-amber-300",
};

export default async function VotesPage({
    searchParams,
  }: VotesPageProps) {
    // Explicitly render this page at request time.
    await connection();

    // Verify superadmin authorization before reading voting data.
    const { supabase } = await requireSuperadmin();

  const params = await searchParams;
  const requestedPage = Number(params.page ?? "1");

  const page =
    Number.isSafeInteger(requestedPage) &&
    requestedPage > 0
      ? Math.min(requestedPage, 10000)
      : 1;

  const offset = (page - 1) * PAGE_SIZE;

  const { data, count, error } = await supabase
    .from("votes")
    .select(
      "id, user_id, generation_set_id, chosen_generation_id, choice, created_at",
      { count: "exact" }
    )
    .order("created_at", { ascending: false })
    .order("id", { ascending: false })
    .range(offset, offset + PAGE_SIZE - 1);

  if (error) {
    console.error("Unable to load admin votes:", error);
    throw new Error("Unable to load voting records.");
  }

  const votes = data ?? [];
  const total = count ?? 0;
  const totalPages = Math.max(
    1,
    Math.ceil(total / PAGE_SIZE)
  );

  return (
    <main className="mx-auto min-h-screen max-w-7xl px-6 py-12">
      <header className="space-y-5">

        <div>
          <p className="text-sm font-semibold tracking-[0.2em] text-gray-500">
            CAPTION ARENA ADMIN
          </p>

          <h1 className="mt-4 text-4xl font-bold tracking-tight md:text-5xl">
            Votes
          </h1>

          <p className="mt-4 text-gray-400">
            Inspect individual community voting records.
          </p>
        </div>
      </header>

      <section className="mt-12 overflow-hidden rounded-2xl border border-white/15">
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-white/10 p-6">
          <div>
            <h2 className="text-xl font-semibold">
              Voting records
            </h2>
            <p className="mt-2 text-sm text-gray-500">
              Read-only history of Caption Arena votes.
            </p>
          </div>

          <span className="rounded-full border border-white/15 px-4 py-2 text-sm text-gray-400">
            {total.toLocaleString("en-US")} votes
          </span>
        </div>

        {votes.length === 0 ? (
          <p className="p-10 text-center text-gray-400">
            No voting records found on this page.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[850px] text-left text-sm">
              <thead className="border-b border-white/10 bg-white/[0.03] text-xs uppercase tracking-wider text-gray-500">
                <tr>
                  <th className="px-6 py-4 font-semibold">Vote</th>
                  <th className="px-6 py-4 font-semibold">Battle</th>
                  <th className="px-6 py-4 font-semibold">Choice</th>
                  <th className="px-6 py-4 font-semibold">Voter</th>
                  <th className="px-6 py-4 font-semibold">Submitted</th>
                </tr>
              </thead>

              <tbody className="divide-y divide-white/10">
                {votes.map((vote) => (
                  <tr
                    key={vote.id}
                    className="transition-colors hover:bg-white/[0.035]"
                  >
                    <td className="px-6 py-5 font-mono text-gray-400">
                      #{vote.id}
                    </td>

                    <td className="px-6 py-5">
                      <Link
                        href={`/media/${vote.generation_set_id}/edit`}
                        className="font-medium text-white underline-offset-4 hover:underline"
                      >
                        Battle #{vote.generation_set_id}
                      </Link>
                    </td>

                    <td className="px-6 py-5">
                      <span
                        className={`inline-flex rounded-full border px-3 py-1 text-xs font-medium ${
                          choiceStyles[vote.choice] ??
                          "border-white/15 text-gray-300"
                        }`}
                      >
                        {choiceLabels[vote.choice] ?? vote.choice}
                      </span>
                    </td>

                    <td className="px-6 py-5">
                      <span
                        className="font-mono text-xs text-gray-400"
                        title={vote.user_id}
                      >
                        {vote.user_id.slice(0, 8)}…
                      </span>
                    </td>

                    <td className="whitespace-nowrap px-6 py-5 text-gray-400">
                      {new Date(vote.created_at).toLocaleString(
                        "en-US",
                        {
                          month: "short",
                          day: "numeric",
                          year: "numeric",
                          hour: "numeric",
                          minute: "2-digit",
                          timeZone: "America/New_York",
                        }
                      )}{" "}
                      ET
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <nav
        aria-label="Votes pagination"
        className="mt-8 flex items-center justify-center gap-5"
      >
        {page > 1 ? (
          <Link
            href={`/votes?page=${page - 1}`}
            className="rounded-xl border border-white/20 px-4 py-2 text-sm hover:bg-white/10"
          >
            ← Previous
          </Link>
        ) : (
          <span className="rounded-xl border border-white/10 px-4 py-2 text-sm text-gray-600">
            ← Previous
          </span>
        )}

        <span className="text-sm text-gray-400">
          Page {page} of {totalPages}
        </span>

        {page < totalPages ? (
          <Link
            href={`/votes?page=${page + 1}`}
            className="rounded-xl border border-white/20 px-4 py-2 text-sm hover:bg-white/10"
          >
            Next →
          </Link>
        ) : (
          <span className="rounded-xl border border-white/10 px-4 py-2 text-sm text-gray-600">
            Next →
          </span>
        )}
      </nav>
    </main>
  );
}
