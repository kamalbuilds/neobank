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
import { HowThisWorks, Skeleton } from "../components/v2/ui";
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
  | { phase: "loaded"; items: JsonRecord[] }
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

function stringValue(record: JsonRecord, ...keys: string[]): string | undefined {
  for (const key of keys) {
    const value = record[key];
    if (typeof value === "string" && value) return value;
    if (typeof value === "number") return String(value);
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
    <div className="flex min-w-0 items-center justify-between gap-4 border-t border-white/[0.06] py-3 first:border-t-0">
      <span className="text-sm text-[#a3acbd]">{label}</span>
      <span
        className={`font-mono text-xs ${
          ok
            ? "text-[#73e5d2]"
            : failed
              ? "text-[#fca5a5]"
              : "text-[#7a859c]"
        }`}
      >
        {ok ? "Healthy" : failed ? "Failed" : "Not reported"}
      </span>
    </div>
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
      setSettlements({ phase: "loaded", items });
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
  const cardStatus: BankCardStatus =
    runtime.phase === "loading" ? "checking" : runtimeReady ? "ready" : "blocked";
  const runtimeHealth =
    runtime.phase === "loaded" && isRecord(runtime.health?.health)
      ? runtime.health.health
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

  return (
    <AccountChrome>
      <div className="text-[#eaf0f8]">
        <section className="border-b border-white/[0.07] pb-8">
          <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_420px] lg:items-start">
            <div className="max-w-3xl">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <p className="font-mono text-xs uppercase tracking-[0.14em] text-[#2dd4bf]">
                  Spend from your shielded balance
                </p>
                <button
                  type="button"
                  onClick={() => void loadRuntime()}
                  disabled={runtime.phase === "loading"}
                  className="min-h-11 rounded-2xl border border-white/[0.1] bg-white/[0.03] px-4 text-sm font-medium text-[#d8deea] transition-[background-color,border-color,transform] duration-150 hover:border-white/[0.18] hover:bg-white/[0.06] active:scale-[0.97] disabled:cursor-wait disabled:opacity-50 lg:hidden"
                >
                  {runtime.phase === "loading" ? "Checking status" : "Refresh status"}
                </button>
              </div>
              {/* Leads with where the money comes from, not with what the
                  merchant misses. "The merchant never sees your wallet" is true
                  of any card ever issued, so it described the category instead
                  of this product; the private pool is the part nothing else
                  does. The custodial caveat stays, moved below the claim it
                  qualifies rather than crowding the opening paragraph. */}
              <h1 className="mt-3 text-balance font-display text-[clamp(2rem,4vw,3.75rem)] font-medium leading-[1.02] tracking-[-0.04em]">
                A card that spends from your private STRK20 pool.
              </h1>
              <p className="mt-4 max-w-2xl text-pretty text-[15px] leading-7 text-[#909aae]">
                Swipe and it approves instantly against your card limits. The money is drawn from
                your shielded balance, and you program what else each swipe does.
              </p>
              <p className="mt-3 max-w-2xl text-pretty text-[13.5px] leading-6 text-[#687287]">
                One honest exception: the hosted settlement account that pays the merchant is
                custodial. Sealed&apos;s operator holds a derived key and can see its settlements,
                and the settlement token, amount, and recipient land on Starknet in the clear.
              </p>
              <button
                type="button"
                onClick={() => void loadRuntime()}
                disabled={runtime.phase === "loading"}
                className="mt-5 hidden min-h-11 rounded-2xl border border-white/[0.1] bg-white/[0.03] px-4 text-sm font-medium text-[#d8deea] transition-[background-color,border-color,transform] duration-150 hover:border-white/[0.18] hover:bg-white/[0.06] active:scale-[0.97] disabled:cursor-wait disabled:opacity-50 lg:inline-flex"
              >
                {runtime.phase === "loading" ? "Checking status" : "Refresh status"}
              </button>
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

          <div className="mt-8 flex items-center gap-2.5 border-y border-white/[0.06] py-4">
            <span
              className={`inline-block h-2 w-2 rounded-full ${
                runtime.phase === "loading"
                  ? "animate-pulse bg-[#eab308]"
                  : runtimeReady
                    ? "bg-[#34d399] shadow-[0_0_8px_rgba(52,211,153,0.7)]"
                    : "bg-[#f87171]"
              }`}
              aria-hidden="true"
            />
            <span className="text-sm font-medium text-[#d8deea]">
              {runtime.phase === "loading"
                ? "Checking card status…"
                : runtimeReady
                  ? "Card is live and can settle"
                  : "Card settlement is blocked"}
            </span>
          </div>

          <HowThisWorks className="mt-3" label="Contract addresses backing this card">
            <dl className="grid gap-x-8 gap-y-3 sm:grid-cols-2 lg:grid-cols-4">
              <div>
                <dt className="text-xs text-[#687287]">Network</dt>
                <dd className="mt-1 font-mono text-[13px] text-[#a3acbd]">
                  {readiness?.network || "Sepolia"}
                </dd>
              </div>
              <div className="min-w-0">
                <dt className="text-xs text-[#687287]">Hosted account</dt>
                <dd
                  className="mt-1 truncate font-mono text-[13px] text-[#a3acbd]"
                  title={readiness?.accountAddress}
                >
                  {shorten(readiness?.accountAddress)}
                </dd>
              </div>
              <div className="min-w-0">
                <dt className="text-xs text-[#687287]">Privacy pool</dt>
                <dd
                  className="mt-1 truncate font-mono text-[13px] text-[#a3acbd]"
                  title={readiness?.poolAddress}
                >
                  {shorten(readiness?.poolAddress)}
                </dd>
              </div>
              <div className="min-w-0">
                <dt className="text-xs text-[#687287]">Settlement contract</dt>
                <dd
                  className="mt-1 truncate font-mono text-[13px] text-[#a3acbd]"
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

        <div className="mt-8 grid gap-6 lg:grid-cols-[minmax(0,1.45fr)_minmax(300px,0.72fr)]">
          <section className="min-w-0 rounded-2xl border border-white/[0.07] bg-white/[0.022] elevate-1 p-5 sm:p-6">
            <div className="flex flex-col gap-2 border-b border-white/[0.06] pb-5 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <h2 className="text-balance font-display text-xl font-medium tracking-[-0.02em]">
                  Trace a swipe
                </h2>
                <p className="mt-1 text-sm leading-6 text-[#7f899d]">
                  Follow one real card purchase from approval to the Starknet transaction that
                  settled it.
                </p>
              </div>
              <span className="font-mono text-[11px] uppercase tracking-[0.12em] text-[#687287]">
                Live status
              </span>
            </div>

            <div className="mt-5 rounded-2xl border border-white/[0.06] bg-[#0b0d13]/80 p-4">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
                <div>
                  <h3 className="text-sm font-medium text-[#d8deea]">
                    Try a real swipe
                  </h3>
                  <p className="mt-1 text-sm leading-6 text-[#7f899d]">
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
                      className="h-11 whitespace-nowrap rounded-2xl border border-[#2dd4bf]/40 bg-[#2dd4bf]/10 px-4 text-sm font-semibold text-[#9ae9da] transition-[background-color,transform] duration-150 hover:bg-[#2dd4bf]/16 active:scale-[0.97] disabled:cursor-wait disabled:opacity-50"
                    >
                      {demo === "running"
                        ? "Paying Osteria Nova"
                        : "Pay dinner at Osteria Nova"}
                    </button>
                    <button
                      type="button"
                      onClick={() => void handleDemoAuthorize("from-vault")}
                      disabled={demo === "running" || !runtimeReady}
                      className="h-11 whitespace-nowrap rounded-2xl border border-white/[0.14] bg-white/[0.04] px-4 text-sm font-semibold text-[#d8deea] transition-[background-color,transform] duration-150 hover:bg-white/[0.08] active:scale-[0.97] disabled:cursor-wait disabled:opacity-50"
                    >
                      {demo === "running"
                        ? "Paying from vault"
                        : "Pay Osteria from vault"}
                    </button>
                  </div>
                )}
              </div>
              {demo === "error" && (
                <p className="mt-3 text-sm leading-6 text-[#fca5a5]">
                  {demoMessage}
                </p>
              )}
              <div aria-live="polite" className="mt-4">
                {settlements.phase === "loading" && (
                  <div className="flex flex-col gap-2" aria-busy="true" aria-label="Reading settlement receipts from Sepolia">
                    <Skeleton className="h-12" />
                    <Skeleton className="h-12" />
                  </div>
                )}
                {settlements.phase === "error" && (
                  <p className="text-sm leading-6 text-[#fca5a5]" role="alert">
                    {settlements.message}
                  </p>
                )}
                {settlements.phase === "loaded" &&
                  settlements.items.length === 0 && (
                    <p className="border-l-2 border-white/[0.1] pl-4 text-sm leading-6 text-[#7f899d]">
                      No card authorizations have settled through the contract
                      yet.
                    </p>
                  )}
                {settlements.phase === "loaded" &&
                  settlements.items.length > 0 && (
                    <ul className="divide-y divide-white/[0.06] border-y border-white/[0.06]">
                      {settlements.items.map((item) => {
                        const tx = stringValue(item, "transactionHash");
                        const txUrl = stringValue(
                          item,
                          "explorerTransactionUrl",
                        );
                        const felt = stringValue(item, "authorizationFelt");
                        const lendAssets = stringValue(item, "lendAssets");
                        return (
                          <li
                            key={`${tx}-${felt}`}
                            className="grid gap-2 py-3 sm:grid-cols-[minmax(0,1fr)_auto]"
                          >
                            <div className="min-w-0">
                              <p className="font-mono text-sm text-[#d8deea]">
                                {formatSettledAmount(item)}
                                {lendAssets
                                  ? ` · lent ${formatSettledAmount({
                                      amount: lendAssets,
                                      token: STRK_TOKEN,
                                    })}`
                                  : ""}
                              </p>
                              <p
                                className="mt-1 truncate font-mono text-[11px] text-[#687287]"
                                title={felt}
                              >
                                {shorten(felt, 10, 8)}
                              </p>
                            </div>
                            {tx && txUrl ? (
                              <a
                                href={txUrl}
                                target="_blank"
                                rel="noreferrer"
                                className="self-center truncate font-mono text-xs text-[#73e5d2] underline decoration-[#2dd4bf]/30 underline-offset-4 hover:decoration-[#2dd4bf]"
                              >
                                {shorten(tx)}
                              </a>
                            ) : (
                              <p className="self-center font-mono text-xs text-[#687287]">
                                Confirmed
                              </p>
                            )}
                          </li>
                        );
                      })}
                    </ul>
                  )}
              </div>
            </div>

            <form
              onSubmit={handleLookup}
              className="mt-5 grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto]"
            >
              <div>
                <label
                  htmlFor="authorization-id"
                  className="mb-2 block text-xs font-medium text-[#a3acbd]"
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
                  className="h-12 w-full rounded-2xl border border-white/[0.09] bg-[#0b0d13] px-4 font-mono text-sm text-[#eaf0f8] outline-none transition-[border-color,box-shadow] duration-150 placeholder:text-[#4f586a] focus:border-[#2dd4bf]/70 focus:ring-4 focus:ring-[#2dd4bf]/10"
                />
              </div>
              <button
                type="submit"
                disabled={lookup.phase === "loading"}
                className="h-12 self-end whitespace-nowrap rounded-2xl bg-[#2dd4bf] px-5 text-sm font-semibold text-[#04201b] transition-[background-color,transform] duration-150 hover:bg-[#5eead4] active:scale-[0.97] disabled:cursor-wait disabled:opacity-50"
              >
                {lookup.phase === "loading" ? "Tracing" : "Trace authorization"}
              </button>
            </form>

            <div aria-live="polite" className="mt-6">
              {lookup.phase === "idle" && (
                <p className="border-l-2 border-white/[0.1] pl-4 text-sm leading-6 text-[#7f899d]">
                  Enter an authorization ID to see how that swipe settled.
                </p>
              )}
              {lookup.phase === "error" && (
                <p className="rounded-2xl border border-[#f87171]/25 bg-[#f87171]/[0.07] px-4 py-3 text-sm leading-6 text-[#fca5a5]">
                  {lookup.message}
                </p>
              )}
              {lookup.phase === "loaded" && (
                <div className="grid gap-3 border-y border-white/[0.06] py-4 sm:grid-cols-2">
                  <div className="min-w-0">
                    <p className="text-xs text-[#687287]">Authorization</p>
                    <p className="mt-1 truncate font-mono text-sm text-[#d8deea]">
                      {stringValue(lookup.data, "authorizationId") ||
                        authorizationId.trim()}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-[#687287]">Settlement</p>
                    <p className="mt-1 font-mono text-sm text-[#d8deea]">
                      {booleanValue(lookup.data, "settled") === true
                        ? "Confirmed"
                        : stringValue(
                            lookup.data,
                            "settlementStatus",
                            "status",
                            "executionStatus",
                          ) || "Not confirmed"}
                    </p>
                  </div>
                  {transactionHash && (
                    <div className="min-w-0">
                      <p className="text-xs text-[#687287]">Transaction</p>
                      {transactionUrl ? (
                        <a
                          href={transactionUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="mt-1 block truncate font-mono text-sm text-[#73e5d2] underline decoration-[#2dd4bf]/30 underline-offset-4 hover:decoration-[#2dd4bf]"
                        >
                          {shorten(transactionHash)}
                        </a>
                      ) : (
                        <p
                          className="mt-1 truncate font-mono text-sm text-[#d8deea]"
                          title={transactionHash}
                        >
                          {shorten(transactionHash)}
                        </p>
                      )}
                    </div>
                  )}
                  {contractAddress && (
                    <div className="min-w-0">
                      <p className="text-xs text-[#687287]">
                        Settlement contract
                      </p>
                      {contractUrl ? (
                        <a
                          href={contractUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="mt-1 block truncate font-mono text-sm text-[#73e5d2] underline decoration-[#2dd4bf]/30 underline-offset-4 hover:decoration-[#2dd4bf]"
                        >
                          {shorten(contractAddress)}
                        </a>
                      ) : (
                        <p
                          className="mt-1 truncate font-mono text-sm text-[#d8deea]"
                          title={contractAddress}
                        >
                          {shorten(contractAddress)}
                        </p>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>

            <ol className="mt-7">
              {timeline.map((step, index) => (
                <li
                  key={step.title}
                  className="relative grid grid-cols-[28px_minmax(0,1fr)_auto] gap-x-3 border-t border-white/[0.06] py-4 first:border-t-0"
                >
                  <span
                    className={`mt-0.5 flex size-7 items-center justify-center rounded-full border font-mono text-[11px] ${
                      step.state === "complete"
                        ? "border-[#2dd4bf]/40 bg-[#2dd4bf]/10 text-[#73e5d2]"
                        : step.state === "blocked"
                          ? "border-[#f87171]/35 bg-[#f87171]/10 text-[#fca5a5]"
                          : step.state === "active"
                            ? "border-[#2dd4bf]/35 text-[#73e5d2]"
                            : "border-white/[0.09] text-[#687287]"
                    }`}
                  >
                    {index + 1}
                  </span>
                  <div className="min-w-0">
                    <h3 className="text-sm font-medium text-[#d8deea]">
                      {step.title}
                    </h3>
                    <p className="mt-1 text-sm leading-6 text-[#737d91]">
                      {step.detail}
                    </p>
                  </div>
                  <span
                    className={`pt-1 font-mono text-[10px] uppercase tracking-[0.1em] ${
                      step.state === "complete"
                        ? "text-[#73e5d2]"
                        : step.state === "blocked"
                          ? "text-[#fca5a5]"
                          : "text-[#687287]"
                    }`}
                  >
                    {statusLabel(step.state)}
                  </span>
                </li>
              ))}
            </ol>
          </section>

          <aside className="min-w-0 space-y-6">
            <section className="rounded-2xl border border-white/[0.07] bg-white/[0.022] elevate-1 p-5">
              <h2 className="text-balance font-display text-lg font-medium tracking-[-0.02em]">
                Card policy
              </h2>
              <dl className="mt-4">
                {[
                  ["Per-swipe cap", policyValue(policy.perSwipeCap, " USD")],
                  ["Daily cap", policyValue(policy.dailyCap)],
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
                  <div
                    key={label}
                    className="border-t border-white/[0.06] py-3 first:border-t-0"
                  >
                    <dt className="text-xs text-[#687287]">{label}</dt>
                    <dd className="mt-1 break-words text-sm leading-6 text-[#cbd2df]">
                      {value}
                    </dd>
                  </div>
                ))}
              </dl>
              <p className="mt-3 text-xs leading-5 text-[#687287]">
                Swipe and merchant rules are enforced by the authorization
                API. The daily cap is enforced onchain.
              </p>
            </section>

            <section className="rounded-2xl border border-white/[0.07] bg-white/[0.022] elevate-1 p-5">
              <div className="flex items-center justify-between gap-4">
                <h2 className="text-balance font-display text-lg font-medium tracking-[-0.02em]">
                  What's blocking settlement
                </h2>
                <span
                  className={`font-mono text-[10px] uppercase tracking-[0.12em] ${
                    runtimeReady ? "text-[#73e5d2]" : "text-[#fca5a5]"
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
                  <p className="text-sm leading-6 text-[#7f899d]">
                    Reading hosted account configuration.
                  </p>
                )}
                {runtime.phase === "error" && (
                  <p className="text-sm leading-6 text-[#fca5a5]">
                    {runtime.message}
                  </p>
                )}
                {runtime.phase === "loaded" &&
                  runtime.readiness.missing.length > 0 && (
                    <ul className="space-y-2">
                      {runtime.readiness.missing.map((name) => (
                        <li
                          key={name}
                          className="break-all border-l-2 border-[#f87171]/45 pl-3 font-mono text-xs leading-5 text-[#fca5a5]"
                        >
                          {name}
                        </li>
                      ))}
                    </ul>
                  )}
                {runtime.phase === "loaded" &&
                  runtime.readiness.missing.length === 0 &&
                  runtime.readiness.ready && (
                    <p className="text-sm leading-6 text-[#9ae9da]">
                      Required runtime configuration is present.
                    </p>
                  )}
                {runtime.phase === "loaded" &&
                  !runtime.readiness.ready &&
                  runtime.readiness.missing.length === 0 && (
                    <p className="text-sm leading-6 text-[#fca5a5]">
                      The readiness endpoint did not name a missing variable.
                    </p>
                  )}
              </div>
            </section>

            {runtimeHealth && (
              <section className="rounded-2xl border border-white/[0.07] bg-white/[0.022] elevate-1 p-5">
                <h2 className="text-balance font-display text-lg font-medium tracking-[-0.02em]">
                  System health
                </h2>
                <div className="mt-3">
                  <RuntimeProbe label="Sepolia RPC" value={runtimeHealth.rpc} />
                  <RuntimeProbe
                    label="Proof service"
                    value={runtimeHealth.proving}
                  />
                  <RuntimeProbe
                    label="Discovery indexer"
                    value={runtimeHealth.indexer}
                  />
                  <RuntimeProbe
                    label="Settlement contract"
                    value={runtimeHealth.cardSettlement}
                  />
                </div>
              </section>
            )}
          </aside>
        </div>

        <section className="mt-6 rounded-2xl border border-white/[0.07] bg-white/[0.022] elevate-1 p-5 sm:p-6">
          <div className="grid gap-3 border-b border-white/[0.06] pb-5 md:grid-cols-[minmax(0,0.7fr)_minmax(0,1fr)]">
            <h2 className="text-balance font-display text-xl font-medium tracking-[-0.02em]">
              What's hidden, what isn't
            </h2>
            <p className="text-sm leading-6 text-[#7f899d]">
              Your wallet and shielded balance stay off the public record. The merchant, amount,
              and settlement transaction are still visible onchain, the same as any card.
            </p>
          </div>

          <div className="mt-5 overflow-x-auto">
            <table className="w-full min-w-[640px] border-collapse text-left">
              <thead>
                <tr className="border-b border-white/[0.08] text-xs text-[#687287]">
                  <th scope="col" className="pb-3 pr-5 font-medium">
                    Boundary
                  </th>
                  <th scope="col" className="pb-3 pr-5 font-medium">
                    Hidden
                  </th>
                  <th scope="col" className="pb-3 font-medium">
                    Public
                  </th>
                </tr>
              </thead>
              <tbody className="text-sm">
                <tr className="border-b border-white/[0.06] align-top">
                  <th
                    scope="row"
                    className="py-4 pr-5 font-medium text-[#cbd2df]"
                  >
                    Identity
                  </th>
                  <td className="py-4 pr-5 leading-6 text-[#a3acbd]">
                    Primary wallet link and unrelated account history
                  </td>
                  <td className="py-4 leading-6 text-[#a3acbd]">
                    Hosted settlement account activity
                  </td>
                </tr>
                <tr className="border-b border-white/[0.06] align-top">
                  <th
                    scope="row"
                    className="py-4 pr-5 font-medium text-[#cbd2df]"
                  >
                    Funds
                  </th>
                  <td className="py-4 pr-5 leading-6 text-[#a3acbd]">
                    Total private holdings, selected notes, and private change
                  </td>
                  <td className="py-4 leading-6 text-[#a3acbd]">
                    Settlement token and exact settlement amount
                  </td>
                </tr>
                <tr className="align-top">
                  <th
                    scope="row"
                    className="py-4 pr-5 font-medium text-[#cbd2df]"
                  >
                    Transaction
                  </th>
                  <td className="py-4 pr-5 leading-6 text-[#a3acbd]">
                    Link between the cardholder and STRK20 input notes
                  </td>
                  <td className="py-4 leading-6 text-[#a3acbd]">
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
