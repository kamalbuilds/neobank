"use client";
import { useEffect, useMemo, useState } from "react";
import QRCode from "qrcode";
import styles from "../../uni.module.css";
import { useStoreWallet } from "../Wallet/walletContext";

export default function ReceivePanel() {
  const address = useStoreWallet((s) => s.address);
  const strk20Capable = useStoreWallet((s) => s.strk20Capable);
  const [copied, setCopied] = useState<"address" | "link" | "">("");
  const [qr, setQr] = useState<string>("");

  const paymentLink = useMemo(() => {
    if (!address || typeof window === "undefined") return "";
    const url = new URL(window.location.href);
    url.searchParams.set("tab", "send");
    url.searchParams.set("to", address);
    return url.toString();
  }, [address]);

  useEffect(() => {
    if (!paymentLink) {
      setQr("");
      return;
    }
    let cancelled = false;
    QRCode.toDataURL(paymentLink, { width: 240, margin: 1, color: { dark: "#0d0e0e", light: "#ffffff" } })
      .then((data) => {
        if (!cancelled) setQr(data);
      })
      .catch(() => {
        if (!cancelled) setQr("");
      });
    return () => {
      cancelled = true;
    };
  }, [paymentLink]);

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
        <div className={styles.warn}>Connect a wallet to show a receive address.</div>
      </div>
    );
  }

  return (
    <div className={styles.panel}>
      <div className={styles.warn} style={{ color: "var(--muted)" }}>
        This is your registered pool address, not a gift-card stealth scheme. The sender must
        already be registered and must send a private transfer. This app cannot register
        anyone.
      </div>

      {qr ? (
        <div style={{ display: "flex", justifyContent: "center", margin: "8px 0 16px" }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={qr} alt="Payment link QR" width={200} height={200} style={{ borderRadius: 12 }} />
        </div>
      ) : null}

      <div className={styles.inputBlock}>
        <div className={styles.inputLabel}>Your receive address</div>
        <div className={styles.subMono} style={{ wordBreak: "break-all", marginTop: 10, fontSize: 13 }}>
          {address}
        </div>
        <div className={styles.subLine} style={{ marginTop: 12 }}>
          <button className={styles.tab} onClick={() => copy("address", address)}>
            {copied === "address" ? "Copied address" : "Copy address"}
          </button>
          {paymentLink ? (
            <button className={styles.tab} onClick={() => copy("link", paymentLink)}>
              {copied === "link" ? "Copied link" : "Copy payment link"}
            </button>
          ) : null}
        </div>
      </div>

      {!strk20Capable && (
        <div className={styles.warn}>This wallet does not support STRK20 privacy actions. Install or update Ready before expecting a private receive.</div>
      )}
    </div>
  );
}
