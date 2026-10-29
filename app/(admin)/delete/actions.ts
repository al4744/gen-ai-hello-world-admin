"use server";

import { actionFailure } from "@/lib/action-state";
import { requireSuperadmin } from "@/lib/auth/require-superadmin";
import {
  getDeleteResource,
  isValidDeleteId,
  type DeleteState,
} from "@/lib/delete-resources";

export async function confirmDelete(
  resource: string,
  id: string,
): Promise<DeleteState> {
  await requireSuperadmin();

  const config = getDeleteResource(resource);
  if (!config || !isValidDeleteId(resource, id)) {
    return {
      error: "Invalid deletion request. Return to the management page and try again.",
    };
  }

  // The record and action come from the validated, server-bound route values.
  // Ignore any IDs, resource names, or return URLs posted by the client.
  const data = new FormData();
  data.set(config.idField, id);

  try {
    await config.action(data);
  } catch (error) {
    return actionFailure(error, "Unable to delete this record. Please try again.");
  }

  return { error: "Deletion could not be confirmed. Refresh the page before retrying." };
}
