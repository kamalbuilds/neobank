import type { Metadata } from "next";
import { AuthorizationProofClient } from "./AuthorizationProofClient";

type Props = {
  params: Promise<{ authorizationId: string }>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { authorizationId } = await params;
  return {
    title: `Sealed: proof for ${authorizationId}`,
    description: "Source-of-funds proof for one card authorization, re-read from Starknet at request time.",
  };
}

export default function AuthorizationProofPage() {
  return <AuthorizationProofClient />;
}
