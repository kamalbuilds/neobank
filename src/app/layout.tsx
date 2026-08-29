import type { Metadata } from 'next'
import { Geist, Space_Mono, Space_Grotesk } from 'next/font/google'
import './globals.css'

// Faces picked on purpose for the Vault design system (see .uicraft-read.json):
// Space Grotesk carries display type, Geist is the deliberate body face, Space
// Mono only for hex addresses / hashes.
const geist = Geist({
  subsets: ['latin'],
  variable: '--font-body-face',
  display: 'swap',
})
const spaceMono = Space_Mono({
  subsets: ['latin'],
  weight: ['400', '700'],
  variable: '--font-mono-ui',
  display: 'swap',
})
const spaceGrotesk = Space_Grotesk({
  subsets: ['latin'],
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
    'Hold, spend, and move money without publishing your balance. Sepolia testnet, real transactions, test money. Your wallet holds the viewing key for your self-custody balance; the hosted card account is a custodial exception the operator can see.',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html
      lang="en"
      className={`${geist.variable} ${spaceMono.variable} ${spaceGrotesk.variable}`}
      suppressHydrationWarning
    >
      <body>{children}</body>
    </html>
  )
}
