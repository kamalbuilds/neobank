"use client";

import { VaultShell } from './components/v2/VaultShell';
import styles from './uni.module.css';

export default function Home() {
  return (
    <div className={styles.page}>
      <div className={styles.aurora} aria-hidden="true" />

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

      <VaultShell />

      <footer className={styles.footer}>
        <span>STRK20 pool on Starknet</span>
        <span className={styles.footerDot}>·</span>
        <a
          href="https://strk20-by-example.org/what-is-strk20"
          target="_blank"
          rel="noreferrer"
        >
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
