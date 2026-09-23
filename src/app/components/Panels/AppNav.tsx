"use client";
import { ui } from "../lib/panelUi";
import SelectWallet from "../client/WalletHandle/SelectWallet";
import { useStoreWallet } from "../Wallet/walletContext";
import { NETWORKS } from "@/utils/constants";
import { NetworkChip } from "./PoolFacts";

export default function AppNav() {
  const network = useStoreWallet((s) => s.network);
  const isConnected = useStoreWallet((s) => s.isConnected);

  return (
    <div className={ui.nav}>
      <div className={ui.brand}>
        <span>
          <span className="text-ink">Sealed</span>
          <span className="text-muted">.cash</span>
        </span>
      </div>
      <div className="flex items-center gap-3">
        {isConnected && network ? (
          <NetworkChip network={network} aria-label={NETWORKS[network].label} />
        ) : null}
        <SelectWallet variant="nav" />
      </div>
    </div>
  );
}
