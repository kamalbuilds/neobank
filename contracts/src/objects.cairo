//! Shared objects for the privacy-pool invocation interface.
//!
//! `OpenNoteDeposit` mirrors `privacy::objects::OpenNoteDeposit` from
//! github.com/starkware-libs/starknet-privacy: identical fields, types and order, hence
//! identical serialization for the span returned by `privacy_invoke`.

use starknet::ContractAddress;

/// Input for depositing to an open note (returned by invoked contract).
///
/// `PrivatePayoutAnonymizer` never constructs one - payouts are strictly outbound - but the
/// return type must match what the privacy pool deserializes.
#[derive(Serde, Copy, Drop, PartialEq, Debug)]
pub struct OpenNoteDeposit {
    /// The identifier of the open note to deposit to.
    pub note_id: felt252,
    /// The ERC20 token contract to deposit.
    pub token: ContractAddress,
    /// The amount of tokens to deposit.
    pub amount: u128,
}
