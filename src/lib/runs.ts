import { createServerFn } from "@tanstack/react-start";
import { getSql } from "@/lib/db";
import { authMiddleware } from "@/lib/auth/middleware";
import type { OutputPiece, RunSnapshot } from "@/lib/flora";

export type SavedRun = {
  id: string;
  title: string;
  typeLabel: string;
  status: string;
  cost: number | null;
  at: number;
  snap: Omit<RunSnapshot, "raw"> & { raw: null };
};

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
}

function clip(value: unknown, max: number): string {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

function httpsUrl(value: unknown): string {
  const url = clip(value, 2000);
  try {
    return new URL(url).protocol === "https:" ? url : "";
  } catch {
    return "";
  }
}

function piece(value: unknown): OutputPiece | null {
  const source = asRecord(value);
  const kind = clip(source.kind, 20);
  if (kind === "text") {
    const text = clip(source.text, 8000);
    return text ? { kind: "text", text } : null;
  }
  if (kind === "image" || kind === "video" || kind === "audio") {
    const url = httpsUrl(source.url);
    return url ? { kind, url } : null;
  }
  if (kind === "file") {
    const url = httpsUrl(source.url);
    return url ? { kind: "file", url, label: clip(source.label, 120) || "File" } : null;
  }
  return null;
}

function validateRun(input: unknown): SavedRun {
  const source = asRecord(input);
  const snap = asRecord(source.snap);
  const id = clip(source.id, 120) || clip(snap.runId, 120);
  const title = clip(source.title, 240);
  const typeLabel = clip(source.typeLabel, 40);
  const status = clip(source.status, 40) || "completed";
  if (!id || !title || !typeLabel) throw new Error("That run can’t be saved.");
  const cost = typeof source.cost === "number" && Number.isFinite(source.cost) ? source.cost : null;
  const at = typeof source.at === "number" && Number.isFinite(source.at) ? source.at : Date.now();
  const pieces = (Array.isArray(snap.pieces) ? snap.pieces : []).map(piece).filter((item): item is OutputPiece => item != null).slice(0, 8);
  const saved = {
    status,
    progress: typeof snap.progress === "number" ? snap.progress : null,
    cost,
    eta: null,
    runId: clip(snap.runId, 120) || id,
    pieces,
    error: clip(snap.error, 500),
    raw: null,
    took: typeof snap.took === "number" && Number.isFinite(snap.took) ? Math.max(0, Math.round(snap.took)) : null,
  };
  return { id, title, typeLabel, status, cost, at, snap: saved };
}

function rowToRun(row: {
  run_id: string;
  title: string;
  type_label: string;
  status: string;
  cost: number | null;
  created_at: string | Date;
  snap: unknown;
}): SavedRun {
  const snap = typeof row.snap === "string" ? (JSON.parse(row.snap) as unknown) : row.snap;
  const saved = validateRun({
    id: row.run_id,
    title: row.title,
    typeLabel: row.type_label,
    status: row.status,
    cost: row.cost,
    at: new Date(row.created_at).getTime(),
    snap,
  });
  return saved;
}

export const listRuns = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    const sql = await getSql();
    const rows = await sql<{
      run_id: string;
      title: string;
      type_label: string;
      status: string;
      cost: number | null;
      created_at: string;
      snap: unknown;
    }>`
      select run_id, title, type_label, status, cost, created_at, snap
      from flora_runs
      where user_id = ${context.userId}
      order by created_at desc
      limit 40
    `;
    return rows.map(rowToRun);
  });

export const saveRun = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator(validateRun)
  .handler(async ({ context, data }) => {
    const sql = await getSql();
    const created = new Date(data.at).toISOString();
    await sql`
      insert into flora_runs (user_id, run_id, title, type_label, status, cost, created_at, snap)
      values (
        ${context.userId},
        ${data.id},
        ${data.title},
        ${data.typeLabel},
        ${data.status},
        ${data.cost},
        ${created},
        ${JSON.stringify(data.snap)}::jsonb
      )
      on conflict (user_id, run_id) do update set
        title = excluded.title,
        type_label = excluded.type_label,
        status = excluded.status,
        cost = excluded.cost,
        snap = excluded.snap
    `;
    await sql`
      delete from flora_runs
      where user_id = ${context.userId}
        and created_at < (
          select created_at from flora_runs
          where user_id = ${context.userId}
          order by created_at desc
          offset 39
          limit 1
        )
    `;
    return { ok: true };
  });

export const deleteRun = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: unknown) => {
    const id = clip(asRecord(input).id, 120);
    if (!id) throw new Error("That run can’t be deleted.");
    return { id };
  })
  .handler(async ({ context, data }) => {
    const sql = await getSql();
    await sql`
      delete from flora_runs
      where user_id = ${context.userId} and run_id = ${data.id}
    `;
    return { ok: true };
  });

export const clearRuns = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    const sql = await getSql();
    await sql`delete from flora_runs where user_id = ${context.userId}`;
    return { ok: true };
  });
