import { Account, RpcProvider, constants } from "starknet";
import { Contract, JsonRpcProvider, Wallet, getAddress } from "ethers";
import {
  IndexerDiscoveryProvider,
  createPrivateTransfers,
} from "@starkware-libs/starknet-privacy-sdk";
import {
  deriveHostedViewingKey,
  ensurePoolFeeAllowance,
  isTerminalFinality,
} from "../card/runtime.ts";

// ─── Inbound CCTP V2: Base Sepolia burn -> Starknet Sepolia mint ─────────
//
// All addresses below are Circle's official CCTP V2 testnet deployments.
//
// Starknet Sepolia, from
// https://developers.circle.com/cctp/references/starknet-contracts
// ("Testnet (Sepolia)" table) and verified on chain: get_local_domain() on
// the MessageTransmitter returns 25, and all three contracts are
// code-verified on Voyager Sepolia (MessageTransmitterV2,
// TokenMessengerMinterV2, FiatToken).
//
// Base Sepolia, from https://developers.circle.com/cctp/evm-smart-contracts
// (testnet table) and
// https://developers.circle.com/stablecoins/usdc-contract-addresses.
export const INBOUND_CCTP = {
  baseSepolia: {
    domain: 6,
    tokenMessengerV2: "0x8FE6B999Dc680CcFDD5Bf7EB0974218be2542DAA",
    messageTransmitterV2: "0xE737e5cEBEEBa77EFE34D4aa090756590b1CE275",
    usdc: "0x036CbD53842c5426634e7929541eC2318f3dCF7e",
  },
  starknetSepolia: {
    domain: 25,
    messageTransmitter:
      "0x04db7926c64f1f32a840f3fa95cb551f3801a3600bae87af87807a54dce12fe8",
    tokenMessengerMinter:
      "0x04bdde1e09a4b09a2f95d893d94a967b7717eb85a3f6deca8c080ee01fbc3370",
    usdc: "0x0512feac6339ff7889822cb5aa2a86c848e9d392bb0e3e237c008674feed8343",
  },
  // Testnet attestations come from Circle's sandbox Iris, not the mainnet API.
  irisBaseUrl: "https://iris-api-sandbox.circle.com",
} as const;

const SEPOLIA_POOL =
  "0x0254a6b2997ef52e9f830ce1f543f6b29768295e8d17e2267d672c552cfe0d91";
const SEPOLIA_PROVER = "https://transaction-prover.alpha-sepolia.sw-dev.io";
const SEPOLIA_INDEXER = "https://discovery-service.alpha-sepolia.sw-dev.io";
const SEPOLIA_RPC = "https://starknet-sepolia-rpc.publicnode.com";
const BASE_SEPOLIA_RPC = "https://sepolia.base.org";

// Standard Transfer: finality threshold 2000 carries a zero Circle fee
// (matches the outbound lane in src/app/components/lib/cctp.ts).
const STANDARD_MIN_FINALITY_THRESHOLD = 2000;

const STARK_PRIME =
  0x800000000000011000000000000000000000000000000000000000000000001n;

type Environment = Readonly<Record<string, string | undefined>>;

// ─── Pure byte helpers ───────────────────────────────────────────────────

export function hexToBytes(hex: string): Uint8Array {
  const clean = hex.startsWith("0x") ? hex.slice(2) : hex;
  if (clean.length % 2 !== 0 || !/^[0-9a-fA-F]*$/.test(clean)) {
    throw new Error("Invalid hex payload.");
  }
  const out = new Uint8Array(clean.length / 2);
  for (let i = 0; i < out.length; i++) {
    out[i] = parseInt(clean.slice(i * 2, i * 2 + 2), 16);
  }
  return out;
}

function sliceBigInt(bytes: Uint8Array, start: number, length: number): bigint {
  let value = 0n;
  for (let i = start; i < start + length; i++) {
    value = (value << 8n) | BigInt(bytes[i]);
  }
  return value;
}

function sliceHex(bytes: Uint8Array, start: number, length: number): string {
  let out = "0x";
  for (let i = start; i < start + length; i++) {
    out += bytes[i].toString(16).padStart(2, "0");
  }
  return out;
}

// A Starknet address is a felt (< the Stark prime, so < 2^252): it always
// fits left-padded into the EVM bytes32 mint_recipient slot.
export function starknetAddressToBytes32(address: string): string {
  let felt: bigint;
  try {
    felt = BigInt(address);
  } catch {
    throw new Error("Invalid Starknet address.");
  }
  if (felt <= 0n || felt >= STARK_PRIME) {
    throw new Error("Starknet address out of felt range.");
  }
  return `0x${felt.toString(16).padStart(64, "0")}`;
}

/** Split a bytes32 (hex) into the u256 calldata halves Cairo expects. */
export function bytes32ToU256Parts(value: string): { low: bigint; high: bigint } {
  const bytes = hexToBytes(value);
  if (bytes.length !== 32) throw new Error("Expected 32 bytes.");
  return {
    high: sliceBigInt(bytes, 0, 16),
    low: sliceBigInt(bytes, 16, 16),
  };
}

// ─── Cairo ByteArray serialization ───────────────────────────────────────
// core::byte_array::ByteArray = { data: Array<bytes31>, pending_word: felt252,
// pending_word_len: u32 }. Calldata: [data.len, ...data, pending, pending_len].

export function serializeByteArray(hex: string): string[] {
  const bytes = hexToBytes(hex);
  const words: string[] = [];
  const fullWords = Math.floor(bytes.length / 31);
  for (let w = 0; w < fullWords; w++) {
    words.push(`0x${sliceBigInt(bytes, w * 31, 31).toString(16)}`);
  }
  const pendingLen = bytes.length - fullWords * 31;
  const pending =
    pendingLen > 0 ? sliceBigInt(bytes, fullWords * 31, pendingLen) : 0n;
  return [
    `0x${fullWords.toString(16)}`,
    ...words,
    `0x${pending.toString(16)}`,
    `0x${pendingLen.toString(16)}`,
  ];
}

/** receive_message(message: ByteArray, attestation: ByteArray) calldata. */
export function buildReceiveMessageCalldata(
  messageHex: string,
  attestationHex: string,
): string[] {
  return [...serializeByteArray(messageHex), ...serializeByteArray(attestationHex)];
}

// ─── CCTP V2 message decoding ────────────────────────────────────────────
// Header layout (148 bytes) from circlefin/starknet-cctp
// packages/interfaces/src/message_transmitter_v2.cairo; burn body layout
// (228 bytes + hookData) from packages/message/src/burn_message_v2.cairo.

export interface CctpV2Message {
  version: number;
  sourceDomain: number;
  destinationDomain: number;
  nonce: string;
  sender: string;
  recipient: string;
  destinationCaller: string;
  minFinalityThreshold: number;
  finalityThresholdExecuted: number;
  body: {
    version: number;
    burnToken: string;
    mintRecipient: string;
    amount: bigint;
    messageSender: string;
    maxFee: bigint;
    feeExecuted: bigint;
    expirationBlock: bigint;
  };
}

const HEADER_LENGTH = 148;
const BURN_BODY_LENGTH = 228;

export function decodeCctpV2BurnMessage(messageHex: string): CctpV2Message {
  const bytes = hexToBytes(messageHex);
  if (bytes.length < HEADER_LENGTH + BURN_BODY_LENGTH) {
    throw new Error(
      `CCTP message too short: ${bytes.length} bytes, need at least ${HEADER_LENGTH + BURN_BODY_LENGTH}.`,
    );
  }
  const body = HEADER_LENGTH;
  return {
    version: Number(sliceBigInt(bytes, 0, 4)),
    sourceDomain: Number(sliceBigInt(bytes, 4, 4)),
    destinationDomain: Number(sliceBigInt(bytes, 8, 4)),
    nonce: sliceHex(bytes, 12, 32),
    sender: sliceHex(bytes, 44, 32),
    recipient: sliceHex(bytes, 76, 32),
    destinationCaller: sliceHex(bytes, 108, 32),
    minFinalityThreshold: Number(sliceBigInt(bytes, 140, 4)),
    finalityThresholdExecuted: Number(sliceBigInt(bytes, 144, 4)),
    body: {
      version: Number(sliceBigInt(bytes, body + 0, 4)),
      burnToken: sliceHex(bytes, body + 4, 32),
      mintRecipient: sliceHex(bytes, body + 36, 32),
      amount: sliceBigInt(bytes, body + 68, 32),
      messageSender: sliceHex(bytes, body + 100, 32),
      maxFee: sliceBigInt(bytes, body + 132, 32),
      feeExecuted: sliceBigInt(bytes, body + 164, 32),
      expirationBlock: sliceBigInt(bytes, body + 196, 32),
    },
  };
}

/**
 * Asserts the decoded burn message is an inbound Base Sepolia -> Starknet
 * Sepolia USDC transfer whose mint recipient this app expects. Fail closed:
 * a message for another route or token never reaches receive_message.
 */
export function assertInboundBurnMessage(
  message: CctpV2Message,
  expectedMintRecipient?: string,
): void {
  if (message.sourceDomain !== INBOUND_CCTP.baseSepolia.domain) {
    throw new Error(`Source domain ${message.sourceDomain} is not Base Sepolia (6).`);
  }
  if (message.destinationDomain !== INBOUND_CCTP.starknetSepolia.domain) {
    throw new Error(
      `Destination domain ${message.destinationDomain} is not Starknet (25).`,
    );
  }
  if (BigInt(message.body.burnToken) !== BigInt(INBOUND_CCTP.baseSepolia.usdc)) {
    throw new Error("Burn token is not Base Sepolia USDC.");
  }
  if (
    expectedMintRecipient &&
    BigInt(message.body.mintRecipient) !== BigInt(expectedMintRecipient)
  ) {
    throw new Error("Mint recipient is not the hosted account.");
  }
}

// ─── Circle Iris (sandbox) attestation ───────────────────────────────────

export function irisMessagesUrl(burnTxHash: string): string {
  return `${INBOUND_CCTP.irisBaseUrl}/v2/messages/${INBOUND_CCTP.baseSepolia.domain}?transactionHash=${burnTxHash}`;
}

export interface IrisMessage {
  status: string;
  message?: string;
  attestation?: string;
}

export function parseIrisResponse(body: unknown): IrisMessage | undefined {
  if (typeof body !== "object" || body === null) return undefined;
  const messages = (body as { messages?: unknown }).messages;
  if (!Array.isArray(messages) || messages.length === 0) return undefined;
  const msg = messages[0] as Record<string, unknown>;
  const attestation =
    typeof msg.attestation === "string" && msg.attestation.startsWith("0x")
      ? msg.attestation
      : undefined;
  return {
    status: String(msg.status ?? ""),
    message: typeof msg.message === "string" ? msg.message : undefined,
    attestation,
  };
}

async function fetchIrisMessage(burnTxHash: string): Promise<IrisMessage | undefined> {
  const res = await fetch(irisMessagesUrl(burnTxHash));
  if (!res.ok) return undefined;
  const body = await res.json().catch(() => undefined);
  return parseIrisResponse(body);
}

// ─── Runtime configuration (fail closed) ─────────────────────────────────

const CLAIM_REQUIRED_ENV = [
  "CARD_RUNTIME_ACCOUNT_ADDRESS",
  "CARD_RUNTIME_PRIVATE_KEY",
] as const;

export interface InboundRuntimeStatus {
  ready: boolean;
  missing: string[];
  network: "sepolia";
  /** The Starknet hosted account that inbound USDC should be minted to. */
  hostedAccount?: string;
  evmSignerConfigured: boolean;
  contracts: typeof INBOUND_CCTP;
}

export function inboundRuntimeStatus(env: Environment = process.env): InboundRuntimeStatus {
  const missing = CLAIM_REQUIRED_ENV.filter((name) => !env[name]);
  return {
    ready: missing.length === 0,
    missing: [...missing],
    network: "sepolia",
    hostedAccount: env.CARD_RUNTIME_ACCOUNT_ADDRESS,
    evmSignerConfigured: Boolean(env.INBOUND_EVM_PRIVATE_KEY),
    contracts: INBOUND_CCTP,
  };
}

function starknetProvider(env: Environment): RpcProvider {
  return new RpcProvider({
    nodeUrl: env.CARD_RUNTIME_RPC_URL || env.TESTNET_RPC || SEPOLIA_RPC,
  });
}

function hostedAccount(env: Environment, provider: RpcProvider): Account {
  return new Account({
    provider,
    address: env.CARD_RUNTIME_ACCOUNT_ADDRESS!,
    signer: env.CARD_RUNTIME_PRIVATE_KEY!,
    cairoVersion: "1",
  });
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
      // Not yet visible at this RPC.
    }
    await new Promise((resolve) => setTimeout(resolve, 2_000));
  }
  throw new Error(`Timed out waiting for ${transactionHash}`);
}

async function readU256(
  provider: RpcProvider,
  contractAddress: string,
  entrypoint: string,
  calldata: string[],
): Promise<bigint> {
  const result = await provider.callContract({ contractAddress, entrypoint, calldata });
  return BigInt(result[0] || "0") + (BigInt(result[1] || "0") << 128n);
}

async function isNonceUsed(provider: RpcProvider, nonce: string): Promise<boolean> {
  const parts = bytes32ToU256Parts(nonce);
  const result = await provider.callContract({
    contractAddress: INBOUND_CCTP.starknetSepolia.messageTransmitter,
    entrypoint: "is_nonce_used",
    calldata: [`0x${parts.low.toString(16)}`, `0x${parts.high.toString(16)}`],
  });
  return BigInt(result[0]) === 1n;
}

// ─── Status ──────────────────────────────────────────────────────────────

export type InboundPhase =
  | "not_found"
  | "attesting"
  | "ready_to_claim"
  | "claimed";

export interface InboundStatusResult {
  burnTxHash: string;
  phase: InboundPhase;
  irisStatus?: string;
  amount?: string;
  feeExecuted?: string;
  mintRecipient?: string;
  nonce?: string;
}

export async function inboundStatus(
  burnTxHash: string,
  env: Environment = process.env,
): Promise<InboundStatusResult> {
  const iris = await fetchIrisMessage(burnTxHash);
  if (!iris) return { burnTxHash, phase: "not_found" };
  if (iris.status !== "complete" || !iris.message || !iris.attestation) {
    return { burnTxHash, phase: "attesting", irisStatus: iris.status };
  }
  const message = decodeCctpV2BurnMessage(iris.message);
  assertInboundBurnMessage(message);
  const provider = starknetProvider(env);
  const claimed = await isNonceUsed(provider, message.nonce);
  return {
    burnTxHash,
    phase: claimed ? "claimed" : "ready_to_claim",
    irisStatus: iris.status,
    amount: message.body.amount.toString(),
    feeExecuted: message.body.feeExecuted.toString(),
    mintRecipient: message.body.mintRecipient,
    nonce: message.nonce,
  };
}

// ─── Claim: receive_message on Starknet Sepolia ──────────────────────────

export interface InboundClaimResult {
  burnTxHash: string;
  phase: "claimed" | "already_claimed";
  amount: string;
  feeExecuted: string;
  mintRecipient: string;
  starknetTxHash?: string;
  blockNumber?: number;
  mintedDelta?: string;
}

export async function claimInboundTransfer(
  burnTxHash: string,
  env: Environment = process.env,
): Promise<InboundClaimResult> {
  const status = inboundRuntimeStatus(env);
  if (!status.ready) {
    throw new Error(`Inbound runtime missing: ${status.missing.join(", ")}`);
  }
  const iris = await fetchIrisMessage(burnTxHash);
  if (!iris) {
    throw new Error("Circle Iris has no message for this transaction yet.");
  }
  if (iris.status !== "complete" || !iris.message || !iris.attestation) {
    throw new Error(
      `Attestation not ready (status: ${iris.status || "unknown"}). Standard Transfer needs Base finality first.`,
    );
  }
  const message = decodeCctpV2BurnMessage(iris.message);
  assertInboundBurnMessage(message);
  const mintRecipient = `0x${BigInt(message.body.mintRecipient).toString(16)}`;
  const expectedMint = message.body.amount - message.body.feeExecuted;

  const provider = starknetProvider(env);
  if (await isNonceUsed(provider, message.nonce)) {
    return {
      burnTxHash,
      phase: "already_claimed",
      amount: message.body.amount.toString(),
      feeExecuted: message.body.feeExecuted.toString(),
      mintRecipient,
    };
  }

  const balanceBefore = await readU256(
    provider,
    INBOUND_CCTP.starknetSepolia.usdc,
    "balanceOf",
    [mintRecipient],
  );

  const account = hostedAccount(env, provider);
  const submitted = await account.execute(
    [
      {
        contractAddress: INBOUND_CCTP.starknetSepolia.messageTransmitter,
        entrypoint: "receive_message",
        calldata: buildReceiveMessageCalldata(iris.message, iris.attestation),
      },
    ],
    { tip: 0n },
  );
  const receipt = await waitForTerminalReceipt(provider, submitted.transaction_hash);
  if (!receipt.isSuccess()) {
    throw new Error(`receive_message reverted: ${submitted.transaction_hash}`);
  }

  // Post-conditions only a completed mint can produce: the nonce is consumed
  // and the recipient's USDC balance grew by exactly amount - feeExecuted.
  if (!(await isNonceUsed(provider, message.nonce))) {
    throw new Error(
      `receive_message landed but the nonce is still unused: ${submitted.transaction_hash}`,
    );
  }
  const balanceAfter = await readU256(
    provider,
    INBOUND_CCTP.starknetSepolia.usdc,
    "balanceOf",
    [mintRecipient],
  );
  const delta = balanceAfter - balanceBefore;
  if (delta !== expectedMint) {
    throw new Error(
      `Mint delta ${delta.toString()} does not match expected ${expectedMint.toString()}.`,
    );
  }

  return {
    burnTxHash,
    phase: "claimed",
    amount: message.body.amount.toString(),
    feeExecuted: message.body.feeExecuted.toString(),
    mintRecipient,
    starknetTxHash: submitted.transaction_hash,
    blockNumber: "block_number" in receipt ? Number(receipt.block_number) : undefined,
    mintedDelta: delta.toString(),
  };
}

// ─── Shield: deposit the minted USDC into the STRK20 pool ────────────────

export interface InboundShieldResult {
  amount: string;
  starknetTxHash: string;
  blockNumber?: number;
  privateBefore: string;
  privateAfter: string;
}

async function readPrivateUsdcTotal(
  transfers: ReturnType<typeof createPrivateTransfers>,
): Promise<bigint> {
  const token = BigInt(INBOUND_CCTP.starknetSepolia.usdc);
  const discovered = await transfers.discoverNotes({
    tokens: [token],
    blockIdentifier: "pre_confirmed",
  });
  const notes = discovered.notes.get(token) || [];
  return notes.reduce((total, note) => total + note.amount, 0n);
}

async function ensurePoolTokenAllowance(args: {
  provider: RpcProvider;
  account: Account;
  accountAddress: string;
  token: string;
  amount: bigint;
}): Promise<void> {
  const allowance = await readU256(args.provider, args.token, "allowance", [
    args.accountAddress,
    SEPOLIA_POOL,
  ]);
  if (allowance >= args.amount) return;
  const low = args.amount & ((1n << 128n) - 1n);
  const high = args.amount >> 128n;
  const submitted = await args.account.execute(
    [
      {
        contractAddress: args.token,
        entrypoint: "approve",
        calldata: [SEPOLIA_POOL, `0x${low.toString(16)}`, `0x${high.toString(16)}`],
      },
    ],
    { tip: 0n },
  );
  const receipt = await waitForTerminalReceipt(args.provider, submitted.transaction_hash);
  if (!receipt.isSuccess()) {
    throw new Error(`USDC pool approval failed: ${submitted.transaction_hash}`);
  }
}

export async function shieldInboundUsdc(
  amount: bigint,
  env: Environment = process.env,
): Promise<InboundShieldResult> {
  const status = inboundRuntimeStatus(env);
  if (!status.ready) {
    throw new Error(`Inbound runtime missing: ${status.missing.join(", ")}`);
  }
  if (amount <= 0n) throw new Error("Shield amount must be positive.");

  const provider = starknetProvider(env);
  const account = hostedAccount(env, provider);
  const accountAddress = env.CARD_RUNTIME_ACCOUNT_ADDRESS!;
  const usdc = INBOUND_CCTP.starknetSepolia.usdc;

  const publicUsdc = await readU256(provider, usdc, "balanceOf", [accountAddress]);
  if (publicUsdc < amount) {
    throw new Error(
      `Hosted account holds ${publicUsdc.toString()} public USDC units, cannot shield ${amount.toString()}.`,
    );
  }

  // The pool pulls the deposit and its STRK fee with transfer_from.
  await ensurePoolFeeAllowance({
    provider,
    account,
    accountAddress,
    poolAddress: env.CARD_RUNTIME_POOL_ADDRESS || SEPOLIA_POOL,
  });
  await ensurePoolTokenAllowance({ provider, account, accountAddress, token: usdc, amount });

  const viewingKey = deriveHostedViewingKey(
    env.CARD_RUNTIME_PRIVATE_KEY!,
    constants.StarknetChainId.SN_SEPOLIA,
    env.CARD_RUNTIME_POOL_ADDRESS || SEPOLIA_POOL,
  );
  const transfers = createPrivateTransfers({
    account,
    viewingKeyProvider: { getViewingKey: async () => viewingKey },
    provingProvider: {
      url: env.CARD_RUNTIME_PROVING_URL || SEPOLIA_PROVER,
      chainId: constants.StarknetChainId.SN_SEPOLIA,
      nodeUrl: env.CARD_RUNTIME_RPC_URL || env.TESTNET_RPC || SEPOLIA_RPC,
    },
    discoveryProvider: new IndexerDiscoveryProvider(
      env.CARD_RUNTIME_INDEXER_URL || SEPOLIA_INDEXER,
      env.CARD_RUNTIME_POOL_ADDRESS || SEPOLIA_POOL,
    ),
    poolContractAddress: env.CARD_RUNTIME_POOL_ADDRESS || SEPOLIA_POOL,
  });

  const privateBefore = await readPrivateUsdcTotal(transfers);

  const head = await provider.getBlockNumber();
  const { callAndProof } = await transfers
    .build({
      autoDiscover: { notes: "refresh", channels: "refresh" },
      autoSetup: true,
      provingBlockId: Math.max(0, head - 10),
    })
    .with(usdc, (ops) => ops.deposit({ amount }))
    .surplusTo(accountAddress, false)
    .execute();

  const proofDetails = callAndProof.proof.proofFacts.length
    ? { proofFacts: callAndProof.proof.proofFacts, proof: callAndProof.proof.data }
    : {};
  const submitted = await account.execute(callAndProof.call, {
    tip: 0n,
    ...proofDetails,
  });
  const receipt = await waitForTerminalReceipt(provider, submitted.transaction_hash);
  if (!receipt.isSuccess()) {
    throw new Error(`Shield deposit reverted: ${submitted.transaction_hash}`);
  }

  // Post-condition: the shielded USDC note total grew by the deposit.
  const privateAfter = await readPrivateUsdcTotal(transfers);
  if (privateAfter - privateBefore !== amount) {
    throw new Error(
      `Shield landed but private USDC moved ${(privateAfter - privateBefore).toString()}, expected ${amount.toString()}.`,
    );
  }

  return {
    amount: amount.toString(),
    starknetTxHash: submitted.transaction_hash,
    blockNumber: "block_number" in receipt ? Number(receipt.block_number) : undefined,
    privateBefore: privateBefore.toString(),
    privateAfter: privateAfter.toString(),
  };
}

// ─── Optional: server-side burn on Base Sepolia ──────────────────────────
// Only used when the user has placed INBOUND_EVM_PRIVATE_KEY in .env. The
// UI's primary path is the user burning from their own Base wallet.

const ERC20_ABI = [
  "function balanceOf(address) view returns (uint256)",
  "function allowance(address, address) view returns (uint256)",
  "function approve(address, uint256) returns (bool)",
];

const TOKEN_MESSENGER_V2_ABI = [
  "function depositForBurn(uint256 amount, uint32 destinationDomain, bytes32 mintRecipient, address burnToken, bytes32 destinationCaller, uint256 maxFee, uint32 minFinalityThreshold)",
];

export interface InboundBurnResult {
  burnTxHash: string;
  blockNumber: number;
  amount: string;
  from: string;
  mintRecipient: string;
}

export async function executeInboundBaseBurn(
  amount: bigint,
  env: Environment = process.env,
): Promise<InboundBurnResult> {
  const status = inboundRuntimeStatus(env);
  if (!status.ready) {
    throw new Error(`Inbound runtime missing: ${status.missing.join(", ")}`);
  }
  if (!env.INBOUND_EVM_PRIVATE_KEY) {
    throw new Error("Inbound runtime missing: INBOUND_EVM_PRIVATE_KEY");
  }
  if (amount <= 0n) throw new Error("Burn amount must be positive.");

  const provider = new JsonRpcProvider(env.BASE_SEPOLIA_RPC_URL || BASE_SEPOLIA_RPC);
  const wallet = new Wallet(env.INBOUND_EVM_PRIVATE_KEY, provider);
  const usdc = new Contract(INBOUND_CCTP.baseSepolia.usdc, ERC20_ABI, wallet);
  const messenger = new Contract(
    INBOUND_CCTP.baseSepolia.tokenMessengerV2,
    TOKEN_MESSENGER_V2_ABI,
    wallet,
  );
  const mintRecipient = starknetAddressToBytes32(env.CARD_RUNTIME_ACCOUNT_ADDRESS!);

  const balance: bigint = await usdc.balanceOf(wallet.address);
  if (balance < amount) {
    throw new Error(
      `Base Sepolia signer holds ${balance.toString()} USDC units, cannot burn ${amount.toString()}.`,
    );
  }
  const allowance: bigint = await usdc.allowance(
    wallet.address,
    INBOUND_CCTP.baseSepolia.tokenMessengerV2,
  );
  if (allowance < amount) {
    const approval = await usdc.approve(INBOUND_CCTP.baseSepolia.tokenMessengerV2, amount);
    const approvalReceipt = await approval.wait();
    if (!approvalReceipt || approvalReceipt.status !== 1) {
      throw new Error("USDC approval on Base Sepolia failed.");
    }
  }

  const burn = await messenger.depositForBurn(
    amount,
    INBOUND_CCTP.starknetSepolia.domain,
    mintRecipient,
    getAddress(INBOUND_CCTP.baseSepolia.usdc),
    `0x${"0".repeat(64)}`, // destination_caller = 0: any Starknet account may claim
    0n, // Standard Transfer carries no Circle fee
    STANDARD_MIN_FINALITY_THRESHOLD,
  );
  const receipt = await burn.wait();
  if (!receipt || receipt.status !== 1) {
    throw new Error(`depositForBurn reverted on Base Sepolia: ${burn.hash}`);
  }

  return {
    burnTxHash: burn.hash,
    blockNumber: receipt.blockNumber,
    amount: amount.toString(),
    from: wallet.address,
    mintRecipient,
  };
}
