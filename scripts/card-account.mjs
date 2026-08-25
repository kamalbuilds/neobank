import {
  Account,
  RpcProvider,
  constants,
  ec,
  hash,
} from "starknet";
import {
  IndexerDiscoveryProvider,
  createPrivateTransfers,
} from "@starkware-libs/starknet-privacy-sdk";

const command = process.argv[2] || "status";
const accountAddress = required("CARD_RUNTIME_ACCOUNT_ADDRESS");
const privateKey = required("CARD_RUNTIME_PRIVATE_KEY");
const poolAddress =
  process.env.CARD_RUNTIME_POOL_ADDRESS ||
  "0x0254a6b2997ef52e9f830ce1f543f6b29768295e8d17e2267d672c552cfe0d91";
const token = required("CARD_SETTLEMENT_TOKEN");
const rpcUrl =
  process.env.CARD_RUNTIME_RPC_URL ||
  process.env.TESTNET_RPC ||
  "https://starknet-sepolia-rpc.publicnode.com";
const provingUrl =
  process.env.CARD_RUNTIME_PROVING_URL ||
  "https://transaction-prover.alpha-sepolia.sw-dev.io";
const indexerUrl =
  process.env.CARD_RUNTIME_INDEXER_URL ||
  "https://discovery-service.alpha-sepolia.sw-dev.io";
const strkToken =
  "0x04718f5a0fc34cc1af16a1cdee98ffb20c31f5cd61d6ab07201858f4287c938d";

const provider = new RpcProvider({ nodeUrl: rpcUrl });
const account = new Account({
  provider,
  address: accountAddress,
  signer: privateKey,
  cairoVersion: "1",
});
const viewingKey = deriveViewingKey(
  privateKey,
  constants.StarknetChainId.SN_SEPOLIA,
  poolAddress,
);
const transfers = createPrivateTransfers({
  account,
  viewingKeyProvider: { getViewingKey: async () => viewingKey },
  provingProvider: {
    url: provingUrl,
    chainId: constants.StarknetChainId.SN_SEPOLIA,
    nodeUrl: rpcUrl,
  },
  discoveryProvider: new IndexerDiscoveryProvider(indexerUrl, poolAddress),
  poolContractAddress: poolAddress,
});

if (command === "status") await status();
else if (command === "register") await register();
else if (command === "deposit") await deposit();
else if (command === "balance") await balance();
else throw new Error(`Unknown command: ${command}`);

function required(name) {
  const value = process.env[name];
  if (!value) throw new Error(`Missing ${name}`);
  return value;
}

function deriveViewingKey(signingKey, chainId, pool) {
  const messageHash = hash.starknetKeccak(`${chainId}:${pool}`);
  const signature = ec.starkCurve.sign(`0x${messageHash.toString(16)}`, signingKey);
  const folded = BigInt(hash.computePoseidonHashOnElements([signature.r, signature.s]));
  const order = ec.starkCurve.CURVE.n;
  const maxViewingKey = order >> 1n;
  const reduced = folded % order;
  const canonical = reduced < maxViewingKey ? reduced : order - reduced;
  return canonical === 0n ? 1n : canonical;
}

async function registeredKey() {
  const [key] = await provider.callContract({
    contractAddress: poolAddress,
    entrypoint: "get_public_key",
    calldata: [accountAddress],
  });
  return BigInt(key);
}

async function poolFeeAllowance() {
  const [low, high = "0x0"] = await provider.callContract({
    contractAddress: strkToken,
    entrypoint: "allowance",
    calldata: [accountAddress, poolAddress],
  });
  return BigInt(low) + (BigInt(high) << 128n);
}

async function ensurePoolFeeAllowance() {
  const desired = 20n * 10n ** 18n;
  if ((await poolFeeAllowance()) >= desired) return;

  const low = desired & ((1n << 128n) - 1n);
  const high = desired >> 128n;
  const submitted = await account.execute(
    [
      {
        contractAddress: strkToken,
        entrypoint: "approve",
        calldata: [poolAddress, low, high],
      },
    ],
    { tip: 0n },
  );
  const receipt = await provider.waitForTransaction(submitted.transaction_hash, {
    retryInterval: 2_000,
  });
  if (!receipt.isSuccess() || !("block_number" in receipt)) {
    throw new Error("Pool fee approval failed.");
  }
  console.log(`APPROVAL_TX=${submitted.transaction_hash}`);

  const approvalBlock = Number(receipt.block_number);
  const deadline = Date.now() + 180_000;
  while ((await provider.getBlockNumber()) - 10 <= approvalBlock) {
    if (Date.now() >= deadline) {
      throw new Error("Timed out waiting for the pool fee approval to enter the proving base.");
    }
    await new Promise((resolve) => setTimeout(resolve, 2_000));
  }
}

function derivedPublicKey() {
  return BigInt(ec.starkCurve.getStarkKey(`0x${viewingKey.toString(16)}`));
}

async function status() {
  const [head, registered] = await Promise.all([provider.getBlockNumber(), registeredKey()]);
  console.log(
    JSON.stringify({
      network: "sepolia",
      accountAddress,
      head,
      registered: registered !== 0n,
      viewingKeyMatches: registered !== 0n && registered === derivedPublicKey(),
      prover: provingUrl,
      indexer: indexerUrl,
    }),
  );
}

async function submit(callAndProof) {
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
  console.log(`TX=${submitted.transaction_hash}`);
  const receipt = await provider.waitForTransaction(submitted.transaction_hash, {
    retryInterval: 2_000,
  });
  if (!receipt.isSuccess()) throw new Error(`Transaction failed: ${submitted.transaction_hash}`);
  console.log(
    JSON.stringify({
      transactionHash: submitted.transaction_hash,
      finalityStatus: receipt.finality_status,
      executionStatus: receipt.execution_status,
      blockNumber: "block_number" in receipt ? receipt.block_number : undefined,
    }),
  );
}

async function register() {
  const registered = await registeredKey();
  if (registered !== 0n) {
    if (registered !== derivedPublicKey()) {
      throw new Error("Account is registered with a different viewing key.");
    }
    console.log("ALREADY_REGISTERED");
    return;
  }

  await ensurePoolFeeAllowance();
  const head = await provider.getBlockNumber();
  const { callAndProof } = await transfers
    .build({ provingBlockId: Math.max(0, head - 10) })
    .register()
    .execute();
  await submit(callAndProof);

  const onchain = await registeredKey();
  if (onchain !== derivedPublicKey()) {
    throw new Error("Registration completed but the onchain viewing key does not match.");
  }
  console.log("REGISTERED_AND_MATCHED");
}

async function balance() {
  const { timestamp, notes } = await transfers.discoverNotes({
    tokens: [BigInt(token)],
    blockIdentifier: "pre_confirmed",
  });
  const tokenNotes = notes.get(BigInt(token)) || [];
  const total = tokenNotes.reduce((sum, note) => sum + note.amount, 0n);
  const head = await provider.getBlockNumber();
  const mature = tokenNotes.filter(
    (note) => note.created === undefined || Number(note.created) + 10 <= head,
  );
  console.log(
    JSON.stringify({
      timestamp,
      token,
      notes: tokenNotes.length,
      matureNotes: mature.length,
      total: total.toString(),
    }),
  );
}

async function deposit() {
  const amount = BigInt(process.env.CARD_BOOTSTRAP_DEPOSIT_UNITS || 4n * 10n ** 18n);
  await ensurePoolFeeAllowance();
  const head = await provider.getBlockNumber();
  const { callAndProof } = await transfers
    .build({
      autoDiscover: { notes: "refresh", channels: "refresh" },
      autoSetup: true,
      provingBlockId: Math.max(0, head - 10),
    })
    .with(token, (ops) => ops.deposit({ amount }))
    .surplusTo(accountAddress, false)
    .execute();
  await submit(callAndProof);
  console.log(`DEPOSITED=${amount}`);
}
