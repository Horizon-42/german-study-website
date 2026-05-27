import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

const dwProxyPath = "/dw-proxy";
const dwProxyAllowedSuffixes = ["dw.com", "dwcdn.net"];

export default defineConfig({
  plugins: [react(), localDwProxy()],
  server: {
    host: "127.0.0.1",
    port: 5173,
  },
});

function localDwProxy() {
  return {
    name: "local-dw-proxy",
    configureServer(server) {
      server.middlewares.use(dwProxyPath, async (request, response) => {
        try {
          const target = readProxyTarget(request.url ?? "");
          if (!target) {
            response.writeHead(400, { "content-type": "text/plain; charset=utf-8" });
            response.end("Missing or invalid DW proxy target URL.");
            return;
          }

          const body = ["GET", "HEAD"].includes(request.method ?? "GET") ? undefined : await readRequestBody(request);
          const upstream = await fetch(target, {
            method: request.method,
            headers: localProxyRequestHeaders(request.headers, target),
            body,
            redirect: "manual",
          });
          const headers = localProxyResponseHeaders(upstream.headers);
          const location = upstream.headers.get("location");

          if (location) {
            headers.set("location", proxiedUrl(new URL(location, target)));
          }

          const contentType = upstream.headers.get("content-type") ?? "";
          response.writeHead(upstream.status, Object.fromEntries(headers.entries()));

          if (contentType.includes("text/html")) {
            response.end(rewriteHtml(await upstream.text(), target));
            return;
          }

          if (contentType.includes("text/css")) {
            response.end(rewriteCss(await upstream.text(), target));
            return;
          }

          if (isJavaScriptContent(contentType)) {
            response.end(rewriteJavaScript(await upstream.text(), target));
            return;
          }

          const bytes = new Uint8Array(await upstream.arrayBuffer());
          response.end(bytes);
        } catch (error) {
          response.writeHead(502, { "content-type": "text/plain; charset=utf-8" });
          response.end(error instanceof Error ? error.message : String(error));
        }
      });
    },
  };
}

function readProxyTarget(requestPath: string): URL | undefined {
  const url = new URL(requestPath, "http://local-dw-proxy");
  const rawTarget = url.searchParams.get("url");

  if (!rawTarget) {
    return undefined;
  }

  try {
    const target = new URL(rawTarget);
    return target.protocol === "https:" && isAllowedDwProxyHost(target.hostname) ? target : undefined;
  } catch {
    return undefined;
  }
}

function localProxyRequestHeaders(headers: Record<string, string | string[] | undefined>, target: URL): Headers {
  const next = new Headers();

  Object.entries(headers).forEach(([key, value]) => {
    if (!value || ["host", "connection", "content-length"].includes(key.toLowerCase())) {
      return;
    }

    next.set(key, Array.isArray(value) ? value.join(", ") : value);
  });

  next.set("accept-encoding", "identity");
  next.set("origin", target.origin);
  next.set("referer", target.href);
  return next;
}

function localProxyResponseHeaders(headers: Headers): Headers {
  const next = new Headers(headers);
  [
    "content-security-policy",
    "content-security-policy-report-only",
    "cross-origin-embedder-policy",
    "cross-origin-opener-policy",
    "cross-origin-resource-policy",
    "permissions-policy",
    "content-encoding",
    "content-length",
    "x-frame-options",
  ].forEach((header) => next.delete(header));
  next.set("cache-control", "no-store");
  next.set("x-robots-tag", "noindex, nofollow");
  rewriteSetCookieHeaders(headers, next);
  return next;
}

function readRequestBody(request: NodeJS.ReadableStream): Promise<Uint8Array> {
  return new Promise((resolve, reject) => {
    const chunks: Uint8Array[] = [];
    request.on("data", (chunk) => chunks.push(typeof chunk === "string" ? new TextEncoder().encode(chunk) : chunk));
    request.on("end", () => resolve(Buffer.concat(chunks)));
    request.on("error", reject);
  });
}

function rewriteHtml(html: string, baseUrl: URL): string {
  const bootstrap = `<script>${localProxyBootstrapScript(baseUrl)}</script>`;
  return html
    .replace(/<head([^>]*)>/i, `<head$1>${bootstrap}`)
    .replace(/\b(href|src|action|poster)=("|')([^"']+)\2/gi, (_match, attr, quote, value) => {
      const rewritten = rewriteUrl(value, baseUrl);
      return `${attr}=${quote}${rewritten ?? value}${quote}`;
    })
    .replace(/\bsrcset=("|')([^"']+)\1/gi, (_match, quote, value) => {
      const rewritten = value
        .split(",")
        .map((candidate) => {
          const [url, ...descriptor] = candidate.trim().split(/\s+/);
          return [rewriteUrl(url, baseUrl) ?? url, ...descriptor].join(" ");
        })
        .join(", ");
      return `srcset=${quote}${rewritten}${quote}`;
    });
}

function rewriteCss(css: string, baseUrl: URL): string {
  return css
    .replace(/url\((["']?)([^"')]+)\1\)/g, (_match, quote, value) => {
      const rewritten = rewriteUrl(value, baseUrl);
      return rewritten ? `url(${quote}${rewritten}${quote})` : `url(${quote}${value}${quote})`;
    })
    .replace(/@import\s+(["'])([^"']+)\1/g, (_match, quote, value) => {
      const rewritten = rewriteUrl(value, baseUrl);
      return rewritten ? `@import ${quote}${rewritten}${quote}` : `@import ${quote}${value}${quote}`;
    });
}

function rewriteJavaScript(script: string, baseUrl: URL): string {
  return script
    .replace(/\bimport\(\s*(["'])([^"']+)\1\s*\)/g, (match, quote, value) => {
      const rewritten = rewriteModuleAssetUrl(value, baseUrl);
      return rewritten ? `import(${quote}${rewritten}${quote})` : match;
    })
    .replace(/\b(from|import)(\s*)(["'])(\.\/[^"']+\.(?:js|css)(?:\?[^"']*)?)\3/g, (match, keyword, space, quote, value) => {
      const rewritten = rewriteModuleAssetUrl(value, baseUrl);
      return rewritten ? `${keyword}${space}${quote}${rewritten}${quote}` : match;
    })
    .replace(/(["'])(static\/[^"']+\.(?:js|css)(?:\?[^"']*)?)\1/g, (match, quote, value) => {
      const rewritten = rewriteModuleAssetUrl(value, baseUrl);
      const viteDependency = rewritten?.startsWith("/") ? rewritten.slice(1) : rewritten;
      return viteDependency ? `${quote}${viteDependency}${quote}` : match;
    });
}

function rewriteModuleAssetUrl(value: string, baseUrl: URL): string | undefined {
  if (!value || isSpecialUrl(value) || value.trim().startsWith(`${dwProxyPath}?`)) {
    return undefined;
  }

  try {
    const url = value.startsWith("static/")
      ? new URL(`/${value}`, baseUrl.origin)
      : new URL(value, baseUrl);
    return isAllowedDwProxyHost(url.hostname) ? proxiedUrl(url) : url.href;
  } catch {
    return undefined;
  }
}

function rewriteSetCookieHeaders(sourceHeaders: Headers, targetHeaders: Headers): void {
  targetHeaders.delete("set-cookie");

  getSetCookieHeaders(sourceHeaders).forEach((cookie) => {
    targetHeaders.append("set-cookie", rewriteCookie(cookie));
  });
}

function getSetCookieHeaders(headers: Headers): string[] {
  const headersWithHelpers = headers as Headers & {
    getSetCookie?: () => string[];
    getAll?: (name: string) => string[];
  };

  if (typeof headersWithHelpers.getSetCookie === "function") {
    return headersWithHelpers.getSetCookie();
  }

  if (typeof headersWithHelpers.getAll === "function") {
    return headersWithHelpers.getAll("set-cookie");
  }

  const cookie = headers.get("set-cookie");
  return cookie ? [cookie] : [];
}

function rewriteCookie(cookie: string): string {
  const parts = cookie
    .split(";")
    .map((part) => part.trim())
    .filter((part) => !/^domain=/i.test(part))
    .map((part) => /^path=/i.test(part) ? "Path=/" : part);

  if (!parts.some((part) => /^path=/i.test(part))) {
    parts.push("Path=/");
  }

  return parts.join("; ");
}

function rewriteUrl(value: string, baseUrl: URL): string | undefined {
  if (!value || isSpecialUrl(value) || value.trim().startsWith(`${dwProxyPath}?`)) {
    return undefined;
  }

  try {
    const url = new URL(value, baseUrl);
    return isAllowedDwProxyHost(url.hostname) ? proxiedUrl(url) : url.href;
  } catch {
    return undefined;
  }
}

function proxiedUrl(url: URL): string {
  return `${dwProxyPath}?url=${encodeURIComponent(url.href)}`;
}

function isAllowedDwProxyHost(hostname: string): boolean {
  const host = hostname.toLowerCase();
  return dwProxyAllowedSuffixes.some((suffix) => host === suffix || host.endsWith(`.${suffix}`));
}

function isSpecialUrl(value: string): boolean {
  return /^(about:|blob:|data:|javascript:|mailto:|tel:|#)/i.test(value.trim());
}

function isJavaScriptContent(contentType: string): boolean {
  return /\b(?:java|ecma)script\b/i.test(contentType) || /\bmodule\b/i.test(contentType);
}

function localProxyBootstrapScript(target: URL): string {
  return `
(() => {
  const proxyPath = ${JSON.stringify(dwProxyPath)};
  const targetHref = ${JSON.stringify(target.href)};
  const allowedSuffixes = ${JSON.stringify(dwProxyAllowedSuffixes)};
  const targetUrl = new URL(targetHref);
  const targetLocalPath = targetUrl.pathname + targetUrl.search + targetUrl.hash;
  if (window.location.pathname === proxyPath && targetLocalPath.startsWith("/")) {
    window.history.replaceState(window.history.state, "", targetLocalPath);
  }
  const isAllowed = (hostname) => {
    const host = String(hostname || "").toLowerCase();
    return allowedSuffixes.some((suffix) => host === suffix || host.endsWith("." + suffix));
  };
  const proxify = (value) => {
    if (!value || /^(about:|blob:|data:|javascript:|mailto:|tel:|#)/i.test(String(value).trim())) return value;
    try {
      const url = new URL(value, targetHref);
      return isAllowed(url.hostname) ? proxyPath + "?url=" + encodeURIComponent(url.href) : url.href;
    } catch {
      return value;
    }
  };
  const originalFetch = window.fetch;
  window.fetch = (input, init) => {
    if (typeof input === "string" || input instanceof URL) return originalFetch(proxify(String(input)), init);
    if (input instanceof Request) return originalFetch(new Request(proxify(input.url), input), init);
    return originalFetch(input, init);
  };
  const originalOpen = XMLHttpRequest.prototype.open;
  XMLHttpRequest.prototype.open = function(method, url, ...rest) {
    return originalOpen.call(this, method, proxify(url), ...rest);
  };
})();
`;
}
