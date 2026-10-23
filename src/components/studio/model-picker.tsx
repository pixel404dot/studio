import { useMemo, useState } from "react";
import { Check, Pin, Search, Sparkles, X } from "lucide-react";
import { formatUsd, modelAside, variantForImageCount, type FloraModel } from "@/lib/flora";
import { formatEta } from "./helpers";
import { CompanyLogo } from "./primitives";

export function ModelPicker({
  models,
  modelId,
  modelType,
  disabled,
  loading,
  imageCount,
  pinnedIds,
  onTogglePin,
  onSelect,
}: {
  models: FloraModel[];
  modelId: string;
  modelType: string;
  disabled: boolean;
  loading: boolean;
  imageCount: number;
  pinnedIds: string[];
  onTogglePin: (ids: string[], pinned: boolean) => void;
  onSelect: (model: FloraModel | null) => void;
}) {
  const [query, setQuery] = useState("");
  const [filterCompany, setFilterCompany] = useState<string>("all");

  const groups = useMemo(() => {
    const buckets = new Map<string, FloraModel[]>();
    for (const model of models) {
      if (model.type !== modelType) continue;
      const company = model.company || "Other";
      const list = buckets.get(company) ?? [];
      list.push(model);
      buckets.set(company, list);
    }
    return [...buckets.entries()]
      .map(([company, items]) => ({
        company,
        models: items.sort((a, b) => a.name.localeCompare(b.name)),
      }))
      .sort((a, b) => (a.company === "Other" ? 1 : b.company === "Other" ? -1 : a.company.localeCompare(b.company)));
  }, [models, modelType]);

  const hasPinned = useMemo(
    () => groups.some((group) => group.models.some((model) => pinnedIds.includes(model.id))),
    [groups, pinnedIds],
  );

  const q = query.trim().toLowerCase();
  const hit = (model: FloraModel, company: string) =>
    `${model.name} ${model.id} ${company} ${model.blurb} ${model.capabilities.join(" ")}`.toLowerCase().includes(q);

  function nameRows(list: FloraModel[], company: string) {
    const rows: FloraModel[][] = [];
    const seen = new Set<string>();
    for (const model of list) {
      if (seen.has(model.name)) continue;
      const variants = list.filter((item) => item.name === model.name);
      if (q && !variants.some((item) => hit(item, company))) continue;
      seen.add(model.name);
      rows.push(variants);
    }
    return rows;
  }

  function renderVariants(variants: FloraModel[], company: string) {
    const chosen = variantForImageCount(variants, variants.length > 1 ? imageCount : 0) ?? variants[0];
    if (!chosen) return null;
    const active = variants.some((model) => model.id === modelId && model.type === modelType);
    const pinned = variants.some((model) => pinnedIds.includes(model.id));
    const price = chosen.baseCost;
    const eta = formatEta(chosen.seconds);
    const aside = variants.length > 1 ? "" : modelAside(chosen, variants);
    const detail = [company, aside].filter(Boolean).join(" · ");

    return (
      <div
        key={`${company}:${chosen.name}`}
        className={`group flex items-center rounded-xl border transition-colors ${
          active
            ? "border-primary/50 bg-primary/10"
            : "border-transparent hover:border-border hover:bg-surface-2/70"
        }`}
      >
        <button
          type="button"
          aria-pressed={active}
          onClick={() => {
            onSelect(variants.length > 1 ? chosen : (variants[0] ?? chosen));
            setQuery("");
          }}
          className="flex min-w-0 flex-1 items-center gap-3 px-3 py-2.5 text-left"
        >
          <CompanyLogo name={company} />
          <span className="min-w-0 flex-1">
            <span className="flex flex-wrap items-center gap-1.5">
              <span className={`truncate text-sm font-medium ${active ? "text-fg" : "text-fg-soft"}`}>
                {chosen.name}
              </span>
              {price != null ? (
                <span className="rounded-md bg-white/[0.06] px-1.5 py-0.5 font-mono text-[11px] text-fg-soft">
                  {formatUsd(price)}
                </span>
              ) : null}
              {eta ? (
                <span className="rounded-md bg-white/[0.04] px-1.5 py-0.5 font-mono text-[11px] text-muted">
                  ~{eta}
                </span>
              ) : null}
            </span>
            {detail ? <span className="mt-0.5 block truncate text-xs text-muted">{detail}</span> : null}
          </span>
          {active ? <Check className="size-4 shrink-0 text-primary" aria-hidden="true" /> : null}
        </button>
        <button
          type="button"
          aria-pressed={pinned}
          aria-label={pinned ? `Unpin ${chosen.name}` : `Pin ${chosen.name}`}
          onClick={() => onTogglePin(variants.map((model) => model.id), !pinned)}
          className={`mr-2 inline-flex size-7 shrink-0 items-center justify-center rounded-lg transition-colors ${
            pinned
              ? "text-primary hover:bg-white/10"
              : "text-faint opacity-75 hover:bg-white/10 hover:text-fg group-hover:opacity-100"
          }`}
        >
          <Pin className={`size-3.5 ${pinned ? "fill-current" : ""}`} aria-hidden="true" />
        </button>
      </div>
    );
  }

  const visibleGroups = groups.filter((group) => {
    if (filterCompany === "all" || filterCompany === "pinned") return true;
    return group.company === filterCompany;
  });

  return (
    <div className="space-y-3">
      {/* Search bar */}
      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted" aria-hidden="true" />
        <input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search models by name, provider, or capability…"
          disabled={disabled}
          className="field h-10 pl-9 pr-8 text-sm"
        />
        {query ? (
          <button
            type="button"
            onClick={() => setQuery("")}
            className="absolute right-2 top-1/2 inline-flex size-6 -translate-y-1/2 items-center justify-center rounded-md text-muted hover:text-fg"
            aria-label="Clear search"
          >
            <X className="size-3.5" />
          </button>
        ) : null}
      </div>

      {/* Provider filter bar */}
      {groups.length > 1 ? (
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 no-scrollbar">
          <button
            type="button"
            onClick={() => setFilterCompany("all")}
            className={`chip h-7 px-2.5 text-xs ${
              filterCompany === "all" ? "border-primary/60 bg-primary/15 text-fg" : ""
            }`}
          >
            All ({groups.reduce((sum, g) => sum + nameRows(g.models, g.company).length, 0)})
          </button>
          {hasPinned ? (
            <button
              type="button"
              onClick={() => setFilterCompany("pinned")}
              className={`chip h-7 px-2.5 text-xs ${
                filterCompany === "pinned" ? "border-primary/60 bg-primary/15 text-fg" : ""
              }`}
            >
              <Pin className="size-3 fill-current text-primary" aria-hidden="true" />
              Pinned
            </button>
          ) : null}
          {groups.map((group) => (
            <button
              key={group.company}
              type="button"
              onClick={() => setFilterCompany(group.company === filterCompany ? "all" : group.company)}
              className={`chip h-7 px-2.5 text-xs ${
                filterCompany === group.company ? "border-primary/60 bg-primary/15 text-fg" : ""
              }`}
            >
              <CompanyLogo name={group.company} compact />
              <span>{group.company}</span>
            </button>
          ))}
        </div>
      ) : null}

      {/* Model list */}
      <div className="max-h-[56vh] space-y-1 overflow-y-auto pr-0.5">
        {!q && filterCompany === "all" ? (
          <button
            type="button"
            disabled={disabled}
            onClick={() => onSelect(null)}
            className={`flex w-full items-center gap-3 rounded-xl border px-3 py-2.5 text-left text-sm transition-colors ${
              !modelId
                ? "border-primary/50 bg-primary/10 text-fg"
                : "border-transparent text-fg-soft hover:border-border hover:bg-surface-2/70"
            }`}
          >
            <span className="inline-flex size-5 items-center justify-center rounded-md bg-white/[0.06] text-primary">
              <Sparkles className="size-3.5" aria-hidden="true" />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block font-medium">Workspace default</span>
              <span className="block text-xs text-muted">Let the workspace pick the default model for this media type</span>
            </span>
            {!modelId ? <Check className="size-4 shrink-0 text-primary" aria-hidden="true" /> : null}
          </button>
        ) : null}

        {hasPinned && filterCompany === "all" && !q ? (
          <div className="space-y-1 pb-2 pt-1">
            <p className="px-2 text-[11px] font-medium uppercase tracking-wider text-faint">Pinned</p>
            {groups.flatMap((group) =>
              nameRows(
                group.models.filter((model) => pinnedIds.includes(model.id)),
                group.company,
              ).map((variants) => renderVariants(variants, group.company)),
            )}
          </div>
        ) : null}

        {filterCompany === "pinned" ? (
          <div className="space-y-1">
            {groups.flatMap((group) =>
              nameRows(
                group.models.filter((model) => pinnedIds.includes(model.id)),
                group.company,
              ).map((variants) => renderVariants(variants, group.company)),
            )}
          </div>
        ) : (
          visibleGroups.map((group) => {
            const rows = nameRows(group.models, group.company);
            if (!rows.length) return null;
            return (
              <div key={group.company} className="space-y-1 pt-1">
                {visibleGroups.length > 1 && !q ? (
                  <p className="px-2 pt-1 text-[11px] font-medium uppercase tracking-wider text-faint">
                    {group.company}
                  </p>
                ) : null}
                {rows.map((variants) => renderVariants(variants, group.company))}
              </div>
            );
          })
        )}

        {loading ? (
          <div className="space-y-2 py-4 text-center text-xs text-muted">Loading available models…</div>
        ) : !groups.length ? (
          <div className="rounded-xl border border-dashed border-border px-4 py-8 text-center">
            <p className="text-sm font-medium text-fg-soft">No models loaded yet</p>
            <p className="mt-1 text-xs text-muted">
              Connect your Flora or YouMind API key in Settings to browse models for this media type.
            </p>
          </div>
        ) : !visibleGroups.some((group) => nameRows(group.models, group.company).length > 0) ? (
          <p className="px-3 py-6 text-center text-xs text-muted">No models match “{query}”.</p>
        ) : null}
      </div>
    </div>
  );
}
