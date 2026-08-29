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
    dailyCap: publicValue("CARD_DAILY_CAP_LABEL") || "100 STRK onchain",
    lendOnRestaurants: lendOnRestaurantsLabel(),
    allowedCountries: publicValue("CARD_ALLOWED_COUNTRIES"),
    blockedCategories: publicValue("CARD_BLOCKED_MERCHANT_CATEGORIES"),
  };

  return <CardDashboard policy={policy} />;
}
