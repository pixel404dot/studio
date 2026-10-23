import type { ErrorComponentProps } from "@tanstack/react-router";
import { RotateCcw, TriangleAlert } from "lucide-react";

const FALLBACK_MESSAGE = "An unexpected error occurred. Try reloading the page.";

function errorMessage(error: unknown): string {
  if (error instanceof Error && error.message) return error.message;
  if (typeof error === "string" && error) return error;
  return FALLBACK_MESSAGE;
}

export function AppErrorComponent({ error }: ErrorComponentProps) {
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center bg-bg px-6 text-center text-fg">
      <div className="card max-w-md space-y-4 p-6 shadow-float">
        <span className="mx-auto inline-flex size-10 items-center justify-center rounded-lg bg-danger-bg text-danger" aria-hidden="true">
          <TriangleAlert className="size-5" />
        </span>
        <div className="space-y-1.5">
          <h1 className="text-base font-semibold text-fg">Something went wrong</h1>
          <p className="text-sm break-words text-muted">{errorMessage(error)}</p>
        </div>
        <button
          type="button"
          onClick={() => window.location.reload()}
          className="btn btn-secondary h-9 px-3.5 text-xs"
        >
          <RotateCcw className="size-3.5" aria-hidden="true" />
          Reload application
        </button>
      </div>
    </main>
  );
}
