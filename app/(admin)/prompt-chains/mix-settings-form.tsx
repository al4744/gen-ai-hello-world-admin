import ActionForm from "@/components/action-form";
import SubmitButton from "@/components/submit-button";
import { updatePromptChainMix } from "../prompt-chain-mix/actions";

type Feedback = "updated" | "last-active";

type MixSettingsFormProps = {
  mix: {
    chain_id: string;
    weight: number;
    enabled: boolean;
    updated_at: string;
  };
  chainName: string;
  feedback?: Feedback;
};

export function MixFeedback({ feedback }: { feedback?: Feedback }) {
  if (!feedback) return null;

  return (
    <div
      role={feedback === "updated" ? "status" : "alert"}
      className={`rounded-xl border p-4 text-sm ${
        feedback === "updated"
          ? "border-emerald-500/30 bg-emerald-500/5 text-emerald-300"
          : "border-amber-500/30 bg-amber-500/5 text-amber-300"
      }`}
    >
      {feedback === "updated"
        ? "Prompt chain mix updated successfully."
        : "At least one prompt chain must remain enabled with a positive weight. No changes were saved."}
    </div>
  );
}

export default function MixSettingsForm({
  mix,
  chainName,
  feedback,
}: MixSettingsFormProps) {
  return (
    <ActionForm
      key={mix.updated_at}
      id={`mix-${mix.chain_id}`}
      aria-label={`Mix settings for ${chainName}`}
      action={updatePromptChainMix}
      errorTitle="Unable to save mix settings"
      className="scroll-mt-40 space-y-6 border-t border-indigo-500/20 bg-indigo-500/[0.035] p-6 md:scroll-mt-6"
    >
      <div>
        <h4 className="font-semibold text-indigo-300">Mix settings</h4>
        <p className="mt-2 text-sm text-gray-400">
          Edit this chain&apos;s selection weight or enabled status, then save
          its configuration.
        </p>
      </div>

      <MixFeedback feedback={feedback} />

      <input type="hidden" name="chainId" value={mix.chain_id} />

      <div className="grid gap-6 sm:grid-cols-2">
        <div>
          <label
            htmlFor={`weight-${mix.chain_id}`}
            className="block text-sm font-medium"
          >
            Selection weight
          </label>
          <p id={`weight-help-${mix.chain_id}`} className="mt-1 text-xs text-gray-500">
            Integer from 0 to 100
          </p>
          <input
            id={`weight-${mix.chain_id}`}
            aria-describedby={`weight-help-${mix.chain_id}`}
            type="number"
            name="weight"
            min={0}
            max={100}
            step={1}
            required
            defaultValue={mix.weight}
            className="mt-3 w-full rounded-xl border border-white/20 bg-white/[0.04] px-4 py-3 text-white outline-none focus:border-indigo-400 focus-visible:ring-2 focus-visible:ring-indigo-400/40"
          />
        </div>

        <div>
          <p className="text-sm font-medium">Enabled</p>
          <p id={`enabled-help-${mix.chain_id}`} className="mt-1 text-xs text-gray-500">
            Allow this configuration to participate in future selection.
            Live generation still uses the original prompt.
          </p>
          <label className="mt-5 flex cursor-pointer items-center gap-3">
            <input
              type="checkbox"
              name="enabled"
              aria-describedby={`enabled-help-${mix.chain_id}`}
              defaultChecked={mix.enabled}
              className="h-5 w-5 accent-indigo-400 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-indigo-400"
            />
            <span className="text-sm text-gray-300">Enable prompt chain</span>
          </label>
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-4">
        <p className="text-xs text-gray-500">
          Last updated:{" "}
          {new Date(mix.updated_at).toLocaleString("en-US", {
            dateStyle: "medium",
            timeStyle: "short",
            timeZone: "America/New_York",
          })} ET
        </p>
        <SubmitButton
          type="submit"
          className="cursor-pointer rounded-xl bg-white px-5 py-3 text-sm font-semibold text-black transition-colors hover:bg-gray-200 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-indigo-400 motion-reduce:transition-none"
        >
          Save mix settings
        </SubmitButton>
      </div>
    </ActionForm>
  );
}
