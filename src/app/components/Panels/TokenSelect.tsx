"use client";
import { useRef } from "react";
import { ui } from "../lib/panelUi";
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
    <div role="radiogroup" aria-label="Token" className={`${ui.tokenPill} gap-0.5 p-[3px]`}>
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
            className={`inline-flex items-center gap-1.5 rounded-full border-none py-1.5 pr-3 pl-1.5 font-semibold transition-colors duration-150 cursor-pointer ${
              selected ? "bg-[#2dd4bf]/20 text-[#6ee9d5]" : "bg-transparent text-[#eaf0f8] hover:bg-white/[0.04]"
            }`}
          >
            <span className={ui.tokenDot} style={{ opacity: selected ? 1 : 0.55 }}>
              <Icon size={22} />
            </span>
            {t.symbol}
          </button>
        );
      })}
    </div>
  );
}
