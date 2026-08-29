import type { Metadata } from 'next';
import {
  CONTRACT_RECORD,
  RETIRED_CONTRACTS,
  TX_RECORD,
  shortenHex,
  type ContractRow,
  type TxRow,
} from '@/lib/evidence';
import { A, C, DocsPage, H2, Limit, P } from '../components/prose';

export const metadata: Metadata = {
  title: 'Evidence - Sealed docs',
  description:
    'Every contract and transaction behind Sealed, on chain, with the file each value comes from - checkable without trusting this page.',
};

function ContractCard({ row }: { row: ContractRow }) {
  return (
    <a
      href={row.href}
      target="_blank"
      rel="noreferrer"
      className="block rounded-2xl border border-white/[0.07] bg-white/[0.02] p-4 transition-colors hover:border-white/[0.16] hover:bg-white/[0.04]"
    >
      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <span className="text-[14px] font-semibold text-[#eaf0f8]">{row.label}</span>
        <span className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[#6b7689]">
          {row.network}
        </span>
        {row.origin === 'starkware' ? (
          <span className="rounded-md border border-[#818cf8]/25 bg-[#818cf8]/10 px-1.5 py-0.5 text-[9.5px] font-semibold tracking-[0.1em] text-[#a5b4fc]">
            STARKWARE
          </span>
        ) : null}
      </div>
      <p className="mt-1.5 text-[12.5px] leading-relaxed text-[#8b95a8]">{row.detail}</p>
      <p className="mt-2.5 break-all font-[family-name:var(--font-mono-ui)] text-[11px] text-[#687287]">
        {shortenHex(row.address, 14, 8)} ↗
      </p>
      <p className="mt-1 font-[family-name:var(--font-mono-ui)] text-[10.5px] text-[#4b5568]">
        {row.source}
      </p>
    </a>
  );
}

function TxCard({ row }: { row: TxRow }) {
  return (
    <a
      href={row.href}
      target="_blank"
      rel="noreferrer"
      className="block rounded-2xl border border-white/[0.07] bg-white/[0.02] p-4 transition-colors hover:border-white/[0.16] hover:bg-white/[0.04]"
    >
      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
        <span className="text-[14px] font-semibold text-[#eaf0f8]">{row.label}</span>
        <span className="font-[family-name:var(--font-mono-ui)] text-[10.5px] text-[#6ee7b7]">
          {row.status}
        </span>
      </div>
      <p className="mt-1.5 text-[12.5px] leading-relaxed text-[#8b95a8]">{row.detail}</p>
      <div className="mt-2.5 flex flex-wrap items-baseline gap-x-3 font-[family-name:var(--font-mono-ui)] text-[11px] text-[#687287]">
        <span className="break-all">{shortenHex(row.hash, 14, 8)} ↗</span>
        {row.block ? <span>block {row.block.toLocaleString()}</span> : null}
        <span className="text-[#4b5568]">{row.network}</span>
      </div>
    </a>
  );
}

export default function Evidence() {
  return (
    <DocsPage
      eyebrow="Reference"
      title="Evidence"
      lead="Every contract and every settled transaction, each naming the file its value comes from - so a reader who does not trust this page can check it against the chain and against the repository."
      slug="evidence"
    >
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
      <div className="mt-6 flex flex-col gap-3">
        {TX_RECORD.map((row) => (
          <TxCard key={row.hash} row={row} />
        ))}
      </div>

      <H2>Contracts</H2>
      <P>
        Rows marked STARKWARE are not ours: the privacy pool and the shadow anonymizer are
        StarkWare&apos;s deployments, used rather than redeployed. The distinction matters when you
        are deciding whom to trust - that cryptography is audited, and the helpers around it are
        not.
      </P>
      <div className="mt-6 flex flex-col gap-3">
        {CONTRACT_RECORD.map((row) => (
          <ContractCard key={`${row.network}-${row.address}`} row={row} />
        ))}
      </div>

      <H2>Retired</H2>
      <P>
        Listed rather than deleted. A deployment that was live and then abandoned is exactly what a
        reader deserves to find named, and this one&apos;s failure is the most instructive bug in
        the repository - see <A href="/docs/how-it-works/the-vault">the vault</A>.
      </P>
      <div className="mt-6 flex flex-col gap-3">
        {RETIRED_CONTRACTS.map((row) => (
          <ContractCard key={`${row.network}-${row.address}`} row={row} />
        ))}
      </div>

      <H2>What this does not prove</H2>
      <Limit>
        A transaction succeeding proves the code did what it did, not that the code is correct.
        None of the Sealed contracts have been audited. Everything except the three mainnet shields
        is on Sepolia with test money, and the two mainnet shields exercise StarkWare&apos;s pool
        rather than any contract of ours.
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
