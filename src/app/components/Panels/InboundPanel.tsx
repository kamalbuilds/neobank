'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { explorerTxUrl, type NetworkKey } from '@/utils/constants';
import { fromBaseUnits, shortHex } from '../lib/format';
import { ui } from '../lib/panelUi';
import { Figure, HowThisWorks, PanelState } from '../v2/ui';

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

// A numbered step is a document section, not a floating card: a hairline box,
// a ruled caption, and figures in the same mono column as everywhere else.
const CARD = 'doc p-4 sm:p-5';
const LABEL =
  'text-[11px] font-semibold uppercase tracking-[0.16em] text-muted border-b-[3px] border-double border-[var(--line-strong)] pb-2.5 block';
const MONO = 'figure text-[13px] text-ink break-all';
const BTN_PRIMARY = `${ui.btnCta} w-auto px-4 py-2.5 text-[13px]`;
const BTN_GHOST = `${ui.tab} px-4 py-2.5`;
const ERROR_TEXT = 'mt-2 border-l-2 border-[var(--seal)] pl-3 text-[13px] font-medium text-seal-bright';

function usdc(units: string | undefined): string {
  if (!units) return '…';
  try {
    return `${fromBaseUnits(BigInt(units), USDC_DECIMALS)} USDC`;
  } catch {
    return '…';
  }
}

/**
 * Inbound chain abstraction: fund the hosted (operator-visible) account from
 * Base Sepolia over Circle CCTP V2, then shield the minted USDC into the
 * STRK20 pool. The burn happens in the user's own Base wallet (or, when the
 * server holds an EVM key, from here); claim and shield run on the hosted
 * account.
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
      <div>
        <h2 className={ui.heading}>Bring USDC in from Base</h2>
        <p className={`${ui.note} mt-1.5`}>
          Bring USDC in from Base and shield it into the hosted account&apos;s balance, three steps.
        </p>
      </div>
      <HowThisWorks>
        <p>
          The transfer from Base and the mint on Starknet are both public onchain events, the
          same as any bridge. The last step, shielding, moves the balance into the STRK20 pool
          behind the hosted account&apos;s viewing key - which Sealed&apos;s operator holds, not
          you. This is a custodial account, unlike your own self-custody balance elsewhere in
          Sealed.
        </p>
      </HowThisWorks>

      <div className={CARD}>
        <div className={LABEL}>Step 1 - Send USDC from Base</div>
        <div className="mt-3 flex flex-col gap-2">
          <div className={ui.note}>Send to this account:</div>
          {hosted ? (
            <button
              type="button"
              className="group flex items-center gap-2 rounded-[3px] text-left"
              onClick={() => {
                navigator.clipboard?.writeText(hosted);
                setCopied(true);
                setTimeout(() => setCopied(false), 1500);
              }}
            >
              <span className={MONO}>{hosted}</span>
              <span className="figure shrink-0 text-[13px] text-seal-bright opacity-0 transition-opacity group-hover:opacity-100">
                {copied ? 'copied' : 'copy'}
              </span>
            </button>
          ) : runtimeError ? (
            <PanelState kind="error" title="Could not read the hosted account">
              {runtimeError} Nothing on this route can be started until the server runtime answers,
              so no address is shown rather than a guessed one.
            </PanelState>
          ) : (
            <PanelState kind="loading" rows={1} title="Reading the hosted account from the server" />
          )}
          <p className={ui.note}>
            Use any Base wallet or bridge that supports Circle&apos;s CCTP transfer to Starknet, no
            Circle fee, finalizes in a few minutes.
          </p>
          <HowThisWorks label="Calling this without a bridge UI">
            <p>
              Call <Figure className="text-ink">depositForBurn</Figure> on TokenMessengerV2{' '}
              <Figure className="text-ink">
                {runtime ? shortHex(runtime.contracts.baseSepolia.tokenMessengerV2) : '…'}
              </Figure>{' '}
              with destination domain{' '}
              <Figure className="text-ink">
                {runtime?.contracts.starknetSepolia.domain ?? 25}
              </Figure>
              , this address left-padded to bytes32 as the mint recipient, and finality threshold
              2000 (Standard Transfer).
            </p>
          </HowThisWorks>
        </div>

        {runtime?.evmSignerConfigured ? (
          <div className="mt-3 flex flex-col gap-2 border-t border-[var(--line)] pt-3 sm:flex-row sm:items-center">
            <input
              className={`${ui.inputField} py-2.5 sm:w-40`}
              placeholder="0.5"
              inputMode="decimal"
              aria-label="USDC amount to send from the hosted Base wallet"
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
        {burnError ? <div className={ERROR_TEXT}>{burnError}</div> : null}
      </div>

      <div className={CARD}>
        <div className={LABEL}>Step 2 - Claim the mint on Starknet</div>
        <div className="mt-3 flex flex-col gap-2 sm:flex-row">
          <input
            className={`${ui.inputField} py-2.5`}
            placeholder="Base Sepolia burn transaction hash (0x…)"
            aria-label="Base Sepolia burn transaction hash"
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

        {checking && !status ? (
          <PanelState
            kind="loading"
            rows={1}
            title="Asking Circle about this burn"
            className="mt-3"
          />
        ) : status ? (
          <div className="mt-3 flex flex-col gap-1.5 text-[13px]">
            {status.error ? (
              <PanelState kind="error" title="Circle could not be asked about this burn">
                {status.error} Paste the Base Sepolia burn hash exactly as the explorer shows it,
                then press Check again.
              </PanelState>
            ) : (
              <>
                <div className="flex items-center gap-2">
                  <span
                    className={`inline-block h-1.5 w-1.5 shrink-0 rounded-full ${
                      status.phase === 'claimed' || status.phase === 'ready_to_claim'
                        ? 'bg-[var(--green)]'
                        : 'bg-[var(--muted)] animate-pulse-soft'
                    }`}
                  />
                  <span className="text-ink">
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
                  <Figure className="text-muted">
                    Amount {usdc(status.amount)} · Circle fee {usdc(status.feeExecuted ?? '0')}
                  </Figure>
                ) : null}
              </>
            )}
          </div>
        ) : (
          <PanelState kind="empty" title="No burn to track yet" className="mt-3">
            Paste the Base Sepolia transaction hash from step 1. This panel then polls Circle every
            six seconds until the transfer is attested and claimable.
          </PanelState>
        )}

        <button
          type="button"
          className={`${BTN_PRIMARY} mt-3`}
          disabled={!claimable || claiming || !runtime?.ready}
          onClick={handleClaim}
        >
          {claiming ? 'Claiming…' : 'Claim on Starknet'}
        </button>
        {claimError ? <div className={ERROR_TEXT}>{claimError}</div> : null}
        {claim?.starknetTxHash ? (
          <Figure className="mt-2 block text-[13px] text-muted">
            Minted {usdc(claim.mintedDelta ?? claim.amount)} on{' '}
            {network === 'mainnet' ? 'Starknet mainnet' : 'Starknet Sepolia'} ·{' '}
            <a
              className="font-semibold text-seal-bright underline decoration-[var(--seal-soft-2)] underline-offset-[3px] hover:decoration-[var(--seal-text)]"
              href={explorerTxUrl(network, claim.starknetTxHash)}
              target="_blank"
              rel="noreferrer"
            >
              {shortHex(claim.starknetTxHash)} ↗
            </a>
          </Figure>
        ) : null}
        {claim?.phase === 'already_claimed' ? (
          <p className={`${ui.note} mt-2`}>
            This burn was already claimed on Starknet - continue to shielding.
          </p>
        ) : null}
      </div>

      <div className={CARD}>
        <div className={LABEL}>Step 3 - Shield it</div>
        <p className={`${ui.note} mt-3`}>
          Move the USDC you just received into the hosted account&apos;s shielded balance. This
          step moves it behind the STRK20 pool - kept as its own step so the public arrival and
          the pool deposit are each visible on their own. The operator still holds the viewing
          key for this account.
        </p>
        <button
          type="button"
          className={`${BTN_PRIMARY} mt-3`}
          disabled={!claimed || shielding || !runtime?.ready}
          onClick={handleShield}
        >
          {shielding ? 'Shielding…' : 'Shield it'}
        </button>
        {shieldError ? <div className={ERROR_TEXT}>{shieldError}</div> : null}
        {shielding && !shield ? (
          <PanelState
            kind="loading"
            rows={1}
            title="Depositing the minted USDC into the pool"
            className="mt-3"
          />
        ) : shield ? (
          <div className="mt-3 flex flex-col gap-1">
            <Figure className="text-[13px] text-muted">
              Shielded {usdc(shield.amount)} ·{' '}
              <a
                className="font-semibold text-seal-bright underline decoration-[var(--seal-soft-2)] underline-offset-[3px] hover:decoration-[var(--seal-text)]"
                href={explorerTxUrl(network, shield.starknetTxHash)}
                target="_blank"
                rel="noreferrer"
              >
                {shortHex(shield.starknetTxHash)} ↗
              </a>
            </Figure>
            <Figure className="text-[13px] text-muted">
              Shielded USDC notes: {usdc(shield.privateBefore)} to {usdc(shield.privateAfter)}
            </Figure>
          </div>
        ) : !claimed ? (
          <PanelState kind="empty" title="Nothing to shield yet" className="mt-3">
            Finish step 2 first. Once the mint is claimed, the minted amount becomes shieldable
            here and the before and after note balances print below.
          </PanelState>
        ) : null}
      </div>
    </div>
  );
}
