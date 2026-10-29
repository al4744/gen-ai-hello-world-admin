"use client";

import Link from "next/link";
import { useActionState } from "react";
import type { DeleteState } from "@/lib/delete-resources";

type Props = {
  action: (state: DeleteState, formData: FormData) => Promise<DeleteState>;
  cancelHref: string;
  recordLabel: string;
};

export default function DeleteConfirmationForm({
  action,
  cancelHref,
  recordLabel,
}: Props) {
  const [state, formAction, pending] = useActionState(action, { error: null });

  return (
    <form action={formAction} aria-busy={pending} className="mt-8 space-y-6">
      {state.error && (
        <p
          role="alert"
          className="rounded-xl border border-red-500/30 bg-red-500/5 p-4 text-sm text-red-300"
        >
          {state.error}
        </p>
      )}
      <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
        <Link
          href={cancelHref}
          className="rounded-xl border border-white/20 px-6 py-3 text-center text-sm font-semibold text-gray-200 transition-colors hover:bg-white/10 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-indigo-400 motion-reduce:transition-none"
        >
          Cancel
        </Link>
        <button
          type="submit"
          disabled={pending}
          aria-label={`Delete ${recordLabel}`}
          className="cursor-pointer rounded-xl bg-red-600 px-6 py-3 text-sm font-semibold text-white transition-colors enabled:hover:bg-red-500 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-red-400 disabled:cursor-wait disabled:opacity-50 motion-reduce:transition-none"
        >
          {pending ? "Deleting…" : "Delete"}
        </button>
      </div>
      <p role="status" className="sr-only">
        {pending ? "Deletion is processing." : ""}
      </p>
    </form>
  );
}
