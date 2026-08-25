import { Account, RpcProvider, cairo, constants, ec, hash } from "starknet";
import {
  IndexerDiscoveryProvider,
  createPrivateTransfers,
} from "@starkware-libs/starknet-privacy-sdk";
import { authorizationIdFelt, type CardAuthorization } from "./authorization.ts";

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
  });

  const head = await provider.getBlockNumber();
  const amount =
    (BigInt(authorization.amountMinor) * config.settlementUnitsPerUsd) / 100n;
  if (amount <= 0n) throw new Error("Authorization amount rounds to zero settlement units.");
  const amountU256 = cairo.uint256(amount);
  const authId = authorizationIdFelt(authorization.authorizationId);

  const { callAndProof, warnings } = await transfers
    .build({
      autoDiscover: { notes: "refresh", channels: "refresh" },
      autoSelectNotes: "all",
      provingBlockId: Math.max(0, head - 10),
    })
    .with(config.settlementToken, (token) =>
      token
        .withdraw({ recipient: config.settlementContract, amount })
        .surplusTo(config.accountAddress, false),
    )
    .invoke(() => ({
      contractAddress: config.settlementContract,
      entrypoint: "privacy_invoke",
      calldata: [authId, config.settlementToken, amountU256.low, amountU256.high],
    }))
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
    warnings: warnings.map((warning) => String(warning.code)),
  };
}
