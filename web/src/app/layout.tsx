import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'
import AppShell from '@/components/layout/AppShell'

const inter = Inter({ 
  subsets: ['latin'],
  display: 'swap',
})

export const metadata: Metadata = {
  title: 'CO2 Pomfret',
  description: 'Forest growth and carbon sequestration simulation for Pomfret School',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" className="dark">
      <body className={inter.className}>
        <AppShell title="Dashboard" subtitle="Forest snapshots and carbon metrics over time">
          {children}
        </AppShell>
      </body>
    </html>
  )
}
