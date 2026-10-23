import { createFileRoute } from "@tanstack/react-router";

const MAX_BYTES = 80 * 1024 * 1024;

function jsonError(status: number, code: string, message: string) {
  return new Response(JSON.stringify({ error: { code, message } }), {
    status,
    headers: { "content-type": "application/json" },
  });
}

function safeFilename(raw: string): string {
  const cleaned = raw
    .replace(/:/g, "x")
    .replace(/[\\/:*?"<>|\u0000-\u001f]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 160);
  return cleaned || "image.png";
}

function allowedMediaUrl(raw: string): URL | null {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return null;
  }
  if (url.protocol !== "https:" || url.username || url.password) return null;
  const host = url.hostname.toLowerCase();
  if (
    host === "localhost" ||
    host.endsWith(".local") ||
    host.endsWith(".internal") ||
    host === "metadata.google.internal" ||
    host === "169.254.169.254"
  ) {
    return null;
  }
  if (host.includes(":")) return null;
  if (/^\d+\.\d+\.\d+\.\d+$/.test(host)) {
    const [a, b] = host.split(".").map(Number);
    const blocked =
      a === 10 ||
      a === 127 ||
      a === 0 ||
      (a === 192 && b === 168) ||
      (a === 172 && b >= 16 && b <= 31) ||
      (a === 169 && b === 254);
    if (blocked) return null;
  }
  return url;
}

export const Route = createFileRoute("/api/flora-file")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const query = new URL(request.url).searchParams;
        const target = allowedMediaUrl(query.get("url") || "");
        if (!target) return jsonError(400, "bad_url", "That file link can’t be downloaded.");
        const filename = safeFilename(query.get("name") || "image.png");

        let current = target;
        let upstream: Response | null = null;
        for (let hop = 0; hop < 3; hop += 1) {
          try {
            upstream = await fetch(current, { redirect: "manual" });
          } catch {
            return jsonError(502, "network", "Couldn’t download that file.");
          }
          if (upstream.status < 300 || upstream.status >= 400) break;
          const next = allowedMediaUrl(new URL(upstream.headers.get("location") || "", current).toString());
          if (!next) return jsonError(502, "bad_redirect", "The file link redirected somewhere that isn’t allowed.");
          current = next;
          upstream = null;
        }
        if (!upstream || !upstream.ok || !upstream.body) {
          return jsonError(upstream?.status || 502, "download_failed", "The file wasn’t available.");
        }
        const length = Number(upstream.headers.get("content-length") || "0");
        if (length > MAX_BYTES) return jsonError(413, "too_large", "That file is too large to download here.");
        const type = upstream.headers.get("content-type") || "application/octet-stream";
        if (!/^(image|video|audio|application\/octet-stream|binary\/octet-stream)/i.test(type)) {
          return jsonError(415, "bad_type", "That link isn’t an image, video, or audio file.");
        }
        const encoded = encodeURIComponent(filename);
        return new Response(upstream.body, {
          headers: {
            "content-type": type,
            "content-disposition": `attachment; filename="${filename.replace(/"/g, "")}"; filename*=UTF-8''${encoded}`,
            "cache-control": "private, max-age=60",
          },
        });
      },
    },
  },
});
