"use client";
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
  const Icon = ICONS[value];
  return (
    <label className={styles.tokenPill} style={{ cursor: "pointer" }}>
      <span className={styles.tokenDot}>
        <Icon size={22} />
      </span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value as TokenSymbol)}
        aria-label="Token"
        style={{ border: "none", background: "transparent", font: "inherit", color: "inherit", cursor: "pointer" }}
      >
        {TOKEN_LIST.map((t) => (
          <option key={t.symbol} value={t.symbol}>
            {t.symbol}
          </option>
        ))}
      </select>
    </label>
  );
}
