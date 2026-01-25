'use client'

import { useState } from 'react'
import { usePathname } from 'next/navigation'
import Link from 'next/link'
import { Menu, X, Cloud, User, Settings } from 'lucide-react'
import PageTransition from './PageTransition'

const navItems = [
  { href: '/', label: 'Dashboard' },
  { href: '/scenarios', label: 'Forest Modification' },
  { href: '/area', label: 'Generalize Area' },
  { href: '/visualize', label: 'Visualize' },
  { href: '/visualizations', label: 'R Visualizations' },
  { href: '/about', label: 'About' },
]

export default function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)

  return (
    <div className="min-h-screen bg-[var(--bg)] relative">
      {/* Animated Clouds */}
      <div className="cloud cloud-1" />
      <div className="cloud cloud-2" />
      <div className="cloud cloud-3" />
      <div className="cloud cloud-4" />
      <div className="cloud cloud-5" />

      {/* Header */}
      <header className="bg-white/90 backdrop-blur-sm border-b border-[var(--border)] sticky top-0 z-50 relative">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            {/* Logo */}
            <div className="flex items-center space-x-2">
              <div className="w-9 h-9 bg-[var(--primary)]/10 rounded-full flex items-center justify-center">
                <Cloud className="w-6 h-6 text-[var(--primary)]" />
              </div>
              <div>
                <Link href="/" className="text-lg font-semibold text-[var(--text)] no-underline focus:outline-none">
                  CO₂ Pomfret
                </Link>
              </div>
            </div>

            {/* Desktop Navigation */}
            <nav className="hidden md:flex items-center space-x-8">
              {navItems.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`text-sm font-medium transition-all duration-200 ease-in-out no-underline focus:outline-none ${
                    pathname === item.href
                      ? 'text-[var(--primary)]'
                      : 'text-[var(--text-muted)] hover:text-[var(--text)]'
                  }`}
                >
                  {item.label}
                </Link>
              ))}
            </nav>

            {/* Right Side Icons */}
            <div className="hidden md:flex items-center space-x-4">
              <button className="flex items-center space-x-2 text-[var(--text-muted)] hover:text-[var(--text)] transition-colors">
                <User className="w-5 h-5" />
                <span className="text-sm">User</span>
              </button>
              <button className="text-[var(--text-muted)] hover:text-[var(--text)] transition-colors">
                <Settings className="w-5 h-5" />
              </button>
            </div>

            {/* Mobile Menu Button */}
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="md:hidden p-2"
            >
              {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
          </div>
        </div>

        {/* Mobile Menu */}
        {mobileMenuOpen && (
          <div className="md:hidden border-t border-[var(--border)] bg-white">
            <div className="px-2 py-2 space-y-1">
              {navItems.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setMobileMenuOpen(false)}
                  className={`block px-3 py-2 rounded-xl text-base no-underline focus:outline-none ${
                    pathname === item.href
                      ? 'bg-[var(--primary-light)] text-[var(--primary)]'
                      : 'text-[var(--text)] hover:bg-[var(--bg-alt)]'
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
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 relative z-10">
        <PageTransition>
          {children}
        </PageTransition>
      </main>

      {/* Footer */}
      <footer className="bg-white/90 backdrop-blur-sm border-t border-[var(--border)] mt-12 relative z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="text-center text-sm text-[var(--text-muted)]">
            <p>Pomfret School Forest Carbon Project</p>
            <p className="mt-1">© {new Date().getFullYear()}</p>
          </div>
        </div>
      </footer>
    </div>
  )
}
