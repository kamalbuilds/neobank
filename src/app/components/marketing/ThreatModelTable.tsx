type Row = { label: string; hidden?: string; visible?: string; viewingKey?: string };

/**
 * Replaces "the deposit is public" as hero copy. Verified against
 * src/app/components/lib/strk20.ts and src/server/card/runtime.ts:
 * - HIDDEN: protected by the pool's anonymity set. No single viewing key
 *   un-links these, including the owner's own key.
 * - VISIBLE ON-CHAIN: plain public calldata/events. No key changes this.
 * - REVEALED ONLY WITH A VIEWING KEY: encrypted in the note ciphertext.
 *   Anyone holding the relevant viewing key can decrypt it - see the
 *   disclosure below the table for exactly who that is today.
 */
const ROWS: Row[] = [
  {
    label: 'Which other notes were spent alongside yours',
    hidden: 'Unlinkable - protected by the pool’s anonymity set',
  },
  {
    label: 'Sender and receiver of a private transfer',
    viewingKey: 'Decryptable by whoever holds either side’s viewing key',
  },
  {
    label: 'Private transfer and spend amounts',
    viewingKey: 'Decryptable by a viewing-key holder',
  },
  {
    label: 'Your current shielded balance and history in the pool',
    viewingKey: 'Decryptable by a viewing-key holder',
  },
  {
    label: 'Deposit and withdrawal amounts (the public ERC-20 legs)',
    visible: 'Always visible, no key needed',
  },
  {
    label: 'That an address touched the pool, and when',
    visible: 'Always visible, no key needed',
  },
  {
    label: 'The pool fee, paid separately in public STRK',
    visible: 'Always visible, no key needed',
  },
  {
    label: 'The relayer’s address as transaction sender - never yours',
    visible: 'Always visible, no key needed',
  },
];

const COL = 'py-3 pr-5 align-top text-[13px] leading-relaxed';

export function ThreatModelTable() {
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[720px] border-collapse text-left">
        <thead>
          <tr className="border-b border-white/[0.1] text-[11px] font-semibold uppercase tracking-[0.1em] text-[#7a859c]">
            <th scope="col" className="pb-3 pr-5 font-semibold">
              What
            </th>
            <th scope="col" className="pb-3 pr-5 font-semibold text-[#6ee9d5]">
              Hidden
            </th>
            <th scope="col" className="pb-3 pr-5 font-semibold text-[#93c5fd]">
              Visible on-chain
            </th>
            <th scope="col" className="pb-3 font-semibold text-[#c4b5fd]">
              Revealed only with a viewing key
            </th>
          </tr>
        </thead>
        <tbody>
          {ROWS.map((row) => (
            <tr key={row.label} className="border-b border-white/[0.06] last:border-b-0">
              <th scope="row" className={`${COL} font-medium text-[#eaf0f8]`}>
                {row.label}
              </th>
              <td className={`${COL} text-[#a3acbd]`}>{row.hidden ?? '—'}</td>
              <td className={`${COL} text-[#a3acbd]`}>{row.visible ?? '—'}</td>
              <td className={`${COL} text-[#a3acbd]`}>{row.viewingKey ?? '—'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
