'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { explorerTxUrl, type NetworkKey } from '@/utils/constants';
import { fromBaseUnits, shortHex } from '../lib/format';
import { HowThisWorks } from '../v2/ui';

const USDC_DECIMALS = 6;

interface RuntimeStatus {
  ready: boolean;
  missing: string[];
  hostedAccount?: string;
  evmSignerConfigured: boolean;
  contracts: {
    baseSepolia: { domain: number; tokenMessengerV2: string; usdc: string };
    starknetSepolia: { domain: number; messageTransmitter: string; usdc: string };
  };
}

interface BurnStatus {
  burnTxHash: string;
  phase: 'not_found' | 'attesting' | 'ready_to_claim' | 'claimed';
  irisStatus?: string;
  amount?: string;
  feeExecuted?: string;
  error?: string;
}

interface ClaimResult {
  phase: 'claimed' | 'already_claimed';
  amount: string;
  feeExecuted: string;
  starknetTxHash?: string;
  mintedDelta?: string;
}

interface ShieldResult {
  amount: string;
  starknetTxHash: string;
  privateBefore: string;
  privateAfter: string;
}

const CARD = 'rounded-2xl border border-white/[0.07] bg-white/[0.02] p-4';
const LABEL = 'text-[11px] uppercase tracking-[0.14em] text-[#7a859c]';
const MONO = 'font-mono text-[13px] text-[#eaf0f8] break-all';
const BTN_PRIMARY =
  'rounded-xl px-4 py-2.5 text-[13px] font-semibold text-[#04140f] bg-gradient-to-br from-[#2dd4bf] to-[#38bdf8] shadow-[0_4px_16px_-6px_rgba(45,212,191,0.5)] disabled:opacity-40 disabled:cursor-not-allowed transition-opacity';
const BTN_GHOST =
  'rounded-xl px-4 py-2.5 text-[13px] font-medium text-[#eaf0f8] border border-white/[0.12] hover:bg-white/[0.05] disabled:opacity-40 disabled:cursor-not-allowed transition-colors';

function usdc(units: string | undefined): string {
  if (!units) return '…';
  try {
    return `${fromBaseUnits(BigInt(units), USDC_DECIMALS)} USDC`;
  } catch {
    return '…';
  }
}

/**
 * Inbound chain abstraction: fund the hosted private account from Base
 * Sepolia over Circle CCTP V2, then shield the minted USDC into the STRK20
 * pool. The burn happens in the user's own Base wallet (or, when the server
 * holds an EVM key, from here); claim and shield run on the hosted account.
 */
export default function InboundPanel({ network }: { network: NetworkKey }) {
  const [runtime, setRuntime] = useState<RuntimeStatus | null>(null);
  const [runtimeError, setRuntimeError] = useState<string | null>(null);
  const [txInput, setTxInput] = useState('');
  const [status, setStatus] = useState<BurnStatus | null>(null);
  const [checking, setChecking] = useState(false);
  const [claiming, setClaiming] = useState(false);
  const [claim, setClaim] = useState<ClaimResult | null>(null);
  const [claimError, setClaimError] = useState<string | null>(null);
  const [shielding, setShielding] = useState(false);
  const [shield, setShield] = useState<ShieldResult | null>(null);
  const [shieldError, setShieldError] = useState<string | null>(null);
  const [burnAmount, setBurnAmount] = useState('');
  const [burning, setBurning] = useState(false);
  const [burnError, setBurnError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch('/api/fund/inbound/status')
      .then(async (res) => {
        const body = await res.json();
        if (!cancelled) setRuntime(body);
        if (!cancelled && !res.ok) {
          setRuntimeError(`Server runtime not configured: ${(body.missing || []).join(', ')}`);
        }
      })
      .catch(() => {
        if (!cancelled) setRuntimeError('Could not reach the inbound status API.');
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const checkStatus = useCallback(async (tx: string): Promise<BurnStatus | null> => {
    const res = await fetch(`/api/fund/inbound/status?tx=${tx}`);
    const body = await res.json();
    if (!res.ok) {
      return { burnTxHash: tx, phase: 'not_found', error: body.error };
    }
    return body as BurnStatus;
  }, []);

  const stopPolling = useCallback(() => {
    if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
  }, []);

  useEffect(() => stopPolling, [stopPolling]);

  async function handleCheck(tx?: string) {
    const hash = (tx ?? txInput).trim();
    if (!/^0x[0-9a-fA-F]{64}$/.test(hash)) {
      setStatus({
        burnTxHash: hash,
        phase: 'not_found',
        error: 'Enter the Base Sepolia burn transaction hash (0x + 64 hex).',
      });
      return;
    }
    setChecking(true);
    setClaim(null);
    setClaimError(null);
    setShield(null);
    setShieldError(null);
    try {
      const next = await checkStatus(hash);
      setStatus(next);
      // Attestation takes minutes for a Standard Transfer: keep polling until
      // it is claimable instead of making the user mash the button.
      stopPolling();
      if (next && (next.phase === 'attesting' || next.phase === 'not_found') && !next.error) {
        pollRef.current = setInterval(async () => {
          const polled = await checkStatus(hash).catch(() => null);
          if (polled) setStatus(polled);
          if (polled && polled.phase !== 'attesting' && polled.phase !== 'not_found') {
            stopPolling();
          }
        }, 6000);
      }
    } finally {
      setChecking(false);
    }
  }

  async function handleClaim() {
    if (!status) return;
    setClaiming(true);
    setClaimError(null);
    try {
      const res = await fetch('/api/fund/inbound/claim', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ burnTxHash: status.burnTxHash }),
      });
      const body = await res.json();
      if (!res.ok) {
        setClaimError(body.error ?? 'Claim failed.');
        return;
      }
      setClaim(body as ClaimResult);
      setStatus({ ...status, phase: 'claimed' });
    } catch (err) {
      setClaimError(err instanceof Error ? err.message : 'Claim failed.');
    } finally {
      setClaiming(false);
    }
  }

  async function handleShield() {
    const units =
      claim?.mintedDelta ??
      (claim && BigInt(claim.amount) - BigInt(claim.feeExecuted) > 0n
        ? (BigInt(claim.amount) - BigInt(claim.feeExecuted)).toString()
        : status?.amount);
    if (!units) return;
    setShielding(true);
    setShieldError(null);
    try {
      const res = await fetch('/api/fund/inbound/shield', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ amountUnits: units }),
      });
      const body = await res.json();
      if (!res.ok) {
        setShieldError(body.error ?? 'Shield failed.');
        return;
      }
      setShield(body as ShieldResult);
    } catch (err) {
      setShieldError(err instanceof Error ? err.message : 'Shield failed.');
    } finally {
      setShielding(false);
    }
  }

  async function handleServerBurn() {
    setBurnError(null);
    let units: bigint;
    try {
      const [whole, fraction = ''] = burnAmount.trim().split('.');
      if (!/^\d+$/.test(whole) || (fraction && !/^\d{1,6}$/.test(fraction))) {
        throw new Error('Enter a USDC amount like 1.5');
      }
      units = BigInt(whole) * 1_000_000n + BigInt(fraction.padEnd(6, '0') || '0');
      if (units <= 0n) throw new Error('Amount must be positive.');
    } catch (err) {
      setBurnError(err instanceof Error ? err.message : 'Invalid amount.');
      return;
    }
    setBurning(true);
    try {
      const res = await fetch('/api/fund/inbound/burn', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ amountUnits: units.toString() }),
      });
      const body = await res.json();
      if (!res.ok) {
        setBurnError(body.error ?? `Burn unavailable: ${(body.missing || []).join(', ')}`);
        return;
      }
      setTxInput(body.burnTxHash);
      await handleCheck(body.burnTxHash);
    } catch (err) {
      setBurnError(err instanceof Error ? err.message : 'Burn failed.');
    } finally {
      setBurning(false);
    }
  }

  const hosted = runtime?.hostedAccount;
  const claimable = status?.phase === 'ready_to_claim';
  const claimed = claim !== null || status?.phase === 'claimed';

  return (
    <div className="flex flex-col gap-4">
      <p className="text-[13px] leading-relaxed text-[#7a859c]">
        Bring USDC in from Base and shield it straight into your private balance, three steps.
      </p>
      <HowThisWorks>
        <p>
          The transfer from Base and the mint on Starknet are both public onchain events, the
          same as any bridge. Only the last step, shielding, moves the balance behind your
          private key.
        </p>
      </HowThisWorks>

      <div className={CARD}>
        <div className={LABEL}>Step 1 - Send USDC from Base</div>
        <div className="mt-2 flex flex-col gap-1.5">
          <div className="text-[13px] text-[#7a859c]">Send to this account:</div>
          {hosted ? (
            <button
              type="button"
              className="group flex items-center gap-2 text-left"
              onClick={() => {
                navigator.clipboard?.writeText(hosted);
                setCopied(true);
                setTimeout(() => setCopied(false), 1500);
              }}
            >
              <span className={MONO}>{hosted}</span>
              <span className="shrink-0 text-[11px] text-[#2dd4bf] opacity-0 transition-opacity group-hover:opacity-100">
                {copied ? 'copied' : 'copy'}
              </span>
            </button>
          ) : (
            <span className={MONO}>{runtimeError ?? '…'}</span>
          )}
          <div className="text-[12px] leading-relaxed text-[#7a859c]">
            Use any Base wallet or bridge that supports Circle&apos;s CCTP transfer to Starknet, no
            Circle fee, finalizes in a few minutes.
          </div>
          <HowThisWorks label="Calling this without a bridge UI">
            <p>
              Call <span className="font-mono">depositForBurn</span> on TokenMessengerV2{' '}
              <span className="font-mono">
                {runtime ? shortHex(runtime.contracts.baseSepolia.tokenMessengerV2) : '…'}
              </span>{' '}
              with destination domain {runtime?.contracts.starknetSepolia.domain ?? 25}, this address
              left-padded to bytes32 as the mint recipient, and finality threshold 2000 (Standard
              Transfer).
            </p>
          </HowThisWorks>
        </div>

        {runtime?.evmSignerConfigured ? (
          <div className="mt-3 flex flex-col gap-2 border-t border-white/[0.06] pt-3 sm:flex-row sm:items-center">
            <input
              className="w-full rounded-xl border border-white/[0.12] bg-transparent px-3 py-2.5 font-mono text-[13px] text-[#eaf0f8] placeholder-[#5b6478] outline-none focus:border-[#2dd4bf]/50 sm:w-40"
              placeholder="0.5"
              inputMode="decimal"
              value={burnAmount}
              onChange={(e) => setBurnAmount(e.target.value)}
            />
            <button
              type="button"
              className={BTN_GHOST}
              disabled={burning || !burnAmount}
              onClick={handleServerBurn}
            >
              {burning ? 'Sending from Base…' : 'Send from the hosted Base wallet'}
            </button>
          </div>
        ) : null}
        {burnError ? <div className="mt-2 text-[13px] text-[#f0716f]">{burnError}</div> : null}
      </div>

      <div className={CARD}>
        <div className={LABEL}>Step 2 - Claim the mint on Starknet</div>
        <div className="mt-2 flex flex-col gap-2 sm:flex-row">
          <input
            className="w-full rounded-xl border border-white/[0.12] bg-transparent px-3 py-2.5 font-mono text-[13px] text-[#eaf0f8] placeholder-[#5b6478] outline-none focus:border-[#2dd4bf]/50"
            placeholder="Base Sepolia burn transaction hash (0x…)"
            value={txInput}
            onChange={(e) => setTxInput(e.target.value)}
          />
          <button
            type="button"
            className={BTN_GHOST}
            disabled={checking || !txInput.trim()}
            onClick={() => handleCheck()}
          >
            {checking ? 'Checking…' : 'Check'}
          </button>
        </div>

        {status ? (
          <div className="mt-3 flex flex-col gap-1.5 text-[13px]">
            {status.error ? (
              <div className="text-[#f0716f]">{status.error}</div>
            ) : (
              <>
                <div className="flex items-center gap-2">
                  <span
                    className={`inline-block h-1.5 w-1.5 rounded-full ${
                      status.phase === 'claimed'
                        ? 'bg-[#2dd4bf]'
                        : status.phase === 'ready_to_claim'
                          ? 'bg-[#38bdf8]'
                          : 'bg-[#eab308] animate-pulse'
                    }`}
                  />
                  <span className="text-[#eaf0f8]">
                    {status.phase === 'not_found' &&
                      'Circle has not indexed this burn yet - polling…'}
                    {status.phase === 'attesting' &&
                      `Waiting for Base finality and Circle attestation (${status.irisStatus ?? 'pending'})…`}
                    {status.phase === 'ready_to_claim' &&
                      `Attested: ${usdc(status.amount)} ready to mint on Starknet.`}
                    {status.phase === 'claimed' && 'Minted on Starknet.'}
                  </span>
                </div>
                {status.amount ? (
                  <div className="text-[#7a859c]">
                    Amount {usdc(status.amount)} · Circle fee {usdc(status.feeExecuted ?? '0')}
                  </div>
                ) : null}
              </>
            )}
          </div>
        ) : null}

        <button
          type="button"
          className={`${BTN_PRIMARY} mt-3`}
          disabled={!claimable || claiming || !runtime?.ready}
          onClick={handleClaim}
        >
          {claiming ? 'Claiming…' : 'Claim on Starknet'}
        </button>
        {claimError ? <div className="mt-2 text-[13px] text-[#f0716f]">{claimError}</div> : null}
        {claim?.starknetTxHash ? (
          <div className="mt-2 text-[13px] text-[#7a859c]">
            Minted {usdc(claim.mintedDelta ?? claim.amount)} ·{' '}
            <a
              className="text-[#38bdf8] hover:underline"
              href={explorerTxUrl(network, claim.starknetTxHash)}
              target="_blank"
              rel="noreferrer"
            >
              {shortHex(claim.starknetTxHash)} ↗
            </a>
          </div>
        ) : null}
        {claim?.phase === 'already_claimed' ? (
          <div className="mt-2 text-[13px] text-[#7a859c]">
            This burn was already claimed on Starknet - continue to shielding.
          </div>
        ) : null}
      </div>

      <div className={CARD}>
        <div className={LABEL}>Step 3 - Shield it</div>
        <p className="mt-2 text-[13px] leading-relaxed text-[#7a859c]">
          Move the USDC you just received into your shielded balance. This is the step that
          makes it private - kept as its own step so the public arrival and the private deposit
          are each visible on their own.
        </p>
        <button
          type="button"
          className={`${BTN_PRIMARY} mt-3`}
          disabled={!claimed || shielding || !runtime?.ready}
          onClick={handleShield}
        >
          {shielding ? 'Shielding…' : 'Shield it'}
        </button>
        {shieldError ? <div className="mt-2 text-[13px] text-[#f0716f]">{shieldError}</div> : null}
        {shield ? (
          <div className="mt-2 flex flex-col gap-1 text-[13px] text-[#7a859c]">
            <div>
              Shielded {usdc(shield.amount)} ·{' '}
              <a
                className="text-[#38bdf8] hover:underline"
                href={explorerTxUrl(network, shield.starknetTxHash)}
                target="_blank"
                rel="noreferrer"
              >
                {shortHex(shield.starknetTxHash)} ↗
              </a>
            </div>
            <div>
              Private USDC notes: {usdc(shield.privateBefore)} → {usdc(shield.privateAfter)}
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}
