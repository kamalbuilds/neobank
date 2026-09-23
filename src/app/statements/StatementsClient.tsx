"use client";

import { useCallback, useEffect, useState } from "react";
import { TOKENS } from "@/utils/constants";
import { fromBaseUnits } from "../components/lib/format";
import { AccountChrome } from "../components/v2/AccountChrome";
import { PanelState, Redacted, Skeleton } from "../components/v2/ui";

const DEMO_AUTH = "iauth_dinner_1787803543";

type StatementJson = {
  network?: string;
  accountAddress?: string;
  settled?: boolean;
  authorizationId?: string;
  disclosed?: Array<{
    transactionHash: string;
    explorerTransactionUrl: string;
    authorizationFelt?: string;
    token?: string;
    amount?: string;
    lendAssets?: string;
    blockNumber?: number;
  }>;
  copy?: string;
  error?: string;
  missing?: string[];
};

/** Base units as the token they are denominated in. Never a guessed decimal. */
function amountLabel(units: string, token?: string): string {
  try {
    const isStrk = token ? BigInt(token) === BigInt(TOKENS.STRK.address) : true;
    if (!isStrk) return `${units} units`;
    return `${fromBaseUnits(BigInt(units), TOKENS.STRK.decimals)} STRK`;
  } catch {
    return `${units} units`;
  }
}

function shortHash(hash: string): string {
  return hash.length > 24 ? `${hash.slice(0, 12)}...${hash.slice(-10)}` : hash;
}

function clockUtc(at: Date): string {
  return `${at.toISOString().slice(0, 16).replace("T", " ")} UTC`;
}

export function StatementsClient() {
  const [authId, setAuthId] = useState(DEMO_AUTH);
  const [full, setFull] = useState(false);
  const [payload, setPayload] = useState<StatementJson | null>(null);
  const [readAt, setReadAt] = useState<Date | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({
        scope: "authorization",
        authorizationId: authId,
      });
      if (full) params.set("full", "1");
      const response = await fetch(`/api/card/statement?${params}`, {
        cache: "no-store",
      });
      const body = (await response.json()) as StatementJson;
      if (!response.ok) {
        setPayload(null);
        // A 503 from this route means the card runtime is unconfigured and
        // names which variables are missing. Printing "HTTP 503" instead threw
        // that answer away.
        setError(
          body.error ||
            (Array.isArray(body.missing) && body.missing.length > 0
              ? `The card runtime is not configured on this deployment. Missing: ${body.missing.join(", ")}.`
              : `The statement endpoint answered ${response.status}.`),
        );
        return;
      }
      setPayload(body);
      setReadAt(new Date());
    } catch (err) {
      setPayload(null);
      setError(err instanceof Error ? err.message : "statement_unavailable");
    } finally {
      setLoading(false);
    }
  }, [authId, full]);

  useEffect(() => {
    void load();
  }, [load]);

  const rows = payload?.disclosed ?? [];

  return (
    <AccountChrome>
      <div className="flex flex-col gap-5">
        <div className="doc p-6 sm:p-7">
          <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted">
            Statements
          </div>
          <h1 className="mt-2 max-w-2xl text-balance font-[family-name:var(--font-display)] text-[34px] leading-[1.06] tracking-[-0.015em] text-ink">
            Proof of what one swipe settled
          </h1>
          <p className="mt-3 max-w-xl text-[15px] leading-relaxed text-muted">
            A statement for one card authorization, built from your account&apos;s own records. By
            default it does not show amounts. This is disclosure you choose to see, not a regulator
            filing.
          </p>

          <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-end">
            <div className="flex-1">
              <label
                htmlFor="statement-authorization-id"
                className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted"
              >
                Authorization ID
              </label>
              <input
                id="statement-authorization-id"
                value={authId}
                onChange={(event) => setAuthId(event.target.value)}
                spellCheck={false}
                autoComplete="off"
                className="figure mt-2 h-11 w-full rounded-[4px] border border-[color:var(--line)] bg-black/25 px-3 text-[13px] font-semibold text-ink outline-none transition-[border-color] duration-150 hover:border-[color:var(--line-strong)] focus:border-[color:var(--seal-text)]"
              />
            </div>
            <label className="flex h-11 items-center gap-2 text-[13px] text-ink">
              <input
                type="checkbox"
                checked={full}
                onChange={(event) => setFull(event.target.checked)}
                className="size-4 accent-[color:var(--seal)]"
              />
              Show amounts
            </label>
            <button
              type="button"
              onClick={() => void load()}
              disabled={loading}
              className="h-11 rounded-[4px] border border-[color:var(--seal-soft-2)] bg-[color:var(--seal-soft)] px-4 text-[13px] font-semibold text-seal-bright transition-[background-color,transform] duration-150 hover:bg-[color:var(--seal-soft-2)] active:scale-[0.97] disabled:cursor-wait disabled:opacity-50"
            >
              {loading ? "Looking up..." : "Look up"}
            </button>
          </div>

          {error && (
            <PanelState kind="error" title="This statement could not be read" className="mt-5">
              {error} Nothing is being shown in place of it.
            </PanelState>
          )}
        </div>

        {/* The statement itself is paper: ruled rows, figures in a right-hand
            column, and a real ink bar over anything not disclosed. */}
        {(loading || payload) && !error && (
          <div className="paper paper-torn relative px-6 pb-7 pt-9 sm:px-8">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="text-[11px] font-semibold uppercase tracking-[0.2em] text-paper-muted">
                  Sealed · card statement
                </div>
                <h2 className="figure mt-1 break-all text-[18px] font-bold leading-[1.2] text-paper-ink">
                  {payload?.authorizationId ?? authId}
                </h2>
              </div>
              <span className="figure mt-1 inline-flex shrink-0 rotate-[-3deg] items-center border border-[color:var(--seal)] px-2 py-0.5 text-[13px] font-semibold uppercase tracking-[0.1em] text-seal">
                {payload?.network ?? "sepolia"}
              </span>
            </div>

            {loading && (
              <div
                className="mt-7 flex flex-col gap-2.5"
                aria-busy="true"
                aria-label="Reading statement"
              >
                <Skeleton className="skeleton-paper h-4 w-2/5" />
                <Skeleton className="skeleton-paper h-11" />
                <Skeleton className="skeleton-paper h-11 opacity-70" />
              </div>
            )}

            {!loading && payload && (
              <>
                <div className="rule-paper mt-6 flex items-baseline justify-between gap-4 pt-3">
                  <span className="text-[13px] text-paper-muted">Settlement</span>
                  <span
                    className={`figure text-[13px] font-bold ${
                      payload.settled ? "text-ledger-green" : "text-paper-muted"
                    }`}
                  >
                    {payload.settled ? "Settled" : "Not settled"}
                  </span>
                </div>

                {rows.length === 0 ? (
                  <p className="mt-5 max-w-xl text-[15px] leading-relaxed text-paper-ink">
                    Nothing has settled under this id yet. Pay a swipe on the Card page, copy the
                    authorization ID it returns, then look it up here.
                  </p>
                ) : (
                  <>
                    <div className="mt-5 flex items-baseline justify-between border-b border-[color:var(--paper-line)] pb-1.5">
                      <span className="text-[11px] font-semibold uppercase tracking-[0.16em] text-paper-muted">
                        On-chain settlement
                      </span>
                      <span className="text-[11px] font-semibold uppercase tracking-[0.16em] text-paper-muted">
                        Amount
                      </span>
                    </div>

                    <ul>
                      {rows.map((item) => (
                        <li
                          key={item.transactionHash}
                          className="rule-paper flex items-start justify-between gap-5 py-3 first:border-t-0"
                        >
                          <div className="min-w-0">
                            <a
                              href={item.explorerTransactionUrl}
                              target="_blank"
                              rel="noreferrer"
                              className="figure block text-[13px] font-semibold text-paper-ink underline decoration-[color:var(--paper-line)] underline-offset-4 hover:decoration-[color:var(--seal)]"
                            >
                              {shortHash(item.transactionHash)}
                            </a>
                            <span className="figure mt-1 block text-[13px] text-paper-muted">
                              {item.blockNumber !== undefined
                                ? `${payload.network ?? "sepolia"} · block ${item.blockNumber}`
                                : `${payload.network ?? "sepolia"} · block not reported`}
                            </span>
                          </div>
                          <div className="shrink-0 text-right">
                            <span className="figure block text-[15px] font-bold text-paper-ink">
                              {item.amount ? (
                                <Redacted
                                  key={`settle-${item.transactionHash}-${full}`}
                                  revealed
                                  srLabel="Settled amount"
                                >
                                  {amountLabel(item.amount, item.token)}
                                </Redacted>
                              ) : (
                                <Redacted
                                  revealed={false}
                                  className="w-[104px]"
                                  srLabel="Settled amount withheld"
                                >
                                  {" "}
                                </Redacted>
                              )}
                            </span>
                            <span className="figure mt-1 block text-[13px] text-paper-muted">
                              {item.lendAssets ? (
                                <Redacted
                                  key={`lend-${item.transactionHash}-${full}`}
                                  revealed
                                  srLabel="Lent into the vault"
                                >
                                  {`lent ${amountLabel(item.lendAssets, TOKENS.STRK.address)}`}
                                </Redacted>
                              ) : full ? (
                                "no vault lend"
                              ) : (
                                <Redacted
                                  revealed={false}
                                  className="w-[72px]"
                                  srLabel="Vault lend withheld"
                                >
                                  {" "}
                                </Redacted>
                              )}
                            </span>
                          </div>
                        </li>
                      ))}
                    </ul>

                    {!full && (
                      <p className="mt-4 max-w-xl text-[13px] leading-relaxed text-paper-ink">
                        The bars are real. The amounts are never sent to this page until a viewing
                        key asks for them, and here that key is your own disclosure: tick Show
                        amounts and the statement is rebuilt with the figures in.
                      </p>
                    )}
                  </>
                )}

                {readAt && (
                  <p className="figure rule-paper mt-6 pt-4 text-[13px] text-paper-muted">
                    Read from {payload.network ?? "sepolia"} at {clockUtc(readAt)}, this browser
                    clock. Not cached: the server re-reads the settlement events on every lookup.
                  </p>
                )}
                {payload.copy && (
                  <p className="mt-2 max-w-xl text-[13px] leading-relaxed text-paper-muted">
                    {payload.copy}
                  </p>
                )}
                {payload.accountAddress && (
                  <p className="figure mt-2 break-all text-[13px] text-paper-muted">
                    Hosted account {payload.accountAddress}
                  </p>
                )}
              </>
            )}
          </div>
        )}
      </div>
    </AccountChrome>
  );
}
