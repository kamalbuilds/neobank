//! Forwards ProgrammableSpendAnonymizer's `deposit(token, amount)` into an
//! ERC-4626 vault. Tokens already sit on this contract from the anonymizer's
//! checked transfer.

use starknet::ContractAddress;

#[starknet::interface]
pub trait IEarnAdapter<T> {
    fn deposit(ref self: T, token: ContractAddress, amount: u256);
    fn vault(self: @T) -> ContractAddress;
}

#[starknet::interface]
pub trait IVaultDeposit<T> {
    fn deposit(ref self: T, assets: u256, receiver: ContractAddress) -> u256;
}

#[starknet::contract]
pub mod EarnAdapter {
    use core::num::traits::Zero;
    use openzeppelin::interfaces::token::erc20::{IERC20Dispatcher, IERC20DispatcherTrait};
    use starknet::storage::{StoragePointerReadAccess, StoragePointerWriteAccess};
    use starknet::{ContractAddress, get_contract_address};
    use super::{IEarnAdapter, IVaultDepositDispatcher, IVaultDepositDispatcherTrait};

    pub mod errors {
        pub const ZERO_VAULT: felt252 = 'ZERO_VAULT';
        pub const ZERO_TOKEN: felt252 = 'ZERO_TOKEN';
        pub const ZERO_AMOUNT: felt252 = 'ZERO_AMOUNT';
        pub const APPROVE_FAILED: felt252 = 'APPROVE_FAILED';
    }

    #[storage]
    struct Storage {
        vault: ContractAddress,
    }

    #[constructor]
    pub(crate) fn constructor(ref self: ContractState, vault: ContractAddress) {
        assert(vault.is_non_zero(), errors::ZERO_VAULT);
        self.vault.write(vault);
    }

    #[abi(embed_v0)]
    pub impl EarnAdapterImpl of IEarnAdapter<ContractState> {
        /// Public: only useful after the privacy helper has already funded this
        /// contract in the same transaction.
        fn deposit(ref self: ContractState, token: ContractAddress, amount: u256) {
            assert(token.is_non_zero(), errors::ZERO_TOKEN);
            assert(amount.is_non_zero(), errors::ZERO_AMOUNT);
            let vault = self.vault.read();
            let erc20 = IERC20Dispatcher { contract_address: token };
            let approved = erc20.approve(spender: vault, amount: amount);
            assert(approved, errors::APPROVE_FAILED);
            IVaultDepositDispatcher { contract_address: vault }
                .deposit(amount, get_contract_address());
        }

        fn vault(self: @ContractState) -> ContractAddress {
            self.vault.read()
        }
    }
}
