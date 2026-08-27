//! Test double for a DEX router: pulls `sell_amount` of the sell token from
//! the caller via `transfer_from` and delivers a configured or ratio-derived
//! amount of the buy token back to the caller.
//!
//! Used by the JitConverter tests to stand in for the AVNU Sepolia router:
//! real quoting lives off chain, so on-chain tests only need "a contract that
//! takes the approval and returns tokens".

use starknet::ContractAddress;

#[starknet::interface]
pub trait IMockRouter<T> {
    fn swap(ref self: T, token: ContractAddress, other_token: ContractAddress, sell_amount: u256) -> u256;
    fn set_rate(ref self: T, numerator: u256, denominator: u256);
    fn rate_numerator(self: @T) -> u256;
    fn rate_denominator(self: @T) -> u256;
    fn pulled_total(self: @T) -> u256;
}

/// Emitted when the router completes an exchange.
#[derive(Drop, starknet::Event)]
pub struct Swapped {
    pub seller: ContractAddress,
    pub sold_token: ContractAddress,
    pub bought_token: ContractAddress,
    pub sold_amount: u256,
    pub bought_amount: u256,
}

#[starknet::contract]
pub mod MockRouter {
    use core::num::traits::Zero;
    use starknet::storage::{StoragePointerReadAccess, StoragePointerWriteAccess};
    use starknet::{ContractAddress, get_caller_address, get_contract_address};
    use openzeppelin::interfaces::token::erc20::{IERC20Dispatcher, IERC20DispatcherTrait};
    use super::Swapped;

    /// Returns `x * numerator / denominator`, rounding down.
    fn mul_div(x: u256, numerator: u256, denominator: u256) -> u256 {
        let SHIFT: u256 = 340282366920938463463374607431768211456; // 2^128
        let x_hi: u256 = (x / SHIFT) * numerator;
        let x_lo: u256 = (x % SHIFT) * numerator;
        // hi_part cannot overflow: x/2^128 * num < 2^128 keeps the product under 2^256.
        (x_hi * SHIFT + x_lo) / denominator
    }

    #[storage]
    struct Storage {
        rate_numerator: u256,
        rate_denominator: u256,
        pulled_total: u256,
    }

    #[event]
    #[derive(Drop, starknet::Event)]
    pub enum Event {
        Swapped: Swapped,
    }

    #[constructor]
    fn constructor(ref self: ContractState) {
        self.rate_numerator.write(1);
        self.rate_denominator.write(1);
    }

    #[abi(embed_v0)]
    pub impl MockRouterImpl of super::IMockRouter<ContractState> {
        /// Takes `sell_amount` from the caller out of `token` and pays back
        /// `rate * sell_amount` of `other_token` from the router's own float.
        fn swap(
            ref self: ContractState,
            token: ContractAddress,
            other_token: ContractAddress,
            sell_amount: u256,
        ) -> u256 {
            let buyer = get_caller_address();
            let pulled = IERC20Dispatcher { contract_address: token }.transfer_from(
                sender: buyer, recipient: get_contract_address(), amount: sell_amount,
            );
            assert(pulled, 'router: transferFrom failed');
            let bought = mul_div(sell_amount, self.rate_numerator.read(), self.rate_denominator.read());
            if bought.is_zero() {
                return 0;
            }
            let paid = IERC20Dispatcher { contract_address: other_token }
                .transfer(recipient: buyer, amount: bought);
            assert(paid, 'router: empty float');
            self.pulled_total.write(self.pulled_total.read() + sell_amount);
            self.emit(
                Event::Swapped(
                    Swapped {
                        seller: buyer,
                        sold_token: token,
                        bought_token: other_token,
                        sold_amount: sell_amount,
                        bought_amount: bought,
                    },
                ),
            );
            bought
        }

        fn set_rate(ref self: ContractState, numerator: u256, denominator: u256) {
            self.rate_numerator.write(numerator);
            self.rate_denominator.write(denominator);
        }

        fn rate_numerator(self: @ContractState) -> u256 {
            self.rate_numerator.read()
        }

        fn rate_denominator(self: @ContractState) -> u256 {
            self.rate_denominator.read()
        }

        fn pulled_total(self: @ContractState) -> u256 {
            self.pulled_total.read()
        }
    }
}
