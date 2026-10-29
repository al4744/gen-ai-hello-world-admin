
"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireSuperadmin } from "@/lib/auth/require-superadmin";

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const EXAMPLES_PATH = "/ai-generation-examples";

function readText(formData: FormData, field: string): string {
  const value = formData.get(field);
  return typeof value === "string" ? value.trim() : "";
}

function validateExample(formData: FormData) {
  const title = readText(formData, "title");
  const userContext = readText(formData, "userContext");
  const captionA = readText(formData, "captionA");
  const captionB = readText(formData, "captionB");
  const notes = readText(formData, "notes");

  const rawSourceId = readText(
    formData,
    "sourceGenerationSetId"
  );

  const isActive = formData.get("isActive") === "on";

  if (title.length < 1 || title.length > 150) {
    throw new Error(
      "Title must be between 1 and 150 characters."
    );
  }

  if (userContext.length > 500) {
    throw new Error(
      "User context must be 500 characters or fewer."
    );
  }

  if (captionA.length < 1 || captionA.length > 500) {
    throw new Error(
      "Caption A must be between 1 and 500 characters."
    );
  }

  if (captionB.length < 1 || captionB.length > 500) {
    throw new Error(
      "Caption B must be between 1 and 500 characters."
    );
  }

  if (captionA === captionB) {
    throw new Error(
      "Caption A and Caption B must be different."
    );
  }

  if (notes.length > 2000) {
    throw new Error(
      "Notes must be 2000 characters or fewer."
    );
  }

  let sourceGenerationSetId: number | null = null;

  if (rawSourceId) {
    if (!/^[1-9]\d*$/.test(rawSourceId)) {
      throw new Error("Invalid source battle ID.");
    }

    const numericId = Number(rawSourceId);

    if (!Number.isSafeInteger(numericId)) {
      throw new Error("Invalid source battle ID.");
    }

    sourceGenerationSetId = numericId;
  }

  return {
    title,
    user_context: userContext,
    caption_a: captionA,
    caption_b: captionB,
    source_generation_set_id: sourceGenerationSetId,
    notes,
    is_active: isActive,
  };
}

// =====================================================
// CREATE
// =====================================================

export async function createGenerationExample(
  formData: FormData
) {
  const { supabase } = await requireSuperadmin();

  const values = validateExample(formData);

  const { error } = await supabase
    .from("ai_generation_examples")
    .insert(values);

  if (error) {
    console.error(
      "Create AI generation example failed:",
      error
    );

    throw new Error(
      error.code === "23503"
        ? "The selected source battle does not exist."
        : "Unable to create AI generation example."
    );
  }

  revalidatePath(EXAMPLES_PATH);

  redirect(`${EXAMPLES_PATH}?created=1`);
}

// =====================================================
// UPDATE
// =====================================================

export async function updateGenerationExample(
  formData: FormData
) {
  const { supabase } = await requireSuperadmin();

  const id = readText(formData, "id");

  if (!UUID_PATTERN.test(id)) {
    throw new Error("Invalid example ID.");
  }

  const values = validateExample(formData);

  const { data, error } = await supabase
    .from("ai_generation_examples")
    .update({
      ...values,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id)
    .select("id")
    .single();

  if (error || !data) {
    console.error(
      "Update AI generation example failed:",
      error
    );

    throw new Error(
      error?.code === "23503"
        ? "The selected source battle does not exist."
        : "Unable to update AI generation example."
    );
  }

  revalidatePath(EXAMPLES_PATH);

  redirect(`${EXAMPLES_PATH}?updated=1`);
}

// =====================================================
// DELETE
// =====================================================

export async function deleteGenerationExample(
  formData: FormData
) {
  const { supabase } = await requireSuperadmin();

  const id = readText(formData, "id");
  const confirmation = readText(
    formData,
    "confirmation"
  );

  if (!UUID_PATTERN.test(id)) {
    throw new Error("Invalid example ID.");
  }

  // Read the current title directly from Supabase.
  // Never trust a hidden form field for deletion confirmation.
  const { data: existing, error: lookupError } =
    await supabase
      .from("ai_generation_examples")
      .select("id, title")
      .eq("id", id)
      .single();

  if (lookupError || !existing) {
    throw new Error("AI generation example not found.");
  }

  const expectedConfirmation =
    `DELETE ${existing.title}`;

  if (confirmation !== expectedConfirmation) {
    throw new Error(
      `Deletion requires typing: ${expectedConfirmation}`
    );
  }

  const { data, error } = await supabase
    .from("ai_generation_examples")
    .delete()
    .eq("id", id)
    .select("id")
    .single();

  if (error || !data) {
    console.error(
      "Delete AI generation example failed:",
      error
    );

    throw new Error(
      "Unable to delete AI generation example."
    );
  }

  revalidatePath(EXAMPLES_PATH);

  redirect(`${EXAMPLES_PATH}?deleted=1`);
}
