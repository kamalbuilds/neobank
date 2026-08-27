"use client";

import { useCallback, useEffect, useState } from "react";
import { AccountChrome } from "../components/v2/AccountChrome";
import { Skeleton } from "../components/v2/ui";

const DEMO_AUTH = "iauth_dinner_1787803543";

type StatementJson = {
  settled?: boolean;
  authorizationId?: string;
  disclosed?: Array<{
    transactionHash: string;
    explorerTransactionUrl: string;
    amount?: string;
    lendAssets?: string;
    blockNumber?: number;
  }>;
  copy?: string;
  error?: string;
};

export function StatementsClient() {
  const [authId, setAuthId] = useState(DEMO_AUTH);
  const [full, setFull] = useState(false);
  const [payload, setPayload] = useState<StatementJson | null>(null);
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
        setError(body.error || `HTTP ${response.status}`);
        return;
      }
      setPayload(body);
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

  return (
    <AccountChrome>
      <div className="rounded-3xl border border-white/[0.07] bg-white/[0.028] elevate-1 p-6">
        <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[#7a859c]">
          Selective disclosure
        </div>
        <h1 className="mt-2 font-[family-name:var(--font-display)] text-[28px] font-semibold tracking-[-0.02em]">
          Source-of-funds for one swipe
        </h1>
        <p className="mt-3 max-w-xl text-[14px] leading-relaxed text-[#7a859c]">
          Viewing-key statements for the hosted card account. Default response omits
          amounts. This discloses activity the operator can already see. It is not a
          regulator endorsement.
        </p>

        <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-end">
          <label className="flex-1 text-[12px] text-[#7a859c]">
            Authorization ID
            <input
              value={authId}
              onChange={(event) => setAuthId(event.target.value)}
              className="mt-1 w-full rounded-xl border border-white/[0.08] bg-[#0b0d13] px-3 py-2 font-mono text-[13px] text-[#eaf0f8] outline-none transition-[border-color,box-shadow] duration-150 focus:border-[#2dd4bf]/60 focus:ring-4 focus:ring-[#2dd4bf]/10"
            />
          </label>
          <label className="flex items-center gap-2 text-[13px] text-[#a3acbd]">
            <input
              type="checkbox"
              checked={full}
              onChange={(event) => setFull(event.target.checked)}
            />
            Include amounts (full=1)
          </label>
          <button
            type="button"
            onClick={() => void load()}
            disabled={loading}
            className="h-11 rounded-2xl border border-[#2dd4bf]/40 bg-[#2dd4bf]/10 px-4 text-sm font-semibold text-[#9ae9da] transition-colors duration-150 hover:bg-[#2dd4bf]/16 disabled:cursor-wait disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2dd4bf]/60 focus-visible:ring-offset-2 focus-visible:ring-offset-[#06070b]"
          >
            {loading ? "Reading" : "Trace"}
          </button>
        </div>

        {error && (
          <p className="mt-4 text-sm text-[#f0a8a8]" role="alert">{error}</p>
        )}

        {loading && !payload && (
          <div className="mt-6 flex flex-col gap-3" aria-busy="true" aria-label="Reading statement">
            <Skeleton className="h-4 w-2/3" />
            <Skeleton className="h-16" />
            <Skeleton className="h-16" />
          </div>
        )}

        {payload && (
          <div className="mt-6 space-y-3">
            <p className="text-[13px] text-[#7a859c]">{payload.copy}</p>
            <p className="font-mono text-[12px] text-[#a3acbd]">
              settled={String(payload.settled)} id={payload.authorizationId}
            </p>
            {(payload.disclosed || []).map((item) => (
              <a
                key={item.transactionHash}
                href={item.explorerTransactionUrl}
                className="block rounded-2xl border border-white/[0.06] bg-[#0b0d13]/80 p-4 font-mono text-[13px] text-[#d8deea] transition-colors duration-150 hover:border-white/[0.12] hover:bg-[#0b0d13]"
              >
                {item.transactionHash}
                {item.amount ? ` · settle ${item.amount}` : ""}
                {item.lendAssets ? ` · lend ${item.lendAssets}` : ""}
                {item.blockNumber ? ` · block ${item.blockNumber}` : ""}
              </a>
            ))}
            {payload.settled === false && (
              <p className="text-sm text-[#7a859c]">No disclosure for this id.</p>
            )}
          </div>
        )}
      </div>
    </AccountChrome>
  );
}
