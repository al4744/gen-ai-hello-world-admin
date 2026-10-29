import ActionForm from "@/components/action-form";
import SubmitButton from "@/components/submit-button";

import Link from "next/link";
import { connection } from "next/server";
import { requireSuperadmin } from "@/lib/auth/require-superadmin";
import {
  createGenerationExample,
  updateGenerationExample,
} from "./actions";

export const instant = false;

const PAGE_SIZE = 20;

const inputClass =
  "mt-2 w-full rounded-xl border border-white/20 bg-white/[0.04] px-4 py-3 text-white outline-none placeholder:text-gray-600 focus:border-indigo-400";

const labelClass = "block text-sm font-medium";

type ExampleValues = {
  title?: string | null;
  user_context?: string | null;
  caption_a?: string | null;
  caption_b?: string | null;
  notes?: string | null;
  source_generation_set_id?: number | string | null;
  is_active?: boolean | null;
};

type PageProps = {
  searchParams: Promise<{
    page?: string;
    created?: string;
    updated?: string;
    deleted?: string;
  }>;
};

function ExampleFields({
  prefix,
  values,
}: {
  prefix: string;
  values?: ExampleValues;
}) {
  return (
    <div className="space-y-6">
      <div className="grid gap-6 md:grid-cols-2">
        <div>
          <label htmlFor={`${prefix}-title`} className={labelClass}>
            Title
          </label>
          <input
            id={`${prefix}-title`}
            name="title"
            type="text"
            required
            maxLength={150}
            defaultValue={values?.title ?? ""}
            placeholder="e.g. Campus humor example"
            className={inputClass}
          />
        </div>

        <div>
          <label htmlFor={`${prefix}-source`} className={labelClass}>
            Source Battle ID (optional)
          </label>
          <input
            id={`${prefix}-source`}
            name="sourceGenerationSetId"
            type="text"
            inputMode="numeric"
            defaultValue={
              values?.source_generation_set_id == null
                ? ""
                : String(values.source_generation_set_id)
            }
            placeholder="Existing generation set ID"
            className={inputClass}
          />
        </div>
      </div>

      <div>
        <label htmlFor={`${prefix}-context`} className={labelClass}>
          User Context
        </label>
        <textarea
          id={`${prefix}-context`}
          name="userContext"
          rows={2}
          maxLength={500}
          defaultValue={values?.user_context ?? ""}
          placeholder="Describe the context for this example..."
          className={inputClass}
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <div>
          <label htmlFor={`${prefix}-caption-a`} className={labelClass}>
            Caption A
          </label>
          <textarea
            id={`${prefix}-caption-a`}
            name="captionA"
            rows={4}
            required
            maxLength={500}
            defaultValue={values?.caption_a ?? ""}
            placeholder="First example caption..."
            className={inputClass}
          />
        </div>

        <div>
          <label htmlFor={`${prefix}-caption-b`} className={labelClass}>
            Caption B
          </label>
          <textarea
            id={`${prefix}-caption-b`}
            name="captionB"
            rows={4}
            required
            maxLength={500}
            defaultValue={values?.caption_b ?? ""}
            placeholder="Second example caption..."
            className={inputClass}
          />
        </div>
      </div>

      <div>
        <label htmlFor={`${prefix}-notes`} className={labelClass}>
          Notes (optional)
        </label>
        <textarea
          id={`${prefix}-notes`}
          name="notes"
          rows={3}
          maxLength={2000}
          defaultValue={values?.notes ?? ""}
          placeholder="Administrative notes..."
          className={inputClass}
        />
      </div>

      <label className="flex cursor-pointer items-center gap-3">
        <input
          type="checkbox"
          name="isActive"
          defaultChecked={values?.is_active ?? true}
          className="h-5 w-5 accent-indigo-400"
        />
        <span className="text-sm font-medium">
          Active example
        </span>
      </label>
    </div>
  );
}

export default async function AIGenerationExamplesPage({
  searchParams,
}: PageProps) {
  await connection();

  const { supabase } = await requireSuperadmin();
  const params = await searchParams;

  const requestedPage = Number(params.page ?? "1");
  const page =
    Number.isSafeInteger(requestedPage) && requestedPage > 0
      ? Math.min(requestedPage, 10000)
      : 1;

  const offset = (page - 1) * PAGE_SIZE;

  const { data, count, error } = await supabase
    .from("ai_generation_examples")
    .select(
      "id, title, user_context, caption_a, caption_b, notes, source_generation_set_id, is_active, created_at, updated_at",
      { count: "exact" }
    )
    .order("created_at", { ascending: false })
    .order("id", { ascending: false })
    .range(offset, offset + PAGE_SIZE - 1);

  if (error) {
    console.error("Admin generation examples query failed:", error);
    throw new Error("Unable to load AI generation examples.");
  }

  const examples = data ?? [];
  const total = count ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <main className="mx-auto min-h-screen max-w-7xl px-6 py-12">
      <header>
        <p className="text-sm font-semibold tracking-[0.2em] text-gray-500">
          CAPTION ARENA ADMIN
        </p>

        <h1 className="mt-4 text-4xl font-bold tracking-tight md:text-5xl">
          AI Generation Examples
        </h1>

        <p className="mt-4 max-w-2xl text-gray-400">
          Manage curated examples of AI-generated captions.
          Create, inspect, edit, and remove examples from
          the database.
        </p>
      </header>

      {params.created === "1" && (
        <div
          role="status"
          className="mt-8 rounded-xl border border-emerald-500/30 bg-emerald-500/5 p-4 text-sm text-emerald-300"
        >
          Generation example created successfully.
        </div>
      )}

      {params.updated === "1" && (
        <div
          role="status"
          className="mt-8 rounded-xl border border-emerald-500/30 bg-emerald-500/5 p-4 text-sm text-emerald-300"
        >
          Generation example updated successfully.
        </div>
      )}

      {params.deleted === "1" && (
        <div
          role="status"
          className="mt-8 rounded-xl border border-emerald-500/30 bg-emerald-500/5 p-4 text-sm text-emerald-300"
        >
          Generation example deleted successfully.
        </div>
      )}

      {/* CREATE */}
      <section className="mt-12 rounded-2xl border border-white/15 bg-white/[0.025] p-6 md:p-8">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h2 className="text-xl font-semibold">
              Create an example
            </h2>
            <p className="mt-2 text-sm text-gray-400">
              Add a new curated caption example.
            </p>
          </div>

          <span className="rounded-full border border-indigo-500/30 bg-indigo-500/10 px-3 py-1 text-xs font-medium text-indigo-300">
            CREATE
          </span>
        </div>

        <ActionForm action={createGenerationExample} errorTitle="Unable to create example" className="mt-8 space-y-6">
          <ExampleFields prefix="new" />

          <SubmitButton
            type="submit"
            className="cursor-pointer rounded-xl bg-white px-6 py-3 text-sm font-semibold text-black transition-colors hover:bg-gray-200 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-indigo-400 motion-reduce:transition-none"
          >
            Create Example
          </SubmitButton>
        </ActionForm>
      </section>

      {/* READ, UPDATE, DELETE */}
      <section className="mt-12">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h2 className="text-2xl font-semibold">
              Example directory
            </h2>
            <p className="mt-2 text-sm text-gray-400">
              {total} example{total === 1 ? "" : "s"} in the database.
            </p>
          </div>

          <span className="rounded-full border border-white/15 px-3 py-1 text-xs text-gray-400">
            Page {page} of {totalPages}
          </span>
        </div>

        {examples.length === 0 ? (
          <div className="mt-6 rounded-2xl border border-dashed border-white/15 p-12 text-center text-gray-400">
            No examples found on this page.
          </div>
        ) : (
          <div className="mt-6 space-y-6">
            {examples.map((example) => (
              <article
                key={example.id}
                className="rounded-2xl border border-white/15 bg-white/[0.025] p-6 md:p-8"
              >
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div>
                    <h3 className="text-xl font-semibold">
                      {example.title}
                    </h3>

                    <p className="mt-2 font-mono text-xs text-gray-500">
                      {example.id}
                    </p>
                  </div>

                  <span
                    className={`rounded-full border px-3 py-1 text-xs font-medium ${
                      example.is_active
                        ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-300"
                        : "border-gray-500/30 bg-gray-500/10 text-gray-400"
                    }`}
                  >
                    {example.is_active ? "Active" : "Inactive"}
                  </span>
                </div>

                {example.user_context && (
                  <p className="mt-5 text-sm text-gray-400">
                    {example.user_context}
                  </p>
                )}

                <div className="mt-6 grid gap-4 md:grid-cols-2">
                  <div className="rounded-xl border border-white/10 bg-white/[0.025] p-4">
                    <p className="text-xs font-semibold uppercase tracking-widest text-indigo-300">
                      Caption A
                    </p>
                    <p className="mt-3 whitespace-pre-wrap break-words text-sm">
                      {example.caption_a}
                    </p>
                  </div>

                  <div className="rounded-xl border border-white/10 bg-white/[0.025] p-4">
                    <p className="text-xs font-semibold uppercase tracking-widest text-indigo-300">
                      Caption B
                    </p>
                    <p className="mt-3 whitespace-pre-wrap break-words text-sm">
                      {example.caption_b}
                    </p>
                  </div>
                </div>

                <div className="mt-5 flex flex-wrap gap-4 text-xs text-gray-500">
                  <span>
                    Created: {new Date(example.created_at).toLocaleDateString("en-US")}
                  </span>

                  {example.source_generation_set_id != null && (
                    <span>
                      Source battle: {example.source_generation_set_id}
                    </span>
                  )}
                </div>

                <details className="mt-6 border-t border-white/10 pt-5">
                  <summary className="cursor-pointer font-medium text-indigo-300">
                    Edit or delete this example
                  </summary>

                  <ActionForm
                    action={updateGenerationExample}
                    errorTitle="Unable to update example"
                    className="mt-8 space-y-6"
                  >
                    <input
                      type="hidden"
                      name="id"
                      value={example.id}
                    />

                    <ExampleFields
                      prefix={`edit-${example.id}`}
                      values={example}
                    />

                    <SubmitButton
                      type="submit"
                      className="cursor-pointer rounded-xl bg-indigo-500 px-6 py-3 font-semibold text-white transition-colors hover:bg-indigo-400"
                    >
                      Save Changes
                    </SubmitButton>
                  </ActionForm>

                  <div className="mt-10 border-t border-red-500/20 pt-6">
                    <h4 className="font-semibold text-red-300">
                      Delete example
                    </h4>

                    <p className="mt-2 text-sm text-gray-400">
                      This permanently removes the example.
                    </p>

                    <Link
                      href={`/delete/example/${example.id}`}
                      aria-label={`Delete example ${example.title}`}
                      className="mt-5 inline-block cursor-pointer rounded-xl border border-red-500/40 bg-red-500/10 px-6 py-3 font-semibold text-red-300 transition-colors hover:bg-red-500/20 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-red-400 motion-reduce:transition-none"
                    >
                      Permanently Delete
                    </Link>
                  </div>
                </details>
              </article>
            ))}
          </div>
        )}

        <div className="mt-8 flex items-center justify-between gap-4">
          {page > 1 ? (
            <Link
              href={`/ai-generation-examples?page=${page - 1}`}
              className="rounded-xl border border-white/20 px-5 py-3 text-sm hover:bg-white/10"
            >
              Previous
            </Link>
          ) : (
            <span />
          )}

          {page < totalPages ? (
            <Link
              href={`/ai-generation-examples?page=${page + 1}`}
              className="rounded-xl border border-white/20 px-5 py-3 text-sm hover:bg-white/10"
            >
              Next
            </Link>
          ) : (
            <span />
          )}
        </div>
      </section>
    </main>
  );
}
