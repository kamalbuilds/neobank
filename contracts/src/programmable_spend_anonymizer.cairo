//! Programmable spend anonymizer: pay N recipients, optionally open a yield position, and
//! reshield the change, atomically - one pool fee, no public change balance.
//!
//! Callable via the privacy contract's Invoke action at the fixed entrypoint selector
//! `privacy_invoke`. This is the general form of [`crate::private_spend_anonymizer`]:
//! instead of one payout leg it executes an ordered list of payout legs, and it can route a
//! portion of the funded value into a position vault before the change is returned to the
//! pool as a single [`OpenNoteDeposit`]. Every leg is all-or-nothing: any failed transfer
//! aborts the whole invoke, so the pool never applies a change deposit for a partial spend.
//!
//! Why this is the card-shaped primitive: a card authorization is exactly
//! "settle amount X to acquirer A out of shielded funds, keep the rest private". The payout
//! legs are that settlement plus tips and fees; the change note keeps the unspent balance
//! inside the pool so nothing about the account's size ever becomes public between spends.
//!
//! The position leg is allowlisted by design. The pool validates only
//! `contract_address.is_non_zero()` for invoked contracts, which means a generic
//! call-anything anonymizer would be a drain handle for anyone who can get a note spent
//! through it. Here the only callable target is the vault address the owner set via
//! [`IPositionVault::deposit`] with a fixed signature; with no vault configured the position
//! leg reverts rather than silently skipping.
//!
//! Honest boundary: payout legs are public ERC20 transfers - recipient addresses and amounts
//! are visible on chain. Private are who funded the spend, the account balance behind it,
//! and the change.

use starknet::ContractAddress;
use crate::objects::OpenNoteDeposit;

/// Error codes for programmable spend operations.
pub mod errors {
    pub const ZERO_TOKEN: felt252 = 'ZERO_TOKEN';
    pub const ZERO_NOTE_ID: felt252 = 'ZERO_NOTE_ID';
    pub const LEN_MISMATCH: felt252 = 'LEN_MISMATCH';
    pub const EMPTY_LEGS_WITH_ZERO_POSITION: felt252 = 'EMPTY_SPEND';
    pub const ZERO_RECIPIENT: felt252 = 'ZERO_RECIPIENT';
    pub const ZERO_AMOUNT: felt252 = 'ZERO_AMOUNT';
    pub const PAY_EXCEEDS_FUNDED: felt252 = 'PAY_EXCEEDS_FUNDED';
    pub const NO_POSITION_VAULT: felt252 = 'NO_POSITION_VAULT';
    pub const CHANGE_TOO_LARGE: felt252 = 'CHANGE_TOO_LARGE';
}

/// Minimal surface the anonymizer needs from a position target. Fixed signature, owner
/// allowlisted address - there is deliberately no way to express arbitrary calls here.
///
/// Transfer semantics: the anonymizer moves `amount` of `token` to the vault with a checked
/// ERC20 transfer FIRST; `deposit(token, amount)` is called afterwards as the vault's record
/// entrypoint for funds it has already received. A vault that expects to pull with
/// `transferFrom` does not fit this interface and must not be allowlisted.
#[starknet::interface]
pub trait IPositionVault<T> {
    fn deposit(ref self: T, token: ContractAddress, amount: u256);
}

#[starknet::interface]
pub trait IProgrammableSpendAnonymizer<T> {
    /// Executes up to three things against `funded` of `token`, withdrawn from the pool to
    /// this contract earlier in the same transaction:
    ///
    /// 1. Opens a position of `position_amount` at the configured vault (skipped when zero).
    /// 2. Pays each pair of `recipients[i]` / `amounts[i]` in order.
    /// 3. Returns the remainder as a single [`OpenNoteDeposit`] against `note_id`.
    ///
    /// #### Preconditions
    /// - This contract holds at least `funded` of `token`, withdrawn by the pool in the same
    ///   call (`position_amount + sum(amounts) <= funded` is enforced).
    /// - `note_id` identifies an open note created in the same transaction.
    /// - `position_amount > 0` requires the owner to have configured a vault first.
    ///
    /// #### Reverts
    /// - `ZERO_TOKEN`, `ZERO_NOTE_ID`: on zero inputs.
    /// - `EMPTY_SPEND`: if there is nothing to do (no legs and zero position).
    /// - `LEN_MISMATCH`: if `recipients` and `amounts` differ in length.
    /// - `ZERO_RECIPIENT`, `ZERO_AMOUNT`: on any zero leg input.
    /// - `PAY_EXCEEDS_FUNDED`: if the requested total exceeds `funded`.
    /// - `NO_POSITION_VAULT`: on a nonzero position with no vault configured.
    /// - `'ERC20: insufficient balance'` / `'ERC20: transfer failed'`: from checked
    ///   transfers of the position or payout legs.
    fn privacy_invoke(
        ref self: T,
        token: ContractAddress,
        funded: u256,
        position_amount: u256,
        recipients: Span<ContractAddress>,
        amounts: Span<u256>,
        note_id: felt252,
    ) -> Span<OpenNoteDeposit>;

    /// Sets the single allowed position target. Only the owner may call this.
    ///
    /// #### Reverts
    /// - `'Caller is not the owner'`: from the Ownable check.
    fn set_position_vault(ref self: T, vault: ContractAddress);

    /// Returns the currently configured position vault (zero when none).
    fn position_vault(self: @T) -> ContractAddress;
}

/// The position vault received `amount` of `token`.
#[derive(Drop, starknet::Event)]
pub struct PositionOpened {
    pub vault: ContractAddress,
    pub token: ContractAddress,
    pub amount: u256,
}

/// A payout leg paid `amount` of `token` to `recipient`.
#[derive(Drop, starknet::Event)]
pub struct PayoutExecuted {
    pub recipient: ContractAddress,
    pub token: ContractAddress,
    pub amount: u256,
}

/// The remainder came back to the pool as open note `note_id`.
#[derive(Drop, starknet::Event)]
pub struct ChangeReshielded {
    pub note_id: felt252,
    pub token: ContractAddress,
    pub amount: u128,
}

/// The owner repointed the position target.
#[derive(Drop, starknet::Event)]
pub struct VaultSet {
    pub vault: ContractAddress,
}

/// Multi-leg spend anonymizer: position + payouts + change reshield in one invoke.
#[starknet::contract]
pub mod ProgrammableSpendAnonymizer {
    use core::num::traits::Zero;
    use starknet::ContractAddress;
    use starknet::storage::{StoragePointerReadAccess, StoragePointerWriteAccess};
    use crate::erc20_utils::checked_transfer;
    use crate::objects::OpenNoteDeposit;
    use super::{
        IProgrammableSpendAnonymizer,
        errors,
        IPositionVaultDispatcher,
        IPositionVaultDispatcherTrait,
        ChangeReshielded,
        PayoutExecuted,
        PositionOpened,
        VaultSet,
    };

    #[storage]
    struct Storage {
        /// The single allowed position target. Zero means "no position leg possible".
        position_vault: ContractAddress,
        owner: ContractAddress,
    }

    #[event]
    #[derive(Drop, starknet::Event)]
    pub enum Event {
        PositionOpened: super::PositionOpened,
        PayoutExecuted: super::PayoutExecuted,
        ChangeReshielded: super::ChangeReshielded,
        VaultSet: super::VaultSet,
    }

    #[constructor]
    fn constructor(ref self: ContractState, owner: ContractAddress) {
        self.owner.write(owner);
    }

    #[abi(embed_v0)]
    pub impl ProgrammableSpendAnonymizerImpl of IProgrammableSpendAnonymizer<ContractState> {
        fn privacy_invoke(
            ref self: ContractState,
            token: ContractAddress,
            funded: u256,
            position_amount: u256,
            recipients: Span<ContractAddress>,
            amounts: Span<u256>,
            note_id: felt252,
        ) -> Span<OpenNoteDeposit> {
            assert(token.is_non_zero(), errors::ZERO_TOKEN);
            assert(note_id.is_non_zero(), errors::ZERO_NOTE_ID);
            assert(
                recipients.len() == amounts.len(),
                errors::LEN_MISMATCH,
            );
            assert(
                !(recipients.is_empty() && position_amount.is_zero()),
                errors::EMPTY_LEGS_WITH_ZERO_POSITION,
            );

            // Validate every leg before moving any money, so a bad leg aborts before the
            // first transfer instead of after some of them (the pool would roll back either
            // way, but failing fast keeps panic data pointing at the real cause).
            let mut total: u256 = position_amount;
            let mut i: usize = 0;
            while i < recipients.len() {
                assert(!(*recipients[i]).is_zero(), errors::ZERO_RECIPIENT);
                assert(!(*amounts[i]).is_zero(), errors::ZERO_AMOUNT);
                total += *amounts[i];
                i += 1;
            }
            assert(total <= funded, errors::PAY_EXCEEDS_FUNDED);

            // Position first: if either the transfer or the vault rejects, no payout has
            // happened yet. Funds reach the vault by checked transfer; deposit() records
            // what was received (see IPositionVault docs).
            if !position_amount.is_zero() {
                let vault = self.position_vault.read();
                assert(vault.is_non_zero(), errors::NO_POSITION_VAULT);
                checked_transfer(token_address: token, recipient: vault, amount: position_amount);
                IPositionVaultDispatcher { contract_address: vault }.deposit(
                    token, position_amount,
                );
                self.emit(Event::PositionOpened(PositionOpened { vault, token, amount: position_amount }));
            }

            let mut i: usize = 0;
            while i < recipients.len() {
                let recipient = *recipients[i];
                let amount = *amounts[i];
                checked_transfer(token_address: token, :recipient, :amount);
                self.emit(Event::PayoutExecuted(PayoutExecuted { recipient, token, amount }));
                i += 1;
            }

            let change: u256 = funded - total;
            // The pool's OpenNoteDeposit carries a u128. Assert rather than truncate: a
            // silent downcast would mint a change note for the wrong amount.
            assert(change.high.is_zero(), errors::CHANGE_TOO_LARGE);
            let change_amount: u128 = change.low;

            // Exactly one deposit, always. The pool requires every open note created in this
            // transaction to be filled once, and a zero-amount fill is still a fill: spending
            // the full funded amount leaves a legitimate zero-value change note.
            let mut deposits = ArrayTrait::new();
            deposits.append(OpenNoteDeposit { note_id, token, amount: change_amount });
            self.emit(Event::ChangeReshielded(ChangeReshielded { note_id, token, amount: change_amount }));
            deposits.span()
        }

        fn set_position_vault(ref self: ContractState, vault: ContractAddress) {
            let caller = starknet::get_caller_address();
            assert(caller == self.owner.read(), 'Caller is not the owner');
            self.position_vault.write(vault);
            self.emit(Event::VaultSet(VaultSet { vault }));
        }

        fn position_vault(self: @ContractState) -> ContractAddress {
            self.position_vault.read()
        }
    }
}