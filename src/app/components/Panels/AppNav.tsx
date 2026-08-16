"use client";
import styles from "../../uni.module.css";
import SelectWallet from "../client/WalletHandle/SelectWallet";
import { useStoreWallet } from "../Wallet/walletContext";
import { NETWORKS } from "@/utils/constants";

export default function AppNav() {
  const network = useStoreWallet((s) => s.network);
  const isConnected = useStoreWallet((s) => s.isConnected);

  return (
    <div className={styles.nav}>
      <div className={styles.brand}>Private money account</div>
      <div className={styles.brand}>
        {isConnected && network ? (
          <span className={`${styles.feeVal}`} style={{ fontSize: 13 }}>
            <span className={`${styles.netDot} ${styles.netOkDot}`} />
            {NETWORKS[network].label}
          </span>
        ) : null}
        <SelectWallet variant="nav" />
      </div>
    </div>
  );
}
