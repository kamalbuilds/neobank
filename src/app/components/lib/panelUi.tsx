/**
 * Tailwind replacement for the legacy `uni.module.css` CSS Module.
 *
 * Panels (Shield, Spend, Swap, Fund, Send, Receive, Unshield, Activity), the
 * wallet picker, and the receipt/verdict cards used to import a hand-rolled
 * CSS Module while the shell (AccountChrome/VaultShell) runs the Tailwind v4
 * glass system. Two design systems sharing a color palette still reads as
 * inconsistent: different radii, no elevation, no shared motion. This file
 * is the single Tailwind vocabulary both now share. Project rule: Tailwind
 * only, no raw CSS files.
 */

const FOCUS_RING =
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2dd4bf]/60 focus-visible:ring-offset-2 focus-visible:ring-offset-[#06070b]';

export const ui = {
  // --- Layout shells ------------------------------------------------------
  nav: 'flex items-center justify-between max-w-[1160px] mx-auto px-6 py-4',
  brand:
    'flex items-center gap-2.5 font-[family-name:var(--font-display)] font-semibold text-[17px] tracking-[-0.01em] text-[#eaf0f8]',
  panel: 'w-full max-w-[520px] mx-auto animate-rise-in',

  // --- Tabs -----------------------------------------------------------
  tab: `rounded-full px-4 py-2 text-[13px] font-medium whitespace-nowrap transition-colors duration-150 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed text-[#7a859c] hover:text-[#eaf0f8] hover:bg-white/[0.04] ${FOCUS_RING}`,
  tabActive: `rounded-full px-4 py-2 text-[13px] font-semibold whitespace-nowrap transition-colors duration-150 cursor-pointer text-[#052e27] bg-gradient-to-br from-[#2dd4bf] to-[#5eead4] shadow-[0_4px_16px_-6px_rgba(45,212,191,0.5)] ${FOCUS_RING}`,

  // --- Amount input block --------------------------------------------------
  inputBlock: 'rounded-2xl border border-white/[0.07] bg-white/[0.028] backdrop-blur-xl elevate-1 p-4 sm:p-[18px]',
  inputLabel: 'text-[11px] font-semibold uppercase tracking-[0.1em] text-[#6ee9d5]',
  inputMain: 'flex items-center justify-between gap-3 mt-2 mb-3',
  bigValue:
    'w-[60%] min-w-0 border-none bg-transparent p-0 font-[family-name:var(--font-display)] text-[32px] sm:text-[42px] font-medium leading-none tracking-[-0.03em] tabular-nums text-[#eaf0f8] outline-none placeholder:text-[#4f586a]',

  // --- Generic form field chrome (native input/select/textarea) -----------
  inputField: `min-h-11 rounded-xl border border-white/[0.08] bg-white/[0.04] px-3.5 font-[family-name:var(--font-mono-ui)] text-[13px] tabular-nums text-[#eaf0f8] outline-none transition-[border-color,box-shadow,background-color] duration-150 placeholder:text-[#4f586a] hover:border-white/[0.14] hover:bg-white/[0.06] focus:border-[#2dd4bf]/60 focus:bg-white/[0.055] focus:ring-4 focus:ring-[#2dd4bf]/10`,

  subLine: 'flex items-center justify-between gap-2.5 text-[13px] text-[#7a859c]',
  subMono: 'font-[family-name:var(--font-mono-ui)] tabular-nums',

  tokenPill:
    'inline-flex items-center gap-2 whitespace-nowrap rounded-full border border-white/[0.12] bg-white/[0.04] py-[7px] pl-2 pr-[15px] text-[15px] font-semibold text-[#eaf0f8]',
  tokenDot: 'inline-flex items-center [&>svg]:block',

  // --- Fee / status rows ----------------------------------------------------
  feeRow:
    'mt-2 flex items-center justify-between gap-2.5 rounded-2xl border border-white/[0.07] bg-white/[0.028] px-4 py-[15px] text-[14px] text-[#7a859c]',
  feeVal: 'inline-flex items-center gap-[7px] font-medium tabular-nums text-[#eaf0f8]',

  // --- Receipt / result card -------------------------------------------------
  receipt: 'mt-3 rounded-2xl border p-4 backdrop-blur-xl elevate-1',
  receiptOk:
    'border-[#34d399]/30 bg-gradient-to-b from-[#34d399]/[0.08] to-[#34d399]/[0.03] shadow-[inset_0_1px_0_rgba(255,255,255,0.04),0_0_28px_-14px_rgba(52,211,153,0.55)]',
  receiptError: 'border-[#f87171]/35 bg-gradient-to-b from-[#f87171]/[0.08] to-[#f87171]/[0.03]',
  receiptPending: 'border-[#2dd4bf]/30 bg-[#2dd4bf]/[0.09]',
  receiptHead: 'flex items-center gap-[9px] text-[14px] font-semibold tracking-[-0.01em] text-[#eaf0f8]',
  receiptIcon:
    'grid size-5 flex-none place-items-center rounded-full text-[12px] font-extrabold leading-none text-[#04120e]',
  receiptRows: 'mt-3 flex flex-col gap-0.5',
  receiptRow: 'flex items-center justify-between gap-3 border-t border-white/[0.05] py-[7px] text-[13px] first:border-t-0',
  receiptLabel: 'text-[#7a859c]',
  receiptValue: 'font-medium tabular-nums text-[#eaf0f8]',
  receiptLink:
    'font-[family-name:var(--font-mono-ui)] text-[12.5px] font-semibold text-[#6ee9d5] no-underline hover:underline',
  receiptNote:
    'mt-3 max-h-[220px] overflow-auto whitespace-pre-wrap break-words rounded-xl border border-white/[0.05] bg-black/35 p-[10px_12px] font-[family-name:var(--font-mono-ui)] text-[12px] leading-relaxed text-[#b7c0d0]',

  // --- Buttons ---------------------------------------------------------------
  btnCta: `mt-2.5 w-full rounded-2xl bg-gradient-to-br from-[#2dd4bf] to-[#38bdf8] px-4 py-4 font-body text-[16px] font-semibold text-[#04140f] shadow-[0_10px_30px_-12px_rgba(45,212,191,0.55)] transition-[filter,transform,box-shadow,opacity] duration-150 not-disabled:hover:brightness-[1.07] not-disabled:hover:shadow-[0_14px_36px_-12px_rgba(45,212,191,0.7)] not-disabled:active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-40 ${FOCUS_RING}`,

  // --- Misc text ---------------------------------------------------------------
  warn: 'px-3 pt-2 text-[12.5px] font-medium leading-relaxed text-[#f87171] [&_a]:font-semibold [&_a]:text-[#6ee9d5] [&_a]:no-underline [&_a:hover]:underline',
  errorText: 'mt-3 text-[13px] font-medium text-[#f87171]',

  // --- Connect / address pill --------------------------------------------------
  connectPill: `rounded-full border-none bg-gradient-to-br from-[#2dd4bf] to-[#38bdf8] px-[18px] py-[9px] font-body text-[14px] font-semibold text-[#04120e] shadow-[0_6px_20px_-8px_rgba(45,212,191,0.55)] transition-[filter,transform] duration-150 not-disabled:hover:brightness-[1.07] not-disabled:active:scale-[0.98] disabled:cursor-wait disabled:opacity-60 ${FOCUS_RING}`,
  addrPill:
    'inline-flex cursor-pointer items-center gap-[9px] rounded-full border border-white/[0.12] bg-white/[0.04] py-[7px] pl-[13px] pr-[7px] font-[family-name:var(--font-mono-ui)] text-[13px] font-bold text-[#eaf0f8]',
  addrDot: 'size-2 rounded-full bg-[#34d399] shadow-[0_0_8px_rgba(52,211,153,0.7)]',
  addrDisconnect:
    'rounded-full border border-transparent bg-white/[0.04] px-[10px] py-1 font-body text-[12px] font-semibold text-[#7a859c] transition-colors hover:text-[#eaf0f8]',

  netDot: 'size-[7px] rounded-full',
  netOkDot: 'bg-[#34d399] shadow-[0_0_8px_rgba(52,211,153,0.7)]',

  // --- Wallet picker modal -----------------------------------------------------
  modalOverlay:
    'fixed inset-0 z-[1000] flex items-center justify-center bg-black/[0.66] p-5 backdrop-blur-md',
  modal:
    'w-[min(400px,calc(100vw-32px))] animate-rise-in rounded-[22px] border border-white/[0.12] bg-[#0c0e15] p-[18px] shadow-[0_30px_80px_-20px_rgba(0,0,0,0.75)]',
  modalHead: 'mb-3.5 flex items-center justify-between',
  modalTitle: 'text-[17px] font-semibold tracking-[-0.01em] text-[#eaf0f8]',
  modalClose: `grid size-[30px] place-items-center rounded-full border-none bg-white/[0.04] text-[20px] leading-none text-[#7a859c] transition-colors duration-150 not-disabled:hover:bg-white/[0.08] not-disabled:hover:text-[#eaf0f8] disabled:cursor-not-allowed disabled:opacity-50 ${FOCUS_RING}`,
  walletList: 'flex flex-col gap-2',
  walletRow: `flex w-full cursor-pointer items-center gap-[13px] rounded-2xl border border-white/[0.07] bg-white/[0.028] px-3.5 py-[13px] text-left text-[#eaf0f8] transition-colors duration-150 not-disabled:hover:border-[#2dd4bf]/40 not-disabled:hover:bg-white/[0.05] disabled:cursor-wait disabled:opacity-60 ${FOCUS_RING}`,
  walletIcon: 'size-8 flex-none rounded-lg',
  walletName: 'flex-1 text-[15px] font-semibold text-[#eaf0f8]',
  walletGo: 'text-[16px] text-[#7a859c]',
  walletHint: 'p-[6px_2px] text-[14px] leading-[1.5] text-[#7a859c] [&_a]:font-semibold [&_a]:text-[#6ee9d5] [&_a]:no-underline [&_a:hover]:underline',
} as const;
