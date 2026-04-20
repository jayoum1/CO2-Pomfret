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
      <html lang="en">
        <body className="min-h-screen antialiased">{children}</body>
      </html>
    )
  }

  return (
    <html lang="en">
      <body>
        <AppShell>
          {children}
        </AppShell>
      </body>
    </html>
  )
}
