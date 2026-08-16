"use client";
import { useCallback, useEffect, useState } from "react";
import { getPoolFeeAmount, type NetworkKey } from "@/utils/constants";

// Reads the pool's fee at runtime (`get_fee_amount`). It is admin settable, so
// this is never hardcoded and is re-read on network change or manual refresh().
export function usePoolFee(network: NetworkKey | undefined) {
  const [fee, setFee] = useState<bigint | undefined>(undefined);
  const [error, setError] = useState<string>("");
  const [nonce, setNonce] = useState(0);

  const refresh = useCallback(() => setNonce((n) => n + 1), []);

  useEffect(() => {
    if (!network) {
      setFee(undefined);
      setError("");
      return;
    }
    let cancelled = false;
    setError("");
    getPoolFeeAmount(network)
      .then((f) => {
        if (!cancelled) setFee(f);
      })
      .catch((err: any) => {
        if (!cancelled) {
          setFee(undefined);
          setError(err?.message ?? "Could not read the pool fee.");
        }
      });
    return () => {
      cancelled = true;
    };
  }, [network, nonce]);

  return { fee, error, refresh };
}
