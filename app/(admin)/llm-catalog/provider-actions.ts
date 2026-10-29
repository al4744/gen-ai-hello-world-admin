
"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireSuperadmin } from "@/lib/auth/require-superadmin";
import { FormError, runAction } from "@/lib/action-state";

const PAGE_PATH = "/llm-catalog";

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const SLUG_PATTERN = /^[a-z0-9][a-z0-9_-]{0,79}$/;

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
    throw new FormError("Invalid provider ID.");
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
    throw new FormError("Provider slug must contain 1–80 lowercase letters, numbers, hyphens, or underscores, and start with a letter or number.", "slug");
  }

  if (name.length < 1 || name.length > 120) {
    throw new FormError("Provider name must be 1–120 characters.", "name");
  }

  if (description.length > 2000) {
    throw new FormError("Description must be at most 2000 characters.", "description");
  }

  if (apiBaseUrl.length > 500) {
    throw new FormError("API base URL is too long.", "apiBaseUrl");
  }

  if (apiBaseUrl) {
    let parsed: URL;

    try {
      parsed = new URL(apiBaseUrl);
    } catch {
      throw new FormError("Invalid API base URL.", "apiBaseUrl");
    }

    if (
      parsed.protocol !== "https:" ||
      !parsed.hostname ||
      parsed.username ||
      parsed.password ||
      parsed.search ||
      parsed.hash
    ) {
      throw new FormError("API base URL must be an HTTPS URL without credentials, query parameters, or fragments.", "apiBaseUrl");
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
  return runAction(async () => {
    const { supabase } = await requireSuperadmin();

    const input = getProviderInput(formData);

    const { error } = await supabase
      .from("llm_providers")
      .insert(input);

    if (error) {
      console.error("Create LLM provider failed:", error);

      if (error.code === "23505") {
        throw new FormError(
          "A provider with this slug already exists. Please choose a different slug.",
          "slug"
        );
      }

      throw new Error("Could not create LLM provider.");
    }

    revalidatePath(PAGE_PATH);
    redirect(`${PAGE_PATH}?providerCreated=1`);
  });
}

// UPDATE PROVIDER

export async function updateProvider(formData: FormData) {
  return runAction(async () => {
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
        throw new FormError(
          "A provider with this slug already exists. Please choose a different slug.",
          "slug"
        );
      }

      if (!error || error.code === "PGRST116") {
        throw new FormError("This provider no longer exists. Refresh the page before trying again.");
      }
      throw new Error("Could not update LLM provider.");
    }

    revalidatePath(PAGE_PATH);
    redirect(`${PAGE_PATH}?providerUpdated=1`);
  });
}

// DELETE PROVIDER

export async function deleteProvider(formData: FormData) {
  const { supabase } = await requireSuperadmin();

  const id = getId(formData);

  const { data: existing, error: readError } = await supabase
    .from("llm_providers")
    .select("id, name")
    .eq("id", id)
    .single();

  if (readError && readError.code !== "PGRST116") {
    console.error("Deletion lookup failed:", readError);
    throw new Error("Unable to read the record for deletion.");
  }

  if (readError || !existing) {
    throw new FormError("LLM provider not found.");
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
      throw new FormError(
        "Cannot delete this provider while models reference it. Delete or reassign those models first."
      );
    }

    throw new Error("Could not delete LLM provider.");
  }

  revalidatePath(PAGE_PATH);
  redirect(`${PAGE_PATH}?providerDeleted=1`);
}
