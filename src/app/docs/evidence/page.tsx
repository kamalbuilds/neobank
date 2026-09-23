import type { Metadata } from 'next';
import {
  CONTRACT_RECORD,
  RETIRED_CONTRACTS,
  TX_RECORD,
  type ContractRow,
  type TxRow,
} from '@/lib/evidence';
import {
  ageInHours,
  isStale,
  readAttestation,
  STALE_AFTER_HOURS,
} from '@/lib/evidence-verification';
import type { NetworkKey } from '@/utils/constants';
import { A, C, DocsPage, H2, Limit, P } from '../components/prose';

export const metadata: Metadata = {
  title: 'Evidence - Sealed docs',
  description:
    'Every contract and transaction behind Sealed, on chain, with the file each value comes from - checkable without trusting this page.',
};

/**
 * The register. A reviewer reads this page to answer two questions in order:
 * is this mainnet or a testnet, and does the hash open. So the network label is
 * a stamp rather than a caption, every hash is printed in full at reading size
 * in tabular mono, and the explorer link is named rather than implied by a
 * cursor change. Nothing here is shortened: a truncated hash cannot be pasted
 * into an explorer, which is the only thing a reader wants to do with it.
 */

/** Which file in this repo holds the transaction values below. */
const TX_SOURCE = 'src/lib/evidence.ts';

function NetworkStamp({ network }: { network: NetworkKey }) {
  const mainnet = network === 'mainnet';
  return (
    <span
      className={`figure inline-flex shrink-0 items-center rounded-[2px] px-2 py-[3px] text-[14px] font-semibold uppercase tracking-[0.14em] ${
        mainnet
          ? 'bg-seal text-paper'
          : 'border border-[color:var(--paper-line)] bg-paper-2 text-paper-ink'
      }`}
    >
      {network}
    </span>
  );
}

/** A secondary stamp: whose deployment it is, or that it is out of service. */
function Stamp({ label, tone }: { label: string; tone: 'neutral' | 'seal' }) {
  return (
    <span
      className={`figure inline-flex shrink-0 items-center rounded-[2px] border px-2 py-[3px] text-[12px] font-semibold uppercase tracking-[0.14em] ${
        tone === 'seal'
          ? 'border-[color:var(--seal)] text-seal'
          : 'border-[color:var(--paper-line)] text-paper-ink'
      }`}
    >
      {label}
    </span>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <>
      <dt className="figure pt-[2px] text-[12px] font-semibold uppercase tracking-[0.14em] text-paper-muted">
        {label}
      </dt>
      <dd className="min-w-0">{children}</dd>
    </>
  );
}

function ExplorerLink({ href, value }: { href: string; value: string }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      className="group inline-flex flex-wrap items-baseline gap-x-2.5 gap-y-1"
    >
      <span className="figure break-all text-[14px] font-medium text-paper-ink underline decoration-[color:var(--paper-line)] underline-offset-4 group-hover:decoration-[color:var(--seal)]">
        {value}
      </span>
      <span className="figure whitespace-nowrap rounded-[2px] border border-[color:var(--seal)] px-1.5 py-[1px] text-[12px] font-semibold uppercase tracking-[0.12em] text-seal">
        Voyager
        <span aria-hidden="true"> &#8599;</span>
      </span>
    </a>
  );
}

/** A cream sheet holding one register, with its own count in the masthead. */
function Register({
  title,
  count,
  children,
}: {
  title: string;
  count: string;
  children: React.ReactNode;
}) {
  return (
    <section className="paper mt-7">
      <header className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 border-b border-[color:var(--paper-line)] bg-paper-2 px-5 py-3">
        <h3 className="figure text-[12px] font-semibold uppercase tracking-[0.16em] text-paper-ink">
          {title}
        </h3>
        <span className="figure text-[12px] font-semibold uppercase tracking-[0.14em] text-paper-muted">
          {count}
        </span>
      </header>
      {children}
    </section>
  );
}

function EntryHead({
  index,
  label,
  network,
  stamps,
}: {
  index: number;
  label: string;
  network: NetworkKey;
  stamps?: React.ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
      <span className="figure text-[14px] font-semibold text-paper-muted">
        {String(index).padStart(2, '0')}
      </span>
      <h4 className="text-[16px] font-bold leading-snug text-paper-ink">{label}</h4>
      <NetworkStamp network={network} />
      {stamps}
    </div>
  );
}

function TxEntry({ row, index }: { row: TxRow; index: number }) {
  const settled = row.status.startsWith('SUCCEEDED');
  return (
    <article className="border-b border-[color:var(--paper-line)] px-5 py-5 last:border-b-0">
      <EntryHead index={index} label={row.label} network={row.network} />
      <p className="mt-2.5 max-w-[58ch] text-[14px] leading-[1.65] text-paper-muted">
        {row.detail}
      </p>
      <dl className="mt-4 grid grid-cols-[76px_minmax(0,1fr)] gap-x-4 gap-y-2.5">
        <Field label="Hash">
          <ExplorerLink href={row.href} value={row.hash} />
        </Field>
        <Field label="Status">
          <span
            className={`figure text-[14px] font-semibold ${
              settled ? 'text-ledger-green' : 'text-paper-ink'
            }`}
          >
            {row.status}
          </span>
        </Field>
        {row.block ? (
          <Field label="Block">
            <span className="figure text-[14px] text-paper-ink">
              {row.block.toLocaleString('en-US')}
            </span>
          </Field>
        ) : null}
        <Field label="Source">
          <span className="figure break-all text-[14px] text-paper-ink">{TX_SOURCE}</span>
        </Field>
      </dl>
    </article>
  );
}

function ContractEntry({
  row,
  index,
  retired = false,
}: {
  row: ContractRow;
  index: number;
  retired?: boolean;
}) {
  return (
    <article className="border-b border-[color:var(--paper-line)] px-5 py-5 last:border-b-0">
      <EntryHead
        index={index}
        label={row.label}
        network={row.network}
        stamps={
          <>
            {row.origin === 'starkware' ? <Stamp label="StarkWare" tone="neutral" /> : null}
            {retired ? <Stamp label="Retired" tone="seal" /> : null}
          </>
        }
      />
      <p className="mt-2.5 max-w-[58ch] text-[14px] leading-[1.65] text-paper-muted">
        {row.detail}
      </p>
      <dl className="mt-4 grid grid-cols-[76px_minmax(0,1fr)] gap-x-4 gap-y-2.5">
        <Field label="Address">
          <ExplorerLink href={row.href} value={row.address} />
        </Field>
        <Field label="Source">
          <span className="figure break-all text-[14px] text-paper-ink">{row.source}</span>
        </Field>
      </dl>
    </article>
  );
}

/**
 * The stamp the page used to be missing. It claimed verification against a live
 * RPC and never said when, which is the shape a claim takes after it has
 * stopped being true. Three states, none of them blank: no attestation or a
 * failure reads as not verified in seal, an attestation older than
 * STALE_AFTER_HOURS reads as stale in muted, and only a fresh clean run is
 * green. Every figure comes from the run's own output.
 */
function VerificationStamp() {
  const a = readAttestation();

  if (!a || a.failed > 0) {
    const detail = a
      ? `${a.failed} of ${a.checked} values failed the last run at ${utc(a.ranAt)} UTC.`
      : 'No attestation file was found, so nothing here has been checked against a chain.';
    return (
      <StampShell
        tone="seal"
        state="Not verified"
        detail={detail}
        script="node scripts/verify-evidence.mjs"
      />
    );
  }

  const hours = Math.round(ageInHours(a));
  const blocks = [
    a.blocks.mainnet === null ? null : `mainnet block ${a.blocks.mainnet.toLocaleString('en-US')}`,
    a.blocks.sepolia === null ? null : `sepolia block ${a.blocks.sepolia.toLocaleString('en-US')}`,
  ]
    .filter((s): s is string => s !== null)
    .join(' · ');

  const passed = `${a.passed} of ${a.checked} values passed`;
  const when = `${utc(a.ranAt)} UTC`;

  if (isStale(a)) {
    return (
      <StampShell
        tone="muted"
        state="Stale"
        detail={`${passed}, but that run finished ${hours} hours ago, past the ${STALE_AFTER_HOURS}-hour window. ${blocks} · ${when}.`}
        script="node scripts/verify-evidence.mjs"
      />
    );
  }

  return (
    <StampShell
      tone="green"
      state="Verified"
      detail={`${passed} · ${blocks} · ${when}`}
      script="node scripts/verify-evidence.mjs"
    />
  );
}

function utc(iso: string): string {
  return new Date(iso).toISOString().replace('T', ' ').slice(0, 16);
}

function StampShell({
  tone,
  state,
  detail,
  script,
}: {
  tone: 'green' | 'muted' | 'seal';
  state: string;
  detail: string;
  script: string;
}) {
  const edge =
    tone === 'green'
      ? 'border-l-[color:var(--green)]'
      : tone === 'seal'
        ? 'border-l-[color:var(--seal)]'
        : 'border-l-[color:var(--line-strong)]';
  const chip =
    tone === 'green'
      ? 'border-[color:var(--green)] bg-[color:var(--green-soft)] text-[color:var(--green)]'
      : tone === 'seal'
        ? 'border-[color:var(--seal-soft-2)] bg-[color:var(--seal-soft)] text-seal-bright'
        : 'border-[color:var(--line-strong)] bg-white/[0.03] text-muted';
  return (
    <aside className={`doc border-l-2 ${edge} px-4 py-4`}>
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
        <span
          className={`figure inline-flex items-center rounded-[3px] border px-2 py-[3px] text-[12px] font-semibold uppercase tracking-[0.14em] ${chip}`}
        >
          {state}
        </span>
        <span className="figure text-[14px] text-ink/85">{script}</span>
      </div>
      <p className="figure mt-2.5 text-[14px] leading-[1.6] text-ink/80">{detail}</p>
    </aside>
  );
}

export default function Evidence() {
  const mainnetTx = TX_RECORD.filter((r) => r.network === 'mainnet').length;
  const sepoliaTx = TX_RECORD.length - mainnetTx;
  const mainnetContracts = CONTRACT_RECORD.filter((r) => r.network === 'mainnet').length;
  const sepoliaContracts = CONTRACT_RECORD.length - mainnetContracts;

  return (
    <DocsPage
      eyebrow="Reference"
      title="Evidence"
      lead="Every contract and every settled transaction, each naming the file its value comes from - so a reader who does not trust this page can check it against the chain and against the repository."
      slug="evidence"
    >
      <VerificationStamp />

      <P>
        Nothing on this page is typed by hand into a paragraph. Each row is imported from{' '}
        <C>src/lib/evidence.ts</C>, which in turn imports the addresses from{' '}
        <C>src/utils/constants.ts</C> - the same constants the running application uses. A value
        that changes in the app changes here.
      </P>
      <P>
        Every hash and address below is verified against a live RPC by{' '}
        <C>node scripts/verify-evidence.mjs</C>, which fails on a transaction that did not succeed
        or an address with no contract at it.
      </P>

      <H2>Transactions</H2>
      <Register
        title="Transaction register"
        count={`${TX_RECORD.length} entries · ${mainnetTx} mainnet · ${sepoliaTx} sepolia`}
      >
        {TX_RECORD.map((row, i) => (
          <TxEntry key={row.hash} row={row} index={i + 1} />
        ))}
      </Register>

      <H2>Contracts</H2>
      <P>
        Rows marked STARKWARE are not ours: the privacy pool and the shadow anonymizer are
        StarkWare&apos;s deployments, used rather than redeployed. The distinction matters when you
        are deciding whom to trust - that cryptography is audited, and the helpers around it are
        not.
      </P>
      <Register
        title="Contract register"
        count={`${CONTRACT_RECORD.length} entries · ${mainnetContracts} mainnet · ${sepoliaContracts} sepolia`}
      >
        {CONTRACT_RECORD.map((row, i) => (
          <ContractEntry key={`${row.network}-${row.address}`} row={row} index={i + 1} />
        ))}
      </Register>

      <H2>Retired</H2>
      <P>
        Listed rather than deleted. A deployment that was live and then abandoned is exactly what a
        reader deserves to find named, and this one&apos;s failure is the most instructive bug in
        the repository - see <A href="/docs/how-it-works/the-vault">the vault</A>.
      </P>
      <Register
        title="Retired register"
        count={`${RETIRED_CONTRACTS.length} ${RETIRED_CONTRACTS.length === 1 ? 'entry' : 'entries'}`}
      >
        {RETIRED_CONTRACTS.map((row, i) => (
          <ContractEntry key={`${row.network}-${row.address}`} row={row} index={i + 1} retired />
        ))}
      </Register>

      <H2>What this does not prove</H2>
      <Limit>
        A transaction succeeding proves the code did what it did, not that the code is correct.
        None of the Sealed contracts have been audited. Four transactions are on mainnet with real
        STRK: two shields and two viewing-key registrations. Everything else is on Sepolia with
        test money, and all four mainnet transactions exercise StarkWare&apos;s pool rather than
        any contract of ours, so nothing this project wrote has run on mainnet.
      </Limit>
      <P>
        The source repository is{' '}
        <A href="https://github.com/kamalbuilds/neobank">github.com/kamalbuilds/neobank</A>, and the
        contract work is at{' '}
        <A href="https://github.com/kamalbuilds/starknet-shadow-account-starter">
          starknet-shadow-account-starter
        </A>
        .
      </P>
    </DocsPage>
  );
}
