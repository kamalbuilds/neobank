/** Canonical account URLs. Nav and tests import this so a dropped href fails. */

export type RouteItem = { readonly href: string; readonly label: string };

/**
 * The 4 destinations a new user sees in the primary nav. Every other route
 * nests under one of these as a secondary tab (see ROUTE_GROUPS) so the top
 * level never grows past what a neobank actually needs: hold, spend, earn,
 * fund. Nothing here is deleted by nesting - every href below still renders
 * at its own URL.
 */
export const PRIMARY_ROUTES: readonly RouteItem[] = [
  { href: "/", label: "Home" },
  { href: "/spend", label: "Spend" },
  { href: "/earn", label: "Earn" },
  { href: "/fund", label: "Fund" },
] as const;

/**
 * Secondary tabs shown under a primary destination once you're inside it.
 * Keyed by the primary href. The first entry in each group is that primary
 * page itself, so the group doubles as the page's own in-context tab strip.
 */
export const ROUTE_GROUPS: Readonly<Record<string, readonly RouteItem[]>> = {
  "/spend": [
    { href: "/spend", label: "Pay" },
    { href: "/card", label: "Card" },
    { href: "/send", label: "Send" },
    { href: "/statements", label: "Statements" },
  ],
  "/fund": [
    { href: "/fund", label: "Add money" },
    { href: "/receive", label: "Receive" },
    { href: "/convert", label: "Convert" },
    { href: "/unshield", label: "Withdraw" },
  ],
} as const;

/** Every route reachable from account chrome, primary or nested. */
export const ALL_ACCOUNT_HREFS: readonly string[] = [
  ...PRIMARY_ROUTES.map((r) => r.href),
  ...Object.values(ROUTE_GROUPS).flatMap((group) => group.map((r) => r.href)),
];

/** The primary destination that owns `pathname`, for nav highlighting. */
export function primaryForPath(pathname: string): string {
  if (pathname === "/") return "/";
  for (const [primaryHref, group] of Object.entries(ROUTE_GROUPS)) {
    if (group.some((r) => pathname === r.href || pathname.startsWith(`${r.href}/`))) {
      return primaryHref;
    }
  }
  for (const route of PRIMARY_ROUTES) {
    if (pathname === route.href || pathname.startsWith(`${route.href}/`)) return route.href;
  }
  return "/";
}

export type AccountHref = (typeof ALL_ACCOUNT_HREFS)[number];
