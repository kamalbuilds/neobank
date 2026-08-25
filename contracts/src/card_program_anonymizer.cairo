//! Card program helper: settle a swipe and optionally open or spend a yield
//! position in the same STRK20 `privacy_invoke`.
//!
//! One pool invoke, two public legs the merchant and the vault can see:
//! the acquirer is paid, and `lend_amount` is deposited into a pinned ERC-4626
//! vault (Vesu vToken on mainnet, EarnVault on Sepolia). Share tokens return
//! as an open note so the position stays in the pool. Paying from the position
//! is the reverse: vToken in, redeem, pay the acquirer, leftover underlying
//! back to an open note.
//!
//! Replay, freeze, per-swipe and daily limits apply to the settlement amount
//! only. The lend is extra private routing, not a card-network spend.

use starknet::ContractAddress;
use crate::objects::OpenNoteDeposit;

pub mod errors {
    pub const ZERO_OWNER: felt252 = 'ZERO_OWNER';
    pub const ZERO_PRIVACY_POOL: felt252 = 'ZERO_PRIVACY_POOL';
    pub const ZERO_SETTLEMENT_RECIPIENT: felt252 = 'ZERO_SETTLEMENT_RECIPIENT';
    pub const ZERO_SETTLEMENT_TOKEN: felt252 = 'ZERO_SETTLEMENT_TOKEN';
    pub const ZERO_VAULT: felt252 = 'ZERO_VAULT';
    pub const ZERO_MAX_PER_TRANSACTION: felt252 = 'ZERO_MAX_PER_TX';
    pub const ZERO_DAILY_LIMIT: felt252 = 'ZERO_DAILY_LIMIT';
    pub const NOT_PRIVACY_POOL: felt252 = 'NOT_PRIVACY_POOL';
    pub const CONTRACT_FROZEN: felt252 = 'CONTRACT_FROZEN';
    pub const ZERO_AUTHORIZATION_ID: felt252 = 'ZERO_AUTHORIZATION_ID';
    pub const AUTHORIZATION_USED: felt252 = 'AUTHORIZATION_USED';
    pub const WRONG_TOKEN: felt252 = 'WRONG_TOKEN';
    pub const ZERO_AMOUNT: felt252 = 'ZERO_AMOUNT';
    pub const MAX_PER_TRANSACTION_EXCEEDED: felt252 = 'MAX_PER_TX_EXCEEDED';
    pub const DAILY_LIMIT_EXCEEDED: felt252 = 'DAILY_LIMIT_EXCEEDED';
    pub const NOTE_REQUIRED: felt252 = 'NOTE_REQUIRED';
    pub const NOTE_FORBIDDEN: felt252 = 'NOTE_FORBIDDEN';
    pub const RECEIVED_AMOUNT_OVERFLOW: felt252 = 'RECEIVED_AMOUNT_OVERFLOW';
    pub const ZERO_OUT_AMOUNT: felt252 = 'ZERO_OUT_AMOUNT';
    pub const REDEEM_TOO_SMALL: felt252 = 'REDEEM_TOO_SMALL';
    pub const NOT_OWNER: felt252 = 'NOT_OWNER';
}

#[derive(Serde, Copy, Drop, PartialEq, Debug)]
pub struct CardProgramConfig {
    pub owner: ContractAddress,
    pub privacy_pool: ContractAddress,
    pub settlement_recipient: ContractAddress,
    pub settlement_token: ContractAddress,
    pub vault: ContractAddress,
    pub max_per_transaction: u256,
    pub daily_limit: u256,
    pub frozen: bool,
}

#[starknet::interface]
pub trait IEarnVaultToken<T> {
    fn deposit(ref self: T, assets: u256, receiver: ContractAddress) -> u256;
    fn redeem(
        ref self: T, shares: u256, receiver: ContractAddress, owner: ContractAddress,
    ) -> u256;
}

#[starknet::interface]
pub trait ICardProgramAnonymizer<T> {
    fn privacy_invoke(
        ref self: T,
        authorization_id: felt252,
        token: ContractAddress,
        settle_amount: u256,
        program_amount: u256,
        note_id: felt252,
    ) -> Span<OpenNoteDeposit>;
    fn set_limits(ref self: T, max_per_transaction: u256, daily_limit: u256);
    fn set_settlement_recipient(ref self: T, settlement_recipient: ContractAddress);
    fn set_frozen(ref self: T, frozen: bool);
    fn get_config(self: @T) -> CardProgramConfig;
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
pub struct PositionOpened {
    #[key]
    pub authorization_id: felt252,
    pub vault: ContractAddress,
    pub assets: u256,
    pub shares: u256,
}

#[derive(Drop, starknet::Event)]
pub struct PositionRedeemed {
    #[key]
    pub authorization_id: felt252,
    pub vault: ContractAddress,
    pub shares: u256,
    pub assets: u256,
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
pub mod CardProgramAnonymizer {
    use core::num::traits::Zero;
    use openzeppelin::interfaces::token::erc20::{IERC20Dispatcher, IERC20DispatcherTrait};
    use starknet::storage::{
        Map, StorageMapReadAccess, StorageMapWriteAccess, StoragePointerReadAccess,
        StoragePointerWriteAccess,
    };
    use starknet::{ContractAddress, get_block_timestamp, get_caller_address, get_contract_address};
    use crate::erc20_utils::checked_transfer;
    use crate::objects::OpenNoteDeposit;
    use super::{
        AuthorizationSettled, CardProgramConfig, FrozenUpdated, ICardProgramAnonymizer,
        IEarnVaultTokenDispatcher, IEarnVaultTokenDispatcherTrait, LimitsUpdated, PositionOpened,
        PositionRedeemed, SettlementRecipientUpdated, errors,
    };

    const SECONDS_PER_DAY: u64 = 86_400;

    #[storage]
    struct Storage {
        owner: ContractAddress,
        privacy_pool: ContractAddress,
        settlement_recipient: ContractAddress,
        settlement_token: ContractAddress,
        vault: ContractAddress,
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
        PositionOpened: super::PositionOpened,
        PositionRedeemed: super::PositionRedeemed,
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
        vault: ContractAddress,
        max_per_transaction: u256,
        daily_limit: u256,
    ) {
        assert(owner.is_non_zero(), errors::ZERO_OWNER);
        assert(privacy_pool.is_non_zero(), errors::ZERO_PRIVACY_POOL);
        assert(settlement_recipient.is_non_zero(), errors::ZERO_SETTLEMENT_RECIPIENT);
        assert(settlement_token.is_non_zero(), errors::ZERO_SETTLEMENT_TOKEN);
        assert(vault.is_non_zero(), errors::ZERO_VAULT);
        assert(max_per_transaction.is_non_zero(), errors::ZERO_MAX_PER_TRANSACTION);
        assert(daily_limit.is_non_zero(), errors::ZERO_DAILY_LIMIT);

        self.owner.write(owner);
        self.privacy_pool.write(privacy_pool);
        self.settlement_recipient.write(settlement_recipient);
        self.settlement_token.write(settlement_token);
        self.vault.write(vault);
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

        fn assert_card_policy(ref self: ContractState, authorization_id: felt252, settle_amount: u256) {
            assert(get_caller_address() == self.privacy_pool.read(), errors::NOT_PRIVACY_POOL);
            assert(!self.frozen.read(), errors::CONTRACT_FROZEN);
            assert(authorization_id.is_non_zero(), errors::ZERO_AUTHORIZATION_ID);
            assert(!self.used_authorization_ids.read(authorization_id), errors::AUTHORIZATION_USED);
            assert(settle_amount.is_non_zero(), errors::ZERO_AMOUNT);
            assert(
                settle_amount <= self.max_per_transaction.read(),
                errors::MAX_PER_TRANSACTION_EXCEEDED,
            );

            let day = get_block_timestamp() / SECONDS_PER_DAY;
            let spent_today = if day == self.current_day.read() {
                self.spent_today.read()
            } else {
                0
            };
            let daily_limit = self.daily_limit.read();
            assert(spent_today <= daily_limit, errors::DAILY_LIMIT_EXCEEDED);
            assert(settle_amount <= daily_limit - spent_today, errors::DAILY_LIMIT_EXCEEDED);

            self.used_authorization_ids.write(authorization_id, true);
            self.current_day.write(day);
            self.spent_today.write(spent_today + settle_amount);
        }

        fn emit_settled(
            ref self: ContractState, authorization_id: felt252, token: ContractAddress, amount: u256,
        ) {
            let recipient = self.settlement_recipient.read();
            self
                .emit(
                    Event::AuthorizationSettled(
                        AuthorizationSettled {
                            authorization_id,
                            recipient,
                            token,
                            amount,
                            day: self.current_day.read(),
                        },
                    ),
                );
        }
    }

    #[abi(embed_v0)]
    pub impl CardProgramAnonymizerImpl of ICardProgramAnonymizer<ContractState> {
        /// Public because the privacy pool is the only allowed caller. The pool
        /// check is the access posture.
        fn privacy_invoke(
            ref self: ContractState,
            authorization_id: felt252,
            token: ContractAddress,
            settle_amount: u256,
            program_amount: u256,
            note_id: felt252,
        ) -> Span<OpenNoteDeposit> {
            self.assert_card_policy(authorization_id, settle_amount);
            let vault = self.vault.read();
            let settlement_token = self.settlement_token.read();
            let recipient = self.settlement_recipient.read();
            let self_addr = get_contract_address();
            let pool = self.privacy_pool.read();

            if token == vault {
                assert(note_id.is_non_zero(), errors::NOTE_REQUIRED);
                let vault_erc20 = IERC20Dispatcher { contract_address: vault };
                let shares = if program_amount.is_non_zero() {
                    program_amount
                } else {
                    vault_erc20.balance_of(account: self_addr)
                };
                assert(shares.is_non_zero(), errors::ZERO_AMOUNT);

                let underlying = IERC20Dispatcher { contract_address: settlement_token };
                let before = underlying.balance_of(account: self_addr);
                IEarnVaultTokenDispatcher { contract_address: vault }
                    .redeem(shares, self_addr, self_addr);
                let redeemed: u128 = (underlying.balance_of(account: self_addr) - before)
                    .try_into()
                    .expect(errors::RECEIVED_AMOUNT_OVERFLOW);
                assert(redeemed.is_non_zero(), errors::ZERO_OUT_AMOUNT);
                let redeemed_u256: u256 = redeemed.into();
                assert(redeemed_u256 >= settle_amount, errors::REDEEM_TOO_SMALL);

                checked_transfer(
                    token_address: settlement_token, :recipient, amount: settle_amount,
                );
                self.emit_settled(authorization_id, settlement_token, settle_amount);
                self
                    .emit(
                        Event::PositionRedeemed(
                            PositionRedeemed {
                                authorization_id, vault, shares, assets: redeemed_u256,
                            },
                        ),
                    );

                let leftover = redeemed_u256 - settle_amount;
                if leftover.is_zero() {
                    return ArrayTrait::new().span();
                }
                let leftover_u128: u128 = leftover
                    .try_into()
                    .expect(errors::RECEIVED_AMOUNT_OVERFLOW);
                let approved = underlying.approve(spender: pool, amount: leftover);
                assert(approved, errors::ZERO_OUT_AMOUNT);
                return array![
                    OpenNoteDeposit {
                        note_id, token: settlement_token, amount: leftover_u128,
                    },
                ]
                    .span();
            }

            assert(token == settlement_token, errors::WRONG_TOKEN);
            checked_transfer(token_address: token, :recipient, amount: settle_amount);
            self.emit_settled(authorization_id, token, settle_amount);

            if program_amount.is_zero() {
                assert(note_id.is_zero(), errors::NOTE_FORBIDDEN);
                return ArrayTrait::new().span();
            }

            assert(note_id.is_non_zero(), errors::NOTE_REQUIRED);
            let underlying = IERC20Dispatcher { contract_address: token };
            let share_token = IERC20Dispatcher { contract_address: vault };
            let approved = underlying.approve(spender: vault, amount: program_amount);
            assert(approved, errors::ZERO_OUT_AMOUNT);
            let before = share_token.balance_of(account: self_addr);
            IEarnVaultTokenDispatcher { contract_address: vault }
                .deposit(program_amount, self_addr);
            let shares: u128 = (share_token.balance_of(account: self_addr) - before)
                .try_into()
                .expect(errors::RECEIVED_AMOUNT_OVERFLOW);
            assert(shares.is_non_zero(), errors::ZERO_OUT_AMOUNT);
            let share_u256: u256 = shares.into();
            let share_approved = share_token.approve(spender: pool, amount: share_u256);
            assert(share_approved, errors::ZERO_OUT_AMOUNT);
            self
                .emit(
                    Event::PositionOpened(
                        PositionOpened {
                            authorization_id, vault, assets: program_amount, shares: share_u256,
                        },
                    ),
                );
            array![OpenNoteDeposit { note_id, token: vault, amount: shares }].span()
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

        fn get_config(self: @ContractState) -> CardProgramConfig {
            CardProgramConfig {
                owner: self.owner.read(),
                privacy_pool: self.privacy_pool.read(),
                settlement_recipient: self.settlement_recipient.read(),
                settlement_token: self.settlement_token.read(),
                vault: self.vault.read(),
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
