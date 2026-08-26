import type { Call } from "starknet";
import { shortString } from "starknet";
import {
  shadowAccountAddress,
  shadowAccountCommitment,
  shadowAccountPartialCommitment,
} from "@starkware-libs/starknet-privacy-sdk";
import { ANONYMIZER_ADDRESSES } from "@/utils/constants";

/** Official Sepolia ShadowAccountAnonymizer. Do not redeploy. */
export const sepoliaShadowAnonymizer =
  ANONYMIZER_ADDRESSES.sepolia.shadowAccount;

/** Official mainnet ShadowAccountAnonymizer (constants only). */
export const mainnetShadowAnonymizer =
  ANONYMIZER_ADDRESSES.mainnet.shadowAccount;

/** Default dapp felt scope for hosted card spend identities. */
export const CARD_SHADOW_DAPP_NAME = "neobank-card";

export class MissingShadowAnonymizerError extends Error {
  readonly name = "MissingShadowAnonymizerError";

  constructor(message = "Shadow account anonymizer address is not configured.") {
    super(message);
  }
}

export type DeriveSpendIdentityParams = {
  viewingKey: bigint;
  user: bigint;
  dappName: string | bigint;
  nonce: bigint | number | string;
  anonymizer?: string | bigint | null;
};

export type SpendIdentity = {
  partialCommitment: bigint;
  commitment: bigint;
  address: bigint;
  addressHex: string;
  nonce: bigint;
  anonymizer: bigint;
  dappName: bigint;
};

export type BuildShadowSpendCallsParams = {
  viewingKey: bigint;
  user: bigint;
  dappName: string | bigint;
  nonce: bigint | number | string;
  anonymizer?: string | bigint | null;
  token: string;
  amount: bigint;
  calls: Call[];
};

/**
 * Sketch of one shadow spend transaction: fund the predicted address in the
 * same builder via `.with(token, t => t.withdraw({ recipient, amount }))`, then
 * exactly one `shadows.invoke` / `computeAndInvoke`. Not a live chain call.
 */
export type ShadowSpendSketch = {
  predictedAddress: string;
  commitment: bigint;
  partialCommitment: bigint;
  nonce: bigint;
  anonymizer: string;
  dappName: bigint;
  fundWithdraw: {
    token: string;
    recipient: string;
    amount: bigint;
  };
  invoke: {
    nonce: bigint;
    calls: Call[];
    collectPolicy: { type: "all" };
  };
};

function encodeDappName(dappName: string | bigint): bigint {
  if (typeof dappName === "string") {
    return BigInt(shortString.encodeShortString(dappName));
  }
  return BigInt(dappName);
}

function asFeltHex(value: bigint): string {
  return `0x${value.toString(16)}`;
}

/**
 * Resolve the shadow anonymizer address. An explicit `null` or empty string is
 * treated as missing config (named error). When the argument is omitted,
 * falls back to `CARD_SHADOW_ANONYMIZER`, then the Sepolia constant.
 */
export function resolveShadowAnonymizer(
  anonymizer?: string | bigint | null,
): bigint {
  if (anonymizer !== undefined) {
    if (anonymizer === null || anonymizer === "") {
      throw new MissingShadowAnonymizerError();
    }
    return BigInt(anonymizer);
  }

  const fromEnv = process.env.CARD_SHADOW_ANONYMIZER;
  if (fromEnv !== undefined && fromEnv !== "") {
    return BigInt(fromEnv);
  }

  const fromConstants = ANONYMIZER_ADDRESSES.sepolia.shadowAccount;
  if (!fromConstants) {
    throw new MissingShadowAnonymizerError();
  }
  return BigInt(fromConstants);
}

/**
 * Deterministic hosted spend identity for `(user, dapp, nonce)` under a viewing
 * key and anonymizer. Uses SDK `shadowAccountPartialCommitment` /
 * `shadowAccountCommitment` / `shadowAccountAddress` — no chain call.
 */
export function deriveSpendIdentity(
  params: DeriveSpendIdentityParams,
): SpendIdentity {
  const anonymizer = resolveShadowAnonymizer(params.anonymizer);
  const dappName = encodeDappName(params.dappName);
  const nonce = BigInt(params.nonce);
  const partialCommitment = shadowAccountPartialCommitment(
    params.user,
    params.viewingKey,
    anonymizer,
    dappName,
  );
  const commitment = shadowAccountCommitment(partialCommitment, nonce);
  const address = shadowAccountAddress(commitment, anonymizer);
  return {
    partialCommitment,
    commitment,
    address,
    addressHex: asFeltHex(address),
    nonce,
    anonymizer,
    dappName,
  };
}

/**
 * Smallest non-negative nonce not present in `usedNonces`.
 */
export function nextUnusedNonce(
  usedNonces: Iterable<bigint | number | string>,
): bigint {
  const used = new Set<bigint>();
  for (const value of usedNonces) {
    used.add(BigInt(value));
  }
  let nonce = 0n;
  while (used.has(nonce)) {
    nonce += 1n;
  }
  return nonce;
}

/**
 * Build the data a card runtime needs to fund a predicted shadow address and
 * invoke through it in one private transfer. Returns addresses and calldata
 * sketch only — does not submit a transaction.
 *
 * Intended wiring (runtime owner):
 * ```
 * createPrivateTransfers({ ..., shadowAccountAnonymizerAddress })
 * transfers.build(...)
 *   .with(token, t => t.withdraw({ recipient: predicted, amount }))
 *   .shadowAccounts(dappName)
 *   .invoke(nonce, { calls, collectPolicy: { type: "all" } })
 * ```
 * At most one `computeAndInvoke` per transaction.
 */
export function buildShadowSpendCalls(
  params: BuildShadowSpendCallsParams,
): ShadowSpendSketch {
  if (params.amount <= 0n) {
    throw new Error("Shadow spend amount must be positive.");
  }
  if (params.calls.length === 0) {
    throw new Error("Shadow spend requires at least one call.");
  }

  const identity = deriveSpendIdentity(params);
  const anonymizerHex = asFeltHex(identity.anonymizer);
  const predictedAddress = identity.addressHex;

  return {
    predictedAddress,
    commitment: identity.commitment,
    partialCommitment: identity.partialCommitment,
    nonce: identity.nonce,
    anonymizer: anonymizerHex,
    dappName: identity.dappName,
    fundWithdraw: {
      token: params.token,
      recipient: predictedAddress,
      amount: params.amount,
    },
    invoke: {
      nonce: identity.nonce,
      calls: params.calls,
      collectPolicy: { type: "all" },
    },
  };
}
