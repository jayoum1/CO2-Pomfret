'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useState } from 'react'

const navItems = [
  { href: '/', label: 'Dashboard', icon: '📊' },
  { href: '/scenarios', label: 'Planting Scenarios', icon: '🌱' },
  { href: '/visualize', label: 'Visualize', icon: '🌍' },
  { href: '/visualizations', label: 'R Visualizations', icon: '📈' },
  { href: '/about', label: 'About / Assumptions', icon: 'ℹ️' },
]

export default function Sidebar() {
  const pathname = usePathname()
  const [isOpen, setIsOpen] = useState(true)

  return (
    <>
      {/* Mobile toggle button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="fixed top-4 left-4 z-50 lg:hidden bg-[#F5E6D3] p-2 rounded-lg text-[#0d4d0d] hover:bg-[#E8D5B7] border border-[#8B7355] shadow-sm transition-all"
        aria-label="Toggle sidebar"
      >
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          {isOpen ? (
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          ) : (
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
          )}
        </svg>
      </button>

      {/* Sidebar */}
      <aside 
        className={`
          fixed lg:static inset-y-0 left-0 z-40
          w-64 bg-[#F5E6D3] border-r border-[#8B7355]
          flex flex-col
          transform transition-transform duration-300
        `}
        style={{
          transitionTimingFunction: 'cubic-bezier(0.16, 1, 0.3, 1)',
          transform: isOpen ? 'translateX(0)' : 'translateX(-100%)'
        }}
      >
        <div className="p-6 border-b border-[#8B7355]">
          <h1 className="text-xl font-bold text-[#0d4d0d]-subtle">🌲 Pomfret Forest</h1>
          <p className="text-sm text-[#0d4d0d] mt-1-subtle">Simulation & Analysis</p>
        </div>
        <nav className="flex-1 p-4 overflow-y-auto">
          <ul className="space-y-2">
            {navItems.map((item, index) => {
              const isActive = pathname === item.href
              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    onClick={() => {
                      // Only close sidebar on mobile
                      if (window.innerWidth < 1024) {
                        setIsOpen(false)
                      }
                    }}
                    className={`
                      flex items-center gap-3 px-4 py-3 rounded-lg
                      transition-all duration-200 ease-out
                      group relative overflow-hidden
                      ${isActive
                        ? 'bg-[#E8F5E9] text-[#0d4d0d] font-semibold border border-[#8B7355]-subtle'
                        : 'text-[#0d4d0d] hover:bg-[#E8D5B7] hover:text-[#0d4d0d]-subtle'
                      }
                    `}
                  >
                    <span className="text-lg">{item.icon}</span>
                    <span>{item.label}</span>
                    {isActive && (
                      <div className="absolute left-0 top-0 bottom-0 w-1 bg-[#0d4d0d] rounded-r-full"></div>
                    )}
                  </Link>
                </li>
              )
            })}
          </ul>
        </nav>
        <div className="p-4 border-t border-[#8B7355] text-xs text-[#1a5f1a]-subtle">
          <p>Pomfret School</p>
          <p className="mt-1">Forest Carbon Project</p>
        </div>
      </aside>

      {/* Overlay for mobile */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-black/50 backdrop-blur-sm z-30 lg:hidden"
          onClick={() => setIsOpen(false)}
        />
      )}
    </>
  )
}
