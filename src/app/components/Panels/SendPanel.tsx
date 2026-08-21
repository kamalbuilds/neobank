"use client";
import { useEffect, useState } from "react";
import { validateAndParseAddress } from "starknet";
import styles from "../../uni.module.css";
import { useStoreWallet } from "../Wallet/walletContext";
import { TOKENS, getPublicBalance, type TokenSymbol, type NetworkKey } from "@/utils/constants";
import { toBaseUnits, fromBaseUnits, shortHex } from "../lib/format";
import { submitStrk20, waitStrk20Transaction, readPrivateBalance, findNotRegisteredRecipient } from "../lib/strk20";
import { isExpired, readPaymentRequest, type PaymentRequest } from "../lib/paymentRequest";
import type { WALLET_API } from "@starknet-io/types-js";
import { usePoolFee } from "../lib/useFee";
import { useMaturity, useShieldedBalances } from "../lib/usePrivateBalance";
import TokenSelect from "./TokenSelect";
import FeeRow from "./FeeRow";
import { ResultCard, errorResult, receiptToResult, walletErrorResult, type ActionResult } from "./ActionResult";

export interface BatchRow {
  recipient: string;
  amount: string;
}

export interface BatchParseOk {
  ok: true;
  rows: BatchRow[];
}

export interface BatchParseFail {
  ok: false;
  errors: string[];
}

export type BatchParseResult = BatchParseOk | BatchParseFail;

// Parse pasted lines of "address,amount" (one recipient per line) into batch
// rows. Pure so it can be exercised without a browser. Every bad line is
// collected and reported together with its line number, so a 20-line payroll
// list needs one fix pass instead of one resubmit per error. Blank lines and
// full-line "# comments" are skipped; line numbers always refer to the pasted
// text as-is. A repeated address is refused naming the earlier line: a batch
// is atomic and the pool fee is spent even when it reverts, so a duplicated
// row would silently pay someone twice. Addresses are stored in the padded,
// lowercased form validateAndParseAddress returns, which is what makes the
// duplicate comparison exact across case and padding. Validation here is
// early feedback only; handleSend re-validates every row it actually submits.
export function parsePastedRecipients(text: string, decimals: number): BatchParseResult {
  const errors: string[] = [];
  const rows: BatchRow[] = [];
  const firstSeenAt = new Map<string, number>();
  const lines = text.split(/\r?\n/);
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line || line.startsWith("#")) continue;
    const parts = line.split(",").map((p) => p.trim());
    if (parts.length !== 2 || !parts[0] || !parts[1]) {
      errors.push(`Line ${i + 1}: expected "address,amount".`);
      continue;
    }
    let recipient: string;
    try {
      recipient = validateAndParseAddress(parts[0]);
    } catch {
      errors.push(`Line ${i + 1}: not a valid Starknet address.`);
      continue;
    }
    try {
      toBaseUnits(parts[1], decimals);
    } catch (err: any) {
      errors.push(`Line ${i + 1}: ${err.message}`);
      continue;
    }
    const firstLine = firstSeenAt.get(recipient);
    if (firstLine !== undefined) {
      errors.push(`Line ${i + 1}: duplicate recipient, same address as line ${firstLine}.`);
      continue;
    }
    firstSeenAt.set(recipient, i + 1);
    rows.push({ recipient, amount: parts[1] });
  }
  if (errors.length > 0) return { ok: false, errors };
  if (rows.length === 0) {
    return { ok: false, errors: ['Paste at least one line as "address,amount", one recipient per line.'] };
  }
  return { ok: true, rows };
}

export default function SendPanel({
  network,
  initialRecipient = "",
}: {
  network: NetworkKey;
  initialRecipient?: string;
}) {
  const myWalletAccount = useStoreWallet((s) => s.myWalletAccount);
  const address = useStoreWallet((s) => s.address);
  const strk20Capable = useStoreWallet((s) => s.strk20Capable);

  const [token, setToken] = useState<TokenSymbol>("STRK");
  // Row 0 is the original single-recipient flow; extra rows batch into the
  // same transaction.
  const [rows, setRows] = useState<BatchRow[]>([{ recipient: initialRecipient, amount: "" }]);
  const [request, setRequest] = useState<PaymentRequest | null>(null);
  const [requestError, setRequestError] = useState("");
  const [pasteOpen, setPasteOpen] = useState(false);
  const [batchText, setBatchText] = useState("");
  const [pasteNote, setPasteNote] = useState("");
  const [maxLoading, setMaxLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<ActionResult | null>(null);

  const { fee } = usePoolFee(network);
  const tokenConfig = TOKENS[token];
  const maturity = useMaturity(token);
  const shielded = useShieldedBalances();

  // Same mount-effect pattern page.tsx uses for the `to` prefill: read the
  // payment request from the URL once on the client, then fill the form. A
  // decoded request supersedes a bare `to` address.
  useEffect(() => {
    const found = readPaymentRequest(window.location.search);
    if (!found) return;
    if (!found.ok) {
      setRequestError(found.error);
      return;
    }
    const req = found.request;
    setRequest(req);
    setToken(req.token);
    setRows([{ recipient: req.recipient, amount: fromBaseUnits(req.units, TOKENS[req.token].decimals) }]);
  }, []);

  const requestExpired = request !== null && isExpired(request);

  function updateRow(index: number, patch: Partial<BatchRow>) {
    setRows((prev) => prev.map((row, i) => (i === index ? { ...row, ...patch } : row)));
  }

  async function useMax() {
    if (!myWalletAccount) return;
    setMaxLoading(true);
    try {
      const balance = await readPrivateBalance(myWalletAccount, tokenConfig.address);
      // Pool fee is public STRK from tx.caller, not taken out of the note.
      // Rows after the first are committed to their amounts, so the most the
      // first row can take is what they leave unspent. With no extra rows
      // this is exactly the old single-recipient max.
      const committed = rows.slice(1).reduce((sum, row) => {
        try {
          return sum + toBaseUnits(row.amount, tokenConfig.decimals);
        } catch {
          return sum;
        }
      }, 0n);
      const head = balance > committed ? balance - committed : 0n;
      updateRow(0, { amount: fromBaseUnits(head, tokenConfig.decimals) });
    } catch (err: any) {
      setResult(errorResult(err?.message ?? "Could not read your shielded balance."));
    } finally {
      setMaxLoading(false);
    }
  }

  function addRow() {
    setPasteNote("");
    setRows((prev) => [...prev, { recipient: "", amount: "" }]);
  }

  function removeRow(index: number) {
    setPasteNote("");
    setRows((prev) => prev.filter((_, i) => i !== index));
  }

  function addFromPaste() {
    setResult(null);
    setPasteNote("");
    const parsed = parsePastedRecipients(batchText, tokenConfig.decimals);
    if (!parsed.ok) {
      // One card, every bad line: the <pre> note keeps the line breaks.
      setResult(errorResult(parsed.errors.join("\n")));
      return;
    }
    // Fully-empty manual rows would block submitting later; drop them but
    // keep partially filled ones because they carry the user's intent.
    setRows((prev) => [
      ...prev.filter((row) => row.recipient.trim() !== "" || row.amount.trim() !== ""),
      ...parsed.rows,
    ]);
    setBatchText("");
    setPasteNote(`Added ${parsed.rows.length} recipient${parsed.rows.length === 1 ? "" : "s"} from the pasted list.`);
  }

  async function handleSend() {
    setResult(null);
    if (!myWalletAccount) {
      setResult(errorResult("Connect a wallet first."));
      return;
    }
    if (request && isExpired(request)) {
      setResult(errorResult("This payment request has expired. Ask for a fresh one before paying."));
      return;
    }
    const entries: { recipient: string; units: bigint }[] = [];
    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const prefix = rows.length === 1 ? "" : `Recipient ${i + 1}: `;
      let recipientAddr: string;
      try {
        recipientAddr = validateAndParseAddress(row.recipient);
      } catch {
        setResult(
          errorResult(rows.length === 1 ? "Enter a valid Starknet address." : `${prefix}enter a valid Starknet address.`),
        );
        return;
      }
      let units: bigint;
      try {
        units = toBaseUnits(row.amount, tokenConfig.decimals);
      } catch (err: any) {
        setResult(errorResult(`${prefix}${err.message}`));
        return;
      }
      entries.push({ recipient: recipientAddr, units });
    }
    // Last gate before the wallet is asked to approve: the paste parser
    // refuses duplicates earlier, but rows typed by hand reach this point
    // unchecked. A batch is all-or-nothing and the pool fee is spent even if
    // it reverts, so a repeated address would pay someone twice. Entries hold
    // padded lowercase addresses, so equality here is exact.
    const firstEntryAt = new Map<string, number>();
    for (let i = 0; i < entries.length; i++) {
      const first = firstEntryAt.get(entries[i].recipient);
      if (first !== undefined) {
        setResult(
          errorResult(
            `Recipient ${first + 1} and Recipient ${i + 1} pay the same address. The whole batch is one transaction, so the duplicate would be paid twice. Remove one of them.`,
          ),
        );
        return;
      }
      firstEntryAt.set(entries[i].recipient, i);
    }
    const total = entries.reduce((sum, entry) => sum + entry.units, 0n);

    // Same consented private-balance read the Use-max path uses. The wallet
    // still enforces this authoritatively at submit time; this check just
    // fails before the user is asked to approve anything.
    let privateUnits: bigint;
    try {
      privateUnits = await readPrivateBalance(myWalletAccount, tokenConfig.address);
    } catch (err: any) {
      setResult(errorResult(err?.message ?? "Could not read your shielded balance."));
      return;
    }
    if (total > privateUnits) {
      setResult(
        errorResult(
          `This batch sends ${fromBaseUnits(total, tokenConfig.decimals)} ${token} but you have ${fromBaseUnits(
            privateUnits,
            tokenConfig.decimals,
          )} shielded ${token}. Reduce the amounts and try again.`,
        ),
      );
      return;
    }
    if (address && fee !== undefined) {
      try {
        const publicStrk = await getPublicBalance(network, TOKENS.STRK.address, address);
        if (publicStrk < fee) {
          setResult(errorResult(
            `Need at least ${fromBaseUnits(fee, TOKENS.STRK.decimals)} public STRK for the pool fee. This wallet has ${fromBaseUnits(publicStrk, TOKENS.STRK.decimals)} public STRK. Ready will refuse the send until you top up.`,
          ));
          return;
        }
      } catch (err: any) {
        setResult(errorResult(err?.message ?? "Could not read public STRK before sending."));
        return;
      }
    }
    setSubmitting(true);
    // Exactly one invoke for the whole batch: one transfer action per
    // recipient, pool fee charged once for the call.
    const actions: WALLET_API.STRK20_ACTION[] = entries.map((entry) => ({
      type: "transfer",
      token: tokenConfig.address,
      amount: `0x${entry.units.toString(16)}`,
      recipient: entry.recipient,
    }));
    const submission = await submitStrk20(myWalletAccount, actions);
    if (!submission.ok || !submission.txHash) {
      if (submission.error?.kind === "not_registered") {
        if (entries.length === 1) {
          setResult({
            status: "error",
            title: "Recipient not registered in the privacy pool",
            note: submission.error.message,
          });
        } else {
          // A batch is all-or-nothing: name the recipient the wallet rejected.
          const culprit = findNotRegisteredRecipient(submission.error.raw, entries.map((entry) => entry.recipient));
          setResult({
            status: "error",
            title: culprit
              ? `Recipient not registered in the privacy pool: ${shortHex(culprit)}`
              : "Recipient not registered in the privacy pool",
            note: culprit
              ? `${submission.error.message}\n\nNothing was sent: one unregistered recipient rejects the whole batch. This one is not registered: ${culprit}`
              : `${submission.error.message}\n\nNothing was sent: one unregistered recipient rejects the whole batch, and the wallet error did not say which one. Check every recipient.\n\nWallet reported:\n${submission.error.raw}`,
          });
        }
      } else {
        setResult(walletErrorResult(submission.error));
      }
      setSubmitting(false);
      return;
    }
    const amountLabel =
      entries.length === 1
        ? `${rows[0].amount} ${token} (private)`
        : `${entries.length} transfers, total ${fromBaseUnits(total, tokenConfig.decimals)} ${token} (private)`;
    setResult({
      status: "pending",
      title: "Waiting for confirmation…",
      rows: [{ label: "Amount", value: amountLabel }, { label: "Transaction", value: submission.txHash, hash: submission.txHash }],
    });
    const outcome = await waitStrk20Transaction(submission.txHash, network);
    if (outcome.status === "confirmed") {
      setResult(receiptToResult(outcome.receipt, submission.txHash, amountLabel));
    } else if (outcome.status === "submitted") {
      setResult({
        status: "pending",
        title: "Submitted - not yet confirmed by this RPC",
        note: "Paymaster-relayed transactions can take a while to surface. Track it on the explorer.",
        rows: [{ label: "Transaction", value: submission.txHash, hash: submission.txHash }],
      });
    } else {
      setResult(errorResult(outcome.message));
    }
    setSubmitting(false);
  }

  return (
    <div className={styles.panel}>
      <div className={styles.warn} style={{ color: "var(--muted)" }}>
        The recipient must already be registered in the privacy pool (they need to have used a STRK20-capable
        wallet at least once). This app cannot register them for you. In a batch, every recipient must be
        registered or the whole batch is refused.
      </div>

      <div className={styles.inputBlock}>
        <div className={styles.inputLabel}>You&apos;re sending privately</div>
        <div className={styles.inputMain}>
          <input
            className={styles.bigValue}
            style={{ border: "none", outline: "none", background: "transparent", width: "60%" }}
            placeholder="0"
            inputMode="decimal"
            value={rows[0].amount}
            onChange={(e) => updateRow(0, { amount: e.target.value })}
          />
          <TokenSelect value={token} onChange={setToken} />
        </div>
        <input
          className={styles.subMono}
          style={{ border: "1px solid var(--line)", borderRadius: 12, padding: "10px 12px", width: "100%", marginTop: 8, background: "#fff" }}
          placeholder="Recipient address (0x…)"
          value={rows[0].recipient}
          onChange={(e) => updateRow(0, { recipient: e.target.value })}
        />
        {request ? (
          <div className={styles.subLine} style={{ color: "var(--muted)" }}>
            Payment request loaded: {fromBaseUnits(request.units, TOKENS[request.token].decimals)}{" "}
            {request.token} to {shortHex(request.recipient)}
            {request.memo ? `, labeled ${request.memo}` : ""}. Confirm these details instead of
            retyping them; this is a payment request, not a card.
          </div>
        ) : initialRecipient ? (
          <div className={styles.subLine} style={{ color: "var(--muted)" }}>
            Recipient filled from a receive link.
          </div>
        ) : null}
        {requestError ? <div className={styles.warn}>{requestError}</div> : null}
        <div className={styles.subLine}>
          <button className={styles.tab} onClick={useMax} disabled={maxLoading || !myWalletAccount}>
            {maxLoading ? "reading shielded balance…" : "Use max"}
          </button>
        </div>

        {rows.slice(1).map((row, i) => (
          <div key={i + 1} className={styles.subLine} style={{ marginTop: 8 }}>
            <input
              className={styles.subMono}
              style={{ border: "1px solid var(--line)", borderRadius: 12, padding: "10px 12px", flex: 3, minWidth: 0, background: "#fff" }}
              placeholder={`Recipient ${i + 2} address (0x…)`}
              value={row.recipient}
              onChange={(e) => updateRow(i + 1, { recipient: e.target.value })}
            />
            <input
              className={styles.subMono}
              style={{ border: "1px solid var(--line)", borderRadius: 12, padding: "10px 12px", flex: 2, minWidth: 0, background: "#fff" }}
              placeholder="Amount"
              inputMode="decimal"
              value={row.amount}
              onChange={(e) => updateRow(i + 1, { amount: e.target.value })}
            />
            <button className={styles.tab} onClick={() => removeRow(i + 1)}>
              Remove
            </button>
          </div>
        ))}

        <div className={styles.subLine}>
          <button className={styles.tab} onClick={addRow}>
            Add another recipient
          </button>
          <button
            className={styles.tab}
            onClick={() => {
              setPasteNote("");
              setPasteOpen((v) => !v);
            }}
          >
            {pasteOpen ? "Hide paste box" : "Paste a batch list"}
          </button>
        </div>
        {pasteOpen && (
          <>
            <textarea
              className={styles.subMono}
              rows={4}
              style={{
                border: "1px solid var(--line)",
                borderRadius: 12,
                padding: "10px 12px",
                width: "100%",
                background: "#fff",
                resize: "vertical",
                boxSizing: "border-box",
              }}
              placeholder={"0x…,25\n0x…,0.5"}
              value={batchText}
              onChange={(e) => setBatchText(e.target.value)}
            />
            <div className={styles.subLine}>
              <button className={styles.tab} onClick={addFromPaste}>
                Add lines to the batch
              </button>
              {pasteNote ? (
                <span className={styles.subMono} style={{ color: "var(--muted)" }}>
                  {pasteNote}
                </span>
              ) : null}
            </div>
          </>
        )}
      </div>

      <FeeRow fee={fee} />
      <div className={styles.subLine} style={{ color: "var(--muted)" }}>
        Fee is public STRK, not taken from this note. Ready may require a buffer above the live pool fee shown here.
      </div>
      {rows.length > 1 && fee !== undefined && (
        <div className={styles.subLine} style={{ color: "var(--muted)" }}>
          These {rows.length} transfers go in one transaction: the pool fee is charged once (
          {fromBaseUnits(fee, TOKENS.STRK.decimals)} STRK) instead of {rows.length} times (
          {fromBaseUnits(fee * BigInt(rows.length), TOKENS.STRK.decimals)} STRK). You save{" "}
          {fromBaseUnits(fee * BigInt(rows.length - 1), TOKENS.STRK.decimals)} STRK.
        </div>
      )}

      <div className={styles.subLine}>
        <button
          className={styles.tab}
          onClick={shielded.revealed ? shielded.hide : shielded.reveal}
          disabled={shielded.loading || !myWalletAccount}
        >
          {shielded.loading
            ? "reading shielded balances…"
            : shielded.revealed
            ? "Hide shielded balances"
            : "Show shielded STRK/USDC"}
        </button>
      </div>
      {shielded.error ? <div className={styles.warn}>{shielded.error}</div> : null}
      {shielded.revealed && (
        <div className={styles.subLine} style={{ gap: 16 }}>
          <span className={styles.subMono}>
            {shielded.balances.STRK !== undefined ? fromBaseUnits(shielded.balances.STRK, TOKENS.STRK.decimals) : "…"} STRK
          </span>
          <span className={styles.subMono}>
            {shielded.balances.USDC !== undefined ? fromBaseUnits(shielded.balances.USDC, TOKENS.USDC.decimals) : "…"} USDC
          </span>
        </div>
      )}
      {shielded.revealed && shielded.balances[token] === 0n && (
        <div className={styles.warn}>You have no shielded {token} to send.</div>
      )}

      {maturity.locked && (
        <div className={styles.warn}>
          {maturity.blocksRemaining === undefined
            ? `Notes from your last ${token} shield mature about 10 blocks after the deposit.`
            : `Notes from your last ${token} shield are still maturing: ~${maturity.blocksRemaining} block${
                maturity.blocksRemaining === 1 ? "" : "s"
              } left before they can be spent.`}
        </div>
      )}

      {!strk20Capable && (
        <div className={styles.warn}>This wallet does not support STRK20 privacy actions. Install or update Ready.</div>
      )}

      {request && requestExpired ? (
        <div className={styles.warn}>
          This payment request expired on {new Date((request.expiresAt ?? 0) * 1000).toLocaleString()}. It stays
          filled so you can see what was asked, but you cannot pay against it. Ask the requester for a fresh
          link.
        </div>
      ) : null}

      <button
        className={styles.btnCta}
        disabled={
          !strk20Capable ||
          submitting ||
          maturity.locked ||
          requestExpired ||
          rows.some((row) => !row.amount || !row.recipient)
        }
        onClick={handleSend}
      >
        {submitting
          ? "Sending…"
          : maturity.locked
          ? "Notes maturing…"
          : requestExpired
          ? "Request expired"
          : rows.length > 1
          ? `Send privately to ${rows.length} recipients`
          : "Send privately"}
      </button>

      {result ? <ResultCard r={result} network={network} /> : null}
    </div>
  );
}
