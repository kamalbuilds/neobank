//! Test double for a yield position target: records deposits and emits an event so tests can
//! assert the position leg actually moved funds into the vault.

use starknet::ContractAddress;

#[starknet::interface]
pub trait IMockVault<T> {
    fn deposit(ref self: T, token: ContractAddress, amount: u256);
    fn deposited_total(self: @T) -> u256;
}

/// Emitted when the vault receives a deposit.
#[derive(Drop, starknet::Event)]
pub struct Deposited {
    pub token: ContractAddress,
    pub amount: u256,
}

#[starknet::contract]
pub mod MockVault {
    use starknet::storage::{StoragePointerReadAccess, StoragePointerWriteAccess};
    use starknet::ContractAddress;
    use super::Deposited;

    #[storage]
    struct Storage {
        deposited_total: u256,
    }

    #[event]
    #[derive(Drop, starknet::Event)]
    pub enum Event {
        Deposited: Deposited,
    }

    #[constructor]
    fn constructor(ref self: ContractState) {}

    #[abi(embed_v0)]
    pub impl MockVaultImpl of super::IMockVault<ContractState> {
        fn deposit(ref self: ContractState, token: ContractAddress, amount: u256) {
            self.deposited_total.write(self.deposited_total.read() + amount);
            self.emit(Event::Deposited(Deposited { token, amount }));
        }

        fn deposited_total(self: @ContractState) -> u256 {
            self.deposited_total.read()
        }
    }
}
