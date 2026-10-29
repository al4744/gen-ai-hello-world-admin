
"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireSuperadmin } from "@/lib/auth/require-superadmin";
import { FormError, runAction } from "@/lib/action-state";

const PAGE_PATH = "/llm-catalog";

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function getText(formData: FormData, key: string): string {
  const value = formData.get(key);

  if (value === null) return "";

  if (typeof value !== "string") {
    throw new FormError(`Invalid ${key}.`, key);
  }

  return value.trim();
}

function getId(formData: FormData): string {
  const id = getText(formData, "id");

  if (!UUID_PATTERN.test(id)) {
    throw new FormError("Invalid model ID.");
  }

  return id;
}

function getModelInput(formData: FormData) {
  const providerId = getText(formData, "providerId");
  const modelId = getText(formData, "modelId");
  const displayName = getText(formData, "displayName");
  const description = getText(formData, "description");
  const isActive = formData.get("isActive") === "on";

  if (!UUID_PATTERN.test(providerId)) {
    throw new FormError("Please select a valid LLM provider.", "providerId");
  }

  if (modelId.length < 1 || modelId.length > 200) {
    throw new FormError("Model identifier must be 1–200 characters.", "modelId");
  }

  if (displayName.length < 1 || displayName.length > 150) {
    throw new FormError("Display name must be 1–150 characters.", "displayName");
  }

  if (description.length > 2000) {
    throw new FormError("Description must be at most 2000 characters.", "description");
  }

  return {
    provider_id: providerId,
    model_id: modelId,
    display_name: displayName,
    description,
    is_active: isActive,
  };
}

// CREATE MODEL

export async function createModel(formData: FormData) {
  return runAction(async () => {
    const { supabase } = await requireSuperadmin();

    const input = getModelInput(formData);

    const { error } = await supabase
      .from("llm_models")
      .insert(input);

    if (error) {
      console.error("Create LLM model failed:", error);

      if (error.code === "23505") {
        throw new FormError(
          "This model identifier already exists for the selected provider.", "modelId"
        );
      }

      if (error.code === "23503") {
        throw new FormError(
          "The selected LLM provider does not exist.", "providerId"
        );
      }

      throw new Error("Could not create LLM model.");
    }

    revalidatePath(PAGE_PATH);
    redirect(`${PAGE_PATH}?modelCreated=1`);
  });
}

// UPDATE MODEL

export async function updateModel(formData: FormData) {
  return runAction(async () => {
    const { supabase } = await requireSuperadmin();

    const id = getId(formData);
    const input = getModelInput(formData);

    const { data, error } = await supabase
      .from("llm_models")
      .update({
        ...input,
        updated_at: new Date().toISOString(),
      })
      .eq("id", id)
      .select("id")
      .single();

    if (error || !data) {
      console.error("Update LLM model failed:", error);

      if (error?.code === "23505") {
        throw new FormError(
          "This model identifier already exists for the selected provider.", "modelId"
        );
      }

      if (error?.code === "23503") {
        throw new FormError(
          "The selected LLM provider does not exist.", "providerId"
        );
      }

      if (!error || error.code === "PGRST116") {
        throw new FormError("This model no longer exists. Refresh the page before trying again.");
      }
      throw new Error("Could not update LLM model.");
    }

    revalidatePath(PAGE_PATH);
    redirect(`${PAGE_PATH}?modelUpdated=1`);
  });
}

// DELETE MODEL

export async function deleteModel(formData: FormData) {
  const { supabase } = await requireSuperadmin();

  const id = getId(formData);

  const { data: existing, error: readError } = await supabase
    .from("llm_models")
    .select("id, display_name")
    .eq("id", id)
    .single();

  if (readError && readError.code !== "PGRST116") {
    console.error("Deletion lookup failed:", readError);
    throw new Error("Unable to read the record for deletion.");
  }

  if (readError || !existing) {
    throw new FormError("LLM model not found.");
  }

  const { data, error } = await supabase
    .from("llm_models")
    .delete()
    .eq("id", id)
    .select("id")
    .single();

  if (error || !data) {
    if (error?.code === "23503") {
      throw new FormError("This record is still referenced by other records and cannot be deleted.");
    }
    console.error("Delete LLM model failed:", error);
    throw new Error("Could not delete LLM model.");
  }

  revalidatePath(PAGE_PATH);
  redirect(`${PAGE_PATH}?modelDeleted=1`);
}
