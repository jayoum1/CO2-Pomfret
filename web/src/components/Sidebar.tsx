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
    <aside className="w-64 bg-white border-r border-gray-200 flex flex-col">
      <div className="p-6 border-b border-gray-200">
        <h1 className="text-xl font-bold text-forest-green">🌲 Pomfret Forest</h1>
        <p className="text-sm text-gray-600 mt-1">Simulation & Analysis</p>
      </div>
      <nav className="flex-1 p-4">
        <ul className="space-y-2">
          {navItems.map((item) => {
            const isActive = pathname === item.href
            return (
              <li key={item.href}>
                <Link
                  href={item.href}
                  className={`block px-4 py-2 rounded-lg transition-colors ${
                    isActive
                      ? 'bg-forest-green text-white'
                      : 'text-gray-700 hover:bg-gray-100'
                  }`}
                >
                  {item.label}
                </Link>
              </li>
            )
          })}
        </ul>
      </nav>
      <div className="p-4 border-t border-gray-200 text-xs text-gray-500">
        <p>Pomfret School</p>
        <p className="mt-1">Forest Carbon Project</p>
      </div>
    </aside>
  )
}
