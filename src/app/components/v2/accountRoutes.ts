/** Canonical account URLs. Nav and tests import this so a dropped href fails. */
export const ACCOUNT_ROUTES = [
  { href: "/", label: "Hold" },
  { href: "/convert", label: "Convert" },
  { href: "/earn", label: "Earn" },
  { href: "/spend", label: "Spend" },
  { href: "/fund", label: "Fund" },
  { href: "/card", label: "Card" },
  { href: "/statements", label: "Statements" },
] as const;

/** Private-move routes that share chrome but are not RFP primary verbs. */
export const ACCOUNT_MOVE_ROUTES = [
  { href: "/send", label: "Send" },
  { href: "/receive", label: "Receive" },
  { href: "/unshield", label: "Unshield" },
] as const;

export type AccountHref =
  | (typeof ACCOUNT_ROUTES)[number]["href"]
  | (typeof ACCOUNT_MOVE_ROUTES)[number]["href"];

export const ALL_ACCOUNT_HREFS: readonly string[] = [
  ...ACCOUNT_ROUTES.map((r) => r.href),
  ...ACCOUNT_MOVE_ROUTES.map((r) => r.href),
];
