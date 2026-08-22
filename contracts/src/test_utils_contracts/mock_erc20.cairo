//! Hand-written minimal STRK20 (ERC20) mocks for local testing only. No external token
//! implementation is trusted; both variants implement the same interface so tests can swap
//! them freely.
//!
//! - `MockERC20`: standard behavior - `transfer` moves balances and returns true, reverting
//!   on insufficient balance.
//! - `MockERC20FailingTransfer`: adversarial - `transfer` returns FALSE and changes nothing,
//!   modeling tokens whose silent failure must be caught by the caller's checked transfer
//!   (the boolean return value must never be assumed true).

use starknet::ContractAddress;

/// Standard ERC20 surface shared by both mock variants, plus a test-only permissionless
/// `mint` so tests can fund arbitrary addresses.
#[starknet::interface]
pub trait IMockERC20<T> {
    fn name(self: @T) -> ByteArray;
    fn symbol(self: @T) -> ByteArray;
    fn decimals(self: @T) -> u8;
    fn total_supply(self: @T) -> u256;
    fn balance_of(self: @T, account: ContractAddress) -> u256;
    fn allowance(self: @T, owner: ContractAddress, spender: ContractAddress) -> u256;
    fn approve(ref self: T, spender: ContractAddress, amount: u256) -> bool;
    fn transfer(ref self: T, recipient: ContractAddress, amount: u256) -> bool;
    fn transfer_from(
        ref self: T, sender: ContractAddress, recipient: ContractAddress, amount: u256,
    ) -> bool;
    fn mint(ref self: T, recipient: ContractAddress, amount: u256);
}

/// Standard-behavior mock token.
#[starknet::contract]
pub mod MockERC20 {
    use starknet::storage::{
        Map, StorageMapReadAccess, StorageMapWriteAccess, StoragePointerReadAccess,
        StoragePointerWriteAccess,
    };
    use starknet::{ContractAddress, get_caller_address};

    #[storage]
    struct Storage {
        name: ByteArray,
        symbol: ByteArray,
        decimals: u8,
        total_supply: u256,
        balances: Map<ContractAddress, u256>,
        allowances: Map<(ContractAddress, ContractAddress), u256>,
    }

    #[constructor]
    fn constructor(
        ref self: ContractState,
        name: ByteArray,
        symbol: ByteArray,
        decimals: u8,
        initial_supply: u256,
        owner: ContractAddress,
    ) {
        self.name.write(name);
        self.symbol.write(symbol);
        self.decimals.write(decimals);
        self._mint(owner, initial_supply);
    }

    #[generate_trait]
    impl InternalImpl of InternalTrait {
        fn _mint(ref self: ContractState, recipient: ContractAddress, amount: u256) {
            self.total_supply.write(self.total_supply.read() + amount);
            self.balances.write(recipient, self.balances.read(recipient) + amount);
        }

        fn _transfer(
            ref self: ContractState,
            sender: ContractAddress,
            recipient: ContractAddress,
            amount: u256,
        ) {
            let sender_balance = self.balances.read(sender);
            assert(sender_balance >= amount, 'ERC20: insufficient balance');
            self.balances.write(sender, sender_balance - amount);
            self.balances.write(recipient, self.balances.read(recipient) + amount);
        }
    }

    #[abi(embed_v0)]
    impl MockERC20Impl of super::IMockERC20<ContractState> {
        fn name(self: @ContractState) -> ByteArray {
            self.name.read()
        }

        fn symbol(self: @ContractState) -> ByteArray {
            self.symbol.read()
        }

        fn decimals(self: @ContractState) -> u8 {
            self.decimals.read()
        }

        fn total_supply(self: @ContractState) -> u256 {
            self.total_supply.read()
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
            self._transfer(get_caller_address(), :recipient, :amount);
            true
        }

        fn transfer_from(
            ref self: ContractState,
            sender: ContractAddress,
            recipient: ContractAddress,
            amount: u256,
        ) -> bool {
            let caller = get_caller_address();
            let allowance = self.allowances.read((sender, caller));
            assert(allowance >= amount, 'ERC20: insufficient allowance');
            self.allowances.write((sender, caller), allowance - amount);
            self._transfer(:sender, :recipient, :amount);
            true
        }

        fn mint(ref self: ContractState, recipient: ContractAddress, amount: u256) {
            self._mint(:recipient, :amount);
        }
    }
}

/// Adversarial mock token: `transfer` and `transfer_from` return FALSE and change nothing,
/// without reverting. Used to prove the anonymizer asserts the boolean result instead of
/// assuming success.
#[starknet::contract]
pub mod MockERC20FailingTransfer {
    use starknet::ContractAddress;
    use starknet::storage::{
        Map, StorageMapReadAccess, StorageMapWriteAccess, StoragePointerReadAccess,
        StoragePointerWriteAccess,
    };

    #[storage]
    struct Storage {
        name: ByteArray,
        symbol: ByteArray,
        decimals: u8,
        total_supply: u256,
        balances: Map<ContractAddress, u256>,
    }

    #[constructor]
    fn constructor(
        ref self: ContractState,
        name: ByteArray,
        symbol: ByteArray,
        decimals: u8,
        initial_supply: u256,
        owner: ContractAddress,
    ) {
        self.name.write(name);
        self.symbol.write(symbol);
        self.decimals.write(decimals);
        self._mint(owner, initial_supply);
    }

    #[generate_trait]
    impl InternalImpl of InternalTrait {
        fn _mint(ref self: ContractState, recipient: ContractAddress, amount: u256) {
            self.total_supply.write(self.total_supply.read() + amount);
            self.balances.write(recipient, self.balances.read(recipient) + amount);
        }
    }

    #[abi(embed_v0)]
    impl MockERC20FailingTransferImpl of super::IMockERC20<ContractState> {
        fn name(self: @ContractState) -> ByteArray {
            self.name.read()
        }

        fn symbol(self: @ContractState) -> ByteArray {
            self.symbol.read()
        }

        fn decimals(self: @ContractState) -> u8 {
            self.decimals.read()
        }

        fn total_supply(self: @ContractState) -> u256 {
            self.total_supply.read()
        }

        fn balance_of(self: @ContractState, account: ContractAddress) -> u256 {
            self.balances.read(account)
        }

        fn allowance(
            self: @ContractState, owner: ContractAddress, spender: ContractAddress,
        ) -> u256 {
            0
        }

        fn approve(ref self: ContractState, spender: ContractAddress, amount: u256) -> bool {
            true
        }

        fn transfer(ref self: ContractState, recipient: ContractAddress, amount: u256) -> bool {
            false
        }

        fn transfer_from(
            ref self: ContractState,
            sender: ContractAddress,
            recipient: ContractAddress,
            amount: u256,
        ) -> bool {
            false
        }

        fn mint(ref self: ContractState, recipient: ContractAddress, amount: u256) {
            self._mint(:recipient, :amount);
        }
    }
}
