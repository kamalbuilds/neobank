"use client";
import { create } from "zustand";
import { DEFAULT_NETWORK, type NetworkKey } from "@/utils/constants";

// Single source of truth for network is the connected wallet's chainId.
// displayNetwork only mirrors it: DEFAULT_NETWORK before connect, then set
// from requestChainId in SelectWallet.connectWallet on every connect. Never
// write here from anywhere else, or displayNetwork can drift from the wallet.
interface FrontEndProviderState {
    displayNetwork: NetworkKey,
    setDisplayNetwork: (displayNetwork: NetworkKey) => void,
}

export const useFrontendProvider = create<FrontEndProviderState>()(set => ({
    displayNetwork: DEFAULT_NETWORK,
    setDisplayNetwork: (displayNetwork: NetworkKey) => { set(state => ({ displayNetwork })) }
}));
