import {
  Account,
  RpcProvider,
  cairo,
  constants,
  hash,
  type Call,
} from "starknet";
import {
  IndexerDiscoveryProvider,
  Open,
  createPrivateTransfers,
} from "@starkware-libs/starknet-privacy-sdk";
import {
  CARD_SHADOW_DAPP_NAME,
  deriveSpendIdentity,
  resolveShadowAnonymizer,
  type SpendIdentity,
} from "./shadow.ts";
import {
  deriveHostedViewingKey,
  ensurePoolFeeAllowance,
  isTerminalFinality,
  parseCardRuntimeConfig,
} from "./runtime.ts";

/** 18-decimal STRK. */
const STRK_DECIMALS = 18n;
const STRK_UNIT = 10n ** STRK_DECIMALS;

/** Hard cap so the hosted route can never drain the pool position. */
export const MAX_SHADOW_SPEND_UNITS = 5n * STRK_UNIT;

/**
 * Extra unit withdrawn to the shadow address beyond the spend so the
 * collect-all open note settles a non-zero balance, mirroring the
 * programmable-spend change-dust convention in the swipe path.
 */
export const SHADOW_CHANGE_DUST = 1n;

/** How many shadow nonces to probe before giving up. */
const MAX_NONCE_PROBES = 64n;

type Environment = Readonly<Record<string, string | undefined>>;

export class ShadowSpendConfigError extends Error {
  readonly name = "ShadowSpendConfigError";
}

/**
 * Parse a decimal STRK amount ("0.1") into 18-decimal units. Fail-closed:
 * rejects malformed input, zero, negatives, more than 18 decimals, and
 * anything above {@link MAX_SHADOW_SPEND_UNITS}.
 */
export function parseStrkAmount(raw: string): bigint {
  const match = /^(\d+)(?:\.(\d{1,18}))?$/.exec(raw.trim());
  if (!match) {
    throw new ShadowSpendConfigError(`Invalid STRK amount: ${raw}`);
  }
  const whole = BigInt(match[1]);
  const fraction = match[2]
    ? BigInt(match[2].padEnd(Number(STRK_DECIMALS), "0"))
    : 0n;
  const units = whole * STRK_UNIT + fraction;
  if (units <= 0n) {
    throw new ShadowSpendConfigError("Shadow spend amount must be positive.");
  }
  if (units > MAX_SHADOW_SPEND_UNITS) {
    throw new ShadowSpendConfigError(
      `Shadow spend above the ${MAX_SHADOW_SPEND_UNITS.toString()} unit cap.`,
    );
  }
  return units;
}

/**
 * The address the deployed Sepolia ShadowAccountAnonymizer gives a shadow
 * account: `deploy(salt=commitment, class=get_shadow_account_class_hash(),
 * calldata=[], deployer=anonymizer)`. The SDK's `shadowAccountAddress` mirror
 * assumes a stale primer class on this deployment, so predict against the
 * class hash read from the anonymizer itself (verified against a live
 * simulation trace on 2026-08-27).
 */
export function predictShadowAccountAddress(
  commitment: bigint,
  shadowClassHash: bigint,
  anonymizer: bigint,
): string {
  const address = BigInt(
    hash.calculateContractAddressFromHash(
      commitment,
      shadowClassHash,
      [],
      anonymizer,
    ),
  );
  return `0x${address.toString(16)}`;
}

export type ShadowSpendPlan = {
  identity: SpendIdentity;
  /** Address the anonymizer will deploy/execute for this commitment. */
  fundingAddress: string;
  /** Units withdrawn from the pool to the predicted shadow address. */
  funded: bigint;
  /** Units the shadow account forwards to the recipient. */
  amount: bigint;
  recipient: string;
  token: string;
  /** The single call the anonymizer runs through the shadow account. */
  spendCall: Call;
  collectPolicy: { type: "all" };
};

export type PlanShadowSpendParams = {
  viewingKey: bigint;
  user: bigint;
  nonce: bigint;
  token: string;
  amount: bigint;
  recipient: string;
  /** From the anonymizer's `get_shadow_account_class_hash` view. */
  shadowClassHash: bigint;
  anonymizer?: string | bigint | null;
  dappName?: string;
};

/**
 * Deterministic plan for one shadow spend: fund the nonce-derived address via
 * a pool withdraw, run exactly one ERC-20 transfer through it, and collect the
 * leftover into an open note. Pure — no chain call.
 */
export function planShadowSpend(params: PlanShadowSpendParams): ShadowSpendPlan {
  if (params.amount <= 0n) {
    throw new ShadowSpendConfigError("Shadow spend amount must be positive.");
  }
  if (params.amount > MAX_SHADOW_SPEND_UNITS) {
    throw new ShadowSpendConfigError(
      `Shadow spend above the ${MAX_SHADOW_SPEND_UNITS.toString()} unit cap.`,
    );
  }
  if (!/^0x[0-9a-fA-F]+$/.test(params.recipient)) {
    throw new ShadowSpendConfigError(
      "Shadow spend recipient must be a 0x-prefixed felt.",
    );
  }
  const identity = deriveSpendIdentity({
    viewingKey: params.viewingKey,
    user: params.user,
    dappName: params.dappName ?? CARD_SHADOW_DAPP_NAME,
    nonce: params.nonce,
    anonymizer: params.anonymizer,
  });
  if (params.shadowClassHash <= 0n) {
    throw new ShadowSpendConfigError(
      "Shadow spend needs the anonymizer's shadow account class hash.",
    );
  }
  const amountU256 = cairo.uint256(params.amount);
  return {
    identity,
    fundingAddress: predictShadowAccountAddress(
      identity.commitment,
      params.shadowClassHash,
      identity.anonymizer,
    ),
    funded: params.amount + SHADOW_CHANGE_DUST,
    amount: params.amount,
    recipient: params.recipient,
    token: params.token,
    spendCall: {
      contractAddress: params.token,
      entrypoint: "transfer",
      calldata: [params.recipient, amountU256.low, amountU256.high],
    },
    collectPolicy: { type: "all" },
  };
}

type ClassHashReader = {
  getClassHashAt(address: string): Promise<string>;
};

function isContractNotFound(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  return /contract not found/i.test(message);
}

/**
 * Smallest shadow nonce whose derived address is not deployed yet. A deployed
 * primer means the nonce was consumed by an earlier invoke. RPC errors other
 * than contract-not-found rethrow so a flaky node cannot alias a live nonce.
 */
export async function probeUnusedShadowNonce(
  provider: ClassHashReader,
  addressFor: (nonce: bigint) => string,
): Promise<bigint> {
  for (let nonce = 0n; nonce < MAX_NONCE_PROBES; nonce += 1n) {
    try {
      await provider.getClassHashAt(addressFor(nonce));
    } catch (error) {
      if (isContractNotFound(error)) return nonce;
      throw error;
    }
  }
  throw new ShadowSpendConfigError(
    `No unused shadow nonce in the first ${MAX_NONCE_PROBES} probes.`,
  );
}

export type ShadowSpendRequest = {
  /** 18-decimal token units to forward to the recipient. */
  amount: bigint;
  /** Defaults to CARD_SETTLEMENT_RECIPIENT. */
  recipient?: string;
  /** Explicit shadow nonce; defaults to the first undeployed one. */
  nonce?: bigint;
};

export type ShadowSpendResult = {
  transactionHash: string;
  finalityStatus: string;
  executionStatus: string;
  blockNumber?: number;
  shadowAddress: string;
  shadowNonce: string;
  commitment: string;
  anonymizer: string;
  dappName: string;
  amount: string;
  funded: string;
  recipient: string;
  token: string;
  warnings: string[];
};

async function waitForTerminalReceipt(
  provider: RpcProvider,
  transactionHash: string,
  timeoutMs = 240_000,
) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      const receipt = await provider.getTransactionReceipt(transactionHash);
      const finality =
        "finality_status" in receipt ? String(receipt.finality_status) : "";
      if (isTerminalFinality(finality)) return receipt;
    } catch {
      // The tx can take a few blocks to surface at the selected RPC.
    }
    await new Promise((resolve) => setTimeout(resolve, 2_000));
  }
  throw new Error(`Timed out waiting for ${transactionHash}`);
}

/**
 * Execute one live shadow spend on Sepolia: withdraw `amount + dust` from the
 * hosted pool position to a fresh nonce-derived shadow address, run a single
 * ERC-20 transfer to the recipient through the ShadowAccountAnonymizer's
 * privacy_invoke_with_computation, and settle the leftover into an open note
 * for the hosted account. This path owns the transaction's one privacy_invoke,
 * so it never composes with the CardProgram swipe path.
 */
export async function executeShadowSpend(
  request: ShadowSpendRequest,
  env: Environment = process.env,
): Promise<ShadowSpendResult> {
  const config = parseCardRuntimeConfig(env);
  const recipient = request.recipient || env.CARD_SETTLEMENT_RECIPIENT;
  if (!recipient) {
    throw new ShadowSpendConfigError(
      "Shadow spend needs a recipient or CARD_SETTLEMENT_RECIPIENT.",
    );
  }
  const anonymizer = resolveShadowAnonymizer(
    env.CARD_SHADOW_ANONYMIZER === undefined
      ? undefined
      : env.CARD_SHADOW_ANONYMIZER,
  );
  const anonymizerHex = `0x${anonymizer.toString(16)}`;

  const provider = new RpcProvider({ nodeUrl: config.rpcUrl });
  const account = new Account({
    provider,
    address: config.accountAddress,
    signer: config.privateKey,
    cairoVersion: "1",
  });
  await ensurePoolFeeAllowance({
    provider,
    account,
    accountAddress: config.accountAddress,
    poolAddress: config.poolAddress,
  });
  const viewingKey = deriveHostedViewingKey(
    config.privateKey,
    constants.StarknetChainId.SN_SEPOLIA,
    config.poolAddress,
  );
  // The anonymizer deploys shadow accounts with this class; read it live so
  // funding lands on the address the anonymizer will actually execute.
  const classHashResult = await provider.callContract({
    contractAddress: anonymizerHex,
    entrypoint: "get_shadow_account_class_hash",
    calldata: [],
  });
  const shadowClassHash = BigInt(classHashResult[0] || "0");
  if (shadowClassHash === 0n) {
    throw new ShadowSpendConfigError(
      "Anonymizer returned a zero shadow account class hash.",
    );
  }
  const addressFor = (nonce: bigint) => {
    const identity = deriveSpendIdentity({
      viewingKey,
      user: BigInt(config.accountAddress),
      dappName: CARD_SHADOW_DAPP_NAME,
      nonce,
      anonymizer: anonymizerHex,
    });
    return predictShadowAccountAddress(
      identity.commitment,
      shadowClassHash,
      identity.anonymizer,
    );
  };
  const nonce =
    request.nonce !== undefined
      ? request.nonce
      : await probeUnusedShadowNonce(provider, addressFor);
  const plan = planShadowSpend({
    viewingKey,
    user: BigInt(config.accountAddress),
    nonce,
    token: config.settlementToken,
    amount: request.amount,
    recipient,
    shadowClassHash,
    anonymizer: anonymizerHex,
  });

  const transfers = createPrivateTransfers({
    account,
    viewingKeyProvider: { getViewingKey: async () => viewingKey },
    provingProvider: {
      url: config.provingUrl,
      chainId: constants.StarknetChainId.SN_SEPOLIA,
      nodeUrl: config.rpcUrl,
    },
    discoveryProvider: new IndexerDiscoveryProvider(
      config.indexerUrl,
      config.poolAddress,
    ),
    poolContractAddress: config.poolAddress,
    shadowAccountAnonymizerAddress: anonymizerHex,
  });

  const head = await provider.getBlockNumber();
  const { callAndProof, warnings } = await transfers
    .build({
      autoSetup: true,
      autoDiscover: { notes: "refresh", channels: "refresh" },
      autoSelectNotes: "all",
      provingBlockId: Math.max(0, head - 10),
    })
    .with(config.settlementToken, (token) =>
      token
        .withdraw({ recipient: plan.fundingAddress, amount: plan.funded })
        .surplusTo(config.accountAddress, false)
        .transfer({ recipient: config.accountAddress, amount: Open }),
    )
    .shadowAccounts(CARD_SHADOW_DAPP_NAME)
    .invoke(nonce, {
      calls: [plan.spendCall],
      collectPolicy: plan.collectPolicy,
    })
    .execute();

  const proofDetails = callAndProof.proof.proofFacts.length
    ? {
        proofFacts: callAndProof.proof.proofFacts,
        proof: callAndProof.proof.data,
      }
    : {};
  const submitted = await account.execute(callAndProof.call, {
    tip: 0n,
    ...proofDetails,
  });
  const receipt = await waitForTerminalReceipt(
    provider,
    submitted.transaction_hash,
  );
  if (!receipt.isSuccess()) {
    throw new Error(`Shadow spend failed: ${submitted.transaction_hash}`);
  }

  return {
    transactionHash: submitted.transaction_hash,
    finalityStatus: String(receipt.finality_status),
    executionStatus: String(receipt.execution_status),
    blockNumber:
      "block_number" in receipt ? Number(receipt.block_number) : undefined,
    shadowAddress: plan.fundingAddress,
    shadowNonce: nonce.toString(),
    commitment: `0x${plan.identity.commitment.toString(16)}`,
    anonymizer: anonymizerHex,
    dappName: CARD_SHADOW_DAPP_NAME,
    amount: plan.amount.toString(),
    funded: plan.funded.toString(),
    recipient,
    token: config.settlementToken,
    warnings: warnings.map((warning) => String(warning.code)),
  };
}
