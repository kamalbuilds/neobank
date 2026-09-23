"use client";

import {
  type FormEvent,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { ANONYMIZER_ADDRESSES } from "@/utils/constants";
import { BankCard, type BankCardStatus } from "../components/v2/BankCard";
import { HowThisWorks, PanelState, Skeleton } from "../components/v2/ui";
import { AccountChrome } from "../components/v2/AccountChrome";

export type PublicCardPolicy = {
  perSwipeCap?: string;
  dailyCap?: string;
  allowedCountries?: string;
  blockedCategories?: string;
  lendOnRestaurants?: string;
};

type JsonRecord = Record<string, unknown>;

type RuntimeReadiness = {
  ready: boolean;
  missing: string[];
  network: string;
  accountAddress?: string;
  poolAddress?: string;
};

type RuntimeState =
  | { phase: "loading" }
  | { phase: "loaded"; readiness: RuntimeReadiness; health?: JsonRecord }
  | { phase: "error"; message: string };

type LookupState =
  | { phase: "idle" }
  | { phase: "loading" }
  | { phase: "loaded"; data: JsonRecord }
  | { phase: "error"; message: string };

type SettlementsState =
  | { phase: "loading" }
  | {
      phase: "loaded";
      items: JsonRecord[];
      readAt: Date;
      readAtIso?: string;
      fromBlock?: number;
      headBlock?: number;
    }
  | { phase: "error"; message: string };

type TimelineState =
  | "waiting"
  | "active"
  | "complete"
  | "blocked"
  | "unsettled";

/**
 * How long the page watches a queued swipe for its Starknet receipt, and how
 * often it re-reads the settlement contract while it waits.
 *
 * A bound is the point. Settlement runs server side after the approval returns,
 * and the approval is an accepted request, not a completed operation: the
 * contract is the only thing that can say the swipe settled. Watching forever
 * turns a failure into a spinner, so the wait ends at a stated deadline and the
 * page then says, in terminal language, that no receipt exists.
 */
const SETTLEMENT_WAIT_MS = 120_000;
const SETTLEMENT_POLL_MS = 5_000;

/** The bounded wait on one queued authorization. */
type WatchState =
  | { phase: "idle" }
  | {
      phase: "watching";
      authorizationId: string;
      startedAt: number;
      elapsedMs: number;
    }
  | { phase: "settled"; authorizationId: string; elapsedMs: number }
  | {
      phase: "unsettled";
      authorizationId: string;
      elapsedMs: number;
      status?: JsonRecord;
    }
  | { phase: "error"; authorizationId: string; elapsedMs: number; message: string };

const STRK_TOKEN =
  "0x04718f5a0fc34cc1af16a1cdee98ffb20c31f5cd61d6ab07201858f4287c938d";

const SHADOW_ANONYMIZER = ANONYMIZER_ADDRESSES.sepolia.shadowAccount;

const AUTHORIZATION_ID = /^[A-Za-z0-9_.:-]{1,128}$/;

function isRecord(value: unknown): value is JsonRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function shorten(value?: string, start = 8, end = 6): string {
  if (!value) return "Unavailable";
  if (value.length <= start + end + 3) return value;
  return `${value.slice(0, start)}...${value.slice(-end)}`;
}

function clockUtc(at: Date): string {
  return `${at.toISOString().slice(0, 16).replace("T", " ")} UTC`;
}

function stringValue(record: JsonRecord, ...keys: string[]): string | undefined {
  for (const key of keys) {
    const value = record[key];
    if (typeof value === "string" && value) return value;
    if (typeof value === "number") return String(value);
  }
  return undefined;
}

function numberValue(record: JsonRecord, ...keys: string[]): number | undefined {
  for (const key of keys) {
    const value = record[key];
    if (typeof value === "number" && Number.isFinite(value)) return value;
  }
  return undefined;
}

function booleanValue(record: JsonRecord, ...keys: string[]): boolean | undefined {
  for (const key of keys) {
    if (typeof record[key] === "boolean") return record[key];
  }
  return undefined;
}

async function readJson(response: Response): Promise<JsonRecord> {
  const payload: unknown = await response.json().catch(() => null);
  if (!isRecord(payload)) {
    throw new Error(`Endpoint returned ${response.status} without a JSON status.`);
  }
  return payload;
}

function normalizeReadiness(payload: JsonRecord): RuntimeReadiness {
  return {
    ready: payload.ready === true,
    missing: Array.isArray(payload.missing)
      ? payload.missing.filter((item): item is string => typeof item === "string")
      : [],
    network:
      typeof payload.network === "string" ? payload.network : "sepolia",
    accountAddress:
      typeof payload.accountAddress === "string"
        ? payload.accountAddress
        : undefined,
    poolAddress:
      typeof payload.poolAddress === "string" ? payload.poolAddress : undefined,
  };
}

function policyValue(value: string | undefined, suffix = ""): string {
  return value ? `${value}${suffix}` : "Server enforced";
}

/**
 * A cap read off the settlement contract, formatted as STRK.
 *
 * The contract is the system of record for these limits: max_per_transaction
 * and daily_limit are set at deploy and checked at settlement, so an env label
 * that disagrees with them is wrong rather than merely stale. Returns undefined
 * when the runtime probe has not loaded, and the caller falls back to the label.
 */
function contractCap(
  runtimeHealth: JsonRecord | undefined,
  key: "maxPerTransaction" | "dailyLimit",
): string | undefined {
  if (!runtimeHealth || !isRecord(runtimeHealth.cardSettlement)) return undefined;
  const config = runtimeHealth.cardSettlement.config;
  if (!isRecord(config)) return undefined;
  const raw = stringValue(config, key);
  if (!raw) return undefined;
  try {
    const units = BigInt(raw);
    const whole = units / 1_000_000_000_000_000_000n;
    const frac = (units % 1_000_000_000_000_000_000n)
      .toString()
      .padStart(18, "0")
      .replace(/0+$/, "");
    return frac ? `${whole}.${frac} STRK` : `${whole} STRK`;
  } catch {
    return undefined;
  }
}

function formatSettledAmount(record: JsonRecord): string {
  const amount = stringValue(record, "amount");
  const token = stringValue(record, "token");
  if (!amount) return "Unknown amount";
  try {
    const units = BigInt(amount);
    const isStrk = token ? BigInt(token) === BigInt(STRK_TOKEN) : true;
    if (!isStrk) return `${amount} units`;
    const whole = units / 1_000_000_000_000_000_000n;
    const frac = (units % 1_000_000_000_000_000_000n)
      .toString()
      .padStart(18, "0")
      .replace(/0+$/, "");
    return frac ? `${whole}.${frac} STRK` : `${whole} STRK`;
  } catch {
    return amount;
  }
}

function statusLabel(state: TimelineState): string {
  if (state === "complete") return "Complete";
  if (state === "active") return "In progress";
  if (state === "blocked") return "Blocked";
  if (state === "unsettled") return "Not settled";
  return "Waiting";
}

function seconds(ms: number): string {
  return `${Math.max(0, Math.round(ms / 1000))}s`;
}

function timelineFromLookup(
  lookup: LookupState,
  watch: WatchState,
): Array<{ title: string; detail: string; state: TimelineState }> {
  const base = [
    {
      title: "Authorization received",
      detail: "Stripe-compatible request is verified before policy evaluation.",
      state: "waiting" as TimelineState,
    },
    {
      title: "Policy reserved",
      detail: "Limits and merchant rules reserve spend without exposing total holdings.",
      state: "waiting" as TimelineState,
    },
    {
      title: "Proof-backed settlement queued",
      detail: "The hosted STRK20 account builds proof-backed Sepolia settlement.",
      state: "waiting" as TimelineState,
    },
    {
      title: "Starknet receipt confirmed",
      detail: "The final transaction receipt records the public settlement boundary.",
      state: "waiting" as TimelineState,
    },
  ];

  if (lookup.phase === "loading") {
    base[0].state = "active";
    return base;
  }
  if (lookup.phase === "error") {
    base[0].state = "blocked";
    return base;
  }
  if (lookup.phase !== "loaded") return base;

  const data = lookup.data;
  const settled = booleanValue(data, "settled");
  const approved = booleanValue(data, "approved");
  const status = stringValue(
    data,
    "settlementStatus",
    "status",
    "executionStatus",
  )?.toLowerCase();
  const hasTransaction = Boolean(
    stringValue(data, "transactionHash", "txHash"),
  );

  base[0].state = "complete";
  base[1].state =
    approved === false ? "blocked" : approved === true || settled !== undefined ? "complete" : "active";
  base[2].state =
    approved === false
      ? "blocked"
      : hasTransaction || settled === true || status === "queued" || status === "confirmed"
        ? "complete"
        : "active";
  // Step 4 is the only step the chain can confirm, so it is the only step
  // allowed to sit unresolved, and it is not allowed to sit there forever. Once
  // the bounded wait is spent it reads "Not settled", which is terminal and
  // true: the contract reports this authorization as unused.
  base[3].state =
    settled === true || status === "confirmed" || status === "succeeded"
      ? "complete"
      : approved === false
        ? "blocked"
        : watch.phase === "watching"
          ? "active"
          : watch.phase === "unsettled"
            ? "unsettled"
            : watch.phase === "error"
              ? "blocked"
              : hasTransaction
                ? "active"
                : "unsettled";
  return base;
}

function RuntimeProbe({
  label,
  value,
}: {
  label: string;
  value: unknown;
}) {
  const probe = isRecord(value) ? value : undefined;
  const ok = probe?.ok === true;
  const failed = probe?.ok === false;

  return (
    <div className="rule flex min-w-0 items-baseline justify-between gap-4 py-3 first:border-t-0">
      <span className="text-[13px] text-muted">{label}</span>
      <span
        className={`figure text-[13px] font-semibold ${
          ok
            ? "text-[color:var(--green)]"
            : failed
              ? "text-seal-bright"
              : "text-muted"
        }`}
      >
        {ok ? "Healthy" : failed ? "Failed" : "Not reported"}
      </span>
    </div>
  );
}

/**
 * Uppercase network label. Mainnet reads louder than a testnet: it is the
 * stamped block, not the outline. The ink differs by ground because seal
 * vermilion clears 4.5:1 on cream and only 3.3:1 on graphite.
 */
function NetworkStamp({
  network,
  tone = "paper",
  className,
}: {
  network: string;
  tone?: "paper" | "chrome";
  className?: string;
}) {
  const live = network.toLowerCase().includes("main");
  const outline =
    tone === "chrome"
      ? "border-[color:var(--seal-text)] text-seal-bright"
      : "border-[color:var(--seal)] text-seal";
  return (
    <span
      className={`figure inline-flex shrink-0 rotate-[-3deg] items-center border px-2 py-0.5 text-[13px] font-semibold uppercase tracking-[0.1em] ${
        live ? "border-[color:var(--seal)] bg-[color:var(--seal)] text-paper" : outline
      } ${className ?? ""}`}
    >
      {network}
    </span>
  );
}

export function CardDashboard({ policy }: { policy: PublicCardPolicy }) {
  const [runtime, setRuntime] = useState<RuntimeState>({ phase: "loading" });
  const [authorizationId, setAuthorizationId] = useState("");
  const [lookup, setLookup] = useState<LookupState>({ phase: "idle" });
  const [settlements, setSettlements] = useState<SettlementsState>({
    phase: "loading",
  });
  const [demo, setDemo] = useState<"idle" | "running" | "error">("idle");
  const [demoMessage, setDemoMessage] = useState("");
  const [watch, setWatch] = useState<WatchState>({ phase: "idle" });
  // What the authorization endpoint answered when it accepted the swipe. The
  // contract read that follows only knows whether the authorization is used, so
  // without this the "approved" and "queued" facts the server did report would
  // be overwritten by the first poll and the timeline would lose them.
  const acceptedRef = useRef<JsonRecord | undefined>(undefined);

  const loadRuntime = useCallback(async () => {
    setRuntime({ phase: "loading" });
    setSettlements({ phase: "loading" });
    try {
      const readinessResponse = await fetch("/api/card/authorize", {
        cache: "no-store",
      });
      const readinessPayload = await readJson(readinessResponse);

      let health: JsonRecord | undefined;
      try {
        const healthResponse = await fetch("/api/card/status/runtime", {
          cache: "no-store",
        });
        if (healthResponse.status !== 404) {
          health = await readJson(healthResponse);
        }
      } catch {
        // Readiness remains authoritative when the optional health route is absent.
      }

      setRuntime({
        phase: "loaded",
        readiness: normalizeReadiness(readinessPayload),
        health,
      });
    } catch (error) {
      setRuntime({
        phase: "error",
        message:
          error instanceof Error
            ? error.message
            : "Runtime readiness could not be verified.",
      });
    }

    try {
      const settlementsResponse = await fetch("/api/card/status/settlements", {
        cache: "no-store",
      });
      const payload = await readJson(settlementsResponse);
      if (!settlementsResponse.ok) {
        throw new Error(
          stringValue(payload, "error", "message") ||
            `Settlements lookup returned ${settlementsResponse.status}.`,
        );
      }
      const items = Array.isArray(payload.settlements)
        ? payload.settlements.filter(isRecord)
        : [];
      setSettlements({
        phase: "loaded",
        items,
        readAt: new Date(),
        readAtIso: stringValue(payload, "readAtIso"),
        fromBlock: numberValue(payload, "fromBlock"),
        headBlock: numberValue(payload, "headBlock"),
      });
    } catch (error) {
      setSettlements({
        phase: "error",
        message:
          error instanceof Error
            ? error.message
            : "Settlement receipts could not be read.",
      });
    }
  }, []);

  useEffect(() => {
    void loadRuntime();
  }, [loadRuntime]);

  const watchId = watch.phase === "watching" ? watch.authorizationId : undefined;
  const watchStartedAt = watch.phase === "watching" ? watch.startedAt : undefined;

  // The bounded wait. Every tick refreshes the elapsed figure so the deadline is
  // visible while it runs; every SETTLEMENT_POLL_MS it re-reads the settlement
  // contract. The loop can only end three ways, and all three are terminal:
  // the contract confirms, the deadline passes, or the read fails.
  useEffect(() => {
    if (!watchId || watchStartedAt === undefined) return;
    let cancelled = false;
    let inFlight = false;
    let lastPollAt = 0;
    let lastStatus: JsonRecord | undefined;

    const tick = async () => {
      if (cancelled) return;
      const sinceStart = Date.now() - watchStartedAt;
      setWatch((current) =>
        current.phase === "watching" && current.authorizationId === watchId
          ? { ...current, elapsedMs: sinceStart }
          : current,
      );
      // The deadline is checked every second rather than only after a read
      // returns, so the terminal state lands when it says it will instead of
      // whenever the next poll happens to come back.
      if (sinceStart >= SETTLEMENT_WAIT_MS && !inFlight) {
        setWatch({
          phase: "unsettled",
          authorizationId: watchId,
          elapsedMs: sinceStart,
          status: lastStatus,
        });
        return;
      }
      if (inFlight || Date.now() - lastPollAt < SETTLEMENT_POLL_MS) return;
      lastPollAt = Date.now();
      inFlight = true;
      try {
        const response = await fetch(
          `/api/card/status/${encodeURIComponent(watchId)}`,
          { cache: "no-store" },
        );
        const data = await readJson(response);
        if (cancelled) return;
        if (!response.ok) {
          throw new Error(
            stringValue(data, "error", "message") ||
              `Authorization lookup returned ${response.status}.`,
          );
        }
        const merged = { ...(acceptedRef.current || {}), ...data };
        lastStatus = merged;
        setLookup({ phase: "loaded", data: merged });
        const elapsedMs = Date.now() - watchStartedAt;
        if (booleanValue(merged, "settled") === true) {
          setWatch({ phase: "settled", authorizationId: watchId, elapsedMs });
          void loadRuntime();
          return;
        }
        if (elapsedMs >= SETTLEMENT_WAIT_MS) {
          setWatch({
            phase: "unsettled",
            authorizationId: watchId,
            elapsedMs,
            status: merged,
          });
        }
      } catch (error) {
        if (cancelled) return;
        setWatch({
          phase: "error",
          authorizationId: watchId,
          elapsedMs: Date.now() - watchStartedAt,
          message:
            error instanceof Error
              ? error.message
              : "The settlement contract could not be read.",
        });
      } finally {
        inFlight = false;
      }
    };

    void tick();
    const timer = setInterval(() => {
      void tick();
    }, 1_000);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [watchId, watchStartedAt, loadRuntime]);

  const timeline = useMemo(
    () => timelineFromLookup(lookup, watch),
    [lookup, watch],
  );

  async function handleLookup(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const id = authorizationId.trim();
    if (!AUTHORIZATION_ID.test(id)) {
      setLookup({
        phase: "error",
        message:
          "Use a valid authorization ID with letters, numbers, dot, colon, underscore, or hyphen.",
      });
      return;
    }

    setLookup({ phase: "loading" });
    setWatch({ phase: "idle" });
    acceptedRef.current = undefined;
    try {
      const response = await fetch(
        `/api/card/status/${encodeURIComponent(id)}`,
        { cache: "no-store" },
      );
      const data = await readJson(response);
      if (!response.ok) {
        throw new Error(
          stringValue(data, "error", "message") ||
            `Authorization lookup returned ${response.status}.`,
        );
      }
      setLookup({ phase: "loaded", data });
    } catch (error) {
      setLookup({
        phase: "error",
        message:
          error instanceof Error
            ? error.message
            : "Authorization status could not be read.",
      });
    }
  }

  async function handleDemoAuthorize(scene: "dinner" | "from-vault" = "dinner") {
    setDemo("running");
    setDemoMessage("");
    setWatch({ phase: "idle" });
    acceptedRef.current = undefined;
    try {
      const response = await fetch("/api/card/demo-authorize", {
        method: "POST",
        cache: "no-store",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ scene }),
      });
      const data = await readJson(response);
      if (!response.ok) {
        throw new Error(
          stringValue(data, "error", "reason", "message") ||
            `Demo authorization returned ${response.status}.`,
        );
      }
      const id = stringValue(data, "authorizationId") || "";
      if (id) {
        setAuthorizationId(id);
        setLookup({ phase: "loaded", data });
        // A 202 with settlementStatus "queued" is an accepted request. Start
        // the bounded watch on the contract rather than presenting the queue
        // position as if it were a receipt.
        if (booleanValue(data, "settled") !== true) {
          acceptedRef.current = data;
          setWatch({
            phase: "watching",
            authorizationId: id,
            startedAt: Date.now(),
            elapsedMs: 0,
          });
        }
      }
      setDemo("idle");
      await loadRuntime();
    } catch (error) {
      setDemo("error");
      setDemoMessage(
        error instanceof Error
          ? error.message
          : "Demo authorization could not be submitted.",
      );
    }
  }

  const readiness =
    runtime.phase === "loaded" ? runtime.readiness : undefined;
  const runtimeReady = readiness?.ready === true;
  const network = readiness?.network || "sepolia";
  const cardStatus: BankCardStatus =
    runtime.phase === "loading" ? "checking" : runtimeReady ? "ready" : "blocked";
  const runtimeHealth =
    runtime.phase === "loaded" && isRecord(runtime.health?.health)
      ? runtime.health.health
      : undefined;
  // The RPC probe carries the head block it reached, which is the only block
  // height these event reads can honestly claim to have been taken at.
  const headBlock =
    runtimeHealth && isRecord(runtimeHealth.rpc)
      ? numberValue(runtimeHealth.rpc, "blockNumber")
      : undefined;
  const demoEnabled =
    runtime.phase === "loaded" &&
    runtime.health?.demoAuthorize === true;
  const lookupData = lookup.phase === "loaded" ? lookup.data : undefined;
  const transactionHash = lookupData
    ? stringValue(lookupData, "transactionHash", "txHash")
    : undefined;
  const contractAddress = lookupData
    ? stringValue(lookupData, "contractAddress", "settlementContract")
    : undefined;
  const transactionUrl = lookupData
    ? stringValue(
        lookupData,
        "explorerTransactionUrl",
        "explorerTxUrl",
        "transactionUrl",
      )
    : undefined;
  const contractUrl = lookupData
    ? stringValue(lookupData, "explorerContractUrl", "contractUrl")
    : undefined;

  const refreshButton = (extra: string) => (
    <button
      type="button"
      onClick={() => void loadRuntime()}
      disabled={runtime.phase === "loading"}
      className={`h-10 rounded-[4px] border border-[color:var(--line-strong)] px-4 text-[13px] font-semibold text-ink transition-[background-color,transform] duration-150 hover:bg-white/[0.05] active:scale-[0.97] disabled:cursor-wait disabled:opacity-50 ${extra}`}
    >
      {runtime.phase === "loading" ? "Checking status" : "Refresh status"}
    </button>
  );

  return (
    <AccountChrome>
      <div className="flex flex-col gap-5">
        <section className="doc p-6 sm:p-7">
          <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_380px] lg:items-start">
            <div className="max-w-2xl">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted">
                  Spend from your shielded balance
                </p>
                {refreshButton("lg:hidden")}
              </div>
              {/* Leads with where the money comes from, not with what the
                  merchant misses. "The merchant never sees your wallet" is true
                  of any card ever issued, so it described the category instead
                  of this product; the private pool is the part nothing else
                  does. The custodial caveat stays, moved below the claim it
                  qualifies rather than crowding the opening paragraph. */}
              <h1 className="mt-3 text-balance font-[family-name:var(--font-display)] text-[34px] leading-[1.06] tracking-[-0.02em] text-ink">
                A card that spends from your private STRK20 pool.
              </h1>
              <p className="mt-4 max-w-2xl text-pretty text-[15px] leading-7 text-muted">
                Swipe and it approves instantly against your card limits. The money is drawn from
                your shielded balance, and you program what else each swipe does.
              </p>
              <p className="mt-3 max-w-2xl text-pretty text-[13px] leading-6 text-muted">
                One honest exception: the hosted settlement account that pays the merchant is
                custodial. Sealed&apos;s operator holds a derived key and can see its settlements,
                and the settlement token, amount, and recipient land on Starknet in the clear.
              </p>
              {refreshButton("mt-5 hidden lg:inline-flex")}
            </div>

            <div className="mx-auto w-full lg:mx-0">
              <BankCard
                accountAddress={readiness?.accountAddress}
                network={readiness?.network || "Sepolia"}
                status={cardStatus}
                dailyCap={policy.dailyCap}
              />
            </div>
          </div>

          <div className="rule mt-7 flex flex-wrap items-center gap-x-3 gap-y-2 pt-4">
            <span
              className={`inline-block size-2 rounded-full ${
                runtime.phase === "loading"
                  ? "animate-pulse-soft bg-[color:var(--muted)]"
                  : runtimeReady
                    ? "bg-[color:var(--green)]"
                    : "bg-[color:var(--seal-text)]"
              }`}
              aria-hidden="true"
            />
            <span className="text-[13px] font-medium text-ink">
              {runtime.phase === "loading"
                ? "Checking card status"
                : runtimeReady
                  ? "Card is live and can settle"
                  : "Card settlement is blocked"}
            </span>
            <NetworkStamp network={network} tone="chrome" className="ml-auto" />
          </div>

          <HowThisWorks className="mt-4" label="Contract addresses backing this card">
            <dl className="grid gap-x-8 gap-y-3 sm:grid-cols-2">
              <div>
                <dt className="text-[13px] text-muted">Network</dt>
                <dd className="figure mt-1 text-[13px] font-semibold text-ink">{network}</dd>
              </div>
              <div className="min-w-0">
                <dt className="text-[13px] text-muted">Hosted account</dt>
                <dd
                  className="figure mt-1 truncate text-[13px] font-semibold text-ink"
                  title={readiness?.accountAddress}
                >
                  {shorten(readiness?.accountAddress)}
                </dd>
              </div>
              <div className="min-w-0">
                <dt className="text-[13px] text-muted">Privacy pool</dt>
                <dd
                  className="figure mt-1 truncate text-[13px] font-semibold text-ink"
                  title={readiness?.poolAddress}
                >
                  {shorten(readiness?.poolAddress)}
                </dd>
              </div>
              <div className="min-w-0">
                <dt className="text-[13px] text-muted">Settlement contract</dt>
                <dd
                  className="figure mt-1 truncate text-[13px] font-semibold text-ink"
                  title={
                    SHADOW_ANONYMIZER
                      ? `Shadow anonymizer ${SHADOW_ANONYMIZER}`
                      : undefined
                  }
                >
                  {SHADOW_ANONYMIZER
                    ? shorten(SHADOW_ANONYMIZER)
                    : "Not configured"}
                </dd>
              </div>
            </dl>
          </HowThisWorks>
        </section>

        {/* The receipts are the evidence, so they are on paper: a ruled ledger
            of what actually settled, amounts in a right-hand column. */}
        <section className="paper paper-torn relative px-6 pb-7 pt-9 sm:px-8" aria-live="polite">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <div className="text-[11px] font-semibold uppercase tracking-[0.2em] text-paper-muted">
                Sealed · card settlements
              </div>
              <h2 className="mt-1 font-[family-name:var(--font-display)] text-[24px] leading-[1.1] tracking-[-0.015em] text-paper-ink">
                What has settled on chain
              </h2>
            </div>
            <NetworkStamp network={network} className="mt-1" />
          </div>

          {settlements.phase === "loading" && (
            <div
              className="mt-6 flex flex-col gap-2.5"
              aria-busy="true"
              aria-label="Reading settlement receipts from Sepolia"
            >
              <Skeleton className="skeleton-paper h-11" />
              <Skeleton className="skeleton-paper h-11 opacity-70" />
            </div>
          )}

          {settlements.phase === "error" && (
            <p
              className="mt-6 max-w-xl border-l-2 border-[color:var(--seal)] pl-3 text-[15px] leading-relaxed text-paper-ink"
              role="alert"
            >
              The settlement receipts could not be read: {settlements.message} No row is being
              shown in place of them.
            </p>
          )}

          {settlements.phase === "loaded" && settlements.items.length === 0 && (
            <p className="mt-6 max-w-xl text-[15px] leading-relaxed text-paper-ink">
              No card authorization has settled through the contract yet.{" "}
              {demoEnabled
                ? "Run a swipe below and the receipt lands here with its transaction hash."
                : "Once a swipe settles, its receipt lands here with its transaction hash."}
            </p>
          )}

          {settlements.phase === "loaded" && settlements.items.length > 0 && (
            <>
              <div className="mt-6 flex items-baseline justify-between border-b border-[color:var(--paper-line)] pb-1.5">
                <span className="text-[11px] font-semibold uppercase tracking-[0.16em] text-paper-muted">
                  Settlement
                </span>
                <span className="text-[11px] font-semibold uppercase tracking-[0.16em] text-paper-muted">
                  Amount
                </span>
              </div>
              <ul>
                {settlements.items.map((item) => {
                  const tx = stringValue(item, "transactionHash");
                  const txUrl = stringValue(item, "explorerTransactionUrl");
                  const felt = stringValue(item, "authorizationFelt");
                  const lendAssets = stringValue(item, "lendAssets");
                  const block = numberValue(item, "blockNumber");
                  return (
                    <li
                      key={`${tx}-${felt}`}
                      className="rule-paper flex items-start justify-between gap-5 py-3 first:border-t-0"
                    >
                      <div className="min-w-0">
                        {tx && txUrl ? (
                          <a
                            href={txUrl}
                            target="_blank"
                            rel="noreferrer"
                            className="figure block truncate text-[13px] font-semibold text-paper-ink underline decoration-[color:var(--paper-line)] underline-offset-4 hover:decoration-[color:var(--seal)]"
                          >
                            {shorten(tx, 12, 10)}
                          </a>
                        ) : (
                          <span className="figure block text-[13px] font-semibold text-paper-ink">
                            Confirmed, no hash reported
                          </span>
                        )}
                        <span
                          className="figure mt-1 block truncate text-[13px] text-paper-muted"
                          title={felt}
                        >
                          {network} · {block !== undefined ? `block ${block}` : "block not reported"}
                        </span>
                      </div>
                      <div className="shrink-0 text-right">
                        <span className="figure block text-[15px] font-bold text-paper-ink">
                          {formatSettledAmount(item)}
                        </span>
                        <span className="figure mt-1 block text-[13px] text-paper-muted">
                          {lendAssets
                            ? `lent ${formatSettledAmount({
                                amount: lendAssets,
                                token: STRK_TOKEN,
                              })}`
                            : "no vault lend"}
                        </span>
                      </div>
                    </li>
                  );
                })}
              </ul>
            </>
          )}

          {/* The scan now reports the block range it walked and the clock it
              walked it on, so the provenance line carries the server's own
              read time rather than the browser's. A scan served from the
              server's cache is still a real read; dating it to when the browser
              asked would be the dishonest part. */}
          {settlements.phase === "loaded" && (
            <p className="figure rule-paper mt-5 pt-4 text-[13px] text-paper-muted">
              Read from {network} settlement events{" "}
              {settlements.fromBlock !== undefined
                ? `between block ${settlements.fromBlock} and `
                : "up to "}
              {settlements.headBlock !== undefined
                ? `block ${settlements.headBlock}`
                : "the head block the node reported"}
              {settlements.readAtIso
                ? `, at ${clockUtc(new Date(settlements.readAtIso))}, the server clock when it read the chain.`
                : `, at ${clockUtc(settlements.readAt)}, this browser clock. The scan did not report when it read the chain.`}
            </p>
          )}
        </section>

        <div className="grid gap-5 lg:grid-cols-[minmax(0,1.45fr)_minmax(300px,0.72fr)]">
          <section className="doc min-w-0 p-5 sm:p-6">
            <div className="flex flex-col gap-2 border-b border-[color:var(--line)] pb-5 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <h2 className="text-balance font-[family-name:var(--font-display)] text-[24px] leading-[1.1] tracking-[-0.015em] text-ink">
                  Trace a swipe
                </h2>
                <p className="mt-1 text-[13px] leading-6 text-muted">
                  Follow one real card purchase from approval to the Starknet transaction that
                  settled it.
                </p>
              </div>
            </div>

            {/* The text and the two buttons used to share one sm:flex-row. This
                column is 548px at 1440, the two nowrap buttons take 389px of
                it, and the paragraph collapsed to about eight characters wide.
                A viewport breakpoint cannot see that, because the column is
                narrow at every viewport the grid puts it in, so the row is
                gone: the sentence gets the full column and the buttons sit
                under it. */}
            <div className="rule mt-5 pt-5">
              <div className="flex flex-col gap-4">
                <div className="min-w-0">
                  <h3 className="text-[15px] font-semibold text-ink">Try a real swipe</h3>
                  <p className="mt-1 text-pretty text-[13px] leading-6 text-muted">
                    A restaurant purchase also lends 10 STRK into the Earn vault, settled in the
                    same transaction as the payment.
                  </p>
                </div>
                {demoEnabled && (
                  <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
                    <button
                      type="button"
                      onClick={() => void handleDemoAuthorize("dinner")}
                      disabled={demo === "running" || !runtimeReady}
                      className="h-11 whitespace-nowrap rounded-[4px] bg-seal px-4 text-[13px] font-semibold text-paper transition-[background-color,transform] duration-150 hover:bg-seal-bright active:scale-[0.97] disabled:cursor-wait disabled:opacity-40"
                    >
                      {demo === "running"
                        ? "Paying Osteria Nova"
                        : "Pay dinner at Osteria Nova"}
                    </button>
                    <button
                      type="button"
                      onClick={() => void handleDemoAuthorize("from-vault")}
                      disabled={demo === "running" || !runtimeReady}
                      className="h-11 whitespace-nowrap rounded-[4px] border border-[color:var(--line-strong)] px-4 text-[13px] font-semibold text-ink transition-[background-color,transform] duration-150 hover:bg-white/[0.05] active:scale-[0.97] disabled:cursor-wait disabled:opacity-40"
                    >
                      {demo === "running" ? "Paying from vault" : "Pay Osteria from vault"}
                    </button>
                  </div>
                )}
              </div>
              {!demoEnabled && runtime.phase === "loaded" && (
                <p className="mt-3 max-w-md text-[13px] leading-6 text-muted">
                  Demo swipes are off on this deployment. Trace an authorization ID below instead,
                  or read the settled receipts above.
                </p>
              )}
              {demo === "error" && (
                <PanelState kind="error" title="That swipe was not accepted" className="mt-4">
                  {demoMessage}
                </PanelState>
              )}
            </div>

            <form
              onSubmit={handleLookup}
              className="rule mt-5 grid gap-3 pt-5 sm:grid-cols-[minmax(0,1fr)_auto]"
            >
              <div>
                <label
                  htmlFor="authorization-id"
                  className="mb-2 block text-[11px] font-semibold uppercase tracking-[0.16em] text-muted"
                >
                  Latest authorization ID
                </label>
                <input
                  id="authorization-id"
                  name="authorization-id"
                  value={authorizationId}
                  onChange={(event) => setAuthorizationId(event.target.value)}
                  placeholder="iauth_..."
                  autoComplete="off"
                  spellCheck={false}
                  className="figure h-11 w-full rounded-[4px] border border-[color:var(--line)] bg-black/25 px-3.5 text-[13px] font-semibold text-ink outline-none transition-[border-color] duration-150 placeholder:font-normal placeholder:text-muted hover:border-[color:var(--line-strong)] focus:border-[color:var(--seal-text)]"
                />
              </div>
              <button
                type="submit"
                disabled={lookup.phase === "loading"}
                className="h-11 self-end whitespace-nowrap rounded-[4px] border border-[color:var(--seal-soft-2)] bg-[color:var(--seal-soft)] px-5 text-[13px] font-semibold text-seal-bright transition-[background-color,transform] duration-150 hover:bg-[color:var(--seal-soft-2)] active:scale-[0.97] disabled:cursor-wait disabled:opacity-50"
              >
                {lookup.phase === "loading" ? "Tracing" : "Trace authorization"}
              </button>
            </form>

            <div aria-live="polite" className="mt-5">
              {lookup.phase === "idle" && (
                <PanelState kind="empty" title="No authorization traced yet">
                  Paste an authorization ID above, or copy one from a settled receipt, and this
                  shows how that swipe settled.
                </PanelState>
              )}
              {lookup.phase === "loading" && (
                <div
                  className="flex flex-col gap-2"
                  aria-busy="true"
                  aria-label="Tracing this authorization"
                >
                  <Skeleton className="h-11" />
                  <Skeleton className="h-11 opacity-70" />
                </div>
              )}
              {lookup.phase === "error" && (
                <PanelState kind="error" title="That authorization could not be read">
                  {lookup.message}
                </PanelState>
              )}
              {lookup.phase === "loaded" && (
                <div className="paper relative px-5 pb-5 pt-5">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="text-[11px] font-semibold uppercase tracking-[0.2em] text-paper-muted">
                        Authorization
                      </div>
                      <p className="figure mt-1 break-all text-[15px] font-bold text-paper-ink">
                        {stringValue(lookup.data, "authorizationId") ||
                          authorizationId.trim()}
                      </p>
                    </div>
                    <NetworkStamp network={network} />
                  </div>
                  <dl className="mt-4">
                    <div className="rule-paper flex items-baseline justify-between gap-4 py-2.5 first:border-t-0">
                      <dt className="text-[13px] text-paper-muted">Settlement</dt>
                      <dd className="figure text-[13px] font-bold text-paper-ink">
                        {booleanValue(lookup.data, "settled") === true
                          ? "Confirmed"
                          : stringValue(
                              lookup.data,
                              "settlementStatus",
                              "status",
                              "executionStatus",
                            ) || "Not confirmed"}
                      </dd>
                    </div>
                    {transactionHash && (
                      <div className="rule-paper flex items-baseline justify-between gap-4 py-2.5">
                        <dt className="text-[13px] text-paper-muted">Transaction</dt>
                        <dd className="min-w-0">
                          {transactionUrl ? (
                            <a
                              href={transactionUrl}
                              target="_blank"
                              rel="noreferrer"
                              className="figure block truncate text-[13px] font-semibold text-paper-ink underline decoration-[color:var(--paper-line)] underline-offset-4 hover:decoration-[color:var(--seal)]"
                              title={transactionHash}
                            >
                              {shorten(transactionHash, 12, 10)}
                            </a>
                          ) : (
                            <span
                              className="figure block truncate text-[13px] font-semibold text-paper-ink"
                              title={transactionHash}
                            >
                              {shorten(transactionHash, 12, 10)}
                            </span>
                          )}
                        </dd>
                      </div>
                    )}
                    {contractAddress && (
                      <div className="rule-paper flex items-baseline justify-between gap-4 py-2.5">
                        <dt className="text-[13px] text-paper-muted">Settlement contract</dt>
                        <dd className="min-w-0">
                          {contractUrl ? (
                            <a
                              href={contractUrl}
                              target="_blank"
                              rel="noreferrer"
                              className="figure block truncate text-[13px] font-semibold text-paper-ink underline decoration-[color:var(--paper-line)] underline-offset-4 hover:decoration-[color:var(--seal)]"
                              title={contractAddress}
                            >
                              {shorten(contractAddress, 12, 10)}
                            </a>
                          ) : (
                            <span
                              className="figure block truncate text-[13px] font-semibold text-paper-ink"
                              title={contractAddress}
                            >
                              {shorten(contractAddress, 12, 10)}
                            </span>
                          )}
                        </dd>
                      </div>
                    )}
                  </dl>
                </div>
              )}
            </div>

            <div aria-live="polite" className="empty:hidden">
              {watch.phase === "watching" && (
                <div className="rule mt-5 pt-5">
                  <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
                    <h3 className="text-[15px] font-semibold text-ink">
                      Waiting for the Starknet receipt
                    </h3>
                    <span className="figure text-[13px] font-semibold text-muted">
                      {seconds(watch.elapsedMs)} of{" "}
                      {seconds(SETTLEMENT_WAIT_MS)}
                    </span>
                  </div>
                  <p className="mt-2 max-w-xl text-[13px] leading-6 text-muted">
                    The swipe was approved and settlement was queued. Queued is not
                    settled, so this reads the settlement contract every{" "}
                    {seconds(SETTLEMENT_POLL_MS)} and stops at{" "}
                    {seconds(SETTLEMENT_WAIT_MS)} either way.
                  </p>
                </div>
              )}

              {watch.phase === "settled" && (
                <p className="rule mt-5 pt-5 text-[13px] leading-6 text-[color:var(--green)]">
                  The settlement contract confirmed this authorization after{" "}
                  <span className="figure">{seconds(watch.elapsedMs)}</span>. Its
                  receipt is above.
                </p>
              )}

              {watch.phase === "unsettled" && (
                <div className="rule mt-5 pt-5">
                  <div
                    role="alert"
                    className="border-l-2 border-[color:var(--seal)] py-0.5 pl-3.5"
                  >
                    <p className="text-[13px] font-medium leading-snug text-seal-bright">
                      No Starknet receipt after {seconds(watch.elapsedMs)}
                    </p>
                    <p className="mt-2 max-w-xl text-[13px] leading-6 text-muted">
                      The authorization was approved and queued, and that is all
                      that happened. The settlement contract still reports this
                      authorization as unused, so no STRK moved on {network} and
                      there is no transaction to open. Settlement runs on the
                      server after the approval returns, so the reason it did not
                      land is in that server log against this id, not on this
                      page.
                    </p>
                    <dl className="mt-3">
                      <div className="rule flex items-baseline justify-between gap-4 py-2 first:border-t-0">
                        <dt className="text-[13px] text-muted">Authorization</dt>
                        <dd className="figure min-w-0 break-all text-right text-[13px] font-semibold text-ink">
                          {watch.authorizationId}
                        </dd>
                      </div>
                      <div className="rule flex items-baseline justify-between gap-4 py-2">
                        <dt className="text-[13px] text-muted">
                          Contract checked
                        </dt>
                        <dd className="figure min-w-0 text-right text-[13px] font-semibold text-ink">
                          {contractUrl && contractAddress ? (
                            <a
                              href={contractUrl}
                              target="_blank"
                              rel="noreferrer"
                              className="underline decoration-[color:var(--line-strong)] underline-offset-4 hover:decoration-[color:var(--seal-text)]"
                              title={contractAddress}
                            >
                              {shorten(contractAddress, 12, 10)}
                            </a>
                          ) : (
                            shorten(contractAddress)
                          )}
                        </dd>
                      </div>
                      <div className="rule flex items-baseline justify-between gap-4 py-2">
                        <dt className="text-[13px] text-muted">
                          Answer when it was accepted
                        </dt>
                        <dd className="figure text-right text-[13px] font-semibold text-ink">
                          {watch.status
                            ? `approved: ${String(
                                booleanValue(watch.status, "approved") ??
                                  "not reported",
                              )}, ${
                                stringValue(watch.status, "settlementStatus") ||
                                "no settlement status"
                              }`
                            : "not reported"}
                        </dd>
                      </div>
                      <div className="rule flex items-baseline justify-between gap-4 py-2">
                        <dt className="text-[13px] text-muted">
                          Answer on the last contract read
                        </dt>
                        <dd className="figure text-right text-[13px] font-semibold text-ink">
                          {watch.status
                            ? `settled: ${String(
                                booleanValue(watch.status, "settled") ?? "not reported",
                              )}`
                            : "not reported"}
                        </dd>
                      </div>
                      {transactionHash && (
                        <div className="rule flex items-baseline justify-between gap-4 py-2">
                          <dt className="text-[13px] text-muted">
                            Hash the server did return
                          </dt>
                          <dd className="figure min-w-0 break-all text-right text-[13px] font-semibold text-ink">
                            {transactionUrl ? (
                              <a
                                href={transactionUrl}
                                target="_blank"
                                rel="noreferrer"
                                className="underline decoration-[color:var(--line-strong)] underline-offset-4 hover:decoration-[color:var(--seal-text)]"
                                title={transactionHash}
                              >
                                {shorten(transactionHash, 12, 10)}
                              </a>
                            ) : (
                              shorten(transactionHash, 12, 10)
                            )}
                          </dd>
                        </div>
                      )}
                    </dl>
                    <p className="mt-3 max-w-xl text-[13px] leading-6 text-muted">
                      Check it yourself: open the contract and call
                      is_authorization_used with this id. Retrace the id above at
                      any time, or run another swipe.
                    </p>
                  </div>
                </div>
              )}

              {watch.phase === "error" && (
                <PanelState
                  kind="error"
                  title="The settlement contract could not be read"
                  className="mt-5"
                >
                  {watch.message} The swipe may still settle; this page stopped
                  reading after {seconds(watch.elapsedMs)} because the read
                  itself failed.
                </PanelState>
              )}
            </div>

            <ol className="mt-6">
              {timeline.map((step, index) => (
                <li
                  key={step.title}
                  className="rule relative grid grid-cols-[28px_minmax(0,1fr)_auto] gap-x-3 py-4 first:border-t-0"
                >
                  <span
                    className={`figure mt-0.5 flex size-7 items-center justify-center rounded-[4px] border text-[13px] font-semibold ${
                      step.state === "complete"
                        ? "border-[color:var(--green)] text-[color:var(--green)]"
                        : step.state === "blocked" || step.state === "unsettled"
                          ? "border-[color:var(--seal-text)] text-seal-bright"
                          : step.state === "active"
                            ? "border-[color:var(--line-strong)] text-ink"
                            : "border-[color:var(--line)] text-muted"
                    }`}
                  >
                    {index + 1}
                  </span>
                  <div className="min-w-0">
                    <h3 className="text-[15px] font-medium text-ink">{step.title}</h3>
                    <p className="mt-1 text-[13px] leading-6 text-muted">{step.detail}</p>
                  </div>
                  <span
                    className={`figure pt-1 text-[13px] font-semibold ${
                      step.state === "complete"
                        ? "text-[color:var(--green)]"
                        : step.state === "blocked" || step.state === "unsettled"
                          ? "text-seal-bright"
                          : "text-muted"
                    }`}
                  >
                    {statusLabel(step.state)}
                  </span>
                </li>
              ))}
            </ol>
          </section>

          <aside className="flex min-w-0 flex-col gap-5">
            <section className="doc p-5">
              <h2 className="text-balance font-[family-name:var(--font-display)] text-[24px] leading-[1.1] tracking-[-0.015em] text-ink">
                Card policy
              </h2>
              <dl className="mt-4">
                {[
                  [
                    "Per-swipe cap",
                    contractCap(runtimeHealth, "maxPerTransaction") ??
                      policyValue(policy.perSwipeCap, " USD"),
                  ],
                  [
                    "Daily cap",
                    contractCap(runtimeHealth, "dailyLimit") ??
                      policyValue(policy.dailyCap),
                  ],
                  [
                    "Allowed countries",
                    policyValue(policy.allowedCountries),
                  ],
                  [
                    "Blocked categories",
                    policyValue(policy.blockedCategories),
                  ],
                  [
                    "Restaurant program",
                    policyValue(policy.lendOnRestaurants),
                  ],
                ].map(([label, value]) => (
                  <div key={label} className="rule py-3 first:border-t-0">
                    <dt className="text-[13px] text-muted">{label}</dt>
                    <dd className="figure mt-1 break-words text-[13px] font-semibold leading-6 text-ink">
                      {value}
                    </dd>
                  </div>
                ))}
              </dl>
              <p className="rule mt-3 pt-3 text-[13px] leading-5 text-muted">
                Swipe and merchant rules are enforced by the authorization API. The daily cap is
                enforced onchain.
              </p>
            </section>

            <section className="doc p-5">
              <div className="flex items-baseline justify-between gap-4">
                <h2 className="text-balance font-[family-name:var(--font-display)] text-[24px] leading-[1.1] tracking-[-0.015em] text-ink">
                  What&apos;s blocking settlement
                </h2>
                <span
                  className={`figure text-[13px] font-semibold uppercase tracking-[0.06em] ${
                    runtimeReady ? "text-[color:var(--green)]" : "text-seal-bright"
                  }`}
                >
                  {runtime.phase === "loading"
                    ? "Checking"
                    : runtimeReady
                      ? "Clear"
                      : "Action needed"}
                </span>
              </div>

              <div aria-live="polite" className="mt-4">
                {runtime.phase === "loading" && (
                  <div
                    className="flex flex-col gap-2"
                    aria-busy="true"
                    aria-label="Reading hosted account configuration"
                  >
                    <Skeleton className="h-4 w-3/4" />
                    <Skeleton className="h-4 w-1/2" />
                  </div>
                )}
                {runtime.phase === "error" && (
                  <PanelState kind="error" title="Readiness could not be verified">
                    {runtime.message}
                  </PanelState>
                )}
                {runtime.phase === "loaded" &&
                  runtime.readiness.missing.length > 0 && (
                    <ul className="flex flex-col gap-2">
                      {runtime.readiness.missing.map((name) => (
                        <li
                          key={name}
                          className="figure break-all border-l-2 border-[color:var(--seal)] pl-3 text-[13px] font-semibold leading-5 text-seal-bright"
                        >
                          {name}
                        </li>
                      ))}
                    </ul>
                  )}
                {runtime.phase === "loaded" &&
                  runtime.readiness.missing.length === 0 &&
                  runtime.readiness.ready && (
                    <p className="text-[13px] leading-6 text-[color:var(--green)]">
                      Required runtime configuration is present.
                    </p>
                  )}
                {runtime.phase === "loaded" &&
                  !runtime.readiness.ready &&
                  runtime.readiness.missing.length === 0 && (
                    <PanelState
                      kind="error"
                      title="The readiness endpoint did not name a missing variable"
                    >
                      It reported the card as not ready without saying which value is absent.
                    </PanelState>
                  )}
              </div>
            </section>

            {runtimeHealth && (
              <section className="doc p-5">
                <h2 className="text-balance font-[family-name:var(--font-display)] text-[24px] leading-[1.1] tracking-[-0.015em] text-ink">
                  System health
                </h2>
                <div className="mt-3">
                  <RuntimeProbe label="Sepolia RPC" value={runtimeHealth.rpc} />
                  <RuntimeProbe label="Proof service" value={runtimeHealth.proving} />
                  <RuntimeProbe label="Discovery indexer" value={runtimeHealth.indexer} />
                  <RuntimeProbe
                    label="Settlement contract"
                    value={runtimeHealth.cardSettlement}
                  />
                </div>
                {headBlock !== undefined && (
                  <p className="figure rule mt-3 pt-3 text-[13px] text-muted">
                    RPC head block {headBlock} on {network}.
                  </p>
                )}
              </section>
            )}
          </aside>
        </div>

        <section className="doc p-5 sm:p-6">
          <div className="grid gap-3 border-b border-[color:var(--line)] pb-5 md:grid-cols-[minmax(0,0.7fr)_minmax(0,1fr)]">
            <h2 className="text-balance font-[family-name:var(--font-display)] text-[24px] leading-[1.1] tracking-[-0.015em] text-ink">
              What&apos;s hidden, what isn&apos;t
            </h2>
            <p className="text-[13px] leading-6 text-muted">
              Your wallet and shielded balance stay off the public record. The merchant, amount,
              and settlement transaction are still visible onchain, the same as any card.
            </p>
          </div>

          {/* Below 768px the columns restack instead of sitting in a 640px
              track inside an overflow box. The Public column is the honest half
              of this claim and it was entirely off screen at 375px with no
              affordance saying so, which reads as if only the Hidden column
              existed. Same three rows, same words; the Hidden and Public
              headings repeat inline on small screens because a stacked cell has
              no column head above it. */}
          <div className="mt-5 md:overflow-x-auto">
            <table className="w-full border-collapse text-left md:min-w-[640px]">
              <thead className="hidden md:table-header-group">
                <tr className="border-b border-[color:var(--line-strong)] text-[11px] uppercase tracking-[0.14em] text-muted">
                  <th scope="col" className="pb-3 pr-5 font-semibold">
                    Boundary
                  </th>
                  <th scope="col" className="pb-3 pr-5 font-semibold">
                    Hidden
                  </th>
                  <th scope="col" className="pb-3 font-semibold">
                    Public
                  </th>
                </tr>
              </thead>
              <tbody className="block text-[13px] md:table-row-group">
                <tr className="block border-b border-[color:var(--line)] pb-3 last:border-b-0 md:table-row md:pb-0 md:align-top">
                  <th
                    scope="row"
                    className="block pt-4 font-semibold text-ink md:table-cell md:py-4 md:pr-5"
                  >
                    Identity
                  </th>
                  <td className="block pt-3 leading-6 text-muted md:table-cell md:py-4 md:pr-5">
                    <span className="block text-[11px] font-semibold text-ink md:hidden">
                      Hidden
                    </span>
                    Primary wallet link and unrelated account history
                  </td>
                  <td className="block pt-3 leading-6 text-muted md:table-cell md:py-4">
                    <span className="block text-[11px] font-semibold text-ink md:hidden">
                      Public
                    </span>
                    Hosted settlement account activity
                  </td>
                </tr>
                <tr className="block border-b border-[color:var(--line)] pb-3 last:border-b-0 md:table-row md:pb-0 md:align-top">
                  <th
                    scope="row"
                    className="block pt-4 font-semibold text-ink md:table-cell md:py-4 md:pr-5"
                  >
                    Funds
                  </th>
                  <td className="block pt-3 leading-6 text-muted md:table-cell md:py-4 md:pr-5">
                    <span className="block text-[11px] font-semibold text-ink md:hidden">
                      Hidden
                    </span>
                    Total private holdings, selected notes, and private change
                  </td>
                  <td className="block pt-3 leading-6 text-muted md:table-cell md:py-4">
                    <span className="block text-[11px] font-semibold text-ink md:hidden">
                      Public
                    </span>
                    Settlement token and exact settlement amount
                  </td>
                </tr>
                <tr className="block border-b border-[color:var(--line)] pb-3 last:border-b-0 md:table-row md:pb-0 md:align-top">
                  <th
                    scope="row"
                    className="block pt-4 font-semibold text-ink md:table-cell md:py-4 md:pr-5"
                  >
                    Transaction
                  </th>
                  <td className="block pt-3 leading-6 text-muted md:table-cell md:py-4 md:pr-5">
                    <span className="block text-[11px] font-semibold text-ink md:hidden">
                      Hidden
                    </span>
                    Link between the cardholder and STRK20 input notes
                  </td>
                  <td className="block pt-3 leading-6 text-muted md:table-cell md:py-4">
                    <span className="block text-[11px] font-semibold text-ink md:hidden">
                      Public
                    </span>
                    Settlement recipient, transaction timing, and receipt status
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </AccountChrome>
  );
}
