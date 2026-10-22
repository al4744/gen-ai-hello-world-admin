
"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireSuperadmin } from "@/lib/auth/require-superadmin";

function parseId(value: FormDataEntryValue | null) {
  if (typeof value !== "string" || !/^[1-9]\d*$/.test(value)) {
    return null;
  }

  const id = Number(value);
  return Number.isSafeInteger(id) ? id : null;
}

export async function saveCaption(formData: FormData) {
  // Every mutation independently verifies superadmin access.
  const { supabase } = await requireSuperadmin();

  const battleId = parseId(formData.get("battleId"));
  const captionId = parseId(formData.get("captionId"));
  const rawContent = formData.get("content");

  if (!battleId || !captionId) {
    redirect("/media");
  }

  const content =
    typeof rawContent === "string" ? rawContent.trim() : "";

  if (!content || content.length > 500) {
    redirect(`/media/${battleId}/edit?error=invalid`);
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
    redirect(`/media/${battleId}/edit?error=save`);
  }

  revalidatePath("/media");
  revalidatePath(`/media/${battleId}/edit`);

  redirect(`/media/${battleId}/edit?saved=${captionId}`);
}


export async function deleteBattle(formData: FormData) {
    // Reverify administrator permission for every deletion.
    const { supabase } = await requireSuperadmin();

    const battleId = parseId(formData.get("battleId"));
    const confirmation = formData.get("confirmation");

    if (!battleId) {
      redirect("/media");
    }

    if (confirmation !== `DELETE ${battleId}`) {
      redirect(`/media/${battleId}/edit?error=confirmation`);
    }

    // Read the exact battle before deleting anything.
    const { data: battle, error: readError } = await supabase
      .from("generation_sets")
      .select("id, image_path")
      .eq("id", battleId)
      .maybeSingle();

    if (readError || !battle) {
      redirect(`/media/${battleId}/edit?error=delete`);
    }

    // Avoid deleting an image used by another battle.
    let removeImage = false;

    if (battle.image_path) {
      const { count, error: countError } = await supabase
        .from("generation_sets")
        .select("*", { count: "exact", head: true })
        .eq("image_path", battle.image_path);

      if (countError || count === null) {
        redirect(`/media/${battleId}/edit?error=delete`);
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
      redirect(`/media/${battleId}/edit?error=delete`);
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
