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
    <div className="relative z-[1] min-h-screen bg-[var(--bg)]">
      {/* Header — field station strip */}
      <header className="sticky top-0 z-50 border-b border-[var(--border)] bg-[color-mix(in_srgb,var(--surface)_92%,transparent)] backdrop-blur-md dark:border-[var(--border-strong)] dark:bg-[color-mix(in_srgb,var(--surface)_88%,transparent)] shadow-[0_1px_0_color-mix(in_srgb,var(--border)_55%,transparent),0_8px_24px_rgba(0,0,0,0.04)] dark:shadow-[0_1px_0_color-mix(in_srgb,var(--border)_40%,transparent),0_8px_28px_rgba(0,0,0,0.35)]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-stretch min-h-[3.5rem]">

            {/* Logo + catalog line */}
            <div className="flex items-center gap-3 mr-8 py-2">
              <div className="w-9 h-9 rounded-full border border-[color-mix(in_srgb,var(--primary)_45%,var(--border))] bg-[var(--primary-light)] flex items-center justify-center shrink-0 ring-2 ring-[color-mix(in_srgb,var(--surface)_100%,transparent)]">
                <Leaf className="w-4 h-4 text-[var(--primary)]" strokeWidth={1.5} />
              </div>
              <div className="flex flex-col justify-center min-w-0">
                <Link href="/" className="font-display text-[15px] sm:text-[16px] font-semibold text-[var(--text)] no-underline focus:outline-none tracking-[-0.02em] leading-tight">
                  CO₂ Pomfret
                </Link>
                <span className="hidden sm:block text-[10px] font-mono uppercase tracking-[0.12em] text-[var(--text-faint)] mt-0.5">
                  Pomfret School · Forest Observatory
                </span>
              </div>
            </div>

            {/* Desktop Navigation */}
            <nav className="hidden md:flex items-stretch flex-1">
              {navItems.map((item) => {
                const isActive = pathname === item.href
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={`flex items-center px-3 text-sm font-medium border-b-[3px] transition-colors duration-150 no-underline focus:outline-none whitespace-nowrap ${
                      isActive
                        ? 'text-[var(--text)] border-[var(--primary)]'
                        : 'text-[var(--text-muted)] border-transparent hover:text-[var(--text-body)] hover:border-[color-mix(in_srgb,var(--border)_80%,var(--primary))]'
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
          <div className="md:hidden border-t border-[var(--border)] bg-[color-mix(in_srgb,var(--surface)_96%,transparent)] backdrop-blur-md">
            <div className="px-3 py-2 space-y-0.5">
              {navItems.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setMobileMenuOpen(false)}
                  className={`block px-3 py-2.5 rounded-card text-sm font-medium no-underline focus:outline-none transition-colors border-l-[3px] ${
                    pathname === item.href
                      ? 'border-[var(--primary)] bg-[var(--primary-light)] text-[var(--text)]'
                      : 'border-transparent text-[var(--text-body)] hover:bg-[var(--surface-2)]'
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
      <main className="relative z-[1] max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <PageTransition>
          {children}
        </PageTransition>
      </main>

      {/* Footer */}
      <footer className="relative z-[1] border-t border-[var(--border)] mt-auto bg-[color-mix(in_srgb,var(--surface)_35%,transparent)]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-5">
          <div className="text-center text-meta font-mono text-[var(--text-faint)] tracking-wide">
            <p>Pomfret School · Field records & carbon observatory · {new Date().getFullYear()}</p>
          </div>
        </div>
      </footer>
    </div>
  )
}
