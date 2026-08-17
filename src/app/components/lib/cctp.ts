import { CallData, cairo, type Call, type WalletAccountV6 } from "starknet";
import { CCTP, TOKENS, type CctpChain } from "@/utils/constants";

// Circle CCTP V2 Standard Transfer: min_finality_threshold 2000, confirmed
// via https://iris-api.circle.com/v2/burn/USDC/fees/25/6 to carry a 0
// minimumFee (Fast Transfer at threshold 1000 charges a fee and needs a
// separate allowance check, so this app only offers Standard).
const STANDARD_MIN_FINALITY_THRESHOLD = 2000;
const STANDARD_MAX_FEE = 0n;

const BASE58_ALPHABET = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";

// Verified against three known mainnet Solana addresses (System Program,
// Token Program, USDC mint) - all decode to exactly 32 bytes with the
// expected leading byte.
function base58Decode(input: string): Uint8Array {
  if (input.length === 0) throw new Error("Empty address.");
  const bytes = [0];
  for (const char of input) {
    const value = BASE58_ALPHABET.indexOf(char);
    if (value === -1) throw new Error(`Invalid base58 character: ${char}`);
    let carry = value;
    for (let i = 0; i < bytes.length; i++) {
      carry += bytes[i] * 58;
      bytes[i] = carry & 0xff;
      carry >>= 8;
    }
    while (carry > 0) {
      bytes.push(carry & 0xff);
      carry >>= 8;
    }
  }
  // Leading '1' characters are leading zero bytes. The `- 1` avoids double
  // counting the seed zero already in `bytes` when the whole value is zero.
  for (let k = 0; k < input.length - 1 && input[k] === "1"; k++) {
    bytes.push(0);
  }
  return Uint8Array.from(bytes.reverse());
}

function bytesToBigInt(bytes: Uint8Array): bigint {
  let value = 0n;
  for (const b of bytes) value = (value << 8n) | BigInt(b);
  return value;
}

// CCTP's `mint_recipient` is a u256: the destination address right-aligned
// in 32 bytes, read big-endian. A Base (EVM) address is 20 bytes; a Solana
// public key is already 32 bytes.
export function encodeMintRecipient(chain: CctpChain, recipient: string): bigint {
  const trimmed = recipient.trim();
  if (chain === "base") {
    if (!/^0x[0-9a-fA-F]{40}$/.test(trimmed)) {
      throw new Error("Enter a valid Base address: 0x followed by 40 hex characters.");
    }
    return BigInt(trimmed);
  }
  let bytes: Uint8Array;
  try {
    bytes = base58Decode(trimmed);
  } catch {
    throw new Error("Enter a valid Solana address (base58).");
  }
  if (bytes.length !== 32) {
    throw new Error(`Solana address decoded to ${bytes.length} bytes, expected 32. Check the address.`);
  }
  return bytesToBigInt(bytes);
}

export function assertNativeUsdc(tokenAddress: string): void {
  if (BigInt(tokenAddress) !== BigInt(TOKENS.USDC.address)) {
    throw new Error("CCTP only burns native USDC. This app will not burn bridged USDC.e.");
  }
  if (BigInt(tokenAddress) === BigInt(CCTP.bridgedUsdcE)) {
    throw new Error("CCTP only burns native USDC. This app will not burn bridged USDC.e.");
  }
}

// Public ERC-20 approve + CCTP V2 deposit_for_burn, Standard Transfer.
// destination_caller = 0 (any address may broadcast the message on the
// destination chain, which is required since this app has no destination
// signer of its own).
export function buildDepositForBurnCalls(params: {
  amount: bigint;
  destinationDomain: number;
  mintRecipient: bigint;
}): Call[] {
  assertNativeUsdc(TOKENS.USDC.address);
  const approve: Call = {
    contractAddress: TOKENS.USDC.address,
    entrypoint: "approve",
    calldata: CallData.compile({
      spender: CCTP.tokenMessengerMinter,
      amount: cairo.uint256(params.amount),
    }),
  };
  const depositForBurn: Call = {
    contractAddress: CCTP.tokenMessengerMinter,
    entrypoint: "deposit_for_burn",
    calldata: CallData.compile({
      amount: cairo.uint256(params.amount),
      destination_domain: params.destinationDomain,
      mint_recipient: cairo.uint256(params.mintRecipient),
      burn_token: TOKENS.USDC.address,
      destination_caller: cairo.uint256(0n),
      max_fee: cairo.uint256(STANDARD_MAX_FEE),
      min_finality_threshold: STANDARD_MIN_FINALITY_THRESHOLD,
    }),
  };
  return [approve, depositForBurn];
}

export interface CctpSubmitResult {
  ok: boolean;
  txHash?: string;
  error?: string;
}

// Public WalletAccount invoke, deliberately not strk20InvokeTransaction:
// deposit_for_burn burns a public balance, it never touches a shielded note
// or a viewing key.
export async function submitCctpBurn(walletAccount: WalletAccountV6, calls: Call[]): Promise<CctpSubmitResult> {
  try {
    const result = await walletAccount.execute(calls);
    return { ok: true, txHash: result.transaction_hash };
  } catch (error: any) {
    const message = error?.message ?? error?.baseError?.message ?? String(error);
    return { ok: false, error: message };
  }
}

// ─── Circle Iris attestation (public API, no key) ───────────────────────
// https://developers.circle.com/api-reference/cctp/all/get-messages-v2

const IRIS_BASE_URL = "https://iris-api.circle.com";
const ATTESTATION_POLL_INTERVAL_MS = 4_000;
const ATTESTATION_POLL_CEILING_MS = 120_000;

export interface CctpMessage {
  status: string;
  attestation?: string;
  message?: string;
}

export async function fetchCctpMessage(sourceDomain: number, txHash: string): Promise<CctpMessage | undefined> {
  const res = await fetch(`${IRIS_BASE_URL}/v2/messages/${sourceDomain}?transactionHash=${txHash}`);
  if (!res.ok) return undefined;
  const body = await res.json().catch(() => undefined);
  const msg = body?.messages?.[0];
  if (!msg) return undefined;
  return {
    status: String(msg.status ?? ""),
    attestation: typeof msg.attestation === "string" ? msg.attestation : undefined,
    message: typeof msg.message === "string" ? msg.message : undefined,
  };
}

export type AttestationOutcome =
  | { status: "complete"; attestation: string; message: string }
  | { status: "pending" }
  | { status: "timeout" };

// Polls Circle's public Iris API for the attestation covering this burn.
// Never fabricates a "minted" state - completing the mint still needs a
// receive_message call signed by a wallet on the destination chain, which
// this app does not hold.
export async function pollCctpAttestation(sourceDomain: number, txHash: string): Promise<AttestationOutcome> {
  const deadline = Date.now() + ATTESTATION_POLL_CEILING_MS;
  for (;;) {
    const found = await fetchCctpMessage(sourceDomain, txHash).catch(() => undefined);
    if (found?.status === "complete" && found.attestation && found.message) {
      return { status: "complete", attestation: found.attestation, message: found.message };
    }
    if (Date.now() >= deadline) return { status: "timeout" };
    await new Promise((resolve) => setTimeout(resolve, ATTESTATION_POLL_INTERVAL_MS));
  }
}
