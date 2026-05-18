import type { Metadata } from 'next'
import { Fraunces, Source_Sans_3, IBM_Plex_Mono } from 'next/font/google'
import './globals.css'
import AppShell from '@/components/layout/AppShell'

const exportMidtermOnly = process.env.NEXT_PUBLIC_EXPORT_MIDTERM_SITE === 'true'

const fontDisplay = Fraunces({
  subsets: ['latin'],
  variable: '--font-display',
  display: 'swap',
})

const fontSans = Source_Sans_3({
  subsets: ['latin'],
  variable: '--font-sans',
  display: 'swap',
})

const fontMono = IBM_Plex_Mono({
  subsets: ['latin'],
  weight: ['400', '500', '600'],
  variable: '--font-mono',
  display: 'swap',
})

const fontVariables = `${fontDisplay.variable} ${fontSans.variable} ${fontMono.variable}`

export const metadata: Metadata = {
  title: exportMidtermOnly
    ? 'CO₂ Pomfret — Project showcase'
    : 'CO₂ Pomfret — Pomfret School Forest Observatory',
  description: exportMidtermOnly
    ? 'Pomfret School forest carbon project — midterm showcase'
    : 'Scientific and educational platform for forest carbon, tree growth, and ecological projections at Pomfret School.',
}

/**
 * Inline script that runs before React hydrates — reads localStorage (or
 * system preference) and applies the `dark` class to <html> immediately,
 * preventing a flash of the wrong theme.
 */
const themeInitScript = `
(function(){
  try {
    var s = localStorage.getItem('co2-pomfret-theme');
    var prefer = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    var t = (s === 'light' || s === 'dark') ? s : prefer;
    if (t === 'dark') document.documentElement.classList.add('dark');
  } catch(e) {}
})();
`

/**
 * Live full app: AppShell + all routes.
 * GitHub Pages (exportMidtermOnly): no shell — only the `/midterm` page exists in that export (see build script).
 */
export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  if (exportMidtermOnly) {
    return (
      <html lang="en" suppressHydrationWarning className={fontVariables}>
        <body className="min-h-screen antialiased font-sans">{children}</body>
      </html>
    )
  }

  return (
    <html lang="en" suppressHydrationWarning className={fontVariables}>
      <head>
        {/* eslint-disable-next-line @next/next/no-sync-scripts */}
        <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
      </head>
      <body className="font-sans">
        <AppShell>
          {children}
        </AppShell>
      </body>
    </html>
  )
}
