"use client";
import { useEffect, useMemo, useState } from "react";
import QRCode from "qrcode";
import styles from "../../uni.module.css";
import { useStoreWallet } from "../Wallet/walletContext";
import { TOKENS, type TokenSymbol } from "@/utils/constants";
import { toBaseUnits, fromBaseUnits } from "../lib/format";
import { buildPaymentRequestUrl, type PaymentRequest } from "../lib/paymentRequest";
import TokenSelect from "./TokenSelect";

const EXPIRY_OPTIONS: { value: string; label: string }[] = [
  { value: "0", label: "No expiry" },
  { value: "3600", label: "Expires in 1 hour" },
  { value: "86400", label: "Expires in 24 hours" },
  { value: "604800", label: "Expires in 7 days" },
  { value: "2592000", label: "Expires in 30 days" },
];

export default function ReceivePanel() {
  const address = useStoreWallet((s) => s.address);
  const strk20Capable = useStoreWallet((s) => s.strk20Capable);
  const [token, setToken] = useState<TokenSymbol>("STRK");
  const [amount, setAmount] = useState("");
  const [memo, setMemo] = useState("");
  const [expiryChoice, setExpiryChoice] = useState("0");
  const [copied, setCopied] = useState<"address" | "link" | "">("");
  const [qr, setQr] = useState<string>("");

  const tokenConfig = TOKENS[token];

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
    QRCode.toDataURL(requestLink, { width: 240, margin: 1, color: { dark: "#0d0e0e", light: "#ffffff" } })
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

  async function copy(kind: "address" | "link", value: string) {
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
      <div className={styles.panel}>
        <div className={styles.warn}>Connect a wallet to build a payment request.</div>
      </div>
    );
  }

  const preview =
    address && amountState.units
      ? `${fromBaseUnits(amountState.units, tokenConfig.decimals)} ${token}`
      : "";

  return (
    <div className={styles.panel}>
      {!strk20Capable ? (
        <div className={styles.warn}>
          This wallet does not support STRK20 private transfers yet. You cannot receive private
          transfers until you install or update a STRK20-capable wallet. The payment request below
          is shown for reference only.
        </div>
      ) : (
        <div className={styles.warn} style={{ color: "var(--muted)" }}>
          A payment request asks for a private transfer to your registered pool address. The
          recipient of any STRK20 transfer must already be registered in the pool; this app cannot
          register anyone.
        </div>
      )}

      <div className={styles.inputBlock}>
        <div className={styles.inputLabel}>Create a payment request</div>
        <div className={styles.inputMain}>
          <input
            className={styles.bigValue}
            style={{ border: "none", outline: "none", background: "transparent", width: "60%" }}
            placeholder="0"
            inputMode="decimal"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
          />
          <TokenSelect value={token} onChange={setToken} />
        </div>
        <input
          className={styles.subMono}
          style={{ border: "1px solid var(--line)", borderRadius: 12, padding: "10px 12px", width: "100%", marginTop: 8, background: "#fff" }}
          placeholder="Label (optional, e.g. Invoice 42)"
          maxLength={60}
          value={memo}
          onChange={(e) => setMemo(e.target.value)}
        />
        <select
          className={styles.subMono}
          style={{ border: "1px solid var(--line)", borderRadius: 12, padding: "10px 12px", width: "100%", marginTop: 8, background: "#fff" }}
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
          <div className={styles.warn}>{amountState.error}</div>
        ) : null}
        {!amount.trim() ? (
          <div className={styles.subLine} style={{ color: "var(--muted)" }}>
            Pick a token and an amount to build the link and QR.
          </div>
        ) : null}

        {qr ? (
          <div style={{ display: "flex", justifyContent: "center", margin: "8px 0 16px" }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={qr} alt="Payment request QR" width={200} height={200} style={{ borderRadius: 12 }} />
          </div>
        ) : null}

        {preview ? (
          <div className={styles.subMono} style={{ wordBreak: "break-all", marginTop: 10, fontSize: 13 }}>
            Requests {preview} to your pool address.
          </div>
        ) : null}

        <div className={styles.warn} style={{ color: "var(--muted)", marginTop: 12 }}>
          This is a payment request, not a card or a card number. It cannot be typed into a
          merchant checkout. Opening it opens this app with the Send panel prefilled, and the payer
          confirms the transfer from their own Ready wallet. The token, amount and label are
          encoded inside the link itself, so anyone who opens or scans it can read them.
        </div>

        <div style={{ marginTop: 16 }}>
          <div className={styles.inputLabel}>Your receive address</div>
          <div className={styles.subMono} style={{ wordBreak: "break-all", marginTop: 10, fontSize: 13 }}>
            {address}
          </div>
          <div className={styles.subLine} style={{ marginTop: 12 }}>
            <button className={styles.tab} onClick={() => copy("address", address)}>
              {copied === "address" ? "Copied address" : "Copy address"}
            </button>
            <button
              className={styles.tab}
              onClick={() => requestLink && copy("link", requestLink)}
              disabled={!requestLink}
              style={{ opacity: requestLink ? 1 : 0.5 }}
            >
              {copied === "link" ? "Copied request link" : "Copy payment request link"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
