"use client";
import { ui } from "../lib/panelUi";

const ROWS: { hidden: string; visible: string }[] = [
  { hidden: "Sender and receiver of a private transfer", visible: "Deposit and withdrawal amounts (the public ERC-20 legs)" },
  { hidden: "Private transfer amounts and token type", visible: "That this address touched the pool, and when" },
  { hidden: "Which notes were spent", visible: "The pool's screening decision on a deposit" },
  { hidden: "", visible: "The relayer address as tx sender - never the user" },
  { hidden: "", visible: "The pool fee, paid in public STRK by tx.caller" },
];

export default function HonestTable() {
  return (
    <div className={`${ui.inputBlock} mt-6`}>
      <div className={ui.inputLabel}>What stays private, what stays public</div>
      <div className="mt-3 flex flex-wrap gap-6">
        <div className="min-w-[220px] flex-1">
          <div className="mb-2 font-[family-name:var(--font-mono-ui)] font-bold text-[#34d399]">PRIVATE</div>
          {ROWS.filter((r) => r.hidden).map((r) => (
            <div key={r.hidden} className="border-t border-white/[0.06] py-1.5 text-[13px] text-[#eaf0f8] first:border-t-0">
              {r.hidden}
            </div>
          ))}
        </div>
        <div className="min-w-[220px] flex-1">
          <div className="mb-2 font-[family-name:var(--font-mono-ui)] font-bold text-[#6ee9d5]">PUBLIC</div>
          {ROWS.map((r) => (
            <div key={r.visible} className="border-t border-white/[0.06] py-1.5 text-[13px] text-[#eaf0f8] first:border-t-0">
              {r.visible}
            </div>
          ))}
        </div>
      </div>
      <div className={`${ui.subLine} mt-3`}>
        <span>A private transfer needs a recipient already registered. Your own first shield in this app registers you. This app cannot register someone else.</span>
      </div>
    </div>
  );
}
