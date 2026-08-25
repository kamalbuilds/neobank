use snforge_std::{
    DeclareResultTrait, EventSpyAssertionsTrait, declare, spy_events, start_cheat_caller_address,
    stop_cheat_caller_address,
};
use starknet::deployment::DeploymentParams;
use starknet::{ContractAddress, SyscallResultTrait, get_contract_address};
use crate::card_program_anonymizer::{
    AuthorizationSettled, CardProgramAnonymizer, ICardProgramAnonymizerDispatcher,
    ICardProgramAnonymizerDispatcherTrait, ICardProgramAnonymizerSafeDispatcher,
    ICardProgramAnonymizerSafeDispatcherTrait, PositionOpened, errors,
};
use crate::objects::OpenNoteDeposit;
use crate::test_utils_contracts::mock_erc20::{
    IMockERC20Dispatcher, IMockERC20DispatcherTrait, MockERC20,
};
use crate::test_utils_contracts::mock_erc4626::{
    IMockERC4626Dispatcher, IMockERC4626DispatcherTrait, MockERC4626,
};
use crate::tests::test_utils::assert_panic_with_felt_error;

const MAX_PER_TRANSACTION: u256 = 100;
const DAILY_LIMIT: u256 = 150;
const NOTE_ID: felt252 = 'OPEN_NOTE';

#[derive(Drop, Copy)]
struct Harness {
    owner: ContractAddress,
    pool: ContractAddress,
    recipient: ContractAddress,
    token: ContractAddress,
    vault: ContractAddress,
    anonymizer: ContractAddress,
}

fn deploy_mock_token(salt: felt252) -> ContractAddress {
    let class_hash = declare(contract: "MockERC20").unwrap_syscall().contract_class().class_hash;
    let deployment_params = DeploymentParams { salt, deploy_from_zero: true };
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

fn deploy_vault(asset: ContractAddress) -> ContractAddress {
    let class_hash = declare(contract: "MockERC4626").unwrap_syscall().contract_class().class_hash;
    let deployment_params = DeploymentParams { salt: 21, deploy_from_zero: true };
    let (address, _) = MockERC4626::deploy_for_test(
        class_hash: *class_hash, :deployment_params, :asset,
    )
        .expect('MockERC4626 deploy failed');
    address
}

fn deploy_program(
    owner: ContractAddress,
    pool: ContractAddress,
    recipient: ContractAddress,
    token: ContractAddress,
    vault: ContractAddress,
) -> ContractAddress {
    let class_hash = declare(contract: "CardProgramAnonymizer")
        .unwrap_syscall()
        .contract_class()
        .class_hash;
    let deployment_params = DeploymentParams { salt: 22, deploy_from_zero: true };
    let (address, _) = CardProgramAnonymizer::deploy_for_test(
        class_hash: *class_hash,
        :deployment_params,
        :owner,
        privacy_pool: pool,
        settlement_recipient: recipient,
        settlement_token: token,
        :vault,
        max_per_transaction: MAX_PER_TRANSACTION,
        daily_limit: DAILY_LIMIT,
    )
        .expect('Card program deploy failed');
    address
}

fn deploy_harness() -> Harness {
    let owner = get_contract_address();
    let pool = 'PRIVACY_POOL'.try_into().unwrap();
    let recipient = 'SETTLEMENT'.try_into().unwrap();
    let token = deploy_mock_token(22);
    let vault = deploy_vault(token);
    let anonymizer = deploy_program(owner, pool, recipient, token, vault);
    Harness { owner, pool, recipient, token, vault, anonymizer }
}

fn dispatcher(harness: Harness) -> ICardProgramAnonymizerDispatcher {
    ICardProgramAnonymizerDispatcher { contract_address: harness.anonymizer }
}

fn mint(token: ContractAddress, recipient: ContractAddress, amount: u256) {
    IMockERC20Dispatcher { contract_address: token }.mint(:recipient, :amount);
}

fn balance_of(token: ContractAddress, account: ContractAddress) -> u256 {
    IMockERC20Dispatcher { contract_address: token }.balance_of(:account)
}

fn invoke(
    harness: Harness,
    authorization_id: felt252,
    token: ContractAddress,
    settle_amount: u256,
    program_amount: u256,
    note_id: felt252,
) -> Span<OpenNoteDeposit> {
    start_cheat_caller_address(harness.anonymizer, harness.pool);
    let deposits = dispatcher(harness)
        .privacy_invoke(authorization_id, token, settle_amount, program_amount, note_id);
    stop_cheat_caller_address(harness.anonymizer);
    deposits
}

#[feature("safe_dispatcher")]
fn safe_invoke(
    harness: Harness,
    caller: ContractAddress,
    authorization_id: felt252,
    token: ContractAddress,
    settle_amount: u256,
    program_amount: u256,
    note_id: felt252,
) -> Result<Span<OpenNoteDeposit>, Array<felt252>> {
    start_cheat_caller_address(harness.anonymizer, caller);
    let result = ICardProgramAnonymizerSafeDispatcher { contract_address: harness.anonymizer }
        .privacy_invoke(authorization_id, token, settle_amount, program_amount, note_id);
    stop_cheat_caller_address(harness.anonymizer);
    result
}

#[test]
fn test_settle_only_pays_recipient_and_returns_empty_span() {
    let harness = deploy_harness();
    mint(harness.token, harness.anonymizer, 40);
    let mut spy = spy_events();

    let deposits = invoke(harness, 'DINNER_ONLY', harness.token, 40, 0, 0);

    assert(deposits.len() == 0, 'expected empty span');
    assert_eq!(balance_of(harness.token, harness.recipient), 40);
    assert_eq!(balance_of(harness.token, harness.anonymizer), 0);
    spy
        .assert_emitted(
            @array![
                (
                    harness.anonymizer,
                    CardProgramAnonymizer::Event::AuthorizationSettled(
                        AuthorizationSettled {
                            authorization_id: 'DINNER_ONLY',
                            recipient: harness.recipient,
                            token: harness.token,
                            amount: 40,
                            day: 0,
                        },
                    ),
                ),
            ],
        );
}

#[test]
fn test_dinner_and_lend_pays_and_returns_vault_shares() {
    let harness = deploy_harness();
    mint(harness.token, harness.anonymizer, 55);
    let mut spy = spy_events();

    let deposits = invoke(harness, 'OSTERIA', harness.token, 25, 30, NOTE_ID);

    assert_eq!(deposits.len(), 1);
    let deposit = *deposits.at(0);
    assert_eq!(deposit.note_id, NOTE_ID);
    assert_eq!(deposit.token, harness.vault);
    assert_eq!(deposit.amount, 30);
    assert_eq!(balance_of(harness.token, harness.recipient), 25);
    assert_eq!(balance_of(harness.token, harness.vault), 30);
    assert_eq!(
        IMockERC4626Dispatcher { contract_address: harness.vault }
            .balance_of(harness.anonymizer),
        30,
    );
    spy
        .assert_emitted(
            @array![
                (
                    harness.anonymizer,
                    CardProgramAnonymizer::Event::PositionOpened(
                        PositionOpened {
                            authorization_id: 'OSTERIA',
                            vault: harness.vault,
                            assets: 30,
                            shares: 30,
                        },
                    ),
                ),
            ],
        );
}

#[test]
fn test_pay_dinner_from_position_redeems_and_returns_leftover() {
    let harness = deploy_harness();
    mint(harness.token, harness.anonymizer, 80);
    invoke(harness, 'LEND_FIRST', harness.token, 10, 70, NOTE_ID);

    let deposits = invoke(harness, 'DINNER_FROM_VAULT', harness.vault, 20, 70, 'LEFTOVER');

    assert_eq!(deposits.len(), 1);
    let deposit = *deposits.at(0);
    assert_eq!(deposit.note_id, 'LEFTOVER');
    assert_eq!(deposit.token, harness.token);
    assert_eq!(deposit.amount, 50);
    assert_eq!(balance_of(harness.token, harness.recipient), 30);
    assert_eq!(
        IMockERC4626Dispatcher { contract_address: harness.vault }
            .balance_of(harness.anonymizer),
        0,
    );
}

#[test]
fn test_replay_is_rejected() {
    let harness = deploy_harness();
    mint(harness.token, harness.anonymizer, 20);
    invoke(harness, 'REPLAY', harness.token, 10, 0, 0);
    mint(harness.token, harness.anonymizer, 10);
    let result = safe_invoke(harness, harness.pool, 'REPLAY', harness.token, 10, 0, 0);
    assert_panic_with_felt_error(result, errors::AUTHORIZATION_USED);
}

#[test]
fn test_non_pool_cannot_invoke() {
    let harness = deploy_harness();
    mint(harness.token, harness.anonymizer, 10);
    let result = safe_invoke(harness, harness.owner, 'AUTH', harness.token, 10, 0, 0);
    assert_panic_with_felt_error(result, errors::NOT_PRIVACY_POOL);
}

#[test]
fn test_lend_without_note_id_panics() {
    let harness = deploy_harness();
    mint(harness.token, harness.anonymizer, 20);
    let result = safe_invoke(harness, harness.pool, 'NO_NOTE', harness.token, 10, 10, 0);
    assert_panic_with_felt_error(result, errors::NOTE_REQUIRED);
}

#[test]
fn test_settle_only_rejects_nonzero_note_id() {
    let harness = deploy_harness();
    mint(harness.token, harness.anonymizer, 10);
    let result = safe_invoke(harness, harness.pool, 'NOTE_ON_SETTLE', harness.token, 10, 0, NOTE_ID);
    assert_panic_with_felt_error(result, errors::NOTE_FORBIDDEN);
}

#[test]
fn test_amount_over_per_swipe_cap_panics() {
    let harness = deploy_harness();
    mint(harness.token, harness.anonymizer, 120);
    let result = safe_invoke(harness, harness.pool, 'TOO_BIG', harness.token, 110, 0, 0);
    assert_panic_with_felt_error(result, errors::MAX_PER_TRANSACTION_EXCEEDED);
}
