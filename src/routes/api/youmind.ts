import { createFileRoute } from "@tanstack/react-router";

const ALLOWED = new Set(["getDefaultBoard", "createChat", "getChat", "listChats", "listMessages"]);

function jsonError(status: number, code: string, message: string) {
  return new Response(JSON.stringify({ error: { code, message } }), {
    status,
    headers: { "content-type": "application/json" },
  });
}

export const Route = createFileRoute("/api/youmind")({
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
        if (typeof apiKey !== "string" || !apiKey.startsWith("sk-ym-") || apiKey.length > 200 || /\s/.test(apiKey)) {
          return jsonError(400, "invalid_api_key", "Missing YouMind API key.");
        }
        const name = body.name;
        if (typeof name !== "string" || !ALLOWED.has(name)) {
          return jsonError(400, "bad_path", "That YouMind call is not allowed.");
        }
        const params = body.body && typeof body.body === "object" ? body.body : {};
        const outbound = JSON.stringify(params);
        if (outbound.length > 20_000) return jsonError(400, "invalid_json", "That prompt is too long.");

        let upstream: Response;
        try {
          upstream = await fetch(`https://youmind.com/openapi/v1/${name}`, {
            method: "POST",
            headers: {
              "x-api-key": apiKey,
              "Content-Type": "application/json",
              Accept: "application/json",
              "x-use-camel-case": "true",
            },
            body: outbound,
          });
        } catch {
          return jsonError(502, "network", "Couldn’t reach YouMind.");
        }

        let text = await upstream.text();
        if (text.includes(apiKey)) text = text.split(apiKey).join("sk-ym-…");
        return new Response(text, {
          status: upstream.status,
          headers: { "content-type": upstream.headers.get("content-type") || "application/json" },
        });
      },
    },
  },
});
