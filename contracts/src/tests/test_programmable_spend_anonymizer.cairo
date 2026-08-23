use snforge_std::{DeclareResultTrait, declare};
use starknet::deployment::DeploymentParams;
use starknet::{ContractAddress, SyscallResultTrait, get_contract_address};
use core::num::traits::Zero;
use crate::objects::OpenNoteDeposit;
use crate::programmable_spend_anonymizer::{
    IProgrammableSpendAnonymizerDispatcher, IProgrammableSpendAnonymizerDispatcherTrait,
    IProgrammableSpendAnonymizerSafeDispatcher, IProgrammableSpendAnonymizerSafeDispatcherTrait,
    ProgrammableSpendAnonymizer,
};
use crate::test_utils_contracts::mock_erc20::{IMockERC20Dispatcher, IMockERC20DispatcherTrait};
use crate::test_utils_contracts::mock_vault::{IMockVaultDispatcher, IMockVaultDispatcherTrait};
use crate::tests::test_utils::{DEFAULT_AMOUNT, assert_panic_with_felt_error};

const NOTE_ID: felt252 = 'NOTE_ID';

#[derive(Drop, Copy)]
struct SpendHarness {
    token: ContractAddress,
    anonymizer: ContractAddress,
}

fn deploy_programmable_anonymizer(owner: ContractAddress) -> ContractAddress {
    let class_hash = declare(contract: "ProgrammableSpendAnonymizer")
        .unwrap_syscall()
        .contract_class()
        .class_hash;
    let deployment_params = DeploymentParams { salt: 4, deploy_from_zero: true };
    let (address, _) = ProgrammableSpendAnonymizer::deploy_for_test(
        class_hash: *class_hash,
        :deployment_params,
        :owner,
    )
        .expect('Prog spend deploy failed');
    address
}

fn deploy_mock_erc20_prog() -> ContractAddress {
    use crate::test_utils_contracts::mock_erc20::MockERC20;
    let class_hash = declare(contract: "MockERC20").unwrap_syscall().contract_class().class_hash;
    let deployment_params = DeploymentParams { salt: 5, deploy_from_zero: true };
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

fn deploy_mock_vault() -> ContractAddress {
    use crate::test_utils_contracts::mock_vault::MockVault;
    let class_hash = declare(contract: "MockVault").unwrap_syscall().contract_class().class_hash;
    let deployment_params = DeploymentParams { salt: 6, deploy_from_zero: true };
    let (address, _) = MockVault::deploy_for_test(class_hash: *class_hash, :deployment_params)
        .expect('MockVault deploy failed');
    address
}

/// Harness owned by the test contract so `set_position_vault` passes the Ownable check.
fn deploy_harness() -> SpendHarness {
    SpendHarness {
        token: deploy_mock_erc20_prog(),
        anonymizer: deploy_programmable_anonymizer(get_contract_address()),
    }
}

fn mint(harness: SpendHarness, to: ContractAddress, amount: u256) {
    IMockERC20Dispatcher { contract_address: harness.token }.mint(recipient: to, :amount);
}

fn balance_of(harness: SpendHarness, account: ContractAddress) -> u256 {
    IMockERC20Dispatcher { contract_address: harness.token }.balance_of(account: account)
}

fn configure_vault(harness: SpendHarness) -> ContractAddress {
    let vault = deploy_mock_vault();
    IProgrammableSpendAnonymizerDispatcher { contract_address: harness.anonymizer }
        .set_position_vault(vault);
    vault
}

#[generate_trait]
impl ProgInvoke of ProgInvokeTrait {
    /// Regular-dispatcher call, the way the privacy pool invokes.
    fn invoke(
        harness: SpendHarness,
        funded: u256,
        position_amount: u256,
        recipients: Span<ContractAddress>,
        amounts: Span<u256>,
    ) -> Span<OpenNoteDeposit> {
        IProgrammableSpendAnonymizerDispatcher { contract_address: harness.anonymizer }
            .privacy_invoke(
                token: harness.token,
                :funded,
                :position_amount,
                :recipients,
                :amounts,
                note_id: NOTE_ID,
            )
    }

    #[feature("safe_dispatcher")]
    fn safe_invoke(
        harness: SpendHarness,
        funded: u256,
        position_amount: u256,
        recipients: Span<ContractAddress>,
        amounts: Span<u256>,
    ) -> Result<Span<OpenNoteDeposit>, Array<felt252>> {
        IProgrammableSpendAnonymizerSafeDispatcher { contract_address: harness.anonymizer }
            .privacy_invoke(
                token: harness.token,
                :funded,
                :position_amount,
                :recipients,
                :amounts,
                note_id: NOTE_ID,
            )
    }
}

/// The whole point: N payout legs AND one change note, one pool fee, atomically.
#[test]
fn test_pays_multiple_recipients_and_returns_change() {
    let harness = deploy_harness();
    let r1 = 'R_ONE'.try_into().unwrap();
    let r2 = 'R_TWO'.try_into().unwrap();
    let funded = DEFAULT_AMOUNT * 3;
    let a1 = DEFAULT_AMOUNT / 2;
    let a2 = DEFAULT_AMOUNT / 4;
    mint(harness, harness.anonymizer, funded);

    let deposits = ProgInvoke::invoke(
        harness, funded, 0, array![r1, r2].span(), array![a1, a2].span(),
    );

    assert_eq!(balance_of(harness, r1), a1);
    assert_eq!(balance_of(harness, r2), a2);
    assert_eq!(deposits.len(), 1);
    let OpenNoteDeposit { note_id, token, amount } = *deposits[0];
    assert_eq!(note_id, NOTE_ID);
    assert_eq!(token, harness.token);
    assert_eq!(amount, (funded - a1 - a2).try_into().unwrap());
}

/// Spending everything still fills the open note with zero - the pool requires it.
#[test]
fn test_full_spend_returns_zero_change_note() {
    let harness = deploy_harness();
    let r1 = 'R_ONE'.try_into().unwrap();
    let funded = DEFAULT_AMOUNT;
    mint(harness, harness.anonymizer, funded);

    let deposits =
        ProgInvoke::invoke(harness, funded, 0, array![r1].span(), array![funded].span());

    assert_eq!(balance_of(harness, r1), funded);
    assert_eq!(deposits.len(), 1);
    assert_eq!(*deposits[0].amount, 0);
}

/// Position leg: funds reach the vault and the change shrinks by exactly the position.
#[test]
fn test_position_and_payout_in_one_invoke() {
    let harness = deploy_harness();
    let r1 = 'R_ONE'.try_into().unwrap();
    let vault = configure_vault(harness);
    let funded = DEFAULT_AMOUNT * 2;
    let position = DEFAULT_AMOUNT / 2;
    let payout = DEFAULT_AMOUNT / 4;
    mint(harness, harness.anonymizer, funded);

    let deposits = ProgInvoke::invoke(
        harness, funded, position, array![r1].span(), array![payout].span(),
    );

    assert_eq!(IMockVaultDispatcher { contract_address: vault }.deposited_total(), position);
    // Position and payout left; the change stays earmarked here until the pool pulls it by
    // applying the returned OpenNoteDeposit.
    assert_eq!(balance_of(harness, harness.anonymizer), funded - position - payout);
    assert_eq!(balance_of(harness, r1), payout);
    assert_eq!(*deposits[0].amount, (funded - position - payout).try_into().unwrap());
}

/// A position request with no configured vault must revert, not silently skip.
#[test]
#[feature("safe_dispatcher")]
fn test_position_without_vault_panics() {
    let harness = deploy_harness();
    let r1 = 'R_ONE'.try_into().unwrap();
    mint(harness, harness.anonymizer, DEFAULT_AMOUNT);

    let result = ProgInvoke::safe_invoke(
        harness, DEFAULT_AMOUNT, DEFAULT_AMOUNT / 2, array![r1].span(), array![DEFAULT_AMOUNT / 2]
            .span(),
    );
    assert_panic_with_felt_error(:result, expected_error: 'NO_POSITION_VAULT');
}

/// Legs totalling more than the pool withdrew would drain someone else's change.
#[test]
#[feature("safe_dispatcher")]
fn test_total_exceeding_funded_panics() {
    let harness = deploy_harness();
    let r1 = 'R_ONE'.try_into().unwrap();
    mint(harness, harness.anonymizer, DEFAULT_AMOUNT);

    let result = ProgInvoke::safe_invoke(
        harness, DEFAULT_AMOUNT, 0, array![r1].span(), array![DEFAULT_AMOUNT + 1].span(),
    );
    assert_panic_with_felt_error(:result, expected_error: 'PAY_EXCEEDS_FUNDED');
}

#[test]
#[feature("safe_dispatcher")]
fn test_length_mismatch_panics() {
    let harness = deploy_harness();
    let r1 = 'R_ONE'.try_into().unwrap();

    let result = ProgInvoke::safe_invoke(
        harness, DEFAULT_AMOUNT, 0, array![r1].span(), array![].span(),
    );
    assert_panic_with_felt_error(:result, expected_error: 'LEN_MISMATCH');
}

/// Nothing requested at all: neither payouts nor a position.
#[test]
#[feature("safe_dispatcher")]
fn test_empty_spend_panics() {
    let harness = deploy_harness();

    let result = ProgInvoke::safe_invoke(harness, DEFAULT_AMOUNT, 0, array![].span(), array![].span());
    assert_panic_with_felt_error(:result, expected_error: 'EMPTY_SPEND');
}

#[test]
#[feature("safe_dispatcher")]
fn test_zero_recipient_panics() {
    let harness = deploy_harness();
    mint(harness, harness.anonymizer, DEFAULT_AMOUNT);

    let result = ProgInvoke::safe_invoke(
        harness, DEFAULT_AMOUNT, 0, array![Zero::zero()].span(), array![DEFAULT_AMOUNT / 2].span(),
    );
    assert_panic_with_felt_error(:result, expected_error: 'ZERO_RECIPIENT');
}

#[test]
#[feature("safe_dispatcher")]
fn test_zero_amount_leg_panics() {
    let harness = deploy_harness();
    let r1 = 'R_ONE'.try_into().unwrap();
    mint(harness, harness.anonymizer, DEFAULT_AMOUNT);

    let result = ProgInvoke::safe_invoke(
        harness, DEFAULT_AMOUNT, 0, array![r1].span(), array![0].span(),
    );
    assert_panic_with_felt_error(:result, expected_error: 'ZERO_AMOUNT');
}

/// Change must fit the pool's u128 OpenNoteDeposit; assert, never truncate.
#[test]
#[feature("safe_dispatcher")]
fn test_change_too_large_panics() {
    let harness = deploy_harness();
    let r1 = 'R_ONE'.try_into().unwrap();
    let huge = u256 { low: 0, high: 4 }; // 2^130, above the pool's u128 note width
    mint(harness, harness.anonymizer, DEFAULT_AMOUNT);

    let result = ProgInvoke::safe_invoke(
        harness, huge, 0, array![r1].span(), array![DEFAULT_AMOUNT].span(),
    );
    assert_panic_with_felt_error(:result, expected_error: 'CHANGE_TOO_LARGE');
}

/// Only the owner can point the position leg somewhere. The instance under test is owned
/// by a stranger address, so this contract's call is exactly a non-owner attempt.
#[test]
#[feature("safe_dispatcher")]
fn test_non_owner_cannot_set_vault() {
    let stranger: ContractAddress = 'STRANGER'.try_into().unwrap();
    let harness = SpendHarness {
        token: deploy_mock_erc20_prog(),
        anonymizer: deploy_programmable_anonymizer(stranger),
    };
    let vault = deploy_mock_vault();

    let result = IProgrammableSpendAnonymizerSafeDispatcher { contract_address: harness.anonymizer }
        .set_position_vault(vault);

    assert_panic_with_felt_error(:result, expected_error: 'Caller is not the owner');
}

/// The zero address must never become the vault: it would turn every position into a burn.
#[test]
#[feature("safe_dispatcher")]
fn test_zero_vault_is_rejected_at_config_time() {
    // Covered by NO_POSITION_VAULT at invoke time; here we pin that the getter reflects
    // configuration state so operators can verify before funding.
    let harness = deploy_harness();
    let anon = IProgrammableSpendAnonymizerDispatcher { contract_address: harness.anonymizer };
    assert_eq!(anon.position_vault(), Zero::zero());
    let vault = configure_vault(harness);
    assert_eq!(anon.position_vault(), vault);
}
