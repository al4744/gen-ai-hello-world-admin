
import Link from "next/link";
import GenerationForm from "@/components/generation-form";
import { requireSuperadmin } from "@/lib/auth/require-superadmin";

export const instant = false;

export default async function NewMediaPage() {
  // Require a verified Google-authenticated superadmin.
  const { user } = await requireSuperadmin();

  return (
    <main className="mx-auto min-h-screen max-w-4xl px-6 py-12">
      <header className="mb-12 space-y-5">
        <Link
          href="/media"
          className="inline-block text-sm text-gray-400 transition-colors hover:text-white"
        >
          ← Back to Media
        </Link>

        <div>
          <p className="text-sm font-semibold tracking-[0.2em] text-gray-500">
            CAPTION ARENA ADMIN
          </p>

          <h1 className="mt-4 text-4xl font-bold tracking-tight md:text-5xl">
            Create Battle
          </h1>

          <p className="mt-4 text-gray-400">
            Upload an image to automatically generate two
            AI captions and create a new battle.
          </p>
        </div>
      </header>

      <GenerationForm userId={user.id} />
    </main>
  );
}
