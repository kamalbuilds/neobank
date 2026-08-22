use core::num::traits::Zero;
use starknet::ContractAddress;
use crate::erc20_utils::Erc20Error;
use crate::private_payout_anonymizer::errors;
use crate::test_utils_contracts::mock_erc20::{IMockERC20Dispatcher, IMockERC20DispatcherTrait};
use crate::tests::test_utils::{
    DEFAULT_AMOUNT, PayoutHarnessTrait, assert_panic_with_felt_error, deploy_anonymizer,
    deploy_failing_mock_erc20, deploy_harness, safe_privacy_invoke_direct,
};

/// A successful payout moves exactly `amount` to the recipient and returns an EMPTY span:
/// nothing comes back into the pool, so the payout is never a screening subject.
#[test]
fn test_privacy_invoke_successful_payout() {
    let mut harness = deploy_harness();
    let amount = DEFAULT_AMOUNT;
    let dust = 7;

    // Fund the anonymizer with more than the payout to prove exactness.
    harness.mint(harness.anonymizer, amount + dust);
    assert_eq!(harness.token_balance_of(harness.anonymizer), amount + dust);
    assert_eq!(harness.token_balance_of(harness.recipient), 0);

    let deposits = harness.privacy_invoke(harness.token, harness.recipient, amount);

    // Empty span: nothing flows back into the pool.
    assert_eq!(deposits.len(), 0);

    assert_eq!(harness.token_balance_of(harness.recipient), amount);
    assert_eq!(harness.token_balance_of(harness.anonymizer), dust);
}

/// Zero token, zero recipient and zero amount are each rejected with their named error.
#[test]
fn test_privacy_invoke_assertions() {
    let mut harness = deploy_harness();
    let amount = DEFAULT_AMOUNT;

    // Catch ZERO_TOKEN.
    let result = harness.safe_privacy_invoke(Zero::zero(), harness.recipient, amount);
    assert_panic_with_felt_error(:result, expected_error: errors::ZERO_TOKEN);

    // Catch ZERO_RECIPIENT.
    let result = harness.safe_privacy_invoke(harness.token, Zero::zero(), amount);
    assert_panic_with_felt_error(:result, expected_error: errors::ZERO_RECIPIENT);

    // Catch ZERO_AMOUNT.
    let result = harness.safe_privacy_invoke(harness.token, harness.recipient, amount: 0);
    assert_panic_with_felt_error(:result, expected_error: errors::ZERO_AMOUNT);
}

/// Balance below the payout amount reverts with 'ERC20: insufficient balance' before any
/// transfer is attempted; balances stay untouched.
#[test]
fn test_privacy_invoke_insufficient_balance() {
    let mut harness = deploy_harness();
    let amount = DEFAULT_AMOUNT;

    // Fund BELOW the requested payout amount.
    harness.mint(harness.anonymizer, amount - 1);
    let result = harness.safe_privacy_invoke(harness.token, harness.recipient, amount);
    assert_panic_with_felt_error(:result, expected_error: Erc20Error::INSUFFICIENT_BALANCE);

    // Balances untouched by the reverted invoke.
    assert_eq!(harness.token_balance_of(harness.anonymizer), amount - 1);
    assert_eq!(harness.token_balance_of(harness.recipient), 0);
}

/// A token whose `transfer` returns false (without reverting) must abort the invoke with
/// 'ERC20: transfer failed': the boolean return value is asserted, never assumed true.
#[test]
fn test_privacy_invoke_false_transfer_return_panics() {
    let failing_token = deploy_failing_mock_erc20();
    let anonymizer = deploy_anonymizer();
    let recipient: ContractAddress = 'RECIPIENT'.try_into().unwrap();
    let failing_erc20 = IMockERC20Dispatcher { contract_address: failing_token };

    // The anonymizer IS funded - only the false return should make this fail.
    failing_erc20.mint(recipient: anonymizer, amount: DEFAULT_AMOUNT);
    assert_eq!(failing_erc20.balance_of(account: anonymizer), DEFAULT_AMOUNT);

    let result = safe_privacy_invoke_direct(
        :anonymizer, token: failing_token, :recipient, amount: DEFAULT_AMOUNT,
    );
    assert_panic_with_felt_error(:result, expected_error: Erc20Error::TRANSFER_FAILED);

    // Balances untouched by the reverted invoke.
    assert_eq!(failing_erc20.balance_of(account: anonymizer), DEFAULT_AMOUNT);
    assert_eq!(failing_erc20.balance_of(account: recipient), 0);
}
