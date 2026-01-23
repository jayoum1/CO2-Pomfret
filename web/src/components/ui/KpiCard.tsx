import { LucideIcon } from 'lucide-react'
import { GlassCard } from './GlassCard'
import { cn } from '@/lib/utils'

interface KpiCardProps {
  title: string
  value: string | number
  delta?: {
    value: string | number
    trend: 'up' | 'down' | 'neutral'
  }
  icon?: LucideIcon
  description?: string
  className?: string
}

export function KpiCard({ 
  title, 
  value, 
  delta, 
  icon: Icon, 
  description,
  className 
}: KpiCardProps) {
  const deltaColor = delta?.trend === 'up' 
    ? 'text-[var(--success)]' 
    : delta?.trend === 'down'
    ? 'text-[var(--error)]'
    : 'text-[var(--muted)]'

  return (
    <div className={cn('rounded-xl bg-[var(--panel)] p-6 shadow-md border border-[var(--border)] hover:border-[var(--primary)]/30 transition-all', className)}>
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <p className="text-[11px] uppercase tracking-wider text-[var(--muted)] mb-2 font-medium">{title}</p>
          <div className="flex items-baseline gap-2">
            <p className="text-[32px] font-bold text-[var(--text)] leading-tight">{value}</p>
            {delta && (
              <span className={cn('text-sm font-medium', deltaColor)}>
                {delta.trend === 'up' ? '↑' : delta.trend === 'down' ? '↓' : '→'} {delta.value}
              </span>
            )}
          </div>
          {description && (
            <p className="text-[12px] text-[var(--muted)] mt-2 uppercase">{description}</p>
          )}
        </div>
        {Icon && (
          <div className="p-2 rounded-lg bg-[var(--primary-light)]">
            <Icon className="h-6 w-6 text-[var(--primary)]" />
          </div>
        )}
      </div>
    </div>
  )
}
