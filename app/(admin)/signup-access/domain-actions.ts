
"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireSuperadmin } from "@/lib/auth/require-superadmin";

const PAGE_PATH = "/signup-access";

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const DOMAIN_PATTERN =
  /^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]*[a-z0-9])?)+$/;

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
    throw new Error("Invalid signup domain ID.");
  }

  return id;
}

function getDomainInput(formData: FormData) {
  const domain = getText(formData, "domain").toLowerCase();
  const description = getText(formData, "description");
  const isActive = formData.get("isActive") === "on";

  if (
    domain.length < 1 ||
    domain.length > 253 ||
    !DOMAIN_PATTERN.test(domain)
  ) {
    throw new Error(
      "Enter a valid email domain, such as columbia.edu."
    );
  }

  if (description.length > 2000) {
    throw new Error(
      "Description must be at most 2000 characters."
    );
  }

  return {
    domain,
    description,
    is_active: isActive,
  };
}

// CREATE DOMAIN

export async function createSignupDomain(formData: FormData) {
  const { supabase } = await requireSuperadmin();

  const input = getDomainInput(formData);

  const { error } = await supabase
    .from("allowed_signup_domains")
    .insert(input);

  if (error) {
    console.error("Create signup domain failed:", error);

    if (error.code === "23505") {
      throw new Error(
        "This signup domain already exists."
      );
    }

    throw new Error("Could not create signup domain.");
  }

  revalidatePath(PAGE_PATH);
  redirect(`${PAGE_PATH}?domainCreated=1`);
}

// UPDATE DOMAIN

export async function updateSignupDomain(formData: FormData) {
  const { supabase } = await requireSuperadmin();

  const id = getId(formData);
  const input = getDomainInput(formData);

  const { data, error } = await supabase
    .from("allowed_signup_domains")
    .update({
      ...input,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id)
    .select("id")
    .single();

  if (error || !data) {
    console.error("Update signup domain failed:", error);

    if (error?.code === "23505") {
      throw new Error(
        "This signup domain already exists."
      );
    }

    throw new Error("Could not update signup domain.");
  }

  revalidatePath(PAGE_PATH);
  redirect(`${PAGE_PATH}?domainUpdated=1`);
}

// DELETE DOMAIN

export async function deleteSignupDomain(formData: FormData) {
  const { supabase } = await requireSuperadmin();

  const id = getId(formData);
  const confirmation = getText(formData, "confirmation");

  const { data: existing, error: readError } = await supabase
    .from("allowed_signup_domains")
    .select("id, domain")
    .eq("id", id)
    .single();

  if (readError || !existing) {
    throw new Error("Signup domain not found.");
  }

  if (confirmation !== `DELETE ${existing.domain}`) {
    throw new Error(
      `To delete this domain, enter exactly: DELETE ${existing.domain}`
    );
  }

  const { data, error } = await supabase
    .from("allowed_signup_domains")
    .delete()
    .eq("id", id)
    .select("id")
    .single();

  if (error || !data) {
    console.error("Delete signup domain failed:", error);
    throw new Error("Could not delete signup domain.");
  }

  revalidatePath(PAGE_PATH);
  redirect(`${PAGE_PATH}?domainDeleted=1`);
}
