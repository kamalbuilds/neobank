"use client";
import { useRef } from "react";
import styles from "../../uni.module.css";
import { TOKEN_LIST, type TokenSymbol } from "@/utils/constants";
import { StrkCoin, UsdcCoin } from "../TokenIcons";

const ICONS: Record<TokenSymbol, typeof StrkCoin> = { STRK: StrkCoin, USDC: UsdcCoin };

export default function TokenSelect({
  value,
  onChange,
}: {
  value: TokenSymbol;
  onChange: (t: TokenSymbol) => void;
}) {
  const btnRefs = useRef<Record<string, HTMLButtonElement | null>>({});

  function focusIndex(i: number) {
    const t = TOKEN_LIST[(i + TOKEN_LIST.length) % TOKEN_LIST.length];
    btnRefs.current[t.symbol]?.focus();
    onChange(t.symbol);
  }

  return (
    <div
      role="radiogroup"
      aria-label="Token"
      className={styles.tokenPill}
      style={{ padding: 3, gap: 2 }}
    >
      {TOKEN_LIST.map((t, i) => {
        const Icon = ICONS[t.symbol];
        const selected = t.symbol === value;
        return (
          <button
            key={t.symbol}
            ref={(el) => {
              btnRefs.current[t.symbol] = el;
            }}
            type="button"
            role="radio"
            aria-checked={selected}
            tabIndex={selected ? 0 : -1}
            onClick={() => onChange(t.symbol)}
            onKeyDown={(e) => {
              if (e.key === "ArrowRight" || e.key === "ArrowDown") {
                e.preventDefault();
                focusIndex(i + 1);
              } else if (e.key === "ArrowLeft" || e.key === "ArrowUp") {
                e.preventDefault();
                focusIndex(i - 1);
              }
            }}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
              border: "none",
              borderRadius: 999,
              padding: "6px 12px 6px 6px",
              font: "inherit",
              fontWeight: 600,
              color: selected ? "var(--pink-text)" : "var(--ink)",
              cursor: "pointer",
              background: selected ? "var(--pink-soft)" : "transparent",
            }}
          >
            <span className={styles.tokenDot} style={{ opacity: selected ? 1 : 0.55 }}>
              <Icon size={22} />
            </span>
            {t.symbol}
          </button>
        );
      })}
    </div>
  );
}
