'use client'

import { useState, ReactNode } from 'react'

interface TabsProps {
  defaultValue: string
  children: ReactNode
  className?: string
}

interface TabsListProps {
  children: ReactNode
  className?: string
}

interface TabsTriggerProps {
  value: string
  children: ReactNode
  className?: string
}

interface TabsContentProps {
  value: string
  children: ReactNode
  className?: string
}

export function Tabs({ defaultValue, children, className = '' }: TabsProps) {
  const [activeTab, setActiveTab] = useState(defaultValue)

  return (
    <div className={className}>
      {children && typeof children === 'object' && 'map' in children
        ? children.map((child: any) => {
            if (child?.type?.name === 'TabsList') {
              return {
                ...child,
                props: { ...child.props, activeTab, setActiveTab },
              }
            }
            if (child?.type?.name === 'TabsContent') {
              return {
                ...child,
                props: { ...child.props, activeTab },
              }
            }
            return child
          })
        : children}
    </div>
  )
}

export function TabsList({ children, className = '', activeTab, setActiveTab }: TabsListProps & { activeTab?: string; setActiveTab?: (value: string) => void }) {
  return (
    <div className={`inline-flex h-10 items-center justify-center rounded-lg bg-gray-100 p-1 ${className}`}>
      {children && typeof children === 'object' && 'map' in children
        ? children.map((child: any) => ({
            ...child,
            props: { ...child.props, activeTab, setActiveTab },
          }))
        : children}
    </div>
  )
}

export function TabsTrigger({ value, children, className = '', activeTab, setActiveTab }: TabsTriggerProps & { activeTab?: string; setActiveTab?: (value: string) => void }) {
  const isActive = activeTab === value
  return (
    <button
      onClick={() => setActiveTab?.(value)}
      className={`inline-flex items-center justify-center whitespace-nowrap rounded-md px-3 py-1.5 text-sm font-medium ring-offset-white transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gray-950 focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 ${
        isActive
          ? 'bg-white text-gray-950 shadow-sm'
          : 'text-gray-600 hover:text-gray-900'
      } ${className}`}
    >
      {children}
    </button>
  )
}

export function TabsContent({ value, children, className = '', activeTab }: TabsContentProps & { activeTab?: string }) {
  if (activeTab !== value) return null
  return <div className={className}>{children}</div>
}
