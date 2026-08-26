import type { Metadata } from "next";
import { CardDashboard, type PublicCardPolicy } from "./CardDashboard";

export const metadata: Metadata = {
  title: "Private Card: Programmatic STRK20 Settlement",
  description:
    "Monitor Stripe-compatible authorizations and asynchronous private settlement through STRK20 on Starknet Sepolia.",
};

function publicValue(name: string): string | undefined {
  const value = process.env[name]?.trim();
  return value || undefined;
}

export default function CardPage() {
  const policy: PublicCardPolicy = {
    perSwipeCap: publicValue("CARD_MAX_PER_TX_USDC"),
    dailyCap: publicValue("CARD_DAILY_CAP_LABEL") || "5 STRK onchain",
    lendOnRestaurants: publicValue("CARD_LEND_UNITS") ? "1 STRK to earn vault" : undefined,
    allowedCountries: publicValue("CARD_ALLOWED_COUNTRIES"),
    blockedCategories: publicValue("CARD_BLOCKED_MERCHANT_CATEGORIES"),
  };

  return <CardDashboard policy={policy} />;
}
