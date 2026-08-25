//! Stateful STRK20 card settlement helper.
//!
//! The privacy pool withdraws the exact settlement token amount to this contract, then calls
//! `privacy_invoke`. The helper enforces replay, token, per-transaction, daily, and freeze
//! policy before paying the one configured public issuer/acquirer address. It cannot call an
//! arbitrary target and returns no open-note deposits.

use starknet::ContractAddress;
use crate::objects::OpenNoteDeposit;

pub mod errors {
    pub const ZERO_OWNER: felt252 = 'ZERO_OWNER';
    pub const ZERO_PRIVACY_POOL: felt252 = 'ZERO_PRIVACY_POOL';
    pub const ZERO_SETTLEMENT_RECIPIENT: felt252 = 'ZERO_SETTLEMENT_RECIPIENT';
    pub const ZERO_SETTLEMENT_TOKEN: felt252 = 'ZERO_SETTLEMENT_TOKEN';
    pub const ZERO_MAX_PER_TRANSACTION: felt252 = 'ZERO_MAX_PER_TRANSACTION';
    pub const ZERO_DAILY_LIMIT: felt252 = 'ZERO_DAILY_LIMIT';
    pub const NOT_PRIVACY_POOL: felt252 = 'NOT_PRIVACY_POOL';
    pub const CONTRACT_FROZEN: felt252 = 'CONTRACT_FROZEN';
    pub const ZERO_AUTHORIZATION_ID: felt252 = 'ZERO_AUTHORIZATION_ID';
    pub const AUTHORIZATION_USED: felt252 = 'AUTHORIZATION_USED';
    pub const WRONG_SETTLEMENT_TOKEN: felt252 = 'WRONG_SETTLEMENT_TOKEN';
    pub const ZERO_AMOUNT: felt252 = 'ZERO_AMOUNT';
    pub const MAX_PER_TRANSACTION_EXCEEDED: felt252 = 'MAX_PER_TX_EXCEEDED';
    pub const DAILY_LIMIT_EXCEEDED: felt252 = 'DAILY_LIMIT_EXCEEDED';
    pub const NOT_OWNER: felt252 = 'NOT_OWNER';
}

#[derive(Serde, Copy, Drop, PartialEq, Debug)]
pub struct CardSettlementConfig {
    pub owner: ContractAddress,
    pub privacy_pool: ContractAddress,
    pub settlement_recipient: ContractAddress,
    pub settlement_token: ContractAddress,
    pub max_per_transaction: u256,
    pub daily_limit: u256,
    pub frozen: bool,
}

#[starknet::interface]
pub trait ICardSettlementAnonymizer<T> {
    fn privacy_invoke(
        ref self: T, authorization_id: felt252, token: ContractAddress, amount: u256,
    ) -> Span<OpenNoteDeposit>;
    fn set_limits(ref self: T, max_per_transaction: u256, daily_limit: u256);
    fn set_settlement_recipient(ref self: T, settlement_recipient: ContractAddress);
    fn set_frozen(ref self: T, frozen: bool);
    fn get_config(self: @T) -> CardSettlementConfig;
    fn is_authorization_used(self: @T, authorization_id: felt252) -> bool;
    fn get_daily_spend(self: @T) -> (u64, u256);
}

#[derive(Drop, starknet::Event)]
pub struct AuthorizationSettled {
    #[key]
    pub authorization_id: felt252,
    pub recipient: ContractAddress,
    pub token: ContractAddress,
    pub amount: u256,
    pub day: u64,
}

#[derive(Drop, starknet::Event)]
pub struct LimitsUpdated {
    pub max_per_transaction: u256,
    pub daily_limit: u256,
}

#[derive(Drop, starknet::Event)]
pub struct SettlementRecipientUpdated {
    pub settlement_recipient: ContractAddress,
}

#[derive(Drop, starknet::Event)]
pub struct FrozenUpdated {
    pub frozen: bool,
}

#[starknet::contract]
pub mod CardSettlementAnonymizer {
    use core::num::traits::Zero;
    use starknet::storage::{
        Map, StorageMapReadAccess, StorageMapWriteAccess, StoragePointerReadAccess,
        StoragePointerWriteAccess,
    };
    use starknet::{ContractAddress, get_block_timestamp, get_caller_address};
    use crate::erc20_utils::checked_transfer;
    use crate::objects::OpenNoteDeposit;
    use super::{
        AuthorizationSettled, CardSettlementConfig, FrozenUpdated, ICardSettlementAnonymizer,
        LimitsUpdated, SettlementRecipientUpdated, errors,
    };

    const SECONDS_PER_DAY: u64 = 86_400;

    #[storage]
    struct Storage {
        owner: ContractAddress,
        privacy_pool: ContractAddress,
        settlement_recipient: ContractAddress,
        settlement_token: ContractAddress,
        max_per_transaction: u256,
        daily_limit: u256,
        used_authorization_ids: Map<felt252, bool>,
        current_day: u64,
        spent_today: u256,
        frozen: bool,
    }

    #[event]
    #[derive(Drop, starknet::Event)]
    pub enum Event {
        AuthorizationSettled: super::AuthorizationSettled,
        LimitsUpdated: super::LimitsUpdated,
        SettlementRecipientUpdated: super::SettlementRecipientUpdated,
        FrozenUpdated: super::FrozenUpdated,
    }

    #[constructor]
    pub(crate) fn constructor(
        ref self: ContractState,
        owner: ContractAddress,
        privacy_pool: ContractAddress,
        settlement_recipient: ContractAddress,
        settlement_token: ContractAddress,
        max_per_transaction: u256,
        daily_limit: u256,
    ) {
        assert(owner.is_non_zero(), errors::ZERO_OWNER);
        assert(privacy_pool.is_non_zero(), errors::ZERO_PRIVACY_POOL);
        assert(settlement_recipient.is_non_zero(), errors::ZERO_SETTLEMENT_RECIPIENT);
        assert(settlement_token.is_non_zero(), errors::ZERO_SETTLEMENT_TOKEN);
        assert(max_per_transaction.is_non_zero(), errors::ZERO_MAX_PER_TRANSACTION);
        assert(daily_limit.is_non_zero(), errors::ZERO_DAILY_LIMIT);

        self.owner.write(owner);
        self.privacy_pool.write(privacy_pool);
        self.settlement_recipient.write(settlement_recipient);
        self.settlement_token.write(settlement_token);
        self.max_per_transaction.write(max_per_transaction);
        self.daily_limit.write(daily_limit);
        self.current_day.write(get_block_timestamp() / SECONDS_PER_DAY);
        self.spent_today.write(0);
        self.frozen.write(false);
    }

    #[generate_trait]
    impl InternalImpl of InternalTrait {
        fn assert_only_owner(self: @ContractState) {
            assert(get_caller_address() == self.owner.read(), errors::NOT_OWNER);
        }
    }

    #[abi(embed_v0)]
    pub impl CardSettlementAnonymizerImpl of ICardSettlementAnonymizer<ContractState> {
        /// Intentionally callable only by the fixed privacy pool. The pool must fund this
        /// contract with `amount` of the fixed settlement token before invoking it.
        fn privacy_invoke(
            ref self: ContractState,
            authorization_id: felt252,
            token: ContractAddress,
            amount: u256,
        ) -> Span<OpenNoteDeposit> {
            assert(get_caller_address() == self.privacy_pool.read(), errors::NOT_PRIVACY_POOL);
            assert(!self.frozen.read(), errors::CONTRACT_FROZEN);
            assert(authorization_id.is_non_zero(), errors::ZERO_AUTHORIZATION_ID);
            assert(!self.used_authorization_ids.read(authorization_id), errors::AUTHORIZATION_USED);
            assert(token == self.settlement_token.read(), errors::WRONG_SETTLEMENT_TOKEN);
            assert(amount.is_non_zero(), errors::ZERO_AMOUNT);
            assert(amount <= self.max_per_transaction.read(), errors::MAX_PER_TRANSACTION_EXCEEDED);

            let day = get_block_timestamp() / SECONDS_PER_DAY;
            let spent_today = if day == self.current_day.read() {
                self.spent_today.read()
            } else {
                0
            };
            let daily_limit = self.daily_limit.read();
            assert(spent_today <= daily_limit, errors::DAILY_LIMIT_EXCEEDED);
            assert(amount <= daily_limit - spent_today, errors::DAILY_LIMIT_EXCEEDED);
            let updated_spend = spent_today + amount;
            let recipient = self.settlement_recipient.read();

            // Effects before interaction. A failed checked transfer reverts these writes.
            self.used_authorization_ids.write(authorization_id, true);
            self.current_day.write(day);
            self.spent_today.write(updated_spend);

            checked_transfer(token_address: token, :recipient, :amount);
            self
                .emit(
                    Event::AuthorizationSettled(
                        AuthorizationSettled { authorization_id, recipient, token, amount, day },
                    ),
                );

            ArrayTrait::new().span()
        }

        fn set_limits(ref self: ContractState, max_per_transaction: u256, daily_limit: u256) {
            self.assert_only_owner();
            assert(max_per_transaction.is_non_zero(), errors::ZERO_MAX_PER_TRANSACTION);
            assert(daily_limit.is_non_zero(), errors::ZERO_DAILY_LIMIT);
            self.max_per_transaction.write(max_per_transaction);
            self.daily_limit.write(daily_limit);
            self.emit(Event::LimitsUpdated(LimitsUpdated { max_per_transaction, daily_limit }));
        }

        fn set_settlement_recipient(
            ref self: ContractState, settlement_recipient: ContractAddress,
        ) {
            self.assert_only_owner();
            assert(settlement_recipient.is_non_zero(), errors::ZERO_SETTLEMENT_RECIPIENT);
            self.settlement_recipient.write(settlement_recipient);
            self
                .emit(
                    Event::SettlementRecipientUpdated(
                        SettlementRecipientUpdated { settlement_recipient },
                    ),
                );
        }

        fn set_frozen(ref self: ContractState, frozen: bool) {
            self.assert_only_owner();
            self.frozen.write(frozen);
            self.emit(Event::FrozenUpdated(FrozenUpdated { frozen }));
        }

        fn get_config(self: @ContractState) -> CardSettlementConfig {
            CardSettlementConfig {
                owner: self.owner.read(),
                privacy_pool: self.privacy_pool.read(),
                settlement_recipient: self.settlement_recipient.read(),
                settlement_token: self.settlement_token.read(),
                max_per_transaction: self.max_per_transaction.read(),
                daily_limit: self.daily_limit.read(),
                frozen: self.frozen.read(),
            }
        }

        fn is_authorization_used(self: @ContractState, authorization_id: felt252) -> bool {
            self.used_authorization_ids.read(authorization_id)
        }

        fn get_daily_spend(self: @ContractState) -> (u64, u256) {
            (self.current_day.read(), self.spent_today.read())
        }
    }
}
