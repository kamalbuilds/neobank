import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { testnetNoticeCopy } from '@/app/components/marketing/TestnetNotice';

/**
 * The banner said "Sepolia testnet - nothing here moves mainnet funds" to
 * every visitor, including one connected to mainnet, where a shield spends
 * real STRK through the canonical pool at 0x040337b1...812a. That is not a
 * cosmetic mismatch: it tells a user their live funds are test funds.
 */
describe('the testnet notice follows the connected chain', () => {
  it('shows nothing on mainnet', () => {
    expect(testnetNoticeCopy('mainnet')).toBeNull();
  });

  it('warns on sepolia', () => {
    const copy = testnetNoticeCopy('sepolia');
    expect(copy).toMatch(/sepolia/i);
    expect(copy).toMatch(/test money/i);
  });

  it('warns before a wallet is connected, because sepolia is the pre-connect default', () => {
    // DEFAULT_NETWORK is sepolia, so an unconnected session really would act
    // there. Staying silent pre-connect would understate that.
    const copy = testnetNoticeCopy(undefined);
    expect(copy).toMatch(/sepolia/i);
    expect(copy).not.toBeNull();
  });
});

describe('the account chrome badge names the chain it is on', () => {
  it('never renders the phrase "mainnet testnet"', () => {
    // The badge interpolated `{net} testnet`, so a mainnet wallet read
    // "MAINNET TESTNET" in the header.
    const chrome = readFileSync('src/app/components/v2/AccountChrome.tsx', 'utf8');
    expect(chrome).not.toMatch(/\{net\}\s+testnet/);

    // The badge moved out of AccountChrome into a shared NetworkChip during the
    // statement redesign. What must hold is unchanged: mainnet says mainnet,
    // and sepolia says the word "testnet" in text a reader can see, not only in
    // a title attribute that never fires on touch.
    const chip = readFileSync('src/app/components/Panels/PoolFacts.tsx', 'utf8');
    expect(chip).toMatch(/network === "mainnet" \? "mainnet" : "sepolia testnet"/);
    expect(chip).not.toMatch(/network === "mainnet" \? "mainnet" : "sepolia"\s*}/);
  });
});
