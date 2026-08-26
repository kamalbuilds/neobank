//! 1:1 ERC-4626 vault for the Sepolia dinner demo.
//!
//! Shares are the vault's own token. Depositing STRK mints the same number of
//! shares; redeeming burns shares and returns STRK. This is a real lockbox, not
//! a yield simulation. On mainnet the card program helper points at a Vesu
//! vToken with this same deposit/redeem/asset surface.

use starknet::ContractAddress;

#[starknet::interface]
pub trait IEarnVault<T> {
    fn asset(self: @T) -> ContractAddress;
    fn deposit(ref self: T, assets: u256, receiver: ContractAddress) -> u256;
    fn redeem(
        ref self: T, shares: u256, receiver: ContractAddress, owner: ContractAddress,
    ) -> u256;
    fn balance_of(self: @T, account: ContractAddress) -> u256;
    fn allowance(self: @T, owner: ContractAddress, spender: ContractAddress) -> u256;
    fn approve(ref self: T, spender: ContractAddress, amount: u256) -> bool;
    fn transfer(ref self: T, recipient: ContractAddress, amount: u256) -> bool;
    fn transfer_from(
        ref self: T, sender: ContractAddress, recipient: ContractAddress, amount: u256,
    ) -> bool;
    fn total_assets(self: @T) -> u256;
    fn total_supply(self: @T) -> u256;
}

#[starknet::contract]
pub mod EarnVault {
    use core::num::traits::Zero;
    use openzeppelin::interfaces::token::erc20::{IERC20Dispatcher, IERC20DispatcherTrait};
    use starknet::storage::{
        Map, StorageMapReadAccess, StorageMapWriteAccess, StoragePointerReadAccess,
        StoragePointerWriteAccess,
    };
    use starknet::{ContractAddress, get_caller_address, get_contract_address};

    pub mod errors {
        pub const ZERO_ASSET: felt252 = 'ZERO_ASSET';
        pub const ZERO_ASSETS: felt252 = 'ZERO_ASSETS';
        pub const ZERO_SHARES: felt252 = 'ZERO_SHARES';
        pub const INSUFFICIENT_SHARES: felt252 = 'INSUFFICIENT_SHARES';
        pub const INSUFFICIENT_ALLOWANCE: felt252 = 'INSUFFICIENT_ALLOWANCE';
        pub const PULL_FAILED: felt252 = 'PULL_FAILED';
        pub const PUSH_FAILED: felt252 = 'PUSH_FAILED';
    }

    #[storage]
    struct Storage {
        asset: ContractAddress,
        total_supply: u256,
        balances: Map<ContractAddress, u256>,
        allowances: Map<(ContractAddress, ContractAddress), u256>,
    }

    #[constructor]
    pub(crate) fn constructor(ref self: ContractState, asset: ContractAddress) {
        assert(asset.is_non_zero(), errors::ZERO_ASSET);
        self.asset.write(asset);
    }

    #[generate_trait]
    impl InternalImpl of InternalTrait {
        fn _mint(ref self: ContractState, recipient: ContractAddress, amount: u256) {
            self.total_supply.write(self.total_supply.read() + amount);
            self.balances.write(recipient, self.balances.read(recipient) + amount);
        }

        fn _burn(ref self: ContractState, owner: ContractAddress, amount: u256) {
            let balance = self.balances.read(owner);
            assert(balance >= amount, errors::INSUFFICIENT_SHARES);
            self.balances.write(owner, balance - amount);
            self.total_supply.write(self.total_supply.read() - amount);
        }

        fn _spend_allowance(
            ref self: ContractState, owner: ContractAddress, spender: ContractAddress, amount: u256,
        ) {
            if owner == spender {
                return;
            }
            let key = (owner, spender);
            let allowed = self.allowances.read(key);
            assert(allowed >= amount, errors::INSUFFICIENT_ALLOWANCE);
            self.allowances.write(key, allowed - amount);
        }
    }

    #[abi(embed_v0)]
    pub impl EarnVaultImpl of super::IEarnVault<ContractState> {
        fn asset(self: @ContractState) -> ContractAddress {
            self.asset.read()
        }

        fn deposit(ref self: ContractState, assets: u256, receiver: ContractAddress) -> u256 {
            assert(assets.is_non_zero(), errors::ZERO_ASSETS);
            let underlying = IERC20Dispatcher { contract_address: self.asset.read() };
            let pulled = underlying
                .transfer_from(
                    sender: get_caller_address(), recipient: get_contract_address(), amount: assets,
                );
            assert(pulled, errors::PULL_FAILED);
            self._mint(receiver, assets);
            assets
        }

        fn redeem(
            ref self: ContractState,
            shares: u256,
            receiver: ContractAddress,
            owner: ContractAddress,
        ) -> u256 {
            assert(shares.is_non_zero(), errors::ZERO_SHARES);
            self._spend_allowance(owner, get_caller_address(), shares);
            self._burn(owner, shares);
            let underlying = IERC20Dispatcher { contract_address: self.asset.read() };
            let sent = underlying.transfer(recipient: receiver, amount: shares);
            assert(sent, errors::PUSH_FAILED);
            shares
        }

        fn balance_of(self: @ContractState, account: ContractAddress) -> u256 {
            self.balances.read(account)
        }

        fn allowance(
            self: @ContractState, owner: ContractAddress, spender: ContractAddress,
        ) -> u256 {
            self.allowances.read((owner, spender))
        }

        fn approve(ref self: ContractState, spender: ContractAddress, amount: u256) -> bool {
            self.allowances.write((get_caller_address(), spender), amount);
            true
        }

        fn transfer(ref self: ContractState, recipient: ContractAddress, amount: u256) -> bool {
            let caller = get_caller_address();
            let balance = self.balances.read(caller);
            assert(balance >= amount, errors::INSUFFICIENT_SHARES);
            self.balances.write(caller, balance - amount);
            self.balances.write(recipient, self.balances.read(recipient) + amount);
            true
        }

        fn transfer_from(
            ref self: ContractState,
            sender: ContractAddress,
            recipient: ContractAddress,
            amount: u256,
        ) -> bool {
            self._spend_allowance(sender, get_caller_address(), amount);
            let balance = self.balances.read(sender);
            assert(balance >= amount, errors::INSUFFICIENT_SHARES);
            self.balances.write(sender, balance - amount);
            self.balances.write(recipient, self.balances.read(recipient) + amount);
            true
        }

        fn total_assets(self: @ContractState) -> u256 {
            IERC20Dispatcher { contract_address: self.asset.read() }
                .balance_of(account: get_contract_address())
        }

        fn total_supply(self: @ContractState) -> u256 {
            self.total_supply.read()
        }
    }
}
