import { describe, it, expect } from "vitest";
import {
  ACCOUNT_MOVE_ROUTES,
  ACCOUNT_ROUTES,
  ALL_ACCOUNT_HREFS,
} from "@/app/components/v2/accountRoutes";

describe("account route table", () => {
  it("keeps RFP primary verbs and hrefs", () => {
    expect(ACCOUNT_ROUTES.map((r) => r.label)).toEqual([
      "Hold",
      "Convert",
      "Earn",
      "Spend",
      "Fund",
      "Card",
      "Statements",
    ]);
    expect(ACCOUNT_ROUTES.map((r) => r.href)).toEqual([
      "/",
      "/convert",
      "/earn",
      "/spend",
      "/fund",
      "/card",
      "/statements",
    ]);
  });

  it("fails if /earn or /fund is dropped from the nav table", () => {
    expect(ALL_ACCOUNT_HREFS).toContain("/earn");
    expect(ALL_ACCOUNT_HREFS).toContain("/fund");
    expect(ACCOUNT_ROUTES.some((r) => r.href === "/earn" && r.label === "Earn")).toBe(true);
    expect(ACCOUNT_ROUTES.some((r) => r.href === "/fund" && r.label === "Fund")).toBe(true);
  });

  it("keeps private-move routes that share chrome", () => {
    expect(ACCOUNT_MOVE_ROUTES.map((r) => r.href)).toEqual([
      "/send",
      "/receive",
      "/unshield",
    ]);
    for (const href of ["/send", "/receive", "/unshield", "/spend", "/convert"]) {
      expect(ALL_ACCOUNT_HREFS).toContain(href);
    }
  });

  it(
    "imports every owned account page module so a missing file fails",
    async () => {
      const pages = await Promise.all([
        import("@/app/page"),
        import("@/app/spend/page"),
        import("@/app/send/page"),
        import("@/app/receive/page"),
        import("@/app/unshield/page"),
        import("@/app/convert/page"),
        import("@/app/fund/page"),
        import("@/app/earn/page"),
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
