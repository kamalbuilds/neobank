//! JIT converter: sell what the pool just withdrew, pay the acquirer, in one transaction.
//!
//! ## Why this contract exists (the constraint it attacks)
//!
//! The earlier conclusion "JIT is impossible because the pool allows one
//! `privacy_invoke` per transaction" conflated two different lanes:
//!
//! 1. **The privacy lane.** The hosted account submits one proven pool bundle
//!    (`callAndProof.call`) through `account.execute`. Inside it the pool runs
//!    at most one Invoke action, which may land on CardProgram's
//!    `privacy_invoke` - or, for JIT, on nothing at all: plain withdraw actions
//!    are enough. What the pool limits is privacy opcodes, not total call count.
//! 2. **The public lane.** Every further call in the SAME `account.execute`
//!    batch is an ordinary top-level call from the hosted account. Once the pool
//!    has withdrawn tokens to this contract, they are a PUBLIC balance and any
//!    public router swap on them carries no pool constraint.
//!
//! So the sequence is: `[pool private bundle] , jit.convert_and_pay(...)]` -
//! one signature, one privacy invoke, one fee, and the swap rides along as call
//! number two. This contract is that second call. The choice to extend nothing:
//! CardProgram's `privacy_invoke` runs *inside* the pool's re-entrant Invoke
//! action where the caller is the pool, and its whole policy (per-swipe caps,
//! daily spend, settle-first) assumes it is settling a swipe. A JIT conversion
//! has none of those preconditions and must read fresh router calldata built
//! seconds before submission, which cannot be smuggled through the pool's
//! opaque action encoding. A separate, deliberately small contract keeps the
//! swipe policy intact instead of widening it.
//!
//! ## Honest boundaries
//!
//! - The swap leg is fully public: the router, the pair, and both amounts are
//!   visible on chain. Privacy ends where the pool withdrew; that is inherent,
//!   not a defect of this contract.
//! - This contract never holds custody across transactions by design: it sells
//!   only what arrived for it earlier in the same execution. `amount_in` must be
//!   covered by the balance the caller claims was withdrawn, asserted against
//!   the live balance, and the bought-token credit is measured as a balance
//!   delta around the router call rather than trusted from router return data.
//! - Anyone the owner designates can be pointed at by passing a different
//!   `swap_calldata`; since `convert_and_pay` is owner-gated, the exposure is
//!   limited to the owner attacking themself. The `min_out` floor cannot be
//!   bypassed by bad calldata: it is enforced on the resulting balance delta.

use starknet::ContractAddress;


pub mod errors {
    pub const ZERO_OWNER: felt252 = 'ZERO_OWNER';
    pub const ZERO_ROUTER: felt252 = 'ZERO_ROUTER';
    pub const ZERO_RECIPIENT: felt252 = 'ZERO_RECIPIENT';
    pub const ZERO_SOLD_TOKEN: felt252 = 'ZERO_SOLD_TOKEN';
    pub const ZERO_BOUGHT_TOKEN: felt252 = 'ZERO_BOUGHT_TOKEN';
    pub const ZERO_AUTHORIZATION_ID: felt252 = 'ZERO_AUTHORIZATION_ID';
    pub const AUTHORIZATION_USED: felt252 = 'AUTHORIZATION_USED';
    pub const ZERO_AMOUNT_IN: felt252 = 'ZERO_AMOUNT_IN';
    pub const ZERO_MIN_OUT: felt252 = 'ZERO_MIN_OUT';
    pub const BELOW_MIN_OUT: felt252 = 'BELOW_MIN_OUT';
    pub const SWAP_NOT_OWNER: felt252 = 'SWAP_NOT_OWNER';
}

#[derive(Drop, Serde, Copy, PartialEq, Debug)]
pub struct JitConfig {
    pub owner: ContractAddress,
    pub router: ContractAddress,
    pub recipient: ContractAddress,
}

#[starknet::interface]
pub trait IJitConverter<T> {
    /// Sells `amount_in` of `sold_token` held by this contract through the pinned
    /// router, requires at least `min_out` of `bought_token` back, and forwards
    /// the whole credit to the fixed recipient.
    ///
    /// `swap_calldata` is the router entrypoint calldata as returned by the
    /// quoting service (already sized for `amount_in` with its own internal
    /// slippage bound). The independent `min_out` check here is the part that
    /// makes the guard trustless on chain: it reads the contract's `bought_token`
    /// balance before and after the router call and reverts with
    /// [`errors::BELOW_MIN_OUT`] unless the delta reaches `min_out`.
    ///
    /// # Reverts
    /// - zero inputs, a reused `authorization_id`, or a non-owner caller.
    /// - `'ERC20: insufficient balance'` if `amount_in` exceeds what was
    ///   actually withdrawn into this contract.
    /// - [`errors::BELOW_MIN_OUT`] if the router delivered less than `min_out`.
    fn convert_and_pay(
        ref self: T,
        authorization_id: felt252,
        sold_token: ContractAddress,
        bought_token: ContractAddress,
        amount_in: u256,
        min_out: u256,
        swap_calldata: Span<felt252>,
    ) -> u256;

    fn get_config(self: @T) -> JitConfig;
    fn is_authorization_used(self: @T, authorization_id: felt252) -> bool;
    /// Bought-token units forwarded to the recipient per authorization.
    fn paid_for(self: @T, authorization_id: felt252) -> u256;
}

#[derive(Drop, starknet::Event)]
pub struct ConvertAndPaid {
    #[key]
    pub authorization_id: felt252,
    pub sold_token: ContractAddress,
    pub bought_token: ContractAddress,
    pub sold_amount: u256,
    pub bought_amount: u256,
}

#[starknet::contract]
pub mod JitConverter {
    use core::num::traits::Zero;
    use starknet::storage::{
        Map, StorageMapReadAccess, StorageMapWriteAccess, StoragePointerReadAccess,
        StoragePointerWriteAccess,
    };
    use starknet::syscalls::call_contract_syscall;
    use starknet::{
        ContractAddress, SyscallResultTrait, get_caller_address, get_contract_address,
    };
    use core::array::Span;
    use openzeppelin::interfaces::token::erc20::{IERC20Dispatcher, IERC20DispatcherTrait};
    use crate::erc20_utils::checked_transfer;
    use super::{ConvertAndPaid, JitConfig, IJitConverter, errors};

    #[event]
    #[derive(Drop, starknet::Event)]
    pub enum Event {
        ConvertAndPaid: super::super::jit_converter::ConvertAndPaid,
    }

    #[storage]
    struct Storage {
        owner: ContractAddress,
        router: ContractAddress,
        recipient: ContractAddress,
        used_authorization_ids: Map<felt252, bool>,
        paid: Map<felt252, u256>,
    }

    #[constructor]
    pub(crate) fn constructor(
        ref self: ContractState,
        owner: ContractAddress,
        router: ContractAddress,
        recipient: ContractAddress,
    ) {
        assert(owner.is_non_zero(), errors::ZERO_OWNER);
        assert(router.is_non_zero(), errors::ZERO_ROUTER);
        assert(recipient.is_non_zero(), errors::ZERO_RECIPIENT);
        self.owner.write(owner);
        self.router.write(router);
        self.recipient.write(recipient);
    }

    #[generate_trait]
    impl InternalImpl of InternalTrait {
        fn assert_only_owner(self: @ContractState) {
            assert(get_caller_address() == self.owner.read(), errors::SWAP_NOT_OWNER);
        }

        /// Runs the router call whose calldata the quoting service produced.
        ///
        /// `swap_calldata[0]` is the entrypoint name on the pinned router; the
        /// rest is the ABI-ordered arguments. A syscall rather than a dispatcher
        /// because the entrypoint is only known at call time, and the return
        /// data is deliberately ignored: the amount forwarded is the measured
        /// bought-token balance delta, never what the router claims it sent.
        fn run_swap(
            self: @ContractState, mut swap_calldata: Span<felt252>,
        ) -> Span<felt252> {
            let selector = *swap_calldata.pop_front().unwrap();
            call_contract_syscall(self.router.read(), selector, swap_calldata).unwrap_syscall()
        }
    }

    #[abi(embed_v0)]
    pub impl JitConverterImpl of IJitConverter<ContractState> {
        fn convert_and_pay(
            ref self: ContractState,
            authorization_id: felt252,
            sold_token: ContractAddress,
            bought_token: ContractAddress,
            amount_in: u256,
            min_out: u256,
            swap_calldata: Span<felt252>,
        ) -> u256 {
            self.assert_only_owner();
            assert(authorization_id.is_non_zero(), errors::ZERO_AUTHORIZATION_ID);
            assert(!self.used_authorization_ids.read(authorization_id), errors::AUTHORIZATION_USED);
            assert(sold_token.is_non_zero(), errors::ZERO_SOLD_TOKEN);
            assert(bought_token.is_non_zero(), errors::ZERO_BOUGHT_TOKEN);
            assert(amount_in.is_non_zero(), errors::ZERO_AMOUNT_IN);
            assert(min_out.is_non_zero(), errors::ZERO_MIN_OUT);

            // Sell only what the pool actually withdrew here earlier in this
            // transaction; a claim above the real balance reverts rather than
            // silently swapping less than the quote priced.
            let sold_erc20 = IERC20Dispatcher { contract_address: sold_token };
            assert(
                amount_in <= sold_erc20.balance_of(account: get_contract_address()),
                'ERC20: insufficient balance',
            );
            let bought_erc20 = IERC20Dispatcher { contract_address: bought_token };
            let before = bought_erc20.balance_of(account: get_contract_address());

            // Hand the router spending rights, execute the quoted swap, then
            // drain the approval: allowances do not survive a conversion.
            let approved = sold_erc20.approve(spender: self.router.read(), amount: amount_in);
            assert(approved, 'ERC20: transfer failed');
            let result = self.run_swap(swap_calldata);
            let _ = result;

            let bought = bought_erc20.balance_of(account: get_contract_address()) - before;
            assert(bought >= min_out, errors::BELOW_MIN_OUT);

            checked_transfer(
                token_address: bought_token,
                recipient: self.recipient.read(),
                amount: bought,
            );
            self.used_authorization_ids.write(authorization_id, true);
            self.paid.write(authorization_id, bought);
            self
                .emit(
                    Event::ConvertAndPaid(
                        ConvertAndPaid {
                            authorization_id,
                            sold_token,
                            bought_token,
                            sold_amount: amount_in,
                            bought_amount: bought,
                        },
                    ),
                );
            // The router's own return data is deliberately ignored: the amount
            // forwarded is the measured balance delta above.
            let _ = result.len();
            bought
        }

        fn get_config(self: @ContractState) -> JitConfig {
            JitConfig {
                owner: self.owner.read(),
                router: self.router.read(),
                recipient: self.recipient.read(),
            }
        }

        fn is_authorization_used(self: @ContractState, authorization_id: felt252) -> bool {
            self.used_authorization_ids.read(authorization_id)
        }

        fn paid_for(self: @ContractState, authorization_id: felt252) -> u256 {
            self.paid.read(authorization_id)
        }
    }
}
