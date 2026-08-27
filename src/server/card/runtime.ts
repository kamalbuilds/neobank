import { Account, RpcProvider, cairo, constants, ec, hash } from "starknet";
import {
  IndexerDiscoveryProvider,
  Open,
  createPrivateTransfers,
  type Note,
} from "@starkware-libs/starknet-privacy-sdk";
import {
  authorizationIdFelt,
  lendAmountFor,
  type CardAuthorization,
} from "./authorization.ts";

const SEPOLIA_POOL =
  "0x0254a6b2997ef52e9f830ce1f543f6b29768295e8d17e2267d672c552cfe0d91";
const SEPOLIA_PROVER = "https://transaction-prover.alpha-sepolia.sw-dev.io";
const SEPOLIA_INDEXER = "https://discovery-service.alpha-sepolia.sw-dev.io";
const SEPOLIA_RPC = "https://starknet-sepolia-rpc.publicnode.com";

const REQUIRED_ENV = [
  "CARD_RUNTIME_ACCOUNT_ADDRESS",
  "CARD_RUNTIME_PRIVATE_KEY",
  "CARD_SETTLEMENT_CONTRACT",
  "CARD_SETTLEMENT_TOKEN",
  "CARD_SETTLEMENT_UNITS_PER_USD",
  "CARD_WEBHOOK_SECRET",
] as const;

export type CardRuntimeConfig = {
  accountAddress: string;
  privateKey: string;
  settlementContract: string;
  programContract: string;
  programmableSpend?: string;
  settlementRecipient?: string;
  earnVault?: string;
  settlementToken: string;
  settlementUnitsPerUsd: bigint;
  webhookSecret: string;
  rpcUrl: string;
  provingUrl: string;
  indexerUrl: string;
  poolAddress: string;
};

type Environment = Readonly<Record<string, string | undefined>>;

export type CardRuntimeStatus = {
  ready: boolean;
  missing: string[];
  network: "sepolia";
  accountAddress?: string;
  poolAddress: string;
};

export type CardSettlementResult = {
  authorizationId: string;
  transactionHash: string;
  finalityStatus: string;
  executionStatus: string;
  blockNumber?: number;
  settleAmount: string;
  lendAmount: string;
  /** Vault shares redeemed when spending from the earn position. */
  programAmount?: string;
  merchantName: string;
  merchantCategory: string;
  warnings: string[];
};

export function cardRuntimeStatus(env: Environment = process.env): CardRuntimeStatus {
  const missing = REQUIRED_ENV.filter((name) => !env[name]);
  return {
    ready: missing.length === 0,
    missing: [...missing],
    network: "sepolia",
    accountAddress: env.CARD_RUNTIME_ACCOUNT_ADDRESS,
    poolAddress: env.CARD_RUNTIME_POOL_ADDRESS || SEPOLIA_POOL,
  };
}

export function parseCardRuntimeConfig(
  env: Environment = process.env,
): CardRuntimeConfig {
  const status = cardRuntimeStatus(env);
  if (!status.ready) {
    throw new Error(`Card runtime missing: ${status.missing.join(", ")}`);
  }
  return {
    accountAddress: env.CARD_RUNTIME_ACCOUNT_ADDRESS!,
    privateKey: env.CARD_RUNTIME_PRIVATE_KEY!,
    settlementContract: env.CARD_SETTLEMENT_CONTRACT!,
    programContract: env.CARD_PROGRAM_CONTRACT || env.CARD_SETTLEMENT_CONTRACT!,
    programmableSpend: env.CARD_PROGRAMMABLE_SPEND,
    settlementRecipient: env.CARD_SETTLEMENT_RECIPIENT,
    earnVault: env.CARD_EARN_VAULT,
    settlementToken: env.CARD_SETTLEMENT_TOKEN!,
    settlementUnitsPerUsd: BigInt(env.CARD_SETTLEMENT_UNITS_PER_USD!),
    webhookSecret: env.CARD_WEBHOOK_SECRET!,
    rpcUrl: env.CARD_RUNTIME_RPC_URL || env.TESTNET_RPC || SEPOLIA_RPC,
    provingUrl: env.CARD_RUNTIME_PROVING_URL || SEPOLIA_PROVER,
    indexerUrl: env.CARD_RUNTIME_INDEXER_URL || SEPOLIA_INDEXER,
    poolAddress: env.CARD_RUNTIME_POOL_ADDRESS || SEPOLIA_POOL,
  };
}

export function deriveHostedViewingKey(
  privateKey: string,
  chainId: string,
  poolAddress: string,
): bigint {
  const messageHash = hash.starknetKeccak(`${chainId}:${poolAddress}`);
  const signature = ec.starkCurve.sign(`0x${messageHash.toString(16)}`, privateKey);
  const folded = BigInt(hash.computePoseidonHashOnElements([signature.r, signature.s]));
  const order = ec.starkCurve.CURVE.n;
  const maxViewingKey = order >> 1n;
  const reduced = folded % order;
  const canonical = reduced < maxViewingKey ? reduced : order - reduced;
  return canonical === 0n ? 1n : canonical;
}

export function isTerminalFinality(finality: string): boolean {
  return (
    finality === "ACCEPTED_ON_L2" ||
    finality === "ACCEPTED_ON_L1" ||
    finality === "REJECTED"
  );
}

/** Pay dinner by redeeming vault shares when CARD_SPEND_FROM_VAULT=1. */
export function usesVaultSpend(
  _authorization: CardAuthorization,
  env: Environment,
): boolean {
  return env.CARD_SPEND_FROM_VAULT === "1";
}

/**
 * Shares to redeem for a vault spend. Prefer CARD_LEND_UNITS (the prior open
 * note size); otherwise redeem exactly settle. Must cover settle for Cairo.
 */
export function vaultRedeemSharesFor(
  settleAmount: bigint,
  env: Environment,
): bigint {
  const raw = env.CARD_LEND_UNITS || "0";
  if (!/^\d+$/.test(raw)) {
    throw new Error("Invalid CARD_LEND_UNITS.");
  }
  const configured = BigInt(raw);
  const shares = configured > 0n ? configured : settleAmount;
  if (shares < settleAmount) {
    throw new Error("Vault redeem shares must cover the settle amount.");
  }
  return shares;
}

/**
 * Pick notes that cover `amount`. Open notes (vault share receipts) are
 * preferred: autoSelectNotes skips them and the builder then tries a public
 * transferFrom, which reverts Insufficient ERC20 allowance.
 */
export function selectSpendableNotes(
  notes: readonly Note[],
  amount: bigint,
  head: number,
): Note[] {
  const mature = notes.filter(
    (note) => note.created === undefined || Number(note.created) + 10 <= head,
  );
  const ordered = [
    ...mature.filter((note) => note.open),
    ...mature.filter((note) => !note.open),
  ];
  const picked: Note[] = [];
  let total = 0n;
  for (const note of ordered) {
    picked.push(note);
    total += note.amount;
    if (total >= amount) return picked;
  }
  throw new Error(
    `Not enough mature notes to cover ${amount.toString()} (found ${total.toString()} across ${notes.length} notes, ${mature.length} mature).`,
  );
}

const STRK_FEE_TOKEN =
  "0x04718f5a0fc34cc1af16a1cdee98ffb20c31f5cd61d6ab07201858f4287c938d";

function u256(value: bigint) {
  return cairo.uint256(value);
}

async function readU256(
  provider: RpcProvider,
  contractAddress: string,
  entrypoint: string,
  calldata: string[],
): Promise<bigint> {
  const result = await provider.callContract({
    contractAddress,
    entrypoint,
    calldata,
  });
  return BigInt(result[0] || "0") + (BigInt(result[1] || "0") << 128n);
}

export async function ensurePoolFeeAllowance(args: {
  provider: RpcProvider;
  account: Account;
  accountAddress: string;
  poolAddress: string;
}): Promise<{ approved: boolean; fee: bigint; allowance: bigint }> {
  const fee = await readU256(
    args.provider,
    args.poolAddress,
    "get_fee_amount",
    [],
  );
  const allowance = await readU256(
    args.provider,
    STRK_FEE_TOKEN,
    "allowance",
    [args.accountAddress, args.poolAddress],
  );
  const desired = fee * 10n;
  if (allowance >= fee) {
    return { approved: false, fee, allowance };
  }
  const submitted = await args.account.execute(
    [
      {
        contractAddress: STRK_FEE_TOKEN,
        entrypoint: "approve",
        calldata: [args.poolAddress, u256(desired).low, u256(desired).high],
      },
    ],
    { tip: 0n },
  );
  const receipt = await waitForTerminalReceipt(
    args.provider,
    submitted.transaction_hash,
  );
  if (!receipt.isSuccess()) {
    throw new Error(`Pool fee approval failed: ${submitted.transaction_hash}`);
  }
  const approvalBlock =
    "block_number" in receipt ? Number(receipt.block_number) : 0;
  const deadline = Date.now() + 180_000;
  while ((await args.provider.getBlockNumber()) - 10 <= approvalBlock) {
    if (Date.now() >= deadline) {
      throw new Error("Timed out waiting for pool fee approval to mature.");
    }
    await new Promise((resolve) => setTimeout(resolve, 2_000));
  }
  return { approved: true, fee, allowance: desired };
}

async function waitForTerminalReceipt(
  provider: RpcProvider,
  transactionHash: string,
  timeoutMs = 180_000,
) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      const receipt = await provider.getTransactionReceipt(transactionHash);
      const finality =
        "finality_status" in receipt ? String(receipt.finality_status) : "";
      if (isTerminalFinality(finality)) return receipt;
    } catch {
      // Paymaster/direct submissions can take time to surface at the selected RPC.
    }
    await new Promise((resolve) => setTimeout(resolve, 2_000));
  }
  throw new Error(`Timed out waiting for ${transactionHash}`);
}

export async function executeHostedCardSettlement(
  authorization: CardAuthorization,
  env: Environment = process.env,
): Promise<CardSettlementResult> {
  const config = parseCardRuntimeConfig(env);
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
    shadowAccountAnonymizerAddress:
      env.CARD_SHADOW_ANONYMIZER ||
      "0x010a2285310c107c731d997afc147afb7495daff6397c2d242133d9fe8d9b147",
  });

  const head = await provider.getBlockNumber();
  const settleAmount =
    (BigInt(authorization.amountMinor) * config.settlementUnitsPerUsd) / 100n;
  if (settleAmount <= 0n) {
    throw new Error("Authorization amount rounds to zero settlement units.");
  }
  const spendFromVault = usesVaultSpend(authorization, env);
  if (
    spendFromVault &&
    !(env.CARD_PROGRAM_CONTRACT && config.earnVault)
  ) {
    throw new Error(
      "Vault spend requires CARD_PROGRAM_CONTRACT and CARD_EARN_VAULT.",
    );
  }
  const lendAmount = spendFromVault ? 0n : lendAmountFor(authorization, env);
  const usesCardProgram =
    !spendFromVault &&
    lendAmount > 0n &&
    Boolean(env.CARD_PROGRAM_CONTRACT && config.earnVault);
  const usesProgrammable =
    !spendFromVault &&
    lendAmount > 0n &&
    !usesCardProgram &&
    Boolean(config.programmableSpend && config.settlementRecipient);
  if (lendAmount > 0n && !usesCardProgram && !usesProgrammable) {
    throw new Error(
      "Restaurant lend requires CARD_PROGRAM_CONTRACT and CARD_EARN_VAULT.",
    );
  }
  const programAmount = spendFromVault
    ? vaultRedeemSharesFor(settleAmount, env)
    : lendAmount;
  const changeDust = usesProgrammable ? 1n : 0n;
  const funded = settleAmount + lendAmount + changeDust;
  const settleU256 = cairo.uint256(settleAmount);
  const lendU256 = cairo.uint256(lendAmount);
  const programU256 = cairo.uint256(programAmount);
  const fundedU256 = cairo.uint256(funded);
  const authId = authorizationIdFelt(authorization.authorizationId);
  const helper =
    usesCardProgram || spendFromVault
      ? config.programContract
      : usesProgrammable
        ? config.programmableSpend!
        : config.programContract;

  const buildOpts = {
    autoSetup: true,
    autoDiscover: { notes: "refresh" as const, channels: "refresh" as const },
    autoSelectNotes: "all" as const,
    provingBlockId: Math.max(0, head - 10),
  };

  let builder;
  if (spendFromVault && config.earnVault) {
    const discovered = await transfers.discoverNotes({
      tokens: [BigInt(config.earnVault)],
      blockIdentifier: "pre_confirmed",
    });
    const vaultNotes = discovered.notes.get(BigInt(config.earnVault)) || [];
    const inputs = selectSpendableNotes(vaultNotes, programAmount, head);
    // Redeem vault shares: spend the open vToken note into the helper, then
    // open a STRK leftover note for whatever redeem returns above settle.
    builder = transfers
      .build(buildOpts)
      .with(config.earnVault, (vault) =>
        vault
          .inputs(...inputs)
          .withdraw({ recipient: helper, amount: programAmount })
          .surplusTo(config.accountAddress, false),
      )
      .with(config.settlementToken, (token) =>
        token.transfer({ recipient: config.accountAddress, amount: Open }),
      );
  } else {
    builder = transfers.build(buildOpts).with(config.settlementToken, (token) => {
      const fundedToken = token
        .withdraw({ recipient: helper, amount: funded })
        .surplusTo(config.accountAddress, false);
      return usesProgrammable
        ? fundedToken.transfer({ recipient: config.accountAddress, amount: Open })
        : fundedToken;
    });

    if (usesCardProgram && config.earnVault) {
      builder = builder.with(config.earnVault, (vault) =>
        vault.transfer({ recipient: config.accountAddress, amount: Open }),
      );
    }
  }

  const { callAndProof, warnings } = await builder
    .invoke((args) => {
      if (spendFromVault && config.earnVault) {
        return {
          contractAddress: helper,
          entrypoint: "privacy_invoke",
          calldata: [
            authId,
            config.earnVault,
            settleU256.low,
            settleU256.high,
            programU256.low,
            programU256.high,
            args.openNotes[0].noteId,
          ],
        };
      }
      if (usesCardProgram) {
        return {
          contractAddress: helper,
          entrypoint: "privacy_invoke",
          calldata: [
            authId,
            config.settlementToken,
            settleU256.low,
            settleU256.high,
            lendU256.low,
            lendU256.high,
            args.openNotes[0].noteId,
          ],
        };
      }
      if (usesProgrammable) {
        return {
          contractAddress: helper,
          entrypoint: "privacy_invoke",
          calldata: [
            config.settlementToken,
            fundedU256.low,
            fundedU256.high,
            lendU256.low,
            lendU256.high,
            1n,
            config.settlementRecipient!,
            1n,
            settleU256.low,
            settleU256.high,
            args.openNotes[0].noteId,
          ],
        };
      }
      return {
        contractAddress: helper,
        entrypoint: "privacy_invoke",
        calldata: [authId, config.settlementToken, settleU256.low, settleU256.high],
      };
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
  const receipt = await waitForTerminalReceipt(provider, submitted.transaction_hash);
  if (!receipt.isSuccess()) {
    throw new Error(`Card settlement failed: ${submitted.transaction_hash}`);
  }

  return {
    authorizationId: authorization.authorizationId,
    transactionHash: submitted.transaction_hash,
    finalityStatus: String(receipt.finality_status),
    executionStatus: String(receipt.execution_status),
    blockNumber: "block_number" in receipt ? Number(receipt.block_number) : undefined,
    settleAmount: settleAmount.toString(),
    lendAmount: lendAmount.toString(),
    ...(spendFromVault
      ? { programAmount: programAmount.toString() }
      : {}),
    merchantName: authorization.merchantName,
    merchantCategory: authorization.merchantCategory,
    warnings: warnings.map((warning) => String(warning.code)),
  };
}
