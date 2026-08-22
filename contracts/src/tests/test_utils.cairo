use snforge_std::{DeclareResultTrait, declare};
use starknet::deployment::DeploymentParams;
use starknet::{ContractAddress, SyscallResultTrait};
use crate::objects::OpenNoteDeposit;
use crate::private_payout_anonymizer::{
    IPrivatePayoutAnonymizerDispatcher, IPrivatePayoutAnonymizerDispatcherTrait,
    IPrivatePayoutAnonymizerSafeDispatcher, IPrivatePayoutAnonymizerSafeDispatcherTrait,
    PrivatePayoutAnonymizer,
};
use crate::test_utils_contracts::mock_erc20::{
    IMockERC20Dispatcher, IMockERC20DispatcherTrait, MockERC20, MockERC20FailingTransfer,
};

pub const DEFAULT_AMOUNT: u256 = 1_000_000_000_000_000_000;

/// Deployed components under test.
#[derive(Drop, Copy)]
pub struct PayoutHarness {
    pub token: ContractAddress,
    pub recipient: ContractAddress,
    pub anonymizer: ContractAddress,
}

/// Asserts that `result` panicked with `expected_error` as the FIRST felt of its panic data.
///
/// Mirrors `starkware_utils_testing::test_utils::assert_panic_with_felt_error`.
pub fn assert_panic_with_felt_error<T, +Drop<T>>(
    result: Result<T, Array<felt252>>, expected_error: felt252,
) {
    match result {
        Result::Ok(_) => panic!("Expected to fail with: {}", expected_error),
        Result::Err(error_data) => assert!(
            *error_data[0] == expected_error,
            "Expected error: {}\nActual error: {}",
            expected_error,
            *error_data[0],
        ),
    };
}

#[generate_trait]
pub impl PayoutHarnessImpl of PayoutHarnessTrait {
    /// Funds `to` with `amount` mock tokens.
    fn mint(ref self: PayoutHarness, to: ContractAddress, amount: u256) {
        IMockERC20Dispatcher { contract_address: self.token }.mint(recipient: to, :amount);
    }

    fn token_balance_of(self: @PayoutHarness, account: ContractAddress) -> u256 {
        IMockERC20Dispatcher { contract_address: *self.token }.balance_of(account: account)
    }

    /// Calls `privacy_invoke` the way the privacy contract does (regular dispatcher).
    fn privacy_invoke(
        ref self: PayoutHarness, token: ContractAddress, recipient: ContractAddress, amount: u256,
    ) -> Span<OpenNoteDeposit> {
        IPrivatePayoutAnonymizerDispatcher { contract_address: self.anonymizer }
            .privacy_invoke(:token, :recipient, :amount)
    }

    /// Safe-dispatcher variant for asserting panic paths explicitly.
    #[feature("safe_dispatcher")]
    fn safe_privacy_invoke(
        ref self: PayoutHarness, token: ContractAddress, recipient: ContractAddress, amount: u256,
    ) -> Result<Span<OpenNoteDeposit>, Array<felt252>> {
        IPrivatePayoutAnonymizerSafeDispatcher { contract_address: self.anonymizer }
            .privacy_invoke(:token, :recipient, :amount)
    }
}

/// Standalone safe-dispatcher call for tests that compose components directly.
#[feature("safe_dispatcher")]
pub fn safe_privacy_invoke_direct(
    anonymizer: ContractAddress, token: ContractAddress, recipient: ContractAddress, amount: u256,
) -> Result<Span<OpenNoteDeposit>, Array<felt252>> {
    IPrivatePayoutAnonymizerSafeDispatcher { contract_address: anonymizer }
        .privacy_invoke(:token, :recipient, :amount)
}

pub fn deploy_harness() -> PayoutHarness {
    let token = deploy_mock_erc20();
    let anonymizer = deploy_anonymizer();
    PayoutHarness { token, recipient: 'RECIPIENT'.try_into().unwrap(), anonymizer }
}

pub fn deploy_anonymizer() -> ContractAddress {
    let class_hash = declare(contract: "PrivatePayoutAnonymizer")
        .unwrap_syscall()
        .contract_class()
        .class_hash;
    let deployment_params = DeploymentParams { salt: 0, deploy_from_zero: true };
    let (address, _) = PrivatePayoutAnonymizer::deploy_for_test(
        class_hash: *class_hash, :deployment_params,
    )
        .expect('Anonymizer deploy failed');
    address
}

fn deploy_mock_erc20() -> ContractAddress {
    let class_hash = declare(contract: "MockERC20").unwrap_syscall().contract_class().class_hash;
    let deployment_params = DeploymentParams { salt: 1, deploy_from_zero: true };
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

pub fn deploy_failing_mock_erc20() -> ContractAddress {
    let class_hash = declare(contract: "MockERC20FailingTransfer")
        .unwrap_syscall()
        .contract_class()
        .class_hash;
    let deployment_params = DeploymentParams { salt: 1, deploy_from_zero: true };
    let (address, _) = MockERC20FailingTransfer::deploy_for_test(
        class_hash: *class_hash,
        :deployment_params,
        name: "MockERC20FailingTransfer",
        symbol: "MCF",
        decimals: 18,
        initial_supply: 0,
        owner: 'TOKEN_OWNER'.try_into().unwrap(),
    )
        .expect('FailingToken deploy failed');
    address
}
