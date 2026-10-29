import Link from "next/link";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { requireSuperadmin } from "@/lib/auth/require-superadmin";
import { getDeleteResource, isValidDeleteId } from "@/lib/delete-resources";
import DeleteConfirmationForm from "@/components/delete-confirmation-form";
import { confirmDelete } from "../../actions";

export const instant = false;

export default async function DeleteConfirmationPage({
  params,
}: {
  params: Promise<{ resource: string; id: string }>;
}) {
  await connection();
  const { supabase } = await requireSuperadmin();
  const { resource, id } = await params;
  const config = getDeleteResource(resource);

  if (!config || !isValidDeleteId(resource, id)) notFound();

  // GET only reads the selected record. Deletion requires the form's Server Action.
  const { data: record, error } = await supabase
    .from(config.table)
    .select(config.selection)
    .eq("id", id)
    .maybeSingle();

  if (error) console.error("Unable to load deletion confirmation:", error);

  const available = record && !error;
  const name = resource === "battle" ? `Battle #${id}` : String(record?.name ?? id);
  const cancelHref = available && resource === "battle" ? `/media/${id}/edit` : config.listPath;

  return (
    <main className="mx-auto flex min-h-[80vh] max-w-3xl items-center px-6 py-12">
      <section
        aria-labelledby="delete-heading"
        className="w-full rounded-2xl border border-white/15 bg-white/[0.025] p-6 sm:p-8"
      >
        <p className="text-xs font-semibold tracking-[0.2em] text-gray-500">
          CAPTION ARENA ADMIN
        </p>
        <h1 id="delete-heading" className="mt-4 text-3xl font-bold tracking-tight sm:text-4xl">
          Are you sure?
        </h1>
        <p className="mt-4 text-sm leading-6 text-gray-400">
          You are about to permanently delete this {config.label.toLowerCase()}.
          This action cannot be undone.
        </p>

        <div className="mt-6 rounded-xl border border-red-500/20 bg-red-500/5 p-5">
          <p className="text-xs font-semibold uppercase tracking-wider text-red-300">
            {config.label}
          </p>
          <p className="mt-3 break-words text-lg font-semibold text-white">
            {name}
          </p>
          <p className="mt-2 break-all font-mono text-xs text-gray-400">
            ID: {id}
          </p>
        </div>

        {"warning" in config && (
          <p className="mt-5 text-sm leading-6 text-gray-400">
            {config.warning}
          </p>
        )}

        {available ? (
          <DeleteConfirmationForm
            key={`${resource}-${id}`}
            action={confirmDelete.bind(null, resource, id)}
            cancelHref={cancelHref}
            recordLabel={`${config.label}: ${name}`}
          />
        ) : (
          <div className="mt-6 space-y-6">
            <p role={error ? "alert" : "status"} className="text-sm text-amber-300">
              {error
                ? "Unable to load this record. Return to the management page and try again."
                : "This record no longer exists or was already deleted. Nothing will be changed."}
            </p>
            <Link
              href={cancelHref}
              className="inline-block rounded-xl border border-white/20 px-6 py-3 text-sm font-semibold text-gray-200 transition-colors hover:bg-white/10 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-indigo-400 motion-reduce:transition-none"
            >
              Cancel
            </Link>
          </div>
        )}
      </section>
    </main>
  );
}
