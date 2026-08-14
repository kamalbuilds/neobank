"use client";
import { create } from "zustand";
import { ProviderInterface, AccountInterface, type WalletAccountV6 } from "starknet";
import { type WalletWithStarknetFeatures } from "@starknet-io/get-starknet-wallet-standard/features";
import type { NetworkKey } from "@/utils/constants";

export interface WalletState {
    StarknetWalletObject: WalletWithStarknetFeatures | undefined,
    setMyStarknetWalletObject: (wallet: WalletWithStarknetFeatures) => void,
    address: string,
    setAddressAccount: (address: string) => void,
    chain: string,
    setChain: (chain: string) => void,
    network: NetworkKey | undefined,
    setNetwork: (network: NetworkKey | undefined) => void,
    myWalletAccount: WalletAccountV6 | undefined;
    setMyWalletAccount: (myWAccount: WalletAccountV6) => void;
    account: AccountInterface | undefined,
    setAccount: (account: AccountInterface) => void,
    provider: ProviderInterface | undefined,
    setProvider: (provider: ProviderInterface) => void,
    isConnected: boolean,
    setConnected: (isConnected: boolean) => void,
    displaySelectWalletUI: boolean,
    setSelectWalletUI: (displaySelectWalletUI: boolean) => void,
    walletApiList: string[],
    setWalletApiList: (version: string[]) => void,
    // Wallet API >= 0.10 per compareVersions - the STRK20 capability gate.
    strk20Capable: boolean,
    setStrk20Capable: (capable: boolean) => void,
    // Clears everything set on connect. Called on disconnect.
    resetWallet: () => void,
}

export const useStoreWallet = create<WalletState>()(set => ({
    StarknetWalletObject: undefined,
    setMyStarknetWalletObject: (wallet: WalletWithStarknetFeatures) => { set(state => ({ StarknetWalletObject: wallet })) },
    address: "",
    setAddressAccount: (address: string) => { set(state => ({ address })) },
    chain: "",
    setChain: (chain: string) => { set(state => ({ chain: chain })) },
    network: undefined,
    setNetwork: (network: NetworkKey | undefined) => { set(state => ({ network })) },
    myWalletAccount: undefined,
    setMyWalletAccount: (myWAccount: WalletAccountV6) => { set(state => ({ myWalletAccount: myWAccount })) },
    account: undefined,
    setAccount: (account: AccountInterface) => { set(state => ({ account })) },
    provider: undefined,
    setProvider: (provider: ProviderInterface) => { set(state => ({ provider: provider })) },
    isConnected: false,
    setConnected: (isConnected: boolean) => { set(state => ({ isConnected })) },
    displaySelectWalletUI: false,
    setSelectWalletUI: (displaySelectWalletUI: boolean) => { set(state => ({ displaySelectWalletUI })) },
    walletApiList: [],
    setWalletApiList: (walletApi: string[]) => { set(state => ({ walletApiList: walletApi })) },
    strk20Capable: false,
    setStrk20Capable: (strk20Capable: boolean) => { set(state => ({ strk20Capable })) },
    resetWallet: () => { set({
        StarknetWalletObject: undefined,
        address: "",
        chain: "",
        network: undefined,
        myWalletAccount: undefined,
        account: undefined,
        provider: undefined,
        isConnected: false,
        walletApiList: [],
        strk20Capable: false,
    }) },
}));
