"use client";
import { useEffect, useState } from "react";
import { getPoolFeeAmount, type NetworkKey } from "@/utils/constants";

// Reads the pool's fee at runtime (`get_fee_amount`). It is admin settable, so
// this is never hardcoded and is re-read whenever the network changes.
export function usePoolFee(network: NetworkKey | undefined) {
  const [fee, setFee] = useState<bigint | undefined>(undefined);
  const [error, setError] = useState<string>("");

  useEffect(() => {
    if (!network) {
      setFee(undefined);
      return;
    }
    let cancelled = false;
    setError("");
    getPoolFeeAmount(network)
      .then((f) => {
        if (!cancelled) setFee(f);
      })
      .catch((err: any) => {
        if (!cancelled) setError(err?.message ?? "Could not read the pool fee.");
      });
    return () => {
      cancelled = true;
    };
  }, [network]);

  return { fee, error };
}
