"use client";
import { ui } from "../lib/panelUi";
import { cx } from "../v2/ui";
import { num } from "starknet";
import { explorerTxUrl, type NetworkKey } from "@/utils/constants";
import { fromBaseUnits, shortHex } from "../lib/format";
import type { Strk20Error } from "../lib/strk20";

export type ResultRow = { label: string; value: string; hash?: string };
export type ActionResult = {
  status: "pending" | "ok" | "screened" | "error";
  title: string;
  rows?: ResultRow[];
  note?: string;
};

export function errorResult(message: string): ActionResult {
  return { status: "error", title: "Action failed", note: message };
}

// A wallet error the classifier does not recognise must still show what the
// wallet actually said. Dropping the raw text turns any unmatched error - a
// differently worded "not registered" included - into a silent dead end.
export function walletErrorResult(error: Strk20Error | undefined): ActionResult {
  if (!error) return errorResult("Action failed.");
  const note =
    error.kind === "unknown" && error.raw ? `${error.message}\n\nWallet reported:\n${error.raw}` : error.message;
  return { status: "error", title: "Action failed", note };
}

function prettyStatus(finality?: string, exec?: string): string {
  const f =
    finality === "ACCEPTED_ON_L2" ? "Accepted on L2"
      : finality === "ACCEPTED_ON_L1" ? "Accepted on L1"
      : finality === "RECEIVED" ? "Received"
      : finality ?? "";
  const e = exec === "SUCCEEDED" ? "Succeeded" : exec === "REVERTED" ? "Reverted" : "";
  return [f, e].filter(Boolean).join(" · ") || "Confirmed";
}

// Turn a raw tx receipt into a readable receipt card (amount, status, fee, hash).
export function receiptToResult(receipt: any, txHash: string, amountLabel: string): ActionResult {
  const r = receipt?.value ?? receipt;
  const exec: string | undefined = r?.execution_status;
  const finality: string | undefined = r?.finality_status;
  const reverted = exec === "REVERTED";
  let feeStr: string | undefined;
  const feeRaw = r?.actual_fee?.amount ?? r?.actual_fee;
  const feeUnit: string | undefined = r?.actual_fee?.unit;
  try {
    if (feeRaw !== undefined && feeRaw !== null) {
      feeStr = `${fromBaseUnits(num.toBigInt(feeRaw), 18)} ${feeUnit === "WEI" ? "ETH" : "STRK"}`;
    }
  } catch {
    // leave fee undefined if unparseable
  }
  const rows: ResultRow[] = [];
  if (amountLabel) rows.push({ label: "Amount", value: amountLabel });
  rows.push({ label: "Status", value: prettyStatus(finality, exec) });
  // Wallet API 0.10.3 has no fee-mode argument, so the app cannot know whether
  // the wallet relayed this or self-submitted it. "tx sender" is true either
  // way; a bare "Network fee" would read as a cost the user is known to have paid.
  if (feeStr) rows.push({ label: "Network gas (paid by tx sender)", value: feeStr });
  rows.push({ label: "Transaction", value: shortHex(txHash), hash: txHash });
  return {
    status: reverted ? "error" : "ok",
    title: reverted ? "Transaction reverted" : "Transaction confirmed",
    rows,
  };
}

const ICON_BG: Record<ActionResult["status"], string> = {
  ok: "bg-[#34d399] shadow-[0_0_12px_rgba(52,211,153,0.55)]",
  error: "bg-[#f87171]",
  screened: "bg-[#f87171]",
  pending: "bg-[#2dd4bf]",
};

export function ResultCard({ r, network }: { r: ActionResult; network: NetworkKey }) {
  const variant =
    r.status === "error" || r.status === "screened"
      ? ui.receiptError
      : r.status === "pending"
        ? ui.receiptPending
        : ui.receiptOk;

  return (
    <div className={cx(ui.receipt, variant, "animate-rise-in")}>
      <div className={ui.receiptHead}>
        <span className={cx(ui.receiptIcon, ICON_BG[r.status])} aria-hidden="true">
          {r.status === "ok" ? "✓" : r.status === "error" || r.status === "screened" ? "!" : "⋯"}
        </span>
        <span>{r.title}</span>
      </div>
      {r.rows?.length ? (
        <div className={ui.receiptRows}>
          {r.rows.map((row) => (
            <div key={row.label} className={ui.receiptRow}>
              <span className={ui.receiptLabel}>{row.label}</span>
              {row.hash ? (
                <a
                  className={ui.receiptLink}
                  href={explorerTxUrl(network, row.hash)}
                  target="_blank"
                  rel="noreferrer"
                >
                  {row.value} ↗
                </a>
              ) : (
                <span className={ui.receiptValue}>{row.value}</span>
              )}
            </div>
          ))}
        </div>
      ) : null}
      {r.status === "pending" ? (
        <div className={cx(ui.receiptLabel, "mt-1")} aria-live="polite">
          Pending is not a failure. Paymaster-relayed txs can take a while to land.
        </div>
      ) : null}
      {r.note ? <pre className={ui.receiptNote}>{r.note}</pre> : null}
    </div>
  );
}
