"use client";
import { ui } from "../lib/panelUi";

const ROWS: { hidden: string; visible: string }[] = [
  { hidden: "Sender and receiver of a private transfer", visible: "Deposit and withdrawal amounts (the public ERC-20 legs)" },
  { hidden: "Private transfer amounts and token type", visible: "That this address touched the pool, and when" },
  { hidden: "Which notes were spent", visible: "The pool's screening decision on a deposit" },
  { hidden: "", visible: "The relayer address as tx sender - never the user" },
  { hidden: "", visible: "The pool fee, paid in public STRK by tx.caller" },
];

/**
 * The threat model, stated as a two-column ledger. Every row here is a claim
 * a reviewer can check against the contract, so it is set as a document with
 * ruled columns rather than as another soft card of marketing copy.
 */
export default function HonestTable() {
  return (
    <section className="doc p-4 sm:p-5" aria-label="What stays private, what stays public">
      <h2 className={`${ui.caption} border-b-[3px] border-double border-[var(--line-strong)] pb-2.5`}>
        What stays private, what stays public
      </h2>
      <div className="mt-3 flex flex-wrap gap-x-8 gap-y-5">
        <div className="min-w-[220px] flex-1">
          <div className="figure text-[13px] font-semibold tracking-[0.08em] text-seal-bright">
            PRIVATE
          </div>
          {ROWS.filter((r) => r.hidden).map((r) => (
            <div
              key={r.hidden}
              className="mt-2 border-t border-[var(--line)] pt-2 text-[13px] leading-snug text-ink first:border-t-0 first:pt-0"
            >
              {r.hidden}
            </div>
          ))}
        </div>
        <div className="min-w-[220px] flex-1">
          <div className="figure text-[13px] font-semibold tracking-[0.08em] text-muted">
            PUBLIC
          </div>
          {ROWS.map((r) => (
            <div
              key={r.visible}
              className="mt-2 border-t border-[var(--line)] pt-2 text-[13px] leading-snug text-ink first:border-t-0 first:pt-0"
            >
              {r.visible}
            </div>
          ))}
        </div>
      </div>
      <p className={`${ui.note} mt-4 border-t border-[var(--line)] pt-3`}>
        A private transfer needs a recipient already registered. Your own first shield in this app
        registers you. This app cannot register someone else.
      </p>
    </section>
  );
}
