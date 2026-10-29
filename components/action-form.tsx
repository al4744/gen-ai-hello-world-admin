"use client";

import { useActionState, useEffect, useId, useRef, type ReactNode } from "react";
import type { ActionState, FormAction } from "@/lib/action-state";
import InlineFormError from "./inline-form-error";

type Props = {
  action: FormAction;
  children: ReactNode;
  className?: string;
  id?: string;
  "aria-label"?: string;
  errorTitle?: string;
};

export default function ActionForm({ action, children, errorTitle = "Unable to save changes", ...props }: Props) {
  const formRef = useRef<HTMLFormElement>(null);
  const inFlight = useRef(false);
  const preserveValues = useRef(false);
  const errorId = useId();
  const [state, formAction, pending] = useActionState<ActionState, FormData>(
    async (previousState, data) => {
      void previousState;
      preserveValues.current = false;
      try {
        const result = await action(data);
        // React resets uncontrolled inputs after a resolved form action.
        // A recoverable failure must leave the administrator's edits intact.
        preserveValues.current = Boolean(result?.error);
        return result ?? { error: null };
      } finally {
        inFlight.current = false;
      }
    },
    { error: null },
  );

  useEffect(() => {
    if (!state.error || !state.field || pending) return;
    const field = formRef.current?.elements.namedItem(state.field);
    if (!(field instanceof HTMLElement) || field.getAttribute("type") === "hidden") return;
    const describedBy = field.getAttribute("aria-describedby");
    const invalid = field.getAttribute("aria-invalid");
    field.setAttribute("aria-invalid", "true");
    field.setAttribute("aria-describedby", [describedBy, errorId].filter(Boolean).join(" "));
    return () => {
      if (describedBy === null) field.removeAttribute("aria-describedby");
      else field.setAttribute("aria-describedby", describedBy);
      if (invalid === null) field.removeAttribute("aria-invalid");
      else field.setAttribute("aria-invalid", invalid);
    };
  }, [state.error, state.field, pending, errorId]);

  return (
    <>
      <form
        {...props}
        ref={formRef}
        action={formAction}
        aria-busy={pending}
        onSubmit={(event) => {
          if (inFlight.current) event.preventDefault();
          else inFlight.current = true;
        }}
        onReset={(event) => {
          if (preserveValues.current) event.preventDefault();
        }}
      >
        {children}
        {!pending && state.error && (
          <InlineFormError id={errorId} title={errorTitle} message={state.error} />
        )}
      </form>
      <p role="status" className="sr-only">{pending ? "Submitting changes…" : ""}</p>
    </>
  );
}
