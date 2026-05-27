import { describe, expect, it } from "vitest";
import { dwProxyUrl, isAllowedDwProxyHost } from "./proxy-url";

describe("DW proxy URL", () => {
  it("builds a proxied URL for DW learning pages", () => {
    expect(dwProxyUrl("https://learngerman.dw.com/en/hallo/l-37250531"))
      .toBe("/dw-proxy?url=https%3A%2F%2Flearngerman.dw.com%2Fen%2Fhallo%2Fl-37250531");
  });

  it("allows DW-owned hosts only", () => {
    expect(isAllowedDwProxyHost("learngerman.dw.com")).toBe(true);
    expect(isAllowedDwProxyHost("static.dwcdn.net")).toBe(true);
    expect(isAllowedDwProxyHost("example.com")).toBe(false);
    expect(() => dwProxyUrl("https://example.com/en/hallo")).toThrow("does not allow host");
  });
});
