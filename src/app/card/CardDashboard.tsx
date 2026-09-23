"use client";

import {
  type FormEvent,
  useCallback,
  useEffect,
  useMemo,
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
  | { phase: "loaded"; items: JsonRecord[]; readAt: Date }
  | { phase: "error"; message: string };

type TimelineState = "waiting" | "active" | "complete" | "blocked";

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
  return "Waiting";
}

function timelineFromLookup(
  lookup: LookupState,
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
  base[3].state =
    settled === true || status === "confirmed" || status === "succeeded"
      ? "complete"
      : approved === false
        ? "blocked"
        : hasTransaction
          ? "active"
          : "waiting";
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
      setSettlements({ phase: "loaded", items, readAt: new Date() });
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

  const timeline = useMemo(() => timelineFromLookup(lookup), [lookup]);

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

          {settlements.phase === "loaded" && (
            <p className="figure rule-paper mt-5 pt-4 text-[13px] text-paper-muted">
              Read from {network} settlement events{" "}
              {headBlock !== undefined
                ? `up to block ${headBlock}`
                : "up to the head block the node reported"}
              , at {clockUtc(settlements.readAt)}, this browser clock.
              {headBlock === undefined
                ? " The health probe did not return a block height on this read."
                : ""}
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

            <div className="rule mt-5 pt-5">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
                <div>
                  <h3 className="text-[15px] font-semibold text-ink">Try a real swipe</h3>
                  <p className="mt-1 max-w-md text-[13px] leading-6 text-muted">
                    A restaurant purchase also lends 10 STRK into the Earn vault, settled in the
                    same transaction as the payment.
                  </p>
                </div>
                {demoEnabled && (
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
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
                        : step.state === "blocked"
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
                        : step.state === "blocked"
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

          <div className="mt-5 overflow-x-auto">
            <table className="w-full min-w-[640px] border-collapse text-left">
              <thead>
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
              <tbody className="text-[13px]">
                <tr className="border-b border-[color:var(--line)] align-top">
                  <th scope="row" className="py-4 pr-5 font-semibold text-ink">
                    Identity
                  </th>
                  <td className="py-4 pr-5 leading-6 text-muted">
                    Primary wallet link and unrelated account history
                  </td>
                  <td className="py-4 leading-6 text-muted">
                    Hosted settlement account activity
                  </td>
                </tr>
                <tr className="border-b border-[color:var(--line)] align-top">
                  <th scope="row" className="py-4 pr-5 font-semibold text-ink">
                    Funds
                  </th>
                  <td className="py-4 pr-5 leading-6 text-muted">
                    Total private holdings, selected notes, and private change
                  </td>
                  <td className="py-4 leading-6 text-muted">
                    Settlement token and exact settlement amount
                  </td>
                </tr>
                <tr className="align-top">
                  <th scope="row" className="py-4 pr-5 font-semibold text-ink">
                    Transaction
                  </th>
                  <td className="py-4 pr-5 leading-6 text-muted">
                    Link between the cardholder and STRK20 input notes
                  </td>
                  <td className="py-4 leading-6 text-muted">
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
