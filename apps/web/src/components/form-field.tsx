import { cloneElement, isValidElement, useId, type ReactNode } from "react";

import { Label } from "@matcha/ui/label";

interface FieldProps {
  id?: string;
  "aria-describedby"?: string;
  "aria-invalid"?: boolean;
}

export function FormField({ label, error, children }: { label: string; error?: string; children: ReactNode }) {
  const inputId = useId();
  const errorId = useId();

  // Wires the label and error message to the field via id/aria-describedby/
  // aria-invalid so screen readers announce them -- without this, a sighted
  // user sees the label and red error text, but they're not programmatically
  // connected to the input at all.
  const field = isValidElement<FieldProps>(children)
    ? cloneElement(children, {
        id: inputId,
        "aria-describedby": error ? errorId : undefined,
        "aria-invalid": error ? true : undefined,
      })
    : children;

  return (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor={inputId}>{label}</Label>
      {field}
      {error ? (
        <p id={errorId} className="text-xs text-destructive">
          {error}
        </p>
      ) : null}
    </div>
  );
}
