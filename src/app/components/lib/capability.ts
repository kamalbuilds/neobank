import { compareVersions } from "starknet";

// Gate on ">= 0.10" using the real semver comparator, not ">= 0.10.3": a
// wallet legally advertises the two-part form "0.10", which compares below
// "0.10.3" and would hide every private action from a compliant wallet.
// Never probe strk20Balances to feature-detect - it forces a balance-access
// consent prompt for a check that should read no user data.
const MIN_STRK20_WALLET_API = "0.10";

export function isStrk20Capable(supportedWalletApi: string[]): boolean {
  return supportedWalletApi.some((v) => compareVersions(v, MIN_STRK20_WALLET_API) >= 0);
}
