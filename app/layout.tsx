import type { Metadata, Viewport } from 'next'
import { Inter, IBM_Plex_Mono } from 'next/font/google'
import './globals.css'

const body = Inter({ subsets: ['latin'], variable: '--font-body' })
// Mono carries every number and every legend — never a name or a sentence.
// Plex Mono was drawn for technical documentation: flat terminals, a footed 1,
// and a tall x-height that stays solid rather than spindly at 52px.
const mono = IBM_Plex_Mono({ subsets: ['latin'], weight: ['400', '500', '600'], variable: '--font-plex' })

export const metadata: Metadata = {
  title: 'Workout Log',
  description: 'Plan, log, and export your real workout data.',
  applicationName: 'Workout Log',
  appleWebApp: { capable: true, statusBarStyle: 'black-translucent', title: 'Workout Log' },
  icons: {
    icon: '/icon.svg',
    apple: '/apple-touch-icon.png',
  },
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  viewportFit: 'cover',
  themeColor: '#0a0a0a',
}

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={`${body.variable} ${mono.variable}`}>
      <body>{children}</body>
    </html>
  )
}
