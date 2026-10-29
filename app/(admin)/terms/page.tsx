
import Link from "next/link";
import { connection } from "next/server";
import { requireSuperadmin } from "@/lib/auth/require-superadmin";
import { createTerm, updateTerm, deleteTerm } from "./actions";

export const instant = false;

const PAGE_SIZE = 20;

type PageProps = {
  searchParams: Promise<{
    page?: string;
    created?: string;
    updated?: string;
    deleted?: string;
    error?: string;
  }>;
};

export default async function TermsPage({
  searchParams,
}: PageProps) {
  await connection();

  // Reuse existing Week 6 superadmin authorization.
  const { supabase } = await requireSuperadmin();

  const params = await searchParams;
  const requestedPage = Number(params.page ?? "1");

  const page =
    Number.isSafeInteger(requestedPage) && requestedPage > 0
      ? Math.min(requestedPage, 10000)
      : 1;

  const offset = (page - 1) * PAGE_SIZE;

  const { data, count, error } = await supabase
    .from("terms")
    .select(
      "id, term, definition, category, is_active, created_at, updated_at",
      { count: "exact" }
    )
    .order("created_at", { ascending: false })
    .order("id", { ascending: false })
    .range(offset, offset + PAGE_SIZE - 1);

  if (error) {
    console.error("Admin terms query failed:", error);
    throw new Error("Unable to load terms.");
  }

  const terms = data ?? [];
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
          Terms
        </h1>

        <p className="mt-4 max-w-2xl text-gray-400">
          Manage reusable terminology and definitions for
          Caption Arena. Create, inspect, edit, and remove
          terms from the database.
        </p>
      </header>

      {/* Operation feedback */}
      {params.created === "1" && (
        <div
          role="status"
          className="mt-8 rounded-xl border border-emerald-500/30 bg-emerald-500/5 p-4 text-sm text-emerald-300"
        >
          Term created successfully.
        </div>
      )}

      {params.updated === "1" && (
        <div
          role="status"
          className="mt-8 rounded-xl border border-emerald-500/30 bg-emerald-500/5 p-4 text-sm text-emerald-300"
        >
          Term updated successfully.
        </div>
      )}

      {params.deleted === "1" && (
        <div
          role="status"
          className="mt-8 rounded-xl border border-emerald-500/30 bg-emerald-500/5 p-4 text-sm text-emerald-300"
        >
          Term deleted successfully.
        </div>
      )}

      {params.error === "duplicate" && (
        <div
          role="alert"
          className="mt-8 rounded-xl border border-amber-500/30 bg-amber-500/5 p-4 text-sm text-amber-300"
        >
          A term with that name already exists. Term names
          are case-insensitive.
        </div>
      )}

      {/* CREATE */}
      <section className="mt-12 rounded-2xl border border-white/15 bg-white/[0.025] p-6 md:p-8">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h2 className="text-xl font-semibold">
              Create a term
            </h2>

            <p className="mt-2 text-sm text-gray-400">
              Add a new entry to the terms database.
            </p>
          </div>

          <span className="rounded-full border border-indigo-500/30 bg-indigo-500/10 px-3 py-1 text-xs font-medium text-indigo-300">
            CREATE
          </span>
        </div>

        <form action={createTerm} className="mt-8 space-y-6">
          <div className="grid gap-6 md:grid-cols-2">
            <div>
              <label
                htmlFor="new-term"
                className="block text-sm font-medium"
              >
                Term
              </label>

              <input
                id="new-term"
                name="term"
                type="text"
                required
                maxLength={120}
                placeholder="e.g. Campus humor"
                className="mt-3 w-full rounded-xl border border-white/20 bg-white/[0.04] px-4 py-3 text-white outline-none placeholder:text-gray-600 focus:border-indigo-400"
              />
            </div>

            <div>
              <label
                htmlFor="new-category"
                className="block text-sm font-medium"
              >
                Category
              </label>

              <input
                id="new-category"
                name="category"
                type="text"
                required
                maxLength={80}
                defaultValue="general"
                className="mt-3 w-full rounded-xl border border-white/20 bg-white/[0.04] px-4 py-3 text-white outline-none focus:border-indigo-400"
              />
            </div>
          </div>

          <div>
            <label
              htmlFor="new-definition"
              className="block text-sm font-medium"
            >
              Definition
            </label>

            <textarea
              id="new-definition"
              name="definition"
              rows={3}
              maxLength={2000}
              placeholder="Explain the term..."
              className="mt-3 w-full rounded-xl border border-white/20 bg-white/[0.04] px-4 py-3 text-white outline-none placeholder:text-gray-600 focus:border-indigo-400"
            />
          </div>

          <div className="flex flex-wrap items-center justify-between gap-4">
            <label className="flex cursor-pointer items-center gap-3">
              <input
                type="checkbox"
                name="isActive"
                defaultChecked
                className="h-5 w-5 accent-indigo-400"
              />

              <span className="text-sm text-gray-300">
                Active term
              </span>
            </label>

            <button
              type="submit"
              className="cursor-pointer rounded-xl bg-white px-6 py-3 text-sm font-semibold text-black transition-colors hover:bg-gray-200"
            >
              Create term
            </button>
          </div>
        </form>
      </section>

      {/* READ */}
      <section className="mt-12">
        <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
          <div>
            <h2 className="text-xl font-semibold">
              Term directory
            </h2>

            <p className="mt-2 text-sm text-gray-500">
              Read, update, or delete existing entries.
            </p>
          </div>

          <span className="rounded-full border border-white/15 px-4 py-2 text-sm text-gray-400">
            {total.toLocaleString("en-US")} terms
          </span>
        </div>

        {terms.length === 0 ? (
          <div className="rounded-2xl border border-white/15 p-10 text-center text-gray-400">
            No terms found on this page.
          </div>
        ) : (
          <div className="space-y-4">
            {terms.map((item) => (
              <article
                key={item.id}
                className="overflow-hidden rounded-2xl border border-white/15 bg-white/[0.025]"
              >
                <div className="p-6">
                  <div className="flex flex-wrap items-start justify-between gap-4">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-3">
                        <span className="rounded-full border border-white/15 px-3 py-1 text-xs text-gray-400">
                          {item.category}
                        </span>

                        <span
                          className={`rounded-full border px-3 py-1 text-xs ${
                            item.is_active
                              ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-300"
                              : "border-white/15 text-gray-500"
                          }`}
                        >
                          {item.is_active ? "Active" : "Inactive"}
                        </span>
                      </div>

                      <h3 className="mt-4 text-xl font-semibold">
                        {item.term}
                      </h3>

                      <p className="mt-3 whitespace-pre-wrap break-words text-sm leading-7 text-gray-400">
                        {item.definition || "No definition provided."}
                      </p>
                    </div>

                    <p className="text-xs text-gray-500">
                      Updated{" "}
                      {new Date(item.updated_at).toLocaleDateString(
                        "en-US",
                        {
                          month: "short",
                          day: "numeric",
                          year: "numeric",
                          timeZone: "UTC",
                        }
                      )}
                    </p>
                  </div>
                </div>

                {/* UPDATE */}
                <details className="border-t border-white/10">
                  <summary className="cursor-pointer p-5 text-sm font-medium text-indigo-300 hover:bg-white/[0.025]">
                    Edit term
                  </summary>

                  <form
                    action={updateTerm}
                    className="space-y-6 border-t border-white/10 p-6"
                  >
                    <input
                      type="hidden"
                      name="id"
                      value={item.id}
                    />

                    <div className="grid gap-6 md:grid-cols-2">
                      <div>
                        <label
                          htmlFor={`term-${item.id}`}
                          className="block text-sm font-medium"
                        >
                          Term
                        </label>

                        <input
                          id={`term-${item.id}`}
                          name="term"
                          type="text"
                          required
                          maxLength={120}
                          defaultValue={item.term}
                          className="mt-3 w-full rounded-xl border border-white/20 bg-white/[0.04] px-4 py-3 text-white outline-none focus:border-indigo-400"
                        />
                      </div>

                      <div>
                        <label
                          htmlFor={`category-${item.id}`}
                          className="block text-sm font-medium"
                        >
                          Category
                        </label>

                        <input
                          id={`category-${item.id}`}
                          name="category"
                          type="text"
                          required
                          maxLength={80}
                          defaultValue={item.category}
                          className="mt-3 w-full rounded-xl border border-white/20 bg-white/[0.04] px-4 py-3 text-white outline-none focus:border-indigo-400"
                        />
                      </div>
                    </div>

                    <div>
                      <label
                        htmlFor={`definition-${item.id}`}
                        className="block text-sm font-medium"
                      >
                        Definition
                      </label>

                      <textarea
                        id={`definition-${item.id}`}
                        name="definition"
                        rows={3}
                        maxLength={2000}
                        defaultValue={item.definition}
                        className="mt-3 w-full rounded-xl border border-white/20 bg-white/[0.04] px-4 py-3 text-white outline-none focus:border-indigo-400"
                      />
                    </div>

                    <div className="flex flex-wrap items-center justify-between gap-4">
                      <label className="flex cursor-pointer items-center gap-3">
                        <input
                          type="checkbox"
                          name="isActive"
                          defaultChecked={item.is_active}
                          className="h-5 w-5 accent-indigo-400"
                        />

                        <span className="text-sm text-gray-300">
                          Active term
                        </span>
                      </label>

                      <button
                        type="submit"
                        className="cursor-pointer rounded-xl bg-white px-5 py-3 text-sm font-semibold text-black hover:bg-gray-200"
                      >
                        Save changes
                      </button>
                    </div>
                  </form>
                </details>

                {/* DELETE */}
                <details className="border-t border-rose-500/15">
                  <summary className="cursor-pointer p-5 text-sm font-medium text-rose-300 hover:bg-rose-500/[0.04]">
                    Delete term
                  </summary>

                  <form
                    action={deleteTerm}
                    className="space-y-5 border-t border-rose-500/15 bg-rose-500/[0.025] p-6"
                  >
                    <input
                      type="hidden"
                      name="id"
                      value={item.id}
                    />

                    <p className="text-sm leading-6 text-gray-400">
                      This permanently deletes the term from
                      Supabase. To confirm, type the exact phrase:
                    </p>

                    <p className="break-all rounded-lg border border-rose-500/20 bg-black/30 p-3 font-mono text-sm text-rose-300">
                      DELETE {item.term}
                    </p>

                    <div>
                      <label
                        htmlFor={`delete-${item.id}`}
                        className="block text-sm font-medium text-gray-300"
                      >
                        Confirmation
                      </label>

                      <input
                        id={`delete-${item.id}`}
                        name="confirmation"
                        type="text"
                        required
                        autoComplete="off"
                        placeholder="Type the exact phrase above"
                        className="mt-3 w-full rounded-xl border border-rose-500/30 bg-black/20 px-4 py-3 text-white outline-none focus:border-rose-400"
                      />
                    </div>

                    <button
                      type="submit"
                      className="cursor-pointer rounded-xl border border-rose-500/40 bg-rose-500/10 px-5 py-3 text-sm font-semibold text-rose-300 hover:bg-rose-500/20"
                    >
                      Permanently delete term
                    </button>
                  </form>
                </details>
              </article>
            ))}
          </div>
        )}
      </section>

      {/* Pagination */}
      <nav
        aria-label="Terms pagination"
        className="mt-8 flex items-center justify-center gap-5"
      >
        {page > 1 ? (
          <Link
            href={`/terms?page=${page - 1}`}
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
            href={`/terms?page=${page + 1}`}
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
