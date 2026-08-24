/**
 * Exponential backoff retry for public RPC endpoint calls.
 *
 * Public RPC nodes throttle during note discovery scans and similar bulk
 * operations. This wrapper retries only on transient network signals and
 * backs off exponentially with jitter, never on contract reverts or
 * user-rejection errors.
 */
export function withRetry<T>(
  fn: () => Promise<T>,
  opts?: {
    attempts?: number;
    baseMs?: number;
    onRetry?: (attempt: number, err: unknown) => void;
  }
): Promise<T> {
  const { attempts = 4, baseMs = 400, onRetry } = opts ?? {};

  return new Promise<T>((resolve, reject) => {
    let attempt = 0;

    const isTransient = (err: unknown): boolean => {
      const msg = err instanceof Error ? err.message : String(err);
      const upper = msg.toUpperCase();

      // Retry on transient signals
      if (
        upper.includes("ETIMEDOUT") ||
        upper.includes("ECONNRESET") ||
        upper.includes("CONNECTION RESET") ||
        upper.includes("CONNECTION TIMED OUT") ||
        upper.includes("TIMEOUT") ||
        upper.includes("NETWORK ERROR") ||
        upper.includes("FETCH") ||
        upper.includes("429") ||
        upper.includes("RATE LIMIT") ||
        upper.includes("TOO MANY REQUESTS") ||
        /^5\d{2}/.test(upper)
      ) {
        return true;
      }

      // Do NOT retry on contract reverts or user-rejection
      if (
        upper.includes("REVERT") ||
        upper.includes("USER REJECTED") ||
        upper.includes("DENIED") ||
        upper.includes("PERMISSION DENIED")
      ) {
        return false;
      }

      // Default: don't retry on unknown errors
      return false;
    };

    const loop = (): void => {
      attempt++;

      fn()
        .then((val) => resolve(val))
        .catch((err) => {
          if (isTransient(err) && attempt < attempts) {
            onRetry?.(attempt, err);
            const delay =
              baseMs * Math.pow(2, attempt - 1) * (0.5 + Math.random() * 0.5);
            setTimeout(() => loop(), delay);
          } else {
            reject(err);
          }
        });
    };

    loop();
  });
}