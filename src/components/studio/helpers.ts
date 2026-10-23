import { AudioLines, Box, Image as ImageIcon, Play, Type } from "lucide-react";
import { isMediaParam, type FloraModel, type GenType, type ModelParam, type ParamDraft, type RunSnapshot } from "@/lib/flora";

export const TYPES: { id: GenType; label: string; icon: typeof ImageIcon; placeholder: string }[] = [
  { id: "image", label: "Image", icon: ImageIcon, placeholder: "Describe the image you want to create…" },
  { id: "video", label: "Video", icon: Play, placeholder: "Describe the shot, motion and mood…" },
  { id: "audio", label: "Audio", icon: AudioLines, placeholder: "Describe the sound, music or voice…" },
  { id: "text", label: "Text", icon: Type, placeholder: "What should the text say?" },
  { id: "model3d", label: "3D", icon: Box, placeholder: "Describe the 3D object…" },
];

export const TYPE_ORDER: GenType[] = ["image", "video", "audio", "text", "model3d"];

export const THREADS_KEY = "flora.threads.v1";
export const PINS_KEY = "flora.pins.v1";
export const SPEND_WARN = 0.5;

export type Notice = { message: string; cors: boolean } | null;

export type RunRecipe = {
  prompt: string;
  modelId: string;
  modelName: string;
  company: string;
  type: GenType;
  params: Record<string, unknown>;
  draft: Record<string, ParamDraft>;
  chips: string[];
  quotedCost?: number | null;
};

export type HistoryItem = {
  id: string;
  title: string;
  typeLabel: string;
  status: string;
  cost: number | null;
  at: number;
  snap: RunSnapshot;
  recipe?: RunRecipe;
};

export type ThreadEntry = {
  id: string;
  recipe: RunRecipe | null;
  snap: RunSnapshot;
  startedAt?: number;
};

export type SavedThread = {
  id: string;
  title: string;
  updatedAt: number;
  entries: ThreadEntry[];
};

export function isGenType(value: string): value is GenType {
  return (TYPE_ORDER as string[]).includes(value);
}

export function recipeVariant(base: RunRecipe, index: number): RunRecipe {
  if (index === 0) return base;
  const params = { ...base.params };
  const draft = { ...base.draft };
  for (const key of Object.keys(params)) {
    if (!/seed/i.test(key)) continue;
    const value = params[key];
    const num = typeof value === "number" ? value : typeof value === "string" && /^-?\d+$/.test(value) ? Number(value) : null;
    if (num == null) continue;
    params[key] = num + index;
    draft[key] = String(num + index);
  }
  return { ...base, params, draft };
}

export function emptySnap(): RunSnapshot {
  return { status: "pending", progress: null, cost: null, eta: null, runId: "", pieces: [], error: "", raw: null };
}

export function slimEntry(entry: ThreadEntry): ThreadEntry {
  return { ...entry, snap: { ...entry.snap, raw: null } };
}

export function statusLabel(status: string) {
  if (status === "pending") return "Queued";
  if (status === "running") return "Generating";
  if (status === "completed") return "Completed";
  if (status === "failed") return "Failed";
  return status || "Waiting";
}

export function formatTook(seconds: number): string {
  const whole = Math.max(0, Math.round(seconds));
  if (whole < 60) return `${whole}s`;
  const minutes = Math.floor(whole / 60);
  const rest = whole % 60;
  return rest ? `${minutes}m ${rest}s` : `${minutes}m`;
}

export function withTook(snap: RunSnapshot, startedAt: number): RunSnapshot {
  if (snap.took != null) return snap;
  if (snap.status !== "completed" && snap.status !== "failed") return snap;
  return { ...snap, took: Math.max(1, Math.round((Date.now() - startedAt) / 1000)) };
}

export function formatEta(seconds: number | null): string {
  if (seconds == null || !Number.isFinite(seconds) || seconds <= 0) return "";
  if (seconds < 60) return `${Math.round(seconds)}s`;
  return `${Math.max(1, Math.round(seconds / 60))}m`;
}

export function relativeTime(at: number): string {
  const diff = Math.max(0, Date.now() - at);
  const minutes = Math.round(diff / 60000);
  if (minutes < 1) return "Just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.round(hours / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(at).toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

export function draftText(value: ParamDraft | undefined): string {
  return typeof value === "string" ? value : "";
}

export function draftList(value: ParamDraft | undefined): string[] {
  return Array.isArray(value) ? value : [];
}

export function acceptFor(param: ModelParam): string {
  const name = param.name.toLowerCase();
  if (name.includes("video")) return "video/*";
  if (name.includes("audio")) return "audio/*";
  if (name.includes("image") || name.includes("frame") || name.includes("mask")) return "image/*";
  return "image/*,video/*,audio/*";
}

function optionIsRatio(value: string, label: string): boolean {
  if (/(\d+(?:\.\d+)?)\s*[:/]\s*(\d+(?:\.\d+)?)/.test(`${label} ${value}`)) return true;
  return /^(square|landscape|portrait)(_|$)/i.test(value);
}

export function isAspectParam(param: ModelParam): boolean {
  if (/aspect/i.test(`${param.name} ${param.label}`)) return true;
  if (!param.options.length || /resolution/i.test(`${param.name} ${param.label}`)) return false;
  const ratios = param.options.filter((option) => optionIsRatio(option.value, option.label)).length;
  return ratios >= Math.max(2, Math.ceil(param.options.length * 0.6));
}

export function isResolutionParam(param: ModelParam): boolean {
  if (!param.options.length || isAspectParam(param)) return false;
  const blob = `${param.name} ${param.label}`;
  if (/resolution|image_size/i.test(blob)) return true;
  return param.options.some((option) => /\d\s*k/i.test(`${option.value} ${option.label}`));
}

export function isCountParam(param: ModelParam): boolean {
  return /count|variation|num_image|n_images|batch|quantity/i.test(`${param.name} ${param.label}`);
}

export function isDurationParam(param: ModelParam): boolean {
  return /duration/i.test(`${param.name} ${param.label}`) && param.options.length > 0;
}

export function durationLabel(value: string, label: string): string {
  if (/auto/i.test(`${value} ${label}`)) return "Auto";
  const seconds = `${label} ${value}`.match(/(\d+(?:\.\d+)?)/);
  return seconds ? `${seconds[1].replace(/\.0$/, "")}s` : label || value;
}

export function isQualityParam(param: ModelParam): boolean {
  if (isAspectParam(param) || isResolutionParam(param) || isDurationParam(param) || isCountParam(param) || isMediaParam(param)) return false;
  if (!/quality|thinking|reasoning/i.test(`${param.name} ${param.label}`)) return false;
  return param.type === "bool" || param.options.length > 0;
}

/** Params that get a dedicated chip in the composer (everything else lives in Advanced). */
export function isChipParam(param: ModelParam): boolean {
  return (
    isMediaParam(param) ||
    isAspectParam(param) ||
    isResolutionParam(param) ||
    isDurationParam(param) ||
    isCountParam(param) ||
    isQualityParam(param)
  );
}

export function ratioOf(value: string, label: string): { w: number; h: number; text: string } {
  const labeled = label.match(/(\d+(?:\.\d+)?)\s*[:/]\s*(\d+(?:\.\d+)?)/);
  const inline = labeled ?? value.match(/(\d+(?:\.\d+)?)\s*[:/]\s*(\d+(?:\.\d+)?)/);
  if (inline) {
    const w = inline[1].replace(/\.0$/, "");
    const h = inline[2].replace(/\.0$/, "");
    return { w: Number(w), h: Number(h), text: `${w}:${h}` };
  }
  const named = value.match(/^(square|landscape|portrait)_(\d+)_(\d+)$/i);
  if (named) {
    let w = Number(named[2]);
    let h = Number(named[3]);
    if (/^portrait$/i.test(named[1]) && w > h) [w, h] = [h, w];
    if (/^landscape$/i.test(named[1]) && h > w) [w, h] = [h, w];
    return { w, h, text: `${w}:${h}` };
  }
  if (/auto/i.test(`${value} ${label}`)) return { w: 3, h: 4, text: "Auto" };
  return { w: 1, h: 1, text: label || value };
}

export function shortSetting(value: string, label: string): string {
  const kilo = `${value} ${label}`.match(/(\d+(?:\.\d+)?)\s*k/i);
  if (kilo) return `${kilo[1].replace(/\.0$/, "")}K`;
  const ratio = ratioOf(value, label);
  if (/\d/.test(ratio.text) || ratio.text === "Auto") return ratio.text;
  return (label || value).replace(/\s*\([^)]*\)\s*/g, "").trim() || value;
}

export function countSteps(param: ModelParam): string[] {
  if (param.options.length) return param.options.map((option) => option.value);
  const min = Math.round(param.min ?? 1);
  const max = Math.min(Math.round(param.max ?? 8), min + 15);
  const steps: string[] = [];
  for (let n = min; n <= max; n += 1) steps.push(String(n));
  return steps.length ? steps : ["1"];
}

export function settingChips(model: FloraModel | null, draft: Record<string, ParamDraft>): string[] {
  if (!model) return [];
  const chips: string[] = [];
  for (const param of model.params) {
    if (isMediaParam(param)) continue;
    const raw = draft[param.name];
    if (typeof raw === "string" && raw.trim()) {
      const label = param.options.find((option) => option.value === raw)?.label;
      chips.push(shortSetting(raw, label || raw));
    } else if (raw === true) {
      chips.push(param.label || param.name);
    }
  }
  return chips.slice(0, 3);
}

/** CSS aspect-ratio for a recipe's chosen aspect chip, used to size loading placeholders. */
export function recipeAspect(recipe: RunRecipe | null): string {
  if (!recipe) return "1 / 1";
  for (const chip of recipe.chips) {
    const match = chip.match(/^(\d+(?:\.\d+)?):(\d+(?:\.\d+)?)$/);
    if (match) return `${match[1]} / ${match[2]}`;
  }
  if (recipe.type === "video") return "16 / 9";
  return "1 / 1";
}

type Dictation = {
  lang: string;
  start: () => void;
  onresult: ((event: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void) | null;
};

type DictationHost = Window & {
  SpeechRecognition?: new () => Dictation;
  webkitSpeechRecognition?: new () => Dictation;
};

export function dictationSupported(): boolean {
  if (typeof window === "undefined") return false;
  const host = window as DictationHost;
  return Boolean(host.SpeechRecognition ?? host.webkitSpeechRecognition);
}

export function startDictation(onText: (text: string) => void): boolean {
  const host = window as DictationHost;
  const Ctor = host.SpeechRecognition ?? host.webkitSpeechRecognition;
  if (!Ctor) return false;
  const rec = new Ctor();
  rec.lang = "en-US";
  rec.onresult = (event) => {
    const text = event.results?.[0]?.[0]?.transcript?.trim();
    if (text) onText(text);
  };
  rec.start();
  return true;
}

function readSeedValue(value: unknown): string {
  if (typeof value === "number" && Number.isFinite(value)) return String(Math.trunc(value));
  if (typeof value === "string" && /^-?\d+$/.test(value.trim())) return value.trim();
  return "";
}

function findSeed(node: unknown, depth = 0): string {
  if (node == null || depth > 6) return "";
  if (Array.isArray(node)) {
    for (const item of node) {
      const found = findSeed(item, depth + 1);
      if (found) return found;
    }
    return "";
  }
  if (typeof node !== "object") return "";
  const record = node as Record<string, unknown>;
  for (const [key, value] of Object.entries(record)) {
    if (/seed/i.test(key)) {
      const found = readSeedValue(value);
      if (found) return found;
    }
  }
  for (const value of Object.values(record)) {
    if (value && typeof value === "object") {
      const found = findSeed(value, depth + 1);
      if (found) return found;
    }
  }
  return "";
}

export function seedOf(run: RunSnapshot | null, recipe: RunRecipe | null): string {
  const fromRun = findSeed(run?.raw ?? null);
  if (fromRun) return fromRun;
  if (!recipe) return "";
  for (const [key, value] of Object.entries(recipe.params)) {
    if (!/seed/i.test(key)) continue;
    const found = readSeedValue(value);
    if (found) return found;
  }
  return "";
}

function safeFilePart(value: string): string {
  return value
    .replace(/:/g, "x")
    .replace(/[\\/:*?"<>|\u0000-\u001f]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function downloadName(recipe: RunRecipe, url: string, index: number): string {
  const path = url.split("?")[0].split("#")[0];
  const found = path.match(/\.([a-z0-9]{2,5})$/i)?.[1]?.toLowerCase();
  const ext = found || (recipe.type === "video" ? "mp4" : recipe.type === "audio" ? "mp3" : recipe.type === "model3d" ? "glb" : "png");
  const parts = [recipe.modelName, ...recipe.chips].map(safeFilePart).filter(Boolean);
  let base = parts.join(" ").slice(0, 140).trim() || "image";
  if (index > 0) base = `${base} ${index + 1}`;
  return `${base}.${ext}`;
}

export async function downloadFile(url: string, fileName: string): Promise<void> {
  const href = `/api/flora-file?url=${encodeURIComponent(url)}&name=${encodeURIComponent(fileName)}`;
  try {
    const response = await fetch(href);
    if (!response.ok) throw new Error("download failed");
    const blob = await response.blob();
    const objectUrl = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = objectUrl;
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(objectUrl);
  } catch {
    window.open(url, "_blank", "noopener,noreferrer");
  }
}

const BASE_URL = (import.meta.env?.BASE_URL || "/").replace(/\/$/, "");

export const COMPANY_LOGOS: Record<string, string> = {
  Google: `${BASE_URL}/company-logos/google.png`,
  OpenAI: `${BASE_URL}/company-logos/openai.png`,
  xAI: `${BASE_URL}/company-logos/xai.png`,
  "Black Forest Labs": `${BASE_URL}/company-logos/black-forest-labs.png`,
  Bytedance: `${BASE_URL}/company-logos/bytedance.png`,
  Alibaba: `${BASE_URL}/company-logos/alibaba-qwen-wan.png`,
  Anthropic: `${BASE_URL}/company-logos/anthropic-claude.png`,
  Ideogram: `${BASE_URL}/company-logos/ideogram.png`,
  Luma: `${BASE_URL}/company-logos/luma-labs.png`,
  Recraft: `${BASE_URL}/company-logos/recraft.png`,
  Kling: `${BASE_URL}/company-logos/kling.png`,
  MiniMax: `${BASE_URL}/company-logos/hailuo.png`,
  Runway: `${BASE_URL}/company-logos/runway.png`,
  "Stability AI": `${BASE_URL}/company-logos/stability-ai.png`,
  Sourceful: `${BASE_URL}/company-logos/sourceful.png`,
  QuiverAI: `${BASE_URL}/company-logos/quiver-ai.png`,
  Pika: `${BASE_URL}/company-logos/pika.png`,
  Lightricks: `${BASE_URL}/company-logos/lightricks.png`,
  Topaz: `${BASE_URL}/company-logos/topaz.png`,
  Magnific: `${BASE_URL}/company-logos/magnific.png`,
  ElevenLabs: `${BASE_URL}/company-logos/elevenlabs.png`,
  Meta: `${BASE_URL}/company-logos/meta.png`,
  Tencent: `${BASE_URL}/company-logos/hunyuan.png`,
  Higgsfield: `${BASE_URL}/company-logos/higgsfield.png`,
  Reve: `${BASE_URL}/company-logos/reve.png`,
  Moonvalley: `${BASE_URL}/company-logos/moonvalley.png`,
  Enhancor: `${BASE_URL}/company-logos/enhancor.png`,
  Decart: `${BASE_URL}/company-logos/decart.png`,
  Bria: `${BASE_URL}/company-logos/bria.png`,
  VEED: `${BASE_URL}/company-logos/veed.png`,
  Sync: `${BASE_URL}/company-logos/sync.png`,
  Creatify: `${BASE_URL}/company-logos/creatify.png`,
  Mirelo: `${BASE_URL}/company-logos/mirelo.png`,
  BiRefNet: `${BASE_URL}/company-logos/remove-background.png`,
  Meshy: `${BASE_URL}/company-logos/meshy.png`,
  Hyper3D: `${BASE_URL}/company-logos/hyper3d.png`,
  Tripo: `${BASE_URL}/company-logos/tripo.png`,
  Hi3D: `${BASE_URL}/company-logos/hi3d.png`,
  Microsoft: `${BASE_URL}/company-logos/microsoft.png`,
};
