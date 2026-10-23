import { ExternalLink, Eye, EyeOff, KeyRound, Loader2 } from "lucide-react";
import { GROK_PROVIDERS, signIn } from "@/lib/auth/client";
import { UserButton } from "@/lib/auth/gates";
import { formatUsd, maskKey, type Project, type Workspace, type WorkspaceBalance } from "@/lib/flora";
import type { Notice } from "./helpers";
import { Dialog, NoticeBlock } from "./primitives";

export function SettingsModal({
  user,
  apiKeyInput,
  onApiKeyChange,
  savedKey,
  showKey,
  onToggleShowKey,
  dirty,
  loadingWs,
  onSaveAndConnect,
  onClearKey,
  connNotice,
  workspaces,
  workspaceId,
  onWorkspaceChange,
  projects,
  projectId,
  loadingProjects,
  onProjectChange,
  balance,
  balanceState,
  youmindInput,
  onYoumindChange,
  youmindKey,
  showYoumind,
  onToggleShowYoumind,
  youmindBusy,
  onSaveYoumind,
  onClearYoumind,
  onClose,
}: {
  user: unknown;
  apiKeyInput: string;
  onApiKeyChange: (value: string) => void;
  savedKey: string | null;
  showKey: boolean;
  onToggleShowKey: () => void;
  dirty: boolean;
  loadingWs: boolean;
  onSaveAndConnect: () => void;
  onClearKey: () => void;
  connNotice: Notice;
  workspaces: Workspace[];
  workspaceId: string;
  onWorkspaceChange: (id: string) => void;
  projects: Project[];
  projectId: string;
  loadingProjects: boolean;
  onProjectChange: (id: string) => void;
  balance: WorkspaceBalance | null;
  balanceState: "idle" | "loading" | "ready" | "error";
  youmindInput: string;
  onYoumindChange: (value: string) => void;
  youmindKey: string | null;
  showYoumind: boolean;
  onToggleShowYoumind: () => void;
  youmindBusy: boolean;
  onSaveYoumind: () => void;
  onClearYoumind: () => void;
  onClose: () => void;
}) {
  return (
    <Dialog
      title="Settings"
      subtitle="Manage API connections, active workspace, and account sync."
      maxWidth="max-w-lg"
      onClose={onClose}
    >
      <div className="space-y-5">
        {/* Status bar */}
        <div className="flex flex-wrap items-center gap-2">
          <span
            className={`inline-flex h-7 items-center gap-1.5 rounded-full border px-2.5 font-mono text-xs ${
              savedKey
                ? "border-success/30 bg-success-bg/80 text-success"
                : "border-border bg-surface-2 text-muted"
            }`}
          >
            <span className={`size-1.5 rounded-full ${savedKey ? "bg-success" : "bg-faint"}`} />
            {savedKey ? `Flora ${maskKey(savedKey)}` : "Flora not connected"}
          </span>

          {youmindKey ? (
            <span className="inline-flex h-7 items-center gap-1.5 rounded-full border border-primary/30 bg-primary/10 px-2.5 font-mono text-xs text-primary">
              YouMind {maskKey(youmindKey)}
            </span>
          ) : null}

          {balanceState === "ready" && balance ? (
            <span className="inline-flex h-7 items-center rounded-full border border-border bg-surface-2 px-2.5 font-mono text-xs text-fg">
              Balance: {balance.currency === "USD" ? formatUsd(balance.amount) : `${balance.amount} ${balance.currency}`}
            </span>
          ) : null}
        </div>

        {/* Flora API & Workspace */}
        <section className="space-y-4 rounded-xl border border-border bg-surface p-4">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <KeyRound className="size-4 text-primary" aria-hidden="true" />
              <h4 className="text-sm font-semibold text-fg">Flora API & Workspace</h4>
            </div>
            <a
              href="https://app.flora.ai/projects?openSettings=true&initialTab=apiKeys"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-xs text-muted hover:text-fg"
            >
              API keys <ExternalLink className="size-3" aria-hidden="true" />
            </a>
          </div>

          <form
            onSubmit={(event) => {
              event.preventDefault();
              onSaveAndConnect();
            }}
            className="space-y-3"
          >
            <div>
              <label className="label text-xs" htmlFor="api-key">
                API key
              </label>
              <div className="flex gap-2">
                <input
                  id="api-key"
                  name="flora-api-key"
                  autoComplete="off"
                  spellCheck={false}
                  type={showKey ? "text" : "password"}
                  value={apiKeyInput}
                  onChange={(event) => onApiKeyChange(event.target.value)}
                  placeholder="ak_…"
                  className="field font-mono text-xs"
                />
                <button
                  type="button"
                  onClick={onToggleShowKey}
                  className="btn btn-secondary size-10 shrink-0 p-0"
                  aria-label={showKey ? "Hide API key" : "Show API key"}
                >
                  {showKey ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                </button>
              </div>
              <p className="mt-1.5 text-xs text-muted">
                Stored locally in your browser and sent only to Flora’s API.
              </p>
            </div>

            <div className="flex flex-wrap gap-2">
              <button type="submit" disabled={loadingWs} className="btn btn-primary h-9 px-3.5 text-xs">
                {loadingWs ? (
                  <>
                    <Loader2 className="size-3.5 animate-spin" />
                    Connecting…
                  </>
                ) : dirty || !savedKey ? (
                  "Save and connect"
                ) : (
                  "Reconnect"
                )}
              </button>
              {apiKeyInput || savedKey ? (
                <button
                  type="button"
                  onClick={onClearKey}
                  className="btn btn-secondary h-9 px-3 text-xs"
                >
                  Disconnect
                </button>
              ) : null}
            </div>
          </form>

          <NoticeBlock notice={connNotice} />

          <div className="grid grid-cols-1 gap-3 border-t border-border pt-3.5 sm:grid-cols-2">
            <div>
              <label className="label text-xs" htmlFor="workspace">
                Workspace
              </label>
              <select
                id="workspace"
                value={workspaceId}
                disabled={!savedKey || loadingWs || workspaces.length === 0}
                onChange={(event) => onWorkspaceChange(event.target.value)}
                className="field h-9 text-xs"
              >
                <option value="">{workspaces.length ? "Select workspace" : "No workspaces"}</option>
                {workspaces.map((workspace) => (
                  <option key={workspace.id} value={workspace.id}>
                    {workspace.name}
                    {workspace.role ? ` · ${workspace.role}` : ""}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="label text-xs" htmlFor="project">
                Project
              </label>
              <select
                id="project"
                value={projectId}
                disabled={!workspaceId || loadingProjects || projects.length === 0}
                onChange={(event) => onProjectChange(event.target.value)}
                className="field h-9 text-xs"
              >
                <option value="">
                  {loadingProjects ? "Loading…" : projects.length ? "Select project" : "No projects"}
                </option>
                {projects.map((project) => (
                  <option key={project.id} value={project.id}>
                    {project.name}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </section>

        {/* YouMind Provider */}
        <form
          onSubmit={(event) => {
            event.preventDefault();
            onSaveYoumind();
          }}
          className="space-y-3 rounded-xl border border-border bg-surface p-4"
        >
          <div className="flex items-center justify-between gap-2">
            <h4 className="text-sm font-semibold text-fg">YouMind Image Provider</h4>
            <a
              href="https://youmind.com/settings/api-keys"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-xs text-muted hover:text-fg"
            >
              YouMind keys <ExternalLink className="size-3" aria-hidden="true" />
            </a>
          </div>
          <div>
            <label className="label text-xs" htmlFor="youmind-key">
              YouMind API key (optional)
            </label>
            <div className="flex gap-2">
              <input
                id="youmind-key"
                name="youmind-api-key"
                autoComplete="off"
                spellCheck={false}
                type={showYoumind ? "text" : "password"}
                value={youmindInput}
                onChange={(event) => onYoumindChange(event.target.value)}
                placeholder="sk-ym-…"
                className="field font-mono text-xs"
              />
              <button
                type="button"
                onClick={onToggleShowYoumind}
                className="btn btn-secondary size-10 shrink-0 p-0"
                aria-label={showYoumind ? "Hide YouMind key" : "Show YouMind key"}
              >
                {showYoumind ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
              </button>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <button type="submit" disabled={youmindBusy} className="btn btn-secondary h-9 px-3.5 text-xs">
              {youmindBusy ? "Verifying…" : "Save YouMind key"}
            </button>
            {youmindInput || youmindKey ? (
              <button
                type="button"
                onClick={onClearYoumind}
                className="btn btn-ghost h-9 px-3 text-xs"
              >
                Clear
              </button>
            ) : null}
          </div>
        </form>

        {/* Account Sync */}
        <section className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border bg-surface p-4">
          <div className="space-y-0.5">
            <h4 className="text-sm font-semibold text-fg">Account Sync</h4>
            <p className="text-xs text-muted">Keep saved runs backed up across sessions.</p>
          </div>
          {user ? (
            <UserButton />
          ) : (
            <div className="flex flex-wrap gap-2">
              {GROK_PROVIDERS.map((provider) => (
                <button
                  key={provider.providerId}
                  type="button"
                  onClick={() => signIn(provider.providerId, { callbackURL: "/" })}
                  className="btn btn-secondary h-8 px-3 text-xs"
                >
                  Sign in with {provider.label}
                </button>
              ))}
            </div>
          )}
        </section>
      </div>
    </Dialog>
  );
}
