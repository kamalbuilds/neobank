use snforge_std::{
    DeclareResultTrait, declare, start_cheat_caller_address, stop_cheat_caller_address,
};
use starknet::deployment::DeploymentParams;
use starknet::{ContractAddress, SyscallResultTrait};
use crate::earn_vault::{EarnVault, IEarnVaultDispatcher, IEarnVaultDispatcherTrait};
use crate::test_utils_contracts::mock_erc20::{
    IMockERC20Dispatcher, IMockERC20DispatcherTrait, MockERC20,
};

fn deploy_token() -> ContractAddress {
    let class_hash = declare(contract: "MockERC20").unwrap_syscall().contract_class().class_hash;
    let deployment_params = DeploymentParams { salt: 40, deploy_from_zero: true };
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
    let class_hash = declare(contract: "EarnVault").unwrap_syscall().contract_class().class_hash;
    let deployment_params = DeploymentParams { salt: 41, deploy_from_zero: true };
    let (address, _) = EarnVault::deploy_for_test(
        class_hash: *class_hash, :deployment_params, :asset,
    )
        .expect('EarnVault deploy failed');
    address
}

#[test]
fn test_earn_vault_allowance_starts_zero_and_tracks_approve() {
    let token = deploy_token();
    let vault_addr = deploy_vault(token);
    let vault = IEarnVaultDispatcher { contract_address: vault_addr };
    let owner: ContractAddress = 'OWNER'.try_into().unwrap();
    let spender: ContractAddress = 'POOL'.try_into().unwrap();

    assert_eq!(vault.allowance(owner, spender), 0);

    start_cheat_caller_address(vault_addr, owner);
    assert!(vault.approve(spender, 10));
    stop_cheat_caller_address(vault_addr);

    assert_eq!(vault.allowance(owner, spender), 10);
}

#[test]
fn test_earn_vault_pool_can_pull_shares_after_approve() {
    let token = deploy_token();
    let vault_addr = deploy_vault(token);
    let vault = IEarnVaultDispatcher { contract_address: vault_addr };
    let token_disp = IMockERC20Dispatcher { contract_address: token };
    let helper: ContractAddress = 'HELPER'.try_into().unwrap();
    let pool: ContractAddress = 'POOL'.try_into().unwrap();
    let assets: u256 = 10;

    token_disp.mint(recipient: helper, amount: assets);
    start_cheat_caller_address(token, helper);
    assert!(token_disp.approve(spender: vault_addr, amount: assets));
    stop_cheat_caller_address(token);

    start_cheat_caller_address(vault_addr, helper);
    assert_eq!(vault.deposit(assets, helper), assets);
    assert!(vault.approve(pool, assets));
    stop_cheat_caller_address(vault_addr);

    assert_eq!(vault.allowance(helper, pool), assets);
    start_cheat_caller_address(vault_addr, pool);
    assert!(vault.transfer_from(helper, pool, assets));
    stop_cheat_caller_address(vault_addr);

    assert_eq!(vault.balance_of(helper), 0);
    assert_eq!(vault.balance_of(pool), assets);
    assert_eq!(vault.allowance(helper, pool), 0);
}
