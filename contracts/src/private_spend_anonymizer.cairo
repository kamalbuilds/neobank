//! Private spend anonymizer: pay a recipient and reshield the change, atomically.
//!
//! Callable via the privacy contract's Invoke action at the fixed entrypoint selector
//! `privacy_invoke`. Where `PrivatePayoutAnonymizer` is strictly outbound and returns an
//! empty span, this one is a round trip: it pays part of the withdrawn value out to a public
//! recipient and hands the remainder straight back to the pool as an [`OpenNoteDeposit`], so
//! the change never becomes a public balance the payer has to re-shield in a second
//! transaction.
//!
//! Why that matters: paying then re-shielding as two transactions publishes the change amount
//! and pays the pool fee twice, and the gap between them is exactly the correlation a
//! privacy pool exists to remove. One call, one fee, no public change balance.
//!
//! The pool creates the open note being filled here through a `transfer` action with the
//! literal amount `"OPEN"` in the same transaction, and passes its id in as `note_id`. Every
//! open note created in a call must be filled exactly once or the pool rejects the whole
//! transaction with `UNDEPOSITED_OPEN_NOTES`, so the returned span always carries exactly one
//! deposit.
//!
//! Honest boundary: the payout leg is a public ERC20 transfer. The recipient address and the
//! paid amount are visible on chain. What stays private is the payer and the change.

use starknet::ContractAddress;
use crate::objects::OpenNoteDeposit;

/// Error codes for private spend operations.
pub mod errors {
    pub const ZERO_TOKEN: felt252 = 'ZERO_TOKEN';
    pub const ZERO_RECIPIENT: felt252 = 'ZERO_RECIPIENT';
    pub const ZERO_AMOUNT: felt252 = 'ZERO_AMOUNT';
    pub const ZERO_NOTE_ID: felt252 = 'ZERO_NOTE_ID';
    pub const PAY_EXCEEDS_FUNDED: felt252 = 'PAY_EXCEEDS_FUNDED';
    pub const CHANGE_TOO_LARGE: felt252 = 'CHANGE_TOO_LARGE';
}

#[starknet::interface]
pub trait IPrivateSpendAnonymizer<T> {
    /// Pays `pay_amount` of `token` to `recipient`, then returns the remainder of `funded`
    /// as a single [`OpenNoteDeposit`] against `note_id` for the privacy contract to apply.
    ///
    /// `funded` is the amount the pool withdrew to this contract in the same transaction. It
    /// is passed explicitly rather than read from the balance so a stray donation to this
    /// contract cannot inflate the change note.
    ///
    /// #### Preconditions
    /// - This contract holds at least `funded` of `token`, withdrawn by the pool in the same
    ///   call.
    /// - `note_id` identifies an open note created in the same transaction.
    ///
    /// #### Reverts
    /// - `ZERO_TOKEN`, `ZERO_RECIPIENT`, `ZERO_AMOUNT`, `ZERO_NOTE_ID`: on zero inputs.
    /// - `PAY_EXCEEDS_FUNDED`: if `pay_amount` is greater than `funded`. Paying more than was
    ///   withdrawn would drain change belonging to an earlier caller.
    /// - `CHANGE_TOO_LARGE`: if the change does not fit in the `u128` the pool's
    ///   `OpenNoteDeposit` uses for amounts.
    /// - `'ERC20: insufficient balance'` / `'ERC20: transfer failed'`: from the checked
    ///   transfer of the payout leg.
    fn privacy_invoke(
        ref self: T,
        token: ContractAddress,
        recipient: ContractAddress,
        pay_amount: u256,
        funded: u256,
        note_id: felt252,
    ) -> Span<OpenNoteDeposit>;
}

/// Round-trip spend anonymizer: pays out, reshields the change in the same call.
#[starknet::contract]
pub mod PrivateSpendAnonymizer {
    use core::num::traits::Zero;
    use starknet::ContractAddress;
    use crate::erc20_utils::checked_transfer;
    use crate::objects::OpenNoteDeposit;
    use super::{IPrivateSpendAnonymizer, errors};

    #[storage]
    struct Storage {}

    #[constructor]
    fn constructor(ref self: ContractState) {}

    #[abi(embed_v0)]
    pub impl PrivateSpendAnonymizerImpl of IPrivateSpendAnonymizer<ContractState> {
        fn privacy_invoke(
            ref self: ContractState,
            token: ContractAddress,
            recipient: ContractAddress,
            pay_amount: u256,
            funded: u256,
            note_id: felt252,
        ) -> Span<OpenNoteDeposit> {
            assert(token.is_non_zero(), errors::ZERO_TOKEN);
            assert(recipient.is_non_zero(), errors::ZERO_RECIPIENT);
            assert(pay_amount.is_non_zero(), errors::ZERO_AMOUNT);
            assert(note_id.is_non_zero(), errors::ZERO_NOTE_ID);
            assert(pay_amount <= funded, errors::PAY_EXCEEDS_FUNDED);

            // Pay first. A failed payout aborts the whole invoke, so the pool never applies a
            // change deposit for a spend that did not happen.
            checked_transfer(token_address: token, :recipient, amount: pay_amount);

            let change: u256 = funded - pay_amount;
            // The pool's OpenNoteDeposit carries a u128. Assert rather than truncate: a
            // silent downcast would mint a change note for the wrong amount.
            assert(change.high.is_zero(), errors::CHANGE_TOO_LARGE);
            let change_amount: u128 = change.low;

            // Exactly one deposit, always. The pool requires every open note created in this
            // transaction to be filled once, and a zero-amount fill is still a fill: paying
            // the full funded amount leaves a legitimate zero-value change note.
            let mut deposits = ArrayTrait::new();
            deposits.append(OpenNoteDeposit { note_id, token, amount: change_amount });
            deposits.span()
        }
    }
}
