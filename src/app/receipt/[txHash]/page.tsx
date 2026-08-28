import type { Metadata } from "next";
import { ReceiptClient } from "./ReceiptClient";

type Props = {
  params: Promise<{ txHash: string }>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { txHash } = await params;
  return {
    title: `Sealed: receipt for ${txHash.slice(0, 10)}…`,
    description: "Verify a settlement receipt against the live STRK20 pool on Starknet Sepolia.",
  };
}

export default function ReceiptPage() {
  return <ReceiptClient />;
}
