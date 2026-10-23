import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft, ShieldCheck, Sparkles } from "lucide-react";
import { GROK_PROVIDERS, authEnabled, signIn } from "@/lib/auth/client";

export const Route = createFileRoute("/login")({ component: Login });

function Login() {
  return (
    <main className="relative grid min-h-dvh place-items-center bg-bg px-4 py-10">
      <SignInCard />
    </main>
  );
}

export function SignInCard() {
  return (
    <div className="card w-full max-w-sm animate-rise p-6 shadow-float sm:p-8">
      <div className="mb-6 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <span
            className="grid size-9 place-items-center rounded-lg border border-white/15 bg-surface-2 text-fg"
            aria-hidden="true"
          >
            <Sparkles className="size-4 text-primary" />
          </span>
          <div>
            <p className="text-sm font-semibold leading-none text-fg">Studio</p>
            <p className="mt-1 text-xs text-muted">Creative workspace</p>
          </div>
        </div>
        <Link to="/" className="btn btn-ghost h-8 px-2.5 text-xs">
          <ArrowLeft className="size-3.5" aria-hidden="true" />
          Back
        </Link>
      </div>

      <header className="space-y-1.5">
        <h1 className="text-xl font-semibold tracking-tight text-fg">Sign in to Studio</h1>
        <p className="text-sm text-muted">
          Sync your generation history, threads, and pinned models across sessions.
        </p>
      </header>

      {authEnabled ? (
        <div className="mt-6 space-y-2.5">
          {GROK_PROVIDERS.map((provider) => (
            <button
              key={provider.providerId}
              type="button"
              onClick={() => signIn(provider.providerId, { callbackURL: "/" })}
              className="btn btn-secondary flex h-10 w-full items-center justify-center gap-2 text-sm font-medium"
            >
              Continue with {provider.label}
            </button>
          ))}

          <div className="mt-4 flex items-start gap-2 rounded-lg border border-border bg-surface-2/60 p-3 text-xs text-muted">
            <ShieldCheck className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden="true" />
            <p>Opened from Grok? Your session is connected automatically. Otherwise, sign in with Google or X.</p>
          </div>
        </div>
      ) : (
        <p className="mt-6 text-sm text-muted">Sign-in is unavailable in this environment.</p>
      )}
    </div>
  );
}
