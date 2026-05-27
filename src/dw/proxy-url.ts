const proxyPath = "/dw-proxy";

const allowedHostSuffixes = [
  "dw.com",
  "dwcdn.net",
];

export function dwProxyUrl(targetUrl: string): string {
  const url = new URL(targetUrl);

  if (!isAllowedDwProxyHost(url.hostname)) {
    throw new Error(`DW proxy does not allow host ${url.hostname}.`);
  }

  return `${proxyPath}?url=${encodeURIComponent(url.href)}`;
}

export function isAllowedDwProxyHost(hostname: string): boolean {
  const host = hostname.toLowerCase();
  return allowedHostSuffixes.some((suffix) => host === suffix || host.endsWith(`.${suffix}`));
}
