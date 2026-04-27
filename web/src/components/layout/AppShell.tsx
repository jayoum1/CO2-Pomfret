'use client'

import { useState } from 'react'
import { usePathname } from 'next/navigation'
import Link from 'next/link'
import { Menu, X, Leaf, Sun, Moon } from 'lucide-react'
import PageTransition from './PageTransition'
import { useTheme } from '@/lib/useTheme'

const navItems = [
  { href: '/', label: 'Forest Insights' },
  { href: '/scenarios', label: 'Forest Modification' },
  { href: '/area', label: 'Generalize Area' },
  { href: '/visualize', label: 'Visualize' },
  { href: '/vector-forest', label: 'Vector Forest' },
  { href: '/about', label: 'About' },
]

export default function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const { theme, toggleTheme, mounted } = useTheme()

  // Standalone routes render without the app shell
  if (pathname.startsWith('/midterm')) {
    return <>{children}</>
  }

  return (
    <div className="min-h-screen bg-[var(--bg)]">
      {/* Header */}
      <header className="bg-[var(--surface)]/95 backdrop-blur-md border-b border-[var(--border)] dark:border-[var(--border-strong)] shadow-[0_1px_3px_rgba(0,0,0,0.07)] dark:shadow-[0_1px_8px_rgba(0,0,0,0.35)] sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-stretch h-14">

            {/* Logo */}
            <div className="flex items-center gap-2.5 mr-8">
              <div className="w-8 h-8 bg-[var(--primary)]/10 rounded-card flex items-center justify-center shrink-0">
                <Leaf className="w-4 h-4 text-[var(--primary)]" />
              </div>
              <Link href="/" className="text-[15px] font-semibold text-[var(--text)] no-underline focus:outline-none tracking-tight">
                CO₂ Pomfret
              </Link>
            </div>

            {/* Desktop Navigation */}
            <nav className="hidden md:flex items-stretch flex-1">
              {navItems.map((item) => {
                const isActive = pathname === item.href
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={`flex items-center px-3 text-sm font-medium border-b-2 transition-colors duration-150 no-underline focus:outline-none whitespace-nowrap ${
                      isActive
                        ? 'text-[var(--accent-text)] border-[var(--accent)]'
                        : 'text-[var(--text-muted)] border-transparent hover:text-[var(--text-body)] hover:border-[var(--border)]'
                    }`}
                  >
                    {item.label}
                  </Link>
                )
              })}
            </nav>

            {/* Right side: theme toggle + mobile menu */}
            <div className="flex items-center gap-1">
              {/* Theme toggle — hidden until mounted to avoid hydration mismatch */}
              {mounted && (
                <button
                  type="button"
                  onClick={toggleTheme}
                  aria-label={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
                  className="flex items-center justify-center w-8 h-8 rounded-control text-[var(--text-muted)] hover:text-[var(--text)] hover:bg-[var(--surface-2)] transition-colors"
                >
                  {theme === 'dark'
                    ? <Sun className="w-4 h-4" />
                    : <Moon className="w-4 h-4" />
                  }
                </button>
              )}

              {/* Mobile menu toggle */}
              <button
                onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                className="md:hidden flex items-center p-2 text-[var(--text-muted)] hover:text-[var(--text)] transition-colors"
                aria-label="Toggle menu"
              >
                {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
              </button>
            </div>
          </div>
        </div>

        {/* Mobile Menu */}
        {mobileMenuOpen && (
          <div className="md:hidden border-t border-[var(--border)] bg-[var(--surface)]">
            <div className="px-3 py-2 space-y-0.5">
              {navItems.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setMobileMenuOpen(false)}
                  className={`block px-3 py-2.5 rounded-card text-sm font-medium no-underline focus:outline-none transition-colors ${
                    pathname === item.href
                      ? 'bg-[var(--primary-light)] text-[var(--primary)]'
                      : 'text-[var(--text-body)] hover:bg-[var(--surface-2)]'
                  }`}
                >
                  {item.label}
                </Link>
              ))}
            </div>
          </div>
        )}
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <PageTransition>
          {children}
        </PageTransition>
      </main>

      {/* Footer */}
      <footer className="border-t border-[var(--border)] mt-auto">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-5">
          <div className="text-center text-meta text-[var(--text-faint)]">
            <p>Pomfret School · Forest Carbon Project · {new Date().getFullYear()}</p>
          </div>
        </div>
      </footer>
    </div>
  )
}
