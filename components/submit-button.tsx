"use client";

import { useFormStatus } from "react-dom";
import type { ComponentProps } from "react";

export default function SubmitButton({
  children,
  disabled,
  pendingLabel = "Saving…",
  ...props
}: ComponentProps<"button"> & { pendingLabel?: string }) {
  const { pending } = useFormStatus();
  return (
    <button
      {...props}
      type="submit"
      disabled={disabled || pending}
      aria-busy={pending}
      style={pending ? { ...props.style, cursor: "wait", opacity: 0.6 } : props.style}
    >
      {pending ? pendingLabel : children}
    </button>
  );
}
