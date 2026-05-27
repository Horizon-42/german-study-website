export type Route = "/" | "/dashboard" | "/review" | "/articles" | "/dw" | "/words" | "/words/new" | "/notebooks" | "/import" | "/settings";

export function readRoute(): Route {
  const path = window.location.pathname;
  return ["/", "/dashboard", "/review", "/articles", "/dw", "/words", "/words/new", "/notebooks", "/import", "/settings"].includes(path)
    ? (path as Route)
    : "/";
}
