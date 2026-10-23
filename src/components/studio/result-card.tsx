import { useEffect, useRef, useState, type MouseEvent, type PointerEvent as ReactPointerEvent } from "react";
import {
  Check,
  Copy,
  Download,
  ExternalLink,
  Hash,
  ImagePlus,
  Loader2,
  Maximize2,
  RotateCcw,
  Square,
  Trash2,
  X,
} from "lucide-react";
import { formatUsd, type OutputPiece, type RunSnapshot } from "@/lib/flora";
import {
  downloadFile,
  downloadName,
  formatTook,
  recipeAspect,
  seedOf,
  statusLabel,
  type Notice,
  type RunRecipe,
} from "./helpers";
import { CompanyLogo, NoticeBlock } from "./primitives";

function TookLabel({ running, startedAt, took }: { running: boolean; startedAt?: number; took?: number | null }) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!running || !startedAt || took != null) return;
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, [running, startedAt, took]);
  const seconds =
    took != null ? took : running && startedAt ? Math.max(0, Math.round((now - startedAt) / 1000)) : null;
  if (seconds == null) return null;
  return <span className="font-mono text-muted">{formatTook(seconds)}</span>;
}

export function FullscreenImage({
  src,
  alt,
  fileName,
  onClose,
}: {
  src: string;
  alt: string;
  fileName?: string;
  onClose: () => void;
}) {
  const [view, setView] = useState({ scale: 1, x: 0, y: 0 });
  const frame = useRef(view);
  const pointers = useRef(new Map<number, { x: number; y: number }>());
  const gesture = useRef<{
    mode: "pinch" | "pan";
    dist: number;
    scale: number;
    x: number;
    y: number;
    px: number;
    py: number;
  } | null>(null);
  const moved = useRef(false);
  const lastTap = useRef(0);

  function place(next: { scale: number; x: number; y: number }) {
    frame.current = next;
    setView(next);
  }

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = previous;
    };
  }, [onClose]);

  function onPointerDown(event: ReactPointerEvent<HTMLDivElement>) {
    pointers.current.set(event.pointerId, { x: event.clientX, y: event.clientY });
    event.currentTarget.setPointerCapture(event.pointerId);
    const points = [...pointers.current.values()];
    if (points.length >= 2) {
      const dx = points[0].x - points[1].x;
      const dy = points[0].y - points[1].y;
      gesture.current = {
        mode: "pinch",
        dist: Math.hypot(dx, dy) || 1,
        scale: frame.current.scale,
        x: frame.current.x,
        y: frame.current.y,
        px: 0,
        py: 0,
      };
      moved.current = true;
      return;
    }
    moved.current = false;
    gesture.current = {
      mode: "pan",
      dist: 0,
      scale: frame.current.scale,
      x: frame.current.x,
      y: frame.current.y,
      px: event.clientX,
      py: event.clientY,
    };
  }

  function onPointerMove(event: ReactPointerEvent<HTMLDivElement>) {
    if (!pointers.current.has(event.pointerId) || !gesture.current) return;
    pointers.current.set(event.pointerId, { x: event.clientX, y: event.clientY });
    const current = gesture.current;
    const points = [...pointers.current.values()];
    if (current.mode === "pinch" && points.length >= 2) {
      const dx = points[0].x - points[1].x;
      const dy = points[0].y - points[1].y;
      const scale = Math.min(5, Math.max(1, current.scale * (Math.hypot(dx, dy) / current.dist)));
      place({ scale, x: scale === 1 ? 0 : frame.current.x, y: scale === 1 ? 0 : frame.current.y });
      return;
    }
    const dx = event.clientX - current.px;
    const dy = event.clientY - current.py;
    if (Math.hypot(dx, dy) > 8) moved.current = true;
    if (current.scale > 1) place({ scale: current.scale, x: current.x + dx, y: current.y + dy });
    else if (dy > 0) place({ scale: 1, x: 0, y: dy });
  }

  function onPointerUp(event: ReactPointerEvent<HTMLDivElement>) {
    const current = gesture.current;
    pointers.current.delete(event.pointerId);
    if (pointers.current.size === 0 && current?.mode === "pan" && current.scale === 1 && frame.current.y > 90) {
      onClose();
      return;
    }
    if (pointers.current.size < 2) gesture.current = null;
    if (frame.current.scale === 1) place({ scale: 1, x: 0, y: 0 });
  }

  function onImageClick(event: MouseEvent) {
    event.stopPropagation();
    if (moved.current) {
      moved.current = false;
      return;
    }
    const now = Date.now();
    if (now - lastTap.current < 280) {
      lastTap.current = 0;
      place(frame.current.scale > 1 ? { scale: 1, x: 0, y: 0 } : { scale: 2.5, x: 0, y: 0 });
    } else {
      lastTap.current = now;
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 bg-black/95 backdrop-blur-sm animate-fade-in"
      role="dialog"
      aria-modal="true"
      aria-label={alt || "Full size image"}
      onClick={onClose}
    >
      <div
        className="absolute right-4 top-[max(0.75rem,env(safe-area-inset-top))] z-10 flex items-center gap-2"
        onClick={(event) => event.stopPropagation()}
      >
        {fileName ? (
          <button
            type="button"
            onClick={() => void downloadFile(src, fileName)}
            className="btn btn-secondary h-9 px-3 text-xs"
          >
            <Download className="size-3.5" aria-hidden="true" />
            Download
          </button>
        ) : null}
        <button
          type="button"
          aria-label="Close"
          onClick={onClose}
          className="inline-flex size-9 items-center justify-center rounded-lg border border-white/15 bg-surface-2 text-fg hover:bg-elev"
        >
          <X className="size-4" aria-hidden="true" />
        </button>
      </div>
      <div
        className="flex h-full w-full touch-none items-center justify-center overflow-hidden p-4"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        onClick={(event) => {
          if (event.target === event.currentTarget) onClose();
        }}
      >
        <img
          src={src}
          alt={alt || "Generated image"}
          draggable={false}
          onClick={onImageClick}
          className="max-h-full max-w-full select-none rounded-lg object-contain"
          style={{ transform: `translate(${view.x}px, ${view.y}px) scale(${view.scale})`, touchAction: "none" }}
        />
      </div>
    </div>
  );
}

function OutputView({
  piece,
  alt,
  fileName,
}: {
  piece: OutputPiece;
  alt: string;
  fileName?: string;
}) {
  const [broken, setBroken] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [open, setOpen] = useState(false);
  const [copiedText, setCopiedText] = useState(false);

  if (piece.kind === "text") {
    return (
      <div className="relative rounded-xl border border-border bg-bg/70 p-4">
        <button
          type="button"
          onClick={() => {
            void navigator.clipboard.writeText(piece.text).then(() => {
              setCopiedText(true);
              window.setTimeout(() => setCopiedText(false), 1200);
            });
          }}
          className="btn btn-secondary absolute right-3 top-3 h-7 px-2.5 text-xs"
        >
          {copiedText ? <Check className="size-3 text-success" /> : <Copy className="size-3" />}
          {copiedText ? "Copied" : "Copy"}
        </button>
        <pre className="max-h-96 overflow-auto whitespace-pre-wrap pr-16 font-sans text-sm leading-relaxed text-fg">
          {piece.text}
        </pre>
      </div>
    );
  }

  if (piece.kind === "file" || broken) {
    const url = piece.url;
    const label = piece.kind === "file" ? piece.label : "Open generated asset";
    return (
      <a
        href={url}
        target="_blank"
        rel="noopener noreferrer"
        className="flex items-center justify-between gap-3 rounded-xl border border-border bg-surface-2/60 px-4 py-3 text-sm text-fg transition-colors hover:border-border-strong hover:bg-surface-2"
      >
        <span className="truncate font-medium">{label}</span>
        <span className="inline-flex items-center gap-1.5 text-xs font-medium text-primary">
          Open asset <ExternalLink className="size-3.5" aria-hidden="true" />
        </span>
      </a>
    );
  }

  return (
    <figure className="space-y-2">
      {piece.kind === "image" ? (
        <>
          <div className="group relative overflow-hidden rounded-xl border border-border bg-bg/80">
            {!loaded ? (
              <div className="skeleton h-64 w-full" aria-hidden="true" />
            ) : null}
            <button
              type="button"
              onClick={() => setOpen(true)}
              aria-label="Open full size"
              className="block w-full"
            >
              <img
                ref={(el) => {
                  if (el?.complete && el.naturalWidth > 0 && !loaded) setLoaded(true);
                }}
                src={piece.url}
                alt={alt || "Generated image"}
                decoding="async"
                onLoad={() => setLoaded(true)}
                onError={() => setBroken(true)}
                className={`max-h-[34rem] w-full cursor-zoom-in object-contain transition-opacity duration-200 ${
                  loaded ? "opacity-100" : "h-0 opacity-0"
                }`}
              />
            </button>
            <button
              type="button"
              onClick={() => setOpen(true)}
              aria-label="Inspect full size"
              className="pointer-events-none absolute right-2.5 top-2.5 inline-flex size-8 items-center justify-center rounded-lg border border-white/15 bg-black/65 text-white opacity-0 backdrop-blur-xs transition-opacity group-hover:opacity-100"
            >
              <Maximize2 className="size-3.5" aria-hidden="true" />
            </button>
          </div>
          {open ? (
            <FullscreenImage
              src={piece.url}
              alt={alt || "Generated image"}
              fileName={fileName}
              onClose={() => setOpen(false)}
            />
          ) : null}
        </>
      ) : null}
      {piece.kind === "video" ? (
        <video
          src={piece.url}
          controls
          playsInline
          className="max-h-[34rem] w-full rounded-xl border border-border bg-black"
          onError={() => setBroken(true)}
        />
      ) : null}
      {piece.kind === "audio" ? (
        <div className="rounded-xl border border-border bg-bg/70 p-3">
          <audio src={piece.url} controls className="w-full" onError={() => setBroken(true)} />
        </div>
      ) : null}
    </figure>
  );
}

function ResultActions({
  promptText,
  seed,
  downloadUrl,
  downloadName: fileName,
  onUseImage,
  onRerun,
  onDelete,
  onUseSeed,
}: {
  promptText: string;
  seed: string;
  downloadUrl: string;
  downloadName: string;
  onUseImage?: () => void;
  onRerun: () => void;
  onDelete: () => void;
  onUseSeed: (seed: string) => void;
}) {
  const [copied, setCopied] = useState(false);
  const [saving, setSaving] = useState(false);
  const [used, setUsed] = useState(false);

  return (
    <div className="flex flex-wrap items-center gap-1.5 pt-1">
      <button
        type="button"
        onClick={() => {
          void navigator.clipboard.writeText(promptText).then(() => {
            setCopied(true);
            window.setTimeout(() => setCopied(false), 1200);
          });
        }}
        className="chip h-8 px-2.5 text-xs"
      >
        {copied ? <Check className="size-3.5 text-success" /> : <Copy className="size-3.5" />}
        <span>{copied ? "Copied" : "Copy prompt"}</span>
      </button>

      {downloadUrl ? (
        <button
          type="button"
          disabled={saving}
          onClick={() => {
            setSaving(true);
            void downloadFile(downloadUrl, fileName).finally(() => setSaving(false));
          }}
          className="chip h-8 px-2.5 text-xs disabled:opacity-50"
        >
          {saving ? (
            <Loader2 className="size-3.5 animate-spin" aria-hidden="true" />
          ) : (
            <Download className="size-3.5" aria-hidden="true" />
          )}
          <span>{saving ? "Saving…" : "Download"}</span>
        </button>
      ) : null}

      {onUseImage ? (
        <button
          type="button"
          title="Use this image as a reference"
          onClick={() => {
            onUseImage();
            setUsed(true);
            window.setTimeout(() => setUsed(false), 1200);
          }}
          className="chip h-8 px-2.5 text-xs"
        >
          {used ? <Check className="size-3.5 text-success" /> : <ImagePlus className="size-3.5" />}
          <span>{used ? "Added" : "Reference"}</span>
        </button>
      ) : null}

      {seed ? (
        <button
          type="button"
          onClick={() => onUseSeed(seed)}
          title={`Lock seed ${seed}`}
          className="chip h-8 px-2.5 font-mono text-xs"
        >
          <Hash className="size-3" aria-hidden="true" />
          <span>{seed.slice(0, 8)}</span>
        </button>
      ) : null}

      <button type="button" onClick={onRerun} className="chip h-8 px-2.5 text-xs">
        <RotateCcw className="size-3.5" aria-hidden="true" />
        <span>Rerun</span>
      </button>

      <button
        type="button"
        onClick={onDelete}
        className="chip ml-auto h-8 px-2.5 text-xs text-muted hover:border-danger/40 hover:bg-danger-bg/60 hover:text-danger"
        aria-label="Delete result"
      >
        <Trash2 className="size-3.5" aria-hidden="true" />
        <span className="hidden sm:inline">Delete</span>
      </button>
    </div>
  );
}

export function RunPanel({
  run,
  recipe,
  running,
  notice,
  alt,
  onStop,
  onRerun,
  onDelete,
  onUseSeed,
  onUseImage,
  onSelectPrompt,
  startedAt,
}: {
  run: RunSnapshot | null;
  recipe: RunRecipe | null;
  running: boolean;
  notice: Notice;
  alt: string;
  onStop: () => void;
  onRerun: () => void;
  onDelete: (index: number) => void;
  onUseSeed: (seed: string) => void;
  onUseImage: (url: string) => void;
  onSelectPrompt?: (prompt: string) => void;
  startedAt?: number;
}) {
  if (!run) return null;
  const waiting = running && run.pieces.length === 0;
  const progress = run.progress != null ? Math.max(0, Math.min(100, run.progress)) : null;
  const seed = seedOf(run, recipe);

  return (
    <article
      className="card cv-auto flex flex-col gap-3 p-4 shadow-lift animate-rise"
      aria-live="polite"
    >
      {/* Card Header: Model, Chips, Status, Cost */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex min-w-0 flex-wrap items-center gap-1.5">
          {recipe ? (
            <span className="inline-flex h-6 max-w-[14rem] items-center gap-1.5 rounded-md border border-border bg-surface-2 px-2 text-xs font-medium text-fg">
              <CompanyLogo name={recipe.company} compact />
              <span className="truncate">{recipe.modelName}</span>
            </span>
          ) : null}
          {recipe?.chips.map((chip) => (
            <span
              key={chip}
              className="inline-flex h-6 items-center rounded-md bg-white/[0.04] px-2 font-mono text-[11px] text-muted"
            >
              {chip}
            </span>
          ))}
        </div>

        <div className="flex items-center gap-2 text-xs tabular-nums">
          <span
            className={`inline-flex items-center gap-1.5 font-mono text-[11px] ${
              run.status === "failed"
                ? "text-danger"
                : running
                  ? "text-primary"
                  : "text-muted"
            }`}
          >
            {running ? (
              <Loader2 className="size-3 animate-spin text-primary" aria-hidden="true" />
            ) : (
              <span
                className={`size-1.5 rounded-full ${
                  run.status === "failed"
                    ? "bg-danger"
                    : run.status === "completed"
                      ? "bg-success"
                      : "bg-faint"
                }`}
                aria-hidden="true"
              />
            )}
            {statusLabel(run.status)}
          </span>

          <TookLabel running={running} startedAt={startedAt} took={run.took} />

          {run.cost != null && run.cost > 0 ? (
            <span className="rounded-md bg-white/[0.05] px-1.5 py-0.5 font-mono text-[11px] text-fg-soft">
              {formatUsd(run.cost)}
            </span>
          ) : null}

          {running ? (
            <button
              type="button"
              onClick={onStop}
              className="btn btn-secondary h-7 px-2.5 text-xs text-fg"
            >
              <Square className="size-2.5 fill-current" aria-hidden="true" />
              Stop
            </button>
          ) : null}
        </div>
      </div>

      {/* Prompt */}
      {recipe?.prompt ? (
        <p
          onClick={() => onSelectPrompt?.(recipe.prompt)}
          className="cursor-pointer line-clamp-2 text-sm leading-relaxed text-fg-soft transition-colors hover:text-fg"
          title="Click to load prompt into composer"
        >
          {recipe.prompt}
        </p>
      ) : null}

      {/* Progress bar */}
      {progress != null && running ? (
        <div className="h-1 overflow-hidden rounded-full bg-surface-2" aria-hidden="true">
          <div
            className="h-full bg-primary transition-[width] duration-300"
            style={{ width: `${progress}%` }}
          />
        </div>
      ) : waiting ? (
        <div className="h-1 overflow-hidden rounded-full bg-surface-2" aria-hidden="true">
          <div className="h-full w-1/2 bg-primary animate-indeterminate" />
        </div>
      ) : null}

      <NoticeBlock notice={notice} />

      {run.error && run.status === "failed" ? (
        <div className="flex items-center justify-between gap-3 rounded-xl border border-danger/25 bg-danger-bg/60 px-3.5 py-2.5 text-xs text-danger">
          <span>{run.error}</span>
          <div className="flex shrink-0 items-center gap-1.5">
            {recipe ? (
              <button type="button" onClick={onRerun} className="btn btn-secondary h-7 px-2.5 text-xs">
                <RotateCcw className="size-3" />
                Retry
              </button>
            ) : null}
            <button
              type="button"
              onClick={() => onDelete(0)}
              className="btn btn-ghost h-7 px-2 text-xs text-muted hover:text-danger"
              aria-label="Dismiss failed run"
            >
              <Trash2 className="size-3.5" />
            </button>
          </div>
        </div>
      ) : null}

      {waiting ? (
        <div
          className="skeleton max-h-[26rem] w-full rounded-xl border border-border"
          style={{ aspectRatio: recipeAspect(recipe) }}
          aria-hidden="true"
        />
      ) : null}

      {run.pieces.length > 0 ? (
        <div className="space-y-4">
          {run.pieces.map((piece, index) => {
            const fileName =
              recipe && piece.kind !== "text" ? downloadName(recipe, piece.url, index) : undefined;
            return (
              <div key={`${piece.kind}-${index}`} className="space-y-2.5">
                <OutputView piece={piece} alt={alt} fileName={fileName} />
                {recipe ? (
                  <ResultActions
                    promptText={recipe.prompt}
                    seed={seed}
                    downloadUrl={piece.kind === "text" ? "" : piece.url}
                    downloadName={fileName ?? "output"}
                    onRerun={onRerun}
                    onDelete={() => onDelete(index)}
                    onUseSeed={onUseSeed}
                    onUseImage={piece.kind === "image" ? () => onUseImage(piece.url) : undefined}
                  />
                ) : null}
              </div>
            );
          })}
        </div>
      ) : run.status === "completed" ? (
        <div className="flex items-center justify-between gap-3 rounded-xl border border-border bg-surface-2/40 px-3.5 py-2.5 text-xs text-muted">
          <span>Run completed, but the provider returned no media output.</span>
          <button
            type="button"
            onClick={() => onDelete(0)}
            className="btn btn-ghost h-7 px-2 text-xs"
          >
            Dismiss
          </button>
        </div>
      ) : null}
    </article>
  );
}
