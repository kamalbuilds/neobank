'use client';

import { useEffect, useRef, useState, type HTMLAttributes, type ReactNode } from 'react';
import { usePathname } from 'next/navigation';

/**
 * Shared v2 primitives, rebuilt as a document system.
 *
 * The product's argument is that a private balance is a document only you can
 * read, so the app is made of documents: graphite chrome holds the controls,
 * cream paper holds the statements of fact (a balance, a receipt, a ledger).
 * Hairlines instead of glass, 4px corners, tabular figures, and a real
 * redaction bar rather than a blur.
 */

export function cx(...parts: Array<string | false | null | undefined>): string {
  return parts.filter(Boolean).join(' ');
}

/** Graphite chrome card. `interactive` adds the press/hover treatment. */
export function Panel({
  children,
  className,
  interactive = false,
  padded = true,
  ...rest
}: HTMLAttributes<HTMLDivElement> & { interactive?: boolean; padded?: boolean }) {
  return (
    <div
      className={cx('doc', padded && 'p-5 sm:p-6', interactive && 'doc-interactive', className)}
      {...rest}
    >
      {children}
    </div>
  );
}

/**
 * Cream statement sheet. Anything that states a fact about your money lands
 * here: the balance, a receipt, a ledger of deposits. Dark ink on paper inside
 * graphite chrome is the whole visual argument, so this is deliberately rare.
 */
export function PaperSheet({
  children,
  className,
  torn = false,
  padded = true,
  ...rest
}: HTMLAttributes<HTMLDivElement> & { torn?: boolean; padded?: boolean }) {
  return (
    <div
      className={cx('paper relative', torn && 'paper-torn', padded && 'p-5 sm:p-6', className)}
      {...rest}
    >
      {children}
    </div>
  );
}

/** Any number, amount, address, hash, block or date. Tabular, so columns line up. */
export function Figure({ children, className, ...rest }: HTMLAttributes<HTMLSpanElement>) {
  return (
    <span className={cx('figure', className)} {...rest}>
      {children}
    </span>
  );
}

/**
 * A real redaction: a solid ink bar sized to the glyphs it covers, lifted with
 * a scaleX wipe on reveal. A blur is a hint; a bar is a redaction, and that
 * difference is the product. While hidden the covered text is unselectable and
 * hidden from assistive tech, so the value is not merely visually obscured.
 *
 * Pass a non-breaking space plus a width class to draw a bar over nothing,
 * which is what an unconnected account shows: no number is invented to fill it.
 */
export function Redacted({
  children,
  revealed,
  tone = 'paper',
  srLabel = 'Hidden',
  className,
}: {
  children: ReactNode;
  revealed: boolean;
  tone?: 'paper' | 'chrome';
  srLabel?: string;
  className?: string;
}) {
  const bar = (
    <span
      aria-hidden={revealed ? undefined : 'true'}
      className={cx(
        'redact',
        tone === 'chrome' && 'redact-on-chrome',
        revealed && 'redact-reveal text-inherit! select-auto!',
        className,
      )}
    >
      {children}
    </span>
  );
  if (revealed) return bar;
  return (
    <>
      {bar}
      <span className="sr-only">{srLabel}</span>
    </>
  );
}

/** One ruled line of a ledger: what it is on the left, the figure on the right. */
export function LedgerRow({
  label,
  hint,
  children,
  tone = 'chrome',
  className,
}: {
  label: ReactNode;
  hint?: ReactNode;
  children: ReactNode;
  tone?: 'paper' | 'chrome';
  className?: string;
}) {
  const paper = tone === 'paper';
  return (
    <div
      className={cx(
        'flex items-baseline justify-between gap-4 border-t py-2.5 first:border-t-0',
        paper ? 'border-[var(--paper-line)]' : 'border-[var(--line)]',
        className,
      )}
    >
      <span className={cx('min-w-0 text-[13px] leading-snug', paper ? 'text-paper-muted' : 'text-muted')}>
        {label}
        {hint ? <span className="mt-1 block text-[11px] leading-snug opacity-85">{hint}</span> : null}
      </span>
      <span
        className={cx(
          'figure shrink-0 text-right text-[13px] font-semibold',
          paper ? 'text-paper-ink' : 'text-ink',
        )}
      >
        {children}
      </span>
    </div>
  );
}

/** Labelled form control. The label is the caption on a form, not an eyebrow. */
export function Field({
  label,
  hint,
  htmlFor,
  children,
  className,
}: {
  label: ReactNode;
  hint?: ReactNode;
  htmlFor?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={cx('flex flex-col gap-2', className)}>
      <label
        htmlFor={htmlFor}
        className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted"
      >
        {label}
      </label>
      {children}
      {hint ? <p className="text-[13px] leading-relaxed text-muted">{hint}</p> : null}
    </div>
  );
}

/**
 * The three states every fetch owes the reader. An empty state says what to do
 * next; "nothing here" on its own is indistinguishable from broken.
 */
export function PanelState({
  kind,
  title,
  children,
  rows = 3,
  tone = 'chrome',
  className,
}: {
  kind: 'loading' | 'empty' | 'error';
  title: string;
  children?: ReactNode;
  rows?: number;
  tone?: 'paper' | 'chrome';
  className?: string;
}) {
  const paper = tone === 'paper';
  if (kind === 'loading') {
    return (
      <div
        className={cx('flex flex-col gap-2', className)}
        role="status"
        aria-busy="true"
        aria-label={title}
      >
        {Array.from({ length: rows }, (_, i) => (
          <Skeleton
            key={i}
            className={cx(
              'h-[44px]',
              paper && 'skeleton-paper',
              i === 1 && 'opacity-75',
              i > 1 && 'opacity-50',
            )}
          />
        ))}
      </div>
    );
  }
  const error = kind === 'error';
  return (
    <div
      role={error ? 'alert' : undefined}
      className={cx(
        'border-l-2 py-0.5 pl-3.5',
        error
          ? 'border-[var(--seal)]'
          : paper
            ? 'border-[var(--paper-line)]'
            : 'border-[var(--line-strong)]',
        className,
      )}
    >
      <p
        className={cx(
          'text-[13px] font-medium leading-snug',
          error ? 'text-seal-bright' : paper ? 'text-paper-ink' : 'text-ink',
        )}
      >
        {title}
      </p>
      {children ? (
        <div
          className={cx(
            'mt-1 text-[13px] leading-relaxed',
            paper ? 'text-paper-muted' : 'text-muted',
          )}
        >
          {children}
        </div>
      ) : null}
    </div>
  );
}

/**
 * The one place a pill is allowed: a status or network chip.
 *
 * Sized at 13px and never smaller, because a network label is the difference
 * between real money and test money and a reviewer has to be able to read it
 * without zooming. `live` is the loud register (full ink, ledger green dot),
 * `neutral` the quiet one, so mainnet can never render softer than sepolia.
 */
export function StatusPill({
  tone = 'neutral',
  children,
  className,
  ...rest
}: HTMLAttributes<HTMLSpanElement> & { tone?: 'live' | 'seal' | 'neutral' }) {
  const dot =
    tone === 'live'
      ? 'bg-[var(--green)]'
      : tone === 'seal'
        ? 'bg-[var(--seal-text)]'
        : 'bg-[var(--muted)]';
  const text =
    tone === 'live'
      ? 'text-ink font-semibold'
      : tone === 'seal'
        ? 'text-seal-bright font-semibold'
        : 'text-muted font-medium';
  return (
    <span
      className={cx(
        'figure inline-flex items-center gap-2 rounded-full border border-[var(--line)] bg-white/[0.03] px-2.5 py-1 text-[13px] leading-none',
        text,
        className,
      )}
      {...rest}
    >
      <span aria-hidden="true" className={cx('size-1.5 shrink-0 rounded-full', dot)} />
      {children}
    </span>
  );
}

/**
 * Fades and lifts content in on mount, and re-plays on pathname change so
 * moving between account routes feels like navigation, not a hard swap.
 * Transform + opacity only, per the motion-performance skill.
 */
export function RouteTransition({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  return (
    <div key={pathname} className="animate-rise-in min-w-0">
      {children}
    </div>
  );
}

/** Rectangular loading placeholder. Use for the exact shape of the content it replaces. */
export function Skeleton({ className }: { className?: string }) {
  return <div aria-hidden="true" className={cx('skeleton', className)} />;
}

/**
 * Protocol detail collapsed behind one line by default. Every panel used to
 * put its "how this actually settles onchain" paragraph directly in the
 * default view - a changelog reading as product copy. This is where that
 * detail goes instead: still honest, still readable, never the first thing
 * a user sees. Presented as a footnote on a document, marked with a dagger
 * and opening against a ruled margin, rather than a dashboard disclosure row.
 */
export function HowThisWorks({
  children,
  label = 'How this works',
  className,
}: {
  children: ReactNode;
  label?: string;
  className?: string;
}) {
  return (
    <details className={cx('group', className)}>
      <summary className="inline-flex cursor-pointer select-none list-none items-baseline gap-1.5 rounded-[2px] text-[13px] text-muted transition-colors duration-150 hover:text-ink marker:content-none [&::-webkit-details-marker]:hidden">
        <span
          aria-hidden="true"
          className="figure relative -top-[0.4em] text-[11px] leading-none text-seal-bright"
        >
          †
        </span>
        <span className="underline decoration-dotted decoration-[var(--line-strong)] underline-offset-[5px] group-open:decoration-transparent">
          {label}
        </span>
      </summary>
      <div className="mt-2 border-l border-[var(--line-strong)] pl-3.5 text-[13px] leading-relaxed text-muted [&>p+p]:mt-2">
        {children}
      </div>
    </details>
  );
}

type NumberTickerProps = {
  value: number;
  decimals?: number;
  duration?: number;
  className?: string;
  prefix?: string;
  suffix?: string;
};

/**
 * Counts up to `value` once when it changes, then stops (no idle rAF loop).
 * Respects prefers-reduced-motion by snapping straight to the target.
 */
export function NumberTicker({
  value,
  decimals = 2,
  duration = 700,
  className,
  prefix = '',
  suffix = '',
}: NumberTickerProps) {
  const [display, setDisplay] = useState(value);
  const fromRef = useRef(value);
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    const reduceMotion =
      typeof window !== 'undefined' &&
      window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

    if (reduceMotion || !Number.isFinite(value)) {
      setDisplay(value);
      fromRef.current = value;
      return;
    }

    const from = fromRef.current;
    const to = value;
    if (from === to) return;

    const start = performance.now();
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(1 - t, 3);
      setDisplay(from + (to - from) * eased);
      if (t < 1) {
        rafRef.current = requestAnimationFrame(tick);
      } else {
        fromRef.current = to;
        rafRef.current = null;
      }
    };
    rafRef.current = requestAnimationFrame(tick);

    return () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  return (
    <span className={cx('figure', className)}>
      {prefix}
      {display.toLocaleString(undefined, {
        minimumFractionDigits: decimals,
        maximumFractionDigits: decimals,
      })}
      {suffix}
    </span>
  );
}
