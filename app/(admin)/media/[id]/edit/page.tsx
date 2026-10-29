import ActionForm from "@/components/action-form";
import SubmitButton from "@/components/submit-button";

import Link from "next/link";
import { notFound } from "next/navigation";
import { requireSuperadmin } from "@/lib/auth/require-superadmin";
import { saveCaption } from "./actions";
import ReplaceImageForm from "./replace-image-form";

export const instant = false;

type EditPageProps = {
  params: Promise<{ id: string }>;
  searchParams: Promise<{
    saved?: string;
    error?: string;
  }>;
};

export default async function EditMediaPage({
  params,
  searchParams,
}: EditPageProps) {
  // Verify superadmin access before reading the battle.
  const { user, supabase } = await requireSuperadmin();

  const { id } = await params;
  const query = await searchParams;

  if (!/^[1-9]\d*$/.test(id)) {
    notFound();
  }

  const battleId = Number(id);

  if (!Number.isSafeInteger(battleId)) {
    notFound();
  }

  const { data: battle, error } = await supabase
    .from("generation_sets")
    .select(`
      id,
      image_path,
      generations (
        id,
        candidate_index,
        content
      )
    `)
    .eq("id", battleId)
    .maybeSingle();

  if (error) {
    console.error("Unable to load battle:", error);
    throw new Error("Unable to load this battle.");
  }

  if (!battle) {
    notFound();
  }

  // Preserve the original caption order.
  const captions = [...(battle.generations ?? [])].sort(
    (a, b) => a.candidate_index - b.candidate_index
  );

  const imageUrl = battle.image_path
    ? supabase.storage
        .from("generation-media")
        .getPublicUrl(battle.image_path).data.publicUrl
    : null;

  return (
    <main className="mx-auto min-h-screen max-w-4xl px-6 py-12">
      <Link
        href="/media"
        className="text-sm text-gray-400 transition-colors hover:text-white"
      >
        ← Back to Media
      </Link>

      <header className="mt-10">
        <p className="text-sm font-semibold tracking-[0.2em] text-gray-500">
          CAPTION ARENA ADMIN
        </p>

        <h1 className="mt-4 text-4xl font-bold">
          Edit Battle #{battle.id}
        </h1>

        <p className="mt-4 text-gray-400">
          Edit captions or replace the uploaded image.
          Existing votes and generation metadata are preserved.
        </p>
      </header>

      {imageUrl && (
        // Public Supabase Storage image.
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={imageUrl}
          alt={`Battle ${battle.id}`}
          className="mt-10 max-h-96 w-full rounded-2xl border border-white/15 object-contain"
        />
      )}

      <ReplaceImageForm
        battleId={battle.id}
        userId={user.id}
        currentImagePath={battle.image_path}
      />

      {/* Display caption editing and deletion errors. */}
      {query.error && (
        <p
          role="alert"
          className="mt-6 rounded-xl border border-red-500/30 p-4 text-red-300"
        >
          {query.error === "invalid"
            ? "Caption must contain between 1 and 500 characters."
            : query.error === "delete"
              ? "Could not delete the battle. Please try again."
              : "Unable to save caption. Please try again."}
        </p>
      )}

      {/* Caption editing */}
      <section className="mt-8 space-y-6">
        {captions.map((caption, index) => (
          <ActionForm
            key={caption.id}
            action={saveCaption}
            errorTitle="Unable to save caption"
            className="rounded-2xl border border-white/15 p-6"
          >
            <input
              type="hidden"
              name="battleId"
              value={battle.id}
            />

            <input
              type="hidden"
              name="captionId"
              value={caption.id}
            />

            <label
              htmlFor={`caption-${caption.id}`}
              className="text-lg font-semibold"
            >
              Caption{" "}
              {index === 0
                ? "A"
                : index === 1
                  ? "B"
                  : `#${index + 1}`}
            </label>

            <textarea
              id={`caption-${caption.id}`}
              name="content"
              defaultValue={caption.content}
              required
              minLength={1}
              maxLength={500}
              rows={4}
              className="mt-4 w-full resize-y rounded-xl border border-white/20 bg-white/[0.04] p-4 text-white outline-none focus:border-white/60"
            />

            <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
              <p className="text-xs text-gray-500">
                Maximum 500 characters
              </p>

              <SubmitButton
                type="submit"
                className="rounded-xl bg-white px-5 py-2.5 text-sm font-semibold text-black transition-colors hover:bg-gray-200"
              >
                Save Caption
              </SubmitButton>
            </div>

            {query.saved === String(caption.id) && (
              <p
                role="status"
                className="mt-3 text-sm text-emerald-400"
              >
                Caption saved successfully.
              </p>
            )}
          </ActionForm>
        ))}
      </section>

      {/* Permanent battle deletion */}
      <section className="mt-12 rounded-2xl border border-red-500/30 p-6">
        <h2 className="text-xl font-semibold text-red-300">
          Danger zone
        </h2>

        <p className="mt-3 text-sm leading-6 text-gray-400">
          Permanently delete this battle, its generated captions,
          associated votes, and generation provenance records.
          Its stored image will also be removed if no other
          battle uses that image.
        </p>

        <p className="mt-3 text-sm font-medium text-red-300">
          This action cannot be undone.
        </p>

        <Link
          href={`/delete/battle/${battle.id}`}
          aria-label={`Permanently delete battle #${battle.id}`}
          className="mt-6 inline-block rounded-xl border border-red-500/40 bg-red-500/10 px-5 py-3 text-sm font-semibold text-red-300 transition-colors hover:bg-red-500/20 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-red-400 motion-reduce:transition-none"
        >
          Permanently Delete Battle
        </Link>
      </section>
    </main>
  );
}
