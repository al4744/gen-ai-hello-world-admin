
"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireSuperadmin } from "@/lib/auth/require-superadmin";
import { FormError, runAction } from "@/lib/action-state";

function parseId(value: FormDataEntryValue | null) {
  if (typeof value !== "string" || !/^[1-9]\d*$/.test(value)) {
    return null;
  }

  const id = Number(value);
  return Number.isSafeInteger(id) ? id : null;
}

export async function saveCaption(formData: FormData) {
  return runAction(async () => {
    // Every mutation independently verifies superadmin access.
    const { supabase } = await requireSuperadmin();

    const battleId = parseId(formData.get("battleId"));
    const captionId = parseId(formData.get("captionId"));
    const rawContent = formData.get("content");

    if (!battleId || !captionId) {
      throw new FormError("Invalid battle or caption ID. Refresh the page before trying again.");
    }

    const content =
      typeof rawContent === "string" ? rawContent.trim() : "";

    if (!content || content.length > 500) {
      throw new FormError("Caption must contain between 1 and 500 characters.", "content");
    }

    // Update exactly one caption belonging to the specified battle.
    const { data, error } = await supabase
      .from("generations")
      .update({ content })
      .eq("id", captionId)
      .eq("generation_set_id", battleId)
      .select("id")
      .single();

    if (error || !data) {
      console.error("Admin caption update failed:", error);
      if (!error || error.code === "PGRST116") {
        throw new FormError("This caption no longer exists. Refresh the page before trying again.");
      }
      throw new Error("Unable to update the caption.");
    }

    revalidatePath("/media");
    revalidatePath(`/media/${battleId}/edit`);

    redirect(`/media/${battleId}/edit?saved=${captionId}`);
  });
}


export async function deleteBattle(formData: FormData) {
    // Reverify administrator permission for every deletion.
    const { supabase } = await requireSuperadmin();

    const battleId = parseId(formData.get("battleId"));

    if (!battleId) {
      redirect("/media");
    }

    // Read the exact battle before deleting anything.
    const { data: battle, error: readError } = await supabase
      .from("generation_sets")
      .select("id, image_path")
      .eq("id", battleId)
      .maybeSingle();

    if (readError) {
      console.error("Admin battle lookup failed:", readError);
      throw new Error("Unable to load this battle for deletion.");
    }

    if (!battle) {
      throw new FormError("This battle no longer exists or was already deleted.");
    }

    // Avoid deleting an image used by another battle.
    let removeImage = false;

    if (battle.image_path) {
      const { count, error: countError } = await supabase
        .from("generation_sets")
        .select("*", { count: "exact", head: true })
        .eq("image_path", battle.image_path);

      if (countError || count === null) {
        console.error("Admin battle image reference check failed:", countError);
        throw new FormError("Unable to verify image references. No changes were saved.");
      }

      removeImage = count === 1;
    }

    // Foreign keys cascade to captions, votes and provenance.
    const { data: deleted, error: deleteError } = await supabase
      .from("generation_sets")
      .delete()
      .eq("id", battleId)
      .select("id")
      .single();

    if (deleteError || !deleted) {
      console.error("Admin battle deletion failed:", deleteError);
      throw new Error("Could not delete the battle. Please try again.");
    }

    // Storage is separate from the Postgres transaction.
    let cleanupFailed = false;

    if (removeImage && battle.image_path) {
      try {
        const { error: storageError } = await supabase.storage
          .from("generation-media")
          .remove([battle.image_path]);

        if (storageError) {
          console.error("Image cleanup failed:", storageError);
          cleanupFailed = true;
        }
      } catch (error) {
        console.error("Image cleanup failed:", error);
        cleanupFailed = true;
      }
    }

    revalidatePath("/media");
    revalidatePath("/dashboard");

    redirect(
      `/media?deleted=${battleId}${cleanupFailed ? "&cleanup=failed" : ""}`
    );
  }
