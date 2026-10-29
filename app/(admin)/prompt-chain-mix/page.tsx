
import Link from "next/link";
import { connection } from "next/server";
import { requireSuperadmin } from "@/lib/auth/require-superadmin";
import { updatePromptChainMix } from "./actions";

export const instant = false;

type PageProps = {
  searchParams: Promise<{
    updated?: string;
    error?: string;
  }>;
};

export default async function PromptChainMixPage({
  searchParams,
}: PageProps) {
  await connection();

  const { supabase } = await requireSuperadmin();
  const params = await searchParams;

  const [chainsResult, mixResult] = await Promise.all([
    supabase
      .from("prompt_chains")
      .select("id, slug, name, description")
      .order("name"),

    supabase
      .from("prompt_chain_mix")
      .select("chain_id, weight, enabled, updated_at")
      .order("updated_at", { ascending: false }),
  ]);

  if (chainsResult.error || mixResult.error) {
    console.error("Prompt chain mix query failed:", {
      chains: chainsResult.error,
      mix: mixResult.error,
    });

    throw new Error("Unable to load prompt chain mix.");
  }

  const chainsById = new Map(
    (chainsResult.data ?? []).map((chain) => [
      chain.id,
      chain,
    ])
  );

  const mixes = mixResult.data ?? [];

  const activeCount = mixes.filter(
    (mix) => mix.enabled && mix.weight > 0
  ).length;

  return (
    <main className="mx-auto min-h-screen max-w-7xl px-6 py-12">
      <header>
        <p className="text-sm font-semibold tracking-[0.2em] text-gray-500">
          CAPTION ARENA ADMIN
        </p>

        <h1 className="mt-4 text-4xl font-bold tracking-tight md:text-5xl">
          Prompt Chain Mix
        </h1>

        <p className="mt-4 max-w-2xl text-gray-400">
          Manage which prompt configurations are enabled and
          their relative selection weights.
        </p>

        <Link
          href="/prompt-chains"
          className="mt-5 inline-block text-sm text-indigo-300 hover:underline"
        >
          Explore prompt chains →
        </Link>
      </header>

      {params.updated === "1" && (
        <div
          role="status"
          className="mt-8 rounded-xl border border-emerald-500/30 bg-emerald-500/5 p-4 text-sm text-emerald-300"
        >
          Prompt chain mix updated successfully.
        </div>
      )}

      {params.error === "last-active" && (
        <div
          role="alert"
          className="mt-8 rounded-xl border border-amber-500/30 bg-amber-500/5 p-4 text-sm text-amber-300"
        >
          At least one prompt chain must remain enabled with
          a positive weight. No changes were saved.
        </div>
      )}

      <section className="mt-10 grid gap-4 sm:grid-cols-3">
        <article className="rounded-2xl border border-white/15 bg-white/[0.03] p-6">
          <p className="text-sm text-gray-400">
            Configured chains
          </p>
          <p className="mt-4 text-4xl font-bold tabular-nums">
            {mixes.length}
          </p>
        </article>

        <article className="rounded-2xl border border-white/15 bg-white/[0.03] p-6">
          <p className="text-sm text-gray-400">
            Active chains
          </p>
          <p className="mt-4 text-4xl font-bold tabular-nums">
            {activeCount}
          </p>
        </article>

        <article className="rounded-2xl border border-white/15 bg-white/[0.03] p-6">
          <p className="text-sm text-gray-400">
            Routing mode
          </p>
          <p className="mt-4 text-lg font-semibold">
            Relative weights
          </p>
          <p className="mt-2 text-xs text-gray-500">
            Weights do not need to total 100
          </p>
        </article>
      </section>

      <div className="mt-8 rounded-xl border border-indigo-500/20 bg-indigo-500/[0.05] p-5">
        <p className="text-sm font-semibold text-indigo-300">
          Configuration only
        </p>
        <p className="mt-2 text-sm leading-6 text-gray-400">
          Changes are saved to Supabase, but live caption
          generation continues using the original prompt
          until database-driven selection is integrated.
        </p>
      </div>

      <section className="mt-10">
        <h2 className="text-xl font-semibold">
          Mix configuration
        </h2>

        <p className="mt-2 text-sm text-gray-500">
          Edit a chain&apos;s weight or enabled status, then
          save its configuration.
        </p>

        <div className="mt-6 space-y-4">
          {mixes.length === 0 ? (
            <div className="rounded-2xl border border-white/15 p-8 text-gray-400">
              No prompt chain mix entries found.
            </div>
          ) : (
            mixes.map((mix) => {
              const chain = chainsById.get(mix.chain_id);

              return (
                <article
                  key={mix.chain_id}
                  className="rounded-2xl border border-white/15 bg-white/[0.025] p-6"
                >
                  <div className="flex flex-wrap items-start justify-between gap-4">
                    <div>
                      <p className="font-mono text-xs text-indigo-300">
                        {chain?.slug ?? mix.chain_id}
                      </p>

                      <h3 className="mt-3 text-xl font-semibold">
                        {chain?.name ?? "Unknown chain"}
                      </h3>

                      <p className="mt-2 text-sm text-gray-400">
                        {chain?.description || "No description."}
                      </p>
                    </div>

                    <span
                      className={`rounded-full border px-3 py-1 text-xs ${
                        mix.enabled && mix.weight > 0
                          ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-300"
                          : "border-white/15 text-gray-400"
                      }`}
                    >
                      {mix.enabled && mix.weight > 0
                        ? "Active"
                        : "Inactive"}
                    </span>
                  </div>

                  <form
                    action={updatePromptChainMix}
                    className="mt-8 space-y-6 border-t border-white/10 pt-6"
                  >
                    <input
                      type="hidden"
                      name="chainId"
                      value={mix.chain_id}
                    />

                    <div className="grid gap-6 sm:grid-cols-2">
                      <div>
                        <label
                          htmlFor={`weight-${mix.chain_id}`}
                          className="block text-sm font-medium"
                        >
                          Selection weight
                        </label>

                        <p className="mt-1 text-xs text-gray-500">
                          Integer from 0 to 100
                        </p>

                        <input
                          id={`weight-${mix.chain_id}`}
                          type="number"
                          name="weight"
                          min={0}
                          max={100}
                          step={1}
                          required
                          defaultValue={mix.weight}
                          className="mt-3 w-full rounded-xl border border-white/20 bg-white/[0.04] px-4 py-3 text-white outline-none focus:border-indigo-400"
                        />
                      </div>

                      <div>
                        <p className="text-sm font-medium">
                          Enabled
                        </p>

                        <p className="mt-1 text-xs text-gray-500">
                          Allow this configuration to participate
                          in future selection.
                        </p>

                        <label className="mt-5 flex cursor-pointer items-center gap-3">
                          <input
                            type="checkbox"
                            name="enabled"
                            defaultChecked={mix.enabled}
                            className="h-5 w-5 accent-indigo-400"
                          />

                          <span className="text-sm text-gray-300">
                            Enable prompt chain
                          </span>
                        </label>
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center justify-between gap-4">
                      <p className="text-xs text-gray-500">
                        Last updated:{" "}
                        {new Date(mix.updated_at).toLocaleString(
                          "en-US",
                          {
                            dateStyle: "medium",
                            timeStyle: "short",
                            timeZone: "America/New_York",
                          }
                        )} ET
                      </p>

                      <button
                        type="submit"
                        className="cursor-pointer rounded-xl bg-white px-5 py-3 text-sm font-semibold text-black transition-colors hover:bg-gray-200"
                      >
                        Save mix settings
                      </button>
                    </div>
                  </form>
                </article>
              );
            })
          )}
        </div>
      </section>
    </main>
  );
}
