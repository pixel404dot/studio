import { FloraApiError, type FloraModel, type OutputPiece, type RunSnapshot } from "@/lib/flora";

export const LS_YOUMIND = "flora.youmindKey";
export const YOUMIND_IMAGE_ID = "youmind:image";

export function youmindImageModel(): FloraModel {
  return {
    id: YOUMIND_IMAGE_ID,
    name: "YouMind Image",
    type: "image",
    provider: "youmind",
    company: "YouMind",
    capabilities: ["image"],
    blurb: "GPT Image, Gemini, Seedream, and YouMind’s other image models",
    baseCost: null,
    credits: null,
    seconds: null,
    params: [],
  };
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
}

function textOf(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function friendly(status: number, code: string, message: string): string {
  if (status === 401 || code === "unauthorized") {
    return "YouMind rejected that key. Make a new one in YouMind Settings → API Keys.";
  }
  if (status === 402 || /credit|quota|limit/i.test(`${code} ${message}`)) {
    return "YouMind blocked this for credits or a plan limit. Check your YouMind plan.";
  }
  if (status === 429) return "YouMind rate-limited this key. Wait a moment and try again.";
  return message || `YouMind returned an error (${status || "network"}).`;
}

export async function youmindRequest(
  key: string,
  name: string,
  params: Record<string, unknown>,
  signal?: AbortSignal,
): Promise<unknown> {
  let response: Response;
  try {
    response = await fetch("/api/youmind", {
      method: "POST",
      signal,
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({ apiKey: key, name, body: params }),
    });
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") throw error;
    throw new FloraApiError("Couldn’t reach this site’s YouMind relay. Try again in a moment.", {
      status: 0,
      code: "network",
      fields: [],
      cors: false,
    });
  }
  const raw = await response.text();
  let data: unknown = null;
  if (raw) {
    try {
      data = JSON.parse(raw) as unknown;
    } catch {
      data = { message: raw.slice(0, 400) };
    }
  }
  if (!response.ok) {
    const root = asRecord(data);
    const err = asRecord(root.error);
    const code = textOf(err.code) || textOf(root.code) || String(response.status);
    const message = friendly(response.status, code, textOf(err.message) || textOf(root.message));
    throw new FloraApiError(message, { status: response.status, code, fields: [], cors: false });
  }
  return data;
}

function pickId(data: unknown): string {
  const root = asRecord(data);
  const nested = [root, asRecord(root.data), asRecord(root.board), asRecord(root.chat), asRecord(asRecord(root.data).board)];
  for (const node of nested) {
    const id = textOf(node.id) || textOf(node.boardId) || textOf(node.chatId);
    if (id) return id;
  }
  return "";
}

function rowsOf(data: unknown): Record<string, unknown>[] {
  if (Array.isArray(data)) return data.map(asRecord).filter((row) => Object.keys(row).length);
  const root = asRecord(data);
  for (const key of ["chats", "items", "messages", "data", "list", "results"]) {
    const value = root[key];
    if (Array.isArray(value)) return value.map(asRecord).filter((row) => Object.keys(row).length);
    const inner = asRecord(value);
    for (const nested of ["items", "chats", "messages", "list"]) {
      if (Array.isArray(inner[nested])) return (inner[nested] as unknown[]).map(asRecord);
    }
  }
  return [];
}

function newestChatId(data: unknown): string {
  const rows = rowsOf(data);
  rows.sort((a, b) => {
    const at = Date.parse(textOf(a.createdAt) || textOf(a.created_at)) || 0;
    const bt = Date.parse(textOf(b.createdAt) || textOf(b.created_at)) || 0;
    return bt - at;
  });
  return rows[0] ? pickId(rows[0]) : "";
}

function chatStatus(data: unknown): string {
  const root = asRecord(data);
  const chat = asRecord(root.chat);
  const inner = asRecord(root.data);
  return (textOf(root.status) || textOf(chat.status) || textOf(inner.status) || textOf(asRecord(inner.chat).status)).toLowerCase();
}

function collectPieces(data: unknown): OutputPiece[] {
  const pieces: OutputPiece[] = [];
  const seen = new Set<string>();
  const pushUrl = (url: string) => {
    if (!/^https:\/\//.test(url) || seen.has(url)) return;
    seen.add(url);
    pieces.push({ kind: "image", url });
  };
  const visit = (node: unknown, keyName = "") => {
    if (typeof node === "string") {
      if (/\.(png|jpe?g|webp|gif|avif)(\?|$)/i.test(node) || /image/i.test(keyName)) pushUrl(node);
      return;
    }
    if (Array.isArray(node)) {
      node.forEach((item) => visit(item));
      return;
    }
    if (!node || typeof node !== "object") return;
    const record = node as Record<string, unknown>;
    const kind = textOf(record.type) || textOf(record.kind);
    for (const key of ["url", "imageUrl", "image_url", "src", "mediaUrl", "downloadUrl"]) {
      const url = textOf(record[key]);
      if (!url) continue;
      if (/image/i.test(kind) || /image|src|media|download/i.test(key) || /\.(png|jpe?g|webp|gif|avif)(\?|$)/i.test(url)) {
        pushUrl(url);
      }
    }
    for (const [key, value] of Object.entries(record)) visit(value, key);
  };
  visit(data);
  return pieces;
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

function runningSnap(chatId: string, pieces: OutputPiece[] = []): RunSnapshot {
  return {
    status: pieces.length ? "completed" : "running",
    progress: pieces.length ? 100 : null,
    cost: null,
    eta: null,
    runId: chatId ? `ym_${chatId}` : "",
    pieces,
    error: "",
    raw: null,
  };
}

export async function generateYouMindImage(
  key: string,
  prompt: string,
  opts: { signal: AbortSignal; onUpdate: (snapshot: RunSnapshot) => void; chatId?: string },
): Promise<RunSnapshot> {
  let chatId = opts.chatId || "";
  if (!chatId) {
    const board = await youmindRequest(key, "getDefaultBoard", {}, opts.signal);
    const boardId = pickId(board);
    if (!boardId) {
      throw new FloraApiError("YouMind didn’t return a board for this key.", {
        status: 0,
        code: "no_board",
        fields: [],
        cors: false,
      });
    }
    opts.onUpdate(runningSnap(""));
    try {
      const created = await youmindRequest(
        key,
        "createChat",
        { boardId, message: prompt, tools: { imageGenerate: { useTool: "required" } } },
        opts.signal,
      );
      chatId = pickId(created);
      const immediate = collectPieces(created);
      if (immediate.length) {
        const done = { ...runningSnap(chatId, immediate), raw: created };
        opts.onUpdate(done);
        return done;
      }
    } catch (error) {
      if (error instanceof Error && error.name === "AbortError" && opts.signal.aborted) throw error;
      if (error instanceof FloraApiError && (error.status === 401 || error.status === 402 || error.status === 403)) throw error;
    }
    if (!chatId) {
      const listed = await youmindRequest(key, "listChats", { boardId, pageSize: 3 }, opts.signal);
      chatId = newestChatId(listed);
    }
    if (!chatId) {
      throw new FloraApiError("YouMind didn’t start a chat. Try the prompt again.", {
        status: 0,
        code: "no_chat",
        fields: [],
        cors: false,
      });
    }
  }

  opts.onUpdate(runningSnap(chatId));
  const started = Date.now();
  let misses = 0;
  while (Date.now() - started < 8 * 60 * 1000) {
    await sleep(5000, opts.signal);
    let detail: unknown;
    try {
      detail = await youmindRequest(key, "getChat", { chatId }, opts.signal);
      misses = 0;
    } catch (error) {
      if (opts.signal.aborted) throw error;
      if (error instanceof FloraApiError && (error.status === 401 || error.status === 402)) throw error;
      misses += 1;
      if (misses >= 8 && document.visibilityState === "visible") throw error;
      continue;
    }
    const status = chatStatus(detail);
    if (status === "errored" || status === "error" || status === "failed") {
      const root = asRecord(detail);
      const message = textOf(root.error) || textOf(asRecord(root.error).message) || "YouMind couldn’t make that image.";
      const failed: RunSnapshot = { ...runningSnap(chatId), status: "failed", error: message, raw: detail };
      opts.onUpdate(failed);
      return failed;
    }
    if (status === "completed" || status === "complete" || status === "succeeded") {
      const messages = await youmindRequest(key, "listMessages", { chatId, pageSize: 20 }, opts.signal);
      const pieces = collectPieces(messages);
      const done: RunSnapshot = {
        ...runningSnap(chatId, pieces.length ? pieces : collectPieces(detail)),
        status: "completed",
        raw: messages,
      };
      if (!done.pieces.length) {
        done.status = "failed";
        done.error = "YouMind finished, but no image was in the reply.";
      }
      opts.onUpdate(done);
      return done;
    }
    const early = collectPieces(detail);
    if (early.length) {
      const done = { ...runningSnap(chatId, early), raw: detail };
      opts.onUpdate(done);
      return done;
    }
    opts.onUpdate(runningSnap(chatId));
  }
  throw new FloraApiError("YouMind was still working after 8 minutes. Check the image on your YouMind board.", {
    status: 0,
    code: "timeout",
    fields: [],
    cors: false,
  });
}
