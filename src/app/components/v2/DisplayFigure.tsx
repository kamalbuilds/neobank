import type { ReactNode } from 'react';
import { cx } from './ui';

/**
 * The single display step above the 11/13/15/18/24/34 scale, reserved for the
 * one figure that carries a page's argument.
 *
 * Every page here used to set its heading at 34px and the number the page
 * exists to state at 18px, which reads as the title being louder than the
 * fact. 40px is the step the shielded balance on the account chrome already
 * uses, so a narrow viewport reuses it instead of inventing a second size;
 * 52px is the one new step. Mono and tabular, because it is a figure.
 */
export const DISPLAY_FIGURE =
  'figure text-[40px] sm:text-[52px] font-semibold leading-[0.95] tracking-[-0.03em]';

/**
 * The ink bar that stands where a figure would, at display size.
 *
 * Two things this does that Redacted() from ui.tsx cannot at this size. The
 * bar is drawn by `.redact::after` against the span's own box, so the span
 * needs a line box to have any height at all: a plain `{" "}` collapses and
 * the bar renders 1px tall, which is how the withheld amounts were shipping.
 * A non-breaking space is what the bar is sized against instead. And the
 * screen reader label carries its own font size rather than inheriting 52px,
 * so a type-scale audit reads the page's largest text as the figure rather
 * than as an invisible string meant for assistive tech.
 */
export function DisplayRedaction({ label, width = 'w-[6ch]' }: { label: string; width?: string }) {
  return (
    <>
      <span aria-hidden="true" className={cx('redact', width)}>
        {'\u00A0'}
      </span>
      <span className="sr-only text-[13px] font-normal tracking-normal">{label}</span>
    </>
  );
}

/**
 * A figure at display size with its provenance underneath. The provenance line
 * is not decoration: a number with no call and no block behind it is a rumour,
 * so nothing renders here without one.
 *
 * `value` takes a node rather than a string so a redaction bar can stand where
 * an undisclosed amount would be, at the same size, rather than the page
 * quietly dropping to a caption when it has nothing to show.
 */
export function DisplayFigure({
  label,
  value,
  unit,
  caption,
  provenance,
  tone = 'paper',
  className,
}: {
  label: string;
  value: ReactNode;
  unit?: string;
  caption?: ReactNode;
  provenance: ReactNode;
  tone?: 'paper' | 'chrome';
  className?: string;
}) {
  const paper = tone === 'paper';
  return (
    <div className={className}>
      <div
        className={cx(
          'text-[11px] font-semibold uppercase tracking-[0.16em]',
          paper ? 'text-paper-muted' : 'text-muted',
        )}
      >
        {label}
      </div>
      <div className="mt-2.5 flex flex-wrap items-baseline gap-x-2.5">
        <span className={cx(DISPLAY_FIGURE, paper ? 'text-paper-ink' : 'text-ink')}>{value}</span>
        {unit ? (
          <span
            className={cx(
              'figure text-[18px] font-semibold',
              paper ? 'text-paper-muted' : 'text-muted',
            )}
          >
            {unit}
          </span>
        ) : null}
      </div>
      {caption ? (
        <p
          className={cx(
            'mt-2.5 max-w-[46ch] text-[15px] leading-snug',
            paper ? 'text-paper-ink' : 'text-ink',
          )}
        >
          {caption}
        </p>
      ) : null}
      <p
        className={cx(
          'figure mt-1.5 break-words text-[13px] leading-relaxed',
          paper ? 'text-paper-muted' : 'text-muted',
        )}
      >
        {provenance}
      </p>
    </div>
  );
}
