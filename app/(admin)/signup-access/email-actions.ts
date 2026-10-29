
"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireSuperadmin } from "@/lib/auth/require-superadmin";

const PAGE_PATH = "/signup-access";

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const EMAIL_PATTERN =
  /^[^\s@]+@[a-z0-9](?:[a-z0-9-]*[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]*[a-z0-9])?)+$/;

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
    throw new Error("Invalid whitelisted email ID.");
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
    throw new Error(
      "Enter a valid email address, such as student@columbia.edu."
    );
  }

  if (description.length > 2000) {
    throw new Error(
      "Description must be at most 2000 characters."
    );
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
  const { supabase } = await requireSuperadmin();

  const input = getEmailInput(formData);

  const { error } = await supabase
    .from("whitelisted_emails")
    .insert(input);

  if (error) {
    console.error("Create whitelisted email failed:", error);

    if (error.code === "23505") {
      throw new Error(
        "This email address is already whitelisted."
      );
    }

    throw new Error("Could not create whitelisted email.");
  }

  revalidatePath(PAGE_PATH);
  redirect(`${PAGE_PATH}?emailCreated=1`);
}

// UPDATE WHITELISTED EMAIL

export async function updateWhitelistedEmail(
  formData: FormData
) {
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
      throw new Error(
        "This email address is already whitelisted."
      );
    }

    throw new Error("Could not update whitelisted email.");
  }

  revalidatePath(PAGE_PATH);
  redirect(`${PAGE_PATH}?emailUpdated=1`);
}

// DELETE WHITELISTED EMAIL

export async function deleteWhitelistedEmail(
  formData: FormData
) {
  const { supabase } = await requireSuperadmin();

  const id = getId(formData);
  const confirmation = getText(formData, "confirmation");

  const { data: existing, error: readError } = await supabase
    .from("whitelisted_emails")
    .select("id, email")
    .eq("id", id)
    .single();

  if (readError || !existing) {
    throw new Error("Whitelisted email not found.");
  }

  if (confirmation !== `DELETE ${existing.email}`) {
    throw new Error(
      `To delete this email, enter exactly: DELETE ${existing.email}`
    );
  }

  const { data, error } = await supabase
    .from("whitelisted_emails")
    .delete()
    .eq("id", id)
    .select("id")
    .single();

  if (error || !data) {
    console.error("Delete whitelisted email failed:", error);
    throw new Error("Could not delete whitelisted email.");
  }

  revalidatePath(PAGE_PATH);
  redirect(`${PAGE_PATH}?emailDeleted=1`);
}
