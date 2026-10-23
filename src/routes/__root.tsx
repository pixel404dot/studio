import { ClientOnly, createRootRoute, HeadContent, Outlet, Scripts } from "@tanstack/react-router";
import { AuthProvider } from "@/lib/auth/provider";
import { PreviewHostBridge } from "@/components/preview-host-bridge";
import appCss from "../styles.css?url";

const APP_NAME = "Studio";
const BASE_URL = (import.meta.env?.BASE_URL || "/").replace(/\/$/, "");
const staticSite = import.meta.env?.VITE_STATIC_SITE === "true";

export const Route = createRootRoute({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1, viewport-fit=cover" },
      { title: APP_NAME },
      {
        name: "description",
        content: "Create images, video, audio, text, and 3D assets from a prompt.",
      },
      { name: "theme-color", content: "#09090b" },
      { name: "color-scheme", content: "dark" },
    ],
    links: [
      { rel: "icon", type: "image/svg+xml", href: `${BASE_URL}/favicon.svg` },
      { rel: "preconnect", href: "https://fonts.googleapis.com" },
      { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "anonymous" },
      {
        rel: "stylesheet",
        href: "https://fonts.googleapis.com/css2?family=Geist:wght@400;500;600;700&family=Geist+Mono:wght@400;500&display=swap",
      },
      { rel: "stylesheet", href: appCss },
      ...(staticSite ? [] : [{ rel: "manifest", href: `${BASE_URL}/__grok/manifest.webmanifest` }]),
      { rel: "apple-touch-icon", href: `${BASE_URL}/__grok/icon-180.png` },
    ],
  }),
  component: () => (
    <html lang="en" suppressHydrationWarning>
      <head>
        <HeadContent />
      </head>
      <body>
        <PreviewHostBridge />
        {staticSite ? (
          <ClientOnly>
            <AuthProvider>
              <Outlet />
            </AuthProvider>
          </ClientOnly>
        ) : (
          <AuthProvider>
            <Outlet />
          </AuthProvider>
        )}
        <Scripts />
      </body>
    </html>
  ),
});
