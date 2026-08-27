import { describe, expect, it } from "vitest";
import {
  INBOUND_CCTP,
  assertInboundBurnMessage,
  buildReceiveMessageCalldata,
  bytes32ToU256Parts,
  decodeCctpV2BurnMessage,
  hexToBytes,
  inboundRuntimeStatus,
  irisMessagesUrl,
  parseIrisResponse,
  serializeByteArray,
  starknetAddressToBytes32,
} from "@/server/fund/inbound";

const HOSTED = "0x6fe3031556a0ca23be489a0199c9e304f00f13900eacefcd50aeccdf57a23f6";

// Build a wire-exact CCTP V2 burn message: 148-byte header + 228-byte body,
// layouts from circlefin/starknet-cctp message_transmitter_v2.cairo and
// burn_message_v2.cairo.
function syntheticBurnMessage(overrides?: {
  destinationDomain?: number;
  burnToken?: string;
  mintRecipient?: string;
  amount?: bigint;
  feeExecuted?: bigint;
}): string {
  const u32 = (v: number) => v.toString(16).padStart(8, "0");
  const b32 = (v: string | bigint) =>
    (typeof v === "bigint" ? v : BigInt(v)).toString(16).padStart(64, "0");
  const header =
    u32(1) + // version
    u32(6) + // sourceDomain: Base
    u32(overrides?.destinationDomain ?? 25) + // destinationDomain: Starknet
    b32(0xabcdefn) + // nonce
    b32(INBOUND_CCTP.baseSepolia.tokenMessengerV2) + // sender
    b32(INBOUND_CCTP.starknetSepolia.tokenMessengerMinter) + // recipient
    b32(0n) + // destinationCaller: anyone
    u32(2000) + // minFinalityThreshold
    u32(2000); // finalityThresholdExecuted
  const body =
    u32(1) + // body version
    b32(overrides?.burnToken ?? INBOUND_CCTP.baseSepolia.usdc) +
    b32(overrides?.mintRecipient ?? HOSTED) +
    b32(overrides?.amount ?? 2_000_000n) + // amount: 2 USDC
    b32(0x1111n) + // messageSender
    b32(0n) + // maxFee
    b32(overrides?.feeExecuted ?? 0n) + // feeExecuted
    b32(0n); // expirationBlock
  return `0x${header}${body}`;
}

describe("inbound CCTP message decoding", () => {
  it("decodes a wire-exact V2 burn message", () => {
    const decoded = decodeCctpV2BurnMessage(syntheticBurnMessage());
    expect(decoded.version).toBe(1);
    expect(decoded.sourceDomain).toBe(6);
    expect(decoded.destinationDomain).toBe(25);
    expect(BigInt(decoded.nonce)).toBe(0xabcdefn);
    expect(BigInt(decoded.recipient)).toBe(
      BigInt(INBOUND_CCTP.starknetSepolia.tokenMessengerMinter),
    );
    expect(decoded.minFinalityThreshold).toBe(2000);
    expect(decoded.finalityThresholdExecuted).toBe(2000);
    expect(BigInt(decoded.body.burnToken)).toBe(BigInt(INBOUND_CCTP.baseSepolia.usdc));
    expect(BigInt(decoded.body.mintRecipient)).toBe(BigInt(HOSTED));
    expect(decoded.body.amount).toBe(2_000_000n);
    expect(decoded.body.feeExecuted).toBe(0n);
  });

  it("rejects a truncated message instead of misreading fields", () => {
    const full = syntheticBurnMessage();
    expect(() => decodeCctpV2BurnMessage(full.slice(0, full.length - 2))).toThrow(
      /too short/,
    );
    expect(() => decodeCctpV2BurnMessage("0x1234")).toThrow(/too short/);
  });

  it("accepts the expected route and fails closed on any other", () => {
    const good = decodeCctpV2BurnMessage(syntheticBurnMessage());
    expect(() => assertInboundBurnMessage(good, HOSTED)).not.toThrow();

    const wrongDomain = decodeCctpV2BurnMessage(
      syntheticBurnMessage({ destinationDomain: 0 }),
    );
    expect(() => assertInboundBurnMessage(wrongDomain)).toThrow(/not Starknet/);

    const wrongToken = decodeCctpV2BurnMessage(
      syntheticBurnMessage({ burnToken: "0x00000000000000000000000000000000000000ff" }),
    );
    expect(() => assertInboundBurnMessage(wrongToken)).toThrow(/not Base Sepolia USDC/);

    const wrongRecipient = decodeCctpV2BurnMessage(
      syntheticBurnMessage({ mintRecipient: "0x1234" }),
    );
    expect(() => assertInboundBurnMessage(wrongRecipient, HOSTED)).toThrow(
      /not the hosted account/,
    );
  });
});

describe("starknet mint recipient encoding", () => {
  it("left-pads a felt address into bytes32", () => {
    expect(starknetAddressToBytes32(HOSTED)).toBe(
      `0x0${HOSTED.slice(2).padStart(63, "0")}`,
    );
    expect(starknetAddressToBytes32(HOSTED)).toHaveLength(66);
  });

  it("rejects values outside the felt range", () => {
    expect(() => starknetAddressToBytes32("0x0")).toThrow(/felt range/);
    expect(() => starknetAddressToBytes32(`0x${"f".repeat(64)}`)).toThrow(/felt range/);
    expect(() => starknetAddressToBytes32("not-an-address")).toThrow(/Invalid/);
  });
});

describe("Cairo ByteArray serialization", () => {
  it("packs short payloads into pending_word only", () => {
    // "hello" = 0x68656c6c6f, under one bytes31 word
    expect(serializeByteArray("0x68656c6c6f")).toEqual([
      "0x0",
      "0x68656c6c6f",
      "0x5",
    ]);
  });

  it("packs an exact bytes31 word with an empty pending_word", () => {
    const word = "ab".repeat(31);
    expect(serializeByteArray(`0x${word}`)).toEqual([
      "0x1",
      `0x${word}`,
      "0x0",
      "0x0",
    ]);
  });

  it("splits word boundary + remainder correctly", () => {
    const word = "cd".repeat(31);
    expect(serializeByteArray(`0x${word}01ff`)).toEqual([
      "0x1",
      `0x${word}`,
      "0x1ff",
      "0x2",
    ]);
  });

  it("serializes a 65-byte attestation into 2 words + 3 pending bytes", () => {
    const attestation = `0x${"11".repeat(65)}`;
    const felts = serializeByteArray(attestation);
    expect(felts[0]).toBe("0x2");
    expect(felts).toHaveLength(5);
    expect(felts[4]).toBe("0x3");
  });

  it("builds receive_message calldata as message then attestation", () => {
    const message = syntheticBurnMessage();
    const attestation = `0x${"22".repeat(65)}`;
    const calldata = buildReceiveMessageCalldata(message, attestation);
    expect(calldata).toEqual([
      ...serializeByteArray(message),
      ...serializeByteArray(attestation),
    ]);
    // 376-byte message: 12 full words + 4 pending bytes
    expect(calldata[0]).toBe("0xc");
    expect(calldata[14]).toBe("0x4");
  });
});

describe("u256 and hex primitives", () => {
  it("splits a bytes32 into Cairo u256 halves", () => {
    const parts = bytes32ToU256Parts(`0x${"00".repeat(15)}01${"00".repeat(15)}02`);
    expect(parts.high).toBe(1n);
    expect(parts.low).toBe(2n);
  });

  it("rejects malformed hex", () => {
    expect(() => hexToBytes("0xabc")).toThrow(/Invalid hex/);
    expect(() => hexToBytes("0xzz")).toThrow(/Invalid hex/);
  });
});

describe("Iris sandbox plumbing", () => {
  it("targets the sandbox API with the Base domain", () => {
    const tx = `0x${"ab".repeat(32)}`;
    expect(irisMessagesUrl(tx)).toBe(
      `https://iris-api-sandbox.circle.com/v2/messages/6?transactionHash=${tx}`,
    );
  });

  it("parses a complete Iris message and drops PENDING attestations", () => {
    expect(
      parseIrisResponse({
        messages: [{ status: "complete", message: "0xff", attestation: "0xaa" }],
      }),
    ).toEqual({ status: "complete", message: "0xff", attestation: "0xaa" });
    expect(
      parseIrisResponse({
        messages: [{ status: "pending_confirmations", attestation: "PENDING" }],
      }),
    ).toEqual({ status: "pending_confirmations", message: undefined, attestation: undefined });
    expect(parseIrisResponse({ messages: [] })).toBeUndefined();
    expect(parseIrisResponse(undefined)).toBeUndefined();
  });
});

describe("inbound runtime status", () => {
  it("fails closed and names the missing configuration", () => {
    const status = inboundRuntimeStatus({});
    expect(status.ready).toBe(false);
    expect(status.missing).toEqual([
      "CARD_RUNTIME_ACCOUNT_ADDRESS",
      "CARD_RUNTIME_PRIVATE_KEY",
    ]);
    expect(status.evmSignerConfigured).toBe(false);
  });

  it("reports ready with the hosted account as mint destination", () => {
    const status = inboundRuntimeStatus({
      CARD_RUNTIME_ACCOUNT_ADDRESS: HOSTED,
      CARD_RUNTIME_PRIVATE_KEY: "0x1",
    });
    expect(status.ready).toBe(true);
    expect(status.hostedAccount).toBe(HOSTED);
    expect(status.contracts.starknetSepolia.domain).toBe(25);
    expect(status.contracts.baseSepolia.domain).toBe(6);
  });
});
