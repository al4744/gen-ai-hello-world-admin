import { unstable_rethrow } from "next/navigation";

export type ActionState = {
  error: string | null;
  field?: string;
  unexpected?: boolean;
};

export type FormAction = (formData: FormData) => Promise<ActionState>;

// Only messages explicitly classified as safe may be sent to the browser.
export class FormError extends Error {
  constructor(message: string, public readonly field?: string) {
    super(message);
    Object.setPrototypeOf(this, new.target.prototype);
    this.name = "FormError";
  }
}

export function actionFailure(
  error: unknown,
  fallback = "Unable to complete this request. Please try again.",
): ActionState {
  // Authentication redirects and successful redirects are control flow.
  unstable_rethrow(error);
  if (error instanceof FormError) {
    return { error: error.message, ...(error.field ? { field: error.field } : {}) };
  }

  console.error("Unexpected action failure:", error);
  return { error: fallback, unexpected: true };
}

export async function runAction(operation: () => Promise<void>): Promise<ActionState> {
  try {
    await operation();
    return { error: null };
  } catch (error) {
    return actionFailure(error);
  }
}
