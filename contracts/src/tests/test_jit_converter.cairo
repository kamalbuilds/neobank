use snforge_std::{DeclareResultTrait, EventSpyAssertionsTrait, declare, spy_events};
use starknet::deployment::DeploymentParams;
use starknet::{ContractAddress, SyscallResultTrait, get_contract_address};
use crate::jit_converter::{
    ConvertAndPaid, IJitConverterDispatcher, IJitConverterDispatcherTrait,
    IJitConverterSafeDispatcher, IJitConverterSafeDispatcherTrait, JitConverter, errors,
};
use crate::test_utils_contracts::mock_erc20::{
    IMockERC20Dispatcher, IMockERC20DispatcherTrait, MockERC20,
};
use crate::test_utils_contracts::mock_router::{
    IMockRouterDispatcher, IMockRouterDispatcherTrait, MockRouter,
};
use crate::tests::test_utils::assert_panic_with_felt_error;

const AUTH_ID: felt252 = 'JIT_AUTH';
/// starknetKeccak("swap") - the MockRouter entrypoint `convert_and_pay` sends.
const SWAP_SELECTOR: felt252 =
    0x15543c3708653cda9d418b4ccd3be11368e40636c10c44b18cfe756b6d88b29;

#[derive(Drop, Copy)]
struct Harness {
    owner: ContractAddress,
    recipient: ContractAddress,
    sold_token: ContractAddress,
    bought_token: ContractAddress,
    router: ContractAddress,
    jit: ContractAddress,
}

fn deploy_token(salt: felt252, name: ByteArray, symbol: ByteArray) -> ContractAddress {
    let class_hash = declare(contract: "MockERC20").unwrap_syscall().contract_class().class_hash;
    let deployment_params = DeploymentParams { salt, deploy_from_zero: true };
    let (address, _) = MockERC20::deploy_for_test(
        class_hash: *class_hash,
        :deployment_params,
        :name,
        :symbol,
        decimals: 18,
        initial_supply: 0,
        owner: 'TOKEN_OWNER'.try_into().unwrap(),
    )
        .expect('token deploy failed');
    address
}

fn deploy_router() -> ContractAddress {
    let class_hash = declare(contract: "MockRouter").unwrap_syscall().contract_class().class_hash;
    let deployment_params = DeploymentParams { salt: 33, deploy_from_zero: true };
    let (address, _) = MockRouter::deploy_for_test(class_hash: *class_hash, :deployment_params)
        .expect('router deploy failed');
    address
}

fn deploy_jit(
    owner: ContractAddress, router: ContractAddress, recipient: ContractAddress,
) -> ContractAddress {
    let class_hash = declare(contract: "JitConverter").unwrap_syscall().contract_class().class_hash;
    let deployment_params = DeploymentParams { salt: 34, deploy_from_zero: true };
    let (address, _) = JitConverter::deploy_for_test(
        class_hash: *class_hash,
        :deployment_params,
        :owner,
        :router,
        :recipient,
    )
        .expect('jit deploy failed');
    address
}

/// Assembles the full harness. Owner is this test contract so it can call the
/// owner-gated entrypoint directly; the router float is funded with buy-token
/// balances so a swap can pay out; the withdrawn (sell) side is minted to the
/// converter exactly as the pool's withdraw action would in production.
fn deploy_harness(rate_num: u256, rate_den: u256) -> Harness {
    let owner = get_contract_address();
    let sold_token = deploy_token(31, "Sold", "SOLD");
    let bought_token = deploy_token(32, "Bought", "BOUGHT");
    let router = deploy_router();
    let recipient = 'ACQUIRER'.try_into().unwrap();
    let jit = deploy_jit(owner, router, recipient);
    IMockRouterDispatcher { contract_address: router }
        .set_rate(numerator: rate_num, denominator: rate_den);
    // Router needs a float of the bought token to hand out.
    IMockERC20Dispatcher { contract_address: bought_token }
        .mint(recipient: router, amount: 1_000_000_000_000_000_000_000_u256);
    Harness { owner, recipient, sold_token, bought_token, router, jit }
}

fn mint_sold(harness: Harness, amount: u256) {
    IMockERC20Dispatcher { contract_address: harness.sold_token }
        .mint(recipient: harness.jit, :amount);
}

fn balance_of(token: ContractAddress, account: ContractAddress) -> u256 {
    IMockERC20Dispatcher { contract_address: token }.balance_of(account: account)
}

/// Calldata for a MockRouter.swap(sold_token, bought_token, amount_in) call as
/// the quoting service would return it, sized to the input amount.
fn swap_calldata(harness: Harness, amount_in: u256) -> Array<felt252> {
    array![
        SWAP_SELECTOR,
        harness.sold_token.into(),
        harness.bought_token.into(),
        amount_in.low.into(),
        amount_in.high.into(),
    ]
}

fn convert(harness: Harness, auth_id: felt252, amount_in: u256, min_out: u256) -> u256 {
    IJitConverterDispatcher { contract_address: harness.jit }.convert_and_pay(
        authorization_id: auth_id,
        sold_token: harness.sold_token,
        bought_token: harness.bought_token,
        :amount_in,
        :min_out,
        swap_calldata: swap_calldata(harness, amount_in).span(),
    )
}

#[feature("safe_dispatcher")]
fn safe_convert(
    harness: Harness,
    caller: ContractAddress,
    auth_id: felt252,
    sold_token: ContractAddress,
    bought_token: ContractAddress,
    amount_in: u256,
    min_out: u256,
    swap_calldata: Span<felt252>,
) -> Result<u256, Array<felt252>> {
    if caller != get_contract_address() {
        snforge_std::start_cheat_caller_address(harness.jit, caller);
    }
    let result = IJitConverterSafeDispatcher { contract_address: harness.jit }.convert_and_pay(
        authorization_id: auth_id,
        sold_token: sold_token,
        bought_token: bought_token,
        :amount_in,
        :min_out,
        :swap_calldata,
    );
    snforge_std::stop_cheat_caller_address(harness.jit);
    result
}

/// The whole lane in one assertion: tokens the pool withdrew into the converter
/// in the same transaction are public, get swapped, and the acquirer is paid -
/// one tx, no second privacy invoke anywhere.
#[test]
fn test_convert_swaps_and_pays_recipient() {
    let rate_num = 30_000_u256; // 6-decimal buy token per 18-decimal sell token
    let rate_den = 10_000_000_000_000_000_000_u256;
    let harness = deploy_harness(rate_num, rate_den);
    let amount_in = 10_000_000_000_000_000_000_u256; // 10 SOLD
    let expected_out = 30_000_u256; // 0.03 BOUGHT at 3000 per 1
    mint_sold(harness, amount_in);
    let mut spy = spy_events();

    let bought = convert(harness, AUTH_ID, amount_in, min_out: 30_000_u256);

    assert_eq!(bought, expected_out);
    assert_eq!(balance_of(harness.bought_token, harness.recipient), expected_out);
    assert_eq!(balance_of(harness.sold_token, harness.jit), 0);
    assert_eq!(balance_of(harness.bought_token, harness.jit), 0);
    assert_eq!(IMockRouterDispatcher { contract_address: harness.router }.pulled_total(), amount_in);
    assert!(
        IJitConverterDispatcher { contract_address: harness.jit }.is_authorization_used(AUTH_ID),
        "authorization must be marked used",
    );
    spy
        .assert_emitted(
            @array![
                (
                    harness.jit,
                    JitConverter::Event::ConvertAndPaid(
                        ConvertAndPaid {
                            authorization_id: AUTH_ID,
                            sold_token: harness.sold_token,
                            bought_token: harness.bought_token,
                            sold_amount: amount_in,
                            bought_amount: expected_out,
                        },
                    ),
                ),
            ],
        );
}

/// Slippage floor: a configured minimum above what the router delivered must
/// revert the conversion so no payment reaches the acquirer.
///
/// snforge's SafeDispatcher catches the panic without rolling back the
/// pre-panic subcall state (the router keeps the pulled tokens in-test; the
/// real network reverts the whole call), so the assertions here are the ones
/// that hold under both semantics: the panic itself, an unpaid acquirer, and
/// an unconsumed authorization id.
#[test]
#[feature("safe_dispatcher")]
fn test_below_min_out_panics_and_settles_nothing() {
    let harness = deploy_harness(30_000_u256, 10_000_000_000_000_000_000_u256);
    let amount_in = 10_000_000_000_000_000_000_u256;
    mint_sold(harness, amount_in);

    let result = safe_convert(
        harness,
        harness.owner,
        AUTH_ID,
        harness.sold_token,
        harness.bought_token,
        amount_in,
        min_out: 30_001_u256, // one unit more than the router will deliver
        swap_calldata: swap_calldata(harness, amount_in).span(),
    );

    assert_panic_with_felt_error(result, errors::BELOW_MIN_OUT);
    assert_eq!(balance_of(harness.bought_token, harness.recipient), 0);
    assert!(!IJitConverterDispatcher { contract_address: harness.jit }.is_authorization_used(AUTH_ID));
    assert_eq!(IJitConverterDispatcher { contract_address: harness.jit }.paid_for(AUTH_ID), 0);
}

/// Replaying an already-settled authorization id is the theft vector, so the
/// second attempt with the same id reverts even when fully funded.
#[test]
#[feature("safe_dispatcher")]
fn test_same_auth_id_cannot_be_used_twice() {
    let harness = deploy_harness(30_000_u256, 10_000_000_000_000_000_000_u256);
    let amount_in = 5_000_000_000_000_000_000_u256;
    mint_sold(harness, amount_in * 2);
    convert(harness, AUTH_ID, amount_in, min_out: 15_000_u256);
    mint_sold(harness, amount_in);

    let result = safe_convert(
        harness,
        harness.owner,
        AUTH_ID,
        harness.sold_token,
        harness.bought_token,
        amount_in,
        min_out: 15_000_u256,
        swap_calldata: swap_calldata(harness, amount_in).span(),
    );

    assert_panic_with_felt_error(result, errors::AUTHORIZATION_USED);
    assert_eq!(balance_of(harness.bought_token, harness.recipient), 15_000_u256);
}
