'use client';

import { useEffect, useRef, useState, type HTMLAttributes, type ReactNode } from 'react';
import { usePathname } from 'next/navigation';

/**
 * Shared v2 primitives. Every route pulls surface, motion, and loading
 * treatment from here so the app reads as one system instead of a shell
 * that was redesigned around content that was not.
 */

export function cx(...parts: Array<string | false | null | undefined>): string {
  return parts.filter(Boolean).join(' ');
}

const PANEL_BASE =
  'rounded-3xl border border-white/[0.07] bg-white/[0.028] backdrop-blur-xl elevate-1';

/** Elevated glass panel. `interactive` adds hover lift for clickable surfaces. */
export function Panel({
  children,
  className,
  interactive = false,
  padded = true,
  ...rest
}: HTMLAttributes<HTMLDivElement> & { interactive?: boolean; padded?: boolean }) {
  return (
    <div
      className={cx(
        PANEL_BASE,
        padded && 'p-6',
        interactive && 'elevate-interactive',
        className,
      )}
      {...rest}
    >
      {children}
    </div>
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
    <span className={cx('tabular-nums', className)}>
      {prefix}
      {display.toLocaleString(undefined, {
        minimumFractionDigits: decimals,
        maximumFractionDigits: decimals,
      })}
      {suffix}
    </span>
  );
}
