
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

export default async function LlmResponsesPage({
  searchParams,
}: PageProps) {
  await connection();

  // Reuse existing server-side superadmin authorization.
  const { supabase } = await requireSuperadmin();

  const params = await searchParams;
  const requestedPage = Number(params.page ?? "1");

  const page =
    Number.isSafeInteger(requestedPage) && requestedPage > 0
      ? Math.min(requestedPage, 10000)
      : 1;

  const offset = (page - 1) * PAGE_SIZE;

  const { data, count, error } = await supabase
    .from("llm_responses")
    .select(
      "id, request_id, requester_id, provider, model, provider_response_id, http_status, response_text, finish_reason, prompt_tokens, completion_tokens, total_tokens, duration_ms, error_message, created_at",
      { count: "exact" }
    )
    .order("created_at", { ascending: false })
    .order("id", { ascending: false })
    .range(offset, offset + PAGE_SIZE - 1);

  if (error) {
    console.error("Admin LLM responses query failed:", error);
    throw new Error("Unable to load LLM responses.");
  }

  const responses = data ?? [];
  const total = count ?? 0;
  const totalPages = Math.max(
    1,
    Math.ceil(total / PAGE_SIZE)
  );

  return (
    <main className="mx-auto min-h-screen max-w-7xl px-6 py-12">
      <header>
        <p className="text-sm font-semibold tracking-[0.2em] text-gray-500">
          CAPTION ARENA ADMIN
        </p>

        <h1 className="mt-4 text-4xl font-bold tracking-tight md:text-5xl">
          LLM Responses
        </h1>

        <p className="mt-4 max-w-2xl text-gray-400">
          Inspect provider responses, actual model usage,
          token consumption, and returned text.
        </p>

        <Link
          href="/generation-requests"
          className="mt-5 inline-block text-sm text-indigo-300 hover:underline"
        >
          View generation requests →
        </Link>
      </header>

      <section className="mt-12">
        <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
          <div>
            <h2 className="text-xl font-semibold">
              Response history
            </h2>

            <p className="mt-2 text-sm text-gray-500">
              Newest first · Read-only
            </p>
          </div>

          <span className="rounded-full border border-white/15 px-4 py-2 text-sm text-gray-400">
            {total.toLocaleString("en-US")} responses
          </span>
        </div>

        {responses.length === 0 ? (
          <div className="rounded-2xl border border-white/15 p-10 text-center text-gray-400">
            No LLM responses recorded yet.
          </div>
        ) : (
          <div className="space-y-4">
            {responses.map((item) => (
              <article
                key={item.id}
                className="rounded-2xl border border-white/15 bg-white/[0.025] p-6"
              >
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-3">
                      <span className="rounded-full border border-indigo-500/30 bg-indigo-500/10 px-3 py-1 text-xs font-medium text-indigo-300">
                        {item.provider}
                      </span>

                      <span className="rounded-full border border-white/15 px-3 py-1 text-xs text-gray-400">
                        {item.http_status === null
                          ? "No HTTP response"
                          : `HTTP ${item.http_status}`}
                      </span>
                    </div>

                    <p className="mt-4 break-words text-sm font-semibold text-white">
                      {item.model || "Model not recorded"}
                    </p>

                    <p className="mt-2 text-xs text-gray-500">
                      {new Date(item.created_at).toLocaleString(
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
                      LLM latency
                    </p>

                    <p className="mt-1 text-lg font-semibold tabular-nums">
                      {item.duration_ms === null
                        ? "—"
                        : `${(item.duration_ms / 1000).toFixed(1)}s`}
                    </p>
                  </div>
                </div>

                <div className="mt-6 grid gap-3 sm:grid-cols-3">
                  <div className="rounded-xl border border-white/10 bg-white/[0.025] p-4">
                    <p className="text-xs text-gray-500">
                      Prompt tokens
                    </p>
                    <p className="mt-2 text-2xl font-semibold tabular-nums">
                      {item.prompt_tokens?.toLocaleString("en-US") ?? "—"}
                    </p>
                  </div>

                  <div className="rounded-xl border border-white/10 bg-white/[0.025] p-4">
                    <p className="text-xs text-gray-500">
                      Completion tokens
                    </p>
                    <p className="mt-2 text-2xl font-semibold tabular-nums">
                      {item.completion_tokens?.toLocaleString("en-US") ?? "—"}
                    </p>
                  </div>

                  <div className="rounded-xl border border-white/10 bg-white/[0.025] p-4">
                    <p className="text-xs text-gray-500">
                      Total tokens
                    </p>
                    <p className="mt-2 text-2xl font-semibold tabular-nums">
                      {item.total_tokens?.toLocaleString("en-US") ?? "—"}
                    </p>
                  </div>
                </div>

                {item.error_message && (
                  <div className="mt-5 rounded-xl border border-rose-500/20 bg-rose-500/5 p-4">
                    <p className="text-xs font-semibold uppercase tracking-wider text-rose-300">
                      Provider error
                    </p>
                    <p className="mt-2 whitespace-pre-wrap break-words text-sm text-gray-300">
                      {item.error_message}
                    </p>
                  </div>
                )}

                <details className="mt-6 border-t border-white/10 pt-4">
                  <summary className="cursor-pointer text-sm font-medium text-gray-300 hover:text-white">
                    View response details
                  </summary>

                  <div className="mt-5 space-y-5 text-sm">
                    <div>
                      <p className="text-xs uppercase tracking-wider text-gray-500">
                        Response ID
                      </p>
                      <p className="mt-1 break-all font-mono text-xs text-gray-300">
                        {item.id}
                      </p>
                    </div>

                    <div>
                      <p className="text-xs uppercase tracking-wider text-gray-500">
                        Generation request ID
                      </p>
                      <p className="mt-1 break-all font-mono text-xs text-gray-300">
                        {item.request_id}
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
                        Provider response ID
                      </p>
                      <p className="mt-1 break-all font-mono text-xs text-gray-300">
                        {item.provider_response_id || "Not recorded"}
                      </p>
                    </div>

                    <div>
                      <p className="text-xs uppercase tracking-wider text-gray-500">
                        Finish reason
                      </p>
                      <p className="mt-1 text-gray-300">
                        {item.finish_reason || "Not reported"}
                      </p>
                    </div>

                    <div>
                      <p className="text-xs uppercase tracking-wider text-gray-500">
                        LLM response text
                      </p>

                      <pre className="mt-2 max-h-96 overflow-auto whitespace-pre-wrap break-words rounded-xl border border-white/10 bg-black/30 p-4 font-mono text-xs leading-6 text-gray-300">
                        {item.response_text || "No response text recorded"}
                      </pre>
                    </div>
                  </div>
                </details>
              </article>
            ))}
          </div>
        )}
      </section>

      <nav
        aria-label="LLM responses pagination"
        className="mt-8 flex items-center justify-center gap-5"
      >
        {page > 1 ? (
          <Link
            href={`/llm-responses?page=${page - 1}`}
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
            href={`/llm-responses?page=${page + 1}`}
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
