
"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireSuperadmin } from "@/lib/auth/require-superadmin";

const PAGE_PATH = "/llm-catalog";

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const SLUG_PATTERN = /^[a-z0-9][a-z0-9_-]{0,79}$/;

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
    throw new Error("Invalid provider ID.");
  }

  return id;
}

function getProviderInput(formData: FormData) {
  const slug = getText(formData, "slug");
  const name = getText(formData, "name");
  const apiBaseUrl = getText(formData, "apiBaseUrl");
  const description = getText(formData, "description");
  const isActive = formData.get("isActive") === "on";

  if (!SLUG_PATTERN.test(slug)) {
    throw new Error(
      "Provider slug must contain 1–80 lowercase letters, numbers, hyphens, or underscores, and start with a letter or number."
    );
  }

  if (name.length < 1 || name.length > 120) {
    throw new Error("Provider name must be 1–120 characters.");
  }

  if (description.length > 2000) {
    throw new Error(
      "Description must be at most 2000 characters."
    );
  }

  if (apiBaseUrl.length > 500) {
    throw new Error("API base URL is too long.");
  }

  if (apiBaseUrl) {
    let parsed: URL;

    try {
      parsed = new URL(apiBaseUrl);
    } catch {
      throw new Error("Invalid API base URL.");
    }

    if (
      parsed.protocol !== "https:" ||
      !parsed.hostname ||
      parsed.username ||
      parsed.password ||
      parsed.search ||
      parsed.hash
    ) {
      throw new Error(
        "API base URL must be an HTTPS URL without credentials, query parameters, or fragments."
      );
    }
  }

  return {
    slug,
    name,
    api_base_url: apiBaseUrl || null,
    description,
    is_active: isActive,
  };
}

// CREATE PROVIDER

export async function createProvider(formData: FormData) {
  const { supabase } = await requireSuperadmin();

  const input = getProviderInput(formData);

  const { error } = await supabase
    .from("llm_providers")
    .insert(input);

  if (error) {
    console.error("Create LLM provider failed:", error);

    if (error.code === "23505") {
      throw new Error(
        "A provider with this slug already exists."
      );
    }

    throw new Error("Could not create LLM provider.");
  }

  revalidatePath(PAGE_PATH);
  redirect(`${PAGE_PATH}?providerCreated=1`);
}

// UPDATE PROVIDER

export async function updateProvider(formData: FormData) {
  const { supabase } = await requireSuperadmin();

  const id = getId(formData);
  const input = getProviderInput(formData);

  const { data, error } = await supabase
    .from("llm_providers")
    .update({
      ...input,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id)
    .select("id")
    .single();

  if (error || !data) {
    console.error("Update LLM provider failed:", error);

    if (error?.code === "23505") {
      throw new Error(
        "A provider with this slug already exists."
      );
    }

    throw new Error("Could not update LLM provider.");
  }

  revalidatePath(PAGE_PATH);
  redirect(`${PAGE_PATH}?providerUpdated=1`);
}

// DELETE PROVIDER

export async function deleteProvider(formData: FormData) {
  const { supabase } = await requireSuperadmin();

  const id = getId(formData);
  const confirmation = getText(formData, "confirmation");

  const { data: existing, error: readError } = await supabase
    .from("llm_providers")
    .select("id, name")
    .eq("id", id)
    .single();

  if (readError || !existing) {
    throw new Error("LLM provider not found.");
  }

  if (confirmation !== `DELETE ${existing.name}`) {
    throw new Error(
      `To delete this provider, enter exactly: DELETE ${existing.name}`
    );
  }

  const { data, error } = await supabase
    .from("llm_providers")
    .delete()
    .eq("id", id)
    .select("id")
    .single();

  if (error || !data) {
    console.error("Delete LLM provider failed:", error);

    if (error?.code === "23503") {
      throw new Error(
        "Cannot delete this provider while models reference it. Delete or reassign those models first."
      );
    }

    throw new Error("Could not delete LLM provider.");
  }

  revalidatePath(PAGE_PATH);
  redirect(`${PAGE_PATH}?providerDeleted=1`);
}
