const allowedHostSuffixes = ["dw.com", "dwcdn.net"];
const proxyPath = "/dw-proxy";
const blockedRequestHeaders = new Set([
  "cf-connecting-ip",
  "cf-ipcountry",
  "cf-ray",
  "cf-visitor",
  "connection",
  "content-length",
  "host",
  "x-forwarded-for",
  "x-forwarded-host",
  "x-forwarded-proto",
]);
const removedResponseHeaders = [
  "content-security-policy",
  "content-security-policy-report-only",
  "cross-origin-embedder-policy",
  "cross-origin-opener-policy",
  "cross-origin-resource-policy",
  "permissions-policy",
  "x-frame-options",
];

export async function onRequest({ request }) {
  const parsed = parseProxyRequest(request.url);

  if (!parsed.ok) {
    return new Response(parsed.message, {
      status: parsed.status,
      headers: proxyHeaders({ "content-type": "text/plain; charset=utf-8" }),
    });
  }

  const upstreamRequest = new Request(parsed.target.href, {
    method: request.method,
    headers: upstreamHeaders(request.headers, parsed.target),
    body: ["GET", "HEAD"].includes(request.method) ? undefined : request.body,
    redirect: "manual",
  });
  const upstreamResponse = await fetch(upstreamRequest);
  const headers = responseHeaders(upstreamResponse.headers, parsed.target);
  const location = upstreamResponse.headers.get("location");

  if (location) {
    headers.set("location", proxiedUrl(new URL(location, parsed.target)));
  }

  const contentType = upstreamResponse.headers.get("content-type") ?? "";

  if (contentType.includes("text/html")) {
    const response = new Response(upstreamResponse.body, {
      status: upstreamResponse.status,
      statusText: upstreamResponse.statusText,
      headers,
    });

    return new HTMLRewriter()
      .on("head", new ProxyBootstrapRewriter(parsed.target))
      .on("[href]", new AttributeRewriter("href", parsed.target))
      .on("[src]", new AttributeRewriter("src", parsed.target))
      .on("[action]", new AttributeRewriter("action", parsed.target))
      .on("[poster]", new AttributeRewriter("poster", parsed.target))
      .on("[srcset]", new SrcSetRewriter("srcset", parsed.target))
      .transform(response);
  }

  if (contentType.includes("text/css")) {
    const css = await upstreamResponse.text();
    return new Response(rewriteCss(css, parsed.target), {
      status: upstreamResponse.status,
      statusText: upstreamResponse.statusText,
      headers,
    });
  }

  if (isJavaScriptContent(contentType)) {
    const script = await upstreamResponse.text();
    return new Response(rewriteJavaScript(script, parsed.target), {
      status: upstreamResponse.status,
      statusText: upstreamResponse.statusText,
      headers,
    });
  }

  return new Response(upstreamResponse.body, {
    status: upstreamResponse.status,
    statusText: upstreamResponse.statusText,
    headers,
  });
}

function parseProxyRequest(requestUrl) {
  const url = new URL(requestUrl);
  const rawTarget = url.searchParams.get("url");

  if (!rawTarget) {
    return { ok: false, status: 400, message: "Missing DW proxy target URL." };
  }

  let target;
  try {
    target = new URL(rawTarget);
  } catch {
    return { ok: false, status: 400, message: "Invalid DW proxy target URL." };
  }

  if (target.protocol !== "https:" || !isAllowedHost(target.hostname)) {
    return { ok: false, status: 403, message: "DW proxy target is not allowed." };
  }

  return { ok: true, target };
}

function upstreamHeaders(headers, target) {
  const next = new Headers();

  headers.forEach((value, key) => {
    const lowered = key.toLowerCase();
    if (!blockedRequestHeaders.has(lowered)) {
      next.set(key, value);
    }
  });

  next.set("accept-encoding", "identity");
  next.set("origin", target.origin);
  next.set("referer", target.href);
  return next;
}

function responseHeaders(headers, target) {
  const next = new Headers(headers);

  removedResponseHeaders.forEach((header) => next.delete(header));
  next.delete("content-encoding");
  next.delete("content-length");
  next.set("cache-control", "no-store");
  next.set("x-dw-proxy-target", target.origin);
  rewriteSetCookieHeaders(headers, next);
  return proxyHeaders(next);
}

function rewriteSetCookieHeaders(sourceHeaders, targetHeaders) {
  targetHeaders.delete("set-cookie");
  const cookies = getSetCookieHeaders(sourceHeaders);

  cookies.forEach((cookie) => {
    targetHeaders.append("set-cookie", rewriteCookie(cookie));
  });
}

function getSetCookieHeaders(headers) {
  if (typeof headers.getSetCookie === "function") {
    return headers.getSetCookie();
  }

  if (typeof headers.getAll === "function") {
    return headers.getAll("set-cookie");
  }

  const cookie = headers.get("set-cookie");
  return cookie ? [cookie] : [];
}

function rewriteCookie(cookie) {
  const parts = cookie
    .split(";")
    .map((part) => part.trim())
    .filter((part) => !/^domain=/i.test(part))
    .map((part) => /^path=/i.test(part) ? "Path=/" : part);

  if (!parts.some((part) => /^path=/i.test(part))) {
    parts.push("Path=/");
  }

  if (!parts.some((part) => /^secure$/i.test(part))) {
    parts.push("Secure");
  }

  return parts.join("; ");
}

class ProxyBootstrapRewriter {
  constructor(target) {
    this.target = target;
  }

  element(element) {
    element.prepend(`<script>${proxyBootstrapScript(this.target)}</script>`, { html: true });
  }
}

class AttributeRewriter {
  constructor(attribute, baseUrl) {
    this.attribute = attribute;
    this.baseUrl = baseUrl;
  }

  element(element) {
    const value = element.getAttribute(this.attribute);
    const rewritten = rewriteUrl(value, this.baseUrl);

    if (rewritten) {
      element.setAttribute(this.attribute, rewritten);
    }
  }
}

class SrcSetRewriter {
  constructor(attribute, baseUrl) {
    this.attribute = attribute;
    this.baseUrl = baseUrl;
  }

  element(element) {
    const value = element.getAttribute(this.attribute);
    if (!value) {
      return;
    }

    element.setAttribute(this.attribute, value
      .split(",")
      .map((candidate) => {
        const [url, ...descriptor] = candidate.trim().split(/\s+/);
        return [rewriteUrl(url, this.baseUrl) ?? url, ...descriptor].join(" ");
      })
      .join(", "));
  }
}

function rewriteCss(css, baseUrl) {
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

function rewriteJavaScript(script, baseUrl) {
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

function rewriteModuleAssetUrl(value, baseUrl) {
  if (!value || isSpecialUrl(value) || value.trim().startsWith(`${proxyPath}?`)) {
    return undefined;
  }

  let url;
  try {
    url = value.startsWith("static/")
      ? new URL(`/${value}`, baseUrl.origin)
      : new URL(value, baseUrl);
  } catch {
    return undefined;
  }

  return isAllowedHost(url.hostname) ? proxiedUrl(url) : url.href;
}

function rewriteUrl(value, baseUrl) {
  if (!value || isSpecialUrl(value) || value.trim().startsWith(`${proxyPath}?`)) {
    return undefined;
  }

  let url;
  try {
    url = new URL(value, baseUrl);
  } catch {
    return undefined;
  }

  return isAllowedHost(url.hostname) ? proxiedUrl(url) : url.href;
}

function proxiedUrl(url) {
  return `${proxyPath}?url=${encodeURIComponent(url.href)}`;
}

function isAllowedHost(hostname) {
  const host = hostname.toLowerCase();
  return allowedHostSuffixes.some((suffix) => host === suffix || host.endsWith(`.${suffix}`));
}

function isSpecialUrl(value) {
  return /^(about:|blob:|data:|javascript:|mailto:|tel:|#)/i.test(value.trim());
}

function isJavaScriptContent(contentType) {
  return /\b(?:java|ecma)script\b/i.test(contentType) || /\bmodule\b/i.test(contentType);
}

function proxyHeaders(headers) {
  const next = new Headers(headers);
  next.set("x-robots-tag", "noindex, nofollow");
  return next;
}

function proxyBootstrapScript(target) {
  return `
(() => {
  const proxyPath = ${JSON.stringify(proxyPath)};
  const targetHref = ${JSON.stringify(target.href)};
  const allowedSuffixes = ${JSON.stringify(allowedHostSuffixes)};
  const targetUrl = new URL(targetHref);
  const targetLocalPath = targetUrl.pathname + targetUrl.search + targetUrl.hash;
  if (window.location.pathname === proxyPath && targetLocalPath.startsWith("/")) {
    window.history.replaceState(window.history.state, "", targetLocalPath);
  }
  const isAllowed = (hostname) => {
    const host = String(hostname || "").toLowerCase();
    return allowedSuffixes.some((suffix) => host === suffix || host.endsWith("." + suffix));
  };
  const shouldIgnore = (value) => /^(about:|blob:|data:|javascript:|mailto:|tel:|#)/i.test(String(value || "").trim());
  const proxify = (value) => {
    if (!value || shouldIgnore(value)) return value;
    try {
      const url = new URL(value, targetHref);
      return isAllowed(url.hostname) ? proxyPath + "?url=" + encodeURIComponent(url.href) : url.href;
    } catch {
      return value;
    }
  };
  const originalFetch = window.fetch;
  window.fetch = (input, init) => {
    if (typeof input === "string" || input instanceof URL) {
      return originalFetch(proxify(String(input)), init);
    }
    if (input instanceof Request) {
      return originalFetch(new Request(proxify(input.url), input), init);
    }
    return originalFetch(input, init);
  };
  const originalOpen = XMLHttpRequest.prototype.open;
  XMLHttpRequest.prototype.open = function(method, url, ...rest) {
    return originalOpen.call(this, method, proxify(url), ...rest);
  };
  if (navigator.sendBeacon) {
    const originalSendBeacon = navigator.sendBeacon.bind(navigator);
    navigator.sendBeacon = (url, data) => originalSendBeacon(proxify(url), data);
  }
})();
`;
}
