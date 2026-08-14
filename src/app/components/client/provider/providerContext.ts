"use client";
import { create } from "zustand";
import { DEFAULT_NETWORK, type NetworkKey } from "@/utils/constants";

// Display network before a wallet connects. Mainnet is the sprint default;
// a connected wallet's own chainId (see SelectWallet) drives everything after.
interface FrontEndProviderState {
    displayNetwork: NetworkKey,
    setDisplayNetwork: (displayNetwork: NetworkKey) => void,
}

export const useFrontendProvider = create<FrontEndProviderState>()(set => ({
    displayNetwork: DEFAULT_NETWORK,
    setDisplayNetwork: (displayNetwork: NetworkKey) => { set(state => ({ displayNetwork })) }
}));
