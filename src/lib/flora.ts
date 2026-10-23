export const FLORA_ORIGIN = "https://app.flora.ai";
export const FLORA_BASE = `${FLORA_ORIGIN}/api/v1`;

export const LS_KEY = "flora.apiKey";
export const LS_WS = "flora.workspaceId";
export const LS_PROJECT = "flora.projectId";

export type GenType = "image" | "video" | "audio" | "text" | "model3d";

export type Workspace = { id: string; name: string; role: string };
export type Project = { id: string; name: string };
export type ParamOption = { label: string; value: string };
export type ParamProperty = { name: string; min: number | null; max: number | null; defaultValue: number | null };
export type ModelParam = {
  name: string;
  type: string;
  required: boolean;
  label: string;
  description: string;
  defaultValue: unknown;
  min: number | null;
  max: number | null;
  options: ParamOption[];
  properties: ParamProperty[];
};
export type ParamDraft = string | boolean | string[] | Record<string, string>;
export type FloraModel = {
  id: string;
  name: string;
  type: string;
  provider: string;
  company: string;
  capabilities: string[];
  blurb: string;
  baseCost: number | null;
  credits: number | null;
  seconds: number | null;
  params: ModelParam[];
};
export type TechniqueInput = { id: string; name: string; type: string };
export type Technique = {
  id: string;
  slug: string;
  name: string;
  description: string;
  cost: number | null;
  inputs: TechniqueInput[];
};

export type OutputPiece =
  | { kind: "image" | "video" | "audio"; url: string }
  | { kind: "text"; text: string }
  | { kind: "file"; url: string; label: string };

export type RunSnapshot = {
  status: string;
  progress: number | null;
  cost: number | null;
  eta: number | null;
  runId: string;
  pieces: OutputPiece[];
  error: string;
  raw: unknown;
  took?: number | null;
};

export class FloraApiError extends Error {
  status: number;
  code: string;
  fields: { field: string; message: string }[];
  cors: boolean;
  constructor(
    message: string,
    info: { status: number; code: string; fields: { field: string; message: string }[]; cors: boolean },
  ) {
    super(message);
    this.name = "FloraApiError";
    this.status = info.status;
    this.code = info.code;
    this.fields = info.fields;
    this.cors = info.cors;
  }
}

export function normalizeApiKey(value: string): string {
  return value.replace(/\s+/g, "");
}

export function maskKey(key: string): string {
  if (key.length < 8) return "saved";
  return `${key.slice(0, 3)}…${key.slice(-4)}`;
}

export function formatUsd(value: number | null): string {
  if (value == null || !Number.isFinite(value)) return "—";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 4,
  }).format(value);
}

export function formatFloraError(error: unknown): { message: string; cors: boolean } {
  if (error instanceof Error && error.name === "AbortError") {
    return { message: "Stopped watching this run. It may still finish in Flora.", cors: false };
  }
  if (error instanceof FloraApiError) return { message: error.message, cors: error.cors };
  if (error instanceof Error && error.message) return { message: error.message, cors: false };
  return { message: "Something went wrong.", cors: false };
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
}

function str(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function readStrings(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  const values: string[] = [];
  for (const item of raw) {
    if (typeof item === "string" && item.trim()) values.push(item.trim());
    else {
      const record = asRecord(item);
      const label = str(record.name) || str(record.id) || str(record.label);
      if (label) values.push(label);
    }
  }
  return values;
}

function num(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim() && !Number.isNaN(Number(value))) return Number(value);
  return null;
}

function asList(data: unknown, keys: string[]): unknown[] {
  if (Array.isArray(data)) return data;
  const sources = [asRecord(data), asRecord(asRecord(data).data)];
  for (const source of sources) {
    for (const key of keys) if (Array.isArray(source[key])) return source[key] as unknown[];
    if (Array.isArray(source.data)) return source.data as unknown[];
  }
  return [];
}

function money(value: unknown): number | null {
  const direct = num(value);
  if (direct != null) return direct;
  const record = asRecord(value);
  return num(record.usd) ?? num(record.amount) ?? num(record.value) ?? num(record.estimated_cost) ?? null;
}

function costRoots(data: unknown): Record<string, unknown>[] {
  const root = asRecord(data);
  const roots = [
    root,
    asRecord(root.data),
    asRecord(root.quote),
    asRecord(root.usage),
    asRecord(root.billing),
    asRecord(root.result),
    asRecord(root.run),
    asRecord(root.generation),
  ];
  for (const list of [root.generations, root.runs, asRecord(root.data).generations]) {
    if (!Array.isArray(list)) continue;
    for (const item of list) roots.push(asRecord(item));
  }
  return roots;
}

const CHARGED_KEYS = [
  "charged_cost",
  "charged_cost_usd",
  "final_cost",
  "final_cost_usd",
  "actual_cost",
  "billed_cost",
  "billed_cost_usd",
];
const ESTIMATE_KEYS = [
  "estimated_cost",
  "estimated_cost_usd",
  "run_cost",
  "cost",
  "price",
  "price_usd",
  "total_cost",
  "total_cost_usd",
];

function firstPositive(roots: Record<string, unknown>[], keys: string[]): number | null {
  for (const source of roots) {
    for (const key of keys) {
      const value = money(source[key]);
      if (value != null && value > 0) return value;
    }
  }
  return null;
}

function deepPositiveCost(data: unknown): number | null {
  const seen = new Set<unknown>();
  const walk = (node: unknown, depth: number): number | null => {
    if (node == null || depth > 6 || typeof node !== "object") return null;
    if (seen.has(node)) return null;
    seen.add(node);
    if (Array.isArray(node)) {
      for (const item of node) {
        const found = walk(item, depth + 1);
        if (found != null) return found;
      }
      return null;
    }
    const source = node as Record<string, unknown>;
    for (const [key, value] of Object.entries(source)) {
      if (!/cost|price|billed|charged/i.test(key)) continue;
      const amount = money(value);
      if (amount != null && amount > 0) return amount;
    }
    for (const value of Object.values(source)) {
      if (value && typeof value === "object") {
        const found = walk(value, depth + 1);
        if (found != null) return found;
      }
    }
    return null;
  };
  return walk(data, 0);
}

export function hasChargedCost(data: unknown): boolean {
  return firstPositive(costRoots(data), CHARGED_KEYS) != null;
}

function readCost(data: unknown): number | null {
  const roots = costRoots(data);
  return firstPositive(roots, CHARGED_KEYS) ?? firstPositive(roots, ESTIMATE_KEYS) ?? deepPositiveCost(data);
}

function friendly(status: number, code: string, message: string): string {
  if (status === 401 || code === "invalid_api_key" || code === "unauthorized") {
    return "Invalid API key. Check the value, or regenerate it in Flora Settings → API Keys.";
  }
  if (status === 402 || code === "insufficient_credits") {
    return "Insufficient credits in this workspace. Add credits in Flora, then try again.";
  }
  if (status === 403 || code === "forbidden") {
    return "This API key can’t do that. Check its workspace permissions in Flora Settings → API Keys.";
  }
  if (status === 404) return message || "Flora couldn’t find that resource.";
  if (status === 405 || /<html|<!doctype/i.test(message)) {
    return "Couldn’t reach the Flora relay from this static host. Ensure the workspace relay is online.";
  }
  if (status === 429) return "Flora rate-limited this key. Wait a moment and try again.";
  return message || `Flora returned an error (${status || "network"}).`;
}

function parseErrorBody(data: unknown, status: number, requestId?: string | null): FloraApiError {
  const root = asRecord(data);
  const err = asRecord(root.error);
  const source = Object.keys(err).length ? err : root;
  const code = str(source.code) || String(status);
  let message = friendly(status, code, str(source.message) || str(root.message));
  const fields = Array.isArray(source.fields)
    ? source.fields.map((item) => {
        const field = asRecord(item);
        return { field: str(field.field) || "field", message: str(field.message) || "Invalid" };
      })
    : [];
  if (fields.length) message += ` ${fields.map((field) => `${field.field}: ${field.message}`).join(" ")}`;
  if (requestId) message += ` Request id: ${requestId}`;
  return new FloraApiError(message, { status, code, fields, cors: false });
}

let cachedRelayOrigin: string | null = null;

function getRelayCandidates(): string[] {
  const isStatic = import.meta.env?.VITE_STATIC_SITE === "true";
  const envRelay = String(import.meta.env?.VITE_RELAY_ORIGIN || "https://16493ec777f63a.lhr.life").replace(/\/$/, "");
  const list: string[] = [];
  if (cachedRelayOrigin !== null) list.push(cachedRelayOrigin);
  if (!isStatic && !list.includes("")) list.push("");
  if (envRelay && !list.includes(envRelay)) list.push(envRelay);
  if (!list.includes("http://127.0.0.1:8080")) list.push("http://127.0.0.1:8080");
  if (!list.includes("http://localhost:8080")) list.push("http://localhost:8080");
  if (isStatic && !list.includes("")) list.push("");
  return list;
}

export async function relayFetch(apiPath: string, init: RequestInit): Promise<Response> {
  const candidates = getRelayCandidates();
  let lastError: unknown = null;
  let lastResponse: Response | null = null;
  for (const origin of candidates) {
    try {
      const res = await fetch(`${origin}${apiPath}`, init);
      const ctype = (res.headers.get("content-type") || "").toLowerCase();
      // Static hosts (like GitHub Pages) return 404/405 text/html for POST /api/*
      if ((res.status === 404 || res.status === 405) && ctype.includes("text/html")) {
        lastResponse = res;
        continue;
      }
      cachedRelayOrigin = origin;
      return res;
    } catch (error) {
      if (error instanceof Error && error.name === "AbortError") throw error;
      lastError = error;
    }
  }
  if (lastResponse) return lastResponse;
  throw lastError ?? new Error("Relay unreachable");
}

export async function floraRequest(key: string, path: string, init: RequestInit = {}): Promise<unknown> {
  const url = path.startsWith("http") ? path : `${FLORA_BASE}${path.startsWith("/") ? path : `/${path}`}`;
  const parsed = new URL(url);
  if (parsed.origin !== FLORA_ORIGIN) {
    throw new FloraApiError("Refusing to call anything except Flora.", {
      status: 0,
      code: "bad_host",
      fields: [],
      cors: false,
    });
  }
  const headers = new Headers(init.headers);
  const method = (init.method || "GET").toUpperCase();
  let response: Response;
  try {
    response = await relayFetch("/api/flora", {
      method: "POST",
      signal: init.signal,
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({
        apiKey: key,
        path: `${parsed.pathname.slice("/api/v1".length)}${parsed.search}`,
        method,
        body: typeof init.body === "string" ? init.body : undefined,
        idempotencyKey: headers.get("Idempotency-Key") || undefined,
      }),
    });
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") throw error;
    throw new FloraApiError("Couldn’t reach this site’s Flora relay. Try again in a moment.", {
      status: 0,
      code: "network",
      fields: [],
      cors: false,
    });
  }
  const requestId = response.headers.get("flora-request-id");
  const text = await response.text();
  let data: unknown = null;
  if (text) {
    try {
      data = JSON.parse(text) as unknown;
    } catch {
      data = { message: text.slice(0, 400) };
    }
  }
  if (!response.ok) throw parseErrorBody(data, response.status, requestId);
  return data;
}

const COMPANY_HINTS: [RegExp, string][] = [
  [/aurora[- ]?avatar|\bboreal\b/i, "Creatify"],
  [/openai|gpt-|dall-?e|\bsora\b|openai-o3|o3[- ]deep/i, "OpenAI"],
  [/google|gemini|imagen|\bveo|nano[- ]?banana|deepmind|lyria|macaron/i, "Google"],
  [/anthropic|claude/i, "Anthropic"],
  [/alibaba|qwen|tongyi|\bwan[- ]?\d|happy[- ]?horse|z[- ]?image/i, "Alibaba"],
  [/black forest|\bbfl\b|\bflux\b/i, "Black Forest Labs"],
  [/byte\s?dance|seedream|seedance/i, "Bytedance"],
  [/ideogram/i, "Ideogram"],
  [/\bkrea\b/i, "Krea"],
  [/\bluma\b|uni[- ]?1/i, "Luma"],
  [/recraft/i, "Recraft"],
  [/kling/i, "Kling"],
  [/minimax|hailuo/i, "MiniMax"],
  [/runway/i, "Runway"],
  [/stability|stable[- ]?diffusion|animatediff|animate[- ]?diff/i, "Stability AI"],
  [/\bxai\b|\bgrok\b/i, "xAI"],
  [/sourceful|riverflow/i, "Sourceful"],
  [/quiver|\barrow\b/i, "QuiverAI"],
  [/\bpika\b/i, "Pika"],
  [/lightricks|\bltx\b/i, "Lightricks"],
  [/topaz/i, "Topaz"],
  [/magnific/i, "Magnific"],
  [/elevenlabs|11labs/i, "ElevenLabs"],
  [/\bmeta\b|\bllama\b|sam[- ]?3/i, "Meta"],
  [/mistral/i, "Mistral"],
  [/tencent|hunyuan/i, "Tencent"],
  [/bria|ad[- ]?delayer/i, "Bria"],
  [/birefnet|remove background/i, "BiRefNet"],
  [/\breve\b/i, "Reve"],
  [/patina/i, "Patina"],
  [/marey/i, "Moonvalley"],
  [/heygen|hey[- ]?gen/i, "HeyGen"],
  [/lucy[- ]?edit/i, "Decart"],
  [/mmaudio/i, "MMAudio"],
  [/mirelo/i, "Mirelo"],
  [/veed|fabric[- ]?1/i, "VEED"],
  [/lipsync|sync[- ]?3/i, "Sync"],
  [/ffmpeg|merge audio and video/i, "FFmpeg"],
  [/meshy/i, "Meshy"],
  [/rodin/i, "Hyper3D"],
  [/trellis/i, "Microsoft"],
  [/tripo/i, "Tripo"],
  [/hi3d|hitem/i, "Hi3D"],
  [/enhancor/i, "Enhancor"],
  [/suno/i, "Suno"],
  [/pixelcut/i, "Pixelcut"],
];

const DISTRIBUTORS = /^(fal(\.ai)?|generation[-_ ]?gateway|runware)$/i;

function matchCompany(blob: string): string | null {
  for (const [pattern, company] of COMPANY_HINTS) {
    if (pattern.test(blob)) return company;
  }
  return null;
}

export function companyName(name: string, id: string, provider: string): string {
  return (
    matchCompany(`${name} ${id}`) ||
    matchCompany(provider) ||
    (provider.trim() && !DISTRIBUTORS.test(provider.trim()) ? provider.trim() : "") ||
    "Other"
  );
}

function readProvider(raw: unknown): string {
  if (typeof raw === "string" && raw.trim()) return raw.trim();
  const nested = asRecord(raw);
  const label = str(nested.name) || str(nested.display_name) || str(nested.provider);
  return label;
}

function normalizeOptions(raw: unknown): ParamOption[] {
  if (!Array.isArray(raw)) return [];
  const options: ParamOption[] = [];
  for (const item of raw) {
    if (typeof item === "string" || typeof item === "number" || typeof item === "boolean") {
      const value = String(item);
      options.push({ label: value, value });
      continue;
    }
    const option = asRecord(item);
    const value = option.value == null ? str(option.id) : String(option.value);
    if (!value) continue;
    options.push({ label: str(option.label) || str(option.name) || value, value });
  }
  return options;
}

function normalizeProperties(raw: unknown): ParamProperty[] {
  const source = asRecord(raw);
  return Object.entries(source).map(([name, spec]) => {
    const property = asRecord(spec);
    return { name, min: num(property.min), max: num(property.max), defaultValue: num(property.default) };
  });
}

function normalizeParam(raw: unknown): ModelParam | null {
  const param = asRecord(raw);
  const name = str(param.name) || str(param.key) || str(param.id);
  if (!name) return null;
  const rawType = str(param.type) || "string";
  const lowered = rawType.toLowerCase();
  const options = normalizeOptions(param.options ?? param.enum ?? param.values);
  const boolish =
    options.length > 0 && options.every((option) => /^(true|false)$/i.test(option.value));
  const type = boolish
    ? "bool"
    : lowered === "string[]" || lowered.includes("array") || lowered === "images" || lowered === "image_urls"
      ? "string[]"
      : lowered.includes("url") || lowered === "image" || lowered === "video" || lowered === "audio"
        ? "string"
        : rawType;
  let defaultValue = param.default ?? null;
  if (type === "bool" && typeof defaultValue === "string") defaultValue = /^true$/i.test(defaultValue);
  return {
    name,
    type,
    required: param.required === true,
    label: str(param.label) || name.replace(/_/g, " "),
    description: str(param.description) || str(param.help),
    defaultValue,
    min: num(param.min),
    max: num(param.max),
    options: boolish ? [] : options,
    properties: normalizeProperties(param.properties),
  };
}

const JOB_RULES: [RegExp, string][] = [
  [/text[-_ ]to[-_ ]image|\bt2i\b/i, "text to image"],
  [/image[-_ ]to[-_ ]image|\bi2i\b|img2img/i, "image to image"],
  [/inpaint/i, "inpaint"],
  [/outpaint/i, "outpaint"],
  [/upscale|super[-_ ]?res/i, "upscale"],
  [/background[-_ ]?remov|remove[-_ ]?bg/i, "remove background"],
  [/\bedit\b|editing/i, "edits an image"],
  [/text[-_ ]to[-_ ]video|\bt2v\b/i, "text to video"],
  [/image[-_ ]to[-_ ]video|\bi2v\b/i, "image to video"],
  [/video[-_ ]to[-_ ]video|\bv2v\b/i, "video to video"],
  [/text[-_ ]to[-_ ]speech|\btts\b/i, "text to speech"],
  [/speech[-_ ]to[-_ ]text|\bstt\b|transcri/i, "speech to text"],
  [/text[-_ ]to[-_ ]audio|\bt2a\b/i, "text to audio"],
  [/audio[-_ ]to[-_ ]audio|\ba2a\b/i, "audio to audio"],
  [/image[-_ ]to[-_ ]text|\bvision\b/i, "reads an image"],
];

function jobsFrom(blob: string): string[] {
  const hits: string[] = [];
  for (const [pattern, label] of JOB_RULES) {
    if (pattern.test(blob) && !hits.includes(label)) hits.push(label);
  }
  return hits;
}

export function modelBlurb(id: string, capabilities: string[], params: ModelParam[]): string {
  const hasImage = params.some((param) => isMediaParam(param) && /image/i.test(param.name));
  const hasVideo = params.some((param) => isMediaParam(param) && /video/i.test(param.name));
  const hasAudio = params.some((param) => isMediaParam(param) && /audio/i.test(param.name));
  const kinds = [hasImage ? "image" : "", hasVideo ? "video" : "", hasAudio ? "audio" : ""].filter(Boolean);
  if (kinds.length > 1) return kinds.join(" + ");
  const fromCaps = jobsFrom(capabilities.join(" "));
  if (fromCaps.length) return fromCaps.slice(0, 2).join(", ");
  const fromId = jobsFrom(id.replace(/[-_]/g, " "));
  if (fromId.length) return fromId.slice(0, 2).join(", ");
  if (hasImage) return "image only";
  if (hasVideo) return "video only";
  if (hasAudio) return "audio only";
  return "";
}

function inputHint(params: ModelParam[]): string {
  const bits: string[] = [];
  if (params.some((param) => isMediaParam(param) && /image/i.test(param.name))) bits.push("image input");
  if (params.some((param) => isMediaParam(param) && /video/i.test(param.name))) bits.push("video input");
  if (params.some((param) => isMediaParam(param) && /audio/i.test(param.name))) bits.push("audio input");
  if (params.some((param) => /resolution|width|height/i.test(param.name))) bits.push("size");
  if (params.some((param) => /aspect/i.test(param.name))) bits.push("aspect");
  if (params.some((param) => /duration/i.test(param.name))) bits.push("duration");
  return bits.join(", ");
}

export function modelAside(model: FloraModel, peers: FloraModel[]): string {
  const twins = peers.filter((item) => item.name === model.name);
  const hint = inputHint(model.params);
  const lead = [model.blurb, twins.length > 1 ? hint : ""].filter(Boolean).join(" · ");
  if (twins.length < 2) return model.blurb || hint;
  const signature = `${model.blurb}|${hint}|${model.provider}`;
  const same = twins.filter((item) => `${item.blurb}|${inputHint(item.params)}|${item.provider}` === signature);
  if (same.length < 2) return lead || model.id;
  return [lead, model.id].filter(Boolean).join(" · ");
}

export function sameNameVariants(models: FloraModel[], model: FloraModel): FloraModel[] {
  return models.filter(
    (item) => item.type === model.type && item.company === model.company && item.name === model.name,
  );
}

export function imageSlots(model: FloraModel): number {
  let slots = 0;
  for (const param of model.params) {
    if (!isMediaParam(param) || !/image/i.test(`${param.name} ${param.label}`)) continue;
    slots += param.type === "string[]" ? (param.max ?? 14) : 1;
  }
  return slots;
}

export function variantForImageCount(variants: FloraModel[], count: number): FloraModel | null {
  if (!variants.length) return null;
  const index = Math.min(Math.max(0, count), variants.length - 1);
  return variants[index] ?? variants[0];
}

export function applyHeldImages(
  model: FloraModel,
  images: string[],
  previous: Record<string, ParamDraft>,
): Record<string, ParamDraft> {
  const draft = draftFromDefaults(model);
  for (const param of model.params) {
    if (isMediaParam(param)) continue;
    if (previous[param.name] !== undefined) draft[param.name] = previous[param.name];
  }
  const imageParams = model.params.filter(
    (param) => isMediaParam(param) && /image/i.test(`${param.name} ${param.label}`),
  );
  const arrayParam = imageParams.find((param) => param.type === "string[]");
  const single = imageParams.find((param) => param.type !== "string[]");
  if (arrayParam && images.length) {
    draft[arrayParam.name] = images.slice(0, arrayParam.max ?? 14);
  } else if (single && images[0]) {
    draft[single.name] = images[0];
  }
  return draft;
}

export function isMediaParam(param: ModelParam): boolean {
  if (param.options.length) return false;
  if (param.type !== "string" && param.type !== "string[]") return false;
  const name = param.name.toLowerCase();
  const setting = /(aspect|ratio|resolution|quality|seed|duration|prompt|style|count|batch|num_|mode|size)/.test(name);
  const explicitMedia = /(image_url|video_url|audio_url|image_urls|video_urls|audio_urls|^images$|^image$|frames|reference)/.test(name);
  if (setting && !explicitMedia) return false;
  return explicitMedia || /(image|video|audio|frame|mask|media|init_)/.test(name) || name.endsWith("_url") || name.endsWith("_urls");
}

export function draftFromDefaults(model: FloraModel): Record<string, ParamDraft> {
  const draft: Record<string, ParamDraft> = {};
  for (const param of model.params) {
    const value = param.defaultValue;
    if (value == null || value === "") continue;
    if (isMediaParam(param)) continue;
    if (param.type === "bool") {
      draft[param.name] = value === true || value === "true";
      continue;
    }
    if (param.type === "dict" && value && typeof value === "object" && !Array.isArray(value)) {
      const fields: Record<string, string> = {};
      for (const [key, field] of Object.entries(value as Record<string, unknown>)) {
        if (field == null || field === "") continue;
        fields[key] = String(field);
      }
      if (Object.keys(fields).length) draft[param.name] = fields;
      continue;
    }
    if (param.type === "string[]" && Array.isArray(value)) {
      const items = value.map((item) => String(item)).filter(Boolean);
      if (items.length) draft[param.name] = items;
      continue;
    }
    draft[param.name] = String(value);
  }
  return draft;
}

function coerceParam(param: ModelParam, raw: ParamDraft | undefined): unknown {
  if (raw == null || raw === "") return undefined;
  if (param.type === "bool") return raw === true || raw === "true";
  if (param.type === "string[]") {
    const items = (Array.isArray(raw) ? raw : String(raw).split("\n")).map((item) => item.trim()).filter(Boolean);
    return items.length ? items : undefined;
  }
  if (param.type === "dict") {
    if (typeof raw !== "object" || Array.isArray(raw)) return undefined;
    const fields: Record<string, number | string> = {};
    for (const [key, value] of Object.entries(raw)) {
      if (value.trim() === "") continue;
      const parsed = Number(value);
      fields[key] = Number.isFinite(parsed) ? parsed : value.trim();
    }
    return Object.keys(fields).length ? fields : undefined;
  }
  const text = Array.isArray(raw) ? raw[0] : String(raw);
  if (!text.trim()) return undefined;
  if (param.options.length) {
    if (param.type === "int" || param.type === "int?" || param.type === "float" || param.type === "seed") {
      const parsed = Number(text);
      return Number.isFinite(parsed) ? parsed : text;
    }
    return text;
  }
  if (param.type === "int" || param.type === "int?" || param.type === "seed" || param.type === "float") {
    const parsed = Number(text);
    return Number.isFinite(parsed) ? parsed : text;
  }
  return text;
}

export function collectParams(model: FloraModel | undefined, draft: Record<string, ParamDraft>): Record<string, unknown> {
  if (!model) return {};
  const params: Record<string, unknown> = {};
  for (const param of model.params) {
    const value = coerceParam(param, draft[param.name]);
    if (value === undefined) continue;
    params[param.name] = value;
  }
  return params;
}

function ensureSourceImage(id: string, capabilities: string[], params: ModelParam[]): ModelParam[] {
  const upscaler = capabilities.some((item) => /upscaler/i.test(item)) || /image-upscaler/i.test(id);
  if (!upscaler) return params;
  if (params.some((param) => isMediaParam(param) && /image/i.test(`${param.name} ${param.label}`))) return params;
  return [
    ...params,
    {
      name: "image_url",
      type: "string",
      required: true,
      label: "Image",
      description: "The image to upscale.",
      defaultValue: null,
      min: null,
      max: 1,
      options: [],
      properties: [],
    },
  ];
}

export function normalizeWorkspace(raw: unknown): Workspace | null {
  const source = asRecord(raw);
  const id = str(source.workspace_id) || str(source.id);
  if (!id) return null;
  return { id, name: str(source.name) || id, role: str(source.role) };
}

export function normalizeProject(raw: unknown): Project | null {
  const source = asRecord(raw);
  const id = str(source.project_id) || str(source.id);
  if (!id) return null;
  return { id, name: str(source.name) || str(source.title) || id };
}

export function normalizeModel(raw: unknown): FloraModel | null {
  const source = asRecord(raw);
  const id = str(source.model_id) || str(source.id) || str(source.endpoint_id) || str(source.slug);
  if (!id) return null;
  const rawParams = Array.isArray(source.params)
    ? source.params
    : Array.isArray(source.parameters)
      ? source.parameters
      : Array.isArray(source.inputs)
        ? source.inputs
        : [];
  const capabilities = readStrings(source.capabilities ?? source.tags ?? source.modes);
  const params = ensureSourceImage(id, capabilities, rawParams.map(normalizeParam).filter((item): item is ModelParam => item != null));
  const name = str(source.name) || str(source.display_name) || id;
  const provider = readProvider(source.provider ?? source.provider_name ?? source.vendor ?? source.company);
  const company = companyName(name, id, provider);
  const blurb = modelBlurb(id, capabilities, params);
  return {
    id,
    name,
    type: str(source.type),
    provider,
    company,
    capabilities,
    blurb,
    baseCost: readCost(source),
    credits: num(source.estimated_credits),
    seconds: num(source.estimated_seconds),
    params,
  };
}

function normalizeInput(raw: unknown): TechniqueInput | null {
  const source = asRecord(raw);
  const id = str(source.id) || str(source.input_id);
  if (!id) return null;
  return { id, name: str(source.name) || str(source.label) || id, type: str(source.type) || "text" };
}

export function normalizeTechnique(raw: unknown): Technique | null {
  const wrapped = asRecord(raw);
  const source = Object.keys(asRecord(wrapped.technique)).length ? asRecord(wrapped.technique) : wrapped;
  const slug = str(source.slug) || str(source.technique_slug);
  const id = str(source.technique_id) || str(source.id) || slug;
  const name = str(source.name) || slug || id;
  if (!name && !slug) return null;
  const inputs = Array.isArray(source.inputs)
    ? source.inputs.map(normalizeInput).filter((item): item is TechniqueInput => item != null)
    : [];
  return {
    id,
    slug,
    name,
    description: str(source.description) || str(source.summary),
    cost: readCost(source),
    inputs,
  };
}

export async function listWorkspaces(key: string): Promise<Workspace[]> {
  const data = await floraRequest(key, "/workspaces");
  return asList(data, ["workspaces"])
    .map(normalizeWorkspace)
    .filter((item): item is Workspace => item != null);
}

export type WorkspaceBalance = { amount: number; currency: string };

export async function workspaceBalance(key: string, workspaceId: string): Promise<WorkspaceBalance> {
  const data = await floraRequest(key, `/workspaces/${encodeURIComponent(workspaceId)}/usage`);
  const source = asRecord(data);
  const amount = num(source.available_cost);
  if (amount == null) {
    throw new FloraApiError("Flora didn’t return a balance.", {
      status: 0,
      code: "bad_balance",
      fields: [],
      cors: false,
    });
  }
  const currency = str(source.currency).toUpperCase() || "USD";
  return { amount, currency };
}

export async function listProjects(key: string, workspaceId: string): Promise<Project[]> {
  const data = await floraRequest(key, `/projects?workspace_id=${encodeURIComponent(workspaceId)}&limit=100`);
  return asList(data, ["projects"])
    .map(normalizeProject)
    .filter((item): item is Project => item != null);
}

export async function listModels(key: string, type: GenType): Promise<FloraModel[]> {
  const data = await floraRequest(key, `/models?type=${encodeURIComponent(type)}`);
  return asList(data, ["models"])
    .map((item) => {
      const model = normalizeModel(item);
      if (!model) return null;
      if (!model.type) model.type = type;
      return model;
    })
    .filter((item): item is FloraModel => item != null);
}

export async function getModel(key: string, modelId: string): Promise<FloraModel | null> {
  const data = await floraRequest(key, `/models?model_id=${encodeURIComponent(modelId)}`);
  const listed = asList(data, ["models", "featured"]);
  const raw = listed.find((item) => {
    const source = asRecord(item);
    const id = str(source.model_id) || str(source.id);
    return id === modelId;
  }) ?? listed[0] ?? data;
  return normalizeModel(raw);
}

export async function listTechniques(key: string): Promise<Technique[]> {
  const data = await floraRequest(key, "/techniques?limit=50");
  return asList(data, ["techniques"])
    .map(normalizeTechnique)
    .filter((item): item is Technique => item != null);
}

export async function getTechnique(key: string, slug: string): Promise<Technique> {
  const data = await floraRequest(key, `/techniques/${encodeURIComponent(slug)}`);
  const technique = normalizeTechnique(data);
  if (!technique) {
    throw new FloraApiError("Flora didn’t return that technique.", { status: 0, code: "bad_technique", fields: [], cors: false });
  }
  if (!technique.slug) technique.slug = slug;
  return technique;
}

export function isUrlInput(type: string): boolean {
  const value = type.toLowerCase();
  return value.includes("url") || value.includes("image") || value.includes("video") || value.includes("audio");
}

function normalizeStatus(value: unknown): string {
  const status = str(value).toLowerCase();
  if (["processing", "in_progress", "running", "started"].includes(status)) return "running";
  if (["queued", "pending", "starting", "created"].includes(status)) return "pending";
  if (["succeeded", "success", "completed", "complete"].includes(status)) return "completed";
  if (["error", "failed", "cancelled", "canceled"].includes(status)) return "failed";
  return status;
}

function isHttps(value: string): boolean {
  try {
    return new URL(value).protocol === "https:";
  } catch {
    return false;
  }
}

function isApiUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.origin === FLORA_ORIGIN && url.pathname.includes("/api/");
  } catch {
    return false;
  }
}

function kindOf(type: string): OutputPiece["kind"] | null {
  const value = type.toLowerCase();
  if (value.includes("model3d") || value.includes("mesh") || value.includes("glb") || value.includes("gltf")) return "file";
  if (value.includes("image")) return "image";
  if (value.includes("video")) return "video";
  if (value.includes("audio") || value.includes("speech")) return "audio";
  if (value === "text" || value.includes("string")) return "text";
  if (value.includes("document") || value.includes("file")) return "file";
  return null;
}

function kindFromUrl(url: string): "image" | "video" | "audio" | null {
  const path = url.split("?")[0].toLowerCase();
  if (/\.(png|jpe?g|gif|webp|avif|svg)$/.test(path)) return "image";
  if (/\.(mp4|webm|mov|m4v)$/.test(path)) return "video";
  if (/\.(mp3|wav|ogg|m4a|aac|flac)$/.test(path)) return "audio";
  return null;
}

function collectOutputs(data: unknown, prefer?: string): OutputPiece[] {
  const pieces: OutputPiece[] = [];
  const seen = new Set<string>();
  const push = (piece: OutputPiece) => {
    const key = piece.kind === "text" ? `t:${piece.text.slice(0, 80)}` : `${piece.kind}:${piece.url}`;
    if (seen.has(key)) return;
    seen.add(key);
    pieces.push(piece);
  };
  const fromOutput = (raw: unknown) => {
    const source = asRecord(raw);
    const type = str(source.type);
    const declared = kindOf(type);
    const url = str(source.url) || str(source.image_url) || str(source.video_url) || str(source.audio_url);
    const text = str(source.text) || str(source.value) || str(source.content);
    if (text && !isHttps(text) && (declared === "text" || (!url && !declared))) push({ kind: "text", text });
    if (declared === "text" && url && !isHttps(url)) {
      push({ kind: "text", text: url });
      return;
    }
    if (!url || !isHttps(url) || isApiUrl(url)) return;
    let kind = declared === "text" ? kindFromUrl(url) : declared || kindFromUrl(url);
    if (!kind && prefer && prefer !== "text") kind = prefer as "image" | "video" | "audio";
    if (kind === "image" || kind === "video" || kind === "audio") push({ kind, url });
    else push({ kind: "file", url, label: type || "Result file" });
  };
  const visit = (node: unknown, depth: number) => {
    if (node == null || depth > 5 || typeof node === "string") return;
    if (Array.isArray(node)) {
      const looks = node.some((item) => {
        const source = asRecord(item);
        return source.output_id || (source.type && (source.url || source.text || source.value));
      });
      if (looks) {
        node.forEach(fromOutput);
        return;
      }
      node.forEach((item) => visit(item, depth + 1));
      return;
    }
    const source = asRecord(node);
    if (Array.isArray(source.outputs)) visit(source.outputs, depth + 1);
    if (typeof source.text === "string" && source.text.trim() && !source.outputs) push({ kind: "text", text: source.text.trim() });
    if (typeof source.result === "string" && source.result.trim()) push({ kind: "text", text: source.result.trim() });
    else if (source.result) visit(source.result, depth + 1);
  };
  visit(data, 0);
  return pieces;
}

export function toSnapshot(data: unknown, prev: RunSnapshot | null, prefer?: string): RunSnapshot {
  const source = asRecord(data);
  const status = normalizeStatus(source.status) || prev?.status || "pending";
  const settled = status === "completed" || status === "failed";
  const pieces = collectOutputs(data, prefer);
  const errorNode = asRecord(source.error);
  const message = str(source.error_message) || str(errorNode.message) || (typeof source.error === "string" ? source.error : "");
  const code = str(source.error_code) || str(errorNode.code);
  return {
    status,
    progress: num(source.progress) ?? (status === "completed" ? 100 : prev?.progress ?? null),
    cost: readCost(data) ?? prev?.cost ?? null,
    eta: num(source.estimated_seconds) ?? prev?.eta ?? null,
    runId: str(source.run_id) || str(source.id) || prev?.runId || "",
    pieces: pieces.length || settled ? pieces : prev?.pieces ?? [],
    error: status === "failed" ? (code && message ? `${code}: ${message}` : message || "The run failed.") : "",
    raw: data,
  };
}

function pollTarget(data: unknown): string {
  const source = asRecord(data);
  const poll = str(source.poll_url);
  const runId = str(source.run_id) || str(source.id);
  if (poll.startsWith("https://app.flora.ai/")) return poll;
  if (poll.startsWith("/")) return `${FLORA_ORIGIN}${poll}`;
  if (runId) return `${FLORA_BASE}/runs/${encodeURIComponent(runId)}`;
  throw new FloraApiError("Flora did not return a poll URL or run id.", {
    status: 0,
    code: "no_poll",
    fields: [],
    cors: false,
  });
}

function sleep(ms: number, signal: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal.aborted) {
      reject(Object.assign(new Error("aborted"), { name: "AbortError" }));
      return;
    }
    let timer = 0;
    const finish = () => {
      window.clearTimeout(timer);
      signal.removeEventListener("abort", onAbort);
      document.removeEventListener("visibilitychange", onVisible);
      resolve();
    };
    const onAbort = () => {
      window.clearTimeout(timer);
      document.removeEventListener("visibilitychange", onVisible);
      reject(Object.assign(new Error("aborted"), { name: "AbortError" }));
    };
    const onVisible = () => {
      if (document.visibilityState === "visible") finish();
    };
    timer = window.setTimeout(finish, ms);
    signal.addEventListener("abort", onAbort, { once: true });
    document.addEventListener("visibilitychange", onVisible);
  });
}

function pollGaveUp(error: unknown): boolean {
  if (error instanceof FloraApiError) {
    if (error.status === 401 || error.status === 402 || error.status === 403) return true;
    return false;
  }
  return false;
}

export async function pollRun(
  key: string,
  created: unknown,
  opts: { signal: AbortSignal; prefer?: GenType; onUpdate: (snapshot: RunSnapshot) => void; intervalMs?: number },
): Promise<RunSnapshot> {
  let snapshot = toSnapshot(created, null, opts.prefer);
  if (!str(asRecord(created).status)) snapshot = { ...snapshot, status: snapshot.status || "pending" };
  opts.onUpdate(snapshot);
  const url = pollTarget(created);
  const started = Date.now();
  let hiddenAt = 0;
  let paused = 0;
  let misses = 0;
  const onHide = () => {
    if (document.visibilityState === "hidden") {
      if (!hiddenAt) hiddenAt = Date.now();
      return;
    }
    if (hiddenAt) {
      paused += Date.now() - hiddenAt;
      hiddenAt = 0;
    }
  };
  document.addEventListener("visibilitychange", onHide);
  try {
    while (snapshot.status !== "completed" && snapshot.status !== "failed") {
      const away = hiddenAt ? Date.now() - hiddenAt : 0;
      if (Date.now() - started - paused - away > 20 * 60 * 1000) {
        throw new FloraApiError("Still running after 20 minutes. Polling stopped. The run may still finish in Flora.", {
          status: 0,
          code: "timeout",
          fields: [],
          cors: false,
        });
      }
      await sleep(opts.intervalMs ?? 3000, opts.signal);
      const attempt = new AbortController();
      const stopAttempt = () => attempt.abort();
      opts.signal.addEventListener("abort", stopAttempt, { once: true });
      const retryOnReturn = () => {
        if (document.visibilityState === "visible") attempt.abort();
      };
      document.addEventListener("visibilitychange", retryOnReturn);
      try {
        const data = await floraRequest(key, url, { signal: attempt.signal });
        misses = 0;
        snapshot = toSnapshot(data, snapshot, opts.prefer);
        opts.onUpdate(snapshot);
      } catch (error) {
        if (opts.signal.aborted) throw error;
        if (pollGaveUp(error)) throw error;
        if (document.visibilityState === "hidden" || (error instanceof Error && error.name === "AbortError")) continue;
        misses += 1;
        if (misses >= 8) throw error;
      } finally {
        opts.signal.removeEventListener("abort", stopAttempt);
        document.removeEventListener("visibilitychange", retryOnReturn);
      }
    }
    return snapshot;
  } finally {
    document.removeEventListener("visibilitychange", onHide);
  }
}

export async function startGeneration(
  key: string,
  body: {
    type: GenType;
    prompt: string;
    workspaceId: string;
    projectId: string;
    model?: string;
    params?: Record<string, unknown>;
  },
  signal?: AbortSignal,
): Promise<unknown> {
  const payload: Record<string, unknown> = {
    type: body.type,
    prompt: body.prompt,
    workspace_id: body.workspaceId,
    project_id: body.projectId,
  };
  if (body.model) payload.model = body.model;
  if (body.params && Object.keys(body.params).length) payload.params = body.params;
  return floraRequest(key, "/generate", {
    method: "POST",
    body: JSON.stringify(payload),
    signal,
    headers: { "Idempotency-Key": crypto.randomUUID() },
  });
}

export async function quoteGeneration(
  key: string,
  body: {
    type: GenType;
    prompt: string;
    workspaceId: string;
    projectId: string;
    model?: string;
    params?: Record<string, unknown>;
  },
  signal?: AbortSignal,
): Promise<number | null> {
  const payload: Record<string, unknown> = {
    quote: true,
    type: body.type,
    prompt: body.prompt,
    workspace_id: body.workspaceId,
    project_id: body.projectId,
  };
  if (body.model) payload.model = body.model;
  if (body.params && Object.keys(body.params).length) payload.params = body.params;
  const data = await floraRequest(key, "/generate", {
    method: "POST",
    body: JSON.stringify(payload),
    signal,
  });
  return readCost(data);
}

export async function uploadAsset(key: string, workspaceId: string, projectId: string, file: File): Promise<string> {
  if (file.size > 4 * 1024 * 1024) {
    throw new FloraApiError("That file is over 4 MB. Use a smaller one, or paste an https link.", {
      status: 0,
      code: "file_too_large",
      fields: [],
      cors: false,
    });
  }
  const form = new FormData();
  form.set("apiKey", key);
  form.set("workspaceId", workspaceId);
  if (projectId) form.set("projectId", projectId);
  form.set("file", file);
  let response: Response;
  try {
    response = await relayFetch("/api/flora-asset", { method: "POST", body: form });
  } catch {
    throw new FloraApiError("Couldn’t upload that file.", { status: 0, code: "network", fields: [], cors: false });
  }
  const text = await response.text();
  let data: unknown = null;
  if (text) {
    try {
      data = JSON.parse(text) as unknown;
    } catch {
      data = { message: text.slice(0, 400) };
    }
  }
  if (!response.ok) throw parseErrorBody(data, response.status);
  const url = str(asRecord(data).url);
  if (!url.startsWith("https://")) {
    throw new FloraApiError("Flora didn’t return a file URL.", { status: 0, code: "bad_asset", fields: [], cors: false });
  }
  return url;
}

export function scrubJson(data: unknown, key: string | null): string {
  let text = "";
  try {
    text = JSON.stringify(data, null, 2) ?? "";
  } catch {
    text = String(data);
  }
  if (key && text.includes(key)) return text.split(key).join("ak_…");
  return text;
}
