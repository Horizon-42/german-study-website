export type Route = "/" | "/review" | "/articles" | "/dw" | "/words" | "/words/new" | "/notebooks" | "/import" | "/settings";

export function readRoute(): Route {
  const path = window.location.pathname;
  return ["/", "/review", "/articles", "/dw", "/words", "/words/new", "/notebooks", "/import", "/settings"].includes(path)
    ? (path as Route)
    : "/";
}
