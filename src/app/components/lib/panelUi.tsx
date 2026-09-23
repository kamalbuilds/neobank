/**
 * The shared Tailwind vocabulary for panels, the wallet picker and receipts.
 *
 * Rebuilt for the document system: graphite chrome carries the controls
 * (hairline rules, 4px corners, tabular figures) and cream paper carries the
 * statements of fact (receipts, ledgers, balances). One accent, seal
 * vermilion, reserved for what is stamped, refused or destructive. Settled
 * money is ledger green. Nothing else is coloured, and nothing is glass.
 *
 * Type is six steps and no half pixels: 11 for a field caption, 13 for body
 * and every figure, 15 for a lead line or a button, 18 for a sub-head, 22 for
 * a serif heading, 40 for the balance. A figure, address, hash or network
 * label never renders below 13px, because those are the strings a reviewer has
 * to be able to read and check.
 *
 * Project rule: Tailwind only, no raw CSS files. Surface, redaction, figure
 * and skeleton classes come from globals.css.
 */

const FOCUS_RING =
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--seal-text)] focus-visible:ring-offset-2 focus-visible:ring-offset-chrome';

const PRESS = 'transition-[color,background-color,border-color,transform,opacity] duration-150';

export const ui = {
  // --- Layout shells ------------------------------------------------------
  nav: 'flex items-center justify-between max-w-[1160px] mx-auto px-6 py-4',
  brand:
    'flex items-center gap-2.5 font-[family-name:var(--font-display)] text-[22px] leading-none tracking-[-0.015em] text-ink',
  panel: 'flex w-full max-w-[560px] flex-col gap-4 mx-auto animate-rise-in',

  // --- Headings and captions ----------------------------------------------
  heading:
    'font-[family-name:var(--font-display)] text-[22px] leading-[1.15] tracking-[-0.015em] text-ink',
  subHeading: 'text-[18px] font-medium leading-snug tracking-[-0.01em] text-ink',
  caption: 'text-[11px] font-semibold uppercase tracking-[0.16em] text-muted',
  lead: 'text-[15px] leading-relaxed text-ink',

  // --- Secondary actions ----------------------------------------------------
  tab: `rounded-[4px] border border-[var(--line)] bg-white/[0.02] px-3 py-1.5 text-[13px] font-medium whitespace-nowrap text-muted cursor-pointer ${PRESS} hover:border-[var(--line-strong)] hover:bg-white/[0.05] hover:text-ink not-disabled:active:scale-[0.97] disabled:opacity-40 disabled:cursor-not-allowed ${FOCUS_RING}`,
  tabActive: `rounded-[4px] border border-[var(--seal-soft-2)] bg-[var(--seal-soft)] px-3 py-1.5 text-[13px] font-semibold whitespace-nowrap text-seal-bright cursor-pointer ${PRESS} not-disabled:active:scale-[0.97] ${FOCUS_RING}`,

  // --- Amount input block --------------------------------------------------
  inputBlock: 'doc p-4 sm:p-5',
  inputLabel: 'text-[11px] font-semibold uppercase tracking-[0.16em] text-muted',
  inputMain: 'flex items-center justify-between gap-3 mt-3 mb-3',
  bigValue:
    'figure w-[58%] min-w-0 border-none bg-transparent p-0 text-[32px] sm:text-[40px] font-semibold leading-none tracking-[-0.025em] text-ink outline-none placeholder:text-muted placeholder:opacity-60',

  // --- Generic form field chrome (native input/select/textarea) -----------
  inputField:
    'figure min-h-11 w-full rounded-[4px] border border-[var(--line)] bg-white/[0.025] px-3.5 text-[13px] text-ink outline-none transition-[border-color,background-color] duration-150 placeholder:text-muted placeholder:opacity-80 hover:border-[var(--line-strong)] focus:border-[var(--seal-text)] focus:bg-white/[0.045]',

  subLine: 'flex items-center justify-between gap-2.5 text-[13px] leading-relaxed text-muted',
  subMono: 'figure',
  note: 'text-[13px] leading-relaxed text-muted',

  tokenPill:
    'inline-flex items-center gap-2 whitespace-nowrap rounded-[4px] border border-[var(--line)] bg-white/[0.03] py-[6px] pl-2 pr-3 text-[15px] font-semibold text-ink',
  tokenDot: 'inline-flex items-center [&>svg]:block',

  // --- Fee / status rows ----------------------------------------------------
  // A ruled ledger line, not a boxed card: the fee belongs in the column of
  // figures, not in its own container.
  feeRow:
    'flex items-start justify-between gap-4 border-t border-[var(--line)] px-0.5 py-3 text-[13px] text-muted',
  feeVal: 'figure inline-flex items-center gap-[7px] font-semibold text-ink',

  // --- Receipt / result card -------------------------------------------------
  // A receipt is paper: dark ink on a cream sheet, stamped on the left edge.
  receipt: 'paper relative p-4 sm:p-5',
  receiptOk: 'border-l-[3px] border-l-[#2f6f4f]',
  receiptError: 'border-l-[3px] border-l-[var(--seal)]',
  receiptPending: 'border-l-[3px] border-l-[var(--paper-line)]',
  receiptHead: 'flex items-center gap-2.5 text-[15px] font-semibold tracking-[-0.01em] text-paper-ink',
  receiptIcon:
    'grid size-5 flex-none place-items-center rounded-full text-[11px] font-bold leading-none text-paper',
  receiptRows: 'mt-3 flex flex-col',
  receiptRow:
    'flex items-baseline justify-between gap-3 border-t border-[var(--paper-line)] py-2 text-[13px] first:border-t-0',
  receiptLabel: 'text-paper-muted',
  receiptValue: 'figure font-semibold text-paper-ink',
  receiptLink:
    'figure text-[13px] font-semibold text-seal underline decoration-[var(--seal-soft-2)] underline-offset-[3px] hover:decoration-[var(--seal)]',
  receiptNote:
    'figure mt-3 max-h-[220px] overflow-auto whitespace-pre-wrap break-words rounded-[4px] border border-[var(--paper-line)] bg-paper-2 px-3 py-2.5 text-[13px] leading-relaxed text-paper-ink',

  // --- Buttons ---------------------------------------------------------------
  // The one accent, used where the action stamps something: seal vermilion.
  btnCta: `w-full rounded-[4px] bg-seal px-4 py-3.5 font-body text-[15px] font-semibold tracking-[-0.005em] text-paper ${PRESS} not-disabled:hover:bg-seal-bright not-disabled:active:scale-[0.97] disabled:cursor-not-allowed disabled:opacity-35 ${FOCUS_RING}`,

  // --- Misc text ---------------------------------------------------------------
  warn: 'border-l-2 border-[var(--seal)] pl-3 text-[13px] font-medium leading-relaxed text-seal-bright [&_a]:underline [&_a]:decoration-[var(--seal-soft-2)] [&_a]:underline-offset-[3px] [&_a:hover]:decoration-[var(--seal)]',
  errorText: 'mt-2 text-[13px] font-medium text-seal-bright',

  // --- Connect / address pill --------------------------------------------------
  connectPill: `rounded-[4px] border-none bg-seal px-4 py-2 font-body text-[13px] font-semibold text-paper ${PRESS} not-disabled:hover:bg-seal-bright not-disabled:active:scale-[0.97] disabled:cursor-wait disabled:opacity-60 ${FOCUS_RING}`,
  addrPill:
    'figure inline-flex cursor-pointer items-center gap-2.5 rounded-[4px] border border-[var(--line)] bg-white/[0.03] py-[6px] pl-3 pr-[6px] text-[13px] font-semibold text-ink',
  addrDot: 'size-1.5 rounded-full bg-[var(--green)]',
  addrDisconnect:
    'rounded-[3px] border border-transparent bg-white/[0.04] px-2 py-1 font-body text-[11px] font-semibold text-muted transition-colors hover:text-ink',

  netDot: 'size-1.5 rounded-full',
  netOkDot: 'bg-[var(--green)]',

  // --- Wallet picker modal -----------------------------------------------------
  modalOverlay: 'fixed inset-0 z-[1000] flex items-center justify-center bg-black/72 p-5',
  modal:
    'w-[min(420px,calc(100vw-32px))] animate-rise-in rounded-[4px] border border-[var(--line-strong)] bg-chrome-2 p-5 shadow-[0_30px_80px_-20px_rgba(0,0,0,0.85)]',
  modalHead: 'mb-4 flex items-center justify-between gap-4',
  modalTitle:
    'font-[family-name:var(--font-display)] text-[22px] leading-none tracking-[-0.015em] text-ink',
  modalClose: `grid size-7 place-items-center rounded-[3px] border-none bg-white/[0.04] text-[18px] leading-none text-muted ${PRESS} not-disabled:hover:bg-white/[0.09] not-disabled:hover:text-ink disabled:cursor-not-allowed disabled:opacity-50 ${FOCUS_RING}`,
  walletList: 'flex flex-col gap-2',
  walletRow: `flex w-full cursor-pointer items-center gap-3 rounded-[4px] border border-[var(--line)] bg-white/[0.02] px-3.5 py-3 text-left text-ink ${PRESS} not-disabled:hover:border-[var(--seal-soft-2)] not-disabled:hover:bg-white/[0.05] not-disabled:active:scale-[0.99] disabled:cursor-wait disabled:opacity-60 ${FOCUS_RING}`,
  walletIcon: 'size-8 flex-none rounded-[4px]',
  walletName: 'flex-1 text-[15px] font-semibold text-ink',
  walletGo: 'figure text-[13px] text-muted',
  walletHint:
    'pt-1 text-[13px] leading-relaxed text-muted [&_a]:font-semibold [&_a]:text-seal-bright [&_a]:underline [&_a]:decoration-[var(--seal-soft-2)] [&_a]:underline-offset-[3px] [&_a:hover]:decoration-[var(--seal)]',
} as const;
