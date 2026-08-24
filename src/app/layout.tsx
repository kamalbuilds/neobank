import type { Metadata } from 'next'
import { Inter, Space_Mono, Space_Grotesk } from 'next/font/google'
import './globals.css'

// Faces picked on purpose for the Vault design system (see .uicraft-read.json):
// Space Grotesk carries display type, Inter is the deliberate body face, Space
// Mono only for hex addresses / hashes.
const inter = Inter({
  subsets: ['latin'],
  variable: '--font-body',
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
  variable: '--font-display',
  display: 'swap',
})

export const metadata: Metadata = {
  metadataBase: new URL('https://neobank-six.vercel.app'),
  title: 'Private money account',
  description: 'Shield, send, and unshield STRK or USDC on the live STRK20 pool. The app never holds a viewing key.',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html
      lang="en"
      className={`${inter.variable} ${spaceMono.variable} ${spaceGrotesk.variable}`}
      suppressHydrationWarning
    >
      <body>{children}</body>
    </html>
  )
}
