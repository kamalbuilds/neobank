//! Private payout anonymizer: ONE-WAY outbound payout helper for the privacy pool.
//!
//! Callable via the privacy contract's Invoke action at the fixed entrypoint selector
//! `privacy_invoke` (`privacy::utils::constants::INVOKE_SELECTOR`). There is no registry and
//! no allowlist: the pool validates only that this address is non-zero before invoking.
//!
//! The entrypoint transfers `amount` of `token` from this contract to `recipient` and returns
//! an EMPTY span of `OpenNoteDeposit`. Nothing flows back into the pool, so a payout is never
//! a screening subject. Returning an empty span is deliberate: the anonymizer needs no
//! screening grant and survives pending changes to the pool's screening policy.

use starknet::ContractAddress;
use crate::objects::OpenNoteDeposit;

/// Error codes for private payout operations.
pub mod errors {
    pub const ZERO_TOKEN: felt252 = 'ZERO_TOKEN';
    pub const ZERO_RECIPIENT: felt252 = 'ZERO_RECIPIENT';
    pub const ZERO_AMOUNT: felt252 = 'ZERO_AMOUNT';
}

#[starknet::interface]
pub trait IPrivatePayoutAnonymizer<T> {
    /// Transfers `amount` of `token` from this contract to `recipient` and returns an EMPTY
    /// span of [`OpenNoteDeposit`] for the privacy contract to apply (always empty: a payout
    /// sends funds out and brings nothing back into the pool).
    ///
    /// Can be called by the privacy contract via the fixed `privacy_invoke` selector.
    ///
    /// #### Preconditions
    /// - This contract must hold at least `amount` of `token` (funded beforehand by whoever
    ///   operates the payout).
    ///
    /// #### Reverts
    /// - `ZERO_TOKEN`: Thrown if `token` is zero.
    /// - `ZERO_RECIPIENT`: Thrown if `recipient` is zero.
    /// - `ZERO_AMOUNT`: Thrown if `amount` is zero.
    /// - `'ERC20: insufficient balance'`: Thrown if the balance is below `amount` (asserted
    ///   before the transfer).
    /// - `'ERC20: transfer failed'`: Thrown if the token's `transfer` returns false. The
    ///   boolean return value is asserted, never assumed true.
    fn privacy_invoke(
        ref self: T, token: ContractAddress, recipient: ContractAddress, amount: u256,
    ) -> Span<OpenNoteDeposit>;
}

/// One-way outbound payout anonymizer contract invoked by the privacy contract.
#[starknet::contract]
pub mod PrivatePayoutAnonymizer {
    use core::num::traits::Zero;
    use starknet::ContractAddress;
    use crate::erc20_utils::checked_transfer;
    use crate::objects::OpenNoteDeposit;
    use super::{IPrivatePayoutAnonymizer, errors};

    #[storage]
    struct Storage {}

    #[constructor]
    fn constructor(ref self: ContractState) {}

    #[abi(embed_v0)]
    pub impl PrivatePayoutAnonymizerImpl of IPrivatePayoutAnonymizer<ContractState> {
        fn privacy_invoke(
            ref self: ContractState,
            token: ContractAddress,
            recipient: ContractAddress,
            amount: u256,
        ) -> Span<OpenNoteDeposit> {
            assert(token.is_non_zero(), errors::ZERO_TOKEN);
            assert(recipient.is_non_zero(), errors::ZERO_RECIPIENT);
            assert(amount.is_non_zero(), errors::ZERO_AMOUNT);

            // Checked transfer: asserts sufficient balance up front and asserts the boolean
            // return value of `transfer`; a false return aborts the whole invoke.
            checked_transfer(token_address: token, :recipient, :amount);

            // One-way payout: nothing comes back into the pool, hence the empty span.
            ArrayTrait::new().span()
        }
    }
}
