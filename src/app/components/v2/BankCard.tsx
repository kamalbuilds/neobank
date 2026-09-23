'use client';

import { cx } from './ui';

function ChipIcon() {
  return (
    <svg width="34" height="27" viewBox="0 0 38 30" fill="none" aria-hidden="true">
      <rect
        x="0.5"
        y="0.5"
        width="37"
        height="29"
        rx="4"
        fill="none"
        stroke="rgba(232,230,225,0.34)"
      />
      <line x1="13" y1="0.5" x2="13" y2="29.5" stroke="rgba(232,230,225,0.22)" />
      <line x1="25" y1="0.5" x2="25" y2="29.5" stroke="rgba(232,230,225,0.22)" />
      <line x1="0.5" y1="10" x2="37.5" y2="10" stroke="rgba(232,230,225,0.22)" />
      <line x1="0.5" y1="20" x2="37.5" y2="20" stroke="rgba(232,230,225,0.22)" />
    </svg>
  );
}

function ContactlessIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M8.5 8.5a5 5 0 0 1 0 7" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" opacity="0.45" />
      <path d="M11.3 5.7a9 9 0 0 1 0 12.6" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" opacity="0.7" />
      <path d="M14.1 3a13 13 0 0 1 0 18" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}

export type BankCardStatus = 'checking' | 'ready' | 'blocked';

const STATUS_LABEL: Record<BankCardStatus, string> = {
  ready: 'Active',
  blocked: 'Blocked',
  checking: 'Checking',
};

/**
 * The Sealed card, as a matte graphite plate rather than a lit gradient.
 * Address-derived, never a real PAN: privacy is the product, so nothing here
 * is a payable card number.
 *
 * With no account address there is nothing to render, and padding the empty
 * string to sixteen zeroes produced a card face reading 0000 0000 0000 0000,
 * which looks like a mock. It now shows rules where the digits would sit and
 * says so, and the status chip only claims Active when the caller passes a
 * status it actually checked.
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
  const raw = (accountAddress ?? '').replace(/^0x/, '');
  const issued = raw.length > 0;
  const digits = issued ? raw.padStart(16, '0').slice(-16) : '';
  const groups = issued
    ? [digits.slice(0, 4), digits.slice(4, 8), digits.slice(8, 12), digits.slice(12, 16)]
    : [];

  return (
    <div
      className={cx(
        'relative aspect-[1.586/1] w-full max-w-[420px] overflow-hidden rounded-[4px]',
        'bg-chrome-3 border border-[color:var(--line-strong)] elevate-2',
      )}
      role="img"
      aria-label={
        issued
          ? `Sealed private card, ${STATUS_LABEL[status].toLowerCase()}, ending in ${digits.slice(-4)}`
          : `Sealed private card, ${STATUS_LABEL[status].toLowerCase()}, no number issued yet`
      }
    >
      <div
        className="pointer-events-none absolute inset-x-0 top-0 h-px bg-[rgba(255,255,255,0.07)]"
        aria-hidden="true"
      />

      <div className="relative flex h-full flex-col justify-between p-5 sm:p-6">
        <div className="flex items-start justify-between gap-3">
          <span className="font-[family-name:var(--font-display)] text-[24px] leading-none tracking-[-0.02em] text-ink">
            Sealed
          </span>
          <span
            className={cx(
              'inline-flex items-center gap-2 rounded-full border px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.1em]',
              status === 'ready'
                ? 'border-[color:var(--green-soft)] text-[color:var(--green)]'
                : status === 'blocked'
                  ? 'border-[color:var(--seal-soft-2)] text-seal-bright'
                  : 'border-[color:var(--line-strong)] text-muted',
            )}
          >
            <span
              className={cx(
                'size-1.5 rounded-full',
                status === 'ready'
                  ? 'bg-[color:var(--green)]'
                  : status === 'blocked'
                    ? 'bg-seal'
                    : 'bg-[color:var(--muted)]',
              )}
              aria-hidden="true"
            />
            {STATUS_LABEL[status]}
          </span>
        </div>

        <div className="flex items-center gap-3 text-muted">
          <ChipIcon />
          <ContactlessIcon />
        </div>

        <div>
          {issued ? (
            <div className="figure flex gap-4 text-[17px] font-medium tracking-[0.06em] text-ink sm:text-[19px]">
              {groups.map((g, i) => (
                <span key={i}>{g}</span>
              ))}
            </div>
          ) : (
            <div className="flex items-end gap-4" aria-hidden="true">
              {[0, 1, 2, 3].map((i) => (
                <span key={i} className="block h-px w-[3.1rem] bg-[color:var(--line-strong)]" />
              ))}
            </div>
          )}
          <div className="mt-4 flex items-end justify-between gap-4">
            <div>
              <div className="text-[11px] font-medium text-muted">Cardholder</div>
              <div className="mt-1 text-[13px] text-ink">
                {issued ? 'Hosted account' : 'No number issued'}
              </div>
            </div>
            {dailyCap ? (
              <div className="text-right">
                <div className="text-[11px] font-medium text-muted">Daily cap</div>
                <div className="figure mt-1 text-[13px] font-semibold text-ink">{dailyCap}</div>
              </div>
            ) : null}
            <div className="text-right">
              <div className="text-[11px] font-medium text-muted">Network</div>
              <div className="figure mt-1 text-[13px] font-semibold text-ink">{network}</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
