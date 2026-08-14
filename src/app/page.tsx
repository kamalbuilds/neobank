"use client";
import { useEffect, useMemo, useState } from "react";
import styles from "./uni.module.css";
import { useStoreWallet } from "./components/Wallet/walletContext";
import { DEFAULT_NETWORK } from "@/utils/constants";
import { BtcCoin, EthCoin, StrkCoin, UsdcCoin } from "./components/TokenIcons";
import AppNav from "./components/Panels/AppNav";
import ShieldPanel from "./components/Panels/ShieldPanel";
import SendPanel from "./components/Panels/SendPanel";
import ReceivePanel from "./components/Panels/ReceivePanel";
import UnshieldPanel from "./components/Panels/UnshieldPanel";
import HonestTable from "./components/Panels/HonestTable";
import SelectWallet from "./components/client/WalletHandle/SelectWallet";

type Tab = "shield" | "send" | "receive" | "unshield";

const TABS: { id: Tab; label: string }[] = [
  { id: "shield", label: "Shield" },
  { id: "send", label: "Send" },
  { id: "receive", label: "Receive" },
  { id: "unshield", label: "Unshield" },
];

function readTab(raw: string | null): Tab {
  if (raw === "send" || raw === "receive" || raw === "unshield" || raw === "shield") return raw;
  return "shield";
}

export default function Home() {
  const isConnected = useStoreWallet((s) => s.isConnected);
  const strk20Capable = useStoreWallet((s) => s.strk20Capable);
  const network = useStoreWallet((s) => s.network) ?? DEFAULT_NETWORK;

  const [tab, setTab] = useState<Tab>("shield");
  const [toPrefill, setToPrefill] = useState("");

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    setTab(readTab(params.get("tab")));
    setToPrefill(params.get("to") ?? "");
  }, []);

  const orbs = useMemo(
    () => [
      { Comp: UsdcCoin, top: "8%", left: "6%", size: 92, blur: 1.2, opacity: 0.22, rotate: -18 },
      { Comp: StrkCoin, top: "18%", right: "8%", size: 78, blur: 0.8, opacity: 0.2, rotate: 14 },
      { Comp: BtcCoin, bottom: "16%", left: "10%", size: 70, blur: 1.6, opacity: 0.16, rotate: 8 },
      { Comp: EthCoin, bottom: "10%", right: "12%", size: 64, blur: 1.1, opacity: 0.18, rotate: -10 },
    ],
    []
  );

  return (
    <div className={styles.page}>
      <div className={styles.aurora} aria-hidden>
        {orbs.map((orb, i) => {
          const { size, blur, opacity, rotate, Comp: Icon, ...pos } = orb;
          return (
            <span
              key={i}
              className={styles.tok}
              style={{ ...pos, filter: `blur(${blur}px)`, opacity, transform: `rotate(${rotate}deg)` }}
            >
              <Icon size={size} />
            </span>
          );
        })}
      </div>

      <AppNav />

      <header className={styles.hero}>
        <h1 className={styles.heroTitle}>
          Private money
          <br />
          <span className={styles.heroAccent}>without publishing the book</span>
        </h1>
        <p className={styles.heroSub}>
          Shield incoming STRK or USDC, send privately to a registered Ready wallet, then unshield only when you need a public balance.
        </p>
      </header>

      {!isConnected ? (
        <div className={styles.panel}>
          <SelectWallet variant="ctaBig" />
          <div className={styles.walletHint} style={{ marginTop: 14, textAlign: "center" }}>
            Ready is required for private actions. Connecting never sends a viewing key to this app.
          </div>
        </div>
      ) : (
        <>
          {!strk20Capable ? (
            <div className={styles.panel}>
              <div className={styles.warn}>
                This wallet does not advertise Wallet API 0.10, so private actions stay hidden.
                Install or update <a href="https://www.ready.co/" target="_blank" rel="noreferrer">Ready</a>.
              </div>
            </div>
          ) : (
            <>
              <div className={styles.tabs}>
                {TABS.map((t) => (
                  <button
                    key={t.id}
                    className={`${styles.tab} ${tab === t.id ? styles.tabActive : ""}`}
                    onClick={() => setTab(t.id)}
                  >
                    {t.label}
                  </button>
                ))}
              </div>
              {tab === "shield" ? <ShieldPanel network={network} /> : null}
              {tab === "send" ? <SendPanel network={network} initialRecipient={toPrefill} /> : null}
              {tab === "receive" ? <ReceivePanel /> : null}
              {tab === "unshield" ? <UnshieldPanel network={network} /> : null}
            </>
          )}
        </>
      )}

      <HonestTable />

      <footer className={styles.footer}>
        <span>STRK20 pool on Starknet</span>
        <span className={styles.footerDot}>·</span>
        <a href="https://strk20-by-example.org/what-is-strk20" target="_blank" rel="noreferrer">
          What stays private
        </a>
        <span className={styles.footerDot}>·</span>
        <a
          href="https://voyager.online/contract/0x040337b1af3c663e86e333bab5a4b28da8d4652a15a69beee2b677776ffe812a"
          target="_blank"
          rel="noreferrer"
        >
          Canonical pool
        </a>
      </footer>
    </div>
  );
}
