"use client";
import { useFormStatus } from "react-dom";
export function SubmitButton({
  children,
  secondary = false,
}: {
  children: React.ReactNode;
  secondary?: boolean;
}) {
  const { pending } = useFormStatus();
  return (
    <button
      className={`button ${secondary ? "secondary" : ""}`}
      disabled={pending}
      aria-disabled={pending}
    >
      {pending ? "처리 중…" : children}
    </button>
  );
}
