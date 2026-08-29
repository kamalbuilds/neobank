/**
 * The record: every deployed contract and every settled transaction this
 * product claims, each naming the file its value comes out of.
 *
 * The source field is what makes this a record rather than a list. A reader
 * who does not trust the docs page can diff each row against the repository,
 * and a value that moved in constants.ts moves here too because this module
 * imports it rather than restating it.
 */
import {
  ANONYMIZER_ADDRESSES,
  CARD_PROGRAM_ADDRESSES,
  JIT_CONVERTER_ADDRESSES,
  STRK20_POOL_ADDRESSES,
  explorerAddressUrl,
  explorerTxUrl,
  type NetworkKey,
} from '@/utils/constants';

export type ContractRow = {
  label: string;
  address: string;
  network: NetworkKey;
  /** What it does, in one line. */
  detail: string;
  /** Which file in this repo holds the value above. */
  source: string;
  /** Ours to deploy, or StarkWare's to use. */
  origin: 'sealed' | 'starkware';
  href: string;
};

function contract(
  label: string,
  address: string,
  network: NetworkKey,
  detail: string,
  source: string,
  origin: ContractRow['origin'],
): ContractRow {
  return { label, address, network, detail, source, origin, href: explorerAddressUrl(network, address) };
}

const CONSTANTS = 'src/utils/constants.ts';
const CLAIM = 'strk20.json';

export const CONTRACT_RECORD: ContractRow[] = [
  contract(
    'STRK20 privacy pool',
    STRK20_POOL_ADDRESSES.mainnet,
    'mainnet',
    'StarkWare\u2019s canonical privacy pool. Every shield and unshield settles through it.',
    CONSTANTS,
    'starkware',
  ),
  contract(
    'STRK20 privacy pool',
    STRK20_POOL_ADDRESSES.sepolia,
    'sepolia',
    'The same pool on Sepolia, verified on chain as \u201cStarknet: Canonical Privacy Pool\u201d.',
    CONSTANTS,
    'starkware',
  ),
  contract(
    'ShadowAccountAnonymizer',
    ANONYMIZER_ADDRESSES.sepolia.shadowAccount,
    'sepolia',
    'Official anonymizer giving a deterministic per-merchant spend identity. Not redeployed by us.',
    CONSTANTS,
    'starkware',
  ),
  contract(
    'CardSettlementAnonymizer',
    ANONYMIZER_ADDRESSES.sepolia.cardSettlement,
    'sepolia',
    'Settles an approved swipe from the hosted account, with an on-chain replay map and daily limit.',
    CLAIM,
    'sealed',
  ),
  contract(
    'CardProgramAnonymizer',
    CARD_PROGRAM_ADDRESSES.sepolia!,
    'sepolia',
    'Card policy in a contract: per-swipe cap, daily cap, blocked categories.',
    CLAIM,
    'sealed',
  ),
  contract(
    'JIT converter',
    JIT_CONVERTER_ADDRESSES.sepolia!,
    'sepolia',
    'Sells shielded STRK for USDC at settlement time, on Ekubo-quoted calldata through a pinned AVNU router.',
    CONSTANTS,
    'sealed',
  ),
  contract(
    'EarnVault',
    ANONYMIZER_ADDRESSES.sepolia.earnVault,
    'sepolia',
    'Lending vault a swipe can open a position in. Exposes allowance so the pool can pull the share note.',
    CONSTANTS,
    'sealed',
  ),
  contract(
    'Earn adapter',
    ANONYMIZER_ADDRESSES.sepolia.earnAdapter,
    'sepolia',
    'Adapter between the card program and the vault.',
    CONSTANTS,
    'sealed',
  ),
  contract(
    'ProgrammableSpendAnonymizer',
    ANONYMIZER_ADDRESSES.sepolia.programmableSpend,
    'sepolia',
    'Opens a position and pays N recipients, then re-shields the change, in one privacy_invoke.',
    CONSTANTS,
    'sealed',
  ),
  contract(
    'PrivateSpendAnonymizer',
    ANONYMIZER_ADDRESSES.sepolia.privateSpend,
    'sepolia',
    'Pays a recipient and re-shields the change atomically.',
    CONSTANTS,
    'sealed',
  ),
  contract(
    'PrivatePayoutAnonymizer',
    ANONYMIZER_ADDRESSES.sepolia.privatePayout,
    'sepolia',
    'One-way outbound payout helper.',
    CONSTANTS,
    'sealed',
  ),
];

/**
 * A contract that was live and is now retired. Listed rather than deleted:
 * an abandoned deployment is exactly the thing a reader deserves to find
 * named, and its failure mode is the most instructive bug in this repo.
 */
export const RETIRED_CONTRACTS: ContractRow[] = [
  contract(
    'EarnVault (retired)',
    '0x00474c6b220a15919770a58dad4b4ea19c30b9972a3620c5a16cee8f752068bb',
    'sepolia',
    'The first vault class. It had no allowance entrypoint, so the pool could not pull the share note and the atomic dinner-plus-lend reverted with \u201centrypoint does not exist\u201d.',
    CLAIM,
    'sealed',
  ),
];

export type TxRow = {
  label: string;
  hash: string;
  network: NetworkKey;
  block?: number;
  /** What the receipt actually contains. */
  detail: string;
  status: string;
  href: string;
};

function tx(
  label: string,
  hash: string,
  network: NetworkKey,
  detail: string,
  status: string,
  block?: number,
): TxRow {
  return { label, hash, network, detail, status, block, href: explorerTxUrl(network, hash) };
}

export const TX_RECORD: TxRow[] = [
  tx(
    'First mainnet shield (STRK)',
    '0x04c4bea05417ce1062adef39b3d3b300f831ec994bbb4166d6010c4838d49193',
    'mainnet',
    'Deposit into the canonical mainnet pool. 17 events, 4 from the pool.',
    'SUCCEEDED / ACCEPTED_ON_L1',
  ),
  tx(
    'Mainnet shield (USDC)',
    '0x059eb6c1bdddd048006f372b4db6602560dbfc722536b94d59ece8abb865586e',
    'mainnet',
    'Second mainnet deposit. 15 events, 3 from the pool.',
    'SUCCEEDED / ACCEPTED_ON_L1',
  ),
  tx(
    'Third mainnet pool transaction',
    '0xe08fd329091b483978c64f93288b7346b158e0dc485fd7c5f594899f0294',
    'mainnet',
    '17 events, 4 from the pool.',
    'SUCCEEDED / ACCEPTED_ON_L1',
  ),
  tx(
    'A swipe settles privately',
    '0x1f815361cd9cb1b378f208c8def10dddf5452ead190cb199a1da37adf4fe5df',
    'sepolia',
    'Card authorization selling shielded STRK and paying the merchant in USDC in one transaction.',
    'SUCCEEDED',
    14130415,
  ),
  tx(
    'Repeat swipes do not link',
    '0x48ccd889292f406734d97a27c53db53910fb0f9ef3c056668bd64e20ccb111b',
    'sepolia',
    'Shadow spend through a per-merchant identity, so two visits to one merchant do not chain.',
    'SUCCEEDED',
    14130089,
  ),
  tx(
    'Money arrives already shielded',
    '0x28b053d9a670650604bf8f7ae8b67fc7f296d2f4fa630a987e7a6f775b11fe2',
    'sepolia',
    'USDC bridged from Base Sepolia over CCTP V2, landing and shielding in the same flow.',
    'SUCCEEDED',
    14139603,
  ),
  tx(
    'Dinner paid and a position opened, atomically',
    '0x4d94fa79724d3e997604e4a42a54daab3cc68f4ec17672b3ca9644a843e2639',
    'sepolia',
    'Pool withdrew 10.24 STRK; 0.24 paid the merchant, 10 entered the vault. AuthorizationSettled + PositionOpened + OpenNoteDeposited in one receipt.',
    'SUCCEEDED / ACCEPTED_ON_L2',
    14109923,
  ),
  tx(
    'The same dinner, paid from vault shares',
    '0x45b8c5d7a7cae0a9f98d69e92c1120c0bee831e68f9795fde00e1f3ffa3f0e0',
    'sepolia',
    'PositionRedeemed plus AuthorizationSettled. Vault total_assets went 10 STRK to 0; recipient up 0.24 STRK.',
    'SUCCEEDED / ACCEPTED_ON_L2',
    14111945,
  ),
  tx(
    'Hosted card authorization loop',
    '0x063b3fe7e13e9baca4d0a9ca9616b7b5e71504b38ed02bb3b98512935988acf4',
    'sepolia',
    'AuthorizationSettled for 0.5 STRK. The /api/card/status/settlements endpoint returns this receipt.',
    'SUCCEEDED / ACCEPTED_ON_L1',
  ),
];

export function shortenHex(value: string, lead = 10, tail = 6): string {
  if (value.length <= lead + tail + 1) return value;
  return `${value.slice(0, lead)}\u2026${value.slice(-tail)}`;
}
