type State = 'hidden' | 'public' | 'key';

type Row = { label: string; state: State; detail: string };

/**
 * Eight facts about what a privacy pool on a public chain does and does not
 * conceal. Verified against src/app/components/lib/strk20.ts and
 * src/server/card/runtime.ts:
 * - hidden: protected by the pool's anonymity set. No single viewing key
 *   un-links these, including the owner's own key.
 * - public: plain public calldata or events. No key changes this.
 * - key: encrypted in the note ciphertext. Anyone holding the relevant viewing
 *   key can decrypt it, see the disclosure below the table for who that is.
 *
 * Previously drawn as an eight by three matrix, which meant sixteen of the
 * twenty four cells were a placeholder and the two right-hand columns sat off
 * screen on a phone. Each fact has exactly one state, so it carries one chip.
 */
const ROWS: Row[] = [
  {
    label: 'Which other notes were spent alongside yours',
    state: 'hidden',
    detail: 'Unlinkable. Protected by the pool’s anonymity set.',
  },
  {
    label: 'Sender and receiver of a private transfer',
    state: 'key',
    detail: 'Decryptable by whoever holds either side’s viewing key.',
  },
  {
    label: 'Private transfer and spend amounts',
    state: 'key',
    detail: 'Decryptable by a viewing-key holder.',
  },
  {
    label: 'Your current shielded balance and history in the pool',
    state: 'key',
    detail: 'Decryptable by a viewing-key holder.',
  },
  {
    label: 'Deposit and withdrawal amounts (the public ERC-20 legs)',
    state: 'public',
    detail: 'Always visible, no key needed.',
  },
  {
    label: 'That an address touched the pool, and when',
    state: 'public',
    detail: 'Always visible, no key needed.',
  },
  {
    label: 'The pool fee, paid separately in public STRK',
    state: 'public',
    detail: 'Always visible, no key needed.',
  },
  {
    label: 'The relayer’s address as transaction sender, never yours',
    state: 'public',
    detail: 'Always visible, no key needed.',
  },
];

const CHIP: Record<State, { text: string; className: string }> = {
  hidden: {
    text: 'Hidden',
    className: 'border-ledger-green text-ledger-green',
  },
  public: {
    text: 'Public',
    className: 'border-seal bg-seal text-paper',
  },
  key: {
    text: 'Key gated',
    className: 'border-[rgba(22,22,26,0.45)] text-paper-ink',
  },
};

export function ThreatModelTable() {
  return (
    <div className="paper relative px-5 py-4 sm:px-7 sm:py-5">
      <ul>
        {ROWS.map((row) => {
          const chip = CHIP[row.state];
          return (
            <li
              key={row.label}
              className="rule-paper flex flex-wrap items-baseline gap-x-5 gap-y-2 py-4 sm:flex-nowrap"
            >
              <span
                className={`inline-flex shrink-0 items-center rounded-[3px] border px-2 py-[3px] text-[11px] font-semibold uppercase tracking-[0.1em] sm:w-[7.5rem] sm:justify-center ${chip.className}`}
              >
                {chip.text}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-[15px] font-medium leading-snug text-paper-ink">
                  {row.label}
                </span>
                <span className="mt-1 block text-[13px] leading-relaxed text-paper-muted">
                  {row.detail}
                </span>
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
