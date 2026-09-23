"use client";

import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { explorerTxUrl } from "@/utils/constants";
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
  copy?: string;
};

type Status = "loading" | "ready" | "missing" | "error";

function fromUnits(units: string, decimals: number): string {
  const value = BigInt(units);
  const scale = 10n ** BigInt(decimals);
  const whole = value / scale;
  const frac = (value % scale).toString().padStart(decimals, "0").replace(/0+$/, "");
  return frac.length > 0 ? `${whole}.${frac}` : `${whole}`;
}

function clockUtc(at: Date): string {
  return `${at.toISOString().slice(0, 16).replace("T", " ")} UTC`;
}

const SHEET = "paper paper-torn relative mx-auto w-full max-w-[620px] px-7 pb-7 pt-9 sm:px-9";

function SheetHead({ title }: { title: string }) {
  return (
    <div className="flex items-start justify-between gap-4">
      <div>
        <div className="text-[11px] font-semibold uppercase tracking-[0.2em] text-paper-muted">
          Sealed · source-of-funds proof
        </div>
        <h1 className="mt-1 max-w-[18ch] text-balance font-[family-name:var(--font-display)] text-[24px] leading-[1.08] tracking-[-0.015em] text-paper-ink">
          {title}
        </h1>
      </div>
      <span className="figure mt-1 inline-flex shrink-0 rotate-[-3deg] items-center border border-[color:var(--seal)] px-2 py-0.5 text-[13px] font-semibold uppercase tracking-[0.1em] text-seal">
        Sepolia
      </span>
    </div>
  );
}

function Row({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rule-paper flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1 py-2.5">
      <dt className="text-[13px] text-paper-muted">{label}</dt>
      <dd className="figure min-w-0 break-all text-right text-[13px] font-semibold text-paper-ink">
        {children}
      </dd>
    </div>
  );
}

export function AuthorizationProofClient() {
  const params = useParams();
  const authorizationId = Array.isArray(params.authorizationId)
    ? params.authorizationId[0]
    : params.authorizationId;

  const [proof, setProof] = useState<ProofJson | null>(null);
  const [text, setText] = useState<string | null>(null);
  const [status, setStatus] = useState<Status>("loading");
  const [readAt, setReadAt] = useState<Date | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

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
        // 404 is the deliberate "nothing settled under this id" answer. Any
        // other failure is the server or the node being unavailable, which is
        // a different thing to tell the reader.
        if (jsonRes.status === 404 || textRes.status === 404) {
          setStatus("missing");
          return;
        }
        if (!jsonRes.ok || !textRes.ok) {
          setErrorMessage(
            jsonRes.status === 503
              ? "The card runtime is not configured on this deployment, so no proof can be built."
              : `The proof endpoint answered ${jsonRes.ok ? textRes.status : jsonRes.status}.`,
          );
          setStatus("error");
          return;
        }
        setProof((await jsonRes.json()) as ProofJson);
        setText(await textRes.text());
        setReadAt(new Date());
        setStatus("ready");
      } catch (err) {
        if (cancelled) return;
        setErrorMessage(
          err instanceof Error ? err.message : "The proof endpoint did not answer.",
        );
        setStatus("error");
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [authorizationId]);

  return (
    <AccountChrome>
      {status === "loading" && (
        <div className={SHEET} aria-busy="true" aria-label="Reading proof">
          <SheetHead title="Reading this authorization from Starknet" />
          <div className="mt-6 flex flex-col gap-2.5">
            <Skeleton className="skeleton-paper h-4 w-3/4" />
            <Skeleton className="skeleton-paper h-4 w-2/3" />
            <Skeleton className="skeleton-paper h-4 w-1/2" />
            <Skeleton className="skeleton-paper h-4 w-4/5" />
          </div>
        </div>
      )}

      {status === "missing" && (
        <div className={SHEET}>
          <SheetHead title="No settled authorization at this id" />
          <p className="mt-5 text-[15px] leading-relaxed text-paper-ink" role="alert">
            Nothing about any other authorization is disclosed.
          </p>
          <p className="mt-2 text-[13px] leading-relaxed text-paper-muted">
            If the swipe only just happened, the settlement may still be confirming. Look the id up
            again from the statements page.
          </p>
          <a
            href="/statements"
            className="mt-5 inline-flex h-9 items-center rounded-[4px] border border-[color:var(--paper-line)] px-4 text-[13px] font-semibold text-paper-ink transition-[background-color,transform] duration-150 hover:bg-paper-2 active:scale-[0.97]"
          >
            Back to statements
          </a>
        </div>
      )}

      {status === "error" && (
        <div className={SHEET}>
          <SheetHead title="This proof could not be built" />
          <p className="mt-5 text-[15px] leading-relaxed text-paper-ink" role="alert">
            {errorMessage || "The proof endpoint did not answer."}
          </p>
          <p className="mt-2 text-[13px] leading-relaxed text-paper-muted">
            No figure is being shown in place of the ones that failed to read. Reload to retry.
          </p>
          <a
            href="/statements"
            className="mt-5 inline-flex h-9 items-center rounded-[4px] border border-[color:var(--paper-line)] px-4 text-[13px] font-semibold text-paper-ink transition-[background-color,transform] duration-150 hover:bg-paper-2 active:scale-[0.97]"
          >
            Back to statements
          </a>
        </div>
      )}

      {status === "ready" && proof && (
        <div className={`${SHEET} animate-rise-in`}>
          <SheetHead title="What this one swipe settled" />

          <p className="mt-4 text-[13px] leading-relaxed text-paper-muted">
            Every number here is read fresh from Starknet, not stored. Each one names the exact
            block it came from. Your identity stays pseudonymous: no wallet address or key ever
            leaves your account.
          </p>

          <dl className="mt-6">
            <Row label="Cardholder alias">{proof.cardholderAlias}</Row>
            <Row label="Authorization">{proof.authorizationId}</Row>
            <Row label="Settle amount">
              <span className="text-[18px] font-bold">
                {fromUnits(proof.settleAmount.units, proof.settleAmount.decimals)}
              </span>{" "}
              <span className="text-[13px] font-semibold text-paper-muted">STRK</span>
            </Row>
            <Row label="Read via">
              {proof.settleAmount.origin.call.entrypoint} at block{" "}
              {proof.settleAmount.origin.call.blockNumber}
            </Row>
            <Row label="Program contract">
              {proof.settleAmount.origin.call.contractAddress}
            </Row>
            <Row label="On-chain event reference">
              {proof.lenDidOnchainEventRef ? "yes" : "no"}
            </Row>
            <Row label="Generated at block">{proof.generatedAtBlock}</Row>
          </dl>

          <div className="mt-6">
            <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-paper-muted">
              Position actions
            </div>
            {proof.positionActions.length === 0 ? (
              <p className="mt-2 text-[13px] leading-relaxed text-paper-muted">
                This swipe opened no vault position. It settled the merchant and nothing else.
              </p>
            ) : (
              <dl className="mt-1">
                {proof.positionActions.map((action) => (
                  <div
                    key={`${action.kind}-${action.amount.units}`}
                    className="rule-paper flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1 py-2.5"
                  >
                    <dt className="min-w-0 text-[13px] text-paper-muted">
                      {action.kind} into{" "}
                      <span className="figure break-all normal-case tracking-normal">
                        {action.vault ?? "pool"}
                      </span>
                    </dt>
                    <dd className="figure min-w-0 break-all text-right text-[13px] font-semibold text-paper-ink">
                      {fromUnits(action.amount.units, 18)}{" "}
                      <span className="text-[13px] text-paper-muted">
                        STRK · {action.amount.origin.call.entrypoint} at block{" "}
                        {action.amount.origin.call.blockNumber}
                      </span>
                    </dd>
                  </div>
                ))}
              </dl>
            )}
          </div>

          <div className="rule-paper mt-6 pt-4">
            <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-paper-muted">
              Settled transaction
            </div>
            <a
              href={explorerTxUrl("sepolia", proof.settledTxHash)}
              target="_blank"
              rel="noreferrer"
              className="figure mt-2 block break-all text-[13px] text-paper-ink underline decoration-[color:var(--paper-line)] underline-offset-4 hover:decoration-[color:var(--seal)]"
            >
              {proof.settledTxHash}
            </a>
            <p className="mt-2 text-[13px] text-paper-muted">Opens on Voyager, Sepolia.</p>
          </div>

          {readAt && (
            <p className="figure mt-4 text-[13px] text-paper-muted">
              Built on Sepolia at head block {proof.generatedAtBlock}, delivered to this page at{" "}
              {clockUtc(readAt)}, this browser clock. The bundle carries no block timestamp, so the
              clock above is the page&apos;s, not the chain&apos;s.
            </p>
          )}

          {proof.copy ? (
            <p className="mt-4 text-[13px] leading-relaxed text-paper-muted">{proof.copy}</p>
          ) : null}

          <details className="group mt-6">
            <summary className="cursor-pointer select-none list-none rounded-sm text-[13px] font-semibold uppercase tracking-[0.12em] text-paper-muted transition-colors duration-150 hover:text-paper-ink marker:content-none [&::-webkit-details-marker]:hidden">
              <span className="inline-flex items-center gap-1.5">
                <span
                  aria-hidden="true"
                  className="inline-block transition-transform duration-150 group-open:rotate-90"
                >
                  ›
                </span>
                Text export
              </span>
            </summary>
            <p className="mt-2 max-w-xl text-[13px] leading-relaxed text-paper-muted">
              Computed server-side over the same fields above. Deterministic: the same bundle
              renders byte-identically every time, which is what lets two people attaching it to a
              compliance ticket agree line for line.
            </p>
            <pre className="figure mt-3 overflow-x-auto whitespace-pre-wrap rounded-[4px] border border-[color:var(--paper-line)] bg-paper-2 p-4 text-[13px] leading-relaxed text-paper-ink">
{text}
            </pre>
          </details>
        </div>
      )}
    </AccountChrome>
  );
}
