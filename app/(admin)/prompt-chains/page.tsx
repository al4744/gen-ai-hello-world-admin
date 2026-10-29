
import { connection } from "next/server";
import { requireSuperadmin } from "@/lib/auth/require-superadmin";
import MixSettingsForm, { MixFeedback } from "./mix-settings-form";

export const instant = false;

type PromptChainsPageProps = {
  searchParams: Promise<{
    updated?: string;
    error?: string;
    chain?: string;
  }>;
};

export default async function PromptChainsPage({
  searchParams,
}: PromptChainsPageProps) {
  // Render using the current request.
  await connection();

  // Reuse the existing Week 6 superadmin authorization.
  const { supabase } = await requireSuperadmin();
  const params = await searchParams;

  // Load chains, steps, and mix without altering any records.
  const [chainsResult, stepsResult, mixResult] =
    await Promise.all([
      supabase
        .from("prompt_chains")
        .select("id, slug, name, description, created_at")
        .order("created_at", { ascending: true }),

      supabase
        .from("prompt_chain_steps")
        .select(
          "id, chain_id, step_order, name, prompt_template, created_at"
        )
        .order("step_order", { ascending: true }),

      supabase
        .from("prompt_chain_mix")
        .select("chain_id, weight, enabled, updated_at"),
    ]);

  if (
    chainsResult.error ||
    stepsResult.error ||
    mixResult.error
  ) {
    console.error("Prompt chains query failed:", {
      chains: chainsResult.error,
      steps: stepsResult.error,
      mix: mixResult.error,
    });

    throw new Error("Unable to load prompt configurations.");
  }

  const chains = chainsResult.data ?? [];
  const steps = stepsResult.data ?? [];
  const mixes = mixResult.data ?? [];

  const mixByChain = new Map(
    mixes.map((mix) => [mix.chain_id, mix])
  );

  const enabledChains = mixes.filter(
    (mix) => mix.enabled && mix.weight > 0
  ).length;

  // Keep mix records visible even if their chain definition is unavailable.
  const chainIds = new Set(chains.map((chain) => chain.id));
  const unmatchedMixes = mixes.filter((mix) => !chainIds.has(mix.chain_id));
  const feedback = params.error === "last-active"
    ? "last-active"
    : params.updated === "1"
      ? "updated"
      : undefined;
  const hasFeedbackTarget = mixes.some((mix) => mix.chain_id === params.chain);

  return (
    <main className="mx-auto min-h-screen max-w-7xl px-6 py-12">
      <header>
        <p className="text-sm font-semibold tracking-[0.2em] text-gray-500">
          CAPTION ARENA ADMIN
        </p>

        <h1 className="mt-4 text-4xl font-bold tracking-tight md:text-5xl">
          Prompt Chains
        </h1>

        <p className="mt-4 max-w-3xl text-gray-400">
          Explore the prompt configurations, ordered instruction
          steps, and selection weights stored in Supabase.
        </p>
      </header>

      {/* Configuration statistics */}
      <section className="mt-12 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <article className="rounded-2xl border border-white/15 bg-white/[0.03] p-6">
          <p className="text-sm text-gray-400">
            Prompt chains
          </p>
          <p className="mt-4 text-4xl font-bold tabular-nums">
            {chains.length}
          </p>
          <p className="mt-3 text-xs text-gray-500">
            Stored configurations
          </p>
        </article>

        <article className="rounded-2xl border border-white/15 bg-white/[0.03] p-6">
          <p className="text-sm text-gray-400">
            Prompt steps
          </p>
          <p className="mt-4 text-4xl font-bold tabular-nums">
            {steps.length}
          </p>
          <p className="mt-3 text-xs text-gray-500">
            Ordered instruction sections
          </p>
        </article>

        <article className="rounded-2xl border border-white/15 bg-white/[0.03] p-6">
          <p className="text-sm text-gray-400">
            Enabled configurations
          </p>
          <p className="mt-4 text-4xl font-bold tabular-nums">
            {enabledChains}
          </p>
          <p className="mt-3 text-xs text-gray-500">
            Active chains: enabled with a positive weight
          </p>
        </article>

        <article className="rounded-2xl border border-white/15 bg-white/[0.03] p-6">
          <p className="text-sm text-gray-400">
            Configured chains
          </p>
          <p className="mt-4 text-4xl font-bold tabular-nums">
            {mixes.length}
          </p>
          <p className="mt-3 text-xs text-gray-500">
            Stored mix entries
          </p>
        </article>
      </section>

      {/* Make the current runtime behavior explicit. */}
      <div
        role="note"
        className="mt-8 grid gap-5 rounded-xl border border-indigo-500/20 bg-indigo-500/[0.05] p-5 lg:grid-cols-[2fr_1fr]"
      >
        <div>
          <p className="text-sm font-semibold text-indigo-300">
            Configuration preview
          </p>

          <p className="mt-2 text-sm leading-6 text-gray-400">
            These prompt chains are stored in the database. Mix changes
            are configuration only and are saved to Supabase. Live caption
            generation still uses the original hardcoded prompt until
            database-driven selection is integrated and tested.
          </p>
        </div>

        <div className="border-t border-indigo-500/20 pt-5 lg:border-l lg:border-t-0 lg:pl-5 lg:pt-0">
          <p className="text-sm text-gray-400">Routing mode</p>
          <p className="mt-2 text-lg font-semibold">Relative weights</p>
          <p className="mt-2 text-xs text-gray-500">
            Weights do not need to total 100
          </p>
        </div>
      </div>

      {/* Prompt chain records */}
      <section id="mix-configuration" className="mt-12 scroll-mt-40 md:scroll-mt-6">
        <div className="mb-6">
          <h2 className="text-xl font-semibold">
            Chain configurations
          </h2>

          <p className="mt-2 text-sm text-gray-500">
            Read-only definitions and ordered steps, with editable mix settings
          </p>
        </div>

        {feedback && !hasFeedbackTarget && (
          <div className="mb-6">
            <MixFeedback feedback={feedback} />
          </div>
        )}

        {chains.length === 0 ? (
          <div className="rounded-2xl border border-white/15 p-10 text-center text-gray-400">
            No prompt chains have been configured.
          </div>
        ) : (
          <div className="space-y-6">
            {chains.map((chain) => {
              const chainSteps = steps.filter(
                (step) => step.chain_id === chain.id
              );

              const mix = mixByChain.get(chain.id);

              return (
                <article
                  key={chain.id}
                  className="overflow-hidden rounded-2xl border border-white/15 bg-white/[0.025]"
                >
                  <div className="p-6">
                    <div className="flex flex-wrap items-start justify-between gap-5">
                      <div className="min-w-0 flex-1">
                        <p className="font-mono text-xs text-indigo-300">
                          {chain.slug}
                        </p>

                        <h3 className="mt-3 text-xl font-semibold">
                          {chain.name}
                        </h3>

                        <p className="mt-3 max-w-2xl text-sm leading-6 text-gray-400">
                          {chain.description ||
                            "No description provided."}
                        </p>
                      </div>

                      <div className="flex flex-wrap gap-2">
                        <span className="rounded-full border border-white/15 px-3 py-1 text-xs text-gray-300">
                          {chainSteps.length} steps
                        </span>

                        <span
                          className={`rounded-full border px-3 py-1 text-xs ${
                            mix?.enabled
                              ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-300"
                              : "border-white/15 text-gray-400"
                          }`}
                        >
                          {mix
                            ? `${mix.enabled ? "Enabled" : "Disabled"} · ${mix.enabled && mix.weight > 0 ? "Active" : "Inactive"}`
                            : "Not configured"}
                        </span>
                      </div>
                    </div>

                    <div className="mt-7 grid gap-3 sm:grid-cols-2">
                      <div className="rounded-xl border border-white/10 bg-white/[0.025] p-4">
                        <p className="text-xs text-gray-500">
                          Mix weight
                        </p>
                        <p className="mt-2 text-2xl font-semibold tabular-nums">
                          {mix?.weight ?? "Not configured"}
                        </p>
                      </div>

                      <div className="rounded-xl border border-white/10 bg-white/[0.025] p-4">
                        <p className="text-xs text-gray-500">
                          Created
                        </p>
                        <p className="mt-2 text-sm font-medium text-gray-200">
                          {new Date(
                            chain.created_at
                          ).toLocaleDateString("en-US", {
                            month: "short",
                            day: "numeric",
                            year: "numeric",
                            timeZone: "UTC",
                          })}
                        </p>
                      </div>
                    </div>
                  </div>

                  {mix ? (
                    <MixSettingsForm
                      mix={mix}
                      chainName={chain.name}
                      feedback={params.chain === chain.id ? feedback : undefined}
                    />
                  ) : (
                    <p className="border-t border-white/10 p-6 text-sm text-gray-500">
                      No prompt chain mix entry is configured for this chain.
                    </p>
                  )}

                  {/* Individual chain steps */}
                  <div className="border-t border-white/10 p-6">
                    <div className="mb-5">
                      <h4 className="font-semibold">
                        Prompt chain steps
                      </h4>

                      <p className="mt-2 text-sm text-gray-500">
                        Ordered sections of the stored prompt
                        template
                      </p>
                    </div>

                    {chainSteps.length === 0 ? (
                      <p className="text-sm text-gray-500">
                        No steps defined.
                      </p>
                    ) : (
                      <div className="space-y-3">
                        {chainSteps.map((step) => (
                          <details
                            key={step.id}
                            className="group overflow-hidden rounded-xl border border-white/10 bg-black/20"
                          >
                            <summary className="flex cursor-pointer list-none items-center justify-between gap-4 p-4">
                              <div className="flex min-w-0 items-center gap-4">
                                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-white/15 font-mono text-sm text-gray-300">
                                  {String(
                                    step.step_order
                                  ).padStart(2, "0")}
                                </span>

                                <div>
                                  <p className="text-sm font-medium text-white">
                                    {step.name}
                                  </p>

                                  <p className="mt-1 text-xs text-gray-500">
                                    Step {step.step_order}
                                  </p>
                                </div>
                              </div>

                              <span className="shrink-0 text-xs text-indigo-300">
                                View template
                              </span>
                            </summary>

                            <div className="border-t border-white/10 p-4">
                              <p className="mb-3 text-xs uppercase tracking-wider text-gray-500">
                                Prompt template
                              </p>

                              <pre className="max-h-96 overflow-auto whitespace-pre-wrap break-words rounded-lg bg-black/40 p-4 font-mono text-xs leading-6 text-gray-300">
                                {step.prompt_template.trim()}
                              </pre>
                            </div>
                          </details>
                        ))}
                      </div>
                    )}
                  </div>
                </article>
              );
            })}
          </div>
        )}

        {mixes.length === 0 && (
          <p className="mt-6 text-sm text-gray-400">
            No prompt chain mix entries found.
          </p>
        )}

        {unmatchedMixes.length > 0 && (
          <div className="mt-6 space-y-6">
            <p className="text-sm text-amber-300">
              These mix entries have no available chain definition. Their
              existing settings can still be managed below.
            </p>
            {unmatchedMixes.map((mix) => (
              <article
                key={mix.chain_id}
                className="overflow-hidden rounded-2xl border border-white/15 bg-white/[0.025]"
              >
                <div className="flex flex-wrap items-start justify-between gap-4 p-6">
                  <div className="min-w-0">
                    <p className="break-all font-mono text-xs text-indigo-300">
                      {mix.chain_id}
                    </p>
                    <h3 className="mt-3 text-xl font-semibold">Unknown chain</h3>
                    <p className="mt-2 text-sm text-gray-400">No description.</p>
                  </div>
                  <span className={`rounded-full border px-3 py-1 text-xs ${
                    mix.enabled
                      ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-300"
                      : "border-white/15 text-gray-400"
                  }`}>
                    {mix.enabled ? "Enabled" : "Disabled"} · {mix.enabled && mix.weight > 0 ? "Active" : "Inactive"}
                  </span>
                </div>
                <MixSettingsForm
                  mix={mix}
                  chainName={`unknown chain ${mix.chain_id}`}
                  feedback={params.chain === mix.chain_id ? feedback : undefined}
                />
              </article>
            ))}
          </div>
        )}
      </section>
    </main>
  );
}
