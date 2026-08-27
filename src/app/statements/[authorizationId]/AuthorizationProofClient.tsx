"use client";

import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { AccountChrome } from "../../components/v2/AccountChrome";
import { Skeleton } from "../../components/v2/ui";

type ProofJson = {
  formatVersion: number;
  cardholderAlias: string;
  authorizationId: string;
  settledTxHash: string;
  settleAmount: {
    units: string;
    decimals: number;
    origin: {
      call: {
        contractAddress: string;
        entrypoint: string;
        blockNumber: number;
        blockTag: string;
      };
    };
  };
  lenDidOnchainEventRef: boolean;
  positionActions: Array<{
    kind: string;
    vault?: string;
    amount: { units: string; origin: { call: { entrypoint: string; blockNumber: number } } };
  }>;
  generatedAtBlock: number;
};

function fromUnits(units: string, decimals: number): string {
  const value = BigInt(units);
  const scale = 10n ** BigInt(decimals);
  const whole = value / scale;
  const frac = (value % scale).toString().padStart(decimals, "0").replace(/0+$/, "");
  return frac.length > 0 ? `${whole}.${frac}` : `${whole}`;
}

export function AuthorizationProofClient() {
  const params = useParams();
  const authorizationId = Array.isArray(params.authorizationId)
    ? params.authorizationId[0]
    : params.authorizationId;

  const [proof, setProof] = useState<ProofJson | null>(null);
  const [text, setText] = useState<string | null>(null);
  const [status, setStatus] = useState<"loading" | "ready" | "missing">("loading");

  useEffect(() => {
    let cancelled = false;
    async function load() {
      if (!authorizationId) {
        setStatus("missing");
        return;
      }
      try {
        const [jsonRes, textRes] = await Promise.all([
          fetch(
            `/api/card/statement?view=proof&authorizationId=${encodeURIComponent(authorizationId)}`,
            { cache: "no-store" },
          ),
          fetch(
            `/api/card/statement?view=proof&format=text&authorizationId=${encodeURIComponent(authorizationId)}`,
            { cache: "no-store" },
          ),
        ]);
        if (cancelled) return;
        if (!jsonRes.ok || !textRes.ok) {
          setStatus("missing");
          return;
        }
        setProof((await jsonRes.json()) as ProofJson);
        setText(await textRes.text());
        setStatus("ready");
      } catch {
        if (!cancelled) setStatus("missing");
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [authorizationId]);

  return (
    <AccountChrome>
      <div className="rounded-3xl border border-white/[0.07] bg-white/[0.028] elevate-1 p-6">
        <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[#7a859c]">
          Source-of-funds proof
        </div>
        <h1 className="mt-2 font-[family-name:var(--font-display)] text-[28px] font-semibold tracking-[-0.02em]">
          One authorization, scoped to the viewing key
        </h1>
        <p className="mt-3 max-w-2xl text-[14px] leading-relaxed text-[#7a859c]">
          Everything on this page is re-read from Starknet at request time and names the
          contract call plus the block each number was read at. The cardholder is shown
          pseudonymously: no address and no key material leaves the hosted account.
        </p>

        {status === "loading" && (
          <div className="mt-6 grid grid-cols-1 gap-2 sm:grid-cols-2" aria-busy="true" aria-label="Reading proof">
            <Skeleton className="h-16" />
            <Skeleton className="h-16" />
            <Skeleton className="h-16" />
            <Skeleton className="h-16" />
          </div>
        )}

        {status === "missing" && (
          <div className="mt-6 rounded-2xl border border-white/[0.06] bg-[#0b0d13]/80 p-5">
            <p className="text-sm text-[#f0a8a8]" role="alert">
              No settled authorization at this id. Nothing about any other authorization is
              disclosed.
            </p>
            <a href="/statements" className="mt-3 inline-block text-sm text-[#9ae9da] underline">
              Back to statements
            </a>
          </div>
        )}

        {status === "ready" && proof && (
          <div className="mt-6 space-y-4">
            <dl className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              <div className="rounded-2xl border border-white/[0.06] bg-[#0b0d13]/80 p-4">
                <dt className="text-[10px] uppercase tracking-[0.14em] text-[#7a859c]">
                  Cardholder alias
                </dt>
                <dd className="mt-1 font-mono text-[13px]">{proof.cardholderAlias}</dd>
              </div>
              <div className="rounded-2xl border border-white/[0.06] bg-[#0b0d13]/80 p-4">
                <dt className="text-[10px] uppercase tracking-[0.14em] text-[#7a859c]">
                  Settle amount
                </dt>
                <dd className="mt-1 font-mono text-[13px]">
                  {fromUnits(proof.settleAmount.units, proof.settleAmount.decimals)} via{" "}
                  {proof.settleAmount.origin.call.entrypoint} @ block{" "}
                  {proof.settleAmount.origin.call.blockNumber}
                </dd>
              </div>
              <div className="rounded-2xl border border-white/[0.06] bg-[#0b0d13]/80 p-4">
                <dt className="text-[10px] uppercase tracking-[0.14em] text-[#7a859c]">
                  Settled transaction
                </dt>
                <dd className="mt-1 break-all font-mono text-[12px]">{proof.settledTxHash}</dd>
              </div>
              <div className="rounded-2xl border border-white/[0.06] bg-[#0b0d13]/80 p-4">
                <dt className="text-[10px] uppercase tracking-[0.14em] text-[#7a859c]">
                  Onchain event reference
                </dt>
                <dd className="mt-1 font-mono text-[13px]">
                  {proof.lenDidOnchainEventRef ? "yes" : "no"} · generated at block{" "}
                  {proof.generatedAtBlock}
                </dd>
              </div>
            </dl>

            {proof.positionActions.map((action) => (
              <p
                key={`${action.kind}-${action.amount.units}`}
                className="rounded-2xl border border-white/[0.06] bg-[#0b0d13]/80 p-4 font-mono text-[12px]"
              >
                {action.kind} {fromUnits(action.amount.units, 18)} at{" "}
                {action.vault ?? "pool"} via {action.amount.origin.call.entrypoint} @ block{" "}
                {action.amount.origin.call.blockNumber}
              </p>
            ))}

            <div>
              <p className="text-[11px] uppercase tracking-[0.14em] text-[#7a859c]">
                Text export
              </p>
              <p className="mt-1 max-w-xl text-[12.5px] leading-relaxed text-[#7a859c]">
                Computed server-side over the same fields above. Deterministic: the same bundle
                renders byte-identically every time, which is what lets two people attaching it
                to a compliance ticket agree line for line.
              </p>
              <pre className="mt-3 overflow-x-auto whitespace-pre-wrap rounded-2xl border border-white/[0.06] bg-[#0b0d13]/90 p-4 font-mono text-[11.5px] leading-relaxed text-[#d8deea]">
{text}
              </pre>
            </div>
          </div>
        )}
      </div>
    </AccountChrome>
  );
}
