'use client';

import { cx } from './ui';

function ChipIcon() {
  return (
    <svg width="38" height="30" viewBox="0 0 38 30" fill="none" aria-hidden="true">
      <rect x="0.5" y="0.5" width="37" height="29" rx="6" fill="url(#chip-gradient)" stroke="rgba(0,0,0,0.25)" />
      <line x1="13" y1="0.5" x2="13" y2="29.5" stroke="rgba(0,0,0,0.22)" />
      <line x1="25" y1="0.5" x2="25" y2="29.5" stroke="rgba(0,0,0,0.22)" />
      <line x1="0.5" y1="10" x2="37.5" y2="10" stroke="rgba(0,0,0,0.22)" />
      <line x1="0.5" y1="20" x2="37.5" y2="20" stroke="rgba(0,0,0,0.22)" />
      <defs>
        <linearGradient id="chip-gradient" x1="0" y1="0" x2="38" y2="30" gradientUnits="userSpaceOnUse">
          <stop stopColor="#f4e9c8" />
          <stop offset="1" stopColor="#d4bf87" />
        </linearGradient>
      </defs>
    </svg>
  );
}

function ContactlessIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M8.5 8.5a5 5 0 0 1 0 7" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" opacity="0.5" />
      <path d="M11.3 5.7a9 9 0 0 1 0 12.6" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" opacity="0.75" />
      <path d="M14.1 3a13 13 0 0 1 0 18" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}

export type BankCardStatus = 'checking' | 'ready' | 'blocked';

/**
 * The Sotto card, rendered as an actual bank-card face rather than a settled
 * status row. Address-derived, never a real PAN: privacy is the product, so
 * nothing here is a payable card number.
 */
export function BankCard({
  accountAddress,
  network,
  status,
  dailyCap,
}: {
  accountAddress?: string;
  network: string;
  status: BankCardStatus;
  dailyCap?: string;
}) {
  const digits = (accountAddress ?? '').replace(/^0x/, '').padStart(16, '0').slice(-16);
  const groups = [digits.slice(0, 4), digits.slice(4, 8), digits.slice(8, 12), digits.slice(12, 16)];

  return (
    <div
      className={cx(
        'relative aspect-[1.586/1] w-full max-w-[420px] overflow-hidden rounded-[22px]',
        'bg-gradient-to-br from-[#0d3a35] via-[#0a2e34] to-[#081b2e]',
        'border border-white/[0.08] elevate-2',
      )}
      role="img"
      aria-label={`Sotto private card, ${status === 'ready' ? 'active' : status === 'blocked' ? 'blocked' : 'checking status'}, ending in ${digits.slice(-4) || '----'}`}
    >
      {/* Sheen sweep: one-shot on mount, transform-only, respects reduced motion via globals.css media query on animation-* */}
      <div className="pointer-events-none absolute inset-y-0 left-0 w-1/3 bg-gradient-to-r from-transparent via-white/[0.06] to-transparent [animation:cardSheen_1.4s_ease-out_1]" />
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(120%_100%_at_85%_-10%,rgba(45,212,191,0.22),transparent_60%)]" />
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(90%_70%_at_-10%_120%,rgba(56,189,248,0.14),transparent_60%)]" />

      <div className="relative flex h-full flex-col justify-between p-5 sm:p-6">
        <div className="flex items-start justify-between">
          <span className="font-[family-name:var(--font-display)] text-[20px] font-semibold tracking-[-0.01em] text-[#eaf0f8]">
            Sotto
          </span>
          <span
            className={cx(
              'inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.1em]',
              status === 'ready'
                ? 'border-[#34d399]/30 bg-[#34d399]/10 text-[#6ee9d5]'
                : status === 'blocked'
                  ? 'border-[#f87171]/30 bg-[#f87171]/10 text-[#fca5a5]'
                  : 'border-white/[0.12] bg-white/[0.06] text-[#a3acbd]',
            )}
          >
            <span
              className={cx(
                'size-1.5 rounded-full',
                status === 'ready' ? 'bg-[#34d399] shadow-[0_0_6px_rgba(52,211,153,0.8)]' : status === 'blocked' ? 'bg-[#f87171]' : 'bg-[#a3acbd]',
              )}
            />
            {status === 'ready' ? 'Active' : status === 'blocked' ? 'Blocked' : 'Checking'}
          </span>
        </div>

        <div className="flex items-center gap-3">
          <ChipIcon />
          <span className="text-[#eaf0f8]/80">
            <ContactlessIcon />
          </span>
        </div>

        <div>
          <div className="flex gap-3 font-[family-name:var(--font-mono-ui)] text-[16px] sm:text-[18px] tracking-[0.08em] tabular-nums text-[#eaf0f8]">
            {groups.map((g, i) => (
              <span key={i}>{g || '••••'}</span>
            ))}
          </div>
          <div className="mt-3.5 flex items-end justify-between">
            <div>
              <div className="text-[9px] font-semibold uppercase tracking-[0.14em] text-[#7fa8a0]">
                Cardholder
              </div>
              <div className="mt-0.5 text-[12px] font-medium uppercase tracking-[0.04em] text-[#d8deea]">
                Private account
              </div>
            </div>
            {dailyCap ? (
              <div className="text-right">
                <div className="text-[9px] font-semibold uppercase tracking-[0.14em] text-[#7fa8a0]">
                  Daily cap
                </div>
                <div className="mt-0.5 font-[family-name:var(--font-mono-ui)] text-[12px] tabular-nums text-[#d8deea]">
                  {dailyCap}
                </div>
              </div>
            ) : null}
            <div className="text-right">
              <div className="text-[9px] font-semibold uppercase tracking-[0.14em] text-[#7fa8a0]">Network</div>
              <div className="mt-0.5 text-[12px] font-medium text-[#d8deea]">{network}</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
