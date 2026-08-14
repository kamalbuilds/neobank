import { walletV6, type WalletAccountV6 } from "starknet";
import type { WalletWithStarknetFeatures } from "@starknet-io/get-starknet-wallet-standard/features";
import type { WALLET_API } from "@starknet-io/types-js";
import { providerFor, type NetworkKey } from "@/utils/constants";

// The Wallet API spec declares these error names on every STRK20 method.
// The exact wire shape (JSON-RPC error object vs. thrown Error.message) is
// wallet-dependent and unverifiable outside a browser, so match on both the
// code and the message text.
export type Strk20ErrorKind =
  | "not_registered"
  | "api_version_not_supported"
  | "insufficient_private_balance"
  | "privacy_leak"
  | "invalid_request"
  | "rejected"
  | "unknown";

export interface Strk20Error {
  kind: Strk20ErrorKind;
  message: string;
  raw: string;
}

const COPY: Record<Strk20ErrorKind, string> = {
  not_registered:
    "Approve the first shield in the wallet. That deploys the account if needed and registers it in the pool. This app cannot register a different address for them.",
  api_version_not_supported:
    "This wallet does not support STRK20 privacy actions. Install or update Ready.",
  insufficient_private_balance:
    "Not enough shielded balance to cover this amount plus the pool fee.",
  privacy_leak:
    "The wallet refused this action because it would leak information about your shielded balance. Adjust the amount and try again.",
  invalid_request:
    "The wallet rejected this request as malformed.",
  rejected: "Rejected in the wallet.",
  unknown: "Action failed.",
};

export function classifyStrk20Error(error: unknown): Strk20Error {
  const err = error as { code?: unknown; message?: unknown; baseError?: { code?: unknown; message?: unknown } } | undefined;
  const raw = String(err?.message ?? err?.baseError?.message ?? error ?? "");
  const code = String(err?.code ?? err?.baseError?.code ?? "");
  const text = `${code} ${raw}`.toUpperCase();

  let kind: Strk20ErrorKind = "unknown";
  if (text.includes("NOT_REGISTERED")) kind = "not_registered";
  else if (text.includes("API_VERSION_NOT_SUPPORTED")) kind = "api_version_not_supported";
  else if (text.includes("INSUFFICIENT_PRIVATE_BALANCE")) kind = "insufficient_private_balance";
  else if (text.includes("PRIVACY_LEAK")) kind = "privacy_leak";
  else if (text.includes("INVALID_REQUEST_PAYLOAD") || text.includes("INVALID_REQUEST")) kind = "invalid_request";
  else if (text.includes("REJECT") || text.includes("USER_REFUSED") || text.includes("DENIED")) kind = "rejected";

  return { kind, message: COPY[kind], raw };
}

export interface SubmitResult {
  ok: boolean;
  txHash?: string;
  error?: Strk20Error;
}

// Submit STRK20 actions through the connected WalletAccountV6. The wallet
// handles fee approval, proving, and submission.
export async function submitStrk20(
  walletAccount: WalletAccountV6,
  actions: WALLET_API.STRK20_ACTION[]
): Promise<SubmitResult> {
  try {
    const result = await walletAccount.strk20InvokeTransaction(actions);
    return { ok: true, txHash: result.transaction_hash };
  } catch (error) {
    return { ok: false, error: classifyStrk20Error(error) };
  }
}

export async function isContractDeployed(network: NetworkKey, address: string): Promise<boolean> {
  const provider = providerFor(network);
  try {
    await provider.getClassHashAt(address);
    return true;
  } catch {
    return false;
  }
}

// Ready's "Activate account" is a normal DEPLOY_ACCOUNT. Request it here so
// the first shield never sends the user into the wallet UI to do it by hand.
export async function ensureAccountDeployed(
  walletAccount: WalletAccountV6,
  wallet: WalletWithStarknetFeatures,
  network: NetworkKey,
): Promise<{ alreadyDeployed: boolean; txHash?: string }> {
  if (await isContractDeployed(network, walletAccount.address)) {
    return { alreadyDeployed: true };
  }
  const data = await walletV6.deploymentData(wallet);
  const deployed = await walletAccount.deployAccount({
    classHash: data.class_hash,
    constructorCalldata: data.calldata,
    addressSalt: data.salt,
    contractAddress: data.address,
  });
  if (!deployed.transaction_hash) {
    throw new Error("The wallet did not return a deploy-account transaction.");
  }
  const outcome = await waitStrk20Transaction(deployed.transaction_hash, network);
  if (outcome.status === "error") throw new Error(outcome.message);
  return { alreadyDeployed: false, txHash: deployed.transaction_hash };
}

// First shield for this connected wallet: deploy if needed, then deposit.
// The wallet registers the viewing key on that first deposit (autoRegister).
export async function submitConnectedShield(
  walletAccount: WalletAccountV6,
  wallet: WalletWithStarknetFeatures,
  network: NetworkKey,
  actions: WALLET_API.STRK20_ACTION[],
): Promise<SubmitResult & { deployTxHash?: string }> {
  let deployTxHash: string | undefined;
  try {
    const deploy = await ensureAccountDeployed(walletAccount, wallet, network);
    deployTxHash = deploy.txHash;
  } catch (error) {
    return { ok: false, error: classifyStrk20Error(error), deployTxHash };
  }
  let submission = await submitStrk20(walletAccount, actions);
  if (!submission.ok && submission.error?.kind === "not_registered") {
    submission = await submitStrk20(walletAccount, actions);
  }
  return { ...submission, deployTxHash };
}

export type WaitOutcome =
  // `receipt` is the real RPC receipt, carried so the UI never has to invent one.
  | { status: "confirmed"; reverted: boolean; revertReason?: string; receipt: unknown }
  | { status: "submitted" } // hit the 120s ceiling; not confirmed, not failed
  | { status: "error"; message: string };

const WAIT_CEILING_MS = 120_000;
const POLL_INTERVAL_MS = 3_000;

// Poll with a FRESH RpcProvider for the given network - never the
// WalletAccount's provider, which is frozen to whatever network was active
// at connect time and can silently point at the wrong chain.
export async function waitStrk20Transaction(txHash: string, network: NetworkKey): Promise<WaitOutcome> {
  const provider = providerFor(network);
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    const receipt: any = await Promise.race([
      // The retry budget matches the ceiling. With a larger budget the losing
      // side of this race keeps polling long after the UI has moved on.
      provider.waitForTransaction(txHash, {
        retries: Math.ceil(WAIT_CEILING_MS / POLL_INTERVAL_MS),
        retryInterval: POLL_INTERVAL_MS,
      }),
      new Promise((_, reject) => {
        timer = setTimeout(() => reject(new Error("WAIT_TIMEOUT")), WAIT_CEILING_MS);
      }),
    ]);
    const value = receipt?.value ?? receipt;
    const reverted = value?.execution_status === "REVERTED";
    return { status: "confirmed", reverted, revertReason: value?.revert_reason, receipt: value };
  } catch (error: any) {
    const message: string = error?.message ?? String(error);
    // Either ceiling can fire first. Both mean "submitted, not yet seen by this
    // RPC" - never report an unconfirmed transaction as a failed one.
    if (message === "WAIT_TIMEOUT" || message.includes("timed-out")) return { status: "submitted" };
    return { status: "error", message };
  } finally {
    if (timer) clearTimeout(timer);
  }
}

// Deposit screening is enforced on-chain by the pool. A screened-out deposit
// reverts with a reason naming screening - surface that as a screening state,
// never as a generic "transaction reverted" bug.
export function isScreeningRevert(revertReason: string | undefined): boolean {
  return !!revertReason && /screen/i.test(revertReason);
}

// Consented private-balance read. Call only when the UI will show or spend
// the number. Never use this to feature-detect STRK20 support.
export async function readPrivateBalance(
  walletAccount: WalletAccountV6,
  token: string
): Promise<bigint> {
  const entries = await walletAccount.strk20Balances([token]);
  const entry = entries?.[0] as { balance?: string; amount?: string } | undefined;
  const raw = entry?.balance ?? entry?.amount;
  // Never fall back to zero: a shape this code cannot read would silently
  // present an empty shielded balance as a real one.
  if (raw === undefined) {
    throw new Error("The wallet returned a shielded balance this app could not read. Update Ready and try again.");
  }
  return BigInt(raw);
}
