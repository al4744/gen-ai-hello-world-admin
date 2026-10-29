
"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireSuperadmin } from "@/lib/auth/require-superadmin";
import { FormError, runAction } from "@/lib/action-state";

const PAGE_PATH = "/signup-access";

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const EMAIL_PATTERN =
  /^[^\s@]+@[a-z0-9](?:[a-z0-9-]*[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]*[a-z0-9])?)+$/;

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
    throw new FormError("Invalid whitelisted email ID.");
  }

  return id;
}

function getEmailInput(formData: FormData) {
  const email = getText(formData, "email").toLowerCase();
  const description = getText(formData, "description");
  const isActive = formData.get("isActive") === "on";

  if (
    email.length < 3 ||
    email.length > 254 ||
    !EMAIL_PATTERN.test(email)
  ) {
    throw new FormError("Enter a valid email address, such as student@columbia.edu.", "email");
  }

  if (description.length > 2000) {
    throw new FormError("Description must be at most 2000 characters.", "description");
  }

  return {
    email,
    description,
    is_active: isActive,
  };
}

// CREATE WHITELISTED EMAIL

export async function createWhitelistedEmail(
  formData: FormData
) {
  return runAction(async () => {
    const { supabase } = await requireSuperadmin();

    const input = getEmailInput(formData);

    const { error } = await supabase
      .from("whitelisted_emails")
      .insert(input);

    if (error) {
      console.error("Create whitelisted email failed:", error);

      if (error.code === "23505") {
        throw new FormError(
          "This email address is already whitelisted.", "email"
        );
      }

      throw new Error("Could not create whitelisted email.");
    }

    revalidatePath(PAGE_PATH);
    redirect(`${PAGE_PATH}?emailCreated=1`);
  });
}

// UPDATE WHITELISTED EMAIL

export async function updateWhitelistedEmail(
  formData: FormData
) {
  return runAction(async () => {
    const { supabase } = await requireSuperadmin();

    const id = getId(formData);
    const input = getEmailInput(formData);

    const { data, error } = await supabase
      .from("whitelisted_emails")
      .update({
        ...input,
        updated_at: new Date().toISOString(),
      })
      .eq("id", id)
      .select("id")
      .single();

    if (error || !data) {
      console.error("Update whitelisted email failed:", error);

      if (error?.code === "23505") {
        throw new FormError(
          "This email address is already whitelisted.", "email"
        );
      }

      if (!error || error.code === "PGRST116") {
        throw new FormError("This whitelisted email no longer exists. Refresh the page before trying again.");
      }
      throw new Error("Could not update whitelisted email.");
    }

    revalidatePath(PAGE_PATH);
    redirect(`${PAGE_PATH}?emailUpdated=1`);
  });
}

// DELETE WHITELISTED EMAIL

export async function deleteWhitelistedEmail(
  formData: FormData
) {
  const { supabase } = await requireSuperadmin();

  const id = getId(formData);

  const { data: existing, error: readError } = await supabase
    .from("whitelisted_emails")
    .select("id, email")
    .eq("id", id)
    .single();

  if (readError && readError.code !== "PGRST116") {
    console.error("Deletion lookup failed:", readError);
    throw new Error("Unable to read the record for deletion.");
  }

  if (readError || !existing) {
    throw new FormError("Whitelisted email not found.");
  }

  const { data, error } = await supabase
    .from("whitelisted_emails")
    .delete()
    .eq("id", id)
    .select("id")
    .single();

  if (error || !data) {
    if (error?.code === "23503") {
      throw new FormError("This record is still referenced by other records and cannot be deleted.");
    }
    console.error("Delete whitelisted email failed:", error);
    throw new Error("Could not delete whitelisted email.");
  }

  revalidatePath(PAGE_PATH);
  redirect(`${PAGE_PATH}?emailDeleted=1`);
}
