//! Checked STRK20/ERC20 transfer helpers.
//!
//! Mirrors `starkware_utils::erc20::erc20_utils::checked_transfer`: never trust the token
//! alone - assert the pre-transfer balance and assert the boolean result of `transfer`,
//! because tokens may fail by reverting, by returning false, or both.

use openzeppelin::interfaces::token::erc20::{IERC20Dispatcher, IERC20DispatcherTrait};
use starknet::{ContractAddress, get_contract_address};

/// Error strings emitted on failed checked transfers (felt short strings so they surface as
/// single-felt panic data).
pub mod Erc20Error {
    pub const INSUFFICIENT_BALANCE: felt252 = 'ERC20: insufficient balance';
    pub const TRANSFER_FAILED: felt252 = 'ERC20: transfer failed';
}

/// Transfers `amount` of the token at `token_address` to `recipient`.
///
/// Reverts with [`Erc20Error::INSUFFICIENT_BALANCE`] if the calling contract holds less than
/// `amount`, and with [`Erc20Error::TRANSFER_FAILED`] if the token's `transfer` returns false.
/// The boolean return value is asserted, never assumed true.
pub fn checked_transfer(token_address: ContractAddress, recipient: ContractAddress, amount: u256) {
    let erc20 = IERC20Dispatcher { contract_address: token_address };
    // Plain-form asserts keep the error as SINGLE-FELT panic data (a `"{}"`-format assert
    // would panic through panic_with_byte_array and serialize the message instead).
    assert(
        amount <= erc20.balance_of(account: get_contract_address()),
        Erc20Error::INSUFFICIENT_BALANCE,
    );
    let success = erc20.transfer(recipient: recipient, :amount);
    assert(success, Erc20Error::TRANSFER_FAILED);
}
