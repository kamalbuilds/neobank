use snforge_std::{DeclareResultTrait, declare};
use starknet::deployment::DeploymentParams;
use starknet::{ContractAddress, SyscallResultTrait};
use crate::objects::OpenNoteDeposit;
use crate::private_spend_anonymizer::{
    IPrivateSpendAnonymizerDispatcher, IPrivateSpendAnonymizerDispatcherTrait,
    IPrivateSpendAnonymizerSafeDispatcher, IPrivateSpendAnonymizerSafeDispatcherTrait,
    PrivateSpendAnonymizer, errors,
};
use crate::test_utils_contracts::mock_erc20::{IMockERC20Dispatcher, IMockERC20DispatcherTrait};
use crate::tests::test_utils::{DEFAULT_AMOUNT, assert_panic_with_felt_error};

const NOTE_ID: felt252 = 'NOTE_ID';

#[derive(Drop, Copy)]
struct SpendHarness {
    token: ContractAddress,
    recipient: ContractAddress,
    anonymizer: ContractAddress,
}

fn deploy_spend_anonymizer() -> ContractAddress {
    let class_hash = declare(contract: "PrivateSpendAnonymizer")
        .unwrap_syscall()
        .contract_class()
        .class_hash;
    let deployment_params = DeploymentParams { salt: 2, deploy_from_zero: true };
    let (address, _) = PrivateSpendAnonymizer::deploy_for_test(
        class_hash: *class_hash, :deployment_params,
    )
        .expect('Spend anonymizer deploy failed');
    address
}

fn deploy_mock_erc20_for_spend() -> ContractAddress {
    use crate::test_utils_contracts::mock_erc20::MockERC20;
    let class_hash = declare(contract: "MockERC20").unwrap_syscall().contract_class().class_hash;
    let deployment_params = DeploymentParams { salt: 3, deploy_from_zero: true };
    let (address, _) = MockERC20::deploy_for_test(
        class_hash: *class_hash,
        :deployment_params,
        name: "MockERC20",
        symbol: "MCK",
        decimals: 18,
        initial_supply: 0,
        owner: 'TOKEN_OWNER'.try_into().unwrap(),
    )
        .expect('MockERC20 deploy failed');
    address
}

fn deploy_harness() -> SpendHarness {
    SpendHarness {
        token: deploy_mock_erc20_for_spend(),
        recipient: 'SPEND_RECIPIENT'.try_into().unwrap(),
        anonymizer: deploy_spend_anonymizer(),
    }
}

fn mint(harness: SpendHarness, to: ContractAddress, amount: u256) {
    IMockERC20Dispatcher { contract_address: harness.token }.mint(recipient: to, :amount);
}

fn balance_of(harness: SpendHarness, account: ContractAddress) -> u256 {
    IMockERC20Dispatcher { contract_address: harness.token }.balance_of(account: account)
}

fn invoke(
    harness: SpendHarness, pay_amount: u256, funded: u256, note_id: felt252,
) -> Span<OpenNoteDeposit> {
    IPrivateSpendAnonymizerDispatcher { contract_address: harness.anonymizer }
        .privacy_invoke(
            token: harness.token,
            recipient: harness.recipient,
            :pay_amount,
            :funded,
            :note_id,
        )
}

#[feature("safe_dispatcher")]
fn safe_invoke(
    harness: SpendHarness,
    token: ContractAddress,
    recipient: ContractAddress,
    pay_amount: u256,
    funded: u256,
    note_id: felt252,
) -> Result<Span<OpenNoteDeposit>, Array<felt252>> {
    IPrivateSpendAnonymizerSafeDispatcher { contract_address: harness.anonymizer }
        .privacy_invoke(:token, :recipient, :pay_amount, :funded, :note_id)
}

/// The whole point: the recipient is paid AND the change comes back as one deposit, in a
/// single call. Two transactions would publish the change and pay the pool fee twice.
#[test]
fn test_pays_recipient_and_returns_change() {
    let harness = deploy_harness();
    let funded = DEFAULT_AMOUNT;
    let pay = DEFAULT_AMOUNT / 4;
    mint(harness, harness.anonymizer, funded);

    let deposits = invoke(harness, pay, funded, NOTE_ID);

    assert_eq!(balance_of(harness, harness.recipient), pay);
    assert_eq!(deposits.len(), 1);
    let OpenNoteDeposit { note_id, token, amount } = *deposits[0];
    assert_eq!(note_id, NOTE_ID);
    assert_eq!(token, harness.token);
    // Change is exactly what was not paid out.
    assert_eq!(amount, (funded - pay).try_into().unwrap());
}

/// Spending the entire funded amount still fills the note, with zero. The pool requires every
/// open note created in the call to be filled exactly once, so dropping it would revert.
#[test]
fn test_full_spend_still_returns_a_zero_change_note() {
    let harness = deploy_harness();
    let funded = DEFAULT_AMOUNT;
    mint(harness, harness.anonymizer, funded);

    let deposits = invoke(harness, funded, funded, NOTE_ID);

    assert_eq!(balance_of(harness, harness.recipient), funded);
    assert_eq!(deposits.len(), 1);
    assert_eq!(*deposits[0].amount, 0);
    assert_eq!(*deposits[0].note_id, NOTE_ID);
}

/// Paying more than the pool withdrew would take change belonging to someone else.
#[test]
#[feature("safe_dispatcher")]
fn test_pay_exceeding_funded_panics() {
    let harness = deploy_harness();
    mint(harness, harness.anonymizer, DEFAULT_AMOUNT * 2);

    let result = safe_invoke(
        harness,
        harness.token,
        harness.recipient,
        pay_amount: DEFAULT_AMOUNT + 1,
        funded: DEFAULT_AMOUNT,
        note_id: NOTE_ID,
    );
    assert_panic_with_felt_error(:result, expected_error: errors::PAY_EXCEEDS_FUNDED);
}

/// A zero note id means no open note was created, so the change would have nowhere to land.
#[test]
#[feature("safe_dispatcher")]
fn test_zero_note_id_panics() {
    let harness = deploy_harness();
    mint(harness, harness.anonymizer, DEFAULT_AMOUNT);

    let result = safe_invoke(
        harness,
        harness.token,
        harness.recipient,
        pay_amount: DEFAULT_AMOUNT / 2,
        funded: DEFAULT_AMOUNT,
        note_id: 0,
    );
    assert_panic_with_felt_error(:result, expected_error: errors::ZERO_NOTE_ID);
}

#[test]
#[feature("safe_dispatcher")]
fn test_zero_recipient_panics() {
    let harness = deploy_harness();
    mint(harness, harness.anonymizer, DEFAULT_AMOUNT);

    let result = safe_invoke(
        harness,
        harness.token,
        Zero::zero(),
        pay_amount: DEFAULT_AMOUNT / 2,
        funded: DEFAULT_AMOUNT,
        note_id: NOTE_ID,
    );
    assert_panic_with_felt_error(:result, expected_error: errors::ZERO_RECIPIENT);
}

/// Underfunded: the pool said it withdrew `funded` but the balance is short, so the payout
/// leg must fail rather than silently paying less.
#[test]
#[feature("safe_dispatcher")]
fn test_insufficient_balance_panics() {
    let harness = deploy_harness();
    // Deliberately do not mint.
    let result = safe_invoke(
        harness,
        harness.token,
        harness.recipient,
        pay_amount: DEFAULT_AMOUNT,
        funded: DEFAULT_AMOUNT,
        note_id: NOTE_ID,
    );
    assert_panic_with_felt_error(:result, expected_error: 'ERC20: insufficient balance');
}

use core::num::traits::Zero;
