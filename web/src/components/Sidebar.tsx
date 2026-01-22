'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

const navItems = [
  { href: '/', label: 'Dashboard' },
  { href: '/scenarios', label: 'Planting Scenarios' },
  { href: '/visualize', label: 'Visualize' },
  { href: '/about', label: 'About / Assumptions' },
]

export default function Sidebar() {
  const pathname = usePathname()

  return (
    <aside className="w-64 bg-[#0f172a] border-r border-[#1e293b] flex flex-col">
      <div className="p-6 border-b border-[#1e293b]">
        <h1 className="text-xl font-bold text-[#4ade80] neon-glow-subtle">🌲 Pomfret Forest</h1>
        <p className="text-sm text-[#4ade80]/70 mt-1">Simulation & Analysis</p>
      </div>
      <nav className="flex-1 p-4">
        <ul className="space-y-2">
          {navItems.map((item) => {
            const isActive = pathname === item.href
            return (
              <li key={item.href}>
                <Link
                  href={item.href}
                  className={`block px-4 py-2 rounded-lg transition-all ${
                    isActive
                      ? 'bg-[#4ade80] text-[#0f172a] font-semibold shadow-[0_0_12px_rgba(74,222,128,0.3)]'
                      : 'text-[#4ade80]/70 hover:bg-[#1e293b] hover:text-[#4ade80]'
                  }`}
                >
                  {item.label}
                </Link>
              </li>
            )
          })}
        </ul>
      </nav>
      <div className="p-4 border-t border-[#1e293b] text-xs text-[#4ade80]/50">
        <p>Pomfret School</p>
        <p className="mt-1">Forest Carbon Project</p>
      </div>
    </aside>
  )
}
