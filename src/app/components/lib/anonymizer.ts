import { num } from "starknet";
import type { WALLET_API } from "@starknet-io/types-js";

/* Building the action list for a call into our own anonymizer contract.
 *
 * The pool calls any contract exposing `privacy_invoke` at the fixed selector.
 * There is no registry and no allowlist: `assert_valid` checks only that the
 * target address is non-zero. What trips people up is funding the input side.
 *
 * The `withdraw` action is what moves shielded value out to the helper. A
 * `transfer` with amount "OPEN" does NOT fund it: that action creates the
 * *output* open note the helper fills on the way back. Sending only a transfer
 * plus an invoke leaves the contract with nothing to spend.
 *
 * "OPEN", "${poolAddress}" and "${openNoteIds[0]}" are literal placeholder
 * strings the wallet substitutes while assembling the transaction. Passing them
 * through num.toHex corrupts them. Only real addresses and amounts get
 * hex-normalised.
 */

/** A one-way payout: value leaves the pool and nothing comes back. */
export interface PayoutInvoke {
  /** Our deployed PrivatePayoutAnonymizer. */
  anonymizer: string;
  token: string;
  /** Base units. */
  amount: bigint;
  /** Final recipient, paid by the contract. */
  recipient: string;
}

/**
 * Actions for a one-way payout through our anonymizer.
 *
 * No "OPEN" transfer here on purpose: PrivatePayoutAnonymizer returns an empty
 * span, so no open note is filled and nothing re-enters the pool. That is also
 * what keeps it from ever being a screening subject.
 */
export function buildPayoutActions(p: PayoutInvoke): WALLET_API.STRK20_ACTION[] {
  if (p.amount <= 0n) throw new Error("Payout amount must be greater than zero.");
  const anonymizer = num.toHex(p.anonymizer);
  const token = num.toHex(p.token);

  return [
    // Fund the contract. This is the leg people miss.
    { type: "withdraw", token, amount: num.toHex(p.amount), recipient: anonymizer },
    // privacy_invoke(token, recipient, amount) -> empty span.
    {
      type: "invoke",
      contract: anonymizer,
      calldata: [token, num.toHex(p.recipient), num.toHex(p.amount)],
    },
  ] as WALLET_API.STRK20_ACTION[];
}

/** A payout leg inside a programmable spend. */
export interface SpendLeg {
  /** Final recipient, paid by the contract. */
  recipient: string;
  /** Base units. */
  amount: bigint;
}

/**
 * Actions for a spend that returns change to the pool in the same call.
 *
 * Targets our deployed ProgrammableSpendAnonymizer:
 * `privacy_invoke(token, funded:u256, position_amount:u256, recipients:Span, amounts:Span, note_id)`.
 * Every felt is spelled out because the wallet does not serialise spans or
 * u256s for us. `funded` MUST equal the withdraw amount below - the contract
 * asserts legs + position fit inside it.
 *
 * The helper must return a Span<OpenNoteDeposit> naming the open note created
 * by the transfer below, or the pool rejects the transaction with
 * UNDEPOSITED_OPEN_NOTES: every open note created in a call has to be filled
 * exactly once before it can finalise.
 */
export interface ProgrammableSpendInvoke {
  /** Our deployed ProgrammableSpendAnonymizer. */
  anonymizer: string;
  token: string;
  /** Total withdrawn from the pool into the contract for this call. Base units. */
  funded: bigint;
  /** Optional deposit into the allowlisted position vault, taken from `funded`. */
  positionAmount?: bigint;
  /** Payout legs, executed in order after the position. */
  legs: SpendLeg[];
  /** Where the change note lands. The connected account. */
  changeRecipient: string;
  /** Extra felts appended after the standard arguments. */
  extraCalldataTail?: string[];
}

/** Splits a bigint into the two felts a Cairo u256 serialises as. */
function u256Felts(value: bigint): [string, string] {
  const MASK = (1n << 128n) - 1n;
  return [num.toHex(value & MASK), num.toHex(value >> 128n)];
}

export function buildProgrammableSpendActions(
  p: ProgrammableSpendInvoke,
): WALLET_API.STRK20_ACTION[] {
  if (p.funded <= 0n) throw new Error("Spend funded amount must be greater than zero.");
  if (p.legs.length === 0 && !(p.positionAmount ?? 0n)) {
    throw new Error("A spend needs at least one payout leg or a position amount.");
  }
  const anonymizer = num.toHex(p.anonymizer);
  const token = num.toHex(p.token);

  return [
    // Fund the contract with exactly what `funded` claims. This is the leg people miss.
    { type: "withdraw", token, amount: num.toHex(p.funded), recipient: anonymizer },
    // Creates the open note the helper fills with the change. "OPEN" is a
    // literal the wallet substitutes; never hex-normalise it.
    { type: "transfer", token, amount: "OPEN", recipient: num.toHex(p.changeRecipient) },
    {
      type: "invoke",
      contract: anonymizer,
      calldata: [
        token,
        ...u256Felts(p.funded),
        ...u256Felts(p.positionAmount ?? 0n),
        num.toHex(p.legs.length),
        ...p.legs.map((leg) => num.toHex(leg.recipient)),
        num.toHex(p.legs.length),
        ...p.legs.flatMap((leg) => u256Felts(leg.amount)),
        // Substituted by the wallet during assembly.
        "${openNoteIds[0]}",
        ...(p.extraCalldataTail ?? []),
      ],
    },
  ] as WALLET_API.STRK20_ACTION[];
}
