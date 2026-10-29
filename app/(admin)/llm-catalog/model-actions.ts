
"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireSuperadmin } from "@/lib/auth/require-superadmin";

const PAGE_PATH = "/llm-catalog";

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function getText(formData: FormData, key: string): string {
  const value = formData.get(key);

  if (value === null) return "";

  if (typeof value !== "string") {
    throw new Error(`Invalid ${key}.`);
  }

  return value.trim();
}

function getId(formData: FormData): string {
  const id = getText(formData, "id");

  if (!UUID_PATTERN.test(id)) {
    throw new Error("Invalid model ID.");
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
    throw new Error("Please select a valid LLM provider.");
  }

  if (modelId.length < 1 || modelId.length > 200) {
    throw new Error(
      "Model identifier must be 1–200 characters."
    );
  }

  if (displayName.length < 1 || displayName.length > 150) {
    throw new Error(
      "Display name must be 1–150 characters."
    );
  }

  if (description.length > 2000) {
    throw new Error(
      "Description must be at most 2000 characters."
    );
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
  const { supabase } = await requireSuperadmin();

  const input = getModelInput(formData);

  const { error } = await supabase
    .from("llm_models")
    .insert(input);

  if (error) {
    console.error("Create LLM model failed:", error);

    if (error.code === "23505") {
      throw new Error(
        "This model identifier already exists for the selected provider."
      );
    }

    if (error.code === "23503") {
      throw new Error(
        "The selected LLM prov does not exist."
      );
    }

    throw new Error("Could not create LLM model.");
  }

  revalidatePath(PAGE_PATH);
  redirect(`${PAGE_PATH}?modelCreated=1`);
}

// UPDATE MODEL

export async function updateModel(formData: FormData) {
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
      throw new Error(
        "This model identifier already exists for the selected provider."
      );
    }

    if (error?.code === "23503") {
      throw new Error(
        "The selected LLM provider does not exist."
      );
    }

    throw new Error("Could not update LLM model.");
  }

  revalidatePath(PAGE_PATH);
  redirect(`${PAGE_PATH}?modelUpdated=1`);
}

// DELETE MODEL

export async function deleteModel(formData: FormData) {
  const { supabase } = await requireSuperadmin();

  const id = getId(formData);
  const confirmation = getText(formData, "confirmation");

  const { data: existing, error: readError } = await supabase
    .from("llm_models")
    .select("id, display_name")
    .eq("id", id)
    .single();

  if (readError || !existing) {
    throw new Error("LLM model not found.");
  }

  if (confirmation !== `DELETE ${existing.display_name}`) {
    throw new Error(
      `To delete this model, enter exactly: DELETE ${existing.display_name}`
    );
  }

  const { data, error } = await supabase
    .from("llm_models")
    .delete()
    .eq("id", id)
    .select("id")
    .single();

  if (error || !data) {
    console.error("Delete LLM model failed:", error);
    throw new Error("Could not delete LLM model.");
  }

  revalidatePath(PAGE_PATH);
  redirect(`${PAGE_PATH}?modelDeleted=1`);
}
