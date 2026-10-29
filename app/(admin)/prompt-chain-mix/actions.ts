
"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireSuperadmin } from "@/lib/auth/require-superadmin";
import { FormError, runAction } from "@/lib/action-state";

export async function updatePromptChainMix(formData: FormData) {
  return runAction(async () => {
    const { supabase } = await requireSuperadmin();

    const chainId = formData.get("chainId");
    const rawWeight = formData.get("weight");
    const enabled = formData.get("enabled") === "on";

    const uuidPattern =
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

    if (
      typeof chainId !== "string" ||
      !uuidPattern.test(chainId)
    ) {
      throw new FormError("Invalid prompt chain.");
    }

    if (
      typeof rawWeight !== "string" ||
      !/^(100|[0-9]{1,2})$/.test(rawWeight)
    ) {
      throw new FormError("Weight must be an integer from 0 to 100.", "weight");
    }

    const weight = Number(rawWeight);

    const { data: existing, error: existingError } =
      await supabase
        .from("prompt_chain_mix")
        .select("chain_id")
        .eq("chain_id", chainId)
        .maybeSingle();

    if (existingError) {
      console.error("Prompt chain mix lookup failed:", existingError);
      throw new Error("Unable to load prompt chain mix.");
    }
    if (!existing) {
      throw new FormError("Prompt chain mix entry not found.");
    }

    // Keep at least one active chain with a positive weight.
    if (!enabled || weight === 0) {
      const { count, error } = await supabase
        .from("prompt_chain_mix")
        .select("chain_id", { count: "exact", head: true })
        .eq("enabled", true)
        .gt("weight", 0)
        .neq("chain_id", chainId);

      if (error) {
        console.error("Active prompt chain lookup failed:", error);
        throw new Error("Unable to verify active prompt chains.");
      }

      if ((count ?? 0) === 0) {
        throw new FormError(
          "At least one prompt chain must remain enabled with a positive weight. No changes were saved.",
          enabled ? "weight" : "enabled"
        );
      }
    }

    const { data: updated, error: updateError } =
      await supabase
        .from("prompt_chain_mix")
        .update({
          weight,
          enabled,
          updated_at: new Date().toISOString(),
        })
        .eq("chain_id", chainId)
        .select("chain_id")
        .single();

    if (updateError || !updated) {
      console.error("Prompt chain mix update failed:", updateError);
      if (!updateError || updateError.code === "PGRST116") {
        throw new FormError("This mix entry no longer exists. Refresh the page before trying again.");
      }
      throw new Error("Unable to update prompt chain mix.");
    }

    revalidatePath("/prompt-chains");

    redirect(`/prompt-chains?updated=1&chain=${chainId}#mix-${chainId}`);
  });
}
