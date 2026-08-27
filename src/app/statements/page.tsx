import type { Metadata } from "next";
import { StatementsClient } from "./StatementsClient";

export const metadata: Metadata = {
  title: "Sotto: source-of-funds statements",
  description: "Viewing-key statements for the hosted card account, scoped to one authorization.",
};

export default function StatementsPage() {
  return <StatementsClient />;
}
