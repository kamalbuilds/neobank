"use client";
import { useEffect, useMemo, useState } from "react";
import QRCode from "qrcode";
import { ui } from "../lib/panelUi";
import { cx } from "../v2/ui";
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

  const tokenConfig = TOKENS[token];
  const poolHex = poolAddressFor(network);

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
      return;
    }
    let cancelled = false;
    QRCode.toDataURL(requestLink, { width: 240, margin: 1, color: { dark: "#06070b", light: "#eaf0f8" } })
      .then((data) => {
        if (!cancelled) setQr(data);
      })
      .catch(() => {
        if (!cancelled) setQr("");
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
        <div className={ui.warn}>Connect a wallet to build a payment request.</div>
      </div>
    );
  }

  const preview =
    address && amountState.units
      ? `${fromBaseUnits(amountState.units, tokenConfig.decimals)} ${token}`
      : "";

  return (
    <div className={ui.panel}>
      {!strk20Capable ? (
        <div className={ui.warn}>
          This wallet does not support STRK20 private transfers yet. You cannot receive private
          transfers until you install or update a STRK20-capable wallet. The payment request below
          is shown for reference only.
        </div>
      ) : (
        <div className={ui.warn} style={{ color: "var(--muted)" }}>
          A payment request asks for a private transfer to your registered pool address. The
          recipient of any STRK20 transfer must already be registered in the pool; this app cannot
          register anyone.
        </div>
      )}

      <div className={ui.inputBlock}>
        <div className={ui.inputLabel}>Create a payment request</div>
        <div className={ui.inputMain}>
          <input
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
          className={cx(ui.inputField, "mt-2 w-full")}
          aria-label="Request label"
          placeholder="Label (optional, e.g. Invoice 42)"
          maxLength={60}
          value={memo}
          onChange={(e) => setMemo(e.target.value)}
        />
        <select
          className={cx(ui.inputField, "mt-2 w-full")}
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
          <div className={ui.warn} role="alert">{amountState.error}</div>
        ) : null}
        {!amount.trim() ? (
          <div className={cx(ui.subLine, "mt-2")} style={{ color: "var(--muted)" }}>
            Pick a token and an amount to build the link and QR.
          </div>
        ) : null}

        {qr ? (
          <div className="my-3 flex justify-center">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={qr} alt="Payment request QR" width={200} height={200} className="rounded-xl" />
          </div>
        ) : null}

        {preview ? (
          <div className={cx(ui.subMono, "mt-2.5 break-all text-[13px]")}>
            Requests {preview} to your pool address.
          </div>
        ) : null}

        <div className={cx(ui.warn, "mt-3")} style={{ color: "var(--muted)" }}>
          This is a payment request, not a card or a card number. It cannot be typed into a
          merchant checkout. Opening it opens this app with the Send panel prefilled, and the payer
          confirms the transfer from their own Ready wallet. The token, amount and label are
          encoded inside the link itself, so anyone who opens or scans it can read them.
        </div>

        <div className="mt-4">
          <div className={ui.inputLabel}>Your receive address</div>
          <div className={cx(ui.subLine, "mt-1.5")} style={{ color: "var(--muted)" }}>
            Hex pool and account path for private transfers, plus SNIP-42/43 checksummed strings
            (not an official Beam product).
          </div>

          <div className={cx(ui.inputLabel, "mt-3.5")}>Account (hex)</div>
          <div className={cx(ui.subMono, "mt-2 break-all text-[13px]")}>{address}</div>
          <div className={cx(ui.subLine, "mt-2")}>
            <button type="button" className={ui.tab} onClick={() => copy("address", address)}>
              {copied === "address" ? "Copied account" : "Copy account hex"}
            </button>
          </div>

          <div className={cx(ui.inputLabel, "mt-3.5")}>Privacy pool (hex)</div>
          <div className={cx(ui.subMono, "mt-2 break-all text-[13px]")}>{poolHex}</div>
          <div className={cx(ui.subLine, "mt-2")}>
            <button type="button" className={ui.tab} onClick={() => copy("pool", poolHex)}>
              {copied === "pool" ? "Copied pool" : "Copy pool hex"}
            </button>
          </div>

          <div className={cx(ui.inputLabel, "mt-3.5")}>Checksummed address (strk)</div>
          <div className={cx(ui.subMono, "mt-2 break-all text-[13px]")}>{checksummed || "-"}</div>
          <div className={cx(ui.subLine, "mt-2")}>
            <button
              type="button"
              className={ui.tab}
              onClick={() => copy("strk", checksummed)}
              disabled={!checksummed}
            >
              {copied === "strk" ? "Copied checksummed address" : "Copy checksummed address"}
            </button>
          </div>

          <div className={cx(ui.inputLabel, "mt-3.5")}>Shielded receiver string (strkx)</div>
          <div className={cx(ui.subMono, "mt-2 break-all text-[13px]")}>{shieldedReceiver || "-"}</div>
          <div className={cx(ui.subLine, "mt-2 flex-wrap gap-y-2")}>
            <button
              type="button"
              className={ui.tab}
              onClick={() => copy("strkx", shieldedReceiver)}
              disabled={!shieldedReceiver}
            >
              {copied === "strkx" ? "Copied shielded receiver" : "Copy shielded receiver string"}
            </button>
            <button
              type="button"
              className={ui.tab}
              onClick={() => requestLink && copy("link", requestLink)}
              disabled={!requestLink}
            >
              {copied === "link" ? "Copied request link" : "Copy payment request link"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
