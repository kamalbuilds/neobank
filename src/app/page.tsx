"use client";
import { useEffect, useMemo, useState } from "react";
import styles from "./uni.module.css";
import { useStoreWallet } from "./components/Wallet/walletContext";
import { DEFAULT_NETWORK, TOKENS, getPublicBalance, type NetworkKey } from "@/utils/constants";
import { fromBaseUnits } from "./components/lib/format";
import { useShieldedBalances } from "./components/lib/usePrivateBalance";
import { BtcCoin, EthCoin, StrkCoin, UsdcCoin } from "./components/TokenIcons";
import AppNav from "./components/Panels/AppNav";
import ShieldPanel from "./components/Panels/ShieldPanel";
import SendPanel from "./components/Panels/SendPanel";
import ReceivePanel from "./components/Panels/ReceivePanel";
import UnshieldPanel from "./components/Panels/UnshieldPanel";
import SwapPanel from "./components/Panels/SwapPanel";
import ActivityPanel from "./components/Panels/ActivityPanel";
import HopPanel from "./components/Panels/HopPanel";
import SpendPanel from "./components/Panels/SpendPanel";
import HonestTable from "./components/Panels/HonestTable";
import SelectWallet from "./components/client/WalletHandle/SelectWallet";

type Tab = "shield" | "send" | "receive" | "unshield" | "swap" | "hop" | "activity" | "spend";

const TABS: { id: Tab; label: string }[] = [
  { id: "shield", label: "Shield" },
  { id: "send", label: "Send" },
  { id: "receive", label: "Receive" },
  { id: "unshield", label: "Unshield" },
  { id: "swap", label: "Swap" },
  { id: "hop", label: "Hop" },
  { id: "activity", label: "Activity" },
  { id: "spend", label: "Spend" },
];

function BalancesStrip({ network }: { network: NetworkKey }) {
  const address = useStoreWallet((s) => s.address);
  const [publicStrk, setPublicStrk] = useState<bigint | undefined>(undefined);
  const [publicUsdc, setPublicUsdc] = useState<bigint | undefined>(undefined);
  const { revealed, loading, error, balances, reveal, hide } = useShieldedBalances();

  useEffect(() => {
    if (!address) return;
    let cancelled = false;
    Promise.all([
      getPublicBalance(network, TOKENS.STRK.address, address),
      getPublicBalance(network, TOKENS.USDC.address, address),
    ])
      .then(([strk, usdc]) => {
        if (cancelled) return;
        setPublicStrk(strk);
        setPublicUsdc(usdc);
      })
      .catch(() => {
        if (cancelled) return;
        setPublicStrk(undefined);
        setPublicUsdc(undefined);
      });
    return () => {
      cancelled = true;
    };
  }, [network, address]);

  return (
    <div
      style={{
        display: "flex",
        flexWrap: "wrap",
        alignItems: "center",
        gap: 12,
        margin: "0 auto 18px",
        width: "min(520px, calc(100vw - 32px))",
        fontSize: 13,
        opacity: 0.85,
      }}
    >
      <span>
        STRK {publicStrk === undefined ? "…" : fromBaseUnits(publicStrk, TOKENS.STRK.decimals)}
      </span>
      <span>
        USDC {publicUsdc === undefined ? "…" : fromBaseUnits(publicUsdc, TOKENS.USDC.decimals)}
      </span>
      {revealed ? (
        <>
          <span>
            Shielded STRK {balances.STRK === undefined ? "…" : fromBaseUnits(balances.STRK, TOKENS.STRK.decimals)}
          </span>
          <span>
            Shielded USDC {balances.USDC === undefined ? "…" : fromBaseUnits(balances.USDC, TOKENS.USDC.decimals)}
          </span>
          <button onClick={hide} style={{ fontSize: 12 }}>
            Hide
          </button>
        </>
      ) : (
        <button onClick={reveal} disabled={loading} style={{ fontSize: 12 }}>
          {loading ? "Revealing…" : "Reveal shielded"}
        </button>
      )}
      {error ? <span style={{ color: "var(--pink-text)" }}>{error}</span> : null}
    </div>
  );
}

function readTab(raw: string | null): Tab {
  if (
    raw === "send" ||
    raw === "receive" ||
    raw === "unshield" ||
    raw === "shield" ||
    raw === "swap" ||
    raw === "hop" ||
    raw === "activity" ||
    raw === "spend"
  )
    return raw;
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
          A private money account
          <br />
          <span className={styles.heroAccent}>built on STRK20</span>
        </h1>
        <p className={styles.heroSub}>
          Shield incoming STRK or USDC and send privately between registered Ready wallets. The pool
          hides balances and transfers onchain, not what happens after you unshield. Spending works
          today, inside the pool. Pay a private payment request, or anyone who can receive a
          Starknet private transfer, from your shielded notes. It does not reach merchants that
          only accept card payments. Unshield to public USDC when a destination needs a public
          balance.
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
              <BalancesStrip network={network} />
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
              {tab === "swap" ? <SwapPanel network={network} /> : null}
              {tab === "hop" ? <HopPanel network={network} /> : null}
              {tab === "activity" ? <ActivityPanel network={network} /> : null}
              {tab === "spend" ? <SpendPanel network={network} /> : null}
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
        <span className={styles.footerDot}>·</span>
        <a
          href="/receipt/0x04c4bea05417ce1062adef39b3d3b300f831ec994bbb4166d6010c4838d49193"
          target="_blank"
          rel="noreferrer"
        >
          Proof of payment
        </a>
      </footer>
    </div>
  );
}
