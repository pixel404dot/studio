import { createFileRoute } from "@tanstack/react-router";

const MAX_BYTES = 4 * 1024 * 1024;

const CORS_HEADERS: Record<string, string> = {
  "access-control-allow-origin": "*",
  "access-control-allow-methods": "GET, POST, OPTIONS",
  "access-control-allow-headers": "Content-Type, Accept, Authorization",
  "access-control-allow-private-network": "true",
};

function jsonError(status: number, code: string, message: string) {
  return new Response(JSON.stringify({ error: { code, message } }), {
    status,
    headers: { "content-type": "application/json", ...CORS_HEADERS },
  });
}

function allowedFile(file: File): boolean {
  if (file.type.startsWith("image/") || file.type.startsWith("video/") || file.type.startsWith("audio/")) return true;
  return /\.(jpe?g|png|webp|gif|avif|heic|heif|mp4|webm|mov|m4v|mp3|wav|ogg|m4a|aac)$/i.test(file.name);
}

export const Route = createFileRoute("/api/flora-asset")({
  server: {
    handlers: {
      OPTIONS: async () => new Response(null, { status: 204, headers: CORS_HEADERS }),
      POST: async ({ request }) => {
        let form: FormData;
        try {
          form = await request.formData();
        } catch {
          return jsonError(400, "invalid_body", "Expected a file upload.");
        }
        const apiKey = form.get("apiKey");
        const workspaceId = form.get("workspaceId");
        const projectId = form.get("projectId");
        const file = form.get("file");
        if (typeof apiKey !== "string" || apiKey.length < 8 || apiKey.length > 400 || /\s/.test(apiKey)) {
          return jsonError(400, "invalid_api_key", "Missing API key.");
        }
        if (typeof workspaceId !== "string" || !workspaceId.startsWith("ws_")) {
          return jsonError(400, "bad_workspace", "Choose a workspace before uploading.");
        }
        if (projectId != null && projectId !== "" && (typeof projectId !== "string" || !projectId.startsWith("prj_"))) {
          return jsonError(400, "bad_project", "That project id is not valid.");
        }
        if (!(file instanceof File)) return jsonError(400, "missing_file", "Choose a file to upload.");
        if (file.size <= 0 || file.size > MAX_BYTES) {
          return jsonError(400, "file_too_large", "Flora’s direct upload limit is 4 MB.");
        }
        if (!allowedFile(file)) return jsonError(400, "bad_type", "Use an image, video, or audio file.");

        const outbound = new FormData();
        outbound.set("file", file, file.name.slice(0, 180) || "upload");
        outbound.set("workspace_id", workspaceId);
        if (typeof projectId === "string" && projectId.startsWith("prj_")) outbound.set("project_id", projectId);

        let upstream: Response;
        try {
          upstream = await fetch("https://app.flora.ai/api/v1/assets", {
            method: "POST",
            headers: { Authorization: `Bearer ${apiKey}`, Accept: "application/json" },
            body: outbound,
          });
        } catch {
          return jsonError(502, "network", "Couldn’t reach Flora to upload that file.");
        }

        let text = await upstream.text();
        if (text.includes(apiKey)) text = text.split(apiKey).join("ak_…");
        const contentType = upstream.headers.get("content-type") || "application/json";
        if (!upstream.ok) {
          return new Response(text, { status: upstream.status, headers: { "content-type": contentType, ...CORS_HEADERS } });
        }
        let data: Record<string, unknown> = {};
        try {
          const parsed: unknown = JSON.parse(text);
          if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) data = parsed as Record<string, unknown>;
        } catch {
          return jsonError(502, "bad_asset", "Flora’s upload response wasn’t JSON.");
        }
        const url = typeof data.url === "string" ? data.url : "";
        if (!url.startsWith("https://")) return jsonError(502, "bad_asset", "Flora didn’t return a file URL.");
        return Response.json(
          {
            url,
            asset_id: typeof data.asset_id === "string" ? data.asset_id : "",
            status: typeof data.status === "string" ? data.status : "",
          },
          { headers: CORS_HEADERS },
        );
      },
    },
  },
});
