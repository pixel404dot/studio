import { KeyRound, Loader2, Play, RefreshCw, Search, Workflow, X } from "lucide-react";
import { formatUsd, isUrlInput, type Technique, type TechniqueInput } from "@/lib/flora";
import type { Notice } from "./helpers";
import { NoticeBlock } from "./primitives";

export function WorkflowsView({
  techniques,
  visibleTechniques,
  techLoading,
  techNotice,
  techQuery,
  onQueryChange,
  slugDraft,
  onSlugChange,
  activeTechnique,
  techInputs,
  inputValues,
  onInputValueChange,
  techDetailLoading,
  running,
  hasKey,
  onLoadList,
  onSelectTechnique,
  onRunTechnique,
  onOpenSettings,
}: {
  techniques: Technique[];
  visibleTechniques: Technique[];
  techLoading: boolean;
  techNotice: Notice;
  techQuery: string;
  onQueryChange: (value: string) => void;
  slugDraft: string;
  onSlugChange: (value: string) => void;
  activeTechnique: Technique | null;
  techInputs: TechniqueInput[];
  inputValues: Record<string, string>;
  onInputValueChange: (id: string, value: string) => void;
  techDetailLoading: boolean;
  running: boolean;
  hasKey: boolean;
  onLoadList: () => void;
  onSelectTechnique: (slug: string) => void;
  onRunTechnique: () => void;
  onOpenSettings: () => void;
}) {
  return (
    <div className="mx-auto w-full max-w-5xl space-y-5 py-2 animate-fade-in">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-fg">Workflows</h2>
          <p className="text-xs text-muted">
            Run reusable multi-step Flora techniques and automated creative pipelines.
          </p>
        </div>
        <div className="flex items-center gap-2">
          {!hasKey ? (
            <button type="button" onClick={onOpenSettings} className="btn btn-secondary h-9 px-3.5 text-xs">
              <KeyRound className="size-3.5" aria-hidden="true" />
              Connect API key
            </button>
          ) : null}
          <button
            type="button"
            onClick={onLoadList}
            disabled={techLoading}
            className="btn btn-primary h-9 px-3.5 text-xs"
          >
            {techLoading ? (
              <Loader2 className="size-3.5 animate-spin" aria-hidden="true" />
            ) : (
              <RefreshCw className="size-3.5" aria-hidden="true" />
            )}
            {techniques.length ? "Refresh" : "Load workflows"}
          </button>
        </div>
      </div>

      <NoticeBlock notice={techNotice} />

      <div className="grid grid-cols-1 items-start gap-5 lg:grid-cols-[1fr_22rem]">
        {/* Left: Workflow catalog */}
        <div className="space-y-3">
          {techniques.length > 0 ? (
            <div className="relative">
              <Search
                className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted"
                aria-hidden="true"
              />
              <input
                value={techQuery}
                onChange={(event) => onQueryChange(event.target.value)}
                placeholder="Filter workflows by name, slug, or description…"
                className="field h-10 pl-9 pr-8 text-sm"
                aria-label="Filter workflows"
              />
              {techQuery ? (
                <button
                  type="button"
                  onClick={() => onQueryChange("")}
                  className="absolute right-2 top-1/2 inline-flex size-6 -translate-y-1/2 items-center justify-center rounded-md text-muted hover:text-fg"
                  aria-label="Clear filter"
                >
                  <X className="size-3.5" />
                </button>
              ) : null}
            </div>
          ) : null}

          {techniques.length > 0 ? (
            <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
              {visibleTechniques.map((technique) => {
                const selected = activeTechnique?.slug === technique.slug && technique.slug !== "";
                return (
                  <button
                    key={technique.id || technique.slug || technique.name}
                    type="button"
                    disabled={!technique.slug || techDetailLoading}
                    onClick={() => onSelectTechnique(technique.slug)}
                    className={`card flex flex-col justify-between gap-3 p-4 text-left transition-colors ${
                      selected
                        ? "border-primary/60 bg-primary/10"
                        : "hover:border-border-strong hover:bg-surface-2/60"
                    }`}
                  >
                    <div className="space-y-1.5">
                      <div className="flex items-start justify-between gap-2">
                        <h3 className="text-sm font-medium text-fg">{technique.name}</h3>
                        {technique.cost != null ? (
                          <span className="shrink-0 rounded-md bg-white/[0.06] px-1.5 py-0.5 font-mono text-[11px] text-fg-soft">
                            {formatUsd(technique.cost)}
                          </span>
                        ) : null}
                      </div>
                      {technique.slug ? (
                        <p className="truncate font-mono text-[11px] text-primary">{technique.slug}</p>
                      ) : null}
                      <p className="line-clamp-2 text-xs leading-relaxed text-muted">
                        {technique.description || "Custom Flora workflow pipeline."}
                      </p>
                    </div>
                    <span className="inline-flex items-center gap-1 text-xs font-medium text-fg-soft">
                      {selected ? "Selected" : "Configure inputs →"}
                    </span>
                  </button>
                );
              })}
            </div>
          ) : (
            <div className="card flex flex-col items-center justify-center gap-3 px-6 py-12 text-center">
              <span className="inline-flex size-10 items-center justify-center rounded-xl border border-border bg-surface-2 text-muted">
                <Workflow className="size-5" aria-hidden="true" />
              </span>
              <div className="max-w-sm space-y-1">
                <h3 className="text-sm font-medium text-fg">No workflows loaded</h3>
                <p className="text-xs text-muted">
                  {hasKey
                    ? "Fetch your workspace’s published techniques or load a specific workflow by slug on the right."
                    : "Connect your Flora API key in Settings to browse and run workspace techniques."}
                </p>
              </div>
              <button
                type="button"
                onClick={hasKey ? onLoadList : onOpenSettings}
                disabled={techLoading}
                className="btn btn-secondary h-9 px-3.5 text-xs"
              >
                {hasKey ? (techLoading ? "Loading…" : "Load workflows") : "Open Settings"}
              </button>
            </div>
          )}
        </div>

        {/* Right: Workflow runner */}
        <section className="card sticky top-16 space-y-4 p-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-fg">Run workflow</h3>
            {activeTechnique?.cost != null ? (
              <span className="rounded-md bg-white/[0.06] px-2 py-0.5 font-mono text-xs text-fg-soft">
                {formatUsd(activeTechnique.cost)} / run
              </span>
            ) : null}
          </div>

          <form
            className="space-y-2"
            onSubmit={(event) => {
              event.preventDefault();
              onSelectTechnique(slugDraft);
            }}
          >
            <label className="label text-xs" htmlFor="slug">
              Workflow slug
            </label>
            <div className="flex gap-2">
              <input
                id="slug"
                value={slugDraft}
                onChange={(event) => onSlugChange(event.target.value)}
                placeholder="portrait-enhancer"
                className="field h-9 font-mono text-xs"
              />
              <button
                type="submit"
                disabled={techDetailLoading || !slugDraft.trim()}
                className="btn btn-secondary h-9 shrink-0 px-3 text-xs"
              >
                {techDetailLoading ? <Loader2 className="size-3.5 animate-spin" /> : "Load"}
              </button>
            </div>
          </form>

          {activeTechnique ? (
            <div className="rounded-lg border border-border bg-surface-2/50 px-3 py-2">
              <p className="text-xs font-medium text-fg">{activeTechnique.name}</p>
              {activeTechnique.description ? (
                <p className="mt-0.5 text-[11px] text-muted">{activeTechnique.description}</p>
              ) : null}
            </div>
          ) : null}

          {techInputs.length > 0 ? (
            <div className="space-y-3 border-t border-border pt-3">
              {techInputs.map((input) => {
                const isUrl = isUrlInput(input.type);
                return (
                  <label key={input.id} className="block">
                    <span className="mb-1 flex items-center justify-between text-xs font-medium text-fg-soft">
                      <span>{input.name || input.id}</span>
                      <span className="font-mono text-[10px] text-faint">{isUrl ? "HTTPS URL" : "Text"}</span>
                    </span>
                    {isUrl ? (
                      <input
                        value={inputValues[input.id] ?? ""}
                        onChange={(event) => onInputValueChange(input.id, event.target.value)}
                        placeholder="https://…"
                        className="field h-9 font-mono text-xs"
                      />
                    ) : (
                      <textarea
                        value={inputValues[input.id] ?? ""}
                        onChange={(event) => onInputValueChange(input.id, event.target.value)}
                        rows={3}
                        placeholder={`Enter ${(input.name || input.id).toLowerCase()}…`}
                        className="field text-xs"
                      />
                    )}
                  </label>
                );
              })}
            </div>
          ) : null}

          <button
            type="button"
            onClick={onRunTechnique}
            disabled={running || techDetailLoading}
            className="btn btn-primary w-full"
          >
            {running ? (
              <Loader2 className="size-4 animate-spin" aria-hidden="true" />
            ) : (
              <Play className="size-3.5 fill-current" aria-hidden="true" />
            )}
            Run workflow
          </button>
        </section>
      </div>
    </div>
  );
}
