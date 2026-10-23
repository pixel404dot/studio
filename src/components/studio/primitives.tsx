import { useEffect, useRef, useState, type ReactNode } from "react";
import { AlertCircle, Check, Loader2, Plus, RotateCcw, Sparkles, X } from "lucide-react";
import { isMediaParam, type FloraModel, type ModelParam, type ParamDraft } from "@/lib/flora";
import {
  COMPANY_LOGOS,
  acceptFor,
  draftList,
  draftText,
  isAspectParam,
  ratioOf,
  type Notice,
} from "./helpers";

export function StudioMark({ className = "size-7" }: { className?: string }) {
  return (
    <span
      className={`inline-flex shrink-0 items-center justify-center rounded-lg border border-white/15 bg-surface-2 text-fg shadow-xs ${className}`}
      aria-hidden="true"
    >
      <Sparkles className="size-3.5 text-primary" />
    </span>
  );
}

export function CompanyLogo({ name, compact = false }: { name: string; compact?: boolean }) {
  const src = COMPANY_LOGOS[name];
  const [failed, setFailed] = useState(false);
  return (
    <span
      className={`inline-flex shrink-0 items-center justify-center rounded-md ${
        compact ? "size-4" : "size-5 bg-white/[0.04]"
      }`}
      aria-hidden="true"
    >
      {src && !failed ? (
        <img
          src={src}
          alt=""
          width={18}
          height={18}
          onError={() => setFailed(true)}
          className={compact ? "size-3.5 object-contain" : "size-4 object-contain"}
        />
      ) : (
        <span className={`font-semibold leading-none text-fg-soft ${compact ? "text-[10px]" : "text-[11px]"}`}>
          {(name || "M").slice(0, 1).toUpperCase()}
        </span>
      )}
    </span>
  );
}

export function RatioMark({ value, label }: { value: string; label: string }) {
  const ratio = ratioOf(value, label);
  const longest = Math.max(ratio.w, ratio.h, 1);
  const width = Math.max(7, Math.round((ratio.w / longest) * 13));
  const height = Math.max(7, Math.round((ratio.h / longest) * 13));
  return (
    <span
      className="inline-block rounded-[2px] border border-current opacity-80"
      style={{ width, height }}
      aria-hidden="true"
    />
  );
}

export function NoticeBlock({ notice, onDismiss }: { notice: Notice; onDismiss?: () => void }) {
  if (!notice) return null;
  return (
    <div
      role="alert"
      className={` flex items-start gap-2.5 rounded-xl border px-3.5 py-2.5 text-xs leading-relaxed animate-fade-in ${
        notice.cors
          ? "border-warn/30 bg-warn-bg/90 text-warn"
          : "border-danger/30 bg-danger-bg/90 text-danger"
      }`}
    >
      <AlertCircle className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
      <div className="min-w-0 flex-1">
        <p>{notice.message}</p>
        {notice.cors ? (
          <p className="mt-1 text-fg-soft">
            Direct browser access was blocked by CORS. Reconnect in Settings to route requests through the workspace relay.
          </p>
        ) : null}
      </div>
      {onDismiss ? (
        <button
          type="button"
          onClick={onDismiss}
          className="inline-flex size-5 shrink-0 items-center justify-center rounded-md text-current opacity-70 hover:opacity-100"
          aria-label="Dismiss alert"
        >
          <X className="size-3.5" />
        </button>
      ) : null}
    </div>
  );
}

export function Dialog({
  title,
  subtitle,
  maxWidth = "max-w-lg",
  onClose,
  children,
}: {
  title: string;
  subtitle?: string;
  maxWidth?: string;
  onClose: () => void;
  children: ReactNode;
}) {
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 backdrop-blur-xs animate-fade-in sm:items-center sm:p-4"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title || "Dialog"}
        className={`flex max-h-[88dvh] w-full ${maxWidth} flex-col overflow-hidden rounded-t-2xl border border-border-strong bg-sheet shadow-float animate-sheet-up sm:rounded-2xl sm:animate-pop`}
        onClick={(event) => event.stopPropagation()}
      >
        <div className="mx-auto mt-2.5 h-1 w-9 shrink-0 rounded-full bg-white/15 sm:hidden" />
        <div className="flex shrink-0 items-start justify-between gap-3 border-b border-border px-5 py-3.5">
          <div className="min-w-0">
            {title ? <h3 className="text-base font-semibold text-fg">{title}</h3> : null}
            {subtitle ? <p className="mt-0.5 text-xs text-muted">{subtitle}</p> : null}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="icon-btn -mr-1.5 -mt-1 size-8"
            aria-label="Close"
          >
            <X className="size-4" />
          </button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-5 pb-[max(1.25rem,env(safe-area-inset-bottom))]">
          {children}
        </div>
      </div>
    </div>
  );
}

export function Popover({
  open,
  onClose,
  align = "left",
  width = "w-64",
  children,
}: {
  open: boolean;
  onClose: () => void;
  align?: "left" | "right";
  width?: string;
  children: ReactNode;
}) {
  const ref = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) return;
    const onPointer = (event: MouseEvent) => {
      if (!ref.current) return;
      const parent = ref.current.parentElement;
      if (parent && parent.contains(event.target as Node)) return;
      onClose();
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("mousedown", onPointer);
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("mousedown", onPointer);
      window.removeEventListener("keydown", onKey);
    };
  }, [open, onClose]);

  if (!open) return null;
  return (
    <div
      ref={ref}
      className={`absolute bottom-full mb-2 z-40 ${
        align === "right" ? "right-0" : "left-0"
      } ${width} rounded-xl border border-border-strong bg-sheet p-3 shadow-float animate-pop`}
    >
      {children}
    </div>
  );
}

export function MediaControl({
  param,
  urls,
  busy,
  disabled,
  onAddUrl,
  onFiles,
  onRemove,
}: {
  param: ModelParam;
  urls: string[];
  busy: boolean;
  disabled: boolean;
  onAddUrl: (url: string) => void;
  onFiles: (files: FileList | null) => void;
  onRemove: (url: string) => void;
}) {
  const [link, setLink] = useState("");
  const max = param.type === "string[]" ? (param.max ?? 14) : 1;
  const inputId = `file-${param.name}`;
  return (
    <div className="space-y-2.5">
      <div className="flex items-baseline justify-between gap-2">
        <p className="text-xs font-medium text-fg-soft">{param.label}</p>
        <p className="font-mono text-[11px] text-muted">
          {urls.length}/{max}
        </p>
      </div>
      {param.description ? <p className="text-xs text-muted">{param.description}</p> : null}
      <div className="flex flex-wrap gap-2">
        {urls.map((url) => (
          <div
            key={url}
            className="group relative size-16 shrink-0 overflow-hidden rounded-lg border border-border bg-surface-2"
          >
            {/\.(mp4|webm|mov)(\?|$)/i.test(url) ? (
              <video src={url} className="size-full object-cover" muted playsInline />
            ) : (
              <img src={url} alt="" className="size-full object-cover" />
            )}
            <button
              type="button"
              onClick={() => onRemove(url)}
              className="absolute right-1 top-1 inline-flex size-5 items-center justify-center rounded-full bg-black/75 text-white transition-opacity hover:bg-black"
              aria-label={`Remove ${param.label}`}
            >
              <X className="size-3" aria-hidden="true" />
            </button>
          </div>
        ))}
        {urls.length < max ? (
          <label
            htmlFor={inputId}
            className="inline-flex size-16 shrink-0 cursor-pointer flex-col items-center justify-center gap-1 rounded-lg border border-dashed border-border-strong bg-surface-2/40 text-muted transition-colors hover:border-white/25 hover:text-fg"
          >
            {busy ? (
              <Loader2 className="size-4 animate-spin" aria-hidden="true" />
            ) : (
              <Plus className="size-4" aria-hidden="true" />
            )}
            <span className="text-[10px] font-medium">{busy ? "Uploading" : "Upload"}</span>
            <input
              id={inputId}
              type="file"
              accept={acceptFor(param)}
              multiple={param.type === "string[]"}
              disabled={disabled || busy}
              className="sr-only"
              onChange={(event) => {
                onFiles(event.target.files);
                event.target.value = "";
              }}
            />
          </label>
        ) : null}
      </div>
      {urls.length < max ? (
        <form
          className="flex gap-2"
          onSubmit={(event) => {
            event.preventDefault();
            const next = link.trim();
            if (!next) return;
            onAddUrl(next);
            setLink("");
          }}
        >
          <input
            value={link}
            onChange={(event) => setLink(event.target.value)}
            placeholder="Paste an https:// media URL…"
            inputMode="url"
            className="field h-9 text-xs"
            aria-label={`${param.label} link`}
          />
          <button type="submit" className="btn btn-secondary h-9 px-3 text-xs">
            Add URL
          </button>
        </form>
      ) : null}
    </div>
  );
}

export function AspectPicker({
  param,
  value,
  disabled,
  onChange,
}: {
  param: ModelParam;
  value: string;
  disabled: boolean;
  onChange: (value: string) => void;
}) {
  const current = value || (param.defaultValue == null ? "" : String(param.defaultValue));
  const options = param.options.map((option) => ({ ...option, ratio: ratioOf(option.value, option.label) }));
  const active = options.find((option) => option.value === current) ?? options[0];

  return (
    <div className="space-y-2.5">
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-fg-soft">Aspect ratio</span>
        {active ? <span className="font-mono text-[11px] text-muted">{active.ratio.text}</span> : null}
      </div>
      <div className="grid grid-cols-3 gap-1.5">
        {options.map((option) => {
          const on = option.value === active?.value;
          return (
            <button
              key={option.value}
              type="button"
              disabled={disabled}
              aria-pressed={on}
              onClick={() => onChange(option.value)}
              className={`flex h-9 items-center justify-center gap-1.5 rounded-lg border px-2 text-xs font-medium transition-colors ${
                on
                  ? "border-primary/60 bg-primary/15 text-fg"
                  : "border-border bg-surface-2/60 text-muted hover:border-border-strong hover:text-fg"
              }`}
            >
              <RatioMark value={option.value} label={option.label} />
              <span>{option.ratio.text}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

export function ModelSettings({
  model,
  draft,
  busyParam,
  disabled,
  onChange,
  onAddUrl,
  onFiles,
  onRemoveUrl,
  onReset,
  skip,
}: {
  model: FloraModel | null;
  draft: Record<string, ParamDraft>;
  busyParam: string | null;
  disabled: boolean;
  onChange: (name: string, value: ParamDraft | undefined) => void;
  onAddUrl: (param: ModelParam, url: string) => void;
  onFiles: (param: ModelParam, files: FileList | null) => void;
  onRemoveUrl: (param: ModelParam, url: string) => void;
  onReset?: () => void;
  skip?: (param: ModelParam) => boolean;
}) {
  if (!model) return null;
  const keep = (param: ModelParam) => !skip?.(param);
  if (!model.params.some(keep)) return null;

  const media = model.params.filter((param) => keep(param) && isMediaParam(param));
  const aspects = model.params.filter((param) => keep(param) && param.options.length > 0 && isAspectParam(param));
  const choices = model.params.filter(
    (param) => keep(param) && param.options.length > 0 && !isMediaParam(param) && !isAspectParam(param),
  );
  const numbers = model.params.filter(
    (param) => keep(param) && !param.options.length && ["int", "int?", "float", "seed"].includes(param.type),
  );
  const toggles = model.params.filter((param) => keep(param) && param.type === "bool");
  const dicts = model.params.filter((param) => keep(param) && param.type === "dict" && param.properties.length);
  const texts = model.params.filter(
    (param) =>
      keep(param) &&
      !isMediaParam(param) &&
      !param.options.length &&
      param.type !== "bool" &&
      param.type !== "dict" &&
      !["int", "int?", "float", "seed"].includes(param.type),
  );

  return (
    <div className="space-y-3">
      {onReset ? (
        <div className="flex items-center justify-between border-b border-border pb-2">
          <span className="text-xs font-medium text-fg-soft">Model parameters</span>
          <button
            type="button"
            onClick={onReset}
            className="inline-flex items-center gap-1 text-xs text-muted hover:text-fg"
          >
            <RotateCcw className="size-3" aria-hidden="true" />
            Reset defaults
          </button>
        </div>
      ) : null}

      {media.map((param) => (
        <MediaControl
          key={param.name}
          param={param}
          urls={
            param.type === "string[]"
              ? draftList(draft[param.name])
              : draftText(draft[param.name])
                ? [draftText(draft[param.name])]
                : []
          }
          busy={busyParam === param.name}
          disabled={disabled}
          onAddUrl={(url) => onAddUrl(param, url)}
          onFiles={(files) => onFiles(param, files)}
          onRemove={(url) => onRemoveUrl(param, url)}
        />
      ))}

      {aspects.map((param) => (
        <AspectPicker
          key={param.name}
          param={param}
          value={draftText(draft[param.name])}
          disabled={disabled}
          onChange={(next) => onChange(param.name, next)}
        />
      ))}

      {choices.length || numbers.length ? (
        <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
          {choices.map((param) => (
            <label key={param.name} className="block">
              <span className="label text-xs">{param.label}</span>
              <select
                value={draftText(draft[param.name])}
                onChange={(event) => onChange(param.name, event.target.value || undefined)}
                className="field h-9 text-xs"
              >
                <option value="">Default</option>
                {(draftText(draft[param.name]) &&
                !param.options.some((option) => option.value === draftText(draft[param.name]))
                  ? [{ label: draftText(draft[param.name]), value: draftText(draft[param.name]) }, ...param.options]
                  : param.options
                ).map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
          ))}
          {numbers.map((param) => (
            <label key={param.name} className="block">
              <span className="label text-xs">{param.label}</span>
              <input
                type="text"
                inputMode="text"
                autoComplete="off"
                value={draftText(draft[param.name])}
                placeholder={
                  param.type === "seed" ? "Random seed" : param.defaultValue == null ? "" : String(param.defaultValue)
                }
                onChange={(event) => onChange(param.name, event.target.value || undefined)}
                className="field h-9 font-mono text-xs"
              />
            </label>
          ))}
        </div>
      ) : null}

      {dicts.map((param) => {
        const fields =
          typeof draft[param.name] === "object" && !Array.isArray(draft[param.name])
            ? (draft[param.name] as Record<string, string>)
            : {};
        return (
          <div key={param.name} className="space-y-1.5">
            <p className="text-xs font-medium text-fg-soft">{param.label}</p>
            <div className="grid grid-cols-2 gap-2">
              {param.properties.map((property) => (
                <label key={property.name} className="block">
                  <span className="mb-1 block text-[11px] text-muted">{property.name}</span>
                  <input
                    type="text"
                    inputMode="text"
                    autoComplete="off"
                    value={fields[property.name] ?? ""}
                    placeholder={property.defaultValue == null ? "" : String(property.defaultValue)}
                    onChange={(event) =>
                      onChange(param.name, { ...fields, [property.name]: event.target.value })
                    }
                    className="field h-9 font-mono text-xs"
                  />
                </label>
              ))}
            </div>
          </div>
        );
      })}

      {toggles.length ? (
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          {toggles.map((param) => {
            const checked = draft[param.name] === true;
            return (
              <button
                key={param.name}
                type="button"
                role="switch"
                aria-checked={checked}
                onClick={() => onChange(param.name, !checked)}
                className={`flex items-center justify-between gap-3 rounded-lg border px-3 py-2 text-left text-xs transition-colors ${
                  checked
                    ? "border-primary/50 bg-primary/10 text-fg"
                    : "border-border bg-surface-2/40 text-fg-soft hover:border-border-strong"
                }`}
              >
                <span className="min-w-0">
                  <span className="block font-medium">{param.label}</span>
                  {param.description ? (
                    <span className="mt-0.5 block truncate text-[11px] text-muted">{param.description}</span>
                  ) : null}
                </span>
                <span
                  className={`inline-flex size-4 shrink-0 items-center justify-center rounded ${
                    checked ? "bg-primary text-primary-ink" : "border border-border-strong bg-bg"
                  }`}
                >
                  {checked ? <Check className="size-3" /> : null}
                </span>
              </button>
            );
          })}
        </div>
      ) : null}

      {texts.map((param) => (
        <label key={param.name} className="block">
          <span className="label text-xs">{param.label}</span>
          <input
            value={draftText(draft[param.name])}
            placeholder={param.description || param.name}
            onChange={(event) => onChange(param.name, event.target.value || undefined)}
            className="field h-9 text-xs"
          />
        </label>
      ))}
    </div>
  );
}
