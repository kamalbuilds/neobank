import { describe, expect, it } from "vitest";
import { hash, RpcProvider, shortString } from "starknet";
import {
  PRIMER_CLASS_HASH,
  shadowAccountAddress,
  shadowAccountCommitment,
  shadowAccountPartialCommitment,
} from "@starkware-libs/starknet-privacy-sdk";
import {
  ANONYMIZER_ADDRESSES,
  STRK20_POOL_ADDRESSES,
} from "@/utils/constants";
import {
  MissingShadowAnonymizerError,
  buildShadowSpendCalls,
  deriveSpendIdentity,
  nextUnusedNonce,
  resolveShadowAnonymizer,
  sepoliaShadowAnonymizer,
} from "@/server/card/shadow";

const SEPOLIA_RPC = "https://starknet-sepolia-rpc.publicnode.com";
const SEPOLIA_POOL = STRK20_POOL_ADDRESSES.sepolia;

/** Fixture inputs frozen once against SDK 0.14.3-rc.5 address derivation. */
const FIXTURE = {
  viewingKey: 0x1234567890abcdefn,
  user: 0xabc123n,
  dappName: "neobank-card",
  anonymizer: sepoliaShadowAnonymizer!,
  nonce0: 0n,
  nonce1: 1n,
  // Computed once from real SDK helpers; do not hand-edit.
  address0:
    "0x2d3ee6989e8d58c93aadb1a277b3c9015b1c65e7fc61e3934668a909587badb",
  commitment0:
    "0x4b680ae0ea1452f93a839f2de6c6d093d6c41c9f4aee243d1d824038b97f375",
  address1:
    "0x68d3757e5105e779cae3c618e07ff4a93b35d3e726f6b78f92ac2c9c80c97af",
  commitment1:
    "0x6f37ee98ab269a2549f5e8ac903849fa0f4a6ab322cec21d5958af72ebf0f79",
} as const;

const STRK =
  "0x04718f5a0fc34cc1af16a1cdee98ffb20c31f5cd61d6ab07201858f4287c938d";

describe("Sepolia ShadowAccountAnonymizer wiring", () => {
  it("get_privacy_contract equals the Sepolia STRK20 pool", async () => {
    const provider = new RpcProvider({ nodeUrl: SEPOLIA_RPC });
    const result = await provider.callContract({
      contractAddress: FIXTURE.anonymizer,
      entrypoint: "get_privacy_contract",
      calldata: [],
    });
    expect(BigInt(result[0])).toBe(BigInt(SEPOLIA_POOL));
    expect(BigInt(ANONYMIZER_ADDRESSES.sepolia.shadowAccount!)).toBe(
      BigInt(FIXTURE.anonymizer),
    );
  }, 30_000);
});

describe("deriveSpendIdentity", () => {
  it("produces different shadow addresses for different nonces", () => {
    const a = deriveSpendIdentity({
      viewingKey: FIXTURE.viewingKey,
      user: FIXTURE.user,
      dappName: FIXTURE.dappName,
      nonce: FIXTURE.nonce0,
      anonymizer: FIXTURE.anonymizer,
    });
    const b = deriveSpendIdentity({
      viewingKey: FIXTURE.viewingKey,
      user: FIXTURE.user,
      dappName: FIXTURE.dappName,
      nonce: FIXTURE.nonce1,
      anonymizer: FIXTURE.anonymizer,
    });

    expect(a.address).not.toBe(b.address);
    expect(a.commitment).not.toBe(b.commitment);
    expect(a.addressHex).toBe(FIXTURE.address0);
    expect(b.addressHex).toBe(FIXTURE.address1);
    expect(`0x${a.commitment.toString(16)}`).toBe(FIXTURE.commitment0);
    expect(`0x${b.commitment.toString(16)}`).toBe(FIXTURE.commitment1);
  });

  it("is deterministic for the same (user, dapp, nonce)", () => {
    const first = deriveSpendIdentity({
      viewingKey: FIXTURE.viewingKey,
      user: FIXTURE.user,
      dappName: FIXTURE.dappName,
      nonce: FIXTURE.nonce0,
      anonymizer: FIXTURE.anonymizer,
    });
    const second = deriveSpendIdentity({
      viewingKey: FIXTURE.viewingKey,
      user: FIXTURE.user,
      dappName: FIXTURE.dappName,
      nonce: FIXTURE.nonce0,
      anonymizer: FIXTURE.anonymizer,
    });

    expect(first.address).toBe(second.address);
    expect(first.commitment).toBe(second.commitment);
    expect(first.partialCommitment).toBe(second.partialCommitment);
  });

  it("throws MissingShadowAnonymizerError when anonymizer config is missing", () => {
    const previous = process.env.CARD_SHADOW_ANONYMIZER;
    delete process.env.CARD_SHADOW_ANONYMIZER;
    try {
      expect(() =>
        deriveSpendIdentity({
          viewingKey: FIXTURE.viewingKey,
          user: FIXTURE.user,
          dappName: FIXTURE.dappName,
          nonce: 0n,
          anonymizer: null,
        }),
      ).toThrow(MissingShadowAnonymizerError);

      // Explicit empty string is also missing config.
      expect(() => resolveShadowAnonymizer("")).toThrow(
        MissingShadowAnonymizerError,
      );
    } finally {
      if (previous === undefined) {
        delete process.env.CARD_SHADOW_ANONYMIZER;
      } else {
        process.env.CARD_SHADOW_ANONYMIZER = previous;
      }
    }
  });

  it("changes address when anonymizer or PRIMER class hash would mutate", () => {
    const dappFelt = BigInt(shortString.encodeShortString(FIXTURE.dappName));
    const partial = shadowAccountPartialCommitment(
      FIXTURE.user,
      FIXTURE.viewingKey,
      BigInt(FIXTURE.anonymizer),
      dappFelt,
    );
    const commitment = shadowAccountCommitment(partial, FIXTURE.nonce0);
    const expected = shadowAccountAddress(
      commitment,
      BigInt(FIXTURE.anonymizer),
    );
    expect(`0x${expected.toString(16)}`).toBe(FIXTURE.address0);

    const mutatedAnonymizer = BigInt(FIXTURE.anonymizer) + 1n;
    const wrongPartial = shadowAccountPartialCommitment(
      FIXTURE.user,
      FIXTURE.viewingKey,
      mutatedAnonymizer,
      dappFelt,
    );
    const wrongCommitment = shadowAccountCommitment(
      wrongPartial,
      FIXTURE.nonce0,
    );
    const wrongAnonAddress = shadowAccountAddress(
      wrongCommitment,
      mutatedAnonymizer,
    );
    expect(wrongAnonAddress).not.toBe(expected);

    const wrongPrimerAddress = BigInt(
      hash.calculateContractAddressFromHash(
        commitment,
        PRIMER_CLASS_HASH + 1n,
        [],
        BigInt(FIXTURE.anonymizer),
      ),
    );
    expect(wrongPrimerAddress).not.toBe(expected);
  });
});

describe("nextUnusedNonce", () => {
  it("returns the smallest unused non-negative nonce", () => {
    expect(nextUnusedNonce([])).toBe(0n);
    expect(nextUnusedNonce([0n, 1n, 2n])).toBe(3n);
    expect(nextUnusedNonce([0, "2", 3n])).toBe(1n);
    expect(nextUnusedNonce([1n, 2n])).toBe(0n);
  });
});

describe("buildShadowSpendCalls", () => {
  it("returns predicted address and commitment without a live chain call", () => {
    const sketch = buildShadowSpendCalls({
      viewingKey: FIXTURE.viewingKey,
      user: FIXTURE.user,
      dappName: FIXTURE.dappName,
      nonce: FIXTURE.nonce0,
      anonymizer: FIXTURE.anonymizer,
      token: STRK,
      amount: 10n ** 18n,
      calls: [
        {
          contractAddress: STRK,
          entrypoint: "transfer",
          calldata: ["0x1", "0x1", "0x0"],
        },
      ],
    });

    expect(sketch.predictedAddress).toBe(FIXTURE.address0);
    expect(`0x${sketch.commitment.toString(16)}`).toBe(FIXTURE.commitment0);
    expect(sketch.fundWithdraw.recipient).toBe(sketch.predictedAddress);
    expect(sketch.fundWithdraw.amount).toBe(10n ** 18n);
    expect(sketch.invoke.collectPolicy).toEqual({ type: "all" });
    expect(sketch.invoke.calls).toHaveLength(1);
  });

  it("rejects non-positive amounts and empty call lists", () => {
    expect(() =>
      buildShadowSpendCalls({
        viewingKey: FIXTURE.viewingKey,
        user: FIXTURE.user,
        dappName: FIXTURE.dappName,
        nonce: 0n,
        anonymizer: FIXTURE.anonymizer,
        token: STRK,
        amount: 0n,
        calls: [
          {
            contractAddress: STRK,
            entrypoint: "transfer",
            calldata: [],
          },
        ],
      }),
    ).toThrow(/positive/);

    expect(() =>
      buildShadowSpendCalls({
        viewingKey: FIXTURE.viewingKey,
        user: FIXTURE.user,
        dappName: FIXTURE.dappName,
        nonce: 0n,
        anonymizer: FIXTURE.anonymizer,
        token: STRK,
        amount: 1n,
        calls: [],
      }),
    ).toThrow(/at least one call/);
  });
});
