import type { Metadata } from 'next'
import { Geist, IBM_Plex_Mono, Instrument_Serif } from 'next/font/google'
import './globals.css'

// Faces picked for the "statement" system (see .uicraft-read.json).
// Instrument Serif carries display type because the argument here is a document,
// not a dashboard. Geist is the body face. IBM Plex Mono holds every figure,
// address and hash, and it is the only face with tabular numerals.
const geist = Geist({
  subsets: ['latin'],
  variable: '--font-body-face',
  display: 'swap',
})
const plexMono = IBM_Plex_Mono({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-mono-ui',
  display: 'swap',
})
const instrumentSerif = Instrument_Serif({
  subsets: ['latin'],
  weight: '400',
  style: ['normal', 'italic'],
  variable: '--font-display-face',
  display: 'swap',
})

export const metadata: Metadata = {
  metadataBase: new URL('https://sealed.cash'),
  title: {
    default: 'Sealed: a private money account on Starknet',
    template: '%s',
  },
  description:
    'Hold, spend, and move money without publishing your balance. Live on Starknet mainnet for holding and shielding through the STRK20 pool; the card, vault and bridge loops run on Sepolia. Your wallet holds the viewing key for your self-custody balance; the hosted card account is a custodial exception the operator can see.',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html
      lang="en"
      className={`${geist.variable} ${plexMono.variable} ${instrumentSerif.variable}`}
      suppressHydrationWarning
    >
      <body>{children}</body>
    </html>
  )
}
