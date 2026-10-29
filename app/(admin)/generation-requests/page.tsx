
import Link from "next/link";
import { connection } from "next/server";
import { requireSuperadmin } from "@/lib/auth/require-superadmin";

export const instant = false;

const PAGE_SIZE = 20;

type PageProps = {
  searchParams: Promise<{
    page?: string;
  }>;
};

export default async function GenerationRequestsPage({
  searchParams,
}: PageProps) {
  await connection();

  // Reuse our existing superadmin authorization.
  const { supabase } = await requireSuperadmin();

  const params = await searchParams;
  const requestedPage = Number(params.page ?? "1");

  const page =
    Number.isSafeInteger(requestedPage) && requestedPage > 0
      ? Math.min(requestedPage, 10000)
      : 1;

  const offset = (page - 1) * PAGE_SIZE;

  const { data, count, error } = await supabase
    .from("generation_requests")
    .select(
      "id, requester_id, source_app, image_path, user_prompt, generation_prompt, requested_model, actual_model, generation_set_id, status, error_code, error_message, duration_ms, started_at, completed_at",
      { count: "exact" }
    )
    .order("started_at", { ascending: false })
    .order("id", { ascending: false })
    .range(offset, offset + PAGE_SIZE - 1);

  if (error) {
    console.error("Generation requests query failed:", error);
    throw new Error("Unable to load generation requests.");
  }

  const requests = data ?? [];
  const total = count ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <main className="mx-auto min-h-screen max-w-7xl px-6 py-12">
      <header>
        <p className="text-sm font-semibold tracking-[0.2em] text-gray-500">
          CAPTION ARENA ADMIN
        </p>

        <h1 className="mt-4 text-4xl font-bold tracking-tight md:text-5xl">
          Generation Requests
        </h1>

        <p className="mt-4 max-w-2xl text-gray-400">
          Inspect successful and failed AI generation attempts
          across the main and admin applications.
        </p>
      </header>

      <section className="mt-12">
        <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
          <div>
            <h2 className="text-xl font-semibold">
              Request history
            </h2>

            <p className="mt-2 text-sm text-gray-500">
              Newest first · Read-only
            </p>
          </div>

          <span className="rounded-full border border-white/15 px-4 py-2 text-sm text-gray-400">
            {total.toLocaleString("en-US")} requests
          </span>
        </div>

        {requests.length === 0 ? (
          <div className="rounded-2xl border border-white/15 p-10 text-center text-gray-400">
            No generation requests found.
          </div>
        ) : (
          <div className="space-y-4">
            {requests.map((item) => {
              const succeeded = item.status === "succeeded";

              return (
                <article
                  key={item.id}
                  className="rounded-2xl border border-white/15 bg-white/[0.025] p-6"
                >
                  <div className="flex flex-wrap items-start justify-between gap-4">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-3">
                        <span
                          className={`rounded-full border px-3 py-1 text-xs font-medium ${
                            succeeded
                              ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-300"
                              : "border-rose-500/30 bg-rose-500/10 text-rose-300"
                          }`}
                        >
                          {succeeded ? "Succeeded" : "Failed"}
                        </span>

                        <span className="rounded-full border border-white/15 px-3 py-1 text-xs uppercase text-gray-400">
                          {item.source_app} app
                        </span>
                      </div>

                      <p className="mt-4 break-words text-sm font-medium text-white">
                        {item.actual_model ?? item.requested_model}
                      </p>

                      <p className="mt-2 text-xs text-gray-500">
                        {new Date(item.started_at).toLocaleString(
                          "en-US",
                          {
                            dateStyle: "medium",
                            timeStyle: "medium",
                            timeZone: "America/New_York",
                          }
                        )} ET
                      </p>
                    </div>

                    <div className="text-right">
                      <p className="text-xs text-gray-500">
                        Duration
                      </p>

                      <p className="mt-1 text-lg font-semibold tabular-nums">
                        {item.duration_ms == null
                          ? "—"
                          : `${(item.duration_ms / 1000).toFixed(1)}s`}
                      </p>

                      {item.generation_set_id != null && (
                        <Link
                          href={`/media/${item.generation_set_id}/edit`}
                          className="mt-3 inline-block text-sm text-indigo-300 hover:underline"
                        >
                          View Battle #{item.generation_set_id}
                        </Link>
                      )}
                    </div>
                  </div>

                  {item.error_code && (
                    <div className="mt-5 rounded-lg border border-rose-500/20 bg-rose-500/5 p-3">
                      <p className="text-sm font-medium text-rose-300">
                        {item.error_code}
                      </p>

                      {item.error_message && (
                        <p className="mt-1 text-sm text-gray-400">
                          {item.error_message}
                        </p>
                      )}
                    </div>
                  )}

                  <details className="mt-6 border-t border-white/10 pt-4">
                    <summary className="cursor-pointer text-sm font-medium text-gray-300 hover:text-white">
                      View request details
                    </summary>

                    <div className="mt-5 space-y-5 text-sm">
                      <div>
                        <p className="text-xs uppercase tracking-wider text-gray-500">
                          Request ID
                        </p>
                        <p className="mt-1 break-all font-mono text-xs text-gray-300">
                          {item.id}
                        </p>
                      </div>

                      <div>
                        <p className="text-xs uppercase tracking-wider text-gray-500">
                          Requester ID
                        </p>
                        <p className="mt-1 break-all font-mono text-xs text-gray-300">
                          {item.requester_id}
                        </p>
                      </div>

                      <div>
                        <p className="text-xs uppercase tracking-wider text-gray-500">
                          Requested model
                        </p>
                        <p className="mt-1 break-words text-gray-300">
                          {item.requested_model}
                        </p>
                      </div>

                      <div>
                        <p className="text-xs uppercase tracking-wider text-gray-500">
                          Image path
                        </p>
                        <p className="mt-1 break-all text-gray-300">
                          {item.image_path || "Not recorded"}
                        </p>
                      </div>

                      <div>
                        <p className="text-xs uppercase tracking-wider text-gray-500">
                          User context
                        </p>
                        <p className="mt-1 whitespace-pre-wrap break-words text-gray-300">
                          {item.user_prompt || "No context provided"}
                        </p>
                      </div>

                      <div>
                        <p className="text-xs uppercase tracking-wider text-gray-500">
                          Generation prompt
                        </p>
                        <pre className="mt-2 max-h-80 overflow-auto whitespace-pre-wrap break-words rounded-xl border border-white/10 bg-black/30 p-4 font-mono text-xs leading-6 text-gray-300">
                          {item.generation_prompt || "Not recorded"}
                        </pre>
                      </div>

                      <div>
                        <p className="text-xs uppercase tracking-wider text-gray-500">
                          Completed
                        </p>
                        <p className="mt-1 text-gray-300">
                          {new Date(item.completed_at).toLocaleString(
                            "en-US",
                            {
                              dateStyle: "medium",
                              timeStyle: "medium",
                              timeZone: "America/New_York",
                            }
                          )} ET
                        </p>
                      </div>
                    </div>
                  </details>
                </article>
              );
            })}
          </div>
        )}
      </section>

      <nav
        aria-label="Generation requests pagination"
        className="mt-8 flex items-center justify-center gap-5"
      >
        {page > 1 ? (
          <Link
            href={`/generation-requests?page=${page - 1}`}
            className="rounded-xl border border-white/20 px-4 py-2 text-sm hover:bg-white/10"
          >
            ← Previous
          </Link>
        ) : (
          <span className="text-sm text-gray-600">
            ← Previous
          </span>
        )}

        <span className="text-sm text-gray-400">
          Page {page} of {totalPages}
        </span>

        {page < totalPages ? (
          <Link
            href={`/generation-requests?page=${page + 1}`}
            className="rounded-xl border border-white/20 px-4 py-2 text-sm hover:bg-white/10"
          >
            Next →
          </Link>
        ) : (
          <span className="text-sm text-gray-600">
            Next →
          </span>
        )}
      </nav>
    </main>
  );
}
