"use client";
import styles from "../../uni.module.css";

const ROWS: { hidden: string; visible: string }[] = [
  { hidden: "Sender and receiver of a private transfer", visible: "Deposit and withdrawal amounts (the public ERC-20 legs)" },
  { hidden: "Private transfer amounts and token type", visible: "That this address touched the pool, and when" },
  { hidden: "Which notes were spent", visible: "The pool's screening decision on a deposit" },
  { hidden: "", visible: "The relayer address as tx sender - never the user" },
  { hidden: "", visible: "The pool fee, paid in public STRK by tx.caller" },
];

export default function HonestTable() {
  return (
    <div className={styles.inputBlock} style={{ marginTop: 24 }}>
      <div className={styles.inputLabel}>What stays private, what stays public</div>
      <div style={{ display: "flex", gap: 24, marginTop: 12, flexWrap: "wrap" }}>
        <div style={{ flex: 1, minWidth: 220 }}>
          <div className={styles.subMono} style={{ color: "var(--green)", fontWeight: 700, marginBottom: 8 }}>PRIVATE</div>
          {ROWS.filter((r) => r.hidden).map((r) => (
            <div key={r.hidden} style={{ fontSize: 13, color: "var(--ink)", padding: "6px 0", borderTop: "1px solid var(--line)" }}>
              {r.hidden}
            </div>
          ))}
        </div>
        <div style={{ flex: 1, minWidth: 220 }}>
          <div className={styles.subMono} style={{ color: "var(--pink-text)", fontWeight: 700, marginBottom: 8 }}>PUBLIC</div>
          {ROWS.map((r) => (
            <div key={r.visible} style={{ fontSize: 13, color: "var(--ink)", padding: "6px 0", borderTop: "1px solid var(--line)" }}>
              {r.visible}
            </div>
          ))}
        </div>
      </div>
      <div className={styles.subLine} style={{ marginTop: 12 }}>
        <span>A private transfer needs a recipient already registered. Your own first shield in this app registers you. This app cannot register someone else.</span>
      </div>
    </div>
  );
}
