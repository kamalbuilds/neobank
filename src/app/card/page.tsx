import type { Metadata } from "next";
import { CardDashboard, type PublicCardPolicy } from "./CardDashboard";

export const metadata: Metadata = {
  title: "Sealed: your card",
  description:
    "A card funded from your shielded balance. Swipes approve instantly; settlement runs through a hosted account the operator can see and is public on Starknet.",
};

function publicValue(name: string): string | undefined {
  const value = process.env[name]?.trim();
  return value || undefined;
}

function lendOnRestaurantsLabel(): string | undefined {
  const units = publicValue("CARD_LEND_UNITS");
  if (!units) return undefined;
  const whole = BigInt(units) / 1_000_000_000_000_000_000n;
  return `${whole.toString()} STRK to earn vault`;
}

export default function CardPage() {
  const policy: PublicCardPolicy = {
    perSwipeCap: publicValue("CARD_MAX_PER_TX_USDC"),
    // No literal fallback. This used to read `|| "100 STRK onchain"`, and
    // CARD_DAILY_CAP_LABEL is not set on this deployment, so the page printed an
    // invented number carrying the word "onchain" while the contract's own
    // daily_limit is 5 STRK. Wrong by 20x, in the one panel a reader is most
    // likely to check. Undefined here means the dashboard reads the cap off the
    // settlement contract instead, which is the system of record anyway.
    dailyCap: publicValue("CARD_DAILY_CAP_LABEL"),
    lendOnRestaurants: lendOnRestaurantsLabel(),
    allowedCountries: publicValue("CARD_ALLOWED_COUNTRIES"),
    blockedCategories: publicValue("CARD_BLOCKED_MERCHANT_CATEGORIES"),
  };

  return <CardDashboard policy={policy} />;
}
