import type { Metadata } from 'next'
import './globals.css'
import AppShell from '@/components/layout/AppShell'

const exportMidtermOnly = process.env.NEXT_PUBLIC_EXPORT_MIDTERM_SITE === 'true'

export const metadata: Metadata = {
  title: exportMidtermOnly
    ? 'CO₂ Pomfret — Project showcase'
    : 'CO2 Pomfret - Forest Simulation & Analysis',
  description: exportMidtermOnly
    ? 'Pomfret School forest carbon project — midterm showcase'
    : 'Forest growth and carbon sequestration simulation for Pomfret School',
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
      <html lang="en" suppressHydrationWarning>
        <body className="min-h-screen antialiased">{children}</body>
      </html>
    )
  }

  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        {/* eslint-disable-next-line @next/next/no-sync-scripts */}
        <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
      </head>
      <body>
        <AppShell>
          {children}
        </AppShell>
      </body>
    </html>
  )
}
