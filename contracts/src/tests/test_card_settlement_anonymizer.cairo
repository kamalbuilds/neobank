use core::num::traits::Zero;
use snforge_std::{
    DeclareResultTrait, EventSpyAssertionsTrait, declare, spy_events, start_cheat_block_timestamp,
    start_cheat_caller_address, stop_cheat_block_timestamp, stop_cheat_caller_address,
};
use starknet::deployment::DeploymentParams;
use starknet::{ContractAddress, SyscallResultTrait, get_contract_address};
use crate::card_settlement_anonymizer::{
    AuthorizationSettled, CardSettlementAnonymizer, FrozenUpdated,
    ICardSettlementAnonymizerDispatcher, ICardSettlementAnonymizerDispatcherTrait,
    ICardSettlementAnonymizerSafeDispatcher, ICardSettlementAnonymizerSafeDispatcherTrait,
    LimitsUpdated, SettlementRecipientUpdated, errors,
};
use crate::erc20_utils::Erc20Error;
use crate::objects::OpenNoteDeposit;
use crate::test_utils_contracts::mock_erc20::{
    IMockERC20Dispatcher, IMockERC20DispatcherTrait, MockERC20,
};
use crate::tests::test_utils::assert_panic_with_felt_error;

const MAX_PER_TRANSACTION: u256 = 100;
const DAILY_LIMIT: u256 = 150;
const SECONDS_PER_DAY: u64 = 86_400;

#[derive(Drop, Copy)]
struct Harness {
    owner: ContractAddress,
    pool: ContractAddress,
    recipient: ContractAddress,
    other: ContractAddress,
    token: ContractAddress,
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

fn deploy_card_anonymizer(
    owner: ContractAddress,
    pool: ContractAddress,
    recipient: ContractAddress,
    token: ContractAddress,
    max_per_transaction: u256,
    daily_limit: u256,
) -> ContractAddress {
    let class_hash = declare(contract: "CardSettlementAnonymizer")
        .unwrap_syscall()
        .contract_class()
        .class_hash;
    let deployment_params = DeploymentParams { salt: 20, deploy_from_zero: true };
    let (address, _) = CardSettlementAnonymizer::deploy_for_test(
        class_hash: *class_hash,
        :deployment_params,
        :owner,
        privacy_pool: pool,
        settlement_recipient: recipient,
        settlement_token: token,
        :max_per_transaction,
        :daily_limit,
    )
        .expect('Card settlement deploy failed');
    address
}

fn construct_with_config(
    owner: ContractAddress,
    pool: ContractAddress,
    recipient: ContractAddress,
    token: ContractAddress,
    max_per_transaction: u256,
    daily_limit: u256,
) {
    let mut state = CardSettlementAnonymizer::contract_state_for_testing();
    CardSettlementAnonymizer::constructor(
        ref state,
        :owner,
        privacy_pool: pool,
        settlement_recipient: recipient,
        settlement_token: token,
        :max_per_transaction,
        :daily_limit,
    );
}

fn deploy_harness() -> Harness {
    let owner = get_contract_address();
    let pool = 'PRIVACY_POOL'.try_into().unwrap();
    let recipient = 'SETTLEMENT'.try_into().unwrap();
    let other = 'OTHER'.try_into().unwrap();
    let token = deploy_mock_token(20);
    let anonymizer = deploy_card_anonymizer(
        owner, pool, recipient, token, MAX_PER_TRANSACTION, DAILY_LIMIT,
    );
    Harness { owner, pool, recipient, other, token, anonymizer }
}

fn dispatcher(harness: Harness) -> ICardSettlementAnonymizerDispatcher {
    ICardSettlementAnonymizerDispatcher { contract_address: harness.anonymizer }
}

fn mint(harness: Harness, amount: u256) {
    IMockERC20Dispatcher { contract_address: harness.token }
        .mint(recipient: harness.anonymizer, :amount);
}

fn balance_of(token: ContractAddress, account: ContractAddress) -> u256 {
    IMockERC20Dispatcher { contract_address: token }.balance_of(:account)
}

fn invoke(
    harness: Harness, authorization_id: felt252, token: ContractAddress, amount: u256,
) -> Span<OpenNoteDeposit> {
    start_cheat_caller_address(harness.anonymizer, harness.pool);
    let deposits = dispatcher(harness).privacy_invoke(authorization_id, token, amount);
    stop_cheat_caller_address(harness.anonymizer);
    deposits
}

#[feature("safe_dispatcher")]
fn safe_invoke_as(
    harness: Harness,
    caller: ContractAddress,
    authorization_id: felt252,
    token: ContractAddress,
    amount: u256,
) -> Result<Span<OpenNoteDeposit>, Array<felt252>> {
    start_cheat_caller_address(harness.anonymizer, caller);
    let result = ICardSettlementAnonymizerSafeDispatcher { contract_address: harness.anonymizer }
        .privacy_invoke(authorization_id, token, amount);
    stop_cheat_caller_address(harness.anonymizer);
    result
}

#[test]
fn test_success_pays_fixed_recipient_and_returns_empty_span() {
    let harness = deploy_harness();
    let authorization_id = 'AUTH_SUCCESS';
    let amount = 75;
    let day = 42;
    mint(harness, amount);
    start_cheat_block_timestamp(harness.anonymizer, day * SECONDS_PER_DAY + 7);
    let mut spy = spy_events();

    let deposits = invoke(harness, authorization_id, harness.token, amount);

    stop_cheat_block_timestamp(harness.anonymizer);
    assert_eq!(deposits.len(), 0);
    assert_eq!(balance_of(harness.token, harness.recipient), amount);
    assert_eq!(balance_of(harness.token, harness.anonymizer), 0);
    assert!(dispatcher(harness).is_authorization_used(authorization_id));
    assert_eq!(dispatcher(harness).get_daily_spend(), (day, amount));
    let config = dispatcher(harness).get_config();
    assert_eq!(config.owner, harness.owner);
    assert_eq!(config.privacy_pool, harness.pool);
    assert_eq!(config.settlement_recipient, harness.recipient);
    assert_eq!(config.settlement_token, harness.token);
    assert_eq!(config.max_per_transaction, MAX_PER_TRANSACTION);
    assert_eq!(config.daily_limit, DAILY_LIMIT);
    assert!(!config.frozen);
    spy
        .assert_emitted(
            @array![
                (
                    harness.anonymizer,
                    CardSettlementAnonymizer::Event::AuthorizationSettled(
                        AuthorizationSettled {
                            authorization_id,
                            recipient: harness.recipient,
                            token: harness.token,
                            amount,
                            day,
                        },
                    ),
                ),
            ],
        );
}

#[test]
#[feature("safe_dispatcher")]
fn test_non_pool_caller_fails() {
    let harness = deploy_harness();
    let result = safe_invoke_as(harness, harness.other, 'AUTH_NON_POOL', harness.token, amount: 1);
    assert_panic_with_felt_error(:result, expected_error: errors::NOT_PRIVACY_POOL);
}

#[test]
#[feature("safe_dispatcher")]
fn test_replayed_authorization_fails() {
    let harness = deploy_harness();
    let authorization_id = 'AUTH_REPLAY';
    mint(harness, amount: 25);
    let _ = invoke(harness, authorization_id, harness.token, amount: 25);

    let result = safe_invoke_as(harness, harness.pool, authorization_id, harness.token, amount: 25);
    assert_panic_with_felt_error(:result, expected_error: errors::AUTHORIZATION_USED);
    assert_eq!(balance_of(harness.token, harness.recipient), 25);
}

#[test]
#[feature("safe_dispatcher")]
fn test_wrong_token_fails() {
    let harness = deploy_harness();
    let wrong_token = deploy_mock_token(21);
    let result = safe_invoke_as(harness, harness.pool, 'AUTH_WRONG_TOKEN', wrong_token, amount: 1);
    assert_panic_with_felt_error(:result, expected_error: errors::WRONG_SETTLEMENT_TOKEN);
}

#[test]
#[feature("safe_dispatcher")]
fn test_zero_authorization_zero_amount_and_over_per_transaction_fail() {
    let harness = deploy_harness();
    let zero_authorization_result = safe_invoke_as(
        harness, harness.pool, Zero::zero(), harness.token, amount: 1,
    );
    assert_panic_with_felt_error(
        result: zero_authorization_result, expected_error: errors::ZERO_AUTHORIZATION_ID,
    );

    let zero_result = safe_invoke_as(harness, harness.pool, 'AUTH_ZERO', harness.token, amount: 0);
    assert_panic_with_felt_error(result: zero_result, expected_error: errors::ZERO_AMOUNT);

    let over_result = safe_invoke_as(
        harness, harness.pool, 'AUTH_OVER_MAX', harness.token, amount: MAX_PER_TRANSACTION + 1,
    );
    assert_panic_with_felt_error(
        result: over_result, expected_error: errors::MAX_PER_TRANSACTION_EXCEEDED,
    );
}

#[test]
#[feature("safe_dispatcher")]
fn test_daily_limit_aggregates_and_resets_on_new_utc_day() {
    let harness = deploy_harness();
    mint(harness, amount: DAILY_LIMIT + MAX_PER_TRANSACTION);
    let day_one = 80;
    start_cheat_block_timestamp(harness.anonymizer, day_one * SECONDS_PER_DAY + 1);

    let _ = invoke(harness, 'AUTH_DAY_1_A', harness.token, amount: 90);
    let _ = invoke(harness, 'AUTH_DAY_1_B', harness.token, amount: 60);
    assert_eq!(dispatcher(harness).get_daily_spend(), (day_one, DAILY_LIMIT));

    let result = safe_invoke_as(harness, harness.pool, 'AUTH_DAY_1_OVER', harness.token, amount: 1);
    assert_panic_with_felt_error(:result, expected_error: errors::DAILY_LIMIT_EXCEEDED);
    stop_cheat_block_timestamp(harness.anonymizer);

    let day_two = day_one + 1;
    start_cheat_block_timestamp(harness.anonymizer, day_two * SECONDS_PER_DAY + 1);
    let _ = invoke(harness, 'AUTH_DAY_2', harness.token, amount: MAX_PER_TRANSACTION);
    stop_cheat_block_timestamp(harness.anonymizer);

    assert_eq!(dispatcher(harness).get_daily_spend(), (day_two, MAX_PER_TRANSACTION));
}

#[test]
#[feature("safe_dispatcher")]
fn test_frozen_contract_rejects_settlement() {
    let harness = deploy_harness();
    dispatcher(harness).set_frozen(true);
    let result = safe_invoke_as(harness, harness.pool, 'AUTH_FROZEN', harness.token, amount: 1);
    assert_panic_with_felt_error(:result, expected_error: errors::CONTRACT_FROZEN);
}

#[test]
#[feature("safe_dispatcher")]
fn test_owner_admin_updates_emit_events_and_non_owner_fails() {
    let harness = deploy_harness();
    let new_recipient: ContractAddress = 'NEW_SETTLEMENT'.try_into().unwrap();
    let new_max = 200;
    let new_daily = 500;
    let mut spy = spy_events();
    let card = dispatcher(harness);

    card.set_limits(new_max, new_daily);
    card.set_settlement_recipient(new_recipient);
    card.set_frozen(true);

    spy
        .assert_emitted(
            @array![
                (
                    harness.anonymizer,
                    CardSettlementAnonymizer::Event::LimitsUpdated(
                        LimitsUpdated { max_per_transaction: new_max, daily_limit: new_daily },
                    ),
                ),
                (
                    harness.anonymizer,
                    CardSettlementAnonymizer::Event::SettlementRecipientUpdated(
                        SettlementRecipientUpdated { settlement_recipient: new_recipient },
                    ),
                ),
                (
                    harness.anonymizer,
                    CardSettlementAnonymizer::Event::FrozenUpdated(FrozenUpdated { frozen: true }),
                ),
            ],
        );
    let config = card.get_config();
    assert_eq!(config.max_per_transaction, new_max);
    assert_eq!(config.daily_limit, new_daily);
    assert_eq!(config.settlement_recipient, new_recipient);
    assert!(config.frozen);

    start_cheat_caller_address(harness.anonymizer, harness.other);
    let safe = ICardSettlementAnonymizerSafeDispatcher { contract_address: harness.anonymizer };
    let limits_result = safe.set_limits(1, 1);
    let recipient_result = safe.set_settlement_recipient(harness.other);
    let frozen_result = safe.set_frozen(false);
    stop_cheat_caller_address(harness.anonymizer);

    assert_panic_with_felt_error(result: limits_result, expected_error: errors::NOT_OWNER);
    assert_panic_with_felt_error(result: recipient_result, expected_error: errors::NOT_OWNER);
    assert_panic_with_felt_error(result: frozen_result, expected_error: errors::NOT_OWNER);
}

#[test]
#[feature("safe_dispatcher")]
fn test_owner_admin_rejects_zero_limits_and_recipient() {
    let harness = deploy_harness();
    let safe = ICardSettlementAnonymizerSafeDispatcher { contract_address: harness.anonymizer };
    let max_result = safe.set_limits(0, DAILY_LIMIT);
    let daily_result = safe.set_limits(MAX_PER_TRANSACTION, 0);
    let recipient_result = safe.set_settlement_recipient(Zero::zero());

    assert_panic_with_felt_error(
        result: max_result, expected_error: errors::ZERO_MAX_PER_TRANSACTION,
    );
    assert_panic_with_felt_error(result: daily_result, expected_error: errors::ZERO_DAILY_LIMIT);
    assert_panic_with_felt_error(
        result: recipient_result, expected_error: errors::ZERO_SETTLEMENT_RECIPIENT,
    );
}

#[test]
#[feature("safe_dispatcher")]
fn test_failed_transfer_rolls_back_authorization_and_daily_spend() {
    let harness = deploy_harness();
    let authorization_id = 'AUTH_UNFUNDED';
    let result = safe_invoke_as(harness, harness.pool, authorization_id, harness.token, amount: 1);

    assert_panic_with_felt_error(:result, expected_error: Erc20Error::INSUFFICIENT_BALANCE);
    assert!(!dispatcher(harness).is_authorization_used(authorization_id));
    let (_, spent_today) = dispatcher(harness).get_daily_spend();
    assert_eq!(spent_today, 0);
}

#[test]
#[should_panic(expected: 'ZERO_OWNER')]
fn test_constructor_rejects_zero_owner() {
    construct_with_config(
        Zero::zero(),
        'PRIVACY_POOL'.try_into().unwrap(),
        'SETTLEMENT'.try_into().unwrap(),
        deploy_mock_token(22),
        MAX_PER_TRANSACTION,
        DAILY_LIMIT,
    );
}

#[test]
#[should_panic(expected: 'ZERO_PRIVACY_POOL')]
fn test_constructor_rejects_zero_privacy_pool() {
    construct_with_config(
        get_contract_address(),
        Zero::zero(),
        'SETTLEMENT'.try_into().unwrap(),
        deploy_mock_token(22),
        MAX_PER_TRANSACTION,
        DAILY_LIMIT,
    );
}

#[test]
#[should_panic(expected: 'ZERO_SETTLEMENT_RECIPIENT')]
fn test_constructor_rejects_zero_settlement_recipient() {
    construct_with_config(
        get_contract_address(),
        'PRIVACY_POOL'.try_into().unwrap(),
        Zero::zero(),
        deploy_mock_token(22),
        MAX_PER_TRANSACTION,
        DAILY_LIMIT,
    );
}

#[test]
#[should_panic(expected: 'ZERO_SETTLEMENT_TOKEN')]
fn test_constructor_rejects_zero_settlement_token() {
    construct_with_config(
        get_contract_address(),
        'PRIVACY_POOL'.try_into().unwrap(),
        'SETTLEMENT'.try_into().unwrap(),
        Zero::zero(),
        MAX_PER_TRANSACTION,
        DAILY_LIMIT,
    );
}

#[test]
#[should_panic(expected: 'ZERO_MAX_PER_TRANSACTION')]
fn test_constructor_rejects_zero_max_per_transaction() {
    construct_with_config(
        get_contract_address(),
        'PRIVACY_POOL'.try_into().unwrap(),
        'SETTLEMENT'.try_into().unwrap(),
        deploy_mock_token(22),
        0,
        DAILY_LIMIT,
    );
}

#[test]
#[should_panic(expected: 'ZERO_DAILY_LIMIT')]
fn test_constructor_rejects_zero_daily_limit() {
    let owner = get_contract_address();
    let pool: ContractAddress = 'PRIVACY_POOL'.try_into().unwrap();
    let recipient: ContractAddress = 'SETTLEMENT'.try_into().unwrap();
    let token = deploy_mock_token(22);
    construct_with_config(owner, pool, recipient, token, MAX_PER_TRANSACTION, 0);
}
