
"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireSuperadmin } from "@/lib/auth/require-superadmin";

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function readText(formData: FormData, field: string) {
  const value = formData.get(field);
  return typeof value === "string" ? value.trim() : "";
}

function validateTerm(formData: FormData) {
  const term = readText(formData, "term");
  const definition = readText(formData, "definition");
  const category = readText(formData, "category");
  const isActive = formData.get("isActive") === "on";

  if (term.length < 1 || term.length > 120) {
    throw new Error("Term must be between 1 and 120 characters.");
  }

  if (definition.length > 2000) {
    throw new Error("Definition must be 2000 characters or fewer.");
  }

  if (category.length < 1 || category.length > 80) {
    throw new Error("Category must be between 1 and 80 characters.");
  }

  return {
    term,
    definition,
    category,
    is_active: isActive,
  };
}

// CREATE
export async function createTerm(formData: FormData) {
  const { supabase } = await requireSuperadmin();
  const values = validateTerm(formData);

  const { error } = await supabase
    .from("terms")
    .insert({
      ...values,
    });

  if (error) {
    if (error.code === "23505") {
      redirect("/terms?error=duplicate");
    }

    console.error("Create term failed:", error);
    throw new Error("Unable to create term.");
  }

  revalidatePath("/terms");
  redirect("/terms?created=1");
}

// UPDATE
export async function updateTerm(formData: FormData) {
  const { supabase } = await requireSuperadmin();

  const id = readText(formData, "id");

  if (!UUID_PATTERN.test(id)) {
    throw new Error("Invalid term ID.");
  }

  const values = validateTerm(formData);

  const { data, error } = await supabase
    .from("terms")
    .update({
      ...values,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id)
    .select("id")
    .single();

  if (error || !data) {
    if (error?.code === "23505") {
      redirect("/terms?error=duplicate");
    }

    console.error("Update term failed:", error);
    throw new Error("Unable to update term.");
  }

  revalidatePath("/terms");
  redirect("/terms?updated=1");
}

// DELETE
export async function deleteTerm(formData: FormData) {
  const { supabase } = await requireSuperadmin();

  const id = readText(formData, "id");
  const confirmation = readText(formData, "confirmation");

  if (!UUID_PATTERN.test(id)) {
    throw new Error("Invalid term ID.");
  }

  // Obtain the current term directly from the database.
  // Never trust a term name supplied in a hidden form field.
  const { data: existing, error: lookupError } = await supabase
    .from("terms")
    .select("id, term")
    .eq("id", id)
    .single();

  if (lookupError || !existing) {
    throw new Error("Term not found.");
  }

  // Require exact confirmation of the term being deleted.
  const expectedConfirmation = `DELETE ${existing.term}`;

  if (confirmation !== expectedConfirmation) {
    throw new Error(
      `Deletion requires typing: ${expectedConfirmation}`
    );
  }

  const { data, error } = await supabase
    .from("terms")
    .delete()
    .eq("id", id)
    .select("id")
    .single();

  if (error || !data) {
    console.error("Delete term failed:", error);
    throw new Error("Unable to delete term.");
  }

  revalidatePath("/terms");
  redirect("/terms?deleted=1");
}
