import { createFileRoute } from "@tanstack/react-router";

const FLORA_PREFIX = "https://app.flora.ai/api/v1";

function allowedPath(raw: string): string | null {
  if (typeof raw !== "string") return null;
  const trimmed = raw.trim();
  if (!trimmed.startsWith("/") || trimmed.length > 800) return null;
  if (trimmed.includes("://") || trimmed.includes("..") || trimmed.includes("\\") || trimmed.includes("\0")) {
    return null;
  }
  const splitAt = trimmed.indexOf("?");
  const pathname = splitAt === -1 ? trimmed : trimmed.slice(0, splitAt);
  const search = splitAt === -1 ? "" : trimmed.slice(splitAt);
  if (search && !/^\?[A-Za-z0-9_=&%+.,:-]*$/.test(search)) return null;
  const ok =
    pathname === "/workspaces" ||
    pathname === "/projects" ||
    pathname === "/models" ||
    pathname === "/generate" ||
    pathname === "/techniques" ||
    /^\/runs\/[^/]+$/.test(pathname) ||
    /^\/workspaces\/[A-Za-z0-9_-]+\/usage$/.test(pathname) ||
    /^\/techniques\/[^/]+$/.test(pathname) ||
    /^\/techniques\/[^/]+\/runs$/.test(pathname) ||
    /^\/techniques\/[^/]+\/runs\/[^/]+$/.test(pathname);
  if (!ok) return null;
  return `${FLORA_PREFIX}${pathname}${search}`;
}

function jsonError(status: number, code: string, message: string) {
  return new Response(JSON.stringify({ error: { code, message } }), {
    status,
    headers: { "content-type": "application/json" },
  });
}

export const Route = createFileRoute("/api/flora")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        let payload: unknown;
        try {
          payload = await request.json();
        } catch {
          return jsonError(400, "invalid_json", "Relay expected a JSON body.");
        }
        const body = payload && typeof payload === "object" ? (payload as Record<string, unknown>) : {};
        const apiKey = body.apiKey;
        if (typeof apiKey !== "string" || apiKey.length < 8 || apiKey.length > 400 || /\s/.test(apiKey)) {
          return jsonError(400, "invalid_api_key", "Missing API key.");
        }
        const target = allowedPath(typeof body.path === "string" ? body.path : "");
        if (!target) return jsonError(400, "bad_path", "That Flora path is not allowed.");
        const method = body.method === "POST" ? "POST" : body.method === "GET" || body.method == null ? "GET" : null;
        if (!method) return jsonError(400, "bad_method", "Only GET and POST are relayed.");

        const headers = new Headers();
        headers.set("Authorization", `Bearer ${apiKey}`);
        headers.set("Accept", "application/json");
        const idem = body.idempotencyKey;
        if (typeof idem === "string" && /^[A-Za-z0-9_-]{1,128}$/.test(idem)) {
          headers.set("Idempotency-Key", idem);
        }

        let outbound: string | undefined;
        if (method === "POST") {
          if (typeof body.body !== "string" || body.body.length > 100_000) {
            return jsonError(400, "invalid_json", "Missing request body.");
          }
          headers.set("Content-Type", "application/json");
          outbound = body.body;
        }

        let upstream: Response;
        try {
          upstream = await fetch(target, { method, headers, body: outbound });
        } catch {
          return jsonError(502, "network", "Couldn’t reach Flora.");
        }

        let text = await upstream.text();
        if (text.includes(apiKey)) text = text.split(apiKey).join("ak_…");
        const responseHeaders = new Headers();
        responseHeaders.set("content-type", upstream.headers.get("content-type") || "application/json");
        const requestId = upstream.headers.get("flora-request-id");
        if (requestId) responseHeaders.set("flora-request-id", requestId);
        return new Response(text, { status: upstream.status, headers: responseHeaders });
      },
    },
  },
});
