"use client";
import { useEffect, useMemo, useState } from "react";
import QRCode from "qrcode";
import { ui } from "../lib/panelUi";
import { cx, Figure, PanelState } from "../v2/ui";
import { useStoreWallet } from "../Wallet/walletContext";
import {
  DEFAULT_NETWORK,
  poolAddressFor,
  TOKENS,
  type TokenSymbol,
} from "@/utils/constants";
import { toBaseUnits, fromBaseUnits } from "../lib/format";
import { buildPaymentRequestUrl, type PaymentRequest } from "../lib/paymentRequest";
import { encodePublicAddress, encodeShieldedReceiver } from "../lib/beam";
import TokenSelect from "./TokenSelect";
import { HowThisWorks } from "../v2/ui";
import PoolFacts, { usePoolSnapshot } from "./PoolFacts";

const EXPIRY_OPTIONS: { value: string; label: string }[] = [
  { value: "0", label: "No expiry" },
  { value: "3600", label: "Expires in 1 hour" },
  { value: "86400", label: "Expires in 24 hours" },
  { value: "604800", label: "Expires in 7 days" },
  { value: "2592000", label: "Expires in 30 days" },
];

type CopyKind = "address" | "pool" | "strk" | "strkx" | "link" | "";

export default function ReceivePanel() {
  const address = useStoreWallet((s) => s.address);
  const network = useStoreWallet((s) => s.network) ?? DEFAULT_NETWORK;
  const strk20Capable = useStoreWallet((s) => s.strk20Capable);
  const [token, setToken] = useState<TokenSymbol>("STRK");
  const [amount, setAmount] = useState("");
  const [memo, setMemo] = useState("");
  const [expiryChoice, setExpiryChoice] = useState("0");
  const [copied, setCopied] = useState<CopyKind>("");
  const [qr, setQr] = useState<string>("");
  const [qrPending, setQrPending] = useState(false);
  const [qrError, setQrError] = useState("");

  const tokenConfig = TOKENS[token];
  const poolHex = poolAddressFor(network);
  const pool = usePoolSnapshot(network);

  const checksummed = useMemo(() => {
    if (!address) return "";
    try {
      return encodePublicAddress(address);
    } catch {
      return "";
    }
  }, [address]);

  const shieldedReceiver = useMemo(() => {
    if (!address) return "";
    try {
      return encodeShieldedReceiver({
        version: 0,
        pool: poolHex,
        account: address,
      });
    } catch {
      return "";
    }
  }, [address, poolHex]);

  const amountState = useMemo(() => {
    if (!amount.trim()) return { units: undefined as bigint | undefined, error: "" };
    try {
      return { units: toBaseUnits(amount, tokenConfig.decimals), error: "" };
    } catch (err: any) {
      return { units: undefined, error: err?.message ?? "Enter a valid amount." };
    }
  }, [amount, tokenConfig.decimals]);

  const requestLink = useMemo(() => {
    if (!address || !amountState.units || typeof window === "undefined") return "";
    const expiresAt =
      expiryChoice === "0"
        ? undefined
        : Math.floor(Date.now() / 1000) + Number(expiryChoice);
    const req: PaymentRequest = {
      recipient: address,
      token,
      units: amountState.units,
      memo: memo.trim() ? memo.trim() : undefined,
      expiresAt,
    };
    try {
      return buildPaymentRequestUrl(window.location.href, req);
    } catch {
      return "";
    }
  }, [address, token, amountState.units, memo, expiryChoice]);

  useEffect(() => {
    if (!requestLink) {
      setQr("");
      setQrError("");
      setQrPending(false);
      return;
    }
    let cancelled = false;
    setQrPending(true);
    setQrError("");
    // Dark ink on the cream sheet, so the code is part of the document rather
    // than a pasted-in white square.
    QRCode.toDataURL(requestLink, {
      width: 240,
      margin: 1,
      color: { dark: "#16161a", light: "#f4f1ea" },
    })
      .then((data) => {
        if (!cancelled) setQr(data);
      })
      .catch((err: any) => {
        if (cancelled) return;
        setQr("");
        setQrError(err?.message ?? "This request could not be encoded as a QR code.");
      })
      .finally(() => {
        if (!cancelled) setQrPending(false);
      });
    return () => {
      cancelled = true;
    };
  }, [requestLink]);

  async function copy(kind: Exclude<CopyKind, "">, value: string) {
    if (!value) return;
    try {
      await navigator.clipboard.writeText(value);
      setCopied(kind);
      window.setTimeout(() => setCopied(""), 1600);
    } catch {
      setCopied("");
    }
  }

  if (!address) {
    return (
      <div className={ui.panel}>
        <div>
          <h2 className={ui.heading}>Ask to be paid</h2>
          <p className={`${ui.note} mt-1.5`}>
            Build a link or QR code asking someone to pay you privately.
          </p>
        </div>
        <PanelState kind="empty" title="No account linked yet">
          A request has to name the address it pays into, so link a wallet and this panel fills in
          with your account hex, your pool address, your checksummed <Figure>strk</Figure> string
          and your shielded <Figure>strkx</Figure> receiver, each one copyable.
        </PanelState>
        {/* Reads with no wallet connected, so this panel is never an empty shell. */}
        <PoolFacts network={network} snapshot={pool} />
      </div>
    );
  }

  const preview =
    address && amountState.units
      ? `${fromBaseUnits(amountState.units, tokenConfig.decimals)} ${token}`
      : "";

  return (
    <div className={ui.panel}>
      <div>
        <h2 className={ui.heading}>Ask to be paid</h2>
        {!strk20Capable ? (
          <div className={`${ui.warn} mt-2`}>
            This wallet does not support STRK20 private transfers yet. You cannot receive private
            transfers until you install or update a STRK20-capable wallet. The payment request below
            is shown for reference only.
          </div>
        ) : (
          <p className={`${ui.note} mt-1.5`}>
            Build a link or QR code asking someone to pay you privately. You need to have shielded
            funds at least once before you can receive this way.
          </p>
        )}
      </div>

      <div className={ui.inputBlock}>
        <label htmlFor="receive-amount" className={ui.inputLabel}>
          Create a payment request
        </label>
        <div className={ui.inputMain}>
          <input
            id="receive-amount"
            className={ui.bigValue}
            placeholder="0"
            inputMode="decimal"
            aria-label={`Amount of ${token} to request`}
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
          />
          <TokenSelect value={token} onChange={setToken} />
        </div>
        <input
          className={cx(ui.inputField, "mt-2")}
          aria-label="Request label"
          placeholder="Label (optional, e.g. Invoice 42)"
          maxLength={60}
          value={memo}
          onChange={(e) => setMemo(e.target.value)}
        />
        <select
          className={cx(ui.inputField, "mt-2 py-2.5")}
          value={expiryChoice}
          onChange={(e) => setExpiryChoice(e.target.value)}
          aria-label="Request expiry"
        >
          {EXPIRY_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>

        {amount.trim() && amountState.error ? (
          <div className={`${ui.warn} mt-2`} role="alert">{amountState.error}</div>
        ) : null}
        {!amount.trim() ? (
          <PanelState kind="empty" title="No request built yet" className="mt-3">
            Pick a token and enter an amount. The link and QR are generated on this device, and
            anyone who opens them can read the token, amount and label.
          </PanelState>
        ) : null}

        {qrPending && !qr ? (
          <PanelState kind="loading" rows={1} title="Encoding the request as a QR code" className="mt-3" />
        ) : null}
        {qrError ? (
          <PanelState kind="error" title="Could not build the QR code" className="mt-3">
            {qrError} The copyable request link below still works; send that instead.
          </PanelState>
        ) : null}

        {qr ? (
          <div className="my-4 flex justify-center">
            {/* Cream matte on the code so it reads as part of the same sheet
                as the request it encodes. */}
            <div className="paper p-2.5">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={qr} alt="Payment request QR" width={200} height={200} className="block rounded-[2px]" />
            </div>
          </div>
        ) : null}

        {preview ? (
          <p className={`${ui.note} mt-2.5 break-all`}>
            Requests <Figure className="text-ink">{preview}</Figure> to your pool address.
          </p>
        ) : null}

        <HowThisWorks className="mt-3" label="Not a card - what opening this link does">
          <p>
            This is a request link, not a card number - a merchant checkout can&apos;t take it.
            Opening it opens this app with the Send panel filled in, and the payer approves the
            transfer from their own wallet. The token, amount and label are readable by anyone who
            opens or scans the link.
          </p>
        </HowThisWorks>

      </div>

      {/*
        The address block is evidence, not copy: four exact strings a payer has
        to be able to read character by character. It prints on paper, in a
        monospace column, at a size you can check against a wallet.
      */}
      <section className="paper p-4 sm:p-5" aria-label="Your receive address">
        <div className="flex items-center justify-between gap-3 border-b-[3px] border-double border-[var(--paper-line)] pb-2.5">
          <h3 className="text-[11px] font-semibold uppercase tracking-[0.16em] text-paper-muted">
            Your receive address
          </h3>
          <Figure
            className={
              network === "mainnet"
                ? "text-[13px] font-semibold text-paper-ink"
                : "text-[13px] text-paper-muted"
            }
          >
            {network === "mainnet" ? "mainnet" : "sepolia"}
          </Figure>
        </div>
        <p className="mt-3 text-[13px] leading-relaxed text-paper-muted">
          Share the account address for a direct transfer, or use one of the formatted strings
          below.
        </p>

        {(
          [
            { key: "address" as const, label: "Account (hex)", value: address, copy: "Copy account hex", done: "Copied account" },
            { key: "pool" as const, label: "Privacy pool (hex)", value: poolHex, copy: "Copy pool hex", done: "Copied pool" },
            { key: "strk" as const, label: "Checksummed address (strk)", value: checksummed, copy: "Copy checksummed address", done: "Copied checksummed address" },
            { key: "strkx" as const, label: "Shielded receiver string (strkx)", value: shieldedReceiver, copy: "Copy shielded receiver string", done: "Copied shielded receiver" },
          ]
        ).map((row) => (
          <div key={row.key} className="mt-4 border-t border-[var(--paper-line)] pt-3">
            <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-paper-muted">
              {row.label}
            </div>
            <Figure className="mt-1.5 block break-all text-[13px] leading-relaxed text-paper-ink">
              {row.value || "not available for this wallet"}
            </Figure>
            <button
              type="button"
              className="mt-2 rounded-[4px] border border-[var(--paper-line)] px-2.5 py-1 text-[13px] font-semibold text-paper-ink transition-[background-color,transform] duration-150 hover:bg-[var(--paper-2)] active:scale-[0.97] disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--seal)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--paper)]"
              onClick={() => copy(row.key, row.value)}
              disabled={!row.value}
            >
              {copied === row.key ? row.done : row.copy}
            </button>
          </div>
        ))}

        <div className="mt-4 border-t border-[var(--paper-line)] pt-3">
          <button
            type="button"
            className="rounded-[4px] border border-[var(--paper-line)] px-2.5 py-1 text-[13px] font-semibold text-paper-ink transition-[background-color,transform] duration-150 hover:bg-[var(--paper-2)] active:scale-[0.97] disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--seal)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--paper)]"
            onClick={() => requestLink && copy("link", requestLink)}
            disabled={!requestLink}
          >
            {copied === "link" ? "Copied request link" : "Copy payment request link"}
          </button>
          {!requestLink ? (
            <p className="mt-2 text-[13px] leading-relaxed text-paper-muted">
              Enter an amount above and the request link becomes copyable.
            </p>
          ) : null}
        </div>
      </section>

      {/* Reads with no wallet connected, so this panel is never an empty shell. */}
      <PoolFacts network={network} snapshot={pool} />
    </div>
  );
}
