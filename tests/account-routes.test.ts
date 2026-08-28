import { describe, it, expect } from "vitest";
import {
  ALL_ACCOUNT_HREFS,
  PRIMARY_ROUTES,
  ROUTE_GROUPS,
  primaryForPath,
} from "@/app/components/v2/accountRoutes";

describe("account route table", () => {
  it("keeps the 4 primary destinations a new user sees", () => {
    expect(PRIMARY_ROUTES.map((r) => r.label)).toEqual(["Home", "Spend", "Earn", "Fund"]);
    expect(PRIMARY_ROUTES.map((r) => r.href)).toEqual(["/app", "/spend", "/earn", "/fund"]);
  });

  it("fails if /earn or /fund is dropped from the nav table", () => {
    expect(ALL_ACCOUNT_HREFS).toContain("/earn");
    expect(ALL_ACCOUNT_HREFS).toContain("/fund");
    expect(PRIMARY_ROUTES.some((r) => r.href === "/earn" && r.label === "Earn")).toBe(true);
    expect(PRIMARY_ROUTES.some((r) => r.href === "/fund" && r.label === "Fund")).toBe(true);
  });

  it("nests every non-primary route under Spend or Fund, none dropped", () => {
    expect(ROUTE_GROUPS["/spend"].map((r) => r.href)).toEqual(["/spend", "/card", "/send", "/statements"]);
    expect(ROUTE_GROUPS["/fund"].map((r) => r.href)).toEqual(["/fund", "/receive", "/convert", "/unshield"]);
    for (const href of ["/send", "/receive", "/unshield", "/spend", "/convert", "/card", "/statements"]) {
      expect(ALL_ACCOUNT_HREFS).toContain(href);
    }
  });

  it("routes a nested page's URL back to its primary destination for nav highlighting", () => {
    expect(primaryForPath("/app")).toBe("/app");
    expect(primaryForPath("/card")).toBe("/spend");
    expect(primaryForPath("/send")).toBe("/spend");
    expect(primaryForPath("/statements")).toBe("/spend");
    expect(primaryForPath("/statements/some-id")).toBe("/spend");
    expect(primaryForPath("/receive")).toBe("/fund");
    expect(primaryForPath("/convert")).toBe("/fund");
    expect(primaryForPath("/unshield")).toBe("/fund");
    expect(primaryForPath("/earn")).toBe("/earn");
  });

  it(
    "imports every owned account page module so a missing file fails",
    async () => {
      const pages = await Promise.all([
        import("@/app/page"),
        import("@/app/app/page"),
        import("@/app/spend/page"),
        import("@/app/send/page"),
        import("@/app/receive/page"),
        import("@/app/unshield/page"),
        import("@/app/convert/page"),
        import("@/app/fund/page"),
        import("@/app/earn/page"),
        import("@/app/card/page"),
        import("@/app/statements/page"),
      ]);
      for (const mod of pages) {
        expect(typeof mod.default).toBe("function");
      }
    },
    // Each route now splits into a server page.tsx (metadata) plus a client
    // component, so this pulls in more modules to transform than the 5s
    // default budget covers, especially alongside a concurrently running
    // dev server. The assertion is unchanged: still fails on a missing file.
    20000,
  );
});
