'use client'

import { useState } from 'react'
import { usePathname } from 'next/navigation'
import Link from 'next/link'
import { Menu } from 'lucide-react'
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

const navItems = [
  { href: '/', label: 'Dashboard', icon: '📊' },
  { href: '/scenarios', label: 'Planting Scenarios', icon: '🌱' },
  { href: '/visualize', label: 'Visualize', icon: '🌍' },
  { href: '/visualizations', label: 'R Visualizations', icon: '📈' },
  { href: '/about', label: 'About / Assumptions', icon: 'ℹ️' },
]

interface AppShellProps {
  children: React.ReactNode
  title?: string
  subtitle?: string
  actions?: React.ReactNode
}

export default function AppShell({ children, title, subtitle, actions }: AppShellProps) {
  const pathname = usePathname()
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)

  return (
    <div className="flex h-screen bg-[var(--bg)] overflow-hidden">
      {/* Desktop Sidebar */}
      <aside className="hidden lg:flex lg:w-64 lg:flex-col glass-panel border-r border-[var(--border)]">
        <div className="flex flex-col flex-1">
          {/* Logo/Brand */}
          <div className="flex h-16 items-center px-6 border-b border-[var(--border)]">
            <div className="flex items-center gap-2">
              <span className="text-2xl">🌲</span>
              <div>
                <h1 className="text-heading-3 text-[var(--text)]">CO2 Pomfret</h1>
                <p className="text-label">Simulation & Analysis</p>
              </div>
            </div>
          </div>

          {/* Navigation */}
          <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
            {navItems.map((item) => {
              const isActive = pathname === item.href
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    "flex items-center gap-3 px-4 py-2.5 rounded-lg transition-premium",
                    isActive
                      ? 'bg-[var(--accent)] text-[var(--primary)] border border-[var(--primary)]/20'
                      : 'text-[var(--muted)] hover:bg-[var(--panel2)] hover:text-[var(--text)]'
                  )}
                >
                  <span className="text-lg">{item.icon}</span>
                  <span className="text-sm font-medium">{item.label}</span>
                  {isActive && (
                    <div className="ml-auto w-1.5 h-1.5 rounded-full bg-[var(--primary)]" />
                  )}
                </Link>
              )
            })}
          </nav>

          {/* Footer */}
          <div className="p-4 border-t border-[var(--border)]">
            <p className="text-label">Pomfret School</p>
            <p className="text-label mt-1">Forest Carbon Project</p>
          </div>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="flex flex-col flex-1 overflow-hidden">
        {/* Topbar */}
        <header className="flex h-16 items-center gap-4 px-4 md:px-6 border-b border-[var(--border)] glass-panel backdrop-blur-sm">
          {/* Mobile Menu Button */}
          <Sheet open={mobileMenuOpen} onOpenChange={setMobileMenuOpen}>
            <SheetTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="lg:hidden"
                aria-label="Toggle menu"
              >
                <Menu className="h-5 w-5" />
              </Button>
            </SheetTrigger>
            <SheetContent side="left" className="w-64 p-0 glass-panel border-r border-[var(--border)]">
              <div className="flex flex-col h-full">
                <div className="flex h-16 items-center px-6 border-b border-[var(--border)]">
                  <div className="flex items-center gap-2">
                    <span className="text-2xl">🌲</span>
                    <div>
                      <h1 className="text-heading-3 text-[var(--text)]">CO2 Pomfret</h1>
                      <p className="text-label">Simulation & Analysis</p>
                    </div>
                  </div>
                </div>
                <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
                  {navItems.map((item) => {
                    const isActive = pathname === item.href
                    return (
                      <Link
                        key={item.href}
                        href={item.href}
                        onClick={() => setMobileMenuOpen(false)}
                        className={cn(
                          "flex items-center gap-3 px-4 py-2.5 rounded-lg transition-premium",
                          isActive
                            ? 'bg-[var(--accent)] text-[var(--primary)] border border-[var(--primary)]/20'
                            : 'text-[var(--muted)] hover:bg-[var(--panel2)] hover:text-[var(--text)]'
                        )}
                      >
                        <span className="text-lg">{item.icon}</span>
                        <span className="text-sm font-medium">{item.label}</span>
                        {isActive && (
                          <div className="ml-auto w-1.5 h-1.5 rounded-full bg-[var(--primary)]" />
                        )}
                      </Link>
                    )
                  })}
                </nav>
                <div className="p-4 border-t border-[var(--border)]">
                  <p className="text-label">Pomfret School</p>
                  <p className="text-label mt-1">Forest Carbon Project</p>
                </div>
              </div>
            </SheetContent>
          </Sheet>

          {/* Page Title */}
          <div className="flex-1">
            {title && (
              <>
                <h1 className="text-heading-2 text-[var(--text)]">{title}</h1>
                {subtitle && (
                  <p className="text-label mt-0.5">{subtitle}</p>
                )}
              </>
            )}
          </div>

          {/* Actions */}
          {actions && (
            <div className="flex items-center gap-2">
              {actions}
            </div>
          )}
        </header>

        {/* Main Content */}
        <main className="flex-1 overflow-y-auto p-4 md:p-6">
          {children}
        </main>
      </div>
    </div>
  )
}
