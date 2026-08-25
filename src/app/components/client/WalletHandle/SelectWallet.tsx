"use client";
import styles from "../../../uni.module.css";
import { useStoreWallet } from "../../Wallet/walletContext";
import { useFrontendProvider } from "../provider/providerContext";
import { useEffect, useState } from "react";
import { walletV6, validateAndParseAddress, WalletAccountV6 } from "starknet";
import { WALLET_API } from "@starknet-io/types-js";
import { networkForChainId, providerFor } from "@/utils/constants";
import { createStore, type Store } from "@starknet-io/get-starknet-discovery";
import type {
  WalletWithStarknetFeatures,
} from '@starknet-io/get-starknet-wallet-standard/features';
import { isStrk20Capable } from "../../lib/capability";

// Normalize wallet identifiers for the MetaMask filter below.
function normalizeId(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]/g, "");
}

export default function SelectWallet({ variant = "ctaBig" }: { variant?: "nav" | "ctaBig" }) {

  const setMyWallet = useStoreWallet(state => state.setMyStarknetWalletObject);
  const setMyWalletAccount = useStoreWallet(state => state.setMyWalletAccount);
  const setDisplayNetwork = useFrontendProvider(state => state.setDisplayNetwork);

  const isConnected = useStoreWallet(state => state.isConnected);
  const setConnected = useStoreWallet(state => state.setConnected);
  const address = useStoreWallet(state => state.address);
  const resetWallet = useStoreWallet(state => state.resetWallet);

  const setWalletApi = useStoreWallet(state => state.setWalletApiList);
  const setStrk20Capable = useStoreWallet(state => state.setStrk20Capable);

  const setChain = useStoreWallet(state => state.setChain);
  const setNetwork = useStoreWallet(state => state.setNetwork);
  const setAddressAccount = useStoreWallet(state => state.setAddressAccount);

  const [connecting, setConnecting] = useState(false);
  const [error, setError] = useState<string>("");
  const [pickerOpen, setPickerOpen] = useState(false);
  // Detected Starknet wallets, in render state so the picker updates as wallets register.
  const [wallets, setWallets] = useState<WalletWithStarknetFeatures[]>([]);

  // Create the discovery store once on mount so wallets have time to register
  // before the user opens the picker. eip1193Adapters:[] keeps MetaMask out entirely
  // (no EIP-6963 MetaMask bridging / Snap probing).
  useEffect(() => {
    const store: Store = createStore({ eip1193Adapters: [] });
    setWallets(store.getWallets().slice());
    const unsub = store.subscribe((next) => setWallets(next.slice()));
    return () => unsub();
  }, []);

  // Show every detected wallet except MetaMask (its Snap probing spams an unlock
  // popup). Braavos is not excluded by name - the STRK20 version gate handles it.
  const pickable = wallets.filter((w) => !normalizeId(w.name).includes("metamask"));

  // Connect the picked wallet, choosing the RPC from the wallet's own chainId
  // (mainnet or sepolia), then gate STRK20 actions on a real capability check.
  // Ready rejects chainId / network reads until the dapp is authorized
  // ("Not preauthorized"). requestAccounts opens that connect popup first.
  async function handleSelectedWallet(selectedWallet: WalletWithStarknetFeatures) {
    setMyWallet(selectedWallet); // zustand

    const result = await walletV6.requestAccounts(selectedWallet);
    if (typeof (result) == "string") {
      throw new Error("This wallet returned an unexpected response to requestAccounts.");
    }
    const addr = validateAndParseAddress(result[0]);
    setAddressAccount(addr); // zustand

    const chainId = (await walletV6.requestChainId(selectedWallet)) as string;
    const network = networkForChainId(chainId);
    setChain(chainId);
    setNetwork(network);
    if (network) setDisplayNetwork(network);

    const provider = providerFor(network ?? "mainnet");
    const myWA = await WalletAccountV6.connect(provider, selectedWallet);
    setMyWalletAccount(myWA);

    const isConnectedWallet: boolean = await walletV6.getPermissions(selectedWallet).then((res: any) => (res as WALLET_API.Permission[]).includes(WALLET_API.Permission.ACCOUNTS));
    setConnected(isConnectedWallet); // zustand

    if (isConnectedWallet) {
      // Capability detection: a version query only, never a data call - see
      // components/lib/capability.ts for why the threshold is "0.10" not "0.10.3".
      const apiVersions = (await walletV6.supportedWalletApi(selectedWallet)) as unknown as string[];
      setWalletApi(apiVersions);
      setStrk20Capable(isStrk20Capable(apiVersions));
    }
  }

  const openPicker = () => {
    setError("");
    setPickerOpen(true);
  };

  // We deliberately do NOT use starknetkit's connect() here: it bundles
  // get-starknet-core, whose MetaMask detection (waitForMetaMaskProvider, retries:3)
  // repeatedly dispatches EIP-6963 discovery and probes MetaMask's Starknet Snap,
  // spamming its unlock popup. eip1193Adapters:[] above keeps MetaMask out of discovery
  // entirely, and only the picked wallet ever receives a request().
  async function selectWallet(w: WalletWithStarknetFeatures) {
    setError("");
    setConnecting(true);
    try {
      await handleSelectedWallet(w);
      setPickerOpen(false);
    } catch (err: any) {
      setError(err?.message ?? "Wallet connection failed.");
    } finally {
      setConnecting(false);
    }
  }

  function disconnect() {
    resetWallet();
  }

  const shortAddr = address ? `${address.slice(0, 6)}…${address.slice(-4)}` : "";

  const picker = pickerOpen ? (
    <div className={styles.modalOverlay} onClick={() => !connecting && setPickerOpen(false)}>
      <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
        <div className={styles.modalHead}>
          <span className={styles.modalTitle}>Connect a wallet</span>
          <button
            className={styles.modalClose}
            onClick={() => setPickerOpen(false)}
            aria-label="Close"
            disabled={connecting}
          >
            ×
          </button>
        </div>

        {pickable.length ? (
          <div className={styles.walletList}>
            {pickable.map((w) => (
              <button
                key={w.name}
                className={styles.walletRow}
                onClick={() => selectWallet(w)}
                disabled={connecting}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img className={styles.walletIcon} src={w.icon} alt="" />
                <span className={styles.walletName}>{w.name}</span>
                <span className={styles.walletGo}>{connecting ? "…" : "→"}</span>
              </button>
            ))}
          </div>
        ) : (
          <div className={styles.walletHint}>
            No Starknet wallet detected. Install{" "}
            <a href="https://www.ready.co/" target="_blank" rel="noreferrer">Ready</a> for private actions, or{" "}
            <a href="https://www.xverse.app/" target="_blank" rel="noreferrer">Xverse</a>.
          </div>
        )}

        {error ? <div className={styles.errorText}>{error}</div> : null}
      </div>
    </div>
  ) : null;

  // Nav variant: a compact Connect pill, or the connected address with disconnect.
  if (variant === "nav") {
    if (isConnected && address) {
      return (
        <button
          className={styles.addrPill}
          onClick={disconnect}
          title="Disconnect"
        >
          <span className={styles.addrDot} />
          {shortAddr}
          <span className={styles.addrDisconnect}>Disconnect</span>
        </button>
      );
    }
    return (
      <>
        <button className={styles.connectPill} onClick={openPicker}>
          Connect
        </button>
        {picker}
      </>
    );
  }

  // Default (ctaBig): the large solid connect CTA shown until a wallet is connected.
  return (
    <>
      <button className={styles.btnCta} onClick={openPicker}>
        Connect a Wallet
      </button>
      {picker}
    </>
  );
}
