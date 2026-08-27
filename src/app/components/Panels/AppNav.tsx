"use client";
import { ui } from "../lib/panelUi";
import SelectWallet from "../client/WalletHandle/SelectWallet";
import { useStoreWallet } from "../Wallet/walletContext";
import { NETWORKS } from "@/utils/constants";

export default function AppNav() {
  const network = useStoreWallet((s) => s.network);
  const isConnected = useStoreWallet((s) => s.isConnected);

  return (
    <div className={ui.nav}>
      <div className={ui.brand}>Sotto</div>
      <div className={ui.brand}>
        {isConnected && network ? (
          <span className={`${ui.feeVal} text-[13px]`}>
            <span className={`${ui.netDot} ${ui.netOkDot}`} />
            {NETWORKS[network].label}
          </span>
        ) : null}
        <SelectWallet variant="nav" />
      </div>
    </div>
  );
}
