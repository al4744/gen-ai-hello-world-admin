
import Link from "next/link";
import { requireSuperadmin } from "@/lib/auth/require-superadmin";

export const instant = false;

const PAGE_SIZE = 12;

type MediaPageProps = {
    searchParams: Promise<{
      page?: string;
      deleted?: string;
      cleanup?: string;
    }>;
  };

export default async function MediaPage({
  searchParams,
}: MediaPageProps) {
  // Protect the page before reading any media records.
  const { supabase } = await requireSuperadmin();

  const params = await searchParams;
  const requestedPage = Number(params.page ?? "1");

  const page =
    Number.isSafeInteger(requestedPage) &&
    requestedPage > 0
      ? Math.min(requestedPage, 10000)
      : 1;

  const offset = (page - 1) * PAGE_SIZE;

  // Read complete battles with their associated captions.
  const {
    data: battles,
    count,
    error,
  } = await supabase
    .from("generation_sets")
    .select(
      `
        id,
        creator_id,
        image_path,
        model,
        created_at,
        generations (
          id,
          candidate_index,
          content
        )
      `,
      { count: "exact" }
    )
    .order("created_at", { ascending: false })
    .order("id", { ascending: false })
    .range(offset, offset + PAGE_SIZE - 1);

  if (error) {
    console.error("Unable to load admin media:", error);
    throw new Error("Unable to load media.");
  }

  const items = battles ?? [];
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
            Media
          </h1>

          <p className="mt-4 text-gray-400">
            Browse uploaded images and AI-generated caption battles.
          </p>
        </div>
      </header>
      {params.deleted && /^[1-9]\d*$/.test(params.deleted) && (
        <div
            role="status"
            className="mt-8 rounded-xl border border-emerald-500/30 bg-emerald-500/5 p-4 text-sm text-emerald-300"
        >
            Battle #{params.deleted} was deleted from the database.

            {params.cleanup === "failed" && (
            <p className="mt-2 text-amber-300">
                The database records were deleted, but image cleanup
                failed. Check the generation-media bucket in Supabase.
            </p>
            )}
        </div>
        )}

      <section className="mt-12">
        <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
          <div>
            <h2 className="text-xl font-semibold">
              Caption battles
            </h2>

            <p className="mt-1 text-sm text-gray-500">
              View existing generated media and caption pairs.
            </p>
          </div>

        <div className="flex items-center gap-3">
            <span className="rounded-full border border-white/15 px-4 py-2 text-sm text-gray-400">
                {total.toLocaleString("en-US")} battles
            </span>

            <Link
                href="/media/new"
                className="rounded-xl border border-white/20 bg-white px-4 py-2 text-sm font-semibold text-black transition-colors hover:bg-gray-200"
            >
                + Create Battle
            </Link>
            </div>
        </div>

        {items.length === 0 ? (
          <div className="rounded-2xl border border-white/15 p-12 text-center">
            <p className="text-gray-400">
              No battles found on this page.
            </p>
          </div>
        ) : (
          <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
            {items.map((battle) => {
              const imageUrl = battle.image_path
                ? supabase.storage
                    .from("generation-media")
                    .getPublicUrl(battle.image_path)
                    .data.publicUrl
                : null;

              // Sort by candidate index so captions appear
              // in their original A/B order.
              const captions = [
                ...(battle.generations ?? []),
              ].sort(
                (a, b) =>
                  a.candidate_index - b.candidate_index
              );

              return (
                <article
                  key={battle.id}
                  className="overflow-hidden rounded-2xl border border-white/15 bg-white/[0.025]"
                >
                  <div className="flex items-center justify-between border-b border-white/10 px-5 py-4">
                    <h3 className="text-lg font-semibold">
                      Battle #{battle.id}
                    </h3>

                    <span className="text-xs text-gray-500">
                      {battle.created_at
                        ? new Date(
                            battle.created_at
                          ).toLocaleDateString("en-US", {
                            month: "short",
                            day: "numeric",
                            year: "numeric",
                          })
                        : "Unknown date"}
                    </span>
                  </div>

                  <div className="flex h-64 items-center justify-center bg-black/40">
                    {imageUrl ? (
                      // Public Supabase Storage image.
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={imageUrl}
                        alt={`Image for battle ${battle.id}`}
                        loading="lazy"
                        className="h-full w-full object-contain"
                      />
                    ) : (
                      <p className="text-sm text-gray-500">
                        No image available
                      </p>
                    )}
                  </div>

                  <div className="space-y-4 p-5">
                    {captions.length > 0 ? (
                      captions.map((caption, index) => (
                        <div
                          key={caption.id}
                          className="rounded-xl border border-white/10 bg-white/[0.03] p-4"
                        >
                          <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-gray-500">
                            Caption{" "}
                            {index === 0
                              ? "A"
                              : index === 1
                                ? "B"
                                : `#${index + 1}`}
                          </p>

                          <p className="whitespace-pre-wrap break-words text-sm leading-6 text-gray-200">
                            {caption.content}
                          </p>
                        </div>
                      ))
                    ) : (
                      <p className="text-sm text-amber-400">
                        No captions found for this battle.
                      </p>
                    )}

                    <div className="space-y-2 border-t border-white/10 pt-4">
                      <p className="text-xs text-gray-400">
                        Model:{" "}
                        <span className="break-all text-gray-200">
                          {battle.model || "Unknown"}
                        </span>
                      </p>

                      <p className="break-all text-xs text-gray-500">
                        Creator: {battle.creator_id}
                        </p>

                        <Link
                        href={`/media/${battle.id}/edit`}
                        className="mt-4 inline-block rounded-lg border border-white/20 px-4 py-2 text-sm font-medium transition-colors hover:bg-white/10"
                        >
                        Edit Captions →
                        </Link>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        )}

        <nav
          aria-label="Media pagination"
          className="mt-10 flex items-center justify-center gap-5"
        >
          {page > 1 ? (
            <Link
              href={`/media?page=${page - 1}`}
              className="rounded-xl border border-white/20 px-4 py-2 text-sm transition-colors hover:bg-white/10"
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
              href={`/media?page=${page + 1}`}
              className="rounded-xl border border-white/20 px-4 py-2 text-sm transition-colors hover:bg-white/10"
            >
              Next →
            </Link>
          ) : (
            <span className="rounded-xl border border-white/10 px-4 py-2 text-sm text-gray-600">
              Next →
            </span>
          )}
        </nav>
      </section>
    </main>
  );
}
